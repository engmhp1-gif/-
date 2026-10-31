import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  WorkOrder, 
  SubOffice, 
  MonthTable, 
  PlatformUser,
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
  TrendingUp, 
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
  ChevronDown,
  Clock,
  Mail,
  Zap,
  FolderOpen
} from 'lucide-react';
import { getArabicMonthName, ARABIC_MONTHS, resolveOrderScope } from '../utils/tableScope';
import { soundService } from '../services/soundService';
import { UnifiedSectionExportBar } from './UnifiedSectionExportBar';
import { exportToPdf, exportOrdersDirectToPdf } from '../services/exportService';
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
  activeYear?: number;
  activeMonth?: number | 'all';
  selectedOffice?: string;
  currentUser?: PlatformUser | null;
  initialMode?: ReportViewMode;
  onOpenOrderFiles?: (order: WorkOrder) => void;
  onOpenExportModal?: (orders: WorkOrder[], title: string, openEmail?: boolean) => void;
}

export const ComprehensiveReportsModal: React.FC<ComprehensiveReportsModalProps> = ({
  isOpen,
  onClose,
  workOrders,
  allWorkOrders,
  monthTables = [],
  offices = [],
  activeYear = new Date().getFullYear(),
  activeMonth = 'all',
  selectedOffice = 'all',
  currentUser,
  initialMode = 'aggregated',
  onOpenOrderFiles,
  onOpenExportModal
}) => {
  const currentNow = new Date();
  const currentYearNum = typeof activeYear === 'number' && activeYear > 2000 ? activeYear : currentNow.getFullYear();

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

  // Available Years extracted from tables and orders
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(currentYearNum);
    yearsSet.add(2025);
    yearsSet.add(2026);
    yearsSet.add(2027);
    sourceOrders.forEach(o => {
      if (o.tableYear) yearsSet.add(o.tableYear);
      if (o.createdAt) {
        const y = new Date(o.createdAt).getFullYear();
        if (!isNaN(y) && y > 2020) yearsSet.add(y);
      }
    });
    monthTables.forEach(t => {
      if (t.year) yearsSet.add(t.year);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [sourceOrders, monthTables, currentYearNum]);

  // Week Date Range calculations
  const weekInfo = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sunday
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
      lastWeekRange: `${fmt(lastSunday)} - ${fmt(lastThursday)}`,
      currentSunday: sunday,
      lastSunday: lastSunday
    };
  }, []);

  // Filtered Orders linked to the selected period and tables
  const periodFilteredOrders = useMemo(() => {
    return sourceOrders.filter(order => {
      // 1. Office filter
      if (officeFilter !== 'all' && order.office !== officeFilter) return false;

      // 2. Table filter
      if (tableFilter !== 'all' && order.tableId !== tableFilter) return false;

      // 3. Year scope
      const orderYear = order.tableYear || (order.createdAt ? new Date(order.createdAt).getFullYear() : selectedYear);
      if (orderYear !== selectedYear) return false;

      // 4. Period breakdown
      const orderMonth = order.tableMonth || (order.createdAt ? new Date(order.createdAt).getMonth() + 1 : 1);

      if (periodType === 'monthly') {
        return orderMonth === selectedMonth;
      }

      if (periodType === 'quarterly') {
        const quarterMonthsMap: Record<number, number[]> = {
          1: [1, 2, 3],
          2: [4, 5, 6],
          3: [7, 8, 9],
          4: [10, 11, 12]
        };
        return (quarterMonthsMap[selectedQuarter] || []).includes(orderMonth);
      }

      if (periodType === 'semi_annual') {
        if (selectedHalf === 1) {
          return orderMonth >= 1 && orderMonth <= 6;
        } else {
          return orderMonth >= 7 && orderMonth <= 12;
        }
      }

      if (periodType === 'annual') {
        return true; // All months of the selected year
      }

      if (periodType === 'weekly') {
        if (!order.createdAt) return true;
        const oDate = new Date(order.createdAt);
        const refStart = selectedWeek === 'current_week' ? weekInfo.currentSunday : weekInfo.lastSunday;
        const refEnd = new Date(refStart);
        refEnd.setDate(refEnd.getDate() + 6);
        return oDate >= refStart && oDate <= refEnd;
      }

      return true;
    });
  }, [sourceOrders, officeFilter, tableFilter, selectedYear, periodType, selectedMonth, selectedQuarter, selectedHalf, selectedWeek, weekInfo]);

  // Final Detailed Orders (with search and status filters applied)
  const detailedOrders = useMemo(() => {
    return periodFilteredOrders.filter(order => {
      // Contractor filter
      if (contractorFilter !== 'all' && order.contractor !== contractorFilter) return false;

      // Status qualification filter
      const statusStr = String(order.procedure155Status || '');
      const isQualified = !statusStr.includes('غير') && (statusStr.includes('مؤهل') || statusStr.includes('معتمد') || statusStr.includes('تم'));
      if (statusQualificationFilter === 'ready' && !isQualified) return false;
      if (statusQualificationFilter === 'notReady' && isQualified) return false;

      // Search text query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesNum = (order.workOrderNumber || '').toLowerCase().includes(q);
        const matchesCode = (order.workOrderCode || '').toLowerCase().includes(q);
        const matchesCont = (order.contractor || '').toLowerCase().includes(q);
        const matchesOffice = (order.office || '').toLowerCase().includes(q);
        const matchesNotes = (order.qualityNotes || '').toLowerCase().includes(q);
        if (!matchesNum && !matchesCode && !matchesCont && !matchesOffice && !matchesNotes) return false;
      }

      return true;
    });
  }, [periodFilteredOrders, contractorFilter, statusQualificationFilter, searchQuery]);

  // Aggregate Metrics & Key Performance Indicators
  const metrics = useMemo(() => {
    const total = periodFilteredOrders.length;
    let readyCount = 0;
    let notReadyCount = 0;
    let photoCompleteCount = 0;
    let consultantFormsCount = 0;
    let consultantClearanceCount = 0;
    let form190Count = 0;
    let form200Count = 0;
    let inspectionCount = 0;
    let withAttachedFilesCount = 0;

    periodFilteredOrders.forEach(o => {
      const s = String(o.procedure155Status || '');
      if (!s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم'))) {
        readyCount++;
      } else {
        notReadyCount++;
      }

      if (String(o.photoDocumentation || '').includes('مكتمل')) photoCompleteCount++;
      if (String(o.consultantForms || '').includes('مكتمل')) consultantFormsCount++;
      if (String(o.consultantClearanceForms || '').includes('مكتمل')) consultantClearanceCount++;
      if (String(o.form190 || '').includes('مكتمل')) form190Count++;
      if (String(o.form200 || '').includes('مكتمل')) form200Count++;
      if (String(o.inspectionForm || '').includes('مكتمل')) inspectionCount++;
      if (o.photosFile && o.photosFile.length > 0) withAttachedFilesCount++;
    });

    const readyRate = total > 0 ? Math.round((readyCount / total) * 100) : 0;
    const notReadyRate = total > 0 ? Math.round((notReadyCount / total) * 100) : 0;

    // Quality Index average of criteria
    const criteriaRates = total > 0 ? [
      photoCompleteCount / total,
      consultantFormsCount / total,
      consultantClearanceCount / total,
      form190Count / total,
      form200Count / total,
      inspectionCount / total
    ] : [0];
    const avgCriteriaRate = Math.round((criteriaRates.reduce((a, b) => a + b, 0) / criteriaRates.length) * 100);

    return {
      total,
      readyCount,
      readyRate,
      notReadyCount,
      notReadyRate,
      photoCompleteCount,
      consultantFormsCount,
      consultantClearanceCount,
      form190Count,
      form200Count,
      inspectionCount,
      withAttachedFilesCount,
      avgCriteriaRate
    };
  }, [periodFilteredOrders]);

  // Office comparative breakdown
  const officeMetrics = useMemo(() => {
    const map: Record<string, { total: number; ready: number; notReady: number; withFiles: number }> = {};
    const defaultOffices = ['مكتب عرعر', 'مكتب رفحاء', 'مكتب طريف', 'مكتب العويقيلة'];
    defaultOffices.forEach(off => {
      map[off] = { total: 0, ready: 0, notReady: 0, withFiles: 0 };
    });

    periodFilteredOrders.forEach(o => {
      const off = (o.office || 'غير محدد').trim();
      if (!map[off]) map[off] = { total: 0, ready: 0, notReady: 0, withFiles: 0 };
      map[off].total++;
      const s = String(o.procedure155Status || '');
      if (!s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم'))) {
        map[off].ready++;
      } else {
        map[off].notReady++;
      }
      if (o.photosFile && o.photosFile.length > 0) map[off].withFiles++;
    });

    return Object.entries(map).map(([name, d]) => ({
      name,
      total: d.total,
      ready: d.ready,
      notReady: d.notReady,
      withFiles: d.withFiles,
      rate: d.total > 0 ? Math.round((d.ready / d.total) * 100) : 0,
      evaluation: d.total === 0 ? 'لا توجد أوامر' : d.ready / d.total >= 0.8 ? 'ممتاز' : d.ready / d.total >= 0.5 ? 'جيد' : 'بحاجة لمتابعة'
    })).sort((a, b) => b.rate - a.rate || b.total - a.total);
  }, [periodFilteredOrders]);

  // Contractor comparative breakdown
  const contractorMetrics = useMemo(() => {
    const map: Record<string, { total: number; ready: number; notReady: number; withFiles: number; offices: Set<string> }> = {};

    periodFilteredOrders.forEach(o => {
      const cont = (o.contractor || 'غير محدد').trim();
      if (!map[cont]) map[cont] = { total: 0, ready: 0, notReady: 0, withFiles: 0, offices: new Set() };
      map[cont].total++;
      if (o.office) map[cont].offices.add(o.office);
      const s = String(o.procedure155Status || '');
      if (!s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم'))) {
        map[cont].ready++;
      } else {
        map[cont].notReady++;
      }
      if (o.photosFile && o.photosFile.length > 0) map[cont].withFiles++;
    });

    return Object.entries(map).map(([name, d]) => ({
      name,
      total: d.total,
      ready: d.ready,
      notReady: d.notReady,
      withFiles: d.withFiles,
      officesText: Array.from(d.offices).join(' ، ') || 'غير محدد',
      rate: d.total > 0 ? Math.round((d.ready / d.total) * 100) : 0,
      evaluation: d.total === 0 ? '-' : d.ready / d.total >= 0.8 ? 'ملتزم جداً' : d.ready / d.total >= 0.5 ? 'متوسط' : 'متعثر في الإغلاق'
    })).sort((a, b) => b.rate - a.rate || b.total - a.total);
  }, [periodFilteredOrders]);

  // Period label text
  const periodLabelText = useMemo(() => {
    switch (periodType) {
      case 'weekly':
        return `تقرير أسبوعي (${selectedWeek === 'current_week' ? weekInfo.currentWeekRange : weekInfo.lastWeekRange})`;
      case 'monthly':
        return `تقرير شهري (${getArabicMonthName(selectedMonth)} ${selectedYear})`;
      case 'quarterly':
        return `تقرير الربع ${selectedQuarter === 1 ? 'الأول (Q1)' : selectedQuarter === 2 ? 'الثاني (Q2)' : selectedQuarter === 3 ? 'الثالث (Q3)' : 'الرابع (Q4)'} لعام ${selectedYear}`;
      case 'semi_annual':
        return `تقرير النصف ${selectedHalf === 1 ? 'الأول (H1: شهور 1-6)' : 'الثاني (H2: شهور 7-12)'} لعام ${selectedYear}`;
      case 'annual':
        return `تقرير سنوي شامل لعام ${selectedYear}`;
    }
  }, [periodType, selectedWeek, weekInfo, selectedMonth, selectedYear, selectedQuarter, selectedHalf]);

  // Export to Excel (both Aggregated summary & Detailed rows)
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'منظومة حوكمة جودة الانشاءات - إجراء 155';
      workbook.created = new Date();

      // Sheet 1: Summary & Aggregated Metrics
      const summarySheet = workbook.addWorksheet('المؤشرات والتقرير المجمع', { views: [{ rightToLeft: true }] });
      summarySheet.columns = [
        { width: 28 },
        { width: 18 },
        { width: 20 },
        { width: 20 },
        { width: 22 }
      ];

      // Header Banner
      const titleRow = summarySheet.addRow(['منظومة حوكمة جودة الانشاءات - تقرير دوري مجمع لإجراء 155']);
      titleRow.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      summarySheet.mergeCells('A1:E1');

      summarySheet.addRow([]);
      summarySheet.addRow(['نطاق التقرير:', periodLabelText]);
      summarySheet.addRow(['المكتب المختار:', officeFilter === 'all' ? 'جميع المكاتب الفرعية' : officeFilter]);
      summarySheet.addRow(['تاريخ إنشاء التقرير:', new Date().toLocaleString('ar-SA')]);
      summarySheet.addRow(['رابط SharePoint المعتمد:', SHAREPOINT_AUDIT_URL]);
      summarySheet.addRow([]);

      // Metrics Block
      const mHeader = summarySheet.addRow(['المؤشر الرئيسي', 'العدد / القيمة', 'النسبة المئوية', 'التقييم العام', 'الملاحظات']);
      mHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      mHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

      summarySheet.addRow(['إجمالي أوامر العمل المدققة', metrics.total, '100%', '-', 'كافة أوامر العمل في النطاق']);
      summarySheet.addRow(['مؤهل للاغلاق (معتمد لإجراء 155)', metrics.readyCount, `${metrics.readyRate}%`, metrics.readyRate >= 80 ? 'ممتاز' : 'جيد', 'استوفت كافة الاشتراطات']);
      summarySheet.addRow(['غير مؤهل للاغلاق', metrics.notReadyCount, `${metrics.notReadyRate}%`, metrics.notReadyRate > 30 ? 'تنبيه' : 'طبيعي', 'تتطلب معالجة واستيفاء الملاحظات']);
      summarySheet.addRow(['أوامر تحتوي على ملفات وصور مرفوعة', metrics.withAttachedFilesCount, `${metrics.total > 0 ? Math.round((metrics.withAttachedFilesCount / metrics.total) * 100) : 0}%`, '-', 'موثقة ومحفوظة برمز أمان معتمد']);
      summarySheet.addRow(['متوسط التزام معايير الجودة الستة', '-', `${metrics.avgCriteriaRate}%`, metrics.avgCriteriaRate >= 80 ? 'مرتفع' : 'متوسط', 'نماذج الاستشاري والفحص ونموذج 190 و 200']);

      summarySheet.addRow([]);
      // Office Comparative Table
      const offHead = summarySheet.addRow(['المكتب الفرعي', 'إجمالي الأوامر', 'المؤهل للإغلاق', 'غير المؤهل', 'نسبة الإغلاق المعتمد']);
      offHead.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      offHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      officeMetrics.forEach(om => {
        summarySheet.addRow([om.name, om.total, om.ready, om.notReady, `${om.rate}%`]);
      });

      summarySheet.addRow([]);
      // Contractor Comparative Table
      const contHead = summarySheet.addRow(['المقاول', 'المكاتب التي يعمل بها', 'إجمالي الأوامر', 'المؤهل للإغلاق', 'نسبة الإنجاز']);
      contHead.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      contHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
      contractorMetrics.forEach(cm => {
        summarySheet.addRow([cm.name, cm.officesText, cm.total, cm.ready, `${cm.rate}%`]);
      });

      // Sheet 2: Detailed Work Orders Matrix
      const detailedSheet = workbook.addWorksheet('سجل الأوامر التفصيلي', { views: [{ rightToLeft: true }] });
      detailedSheet.columns = [
        { header: 'م', width: 6 },
        { header: 'المكتب', width: 16 },
        { header: 'المقاول', width: 20 },
        { header: 'رقم أمر العمل', width: 18 },
        { header: 'نوع أمر العمل', width: 16 },
        { header: 'ملف الصور والمرفقات', width: 18 },
        { header: 'توثيق الصور', width: 16 },
        { header: 'نماذج الاستشاري', width: 16 },
        { header: 'نماذج إجازة الاستشاري', width: 18 },
        { header: 'نموذج 190', width: 14 },
        { header: 'نموذج 200', width: 14 },
        { header: 'نموذج الفحص', width: 14 },
        { header: 'ملاحظات الجودة', width: 28 },
        { header: 'حالة أمر العمل', width: 18 },
        { header: 'مزامنة الحالة', width: 20 },
        { header: 'إجراء 155', width: 16 },
        { header: 'مزامنة الإجراء', width: 20 }
      ];

      detailedSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      detailedSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

      detailedOrders.forEach((order, idx) => {
        const fileCount = order.photosFile?.length || 0;
        const fileDesc = fileCount > 0 ? `${fileCount} مرفق (SharePoint)` : 'رابط SharePoint';
        detailedSheet.addRow([
          idx + 1,
          order.office || '-',
          order.contractor || '-',
          order.workOrderNumber || '-',
          order.workOrderCode || '-',
          fileDesc,
          order.photoDocumentation || '-',
          order.consultantForms || '-',
          order.consultantClearanceForms || '-',
          order.form190 || '-',
          order.form200 || '-',
          order.inspectionForm || '-',
          order.qualityNotes || '-',
          order.procedure155Status || '-',
          order.statusSyncTime || '-',
          order.procedure155 || '-',
          order.procedureSyncTime || '-'
        ]);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `تقرير_حوكمة_الجودة_155_${selectedYear}_${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      try {
        soundService.playActionSound('export');
      } catch (_) {}
      setNotificationMsg('تم تصدير ملف Excel الشامل بنجاح!');
      setTimeout(() => setNotificationMsg(null), 3500);
    } catch (err) {
      console.error(err);
      setNotificationMsg('حدث خطأ أثناء تصدير ملف Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to PDF (Official A4 Landscape - Never stretched or garbled)
  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const safeTitle = `التقرير_الشامل_${periodLabelText.replace(/\s+/g, '_')}`;
      if (viewMode === 'detailed') {
        await exportOrdersDirectToPdf(
          detailedOrders,
          `${periodLabelText} • ${officeFilter === 'all' ? 'كافة المكاتب الفرعية' : officeFilter}`,
          `${safeTitle}_تفصيلي.pdf`
        );
      } else {
        await exportToPdf(
          '#comprehensive-aggregated-export-stage',
          periodFilteredOrders,
          `${periodLabelText} • ${officeFilter === 'all' ? 'كافة المكاتب الفرعية' : officeFilter}`,
          `${safeTitle}_مجمع.pdf`,
          { orientation: 'landscape', format: 'a4' }
        );
      }
      try {
        soundService.playActionSound('export');
      } catch (_) {}
      setNotificationMsg('تم إصدار وتحميل تقرير PDF المعتمد بنجاح!');
      setTimeout(() => setNotificationMsg(null), 3500);
    } catch (err) {
      console.error(err);
      setNotificationMsg('حدث خطأ أثناء إنشاء PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  // Copy Executive Summary to Clipboard
  const handleCopySummary = () => {
    const summaryText = `
📋 ملخص تنفيذي - منظومة حوكمة جودة الانشاءات (إجراء 155)
الفترة: ${periodLabelText}
نطاق العرض: ${officeFilter === 'all' ? 'جميع المكاتب الفرعية' : officeFilter}
----------------------------------------
• إجمالي أوامر العمل: ${metrics.total}
• مؤهل للإغلاق 155 (معتمد): ${metrics.readyCount} (${metrics.readyRate}%)
• غير مؤهل للإغلاق: ${metrics.notReadyCount} (${metrics.notReadyRate}%)
• أوامر تحتوي على ملفات وصور: ${metrics.withAttachedFilesCount}
• متوسط التزام معايير الجودة: ${metrics.avgCriteriaRate}%
----------------------------------------
ترتيب المكاتب:
${officeMetrics.map((om, idx) => `${idx + 1}. ${om.name}: إجمالي (${om.total}) | نسبة الإغلاق (${om.rate}%)`).join('\n')}
----------------------------------------
رابط تدقيق الجودة SharePoint:
${SHAREPOINT_AUDIT_URL}
    `.trim();

    navigator.clipboard.writeText(summaryText);
    setIsCopiedSummary(true);
    setTimeout(() => setIsCopiedSummary(false), 2500);
    try {
      soundService.playActionSound('update');
    } catch (_) {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-['Cairo',sans-serif]">
      <div 
        ref={reportContainerRef}
        className="w-full max-w-7xl max-h-[94vh] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-right text-white animate-in zoom-in-95 duration-200"
      >
        {/* 1. Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-lg border border-emerald-400/40 shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white">
                  مركز التقارير الموحد والمؤشرات التحليلية
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold">
                  نظام إجراء 155
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold">
                  تقارير تفصيلية ومجمعة
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                ربط شامل وتلقائي بين الجداول الشهرية، مؤشرات الأداء، مقارنة المقاولين والمكاتب، وتوثيق ملفات الصور المعتمدة
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={SHAREPOINT_AUDIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-black transition-colors"
              title="فتح مجلد تدقيق الجودة SharePoint"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
              <span>SharePoint</span>
            </a>

            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
              title="نسخ الملخص التنفيذي إلى الحافظة"
            >
              {isCopiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopiedSummary ? 'تم النسخ' : 'نسخ الملخص'}</span>
            </button>

            <UnifiedSectionExportBar
              orders={viewMode === 'detailed' ? detailedOrders : periodFilteredOrders}
              sectionTitle={`التقرير_الشامل_${selectedYear}`}
              captureSelector={viewMode === 'aggregated' ? '#comprehensive-aggregated-export-stage' : undefined}
              onOpenExportModal={onOpenExportModal}
            />

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white border border-emerald-400/40 text-xs font-black shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>تصدير Excel الشامل</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/40 text-xs font-black shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>تصدير PDF</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
              title="طباعة التقرير"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-white transition-colors cursor-pointer border border-rose-800/40"
              title="إغلاق النافذة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Mode Tabs & Period Scope Switcher Bar */}
        <div className="p-3 sm:px-5 bg-slate-950/80 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Main Mode Toggle: Aggregated vs Detailed */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-2xl border border-slate-800 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('aggregated')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'aggregated'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>التقارير المجمعة الدورية</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('detailed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'detailed'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>التقارير التفصيلية للأوامر ({detailedOrders.length})</span>
            </button>
          </div>

          {/* Period Selector Tabs (اسبوعية - شهرية - ربع سنوية - نصف سنوية - سنوية) */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            <span className="text-[11px] font-bold text-slate-400 ml-1 shrink-0">دورية التجميع:</span>
            
            <button
              type="button"
              onClick={() => setPeriodType('weekly')}
              className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                periodType === 'weekly' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              أسبوعية
            </button>

            <button
              type="button"
              onClick={() => setPeriodType('monthly')}
              className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                periodType === 'monthly' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              شهرية
            </button>

            <button
              type="button"
              onClick={() => setPeriodType('quarterly')}
              className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                periodType === 'quarterly' ? 'bg-teal-600 text-white shadow-xs' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              ربع سنوية
            </button>

            <button
              type="button"
              onClick={() => setPeriodType('semi_annual')}
              className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                periodType === 'semi_annual' ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              نصف سنوية
            </button>

            <button
              type="button"
              onClick={() => setPeriodType('annual')}
              className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                periodType === 'annual' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              سنوية
            </button>
          </div>
        </div>

        {/* 3. Sub-period Pickers & Filters Row */}
        <div className="p-3 sm:px-5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Period specific controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Year selector */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-400">السنة:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                {availableYears.map(y => (
                  <option key={y} value={y} className="bg-slate-900 text-white">{y}</option>
                ))}
              </select>
            </div>

            {/* Monthly picker */}
            {periodType === 'monthly' && (
              <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400">الشهر:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
                >
                  {ARABIC_MONTHS.map(m => (
                    <option key={m.num} value={m.num} className="bg-slate-900 text-white">
                      {m.name} ({m.num})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quarterly picker */}
            {periodType === 'quarterly' && (
              <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400">الربع:</span>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
                  className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
                >
                  <option value={1} className="bg-slate-900 text-white">الربع الأول Q1 (يناير - مارس)</option>
                  <option value={2} className="bg-slate-900 text-white">الربع الثاني Q2 (أبريل - يونيو)</option>
                  <option value={3} className="bg-slate-900 text-white">الربع الثالث Q3 (يوليو - سبتمبر)</option>
                  <option value={4} className="bg-slate-900 text-white">الربع الرابع Q4 (أكتوبر - ديسمبر)</option>
                </select>
              </div>
            )}

            {/* Semi-annual picker */}
            {periodType === 'semi_annual' && (
              <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400">النصف:</span>
                <select
                  value={selectedHalf}
                  onChange={(e) => setSelectedHalf(Number(e.target.value) as 1 | 2)}
                  className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
                >
                  <option value={1} className="bg-slate-900 text-white">النصف الأول H1 (يناير - يونيو)</option>
                  <option value={2} className="bg-slate-900 text-white">النصف الثاني H2 (يوليو - ديسمبر)</option>
                </select>
              </div>
            )}

            {/* Weekly picker */}
            {periodType === 'weekly' && (
              <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400">الأسبوع:</span>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value as any)}
                  className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
                >
                  <option value="current_week" className="bg-slate-900 text-white">الأسبوع الحالي ({weekInfo.currentWeekRange})</option>
                  <option value="last_week" className="bg-slate-900 text-white">الأسبوع السابق ({weekInfo.lastWeekRange})</option>
                </select>
              </div>
            )}

            {/* Office Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-400">المكتب:</span>
              <select
                value={officeFilter}
                onChange={(e) => setOfficeFilter(e.target.value)}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-white">جميع المكاتب الفرعية</option>
                <option value="مكتب عرعر" className="bg-slate-900 text-white">مكتب عرعر</option>
                <option value="مكتب رفحاء" className="bg-slate-900 text-white">مكتب رفحاء</option>
                <option value="مكتب طريف" className="bg-slate-900 text-white">مكتب طريف</option>
                <option value="مكتب العويقيلة" className="bg-slate-900 text-white">مكتب العويقيلة</option>
              </select>
            </div>

            {/* Table Filter (ربط مباشر مع شجرة وجداول النظام) */}
            {monthTables.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] text-slate-400">الجدول:</span>
                <select
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer max-w-[150px] truncate"
                >
                  <option value="all" className="bg-slate-900 text-white">كافة الجداول المرتبطة</option>
                  {monthTables.map(t => (
                    <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                      {t.name} ({t.year})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Active Period Badge */}
          <div className="text-left font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-xl border border-emerald-500/30">
            {periodLabelText}
          </div>
        </div>

        {/* Notification Toast */}
        {notificationMsg && (
          <div className="px-5 py-2 bg-emerald-600 text-white text-xs font-bold text-center animate-in fade-in">
            {notificationMsg}
          </div>
        )}

        {/* 4. Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Top 4 Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Total Orders */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 shadow-md">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>إجمالي الأوامر المدققة</span>
                <BarChart3 className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">{metrics.total}</div>
              <div className="text-[11px] text-slate-400 mt-1">أمر عمل في النطاق المحدد</div>
            </div>

            {/* 2. Qualified for 155 */}
            <div className="bg-gradient-to-br from-emerald-950/80 to-slate-900 rounded-2xl p-4 border border-emerald-500/40 shadow-md">
              <div className="flex items-center justify-between text-emerald-300 text-xs mb-1">
                <span>مؤهل للإغلاق 155</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-400 font-mono">{metrics.readyCount}</span>
                <span className="text-xs font-bold text-emerald-300 font-mono">({metrics.readyRate}%)</span>
              </div>
              <div className="text-[11px] text-emerald-300/80 mt-1">معتمد ومستوفٍ للاشتراطات</div>
            </div>

            {/* 3. Non-qualified */}
            <div className="bg-gradient-to-br from-rose-950/80 to-slate-900 rounded-2xl p-4 border border-rose-500/40 shadow-md">
              <div className="flex items-center justify-between text-rose-300 text-xs mb-1">
                <span>غير مؤهل للإغلاق</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-400 font-mono">{metrics.notReadyCount}</span>
                <span className="text-xs font-bold text-rose-300 font-mono">({metrics.notReadyRate}%)</span>
              </div>
              <div className="text-[11px] text-rose-300/80 mt-1">يتطلب استيفاء الملاحظات</div>
            </div>

            {/* 4. Files & Photo Documentation */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 shadow-md">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>ملفات الصور والمستندات</span>
                <FolderOpen className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-400 font-mono">{metrics.withAttachedFilesCount}</span>
                <span className="text-xs font-bold text-slate-300 font-mono">
                  ({metrics.total > 0 ? Math.round((metrics.withAttachedFilesCount / metrics.total) * 100) : 0}%)
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">مرفق + رابط SharePoint ثابت</div>
            </div>
          </div>

          {/* MODE 1: AGGREGATED REPORTS VIEW (التقارير المجمعة) */}
          {viewMode === 'aggregated' && (
            <div className="space-y-6">
              {/* Quality Criteria Compliance Progress Bars */}
              <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>معدلات اكتمال معايير جودة التنفيذ لإجراء 155</span>
                  </h4>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                    متوسط الاكتمال: {metrics.avgCriteriaRate}%
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  {[
                    { label: 'توثيق الصور', count: metrics.photoCompleteCount, total: metrics.total },
                    { label: 'نماذج الاستشاري', count: metrics.consultantFormsCount, total: metrics.total },
                    { label: 'نماذج إجازة الاستشاري', count: metrics.consultantClearanceCount, total: metrics.total },
                    { label: 'نموذج 190', count: metrics.form190Count, total: metrics.total },
                    { label: 'نموذج 200', count: metrics.form200Count, total: metrics.total },
                    { label: 'نموذج الفحص', count: metrics.inspectionCount, total: metrics.total }
                  ].map((crit, idx) => {
                    const r = crit.total > 0 ? Math.round((crit.count / crit.total) * 100) : 0;
                    return (
                      <div key={idx} className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-300">{crit.label}</span>
                          <span className="font-mono text-emerald-400 font-bold">{r}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${r}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${
                              r >= 80 ? 'bg-emerald-500' : r >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                          />
                        </div>
                        <div className="text-[10px] text-slate-400 text-left font-mono">
                          {crit.count} من {crit.total} مكتمل
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Office Comparative Performance Table */}
              <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <span>مقارنة وتصنيف أداء المكاتب الفرعية في الإغلاق المعتمد</span>
                  </h4>
                  <span className="text-xs text-slate-400">مرتب حسب أعلى نسبة إنجاز</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-300 border-b border-slate-700">
                        <th className="p-2.5 font-black">المكتب الفرعي</th>
                        <th className="p-2.5 font-black">إجمالي الأوامر</th>
                        <th className="p-2.5 font-black">المؤهل للإغلاق 155</th>
                        <th className="p-2.5 font-black">غير المؤهل</th>
                        <th className="p-2.5 font-black">ملفات الصور</th>
                        <th className="p-2.5 font-black">نسبة الإغلاق</th>
                        <th className="p-2.5 font-black">التقييم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {officeMetrics.map((om, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-2.5 font-black text-white">{om.name}</td>
                          <td className="p-2.5 font-mono text-slate-300">{om.total}</td>
                          <td className="p-2.5 font-mono text-emerald-400 font-bold">{om.ready}</td>
                          <td className="p-2.5 font-mono text-rose-400 font-bold">{om.notReady}</td>
                          <td className="p-2.5 font-mono text-amber-300">{om.withFiles}</td>
                          <td className="p-2.5 font-mono font-black text-emerald-400">{om.rate}%</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              om.rate >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                              om.rate >= 50 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                              'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}>
                              {om.evaluation}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Contractor Comparative Benchmark Table */}
              <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-teal-400" />
                    <span>مقارنة المقاولين بنسب إنجاز إغلاق أوامر العمل</span>
                  </h4>
                  <span className="text-xs text-slate-400">({contractorMetrics.length} مقاول)</span>
                </div>

                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead className="sticky top-0 bg-slate-900 text-slate-300 border-b border-slate-700">
                      <tr>
                        <th className="p-2.5 font-black">المقاول</th>
                        <th className="p-2.5 font-black">المكاتب المرتبطة</th>
                        <th className="p-2.5 font-black">الأوامر</th>
                        <th className="p-2.5 font-black">المؤهل 155</th>
                        <th className="p-2.5 font-black">غير المؤهل</th>
                        <th className="p-2.5 font-black">نسبة الإغلاق</th>
                        <th className="p-2.5 font-black">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {contractorMetrics.map((cm, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-2.5 font-bold text-white">{cm.name}</td>
                          <td className="p-2.5 text-slate-400 truncate max-w-[200px]">{cm.officesText}</td>
                          <td className="p-2.5 font-mono text-slate-300">{cm.total}</td>
                          <td className="p-2.5 font-mono text-emerald-400 font-bold">{cm.ready}</td>
                          <td className="p-2.5 font-mono text-rose-400 font-bold">{cm.notReady}</td>
                          <td className="p-2.5 font-mono font-black text-emerald-400">{cm.rate}%</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              cm.rate >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                              cm.rate >= 50 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                              'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}>
                              {cm.evaluation}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: DETAILED WORK ORDERS MATRIX VIEW (التقارير التفصيلية) */}
          {viewMode === 'detailed' && (
            <div className="space-y-4">
              {/* Detailed Filter and Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs">
                {/* Search Bar */}
                <div className="relative flex-1 w-full">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث برقم أمر العمل، نوعه، المقاول، المكتب، أو الملاحظات..."
                    className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
                </div>

                {/* Status qualification filter */}
                <select
                  value={statusQualificationFilter}
                  onChange={(e) => setStatusQualificationFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold cursor-pointer text-xs"
                >
                  <option value="all">كافة الحالات</option>
                  <option value="ready">مؤهل للاغلاق (معتمد)</option>
                  <option value="notReady">غير مؤهل للاغلاق</option>
                </select>

                {/* Contractor filter */}
                <select
                  value={contractorFilter}
                  onChange={(e) => setContractorFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold cursor-pointer text-xs"
                >
                  <option value="all">كافة المقاولين</option>
                  {contractorMetrics.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Detailed Matrix Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800 max-h-[500px]">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="sticky top-0 bg-slate-950 text-slate-300 border-b border-slate-800 z-10 shadow-xs">
                    <tr>
                      <th className="p-3 font-black">م</th>
                      <th className="p-3 font-black">المكتب</th>
                      <th className="p-3 font-black">المقاول</th>
                      <th className="p-3 font-black">رقم أمر العمل</th>
                      <th className="p-3 font-black">النوع</th>
                      <th className="p-3 font-black">ملف الصور</th>
                      <th className="p-3 font-black">توثيق الصور</th>
                      <th className="p-3 font-black">نماذج الاستشاري</th>
                      <th className="p-3 font-black">إجازة الاستشاري</th>
                      <th className="p-3 font-black">190</th>
                      <th className="p-3 font-black">200</th>
                      <th className="p-3 font-black">الفحص</th>
                      <th className="p-3 font-black">حالة أمر العمل</th>
                      <th className="p-3 font-black">إجراء 155</th>
                      <th className="p-3 font-black">ملاحظات الجودة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
                    {detailedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="p-8 text-center text-slate-400">
                          لا توجد أوامر عمل تطابق محددات البحث والفترة المحددة.
                        </td>
                      </tr>
                    ) : (
                      detailedOrders.map((order, idx) => {
                        const isQualified = !String(order.procedure155Status).includes('غير') && 
                          (String(order.procedure155Status).includes('مؤهل') || String(order.procedure155Status).includes('معتمد'));
                        const fileCount = order.photosFile?.length || 0;

                        return (
                          <tr key={order.id || idx} className="hover:bg-slate-800/60 transition-colors">
                            <td className="p-2.5 font-mono text-slate-400">{idx + 1}</td>
                            <td className="p-2.5 font-bold text-slate-200">{order.office}</td>
                            <td className="p-2.5 text-slate-300">{order.contractor}</td>
                            <td className="p-2.5 font-mono font-black text-white">{order.workOrderNumber}</td>
                            <td className="p-2.5 font-mono text-slate-400">{order.workOrderCode || '-'}</td>

                            {/* ملف الصور (مع رابط SharePoint الموحد) */}
                            <td className="p-2.5">
                              <div className="flex items-center gap-1.5">
                                {fileCount > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => onOpenOrderFiles && onOpenOrderFiles(order)}
                                    className="px-2 py-0.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold text-[10px] hover:bg-emerald-900 cursor-pointer flex items-center gap-1"
                                    title="فتح ملف الصور في البطاقة المستقلة"
                                  >
                                    <span>{fileCount} ملف</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-500 italic">بدون ملفات</span>
                                )}
                                <a
                                  href={SHAREPOINT_AUDIT_URL}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 p-0.5"
                                  title="فتح مجلد SharePoint"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </td>

                            {/* Status criteria */}
                            <td className="p-2.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                String(order.photoDocumentation).includes('مكتمل') ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                              }`}>
                                {order.photoDocumentation || '-'}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-300">{order.consultantForms || '-'}</td>
                            <td className="p-2.5 text-slate-300">{order.consultantClearanceForms || '-'}</td>
                            <td className="p-2.5 text-slate-300">{order.form190 || '-'}</td>
                            <td className="p-2.5 text-slate-300">{order.form200 || '-'}</td>
                            <td className="p-2.5 text-slate-300">{order.inspectionForm || '-'}</td>

                            {/* Procedure 155 Status */}
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                                isQualified ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                              }`}>
                                {order.procedure155Status || 'غير محدد'}
                              </span>
                            </td>

                            <td className="p-2.5 text-slate-300">{order.procedure155 || '-'}</td>

                            {/* Quality Notes */}
                            <td className="p-2.5 text-red-400 max-w-[200px] truncate" title={order.qualityNotes || ''}>
                              {order.qualityNotes || '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* 5. Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span>إجمالي الأوامر المستعرضة: <strong className="text-white font-mono">{detailedOrders.length}</strong></span>
            <span>•</span>
            <span>نسبة التأهيل المعتمدة لإجراء 155: <strong className="text-emerald-400 font-mono">{metrics.readyRate}%</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>

        {/* Dedicated Offscreen Print/Export A4 Landscape Sheet for Aggregated Reports */}
        <div
          id="comprehensive-aggregated-export-stage"
          dir="rtl"
          className="fixed -left-[9999px] top-0 pointer-events-none opacity-0"
        >
          <div
            style={{
              width: '1123px',
              minWidth: '1123px',
              maxWidth: '1123px',
              height: '794px',
              minHeight: '794px',
              maxHeight: '794px',
              boxSizing: 'border-box',
            }}
            className="export-page-sheet bg-white text-slate-900 px-8 py-5 flex flex-col justify-between overflow-hidden font-['Cairo',sans-serif]"
          >
            <div className="space-y-3.5">
              {/* Header Strictly Conforming to User Requirements */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2.5">
                {/* Right: Platform Header with Graded Typography */}
                <div className="text-right flex flex-col gap-0.5">
                  <span className="text-sm sm:text-base font-black text-slate-950 leading-tight">
                    حوكمة جودة اعمال الانشاءات
                  </span>
                  <span className="text-xs sm:text-[13px] font-bold text-slate-800 leading-tight">
                    منظومة ادارة كهرباء الحدود الشمالية
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600 leading-tight">
                    المساندة الفنية
                  </span>
                </div>
                <div className="text-center">
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">
                    {officeFilter === 'all' ? `التقرير الشامل ${selectedYear}` : officeFilter}
                  </h3>
                </div>
                <div className="text-left font-mono text-xs font-bold text-slate-800">
                  التاريخ: {new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}
                </div>
              </div>

              {/* ( مؤشرات الاداء ) */}
              <div className="text-[11px] font-black text-slate-900 text-center -mb-1.5">
                ( مؤشرات الاداء )
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500">إجمالي الأوامر المدققة</div>
                  <div className="text-xl font-black text-slate-900 font-mono mt-0.5">{metrics.total}</div>
                </div>
                <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                  <div className="text-[11px] font-bold text-emerald-800">مؤهل للإغلاق 155</div>
                  <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">
                    {metrics.readyCount} <span className="text-xs">({metrics.readyRate}%)</span>
                  </div>
                </div>
                <div className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-200">
                  <div className="text-[11px] font-bold text-rose-800">غير مؤهل للإغلاق</div>
                  <div className="text-xl font-black text-rose-700 font-mono mt-0.5">
                    {metrics.notReadyCount} <span className="text-xs">({metrics.notReadyRate}%)</span>
                  </div>
                </div>
                <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200">
                  <div className="text-[11px] font-bold text-amber-800">ملفات الصور والمستندات</div>
                  <div className="text-xl font-black text-amber-700 font-mono mt-0.5">
                    {metrics.withAttachedFilesCount} <span className="text-xs">({metrics.avgCriteriaRate}% التزام)</span>
                  </div>
                </div>
              </div>

              {/* 6 Quality Criteria Compliance Row */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-slate-900">معدلات اكتمال معايير جودة التنفيذ لإجراء 155</span>
                  <span className="text-[11px] font-mono font-bold text-emerald-800">متوسط الاكتمال: {metrics.avgCriteriaRate}%</span>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {[
                    { label: 'توثيق الصور', count: metrics.photoCompleteCount, total: metrics.total },
                    { label: 'نماذج الاستشاري', count: metrics.consultantFormsCount, total: metrics.total },
                    { label: 'إجازة الاستشاري', count: metrics.consultantClearanceCount, total: metrics.total },
                    { label: 'نموذج 190', count: metrics.form190Count, total: metrics.total },
                    { label: 'نموذج 200', count: metrics.form200Count, total: metrics.total },
                    { label: 'نموذج الفحص', count: metrics.inspectionCount, total: metrics.total }
                  ].map((crit, idx) => {
                    const r = crit.total > 0 ? Math.round((crit.count / crit.total) * 100) : 0;
                    return (
                      <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                        <div className="text-[10px] font-bold text-slate-700 truncate">{crit.label}</div>
                        <div className="text-sm font-black text-emerald-700 font-mono mt-0.5">{r}%</div>
                        <div className="text-[9px] text-slate-500 font-mono">{crit.count}/{crit.total}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Side-by-side Tables: Offices & Top Contractors */}
              <div className="grid grid-cols-2 gap-4">
                {/* Offices Table */}
                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  <div className="bg-slate-900 text-white px-3 py-1.5 text-xs font-black flex justify-between">
                    <span>مقارنة أداء المكاتب الفرعية</span>
                    <span className="text-slate-300 font-mono">{officeMetrics.length} مكاتب</span>
                  </div>
                  <table className="w-full text-[11px] text-right border-collapse" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                        <th className="py-1.5 px-2 font-black w-[110px]">المكتب</th>
                        <th className="py-1.5 px-1.5 text-center font-black">الأوامر</th>
                        <th className="py-1.5 px-1.5 text-center font-black text-emerald-800">المؤهل</th>
                        <th className="py-1.5 px-1.5 text-center font-black text-rose-800">غير المؤهل</th>
                        <th className="py-1.5 px-1.5 text-center font-black">النسبة</th>
                        <th className="py-1.5 px-2 text-center font-black">التقييم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {officeMetrics.map((om, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                          <td className="py-1.5 px-2 font-black text-slate-900 truncate">{om.name}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono font-bold">{om.total}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono font-bold text-emerald-700">{om.ready}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono font-bold text-rose-700">{om.notReady}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono font-black text-emerald-800">{om.rate}%</td>
                          <td className="py-1.5 px-2 text-center font-bold text-[10px]">{om.evaluation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Contractors Table */}
                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  <div className="bg-slate-900 text-white px-3 py-1.5 text-xs font-black flex justify-between">
                    <span>مقارنة أداء المقاولين المعتمدين</span>
                    <span className="text-slate-300 font-mono">أعلى {Math.min(contractorMetrics.length, 8)} مقاولين</span>
                  </div>
                  <table className="w-full text-[11px] text-right border-collapse" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                        <th className="py-1.5 px-2 font-black w-[140px]">المقاول</th>
                        <th className="py-1.5 px-1.5 text-center font-black">الأوامر</th>
                        <th className="py-1.5 px-1.5 text-center font-black text-emerald-800">المؤهل</th>
                        <th className="py-1.5 px-1.5 text-center font-black text-rose-800">غير المؤهل</th>
                        <th className="py-1.5 px-1.5 text-center font-black">النسبة</th>
                        <th className="py-1.5 px-2 text-center font-black">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {contractorMetrics.slice(0, 8).map((cm, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                          <td className="py-1.5 px-2 font-black text-slate-900 truncate">{cm.name}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono font-bold">{cm.total}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono font-bold text-emerald-700">{cm.ready}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono font-bold text-rose-700">{cm.notReady}</td>
                          <td className="py-1.5 px-1.5 text-center font-mono font-black text-emerald-800">{cm.rate}%</td>
                          <td className="py-1.5 px-2 text-center font-bold text-[10px]">{cm.evaluation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Official Footer: Page Number Only */}
            <div className="pt-2 border-t-2 border-slate-900 text-center text-xs text-slate-800 font-mono font-black shrink-0">
              رقم الصفحة: 1
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
