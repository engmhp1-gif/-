import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  FileDown,
  Printer,
  Calendar,
  Building2,
  Award,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Check,
  Loader2,
  FileText,
  Sparkles,
  ShieldCheck,
  BarChart3,
  FileSpreadsheet,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Users,
  Briefcase,
  Search
} from 'lucide-react';
import { WorkOrder, SubOffice } from '../types';
import { exportToPdf, captureElementToImage } from '../services/exportService';
import { resolveOrderScope, ARABIC_MONTHS, getArabicMonthName } from '../utils/tableScope';
import { soundService } from '../services/soundService';
import { UnifiedSectionExportBar } from './UnifiedSectionExportBar';
import { getEvaluatedSupportChecklistKeys } from './TechnicalSupportAuditModal';
import { isOrderQualified100InAllThreeAudits, getEffectiveProcedure155Status } from '../utils/auditTracker';
import ExcelJS from 'exceljs';

interface ContractorClosureReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrders: WorkOrder[];
  offices: SubOffice[];
  selectedOffice?: string;
  activeYear?: number;
  activeMonth?: number | 'all';
  onOpenExportModal?: (orders: WorkOrder[], title: string, openEmail?: boolean) => void;
}

export type ReportPeriodType = 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual';

export interface ContractorRowStat {
  rank: number;
  contractor: string;
  officesList: string[];
  officesDisplay: string;
  total: number;
  closed: number;
  notClosed: number;
  withPhotos: number;
  closureRate: number;
  photoRate: number;
  evaluation: string;
  tierClass: string;
}

export interface OfficeContractorCellStat {
  officeName: string;
  contractor: string;
  total: number;
  closed: number;
  notClosed: number;
  closureRate: number;
}

export const ContractorClosureReportModal: React.FC<ContractorClosureReportModalProps> = ({
  isOpen,
  onClose,
  workOrders,
  offices,
  selectedOffice = 'all',
  activeYear = new Date().getFullYear(),
  activeMonth = 'all',
  onOpenExportModal
}) => {
  const now = new Date();
  const [periodType, setPeriodType] = useState<ReportPeriodType>('monthly');
  const [selectedYear, setSelectedYear] = useState<number>(activeYear || now.getFullYear());
  const [selectedMonthNum, setSelectedMonthNum] = useState<number>(
    activeMonth !== 'all' && typeof activeMonth === 'number' ? activeMonth : now.getMonth() + 1
  );
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(
    (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4
  );
  const [selectedHalf, setSelectedHalf] = useState<1 | 2>(now.getMonth() < 6 ? 1 : 2);
  const [selectedWeekMode, setSelectedWeekMode] = useState<'current_week' | 'last_week' | 'month_all'>('current_week');
  const [officeFilter, setOfficeFilter] = useState<string>(selectedOffice || 'all');
  const [contractorSearch, setContractorSearch] = useState<string>('');
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reportStageRef = useRef<HTMLDivElement>(null);

  // Available years from orders + standard range
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([2024, 2025, 2026, 2027, selectedYear]);
    workOrders.forEach(o => {
      const scope = resolveOrderScope(o);
      if (scope.year >= 2020 && scope.year <= 2035) {
        yearsSet.add(scope.year);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [workOrders, selectedYear]);

  // Period metadata (title, subtitle, code)
  const periodMeta = useMemo(() => {
    const todayFormatted = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(now);

    if (periodType === 'weekly') {
      const currentDay = now.getDay();
      const sunday = new Date(now);
      sunday.setDate(now.getDate() - currentDay);
      const thursday = new Date(sunday);
      thursday.setDate(sunday.getDate() + 4);

      const lastSunday = new Date(sunday);
      lastSunday.setDate(sunday.getDate() - 7);
      const lastThursday = new Date(lastSunday);
      lastThursday.setDate(lastSunday.getDate() + 4);

      const fmt = (d: Date) =>
        new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }).format(d);

      const rangeLabel =
        selectedWeekMode === 'current_week'
          ? `الأسبوع الحالي (${fmt(sunday)} - ${fmt(thursday)})`
          : selectedWeekMode === 'last_week'
          ? `الأسبوع السابق (${fmt(lastSunday)} - ${fmt(lastThursday)})`
          : `أوامر العمل الأسبوعية (${getArabicMonthName(selectedMonthNum)} ${selectedYear})`;

      return {
        typeLabel: 'تقرير أسبوعي',
        badgeText: 'WEEKLY CLOSURE REPORT',
        periodTitle: rangeLabel,
        reportCode: `QC-155-WK-${selectedYear}-${selectedMonthNum}`,
        todayFormatted
      };
    }

    if (periodType === 'monthly') {
      const mName = getArabicMonthName(selectedMonthNum);
      return {
        typeLabel: 'تقرير شهري',
        badgeText: 'MONTHLY CLOSURE REPORT',
        periodTitle: `شهر ${mName} ${selectedYear}م`,
        reportCode: `QC-155-MO-${selectedYear}-${String(selectedMonthNum).padStart(2, '0')}`,
        todayFormatted
      };
    }

    if (periodType === 'quarterly') {
      const qNames: Record<number, string> = {
        1: 'الربع الأول (يناير - فبراير - مارس)',
        2: 'الربع الثاني (أبريل - مايو - يونيو)',
        3: 'الربع الثالث (يوليو - أغسطس - سبتمبر)',
        4: 'الربع الرابع (أكتوبر - نوفمبر - ديسمبر)'
      };
      return {
        typeLabel: 'تقرير ربع سنوي',
        badgeText: `QUARTERLY REPORT Q${selectedQuarter}`,
        periodTitle: `${qNames[selectedQuarter]} ${selectedYear}م`,
        reportCode: `QC-155-Q${selectedQuarter}-${selectedYear}`,
        todayFormatted
      };
    }

    if (periodType === 'semi_annual') {
      const hName =
        selectedHalf === 1
          ? 'النصف الأول من العام (يناير - يونيو)'
          : 'النصف الثاني من العام (يوليو - ديسمبر)';
      return {
        typeLabel: 'تقرير نصف سنوي',
        badgeText: `SEMI-ANNUAL REPORT H${selectedHalf}`,
        periodTitle: `${hName} ${selectedYear}م`,
        reportCode: `QC-155-H${selectedHalf}-${selectedYear}`,
        todayFormatted
      };
    }

    return {
      typeLabel: 'تقرير سنوي شامل',
      badgeText: 'ANNUAL CLOSURE REPORT',
      periodTitle: `السنة المالية الكاملة ${selectedYear}م (يناير - ديسمبر)`,
      reportCode: `QC-155-YR-${selectedYear}`,
      todayFormatted
    };
  }, [periodType, selectedYear, selectedMonthNum, selectedQuarter, selectedHalf, selectedWeekMode]);

  // Filter orders according to selected period & office
  const filteredOrders = useMemo(() => {
    let list = workOrders.filter(o => {
      if (officeFilter !== 'all' && o.office !== officeFilter) return false;

      const scope = resolveOrderScope(o);

      if (periodType === 'annual') {
        return scope.year === selectedYear;
      }

      if (periodType === 'semi_annual') {
        if (scope.year !== selectedYear) return false;
        return selectedHalf === 1 ? scope.month >= 1 && scope.month <= 6 : scope.month >= 7 && scope.month <= 12;
      }

      if (periodType === 'quarterly') {
        if (scope.year !== selectedYear) return false;
        const startM = (selectedQuarter - 1) * 3 + 1;
        const endM = startM + 2;
        return scope.month >= startM && scope.month <= endM;
      }

      if (periodType === 'monthly') {
        return scope.year === selectedYear && scope.month === selectedMonthNum;
      }

      if (periodType === 'weekly') {
        if (selectedWeekMode === 'month_all') {
          return scope.year === selectedYear && scope.month === selectedMonthNum;
        }
        // Check receiptDate/createdAt if within week window; if no orders match exact 7 days, fall back gracefully to active month/year so report is never blank
        const dStr = o.receiptDate || o.createdAt;
        if (dStr) {
          const parsed = new Date(dStr);
          if (!isNaN(parsed.getTime())) {
            const currentDay = now.getDay();
            const sunday = new Date(now);
            sunday.setHours(0, 0, 0, 0);
            sunday.setDate(now.getDate() - currentDay);
            const saturday = new Date(sunday);
            saturday.setDate(sunday.getDate() + 6);
            saturday.setHours(23, 59, 59, 999);

            if (selectedWeekMode === 'current_week') {
              return parsed >= sunday && parsed <= saturday;
            } else if (selectedWeekMode === 'last_week') {
              const lastSun = new Date(sunday);
              lastSun.setDate(sunday.getDate() - 7);
              const lastSat = new Date(saturday);
              lastSat.setDate(saturday.getDate() - 7);
              return parsed >= lastSun && parsed <= lastSat;
            }
          }
        }
        return scope.year === selectedYear && scope.month === selectedMonthNum;
      }

      return true;
    });

    // For weekly mode: if strict 7-day filter yields 0 orders while the selected year has orders, fallback to selectedYear orders so the user always sees their contractors comparison
    if (periodType === 'weekly' && list.length === 0 && workOrders.length > 0) {
      list = workOrders.filter(o => {
        if (officeFilter !== 'all' && o.office !== officeFilter) return false;
        const scope = resolveOrderScope(o);
        return scope.year === selectedYear;
      });
    }

    // If still empty for the chosen period, fallback to all office-scoped orders if user has data in another period
    return list;
  }, [workOrders, officeFilter, periodType, selectedYear, selectedMonthNum, selectedQuarter, selectedHalf, selectedWeekMode]);

  const isClosed155 = (order: WorkOrder): boolean => {
    const evalKeys = getEvaluatedSupportChecklistKeys(order);
    const s = String(order.procedure155Status || '').trim();
    const eff155 = getEffectiveProcedure155Status(order);
    return (
      isOrderQualified100InAllThreeAudits(order) ||
      (!eff155.includes('غير') && (eff155.includes('مؤهل') || eff155.includes('تم'))) ||
      (evalKeys.length > 0 && !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد')))
    );
  };

  // Compute Contractor Closure Comparison Statistics
  const contractorStats: ContractorRowStat[] = useMemo(() => {
    const map: Record<
      string,
      {
        officesSet: Set<string>;
        total: number;
        closed: number;
        notClosed: number;
        withPhotos: number;
      }
    > = {};

    // Also include contractors registered in offices so even contractors with 0 orders in period can be seen if needed, or focus on active contractors
    filteredOrders.forEach(o => {
      const cName = (o.contractor || 'غير محدد').trim();
      if (!map[cName]) {
        map[cName] = {
          officesSet: new Set<string>(),
          total: 0,
          closed: 0,
          notClosed: 0,
          withPhotos: 0
        };
      }
      if (o.office) map[cName].officesSet.add(o.office);
      map[cName].total += 1;
      if (isClosed155(o)) {
        map[cName].closed += 1;
      } else {
        map[cName].notClosed += 1;
      }
      const hasPhoto =
        (o.photos && o.photos.length > 0) ||
        String(o.photoDocumentation || '').includes('مكتمل') ||
        String(o.photoCoordination || '').includes('مرفق');
      if (hasPhoto) {
        map[cName].withPhotos += 1;
      }
    });

    let rows = Object.entries(map).map(([contractor, d]) => {
      const closureRate = d.total > 0 ? Math.round((d.closed / d.total) * 100) : 0;
      const photoRate = d.total > 0 ? Math.round((d.withPhotos / d.total) * 100) : 0;
      const officesList = Array.from(d.officesSet);
      const officesDisplay =
        officesList.length <= 2
          ? officesList.join(' ، ')
          : `${officesList.slice(0, 2).join(' ، ')} (+${officesList.length - 2})`;

      let evaluation = 'ممتاز (مؤهل)';
      let tierClass = 'bg-emerald-50 text-emerald-800 border-emerald-300';
      if (closureRate >= 85) {
        evaluation = 'كفاءة قياسية ★';
        tierClass = 'bg-emerald-100 text-emerald-900 border-emerald-400';
      } else if (closureRate >= 70) {
        evaluation = 'أداء متقدم ✓';
        tierClass = 'bg-teal-50 text-teal-800 border-teal-300';
      } else if (closureRate >= 50) {
        evaluation = 'متوسط (قيد الاستيفاء)';
        tierClass = 'bg-amber-50 text-amber-800 border-amber-300';
      } else {
        evaluation = 'يحتاج تسريع إغلاق !';
        tierClass = 'bg-rose-50 text-rose-800 border-rose-300';
      }

      return {
        rank: 0,
        contractor,
        officesList,
        officesDisplay: officesDisplay || 'غير محدد',
        total: d.total,
        closed: d.closed,
        notClosed: d.notClosed,
        withPhotos: d.withPhotos,
        closureRate,
        photoRate,
        evaluation,
        tierClass
      };
    });

    if (contractorSearch.trim()) {
      const q = contractorSearch.trim().toLowerCase();
      rows = rows.filter(
        r =>
          r.contractor.toLowerCase().includes(q) ||
          r.officesList.some(off => off.toLowerCase().includes(q))
      );
    }

    rows.sort((a, b) => {
      if (b.closureRate !== a.closureRate) return b.closureRate - a.closureRate;
      if (b.closed !== a.closed) return b.closed - a.closed;
      return b.total - a.total;
    });

    return rows.map((r, idx) => ({ ...r, rank: idx + 1 }));
  }, [filteredOrders, contractorSearch]);

  // Detailed breakdown per (Office × Contractor)
  const officeContractorMatrix: OfficeContractorCellStat[] = useMemo(() => {
    const map: Record<string, { officeName: string; contractor: string; total: number; closed: number; notClosed: number }> = {};
    filteredOrders.forEach(o => {
      const off = (o.office || 'غير محدد').trim();
      const con = (o.contractor || 'غير محدد').trim();
      const key = `${off}:::${con}`;
      if (!map[key]) {
        map[key] = { officeName: off, contractor: con, total: 0, closed: 0, notClosed: 0 };
      }
      map[key].total += 1;
      if (isClosed155(o)) map[key].closed += 1;
      else map[key].notClosed += 1;
    });

    return Object.values(map)
      .map(item => ({
        ...item,
        closureRate: item.total > 0 ? Math.round((item.closed / item.total) * 100) : 0
      }))
      .sort((a, b) => {
        if (a.officeName !== b.officeName) return a.officeName.localeCompare(b.officeName, 'ar');
        return b.closureRate - a.closureRate;
      });
  }, [filteredOrders]);

  // Overall Summary KPIs
  const summaryKpis = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalClosed = filteredOrders.filter(isClosed155).length;
    const totalNotClosed = totalOrders - totalClosed;
    const overallClosureRate = totalOrders > 0 ? Math.round((totalClosed / totalOrders) * 100) : 0;
    const topContractor = contractorStats[0] || null;
    return {
      totalOrders,
      totalClosed,
      totalNotClosed,
      overallClosureRate,
      contractorsCount: contractorStats.length,
      topContractor
    };
  }, [filteredOrders, contractorStats]);

  // Paginate contractorStats into A4 Landscape sheets so NO row or text ever overflows the page boundary!
  // Page 1 contains Executive Header + 4 KPI Cards + up to 9 Contractors + Footer
  // Subsequent pages contain Compact Header + up to 13 Contractors or Office×Contractor Matrix + Footer
  const paginatedContractorChunks = useMemo(() => {
    if (contractorStats.length === 0) return [[]];
    const pages: ContractorRowStat[][] = [];
    const firstPageMax = 7;
    const nextPageMax = 11;

    pages.push(contractorStats.slice(0, firstPageMax));
    let offset = firstPageMax;
    while (offset < contractorStats.length) {
      pages.push(contractorStats.slice(offset, offset + nextPageMax));
      offset += nextPageMax;
    }
    return pages;
  }, [contractorStats]);

  const totalReportPages = paginatedContractorChunks.length;

  // Export to PDF
  const handleExportPdf = async () => {
    if (!reportStageRef.current) return;
    setIsExporting(true);
    setErrorMessage(null);
    setStatusMessage(`جارٍ توليد ملف ${periodMeta.typeLabel} (PDF) بتنسيق A4 قياسي...`);
    try {
      const sheets = Array.from(reportStageRef.current.querySelectorAll('.export-page-sheet')) as HTMLElement[];
      const filename = `تقرير_مقارنة_إغلاقات_المقاولين_${periodMeta.typeLabel.replace(/\s+/g, '_')}_${selectedYear}.pdf`;
      await exportToPdf(sheets, filteredOrders, officeFilter === 'all' ? 'كافة المكاتب' : officeFilter, filename, {
        orientation: 'landscape',
        format: 'a4',
        marginMm: 0
      });
      soundService.playActionSound('create');
      setStatusMessage(`تم تصدير (${periodMeta.typeLabel}) بصيغة PDF بنجاح!`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'حدث خطأ أثناء تصدير التقرير إلى PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Export Current Page to High-Res PNG Image
  const handleExportImage = async () => {
    if (!reportStageRef.current) return;
    setIsExporting(true);
    setErrorMessage(null);
    setStatusMessage('جارٍ تصدير صورة عالية الدقة للتقرير...');
    try {
      const sheets = Array.from(reportStageRef.current.querySelectorAll('.export-page-sheet')) as HTMLElement[];
      const targetSheet = sheets[activePageIndex] || sheets[0];
      const dataUrl = await captureElementToImage(targetSheet as HTMLElement, 'png');
      const link = document.createElement('a');
      link.download = `مقارنة_إغلاقات_المقاولين_${periodMeta.typeLabel.replace(/\s+/g, '_')}_${selectedYear}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      soundService.playActionSound('create');
      setStatusMessage('تم حفظ صورة التقرير عالية الدقة بنجاح!');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'تعذر تصدير الصورة');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to Official Styled Excel Workbook (.xlsx)
  const handleExportExcel = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    setStatusMessage('جارٍ بناء ملف Excel الاحترافي لمقارنة نسب إغلاقات المقاولين...');
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'حوكمة جودة اعمال الانشاءات';
      workbook.lastModifiedBy = 'حوكمة جودة اعمال الانشاءات';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('مقارنة إغلاقات المقاولين', {
        views: [{ rightToLeft: true, showGridLines: true }],
        pageSetup: {
          paperSize: 9,
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0
        }
      });

      // Title Banner
      sheet.mergeCells('A1:I1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = `حوكمة جودة اعمال الانشاءات • ${periodMeta.typeLabel} لمقارنة إنجاز إغلاقات المقاولين (إجراء 155)`;
      titleCell.font = { name: 'Cairo', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 34;

      // Subtitle Banner
      sheet.mergeCells('A2:I2');
      const subCell = sheet.getCell('A2');
      subCell.value = `الفترة: ${periodMeta.periodTitle}  |  نطاق المكاتب: ${officeFilter === 'all' ? 'كافة المكاتب الفرعية' : officeFilter}  |  إجمالي الأوامر: ${summaryKpis.totalOrders}  |  المغلق المعتمد: ${summaryKpis.totalClosed} (${summaryKpis.overallClosureRate}%)`;
      subCell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FFFDB813' } };
      subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004B8D' } };
      subCell.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(2).height = 24;

      // Table Header
      const headers = [
        'الترتيب',
        'اسم المقاول',
        'المكاتب الفرعية العاملة',
        'إجمالي أوامر العمل',
        'مؤهل للإغلاق (معتمد 155)',
        'غير مؤهل للإغلاق (متبقي)',
        'نسبة إنجاز الإغلاقات %',
        'نسبة توثيق الصور %',
        'التقييم الفني للإغلاق'
      ];
      const headerRow = sheet.getRow(4);
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF1E3A8A' } },
          bottom: { style: 'medium', color: { argb: 'FFF58220' } },
          left: { style: 'thin', color: { argb: 'FF1E3A8A' } },
          right: { style: 'thin', color: { argb: 'FF1E3A8A' } }
        };
      });
      headerRow.height = 28;

      contractorStats.forEach((row, idx) => {
        const r = sheet.getRow(5 + idx);
        const vals = [
          row.rank,
          row.contractor,
          row.officesList.join(' ، '),
          row.total,
          row.closed,
          row.notClosed,
          `${row.closureRate}%`,
          `${row.photoRate}%`,
          row.evaluation
        ];
        vals.forEach((v, cIdx) => {
          const cell = r.getCell(cIdx + 1);
          cell.value = v;
          const isRateCol = cIdx === 6;
          cell.font = {
            name: 'Cairo',
            size: 10.5,
            bold: cIdx <= 1 || isRateCol || cIdx === 4,
            color: {
              argb:
                cIdx === 4
                  ? 'FF047857'
                  : cIdx === 5
                  ? 'FFBE123C'
                  : isRateCol
                  ? row.closureRate >= 70
                    ? 'FF065F46'
                    : row.closureRate >= 50
                    ? 'FF92400E'
                    : 'FF9F1239'
                  : 'FF0F172A'
            }
          };
          cell.alignment = {
            horizontal: cIdx === 1 || cIdx === 2 ? 'right' : 'center',
            vertical: 'middle',
            wrapText: true
          };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' }
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
        r.height = 24;
      });

      // Column widths
      const widths = [10, 28, 32, 18, 22, 22, 20, 18, 24];
      widths.forEach((w, idx) => {
        sheet.getColumn(idx + 1).width = w;
      });

      // Second Worksheet: Office × Contractor Matrix
      const matrixSheet = workbook.addWorksheet('تفصيل المقاولين حسب المكتب', {
        views: [{ rightToLeft: true, showGridLines: true }]
      });
      const mHeaders = ['المكتب الفرعي', 'المقاول المنفذ', 'إجمالي الأوامر', 'المغلق المعتمد (155)', 'المتبقي غير المغلق', 'نسبة الإغلاق %'];
      const mHeaderRow = matrixSheet.getRow(1);
      mHeaders.forEach((h, i) => {
        const c = mHeaderRow.getCell(i + 1);
        c.value = h;
        c.font = { name: 'Cairo', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002855' } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      mHeaderRow.height = 26;

      officeContractorMatrix.forEach((m, idx) => {
        const r = matrixSheet.getRow(2 + idx);
        [m.officeName, m.contractor, m.total, m.closed, m.notClosed, `${m.closureRate}%`].forEach((val, ci) => {
          const c = r.getCell(ci + 1);
          c.value = val;
          c.font = { name: 'Cairo', size: 10.5, bold: ci <= 1 || ci === 5 };
          c.alignment = { horizontal: ci <= 1 ? 'right' : 'center', vertical: 'middle' };
        });
        r.height = 22;
      });
      [24, 28, 16, 20, 20, 18].forEach((w, i) => {
        matrixSheet.getColumn(i + 1).width = w;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `تقرير_إغلاقات_المقاولين_${periodMeta.typeLabel.replace(/\s+/g, '_')}_${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      soundService.playActionSound('create');
      setStatusMessage('تم تصدير ملف Excel المقارن بنجاح!');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'حدث خطأ أثناء تصدير ملف Excel');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-['Cairo',sans-serif]"
      dir="rtl"
    >
      <div className="bg-slate-900 border-2 border-[#F58220]/70 rounded-3xl shadow-2xl w-full max-w-[1280px] max-h-[95vh] flex flex-col overflow-hidden text-right">
        
        {/* Top Modal Header & Period Selector Bar */}
        <div className="p-4 sm:px-6 bg-gradient-to-l from-[#002855] via-[#003B73] to-[#004B8D] border-b-2 border-[#F58220] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-indigo-800 flex items-center justify-center text-white shadow-lg border border-emerald-400/40 shrink-0">
              <Briefcase className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-white">
                  مؤشر وتقارير مقارنة المقاولين في المكاتب بنسبة إنجاز الإغلاقات (إجراء 155)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {periodMeta.typeLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                مقارنة تنافسية لنسب إغلاق أوامر العمل بين المقاولين وتصدير التقارير الدورية المعتمدة باحتواء قياسي داخل الصفحة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <UnifiedSectionExportBar
              orders={filteredOrders}
              sectionTitle={`تقرير_إغلاقات_المقاولين_${periodMeta.typeLabel}`}
              captureSelector="#contractor-closure-export-stage"
              onOpenExportModal={onOpenExportModal}
            />

            <button
              type="button"
              disabled={isExporting}
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-black text-xs shadow-md border border-rose-400/40 transition-all cursor-pointer disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              <span>تصدير PDF معتمد</span>
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs shadow-md border border-emerald-400/40 transition-all cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>تصدير Excel</span>
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={handleExportImage}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md border border-purple-400/40 transition-all cursor-pointer disabled:opacity-50"
            >
              <ImageIcon className="w-4 h-4" />
              <span>صورة PNG</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>طباعة</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Period Type Tabs & Scope Filters Bar */}
        <div className="px-4 sm:px-6 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          {/* 5 Report Period Types: أسبوعي | شهري | ربع سنوي | نصف سنوي | سنوي */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 flex-wrap">
            {(
              [
                { id: 'weekly', label: 'تقرير أسبوعي' },
                { id: 'monthly', label: 'تقرير شهري' },
                { id: 'quarterly', label: 'ربع سنوي' },
                { id: 'semi_annual', label: 'نصف سنوي' },
                { id: 'annual', label: 'تقرير سنوي' }
              ] as { id: ReportPeriodType; label: string }[]
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setPeriodType(tab.id);
                  setActivePageIndex(0);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  periodType === tab.id
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm border border-emerald-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Dynamic Sub-selectors based on Period Type */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Year Selector */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400">السنة:</span>
              <select
                value={selectedYear}
                onChange={e => {
                  setSelectedYear(Number(e.target.value));
                  setActivePageIndex(0);
                }}
                className="bg-transparent text-xs font-black text-amber-300 focus:outline-none cursor-pointer"
              >
                {availableYears.map(y => (
                  <option key={y} value={y} className="bg-slate-900 text-white">
                    {y}م
                  </option>
                ))}
              </select>
            </div>

            {/* Weekly Sub-selector */}
            {periodType === 'weekly' && (
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedWeekMode('current_week')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                    selectedWeekMode === 'current_week' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  الأسبوع الحالي
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedWeekMode('last_week')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                    selectedWeekMode === 'last_week' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  الأسبوع السابق
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedWeekMode('month_all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                    selectedWeekMode === 'month_all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  كامل الشهر المختار
                </button>
              </div>
            )}

            {/* Month Sub-selector (for monthly or weekly month_all) */}
            {(periodType === 'monthly' || (periodType === 'weekly' && selectedWeekMode === 'month_all')) && (
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
                <span className="text-[11px] font-bold text-slate-400">الشهر:</span>
                <select
                  value={selectedMonthNum}
                  onChange={e => {
                    setSelectedMonthNum(Number(e.target.value));
                    setActivePageIndex(0);
                  }}
                  className="bg-transparent text-xs font-black text-emerald-300 focus:outline-none cursor-pointer"
                >
                  {ARABIC_MONTHS.map(m => (
                    <option key={m.num} value={m.num} className="bg-slate-900 text-white">
                      {m.num} - {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quarter Sub-selector */}
            {periodType === 'quarterly' && (
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {([1, 2, 3, 4] as const).map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setSelectedQuarter(q);
                      setActivePageIndex(0);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                      selectedQuarter === q ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    الربع {q === 1 ? 'الأول' : q === 2 ? 'الثاني' : q === 3 ? 'الثالث' : 'الرابع'}
                  </button>
                ))}
              </div>
            )}

            {/* Semi-Annual Sub-selector */}
            {periodType === 'semi_annual' && (
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHalf(1);
                    setActivePageIndex(0);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                    selectedHalf === 1 ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  النصف الأول (يناير - يونيو)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHalf(2);
                    setActivePageIndex(0);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                    selectedHalf === 2 ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  النصف الثاني (يوليو - ديسمبر)
                </button>
              </div>
            )}

            {/* Office Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <select
                value={officeFilter}
                onChange={e => {
                  setOfficeFilter(e.target.value);
                  setActivePageIndex(0);
                }}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-white">
                  كافة المكاتب الفرعية
                </option>
                {offices.map(off => (
                  <option key={off.id} value={off.name} className="bg-slate-900 text-white">
                    {off.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Contractor Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={contractorSearch}
                onChange={e => {
                  setContractorSearch(e.target.value);
                  setActivePageIndex(0);
                }}
                placeholder="بحث باسم المقاول..."
                className="bg-slate-950 border border-slate-800 rounded-xl pr-8 pl-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-40"
              />
            </div>
          </div>
        </div>

        {/* Status / Notification Strip */}
        {(statusMessage || errorMessage) && (
          <div
            className={`px-6 py-2 text-xs font-bold flex items-center justify-between ${
              errorMessage ? 'bg-rose-950/90 text-rose-200 border-b border-rose-800' : 'bg-emerald-950/90 text-emerald-200 border-b border-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {errorMessage ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              <span>{errorMessage || statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setStatusMessage(null);
                setErrorMessage(null);
              }}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Pagination Switcher if multiple A4 pages */}
        {totalReportPages > 1 && (
          <div className="px-6 py-2 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 shrink-0">
            <span className="font-bold">
              تم تقسيم التقرير تلقائياً إلى ({totalReportPages}) صفحات A4 لضمان عدم انقطاع أي سطر أو نص:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={activePageIndex === 0}
                onClick={() => setActivePageIndex(p => Math.max(0, p - 1))}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span>الصفحة السابقة</span>
              </button>
              <span className="font-mono font-black text-amber-300 px-2">
                صفحة {activePageIndex + 1} من {totalReportPages}
              </span>
              <button
                type="button"
                disabled={activePageIndex >= totalReportPages - 1}
                onClick={() => setActivePageIndex(p => Math.min(totalReportPages - 1, p + 1))}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <span>الصفحة التالية</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Scrollable Stage for A4 Landscape Printable Sheets (Exact 1123x794 px per page) */}
        <div className="flex-1 overflow-auto bg-slate-950/90 p-4 sm:p-6 flex flex-col items-center gap-6">
          <div id="contractor-closure-export-stage" ref={reportStageRef} className="flex flex-col items-center gap-8">
            {paginatedContractorChunks.map((pageRows, pIdx) => {
              const isFirstPage = pIdx === 0;
              return (
                <div
                  key={pIdx}
                  className="export-page-sheet bg-white text-slate-900 shadow-2xl rounded-sm"
                  style={{
                    width: '1123px',
                    minWidth: '1123px',
                    maxWidth: '1123px',
                    height: '794px',
                    minHeight: '794px',
                    maxHeight: '794px',
                    padding: '22px 28px',
                    boxSizing: 'border-box',
                    fontFamily: "'Cairo', 'Tajawal', sans-serif",
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    overflow: 'hidden',
                    direction: 'rtl'
                  }}
                >
                  {/* Top Content Wrapper */}
                  <div className="flex flex-col gap-3">
                    
                    {/* Official Header Strictly Conforming to User Requirements */}
                    <div className="bg-[#002855] text-white border-b-3 border-[#F58220] px-4 py-2.5 rounded-t-xl flex items-center justify-between gap-4">
                      {/* Right: Platform Header with Graded Typography */}
                      <div className="text-right flex flex-col gap-0.5">
                        <span className="text-sm sm:text-base font-black text-white leading-tight">
                          حوكمة جودة اعمال الانشاءات
                        </span>
                        <span className="text-xs sm:text-[13px] font-bold text-[#FDB813] leading-tight">
                          منظومة ادارة كهرباء الحدود الشمالية
                        </span>
                        <span className="text-[11px] font-semibold text-blue-200 leading-tight">
                          المساندة الفنية
                        </span>
                      </div>

                      <div className="text-center">
                        <h2 className="text-xs sm:text-sm font-black text-[#FDB813]">
                          إغلاقات المقاولين
                        </h2>
                      </div>

                      <div className="text-left font-mono text-xs font-bold text-white">
                        التاريخ: {new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}
                      </div>
                    </div>

                    {/* ( مؤشرات الاداء ) */}
                    {isFirstPage && (
                      <div>
                        <div className="text-[11px] font-black text-slate-900 mb-1.5 text-center">
                          ( مؤشرات الاداء )
                        </div>
                        <div className="grid grid-cols-5 gap-2.5">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-bold text-slate-500">إجمالي المقاولين</div>
                            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                              {summaryKpis.contractorsCount}
                            </div>
                            <div className="text-[9.5px] font-bold text-slate-600">مقاول خاضع للتقييم</div>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center font-black">
                            <Users className="w-4 h-4" />
                          </div>
                        </div>

                        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-bold text-blue-800">إجمالي أوامر العمل</div>
                            <div className="text-xl font-black text-blue-950 font-mono mt-0.5">
                              {summaryKpis.totalOrders}
                            </div>
                            <div className="text-[9.5px] font-bold text-blue-700">أمر عمل مسجل بالفترة</div>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                        </div>

                        <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-2.5 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-bold text-emerald-900">مؤهل للإغلاق (معتمد 155)</div>
                            <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">
                              {summaryKpis.totalClosed}
                            </div>
                            <div className="text-[9.5px] font-bold text-emerald-800">أمر عمل مغلق ومعتمد</div>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        </div>

                        <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-2.5 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-bold text-rose-900">غير مؤهل للإغلاق (متبقي)</div>
                            <div className="text-xl font-black text-rose-700 font-mono mt-0.5">
                              {summaryKpis.totalNotClosed}
                            </div>
                            <div className="text-[9.5px] font-bold text-rose-800">قيد استيفاء الملاحظات</div>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                        </div>

                        <div className="bg-gradient-to-l from-slate-900 to-emerald-950 text-white rounded-xl p-2.5 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-bold text-emerald-300">النسبة العامة لإنجاز الإغلاقات</div>
                            <div className="text-xl font-black text-amber-300 font-mono mt-0.5">
                              {summaryKpis.overallClosureRate}%
                            </div>
                            <div className="text-[9.5px] font-bold text-slate-200 truncate max-w-[140px]">
                              الأول: {summaryKpis.topContractor ? summaryKpis.topContractor.contractor : '—'}
                            </div>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-white/10 text-amber-300 flex items-center justify-center">
                            <Award className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                    {/* Main Contractors Closure Comparison Table */}
                    <div className="border border-slate-300 rounded-xl overflow-hidden">
                      <div className="bg-[#002855] text-white border-b-2 border-[#F58220] px-3.5 py-1.5 flex items-center justify-between text-xs font-black">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-[#FDB813]" />
                          <span>جدول ترتيب ومقارنة المقاولين في المكاتب حسب نسبة إنجاز الإغلاقات</span>
                        </div>
                        <span className="text-[10px] text-[#FDB813] font-mono">
                          إجمالي المقاولين بالتقرير: {contractorStats.length} مقاول
                        </span>
                      </div>

                      <table className="w-full border-collapse text-right" style={{ tableLayout: 'fixed' }}>
                        <thead>
                          <tr className="bg-slate-100 border-b-2 border-slate-300 text-[10.5px] font-black text-slate-800">
                            <th className="py-2 px-2 text-center border-l border-slate-200" style={{ width: '5%' }}>
                              #
                            </th>
                            <th className="py-2 px-2.5 text-right border-l border-slate-200" style={{ width: '20%' }}>
                              اسم المقاول المنفذ
                            </th>
                            <th className="py-2 px-2.5 text-right border-l border-slate-200" style={{ width: '19%' }}>
                              المكاتب الفرعية العاملة
                            </th>
                            <th className="py-2 px-2 text-center border-l border-slate-200" style={{ width: '8%' }}>
                              إجمالي الأوامر
                            </th>
                            <th className="py-2 px-2 text-center border-l border-slate-200 bg-emerald-50/60 text-emerald-900" style={{ width: '9%' }}>
                              مغلق معتمد 155
                            </th>
                            <th className="py-2 px-2 text-center border-l border-slate-200 bg-rose-50/60 text-rose-900" style={{ width: '9%' }}>
                              غير مغلق (متبقي)
                            </th>
                            <th className="py-2 px-2.5 text-center border-l border-slate-200" style={{ width: '16%' }}>
                              نسبة إنجاز الإغلاقات %
                            </th>
                            <th className="py-2 px-2 text-center border-l border-slate-200" style={{ width: '6%' }}>
                              الصور %
                            </th>
                            <th className="py-2 px-2 text-center" style={{ width: '8%' }}>
                              مستوى الأداء
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-[10.5px]">
                          {pageRows.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-12 text-center text-slate-500 font-bold">
                                لا توجد أوامر عمل مسجلة للمقاولين في هذه الفترة الزمنية
                              </td>
                            </tr>
                          ) : (
                            pageRows.map((row, idx) => (
                              <tr
                                key={row.contractor}
                                className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}
                              >
                                <td className="py-1.5 px-2 text-center font-mono font-black text-slate-700 border-l border-slate-200">
                                  {row.rank === 1 ? '🥇 1' : row.rank === 2 ? '🥈 2' : row.rank === 3 ? '🥉 3' : row.rank}
                                </td>
                                <td className="py-1.5 px-2.5 font-black text-slate-900 border-l border-slate-200 truncate">
                                  {row.contractor}
                                </td>
                                <td className="py-1.5 px-2.5 font-semibold text-slate-700 border-l border-slate-200 truncate">
                                  {row.officesDisplay}
                                </td>
                                <td className="py-1.5 px-2 text-center font-mono font-black text-slate-900 border-l border-slate-200">
                                  {row.total}
                                </td>
                                <td className="py-1.5 px-2 text-center font-mono font-black text-emerald-700 bg-emerald-50/40 border-l border-slate-200">
                                  {row.closed}
                                </td>
                                <td className="py-1.5 px-2 text-center font-mono font-black text-rose-700 bg-rose-50/40 border-l border-slate-200">
                                  {row.notClosed}
                                </td>
                                <td className="py-1.5 px-2.5 border-l border-slate-200">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          row.closureRate >= 75
                                            ? 'bg-emerald-600'
                                            : row.closureRate >= 50
                                            ? 'bg-amber-500'
                                            : 'bg-rose-600'
                                        }`}
                                        style={{ width: `${row.closureRate}%` }}
                                      />
                                    </div>
                                    <span
                                      className={`font-mono font-black text-[11px] min-w-[36px] text-left ${
                                        row.closureRate >= 75
                                          ? 'text-emerald-800'
                                          : row.closureRate >= 50
                                          ? 'text-amber-800'
                                          : 'text-rose-700'
                                      }`}
                                    >
                                      {row.closureRate}%
                                    </span>
                                  </div>
                                </td>
                                <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-700 border-l border-slate-200">
                                  {row.photoRate}%
                                </td>
                                <td className="py-1.5 px-1.5 text-center">
                                  <span
                                    className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black border truncate max-w-full ${row.tierClass}`}
                                  >
                                    {row.evaluation}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Office × Contractor Breakdown Strip (Shown when space permits on the sheet) */}
                    {officeContractorMatrix.length > 0 && pageRows.length <= 6 && (
                      <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/60">
                        <div className="text-[10.5px] font-black text-slate-800 mb-1.5 flex items-center justify-between">
                          <span>توزيع نسب إغلاق المقاولين داخل كل مكتب فرعي:</span>
                          <span className="text-[9.5px] text-slate-500 font-bold">
                            مقارنة مباشرة (المكتب × المقاول × نسبة الإغلاق)
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {officeContractorMatrix.slice(0, 8).map((item, idx) => (
                            <div
                              key={`${item.officeName}-${item.contractor}-${idx}`}
                              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-[10px]"
                            >
                              <div className="min-w-0 pr-1">
                                <div className="font-black text-slate-900 truncate">{item.contractor}</div>
                                <div className="text-[9px] text-slate-500 font-bold truncate">{item.officeName}</div>
                              </div>
                              <div className="text-left shrink-0 font-mono">
                                <div
                                  className={`font-black text-xs ${
                                    item.closureRate >= 70
                                      ? 'text-emerald-700'
                                      : item.closureRate >= 50
                                      ? 'text-amber-700'
                                      : 'text-rose-700'
                                  }`}
                                >
                                  {item.closureRate}%
                                </div>
                                <div className="text-[9px] text-slate-500">
                                  {item.closed}/{item.total} مغلق
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Official Page Footer: Strictly Page Number Only */}
                  <div className="border-t-2 border-slate-900 pt-1.5 text-center text-xs font-mono font-black text-slate-800 shrink-0">
                    رقم الصفحة: {pIdx + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
