import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  WorkOrder,
  SubOffice,
  MonthTable,
  PlatformUser,
  ColumnDefinition,
  SHAREPOINT_AUDIT_URL
} from '../types';
import {
  X,
  FileSpreadsheet,
  FileDown,
  Printer,
  Calendar,
  Building2,
  Briefcase,
  Award,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Sparkles,
  ShieldCheck,
  FileText,
  Layers,
  BarChart3,
  RotateCcw,
  Copy,
  Check,
  ExternalLink,
  FolderOpen
} from 'lucide-react';
import { getArabicMonthName, ARABIC_MONTHS, resolveOrderScope } from '../utils/tableScope';
import { soundService } from '../services/soundService';
import { UnifiedSectionExportBar } from './UnifiedSectionExportBar';
import { exportToPdf, exportOrdersDirectToPdf } from '../services/exportService';
import { INITIAL_COLUMNS, ensurePhotosFileColumn } from '../data/initialData';
import { formatOrderAudit18SummaryText } from '../data/auditChecklistData';
import {
  getEvaluatedSupportChecklistKeys,
  getEvaluatedColumnSupportChecklistKeys
} from './TechnicalSupportAuditModal';
import {
  isOrderQualified100InAllThreeAudits,
  getEffectiveProcedure155Status
} from '../utils/auditTracker';
import ExcelJS from 'exceljs';

export type ReportViewMode = 'aggregated' | 'detailed';
export type AggregationPeriodType = 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual';

interface ComprehensiveReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrders: WorkOrder[];
  allWorkOrders?: WorkOrder[];
  monthTables?: MonthTable[];
  offices?: SubOffice[];
  columns?: ColumnDefinition[];
  activeYear?: number;
  activeMonth?: number | 'all';
  selectedOffice?: string;
  currentUser?: PlatformUser | null;
  initialMode?: ReportViewMode;
  onOpenOrderFiles?: (order: WorkOrder) => void;
  onOpenExportModal?: (orders: WorkOrder[], title: string, openEmail?: boolean) => void;
}

// Helper to check if a 3-stage audit column (pdcAudit / constructionAudit) is qualified
const isStageQualified = (rawVal: any): boolean => {
  if (!rawVal) return false;
  if (typeof rawVal === 'string') {
    const s = rawVal.trim();
    if (!s || s === 'قيد التدقيق' || s === 'قيد التدقيق الفني') return false;
    return !s.includes('غير') && (s.includes('مؤهل') || s.includes('مكتمل') || s.includes('تم'));
  }
  if (typeof rawVal === 'object') {
    if (Array.isArray(rawVal.evaluatedKeys) && rawVal.evaluatedKeys.length > 0) {
      return rawVal.mainStatus === 'مؤهل';
    }
    return rawVal.mainStatus === 'مؤهل';
  }
  const summary = formatOrderAudit18SummaryText(rawVal);
  return summary.mainStatus === 'مؤهل';
};

const getStageBadgeText = (rawVal: any): string => {
  if (!rawVal) return '';
  if (typeof rawVal === 'string') {
    const s = rawVal.trim();
    return s === 'قيد التدقيق' || s === 'قيد التدقيق الفني' ? '' : s;
  }
  const summary = formatOrderAudit18SummaryText(rawVal);
  return summary.mainStatus === 'مؤهل' || summary.mainStatus === 'غير مؤهل' ? summary.compactBadgeText : '';
};

export const ComprehensiveReportsModal: React.FC<ComprehensiveReportsModalProps> = ({
  isOpen,
  onClose,
  workOrders,
  allWorkOrders,
  monthTables = [],
  offices = [],
  columns = INITIAL_COLUMNS,
  activeYear = new Date().getFullYear(),
  activeMonth = 'all',
  selectedOffice = 'all',
  initialMode = 'aggregated',
  onOpenOrderFiles,
  onOpenExportModal
}) => {
  const currentNow = new Date();
  const currentYearNum = typeof activeYear === 'number' && activeYear > 2000 ? activeYear : currentNow.getFullYear();

  const platformColumns = useMemo(() => ensurePhotosFileColumn(columns), [columns]);

  // Mode: Aggregated (مجمعة) vs Detailed (تفصيلية)
  const [viewMode, setViewMode] = useState<ReportViewMode>(initialMode);

  useEffect(() => {
    if (isOpen) {
      setViewMode(initialMode || 'aggregated');
    }
  }, [isOpen, initialMode]);

  // Aggregated Period Selector: weekly, monthly, quarterly, semi_annual, annual
  const [periodType, setPeriodType] = useState<AggregationPeriodType>('monthly');
  const [selectedYear, setSelectedYear] = useState<number>(currentYearNum);
  const [selectedMonth, setSelectedMonth] = useState<number>(
    typeof activeMonth === 'number' ? activeMonth : currentNow.getMonth() + 1
  );
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(
    (Math.floor(currentNow.getMonth() / 3) + 1) as 1 | 2 | 3 | 4
  );
  const [selectedHalf, setSelectedHalf] = useState<1 | 2>(currentNow.getMonth() < 6 ? 1 : 2);
  const [selectedWeek, setSelectedWeek] = useState<'current_week' | 'last_week'>('current_week');

  // Office & Table Scope
  const [officeFilter, setOfficeFilter] = useState<string>(selectedOffice || 'all');
  const [tableFilter, setTableFilter] = useState<string>('all');

  // Detailed view filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusQualificationFilter, setStatusQualificationFilter] = useState<'all' | 'ready' | 'notReady'>('all');
  const [contractorFilter, setContractorFilter] = useState<string>('all');

  // Action status states
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isCopiedSummary, setIsCopiedSummary] = useState<boolean>(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const reportContainerRef = useRef<HTMLDivElement>(null);

  // Available database source: prefer allWorkOrders if provided to cover all linked tables
  const sourceOrders = useMemo(() => {
    return Array.isArray(allWorkOrders) && allWorkOrders.length > 0 ? allWorkOrders : workOrders;
  }, [allWorkOrders, workOrders]);

  // Known offices strictly from the platform
  const knownOfficeNames = useMemo(() => {
    if (offices.length > 0) return offices.map((o) => o.name);
    const fromOrders = Array.from(new Set(sourceOrders.map((o) => (o.office || '').trim()).filter(Boolean)));
    return fromOrders.length > 0 ? fromOrders : ['عرعر', 'رفحاء', 'طريف', 'العويقيلة'];
  }, [offices, sourceOrders]);

  // Available Years extracted from tables and orders
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentYearNum);
    yearsSet.add(2025);
    yearsSet.add(2026);
    yearsSet.add(2027);
    sourceOrders.forEach((o) => {
      if (o.tableYear) yearsSet.add(o.tableYear);
      if (o.createdAt) {
        const y = new Date(o.createdAt).getFullYear();
        if (!isNaN(y) && y > 2020) yearsSet.add(y);
      }
    });
    monthTables.forEach((t) => {
      if (t.year) yearsSet.add(t.year);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [sourceOrders, monthTables, currentYearNum]);

  // Week Date Range calculations
  const weekInfo = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - currentDay);
    const thursday = new Date(sunday);
    thursday.setDate(sunday.getDate() + 4);

    const lastSunday = new Date(sunday);
    lastSunday.setDate(sunday.getDate() - 7);
    const lastThursday = new Date(lastSunday);
    lastThursday.setDate(lastSunday.getDate() + 4);

    const fmt = (d: Date) => `${d.getDate()} / ${d.getMonth() + 1} / ${d.getFullYear()}`;
    return {
      currentWeekRange: `${fmt(sunday)} - ${fmt(thursday)}`,
      lastWeekRange: `${fmt(lastSunday)} - ${fmt(lastThursday)}`
    };
  }, []);

  // Filter orders according to selected Period, Year, Office, and Table
  const periodFilteredOrders = useMemo(() => {
    return sourceOrders.filter((order) => {
      if (officeFilter !== 'all') {
        const off = (order.office || '').trim();
        if (off !== officeFilter && !off.includes(officeFilter) && !officeFilter.includes(off)) {
          return false;
        }
      }

      if (tableFilter !== 'all') {
        if ((order.tableId || 'default') !== tableFilter) return false;
      }

      const { year: orderYear, month: orderMonth } = resolveOrderScope(order, monthTables);

      if (periodType === 'annual') {
        return orderYear === selectedYear;
      }
      if (periodType === 'monthly') {
        return orderYear === selectedYear && orderMonth === selectedMonth;
      }
      if (periodType === 'quarterly') {
        if (orderYear !== selectedYear) return false;
        const q = Math.floor((orderMonth - 1) / 3) + 1;
        return q === selectedQuarter;
      }
      if (periodType === 'semi_annual') {
        if (orderYear !== selectedYear) return false;
        const h = orderMonth <= 6 ? 1 : 2;
        return h === selectedHalf;
      }
      if (periodType === 'weekly') {
        return orderYear === selectedYear;
      }

      return true;
    });
  }, [
    sourceOrders,
    monthTables,
    officeFilter,
    tableFilter,
    periodType,
    selectedYear,
    selectedMonth,
    selectedQuarter,
    selectedHalf
  ]);

  // Further filter for Detailed View
  const detailedFilteredOrders = useMemo(() => {
    return periodFilteredOrders.filter((o) => {
      if (statusQualificationFilter !== 'all') {
        const s = String(o.procedure155Status || '');
        const isReady = !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم'));
        if (statusQualificationFilter === 'ready' && !isReady) return false;
        if (statusQualificationFilter === 'notReady' && isReady) return false;
      }

      if (contractorFilter !== 'all' && o.contractor !== contractorFilter) {
        return false;
      }

      if (searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        const matchWo = String(o.workOrderNumber || '').toLowerCase().includes(q);
        const matchCode = String(o.workOrderCode || '').toLowerCase().includes(q);
        const matchCont = String(o.contractor || '').toLowerCase().includes(q);
        const matchCons = String(o.consultant || '').toLowerCase().includes(q);
        const matchOff = String(o.office || '').toLowerCase().includes(q);
        const matchNotes = String(o.qualityNotes || '').toLowerCase().includes(q);
        if (!matchWo && !matchCode && !matchCont && !matchCons && !matchOff && !matchNotes) return false;
      }

      return true;
    });
  }, [periodFilteredOrders, statusQualificationFilter, contractorFilter, searchQuery]);

  // Active target orders based on current viewMode
  const activeOrders = viewMode === 'detailed' ? detailedFilteredOrders : periodFilteredOrders;

  // Human-readable Period Title
  const periodTitleLabel = useMemo(() => {
    switch (periodType) {
      case 'weekly':
        return selectedWeek === 'current_week'
          ? `التقرير الأسبوعي (${weekInfo.currentWeekRange})`
          : `التقرير الأسبوعي السابق (${weekInfo.lastWeekRange})`;
      case 'monthly':
        return `التقرير الشهري - شهر ${getArabicMonthName(selectedMonth)} ${selectedYear}م`;
      case 'quarterly': {
        const qNames: Record<number, string> = {
          1: 'الربع الأول (يناير - مارس)',
          2: 'الربع الثاني (أبريل - يونيو)',
          3: 'الربع الثالث (يوليو - سبتمبر)',
          4: 'الربع الرابع (أكتوبر - ديسمبر)'
        };
        return `التقرير الربع سنوي - ${qNames[selectedQuarter]} ${selectedYear}م`;
      }
      case 'semi_annual':
        return selectedHalf === 1
          ? `التقرير النصف سنوي الأول (يناير - يونيو) ${selectedYear}م`
          : `التقرير النصف سنوي الثاني (يوليو - ديسمبر) ${selectedYear}م`;
      case 'annual':
        return `التقرير السنوي الشامل لعام ${selectedYear}م`;
    }
  }, [periodType, selectedWeek, weekInfo, selectedMonth, selectedYear, selectedQuarter, selectedHalf]);

  // All contractors in period
  const contractorsInScope = useMemo(() => {
    const set = new Set<string>();
    periodFilteredOrders.forEach((o) => {
      if (o.contractor) set.add(o.contractor);
    });
    return Array.from(set);
  }, [periodFilteredOrders]);

  // Comprehensive Aggregated Statistics (Strictly using real platform columns only)
  const stats = useMemo(() => {
    const total = activeOrders.length;
    const readyOrders = activeOrders.filter((w) => {
      const evalKeys = getEvaluatedSupportChecklistKeys(w);
      const s = String(w.procedure155Status || '').trim();
      const eff155 = getEffectiveProcedure155Status(w);
      return (
        isOrderQualified100InAllThreeAudits(w) ||
        (!eff155.includes('غير') && (eff155.includes('مؤهل') || eff155.includes('تم'))) ||
        (evalKeys.length > 0 && !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد')))
      );
    });
    const readyCount = readyOrders.length;
    const notReadyCount = total - readyCount;
    const readyRate = total > 0 ? Math.round((readyCount / total) * 100) : 0;

    // 6 Real Platform Columns & Audit Stages Breakdown:
    // 1. حالة الإرفاق (attachmentStatus)
    const attachReadyCount = activeOrders.filter((w) => {
      const evalKeys = getEvaluatedSupportChecklistKeys(w);
      const att = String(w.attachmentStatus || '').trim();
      return evalKeys.length > 0 ? att.includes('جاهز') && !att.includes('غير') : Boolean(att && att !== 'غير جاهز للارفاق');
    }).length;
    // 2. ملف الصور SharePoint (photosFile / photos)
    const photosFileCount = activeOrders.filter(
      (w) => (Array.isArray(w.photosFile) && w.photosFile.length > 0) || (Array.isArray(w.photos) && w.photos.length > 0)
    ).length;
    // 3. تدقيق PDC (pdcAudit)
    const pdcQualifiedCount = activeOrders.filter((w) => isStageQualified(w.pdcAudit)).length;
    // 4. تدقيق الإنشاءات (constructionAudit)
    const constQualifiedCount = activeOrders.filter((w) => isStageQualified(w.constructionAudit)).length;
    // 5. تدقيق المساندة الفنية (procedure155Status)
    const supportQualifiedCount = readyCount;
    // 6. إجراء 155 النهائي (procedure155)
    const final155Count = activeOrders.filter((w) => {
      const p = String(w.procedure155 || '');
      return !p.includes('غير') && (p.includes('مؤهل') || p.includes('استلام') || p.includes('تم'));
    }).length;

    const qualityNotesCount = activeOrders.filter(
      (w) => w.qualityNotes && String(w.qualityNotes).trim().length > 0 && String(w.qualityNotes).trim() !== '-'
    ).length;

    const rate = (c: number) => (total > 0 ? Math.round((c / total) * 100) : 0);

    // Sub-Office Matrix (Strictly real platform offices & columns)
    const officeStats = knownOfficeNames
      .map((name) => {
        const offOrders = activeOrders.filter((o) => {
          const off = (o.office || '').trim();
          return off === name || off.includes(name) || name.includes(off);
        });
        const oTotal = offOrders.length;
        const oReady = offOrders.filter((w) => {
          const s = String(w.procedure155Status || '');
          return !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم'));
        }).length;
        const oNotReady = oTotal - oReady;
        const oRate = oTotal > 0 ? Math.round((oReady / oTotal) * 100) : 0;

        const oAttach = offOrders.filter(
          (w) => String(w.attachmentStatus || '').includes('جاهز') && !String(w.attachmentStatus || '').includes('غير')
        ).length;
        const oPhotos = offOrders.filter(
          (w) => (Array.isArray(w.photosFile) && w.photosFile.length > 0) || (Array.isArray(w.photos) && w.photos.length > 0)
        ).length;
        const oPdc = offOrders.filter((w) => isStageQualified(w.pdcAudit)).length;
        const oConst = offOrders.filter((w) => isStageQualified(w.constructionAudit)).length;
        const oFinal155 = offOrders.filter((w) => {
          const p = String(w.procedure155 || '');
          return !p.includes('غير') && (p.includes('مؤهل') || p.includes('استلام') || p.includes('تم'));
        }).length;
        const oNotes = offOrders.filter(
          (w) => w.qualityNotes && String(w.qualityNotes).trim().length > 0 && String(w.qualityNotes).trim() !== '-'
        ).length;

        const r = (c: number) => (oTotal > 0 ? Math.round((c / oTotal) * 100) : 0);

        return {
          name,
          total: oTotal,
          ready: oReady,
          notReady: oNotReady,
          rate: oRate,
          attachRate: r(oAttach),
          photosRate: r(oPhotos),
          pdcRate: r(oPdc),
          constRate: r(oConst),
          final155Rate: r(oFinal155),
          notesCount: oNotes
        };
      })
      .sort((a, b) => b.rate - a.rate || b.total - a.total);

    // Contractor Matrix
    const contractorMap: Record<
      string,
      { total: number; ready: number; notReady: number; notes: number; offices: Set<string>; consultants: Set<string> }
    > = {};
    activeOrders.forEach((o) => {
      const c = (o.contractor || 'غير محدد').trim();
      if (!contractorMap[c]) {
        contractorMap[c] = { total: 0, ready: 0, notReady: 0, notes: 0, offices: new Set(), consultants: new Set() };
      }
      contractorMap[c].total++;
      if (o.office) contractorMap[c].offices.add(o.office);
      if (o.consultant) contractorMap[c].consultants.add(o.consultant);
      if (o.qualityNotes && String(o.qualityNotes).trim().length > 0 && String(o.qualityNotes).trim() !== '-') {
        contractorMap[c].notes++;
      }
      const s = String(o.procedure155Status || '');
      const isReady = !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم'));
      if (isReady) contractorMap[c].ready++;
      else contractorMap[c].notReady++;
    });

    const contractorStats = Object.entries(contractorMap)
      .map(([name, d]) => ({
        name,
        officesText: Array.from(d.offices).join(' ، ') || '-',
        consultantsText: Array.from(d.consultants).join(' ، ') || '-',
        total: d.total,
        ready: d.ready,
        notReady: d.notReady,
        notes: d.notes,
        rate: d.total > 0 ? Math.round((d.ready / d.total) * 100) : 0
      }))
      .sort((a, b) => b.rate - a.rate || b.total - a.total);

    // Monthly / Table Breakdown
    const monthBreakdown = ARABIC_MONTHS.map((m) => {
      const mOrders = activeOrders.filter((o) => {
        const { month } = resolveOrderScope(o, monthTables);
        return month === m.num;
      });
      const mTotal = mOrders.length;
      const mReady = mOrders.filter((w) => {
        const s = String(w.procedure155Status || '');
        return !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم'));
      }).length;
      return {
        monthNum: m.num,
        monthName: m.name,
        total: mTotal,
        ready: mReady,
        notReady: mTotal - mReady,
        rate: mTotal > 0 ? Math.round((mReady / mTotal) * 100) : 0
      };
    }).filter((m) => m.total > 0);

    return {
      total,
      readyCount,
      notReadyCount,
      readyRate,
      qualityNotesCount,
      criteria: [
        { key: 'attachmentStatus', label: 'حالة الإرفاق (جاهز للإرفاق)', count: attachReadyCount, rate: rate(attachReadyCount) },
        { key: 'photosFile', label: 'ملف الصور المرفق (SharePoint)', count: photosFileCount, rate: rate(photosFileCount) },
        { key: 'pdcAudit', label: 'تدقيق PDC (الـ 18 قائمة)', count: pdcQualifiedCount, rate: rate(pdcQualifiedCount) },
        { key: 'constructionAudit', label: 'تدقيق الإنشاءات (الـ 18 قائمة)', count: constQualifiedCount, rate: rate(constQualifiedCount) },
        { key: 'procedure155Status', label: 'تدقيق المساندة الفنية (مؤهل للإغلاق)', count: supportQualifiedCount, rate: rate(supportQualifiedCount) },
        { key: 'procedure155', label: 'إجراء 155 النهائي (معتمد)', count: final155Count, rate: rate(final155Count) }
      ],
      officeStats,
      contractorStats,
      monthBreakdown
    };
  }, [activeOrders, knownOfficeNames, monthTables]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Helper to format a cell value for any canonical or custom column
  const formatPlatformCellValue = (order: WorkOrder, col: ColumnDefinition): string => {
    const raw = (order as any)[col.key];
    if (col.key === 'photosFile') {
      const files = Array.isArray(order.photosFile) ? order.photosFile : [];
      return files.length > 0 ? `${files.length} ملف مرفق` : 'SharePoint';
    }
    if (col.key === 'pdcAudit' || col.key === 'constructionAudit') {
      return getStageBadgeText(raw);
    }
    if (col.key === 'statusSyncTime' || col.key === 'procedureSyncTime') {
      const valStr = raw ? String(raw) : '';
      return valStr.includes('|') ? valStr.split('|')[0].trim() : valStr || '-';
    }
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      return String(raw);
    }
    if (order.customFields && order.customFields[col.key] !== undefined) {
      return String(order.customFields[col.key]);
    }
    return '-';
  };

  // Export Comprehensive Excel Workbook (Strictly matching platform columns)
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'حوكمة جودة أعمال الإنشاءات - إجراء 155';
      wb.created = new Date();

      // Sheet 1: الملخص المجمع ومقارنة المكاتب والمقاولين
      const ws1 = wb.addWorksheet('التقرير المجمع الشامل', {
        views: [{ rightToLeft: true, showGridLines: true }]
      });

      ws1.addRow(['حوكمة جودة أعمال الإنشاءات • إدارة كهرباء الحدود الشمالية • المساندة الفنية']);
      ws1.mergeCells('A1:J1');
      ws1.getCell('A1').font = { name: 'Cairo', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      ws1.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } };
      ws1.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
      ws1.getRow(1).height = 34;

      ws1.addRow([
        `مركز التقارير الموحد (${viewMode === 'aggregated' ? 'تقرير مجمع' : 'تقرير تفصيلي'}) — ${periodTitleLabel} — النطاق: ${
          officeFilter === 'all' ? 'كافة المكاتب الفرعية' : officeFilter
        }`
      ]);
      ws1.mergeCells('A2:J2');
      ws1.getCell('A2').font = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FFFDB813' } };
      ws1.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004B8D' } };
      ws1.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
      ws1.getRow(2).height = 26;

      ws1.addRow([]);
      ws1.addRow(['أولاً: ملخص مؤشرات الأداء وأعمدة التدقيق المعتمدة في المنصة']);
      ws1.getRow(4).font = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FF002855' } };

      const kpiHeader = ws1.addRow(['المؤشر / العمود في المنصة', 'العدد الفعلي', 'النسبة المئوية', 'الإجمالي المرجعي']);
      kpiHeader.height = 26;
      kpiHeader.eachCell((c) => {
        c.font = { name: 'Cairo', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      const kpiRows = [
        ['إجمالي أوامر العمل في النطاق', stats.total, '100%', stats.total],
        ['الأوامر المؤهلة والمعتمدة (تدقيق المساندة الفنية)', stats.readyCount, `${stats.readyRate}%`, stats.total],
        ['الأوامر غير المؤهلة / قيد الاستيفاء', stats.notReadyCount, `${100 - stats.readyRate}%`, stats.total],
        ['أوامر العمل المحتوية على ملاحظات جودة (qualityNotes)', stats.qualityNotesCount, '-', stats.total],
        ...stats.criteria.map((c) => [c.label, c.count, `${c.rate}%`, stats.total])
      ];
      kpiRows.forEach((r) => {
        const row = ws1.addRow(r);
        row.height = 22;
        row.eachCell((c) => {
          c.font = { name: 'Cairo', size: 10, bold: true };
          c.alignment = { vertical: 'middle', horizontal: 'center' };
        });
      });

      ws1.addRow([]);
      const offTitle = ws1.addRow(['ثانياً: مصفوفة أداء المكاتب الفرعية (مطابقة لأعمدة المنصة)']);
      offTitle.font = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FF002855' } };

      const offHeader = ws1.addRow([
        'المكتب الفرعي',
        'إجمالي الأوامر',
        'مؤهل للإغلاق',
        'غير مؤهل',
        'نسبة الإنجاز',
        'حالة الإرفاق %',
        'ملف الصور %',
        'تدقيق PDC %',
        'تدقيق الإنشاءات %',
        'إجراء 155 النهائي %'
      ]);
      offHeader.height = 26;
      offHeader.eachCell((c) => {
        c.font = { name: 'Cairo', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      stats.officeStats.forEach((o) => {
        const r = ws1.addRow([
          o.name,
          o.total,
          o.ready,
          o.notReady,
          `${o.rate}%`,
          `${o.attachRate}%`,
          `${o.photosRate}%`,
          `${o.pdcRate}%`,
          `${o.constRate}%`,
          `${o.final155Rate}%`
        ]);
        r.height = 22;
        r.eachCell((c) => {
          c.font = { name: 'Cairo', size: 10, bold: true };
          c.alignment = { vertical: 'middle', horizontal: 'center' };
        });
      });

      [24, 16, 16, 16, 16, 16, 16, 16, 16, 18].forEach((w, i) => {
        ws1.getColumn(i + 1).width = w;
      });

      // Sheet 2: السجل التفصيلي الكامل لأوامر العمل (باستخدام أعمدة المنصة الفعلية فقط)
      const ws2 = wb.addWorksheet('السجل التفصيلي لأوامر العمل', {
        views: [{ rightToLeft: true, showGridLines: true, state: 'frozen', ySplit: 2 }]
      });

      ws2.addRow([`السجل التفصيلي لأوامر العمل (${activeOrders.length} أمر عمل) — ${periodTitleLabel}`]);
      const detailHeaderRow = ws2.addRow(['#', ...platformColumns.map((col) => col.title)]);
      detailHeaderRow.height = 28;
      detailHeaderRow.eachCell((c) => {
        c.font = { name: 'Cairo', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      activeOrders.forEach((o, idx) => {
        const rowValues = [idx + 1, ...platformColumns.map((col) => formatPlatformCellValue(o, col))];
        const r = ws2.addRow(rowValues);
        r.height = 22;
        r.eachCell((c) => {
          c.font = { name: 'Cairo', size: 9.5, bold: true };
          c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });
      });

      ws2.getColumn(1).width = 8;
      platformColumns.forEach((col, i) => {
        ws2.getColumn(i + 2).width = col.key === 'qualityNotes' ? 35 : col.key === 'contractor' ? 26 : 18;
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `التقرير_${viewMode === 'aggregated' ? 'المجمع' : 'التفصيلي'}_إجراء155_${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      soundService.playActionSound('export');
      showToast('تم تصدير ملف الإكسل الشامل المطابق لأعمدة المنصة بنجاح');
    } catch (err) {
      console.error('Excel export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Export PDF Handler
  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const scopeTitle = `${periodTitleLabel} - ${officeFilter === 'all' ? 'كافة المكاتب' : officeFilter}`;
      if (viewMode === 'detailed') {
        await exportOrdersDirectToPdf(
          activeOrders,
          scopeTitle,
          `تقرير_تفصيلي_إجراء155_${selectedYear}.pdf`,
          platformColumns
        );
      } else if (reportContainerRef.current) {
        await exportToPdf(
          [reportContainerRef.current],
          activeOrders,
          scopeTitle,
          `تقرير_مجمع_إجراء155_${selectedYear}.pdf`,
          { orientation: 'landscape', format: 'a4', marginMm: 4 }
        );
      }
      soundService.playActionSound('export');
      showToast('تم تصدير التقرير بصيغة PDF بنجاح');
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopySummary = () => {
    const text = `*حوكمة جودة أعمال الإنشاءات — مركز التقارير الموحد (إجراء 155)*
الفترة: ${periodTitleLabel}
النطاق: ${officeFilter === 'all' ? 'جميع المكاتب الفرعية' : officeFilter}
----------------------------------------
• إجمالي أوامر العمل: ${stats.total} أمر
• مؤهل للإغلاق (معتمد 155): ${stats.readyCount} (${stats.readyRate}%)
• غير مؤهل / قيد الاستيفاء: ${stats.notReadyCount} (${100 - stats.readyRate}%)
• أوامر بها ملاحظات جودة: ${stats.qualityNotesCount} أمر
----------------------------------------
📊 نسب إنجاز أعمدة التدقيق في المنصة:
${stats.criteria.map((c) => `• ${c.label}: ${c.count}/${stats.total} (${c.rate}%)`).join('\n')}
----------------------------------------
🏢 نسب الإنجاز حسب المكاتب الفرعية:
${stats.officeStats.map((o) => `- ${o.name}: ${o.ready}/${o.total} (${o.rate}%)`).join('\n')}`;

    navigator.clipboard.writeText(text).then(() => {
      setIsCopiedSummary(true);
      soundService.playActionSound('create');
      setTimeout(() => setIsCopiedSummary(false), 2500);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-1.5 sm:p-3 overflow-y-auto font-['Cairo',sans-serif]"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-[97vw] xl:max-w-7xl max-h-[95vh] rounded-2xl shadow-2xl border-2 border-[#F58220] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Executive Header */}
        <div className="bg-gradient-to-l from-[#002855] via-[#003B73] to-[#004B8D] text-white px-4 sm:px-6 py-3.5 border-b-2 border-[#F58220] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#F58220] text-white flex items-center justify-center shadow-lg border border-amber-300/40 shrink-0">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-[#FDB813] border border-amber-400/30 text-[10px] font-black">
                  مركز التقارير الموحد • إجراء 155
                </span>
                <h2 className="text-base sm:text-lg font-black text-white">
                  منظومة التقارير الشاملة (المجمعة والتفصيلية المطابقة لأعمدة المنصة)
                </h2>
              </div>
              <p className="text-xs text-blue-100 mt-0.5">
                تقارير حية متزامنة 100% مع أعمدة وبيانات المنصة الفعلية ({platformColumns.length} عمود معتمد) دون أي أعمدة خارجية
              </p>
            </div>
          </div>

          {/* Primary Mode Switcher + Export Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex bg-slate-900/70 p-1 rounded-xl border border-white/15">
              <button
                type="button"
                onClick={() => setViewMode('aggregated')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  viewMode === 'aggregated'
                    ? 'bg-[#F58220] text-white shadow-xs'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>التقارير المجمعة</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('detailed')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  viewMode === 'detailed'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>التقارير التفصيلية ({activeOrders.length})</span>
              </button>
            </div>

            <UnifiedSectionExportBar
              orders={activeOrders}
              columns={platformColumns}
              sectionTitle={`${viewMode === 'aggregated' ? 'تقرير_مجمع' : 'تقرير_تفصيلي'}_${periodTitleLabel}`}
              onOpenExportModal={onOpenExportModal}
              variant="dark"
            />

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>إكسل شامل</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-all cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>تصدير PDF</span>
            </button>

            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer"
            >
              {isCopiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-300" />}
              <span>{isCopiedSummary ? 'تم النسخ' : 'نسخ الملخص'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer"
              title="طباعة التقرير"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-200 hover:text-white border border-rose-400/30 transition-all cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Period & Scope Filter Toolbar */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-black text-slate-700 flex items-center gap-1 ml-1">
              <Calendar className="w-4 h-4 text-[#004B8D]" />
              <span>نوع الفترة الزمنية:</span>
            </span>

            {(
              [
                { id: 'weekly', label: 'أسبوعي' },
                { id: 'monthly', label: 'شهري' },
                { id: 'quarterly', label: 'ربع سنوي' },
                { id: 'semi_annual', label: 'نصف سنوي' },
                { id: 'annual', label: 'سنوي شامل' }
              ] as { id: AggregationPeriodType; label: string }[]
            ).map((pt) => (
              <button
                key={pt.id}
                type="button"
                onClick={() => setPeriodType(pt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  periodType === pt.id
                    ? 'bg-[#004B8D] text-white shadow-xs ring-2 ring-blue-300'
                    : 'bg-white hover:bg-blue-50 text-slate-700 border border-slate-300'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-300">
              <span className="text-[11px] font-bold text-slate-500">السنة:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-xs font-black text-[#004B8D] bg-transparent focus:outline-none cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}م
                  </option>
                ))}
              </select>
            </div>

            {periodType === 'monthly' && (
              <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-300">
                <span className="text-[11px] font-bold text-slate-500">الشهر:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="text-xs font-black text-emerald-700 bg-transparent focus:outline-none cursor-pointer"
                >
                  {ARABIC_MONTHS.map((m) => (
                    <option key={m.num} value={m.num}>
                      {m.num} - {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodType === 'quarterly' && (
              <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-300">
                <span className="text-[11px] font-bold text-slate-500">الربع:</span>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
                  className="text-xs font-black text-purple-700 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value={1}>الربع الأول (Q1: يناير - مارس)</option>
                  <option value={2}>الربع الثاني (Q2: أبريل - يونيو)</option>
                  <option value={3}>الربع الثالث (Q3: يوليو - سبتمبر)</option>
                  <option value={4}>الربع الرابع (Q4: أكتوبر - ديسمبر)</option>
                </select>
              </div>
            )}

            {periodType === 'semi_annual' && (
              <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-300">
                <span className="text-[11px] font-bold text-slate-500">النصف:</span>
                <select
                  value={selectedHalf}
                  onChange={(e) => setSelectedHalf(Number(e.target.value) as 1 | 2)}
                  className="text-xs font-black text-indigo-700 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value={1}>النصف الأول (يناير - يونيو)</option>
                  <option value={2}>النصف الثاني (يوليو - ديسمبر)</option>
                </select>
              </div>
            )}

            {periodType === 'weekly' && (
              <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-300">
                <span className="text-[11px] font-bold text-slate-500">الأسبوع:</span>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value as 'current_week' | 'last_week')}
                  className="text-xs font-black text-amber-700 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="current_week">الأسبوع الحالي ({weekInfo.currentWeekRange})</option>
                  <option value="last_week">الأسبوع السابق ({weekInfo.lastWeekRange})</option>
                </select>
              </div>
            )}

            {/* Office Selector strictly using actual platform office names */}
            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-300">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={officeFilter}
                onChange={(e) => setOfficeFilter(e.target.value)}
                className="text-xs font-black text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="all">جميع المكاتب الفرعية</option>
                {knownOfficeNames.map((offName) => (
                  <option key={offName} value={offName}>
                    {offName}
                  </option>
                ))}
              </select>
            </div>

            {monthTables.length > 0 && (
              <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-300">
                <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
                <select
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer max-w-[170px]"
                >
                  <option value="all">كافة الجداول المرتبطة</option>
                  {monthTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({getArabicMonthName(t.month)} {t.year})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Toast Notification */}
        {notificationMsg && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-black flex items-center justify-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notificationMsg}</span>
          </div>
        )}

        {/* Main Scrollable Content Area */}
        <div ref={reportContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 space-y-5">
          {/* Official Report Banner */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#002855] text-[#FDB813] flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#004B8D] border border-blue-200 text-[11px] font-black">
                    {viewMode === 'aggregated' ? 'بيان إحصائي مجمع ومقارن' : 'بيان تفصيلي شامل لأوامر العمل'}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    تاريخ الإصدار: {new Date().toLocaleDateString('ar-SA')}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">{periodTitleLabel}</h3>
                <p className="text-xs text-slate-600 font-semibold mt-0.5">
                  النطاق الجغرافي:{' '}
                  <strong className="text-[#004B8D]">
                    {officeFilter === 'all' ? 'كافة المكاتب الفرعية' : officeFilter}
                  </strong>{' '}
                  • إجمالي الأوامر المشمولة: <strong className="text-emerald-700">{stats.total} أمر عمل</strong>
                </p>
              </div>
            </div>

            {/* 4 Executive Summary Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-center">
                <span className="text-[10px] font-bold text-slate-500 block">إجمالي الأوامر</span>
                <span className="text-lg font-black font-mono text-slate-900">{stats.total}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2 text-center">
                <span className="text-[10px] font-bold text-emerald-800 block">مؤهل للإغلاق (155)</span>
                <span className="text-lg font-black font-mono text-emerald-700">{stats.readyCount}</span>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2 text-center">
                <span className="text-[10px] font-bold text-rose-800 block">غير مؤهل / قيد الاستيفاء</span>
                <span className="text-lg font-black font-mono text-rose-700">{stats.notReadyCount}</span>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2 text-center">
                <span className="text-[10px] font-bold text-[#004B8D] block">نسبة الإنجاز العام</span>
                <span className="text-lg font-black font-mono text-[#004B8D]">{stats.readyRate}%</span>
              </div>
            </div>
          </div>

          {viewMode === 'aggregated' ? (
            /* ========================================================================= */
            /* MODE 1: AGGREGATED REPORT VIEW (Strictly Platform Columns & Data)         */
            /* ========================================================================= */
            <div className="space-y-5">
              {/* 1. The 6 Real Platform Audit & Attachment Columns Breakdown */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#F58220]" />
                    <h4 className="text-sm font-black text-slate-900">
                      أولاً: نسب استيفاء أعمدة التدقيق والمرفقات المعتمدة في المنصة ({stats.total} أمر عمل)
                    </h4>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    متزامن مباشرة مع أعمدة جدول أوامر العمل
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {stats.criteria.map((c) => (
                    <div
                      key={c.key}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between"
                    >
                      <span className="text-xs font-black text-slate-800 leading-snug">{c.label}</span>
                      <div className="my-2 flex items-baseline justify-between font-mono">
                        <span className="text-lg font-black text-[#004B8D]">{c.rate}%</span>
                        <span className="text-[11px] font-bold text-slate-500">
                          {c.count}/{stats.total}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            c.rate >= 75 ? 'bg-emerald-600' : c.rate >= 45 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${c.rate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Sub-Offices Aggregated Performance Matrix (Strictly Real Platform Columns) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#004B8D]" />
                    <h4 className="text-sm font-black text-slate-900">
                      ثانياً: البيان المجمع لأداء المكاتب الفرعية ومراحل التدقيق الثلاث ({periodTitleLabel})
                    </h4>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#002855] text-white font-black border-b-2 border-[#F58220]">
                        <th className="p-2.5 border-l border-[#1e3a8a] text-center w-10">#</th>
                        <th className="p-2.5 border-l border-[#1e3a8a]">المكتب الفرعي</th>
                        <th className="p-2.5 border-l border-[#1e3a8a] text-center">إجمالي الأوامر</th>
                        <th className="p-2.5 border-l border-[#1e3a8a] text-center text-emerald-300">مؤهل للإغلاق</th>
                        <th className="p-2.5 border-l border-[#1e3a8a] text-center text-rose-300">غير مؤهل</th>
                        <th className="p-2.5 border-l border-[#1e3a8a] text-center">نسبة الإنجاز</th>
                        <th className="p-2.5 border-l border-[#1e3a8a] text-center">حالة الإرفاق</th>
                        <th className="p-2.5 border-l border-[#1e3a8a] text-center">ملف الصور</th>
                        <th className="p-2.5 border-l border-[#1e3a8a] text-center">تدقيق PDC</th>
                        <th className="p-2.5 border-l border-[#1e3a8a] text-center">تدقيق الإنشاءات</th>
                        <th className="p-2.5 border-l border-[#1e3a8a] text-center">إجراء 155 النهائي</th>
                        <th className="p-2.5 text-center">ملاحظات الجودة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-bold">
                      {stats.officeStats.map((off, idx) => (
                        <tr key={off.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono">{idx + 1}</td>
                          <td className="p-2.5 border-l border-slate-200 font-black text-slate-900">{off.name}</td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono font-black">{off.total}</td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono text-emerald-700 bg-emerald-50/50">
                            {off.ready}
                          </td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono text-rose-700 bg-rose-50/50">
                            {off.notReady}
                          </td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                                off.rate >= 70
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : off.rate >= 40
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-rose-100 text-rose-900'
                              }`}
                            >
                              {off.rate}%
                            </span>
                          </td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono">{off.attachRate}%</td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono">{off.photosRate}%</td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono">{off.pdcRate}%</td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono">{off.constRate}%</td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono">{off.final155Rate}%</td>
                          <td className="p-2.5 text-center font-mono text-rose-700">{off.notesCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Contractors & Monthly Breakdown Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-emerald-700" />
                      <h4 className="text-sm font-black text-slate-900">
                        ثالثاً: البيان المجمع لإنجاز المقاولين والاستشاريين ({stats.contractorStats.length})
                      </h4>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-800 text-white font-black">
                          <th className="p-2 border-l border-slate-700">المقاول المنفذ</th>
                          <th className="p-2 border-l border-slate-700">المكاتب</th>
                          <th className="p-2 border-l border-slate-700 text-center">الإجمالي</th>
                          <th className="p-2 border-l border-slate-700 text-center text-emerald-300">مؤهل</th>
                          <th className="p-2 border-l border-slate-700 text-center text-rose-300">غير مؤهل</th>
                          <th className="p-2 text-center">النسبة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-bold">
                        {stats.contractorStats.map((c) => (
                          <tr key={c.name} className="hover:bg-slate-50">
                            <td className="p-2 border-l border-slate-200 font-black text-slate-900">{c.name}</td>
                            <td className="p-2 border-l border-slate-200 text-[11px] text-slate-600">{c.officesText}</td>
                            <td className="p-2 border-l border-slate-200 text-center font-mono">{c.total}</td>
                            <td className="p-2 border-l border-slate-200 text-center font-mono text-emerald-700">{c.ready}</td>
                            <td className="p-2 border-l border-slate-200 text-center font-mono text-rose-700">{c.notReady}</td>
                            <td className="p-2 text-center font-mono font-black text-[#004B8D]">{c.rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-700" />
                      <h4 className="text-sm font-black text-slate-900">
                        رابعاً: التوزيع الزمني الشهري لأوامر العمل ({selectedYear}م)
                      </h4>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-800 text-white font-black">
                          <th className="p-2 border-l border-slate-700">الشهر</th>
                          <th className="p-2 border-l border-slate-700 text-center">إجمالي الأوامر</th>
                          <th className="p-2 border-l border-slate-700 text-center text-emerald-300">مؤهل 155</th>
                          <th className="p-2 border-l border-slate-700 text-center text-rose-300">غير مؤهل</th>
                          <th className="p-2 text-center">نسبة الإنجاز</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-bold">
                        {stats.monthBreakdown.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-400">
                              لا توجد أوامر مسجلة في هذه الفترة
                            </td>
                          </tr>
                        ) : (
                          stats.monthBreakdown.map((m) => (
                            <tr key={m.monthNum} className="hover:bg-slate-50">
                              <td className="p-2 border-l border-slate-200 font-black text-slate-900">
                                شهر {m.monthNum} - {m.monthName}
                              </td>
                              <td className="p-2 border-l border-slate-200 text-center font-mono">{m.total}</td>
                              <td className="p-2 border-l border-slate-200 text-center font-mono text-emerald-700">{m.ready}</td>
                              <td className="p-2 border-l border-slate-200 text-center font-mono text-rose-700">{m.notReady}</td>
                              <td className="p-2 text-center font-mono font-black text-[#004B8D]">{m.rate}%</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* MODE 2: DETAILED REPORT VIEW (Renders Exact Platform Columns Only)        */
            /* ========================================================================= */
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative w-64 sm:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="بحث برقم الأمر، الكود، المقاول، الملاحظات..."
                      className="w-full pr-9 pl-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#004B8D]"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setStatusQualificationFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer ${
                        statusQualificationFilter === 'all' ? 'bg-[#004B8D] text-white' : 'text-slate-600'
                      }`}
                    >
                      الكل ({periodFilteredOrders.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusQualificationFilter('ready')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer ${
                        statusQualificationFilter === 'ready' ? 'bg-emerald-600 text-white' : 'text-emerald-800'
                      }`}
                    >
                      مؤهل للإغلاق
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusQualificationFilter('notReady')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer ${
                        statusQualificationFilter === 'notReady' ? 'bg-rose-600 text-white' : 'text-rose-800'
                      }`}
                    >
                      غير مؤهل
                    </button>
                  </div>

                  {contractorsInScope.length > 0 && (
                    <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-300">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={contractorFilter}
                        onChange={(e) => setContractorFilter(e.target.value)}
                        className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer max-w-[180px]"
                      >
                        <option value="all">جميع المقاولين ({contractorsInScope.length})</option>
                        {contractorsInScope.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(searchQuery || statusQualificationFilter !== 'all' || contractorFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setStatusQualificationFilter('all');
                        setContractorFilter('all');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-300 text-xs font-black cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إعادة ضبط</span>
                    </button>
                  )}
                </div>

                <div className="text-xs font-black text-slate-600">
                  عدد السجلات المعروضة: <strong className="text-[#004B8D]">{detailedFilteredOrders.length}</strong> أمر عمل • عدد الأعمدة: <strong className="text-[#002855]">{platformColumns.length} عمود مطابق للمنصة</strong>
                </div>
              </div>

              {/* Full Detailed Table Using Exact Platform Columns */}
              <div className="overflow-x-auto max-h-[520px] border border-slate-200 rounded-xl">
                <table className="w-full text-right border-collapse text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#002855] text-white font-black border-b-2 border-[#F58220]">
                      <th className="p-2.5 border-l border-[#1e3a8a] text-center w-10">#</th>
                      {platformColumns.map((col) => (
                        <th key={col.key} className="p-2.5 border-l border-[#1e3a8a] text-center whitespace-nowrap">
                          {col.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-bold">
                    {detailedFilteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={platformColumns.length + 1} className="p-10 text-center text-slate-500">
                          لا توجد أوامر عمل مطابقة لخيارات التصفية المحددة
                        </td>
                      </tr>
                    ) : (
                      detailedFilteredOrders.map((order, idx) => (
                        <tr
                          key={order.id}
                          className={`hover:bg-blue-50/50 transition-colors ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                          }`}
                        >
                          <td className="p-2 border-l border-slate-200 text-center font-mono text-slate-500">
                            {idx + 1}
                          </td>
                          {platformColumns.map((col) => {
                            if (col.key === 'photosFile') {
                              const filesCount = Array.isArray(order.photosFile) ? order.photosFile.length : 0;
                              return (
                                <td key={col.key} className="p-2 border-l border-slate-200 text-center">
                                  <div className="inline-flex items-center gap-1 justify-center">
                                    <a
                                      href={SHAREPOINT_AUDIT_URL}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-[#004B8D] border border-blue-200 text-[10px] font-black"
                                    >
                                      <span>SharePoint</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                    {onOpenOrderFiles && (
                                      <button
                                        type="button"
                                        onClick={() => onOpenOrderFiles(order)}
                                        className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black cursor-pointer"
                                      >
                                        📁 {filesCount}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              );
                            }

                            const cellVal = formatPlatformCellValue(order, col);
                            const isReadyCol =
                              col.key === 'procedure155Status' ||
                              col.key === 'procedure155' ||
                              col.key === 'pdcAudit' ||
                              col.key === 'constructionAudit' ||
                              col.key === 'attachmentStatus';
                            const isPositive =
                              isReadyCol &&
                              !cellVal.includes('غير') &&
                              (cellVal.includes('مؤهل') || cellVal.includes('جاهز') || cellVal.includes('معتمد') || cellVal.includes('تم'));
                            const isNegative = isReadyCol && cellVal.includes('غير');

                            return (
                              <td
                                key={col.key}
                                className={`p-2 border-l border-slate-200 ${
                                  col.key === 'qualityNotes' || col.key === 'contractor' || col.key === 'consultant'
                                    ? 'text-right max-w-[220px] truncate'
                                    : 'text-center'
                                }`}
                                title={cellVal}
                              >
                                {isReadyCol ? (
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10.5px] font-black inline-block ${
                                      isPositive
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : isNegative
                                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                                    }`}
                                  >
                                    {cellVal}
                                  </span>
                                ) : (
                                  <span
                                    className={
                                      col.key === 'workOrderNumber'
                                        ? 'font-mono font-black text-[#004B8D]'
                                        : col.key === 'qualityNotes' && cellVal !== '-'
                                        ? 'text-rose-700 font-bold'
                                        : 'text-slate-800'
                                    }
                                  >
                                    {cellVal}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Status Bar */}
        <div className="bg-slate-900 text-slate-300 px-4 sm:px-6 py-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-bold text-white">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>مركز التقارير الموحد — متزامن 100% مع أعمدة وبيانات المنصة</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
