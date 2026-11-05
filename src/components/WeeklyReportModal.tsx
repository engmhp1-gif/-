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
  Clock, 
  AlertTriangle, 
  Camera, 
  Share2, 
  Check, 
  Loader2, 
  FileText,
  Sliders,
  Sparkles,
  ShieldCheck,
  BarChart3,
  Zap,
  FileSpreadsheet,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Layers
} from 'lucide-react';
import { WorkOrder, SubOffice } from '../types';
import { 
  exportToPdf, 
  captureElementToImage, 
  exportWeeklyReportToExcel 
} from '../services/exportService';
import { soundService } from '../services/soundService';
import { UnifiedSectionExportBar } from './UnifiedSectionExportBar';
import { getEvaluatedSupportChecklistKeys } from './TechnicalSupportAuditModal';
import { isOrderQualified100InAllThreeAudits, getEffectiveProcedure155Status } from '../utils/auditTracker';

interface WeeklyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrders: WorkOrder[];
  offices: SubOffice[];
  selectedOffice?: string;
  onSelectOffice?: (officeName: string) => void;
  onOpenExportModal?: (orders: WorkOrder[], title: string, openEmail?: boolean) => void;
}

type ReportOrientation = 'auto' | 'landscape' | 'portrait';
type ReportLayoutMode = 'auto' | 'single' | 'multi';
type DensityMode = 'compact' | 'normal' | 'comfortable';

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({
  isOpen,
  onClose,
  workOrders,
  offices,
  selectedOffice = 'all',
  onSelectOffice,
  onOpenExportModal
}) => {
  // Weekly period selection
  const [selectedPeriod, setSelectedPeriod] = useState<'current_week' | 'last_week' | 'all'>('current_week');
  const [targetOfficeFilter, setTargetOfficeFilter] = useState<string>(selectedOffice || 'all');
  const [customNotes, setCustomNotes] = useState<string>(
    'يوصى بضرورة استكمال رفع الصور الميدانية للمواقع المتبقية ومعالجة ملاحظات الجودة المرصودة قبل رفع أوامر العمل لإجراء 155 النهائي.'
  );

  // Adaptive display configuration
  const [orientationMode, setOrientationMode] = useState<ReportOrientation>('auto');
  const [layoutMode, setLayoutMode] = useState<ReportLayoutMode>('auto');
  const [density, setDensity] = useState<DensityMode>('normal');
  const [activeViewPage, setActiveViewPage] = useState<number>(1);

  // Status & processing states
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isCopiedSummary, setIsCopiedSummary] = useState<boolean>(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reportContainerRef = useRef<HTMLDivElement>(null);

  // Compute Current Week Date Range
  const weekInfo = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sunday, 6 is Saturday
    // In Saudi work week (Sunday to Thursday)
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - currentDay);
    
    const thursday = new Date(sunday);
    thursday.setDate(sunday.getDate() + 4);

    const lastSunday = new Date(sunday);
    lastSunday.setDate(sunday.getDate() - 7);
    const lastThursday = new Date(lastSunday);
    lastThursday.setDate(lastSunday.getDate() + 4);

    const formatDate = (d: Date) => {
      return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(d);
    };

    // Week number of the year
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);

    return {
      currentWeekRange: `${formatDate(sunday)} - ${formatDate(thursday)}`,
      lastWeekRange: `${formatDate(lastSunday)} - ${formatDate(lastThursday)}`,
      currentWeekNumber: weekNumber,
      todayFormatted: formatDate(now),
      reportCode: `REP-WK-${now.getFullYear()}-${String(weekNumber).padStart(2, '0')}`
    };
  }, []);

  // Filter orders by office if selected
  const scopedOrders = useMemo(() => {
    if (targetOfficeFilter === 'all') return workOrders;
    return workOrders.filter(w => w.office === targetOfficeFilter);
  }, [workOrders, targetOfficeFilter]);

  // Overall statistics for the report
  const totalAudited = scopedOrders.length;
  
  const ready155Orders = useMemo(() => {
    return scopedOrders.filter(w => {
      const evalKeys = getEvaluatedSupportChecklistKeys(w);
      const s = String(w.procedure155Status || '').trim();
      const eff155 = getEffectiveProcedure155Status(w);
      return (
        isOrderQualified100InAllThreeAudits(w) ||
        (!eff155.includes('غير') && (eff155.includes('مؤهل') || eff155.includes('تم'))) ||
        (evalKeys.length > 0 && !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد')))
      );
    });
  }, [scopedOrders]);

  const pending155Orders = useMemo(() => {
    return scopedOrders.filter(w => {
      const evalKeys = getEvaluatedSupportChecklistKeys(w);
      const s = String(w.procedure155Status || '').trim();
      const eff155 = getEffectiveProcedure155Status(w);
      const hasAnyEval = evalKeys.length > 0 || Boolean(s && s !== 'قيد التدقيق' && s !== 'قيد التدقيق الفني') || Boolean(eff155);
      if (!hasAnyEval) return false;
      const isReady =
        isOrderQualified100InAllThreeAudits(w) ||
        (!eff155.includes('غير') && (eff155.includes('مؤهل') || eff155.includes('تم'))) ||
        (evalKeys.length > 0 && !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد')));
      return !isReady;
    });
  }, [scopedOrders]);

  const inProgressOrders = useMemo(() => {
    return scopedOrders.filter(w => 
      String(w.procedure155Status || 'قيد التدقيق').includes('تدقيق')
    );
  }, [scopedOrders]);

  const withPhotosOrders = useMemo(() => {
    return scopedOrders.filter(
      w =>
        (w.photos && w.photos.length > 0) ||
        (w.photosFile && w.photosFile.length > 0) ||
        String(w.attachmentStatus || '').includes('جاهز')
    );
  }, [scopedOrders]);

  const boqModOrders = useMemo(() => {
    return scopedOrders.filter(w =>
      Boolean(w.qualityNotes && String(w.qualityNotes).trim().length > 0 && String(w.qualityNotes).trim() !== '-')
    );
  }, [scopedOrders]);

  const readyRate = totalAudited > 0 ? Math.round((ready155Orders.length / totalAudited) * 100) : 0;
  const pendingRate = totalAudited > 0 ? Math.round((pending155Orders.length / totalAudited) * 100) : 0;
  const photoRate = totalAudited > 0 ? Math.round((withPhotosOrders.length / totalAudited) * 100) : 0;
  const boqRate = totalAudited > 0 ? Math.round((boqModOrders.length / totalAudited) * 100) : 0;

  // Breakdown statistics per sub-office
  const officeAchievements = useMemo(() => {
    const list = offices.map((office, idx) => {
      const officeOrders = workOrders.filter(w => w.office === office.name);
      const total = officeOrders.length;

      const ready = officeOrders.filter(w => 
        !String(w.procedure155Status || '').includes('غير') &&
        (String(w.procedure155Status || '').includes('مؤهل') || String(w.procedure155Status || '').includes('تم'))
      ).length;

      const pending = officeOrders.filter(w => 
        String(w.procedure155Status || '').includes('غير') ||
        String(w.procedure155Status || '').includes('معلق') || 
        String(w.procedure155Status || '').includes('نواقص') || 
        String(w.procedure155Status || '').includes('ملاحظات')
      ).length;

      const inProgress = officeOrders.filter(w => 
        String(w.procedure155Status || 'قيد التدقيق').includes('تدقيق')
      ).length;

      const withPhotos = officeOrders.filter(
        w =>
          (w.photos && w.photos.length > 0) ||
          (w.photosFile && w.photosFile.length > 0) ||
          String(w.attachmentStatus || '').includes('جاهز')
      ).length;
      const boqCount = officeOrders.filter(w => 
        Boolean(w.qualityNotes && String(w.qualityNotes).trim().length > 0 && String(w.qualityNotes).trim() !== '-')
      ).length;

      const completionRate = total > 0 ? Math.round((ready / total) * 100) : 0;
      const photosRate = total > 0 ? Math.round((withPhotos / total) * 100) : 0;

      // Quality score formula (0-100)
      const score = total > 0 ? Math.min(100, Math.round((completionRate * 0.6) + (photosRate * 0.4))) : 0;

      const evaluation = completionRate >= 75 
        ? 'متميز ★★★' 
        : completionRate >= 50 
        ? 'جيد جداً ★★' 
        : 'يحتاج متابعة';

      return {
        rank: idx + 1,
        officeId: office.id,
        officeName: office.name,
        code: office.code,
        region: office.region,
        total,
        ready,
        pending,
        inProgress,
        withPhotos,
        boqCount,
        completionRate,
        photosRate,
        score,
        evaluation
      };
    }).sort((a, b) => {
      // Sort by completion rate descending, then total descending
      if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate;
      return b.total - a.total;
    });

    // Re-assign rank after sorting
    return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [offices, workOrders]);

  // Top performing office
  const topOffice = officeAchievements[0] || null;

  // Smart Adaptive Orientation determination:
  // Default to Landscape in auto mode because the 9-column office comparison table
  // and multi-KPI strips fit with expansive clarity in landscape without any squeeze!
  const effectiveOrientation: 'landscape' | 'portrait' = useMemo(() => {
    if (orientationMode !== 'auto') {
      return orientationMode;
    }
    // With 9 table columns + KPI cards, landscape offers the ultimate zero-cutoff experience
    return 'landscape';
  }, [orientationMode]);

  // Smart Adaptive Layout Mode:
  // If set to auto: If offices > 6 or density is comfortable, multi-page layout ensures zero data is squished!
  const isMultiPage: boolean = useMemo(() => {
    if (layoutMode === 'single') return false;
    if (layoutMode === 'multi') return true;
    // In auto: If offices count > 6 and in portrait, multi-page is ideal. In landscape, 1 page holds up to 7-8 offices cleanly.
    if (effectiveOrientation === 'portrait' && officeAchievements.length > 5) return true;
    if (effectiveOrientation === 'landscape' && officeAchievements.length > 8) return true;
    return false;
  }, [layoutMode, effectiveOrientation, officeAchievements.length]);

  if (!isOpen) return null;

  // Export to PDF handler: captures all sheets (.export-page-sheet)
  const handleExportPdf = async () => {
    setIsExporting(true);
    setExportSuccessMessage(null);
    setErrorMessage(null);

    try {
      // Wait for layout stability
      await new Promise(resolve => setTimeout(resolve, 150));

      const container = document.getElementById('weekly-report-container');
      if (!container) {
        throw new Error('لم يتم العثور على حاوية التقرير الأسبوعي');
      }

      const sheets = Array.from(container.querySelectorAll<HTMLElement>('.export-page-sheet'));
      const targets = sheets.length > 0 ? sheets : [container];

      const officeTitle = targetOfficeFilter === 'all' ? 'كافة المكاتب' : targetOfficeFilter;
      const filename = `التقرير_الأسبوعي_${weekInfo.reportCode}_${officeTitle.replace(/\s+/g, '_')}.pdf`;

      await exportToPdf(
        targets,
        scopedOrders,
        officeTitle,
        filename,
        { 
          orientation: effectiveOrientation, 
          format: 'a4', 
          marginMm: 0 
        }
      );

      soundService.playActionSound('export');
      setExportSuccessMessage('تم تصدير التقرير الأسبوعي الشامل بصيغة PDF بنجاح باحتواء تكييفي كامل دون اقتطاع');
      setTimeout(() => setExportSuccessMessage(null), 4500);
    } catch (err: any) {
      console.error('Failed to export weekly report PDF:', err);
      setErrorMessage(err?.message || 'حدث خطأ أثناء تصدير ملف الـ PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to Excel handler
  const handleExportExcel = () => {
    setIsExporting(true);
    setErrorMessage(null);
    try {
      const officeTitle = targetOfficeFilter === 'all' ? 'كافة المكاتب' : targetOfficeFilter;
      const periodText = selectedPeriod === 'current_week' 
        ? weekInfo.currentWeekRange 
        : selectedPeriod === 'last_week' 
        ? weekInfo.lastWeekRange 
        : 'كافة الفترات المسجلة';

      exportWeeklyReportToExcel(
        {
          reportCode: weekInfo.reportCode,
          periodText,
          officeScope: officeTitle,
          totalAudited,
          readyCount: ready155Orders.length,
          readyRate,
          pendingCount: pending155Orders.length,
          pendingRate,
          photoCount: withPhotosOrders.length,
          photoRate,
          boqCount: boqModOrders.length,
          boqRate,
          topOffice: topOffice ? {
            name: topOffice.officeName,
            rate: topOffice.completionRate,
            score: topOffice.score
          } : null,
          officeAchievements: officeAchievements.map(o => ({
            rank: o.rank,
            officeName: o.officeName,
            code: o.code,
            total: o.total,
            ready: o.ready,
            pending: o.pending,
            completionRate: o.completionRate,
            photosRate: o.photosRate,
            boqCount: o.boqCount,
            score: o.score,
            evaluation: o.evaluation
          })),
          customNotes
        },
        `التقرير_الأسبوعي_${weekInfo.reportCode}_${officeTitle.replace(/\s+/g, '_')}.xlsx`
      );

      soundService.playActionSound('export');
      setExportSuccessMessage('تم تصدير سجل التقرير الأسبوعي بصيغة Excel بنجاح بكامل الجداول والـ KPI');
      setTimeout(() => setExportSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('حدث خطأ أثناء تصدير ملف الإكسل');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to Image handler
  const handleExportImage = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    try {
      const sheetId = isMultiPage ? `weekly-page-${activeViewPage}` : 'weekly-page-1';
      const el = document.getElementById(sheetId) || document.querySelector('.export-page-sheet') as HTMLElement;
      if (!el) throw new Error('صفحة المعاينة غير متاحة');

      const dataUrl = await captureElementToImage(el, 'png');
      const link = document.createElement('a');
      link.download = `التقرير_الأسبوعي_${weekInfo.reportCode}_صفحة_${isMultiPage ? activeViewPage : 1}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      soundService.playActionSound('export');
      setExportSuccessMessage('تم حفظ التقرير كصورة فائقة الدقة بنجاح');
      setTimeout(() => setExportSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage('حدث خطأ أثناء تصدير ملف الصورة');
    } finally {
      setIsExporting(false);
    }
  };

  // Direct print handler
  const handlePrint = () => {
    window.print();
  };

  // Copy Executive Summary text to clipboard
  const handleCopySummary = () => {
    const summaryText = `*حوكمة جودة أعمال الإنشاءات* ⚡
*التقرير الأسبوعي التنفيذي لإنجازات المكاتب الفرعية - إجراء 155*
رقم التقرير: ${weekInfo.reportCode}
الفترة: ${selectedPeriod === 'current_week' ? weekInfo.currentWeekRange : selectedPeriod === 'last_week' ? weekInfo.lastWeekRange : 'كافة الفترات'}
النطاق: ${targetOfficeFilter === 'all' ? 'كافة المكاتب الفرعية' : targetOfficeFilter}
------------------------------------
📊 مؤشرات الأداء القيادية (KPI):
• إجمالي أوامر العمل المفحوصة: ${totalAudited} أمر
• مؤهل للاغلاق ( معتمد ): ${ready155Orders.length} (${readyRate}%)
• غير مؤهل للأغلاق ومعلق: ${pending155Orders.length} (${pendingRate}%)
• نسبة التوثيق الميداني بالصور: ${photoRate}% (${withPhotosOrders.length} أمر)
• أوامر تتطلب تعديل المقايسة (BOQ): ${boqModOrders.length} (${boqRate}%)
🏆 المكتب المتصدر للأسبوع: ${topOffice ? `${topOffice.officeName} بنسبة إنجاز ${topOffice.completionRate}% وتقييم ${topOffice.score}/100` : 'لا يوجد'}
------------------------------------
(وثيقة رقمية معتمدة آلياً بنظام إجراء 155 دون الحاجة لتوقيع يدوي)`;

    navigator.clipboard.writeText(summaryText).then(() => {
      setIsCopiedSummary(true);
      setTimeout(() => setIsCopiedSummary(false), 2500);
    });
  };

  // Render Sub-Offices Comparison Table Component
  const renderSubOfficesTable = (isCompact = false) => {
    return (
      <div className="w-full overflow-hidden border-2 border-[#002855]/30 rounded-lg shadow-2xs">
        <table className="w-full table-fixed text-right border-collapse">
          <thead>
            <tr className="bg-[#002855] text-white font-black border-b-2 border-[#F58220]">
              <th className="p-2 text-center border-l border-[#1e3a8a] w-[6%] text-[11px] font-mono">
                #
              </th>
              <th className="p-2 border-l border-[#1e3a8a] w-[20%] text-[11px]">
                المكتب الفرعي
              </th>
              <th className="p-2 text-center border-l border-[#1e3a8a] w-[10%] text-[11px]">
                إجمالي الأوامر
              </th>
              <th className="p-2 text-center border-l border-[#1e3a8a] w-[12%] text-[11px] text-emerald-300">
                مؤهل للاغلاق (معتمد)
              </th>
              <th className="p-2 text-center border-l border-[#1e3a8a] w-[12%] text-[11px] text-rose-300">
                غير مؤهل للأغلاق
              </th>
              <th className="p-2 text-center border-l border-[#1e3a8a] w-[14%] text-[11px]">
                نسبة الإنجاز
              </th>
              <th className="p-2 text-center border-l border-[#1e3a8a] w-[10%] text-[11px] text-indigo-200">
                حالة الإرفاق والصور
              </th>
              <th className="p-2 text-center border-l border-[#1e3a8a] w-[9%] text-[11px]">
                ملاحظات الجودة
              </th>
              <th className="p-2 text-center w-[11%] text-[11px]">
                التقييم الإداري
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300 bg-white font-bold">
            {officeAchievements.map((item, idx) => {
              const isTop = idx === 0;
              const isEven = idx % 2 === 0;
              const rowBg = isTop 
                ? 'bg-amber-50/60 font-bold' 
                : isEven 
                ? 'bg-white' 
                : 'bg-slate-50/70';

              const padClass = density === 'compact' || isCompact 
                ? 'py-1 px-2 text-[10px]' 
                : density === 'comfortable' 
                ? 'py-2.5 px-2.5 text-xs' 
                : 'py-1.5 px-2 text-[11px]';

              return (
                <tr key={item.officeId} className={`${rowBg} hover:bg-amber-50/40 transition-colors`}>
                  <td className={`${padClass} text-center font-mono font-black text-slate-900 border-l border-slate-300`}>
                    {isTop ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-2xs">
                        1
                      </span>
                    ) : (
                      item.rank
                    )}
                  </td>
                  <td className={`${padClass} font-bold text-slate-900 border-l border-slate-300`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{item.officeName}</span>
                      <span className="text-[9px] text-slate-500 font-mono shrink-0">({item.code})</span>
                    </div>
                  </td>
                  <td className={`${padClass} text-center font-mono font-black text-slate-900 border-l border-slate-300`}>
                    {item.total}
                  </td>
                  <td className={`${padClass} text-center font-mono font-black text-emerald-800 bg-emerald-50/40 border-l border-slate-300`}>
                    {item.ready}
                  </td>
                  <td className={`${padClass} text-center font-mono font-black text-amber-800 bg-amber-50/40 border-l border-slate-300`}>
                    {item.pending}
                  </td>
                  <td className={`${padClass} text-center border-l border-slate-300`}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-mono font-bold">{item.completionRate}%</span>
                      <div className="w-12 bg-slate-200 rounded-full h-1.5 overflow-hidden block">
                        <div 
                          className={`h-full rounded-full ${item.completionRate >= 70 ? 'bg-emerald-600' : item.completionRate >= 40 ? 'bg-blue-600' : 'bg-amber-500'}`}
                          style={{ width: `${item.completionRate}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className={`${padClass} text-center font-mono font-bold text-indigo-900 border-l border-slate-300`}>
                    {item.photosRate}%
                  </td>
                  <td className={`${padClass} text-center font-mono font-bold text-slate-700 border-l border-slate-300`}>
                    {item.boqCount} أمر
                  </td>
                  <td className={`${padClass} text-center`}>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black leading-tight ${
                      item.completionRate >= 75
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : item.completionRate >= 50
                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      {item.evaluation}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900 text-[11px]">
              <td colSpan={2} className="p-2 text-right font-black border-l border-slate-300">
                الإجمالي العام للمنظومة
              </td>
              <td className="p-2 text-center font-mono font-black border-l border-slate-300">{totalAudited}</td>
              <td className="p-2 text-center font-mono font-black text-emerald-800 bg-emerald-50/60 border-l border-slate-300">
                {ready155Orders.length}
              </td>
              <td className="p-2 text-center font-mono font-black text-amber-800 bg-amber-50/60 border-l border-slate-300">
                {pending155Orders.length}
              </td>
              <td className="p-2 text-center font-mono font-black text-blue-800 border-l border-slate-300">
                {readyRate}%
              </td>
              <td className="p-2 text-center font-mono font-black text-indigo-900 border-l border-slate-300">
                {photoRate}%
              </td>
              <td className="p-2 text-center font-mono font-black border-l border-slate-300">
                {boqModOrders.length} أمر
              </td>
              <td className="p-2 text-center text-emerald-800 font-black">
                امتثال معتمد
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  // Render KPI Cards Component
  const renderKpiCards = (isCompact = false) => {
    return (
      <div className="space-y-2">
        <div className="text-xs font-black text-slate-900 flex items-center justify-between pb-1 border-b border-slate-200">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-emerald-700" />
            <span>( مؤشرات الاداء )</span>
          </div>
        </div>

        {/* 4 Major High-Impact Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Metric 1: Total Audited */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-right">
            <span className="text-[10px] font-bold text-slate-500 block">إجمالي أوامر العمل المدققة</span>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">{totalAudited}</div>
            <span className="text-[10px] text-slate-600 font-semibold">فحص ميداني شامل</span>
          </div>

          {/* Metric 2: Ready for 155 */}
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-right">
            <span className="text-[10px] font-bold text-emerald-800 block">مؤهل للاغلاق ( معتمد )</span>
            <div className="text-xl font-black text-emerald-700 font-mono mt-0.5 flex items-baseline gap-1">
              <span>{ready155Orders.length}</span>
              <span className="text-xs font-bold text-emerald-600">({readyRate}%)</span>
            </div>
            <span className="text-[10px] text-emerald-800 font-bold">مستوفٍ للاشتراطات الفنية</span>
          </div>

          {/* Metric 3: Pending Deficiencies */}
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-right">
            <span className="text-[10px] font-bold text-rose-800 block">غير مؤهل للأغلاق</span>
            <div className="text-xl font-black text-rose-700 font-mono mt-0.5 flex items-baseline gap-1">
              <span>{pending155Orders.length}</span>
              <span className="text-xs font-bold text-rose-600">({pendingRate}%)</span>
            </div>
            <span className="text-[10px] text-rose-800 font-bold">بانتظار معالجة المقاولين</span>
          </div>

          {/* Metric 4: Photo Compliance */}
          <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-right">
            <span className="text-[10px] font-bold text-indigo-800 block">نسبة التوثيق الفوتوغرافي</span>
            <div className="text-xl font-black text-indigo-700 font-mono mt-0.5 flex items-baseline gap-1">
              <span>{photoRate}%</span>
              <span className="text-[10px] text-indigo-600 font-normal">({withPhotosOrders.length} أمر)</span>
            </div>
            <span className="text-[10px] text-indigo-800 font-bold">صور قبل وأثناء وبعد</span>
          </div>
        </div>

        {/* Secondary KPI Strip: Quality Notes & Field Readiness */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
          <div className="p-1.5 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-between px-3">
            <span className="text-[10px] font-bold text-purple-900">ملاحظات الجودة (qualityNotes):</span>
            <span className="font-mono font-black text-purple-950">{boqModOrders.length} أمر ({boqRate}%)</span>
          </div>
          <div className="p-1.5 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-between px-3">
            <span className="text-[10px] font-bold text-teal-900">أوامر قيد التنفيذ:</span>
            <span className="font-mono font-black text-teal-950">{inProgressOrders.length} أمر</span>
          </div>
          <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between px-3 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-blue-900">المكاتب النشطة:</span>
            <span className="font-mono font-black text-blue-950">{offices.length} مكاتب فرعية</span>
          </div>
        </div>
      </div>
    );
  };

  // Render Top Office Banner Component
  const renderTopOfficeBanner = () => {
    if (!topOffice) return null;
    return (
      <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border border-amber-300 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
            <Award className="w-5 h-5 text-amber-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                المكتب الأكثر إنجازاً وتميزاً للأسبوع
              </span>
              <strong className="text-xs sm:text-sm font-black text-slate-900">
                {topOffice.officeName}
              </strong>
            </div>
            <p className="text-[10px] text-slate-700 font-semibold mt-0.5">
              حقق نسبة إنجاز معتمدة لإجراء 155 بلغت <strong>{topOffice.completionRate}%</strong> بنسبة توثيق ميداني <strong>{topOffice.photosRate}%</strong>
            </p>
          </div>
        </div>

        <div className="text-left font-mono shrink-0">
          <span className="text-xs font-black text-amber-900 bg-white px-2.5 py-1 rounded-lg border border-amber-300 shadow-2xs">
            تقييم الأداء {topOffice.score}/100
          </span>
        </div>
      </div>
    );
  };

  // Render Administrative Recommendations Component
  const renderRecommendations = () => {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
        <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>ثالثاً: التوصيات والتوجيهات الإدارية المعتمدة للأسبوع</span>
        </div>
        <ul className="text-[10px] sm:text-[11px] text-slate-700 list-disc list-inside space-y-1 leading-relaxed font-medium">
          <li>
            <strong>التوثيق الميداني:</strong> التأكيد على المقاولين باستكمال رفع صور الموقع لجميع الأوامر المتبقية والبالغة ({scopedOrders.length - withPhotosOrders.length}) أمراً لتفادي تعليق المستحقات.
          </li>
          <li>
            <strong>ملاحظات الجودة المرصودة:</strong> تم رصد ({boqModOrders.length}) أمراً تحتوي على ملاحظات جودة فنية مسجلة في عمود (ملاحظات الجودة)، ويتعين استيفاؤها بالتنسيق مع المقاول والاستشاري المختص.
          </li>
          <li>
            <strong>الجاهزية للإغلاق (معتمد):</strong> الأوامر المؤهلة للإغلاق وعددها ({ready155Orders.length}) تم استيفاء محاضر تدقيقها بالكامل ومعتمدة للإغلاق والاستلام النهائي.
          </li>
        </ul>

        {/* Editable Custom Directive */}
        <div className="pt-2 border-t border-slate-200 print:hidden">
          <label className="block text-[10px] font-bold text-slate-600 mb-1">
            توجيهات إضافية من الإدارة المشرفة (تظهر في المستند المطبوع):
          </label>
          <textarea
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
            rows={2}
            placeholder="أدخل أي توجيهات أو قرارات إدارية خاصة لترفق بالتقرير المطبوع..."
          />
        </div>

        {/* Print-only custom note render */}
        {customNotes && (
          <div className="hidden print:block pt-2 border-t border-slate-200">
            <span className="text-[10px] font-bold text-slate-900 block">توجيهات الإدارة المشرفة:</span>
            <p className="text-[10px] text-slate-800 mt-0.5">{customNotes}</p>
          </div>
        )}
      </div>
    );
  };

  // Render Document Header Strictly Conforming to User Requirements
  const renderDocHeader = (pageNumber = 1, totalPages = 1) => {
    return (
      <div className="bg-[#002855] text-white border-b-3 border-[#F58220] px-4 py-2.5 rounded-t-xl mb-3">
        <div className="flex items-center justify-between gap-4 py-1">
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

          {/* Center: Concise Table Name */}
          <div className="text-center">
            <h3 className="text-xs sm:text-sm font-black text-[#FDB813]">
              التقرير الأسبوعي
            </h3>
          </div>

          {/* Left: Date Only */}
          <div className="text-left text-xs font-mono font-bold text-white">
            التاريخ: {new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}
          </div>
        </div>
      </div>
    );
  };

  // Render Document Footer / Page Number Only
  const renderDocFooter = (pageNumber = 1, _totalPages = 1) => {
    return (
      <div className="mt-3 pt-2 border-t-2 border-slate-900 text-center text-xs text-slate-800 font-mono font-black shrink-0">
        رقم الصفحة: {pageNumber}
      </div>
    );
  };

  const totalPages = isMultiPage ? 2 : 1;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-1 sm:p-3 overflow-y-auto font-['Cairo',sans-serif] print:p-0 print:bg-white print:static"
      dir="rtl"
    >
      {/* High-Precision Printing CSS: Guarantees clean page breaks and zero cutoff */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #weekly-report-container, #weekly-report-container * {
            visibility: visible !important;
          }
          #weekly-report-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .export-page-sheet {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            page-break-after: always !important;
            break-after: page !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            height: 100% !important;
            min-height: 100% !important;
            margin: 0 !important;
            padding: 4mm !important;
            box-sizing: border-box !important;
          }
          @page {
            size: ${effectiveOrientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
            margin: 4mm;
          }
        }
      `}</style>

      <div 
        className="bg-white w-full max-w-7xl max-h-[94vh] rounded-2xl shadow-2xl border-2 border-[#F58220]/70 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-right print:border-none print:shadow-none print:rounded-none"
      >
        {/* Top Header & Export Actions Toolbar */}
        <div className="bg-gradient-to-l from-[#002855] via-[#003B73] to-[#004B8D] text-white px-4 py-3 sm:px-6 sm:py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b-2 border-[#F58220] shrink-0 print:hidden">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <FileDown className="w-5 h-5 text-emerald-400 shrink-0" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                تصدير التقرير الأسبوعي التنفيذي
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 text-[11px] font-bold">
                احتواء كامل: الجداول + البطاقات + KPI بنسبة 100%
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              تصدير إداري متكيف تلقائياً (أفقي ورأسي) يمنع قص أي صف أو عمود، مع حفظ كامل بيانات المؤشرات وتصنيف المكاتب
            </p>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Unified WorkOrdersTable-Style Export Hub */}
            <UnifiedSectionExportBar
              orders={scopedOrders}
              sectionTitle={`التقرير_الأسبوعي_${targetOfficeFilter === 'all' ? 'جميع_المكاتب' : targetOfficeFilter}`}
              captureSelector="#weekly-report-container"
              onOpenExportModal={onOpenExportModal}
            />

            {/* 1. Export PDF Button */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md transition-all hover:scale-102 disabled:opacity-50 cursor-pointer ring-2 ring-emerald-400/40"
              title="تصدير التقرير الأسبوعي كاملاً كملف PDF متكيف"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>تصدير PDF الشامل ({effectiveOrientation === 'landscape' ? 'أفقي' : 'رأسي'} - {totalPages} صفحة)</span>
            </button>

            {/* 2. Export Excel Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              title="تصدير التقرير كجدول Excel منسق مع بطاقات الـ KPI وتصنيف المكاتب"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>تصدير Excel</span>
            </button>

            {/* 3. Export Image Button */}
            <button
              type="button"
              onClick={handleExportImage}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              title="تصدير كصورة PNG عالية الدقة"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>تصدير صورة</span>
            </button>

            {/* 4. Copy Summary Text */}
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-colors cursor-pointer border border-slate-700"
              title="نسخ ملخص تنفيذي للمشاركة السريعة"
            >
              {isCopiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-slate-400" />}
              <span>{isCopiedSummary ? 'تم النسخ!' : 'نسخ النص'}</span>
            </button>

            {/* 5. Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-colors cursor-pointer border border-slate-700"
              title="طباعة فورية"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors mr-1 cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Adaptive Controls Bar (Orientation, Layout Mode, Period, Scope) */}
        <div className="bg-slate-100 px-4 py-2 sm:px-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 print:hidden shrink-0">
          <div className="flex items-center flex-wrap gap-2 sm:gap-3">
            
            {/* Smart Adaptive Orientation Selector */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 px-1.5">الاتجاه:</span>
              <button
                type="button"
                onClick={() => setOrientationMode('auto')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                  orientationMode === 'auto'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
                title="تلقائي: يحدد الاتجاه الأنسب لاحتواء كافة الأعمدة بدون قص"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>تلقائي</span>
              </button>

              <button
                type="button"
                onClick={() => setOrientationMode('landscape')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                  orientationMode === 'landscape'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>🔄 أفقي (موصى به للجدول)</span>
              </button>

              <button
                type="button"
                onClick={() => setOrientationMode('portrait')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                  orientationMode === 'portrait'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>📄 رأسي</span>
              </button>
            </div>

            {/* Layout Mode (Single vs Multi-page) */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 px-1.5">التقسيم:</span>
              <button
                type="button"
                onClick={() => setLayoutMode('auto')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  layoutMode === 'auto' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="تقسيم تلقائي حسب حجم البيانات"
              >
                تلقائي ({totalPages} ص)
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('single')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  layoutMode === 'single' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                صفحة شاملة موحدة
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('multi')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  layoutMode === 'multi' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                صفحتين مفصلتين
              </button>
            </div>

            {/* Density Control */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 px-1.5">الكثافة:</span>
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className={`px-2 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                  density === 'compact' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                مضغوط
              </button>
              <button
                type="button"
                onClick={() => setDensity('normal')}
                className={`px-2 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                  density === 'normal' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                افتراضي
              </button>
              <button
                type="button"
                onClick={() => setDensity('comfortable')}
                className={`px-2 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                  density === 'comfortable' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                مريح
              </button>
            </div>
          </div>

          {/* Period & Scope Selectors */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-slate-300">
              <span className="font-bold text-slate-500 text-[11px]">الفترة:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
              >
                <option value="current_week">الأسبوع الحالي ({weekInfo.currentWeekRange})</option>
                <option value="last_week">الأسبوع الماضي ({weekInfo.lastWeekRange})</option>
                <option value="all">كافة الفترات المسجلة</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-slate-300">
              <span className="font-bold text-slate-500 text-[11px]">المكتب:</span>
              <select
                value={targetOfficeFilter}
                onChange={(e) => setTargetOfficeFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
              >
                <option value="all">كافة المكاتب الفرعية ({offices.length})</option>
                {offices.map(o => (
                  <option key={o.id} value={o.name}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Processing and Success Notification Banners */}
        {isExporting && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-xs text-blue-900 flex items-center justify-center gap-2 font-bold animate-pulse shrink-0">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>جاري معالجة وتصدير كافة بيانات التقرير الأسبوعي والجداول والـ KPI باحتواء كامل...</span>
          </div>
        )}

        {exportSuccessMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-800 flex items-center justify-between animate-in fade-in shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{exportSuccessMessage}</span>
            </div>
            <button onClick={() => setExportSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900 text-xs cursor-pointer">
              إغلاق
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs text-rose-900 flex items-center justify-between gap-2 font-bold animate-in fade-in shrink-0">
            <div className="flex items-center gap-2">
              <X className="w-4 h-4 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-700 hover:text-rose-900 text-xs cursor-pointer">
              إغلاق
            </button>
          </div>
        )}

        {/* Printable/Exportable Document Canvas */}
        <div className="flex-1 overflow-auto p-3 sm:p-6 bg-slate-200/90 flex flex-col items-center gap-6 print:p-0 print:bg-white print:max-h-none print:overflow-visible">
          <div 
            id="weekly-report-container"
            ref={reportContainerRef}
            className="w-full flex flex-col items-center gap-6 print:gap-0"
          >
            {/* MODE A: Single Comprehensive Sheet (When not multi-page) */}
            {!isMultiPage && (
              <div
                id="weekly-page-1"
                className="export-page-sheet bg-white rounded-xl shadow-xl border border-slate-300 text-slate-900 box-border flex flex-col justify-between transition-all print:shadow-none print:border-none print:rounded-none"
                style={{
                  width: effectiveOrientation === 'landscape' ? '1123px' : '794px',
                  minWidth: effectiveOrientation === 'landscape' ? '1123px' : '794px',
                  maxWidth: effectiveOrientation === 'landscape' ? '1123px' : '794px',
                  height: effectiveOrientation === 'landscape' ? '794px' : '1123px',
                  minHeight: effectiveOrientation === 'landscape' ? '794px' : '1123px',
                  maxHeight: effectiveOrientation === 'landscape' ? '794px' : '1123px',
                  padding: effectiveOrientation === 'landscape' ? '16px 22px' : '20px 18px',
                  boxSizing: 'border-box',
                  overflow: 'hidden'
                }}
              >
                {/* 1. Top Section: Header & KPIs */}
                <div className="w-full">
                  {renderDocHeader(1, 1)}

                  {/* 2. Executive Leadership Cards (KPI) */}
                  <div className="mb-1.5">
                    {renderKpiCards(true)}
                  </div>

                  {/* 3. Top Performing Office Banner */}
                  <div className="mb-1.5">
                    {renderTopOfficeBanner()}
                  </div>
                </div>

                {/* 4. Middle Section: Sub-Offices Achievement Breakdown Table */}
                <div className="w-full flex-1 flex flex-col justify-start my-1 min-h-0 overflow-hidden">
                  <div className="text-xs font-black text-slate-900 mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-emerald-700" />
                      <span>ثانياً: جدول إنجازات وتصنيف المكاتب الفرعية ومقارنة الأداء (إجراء 155)</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">مرتبة تنازلياً حسب نسبة الإنجاز والاعتماد</span>
                  </div>
                  {renderSubOfficesTable(true)}

                  {/* 5. Administrative Recommendations & Directives */}
                  <div className="mt-1.5">
                    {renderRecommendations()}
                  </div>
                </div>

                {/* 6. Bottom Section: Official Digital Certification Footnote */}
                <div className="w-full mt-auto shrink-0">
                  {renderDocFooter(1, 1)}
                </div>
              </div>
            )}

            {/* MODE B: Multi-Page Mode (Page 1 of 2 + Page 2 of 2) */}
            {isMultiPage && (
              <>
                {/* Sheet 1: Executive KPI Dashboard & Leadership Highlights */}
                <div
                  id="weekly-page-1"
                  className="export-page-sheet bg-white rounded-xl shadow-xl border border-slate-300 text-slate-900 box-border flex flex-col justify-between transition-all print:shadow-none print:border-none print:rounded-none"
                  style={{
                    width: effectiveOrientation === 'landscape' ? '1123px' : '794px',
                    minWidth: effectiveOrientation === 'landscape' ? '1123px' : '794px',
                    maxWidth: effectiveOrientation === 'landscape' ? '1123px' : '794px',
                    height: effectiveOrientation === 'landscape' ? '794px' : '1123px',
                    minHeight: effectiveOrientation === 'landscape' ? '794px' : '1123px',
                    maxHeight: effectiveOrientation === 'landscape' ? '794px' : '1123px',
                    padding: effectiveOrientation === 'landscape' ? '18px 24px' : '22px 20px',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                  }}
                >
                  <div className="w-full">
                    {/* Header */}
                    {renderDocHeader(1, 2)}

                    {/* Executive KPI Cards */}
                    <div className="mb-3">
                      {renderKpiCards()}
                    </div>

                    {/* Top Office Honor Banner */}
                    <div className="mb-3">
                      {renderTopOfficeBanner()}
                    </div>
                  </div>

                  {/* Key Highlights & Executive Insights Box */}
                  <div className="w-full flex-1 flex flex-col justify-center my-2 min-h-0 overflow-hidden">
                    <div className="bg-gradient-to-br from-slate-50 to-emerald-50/40 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="text-xs font-black text-slate-900 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-700" />
                        <span>المؤشرات والنتائج التنفيذية للأسبوع:</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                        <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                          <span className="font-bold text-slate-900 block">جاهزية الامتثال (إجراء 155):</span>
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            تم اعتماد وتأهيل ({ready155Orders.length}) أمراً من أصل ({totalAudited}) أمراً مدققاً بنسبة نجاح بلغت ({readyRate}%).
                          </p>
                        </div>
                        <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                          <span className="font-bold text-slate-900 block">التوثيق والملاحظات الفنية:</span>
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            بلغت نسبة التوثيق الفوتوغرافي ({photoRate}%)، بينما يتبقى ({pending155Orders.length}) أمراً معلقاً بانتظار استيفاء النواقص من المقاولين.
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 italic text-center">
                        (انتقل إلى الصفحة التالية للاطلاع على جدول تصنيف كافة المكاتب الفرعية والتوصيات الإدارية)
                      </p>
                    </div>
                  </div>

                  {/* Footer 1 */}
                  <div className="w-full mt-auto shrink-0">
                    {renderDocFooter(1, 2)}
                  </div>
                </div>

                {/* Sheet 2: Sub-Offices Comparison Table & Administrative Recommendations */}
                <div
                  id="weekly-page-2"
                  className="export-page-sheet bg-white rounded-xl shadow-xl border border-slate-300 text-slate-900 box-border flex flex-col justify-between transition-all print:shadow-none print:border-none print:rounded-none"
                  style={{
                    width: effectiveOrientation === 'landscape' ? '1123px' : '794px',
                    minWidth: effectiveOrientation === 'landscape' ? '1123px' : '794px',
                    maxWidth: effectiveOrientation === 'landscape' ? '1123px' : '794px',
                    height: effectiveOrientation === 'landscape' ? '794px' : '1123px',
                    minHeight: effectiveOrientation === 'landscape' ? '794px' : '1123px',
                    maxHeight: effectiveOrientation === 'landscape' ? '794px' : '1123px',
                    padding: effectiveOrientation === 'landscape' ? '18px 24px' : '22px 20px',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                  }}
                >
                  <div className="w-full">
                    {/* Header Sheet 2 */}
                    {renderDocHeader(2, 2)}
                  </div>

                  {/* Sub-Offices Table & Recommendations */}
                  <div className="w-full flex-1 flex flex-col justify-start my-1.5 min-h-0 overflow-hidden">
                    <div className="mb-2">
                      <div className="text-xs font-black text-slate-900 mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-emerald-700" />
                          <span>ثانياً: جدول تصنيف ومقارنة أداء المكاتب الفرعية (كامل التفاصيل)</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">
                          كافة المكاتب الفرعية • مرتبة تنازلياً حسب الإنجاز
                        </span>
                      </div>
                      {renderSubOfficesTable()}
                    </div>

                    {/* Recommendations */}
                    <div className="mt-1">
                      {renderRecommendations()}
                    </div>
                  </div>

                  {/* Footer 2 */}
                  <div className="w-full mt-auto shrink-0">
                    {renderDocFooter(2, 2)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
