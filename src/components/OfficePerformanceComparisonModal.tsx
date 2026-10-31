import React, { useState, useMemo, useRef } from 'react';
import { 
  X, 
  Award, 
  TrendingUp, 
  Building2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Camera, 
  FileEdit, 
  ChevronRight, 
  SlidersHorizontal, 
  FileSpreadsheet, 
  ArrowUpDown, 
  Sparkles,
  BarChart3,
  Layers,
  FileText,
  Eye,
  Download,
  Printer,
  Image as ImageIcon,
  Check,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  Zap,
  Sliders,
  Maximize2
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import * as XLSX from 'xlsx';
import { WorkOrder, SubOffice, ColumnDefinition } from '../types';
import { exportToExcel, captureElementToImage, exportToPdf, exportToPptx } from '../services/exportService';
import { soundService } from '../services/soundService';
import { UnifiedSectionExportBar } from './UnifiedSectionExportBar';

interface OfficePerformanceComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrders: WorkOrder[];
  offices: SubOffice[];
  columns?: ColumnDefinition[];
  onSelectOfficeAndFilter: (officeName: string) => void;
  onOpenWeeklyReport: () => void;
  onOpenExportOrders?: (orders: WorkOrder[], title: string, openEmail?: boolean) => void;
}

type SortField = 'score' | 'completionRate' | 'total' | 'photosRate' | 'pending' | 'inProgress';
type ChartViewMode = 'stacked' | 'grouped' | 'rates';
type TabView = 'dashboard' | 'chart' | 'statement' | 'export_preview';

export const OfficePerformanceComparisonModal: React.FC<OfficePerformanceComparisonModalProps> = ({
  isOpen,
  onClose,
  workOrders,
  offices,
  columns,
  onSelectOfficeAndFilter,
  onOpenWeeklyReport,
  onOpenExportOrders
}) => {
  const [activeTab, setActiveTab] = useState<TabView>('dashboard');
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('stacked');
  const [sortBy, setSortBy] = useState<SortField>('score');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  // Print/Export container ref
  const printableReportRef = useRef<HTMLDivElement>(null);

  // Total system counts
  const totalSystemOrders = workOrders.length;

  // Process detailed comparison metrics per office
  const processedOffices = useMemo(() => {
    return offices.map(office => {
      const officeOrders = workOrders.filter(w => w.office === office.name);
      const total = officeOrders.length;

      // Status 1: Ready / Received for Procedure 155
      const ready = officeOrders.filter(w => 
        String(w.procedure155Status).includes('مؤهل') || String(w.procedure155Status).includes('تم')
      ).length;

      // Status 2: Pending Deficiencies & Notes
      const pending = officeOrders.filter(w => 
        String(w.procedure155Status).includes('معلق') || 
        String(w.procedure155Status).includes('نواقص') || 
        String(w.procedure155Status).includes('ملاحظات')
      ).length;

      // Status 3: In Progress & Technical Audit
      const inProgress = officeOrders.filter(w => 
        (String(w.executionStatus).includes('تنفيذ') || 
         String(w.executionStatus).includes('قيد') || 
         String(w.procedure155Status).includes('تدقيق')) &&
        !String(w.procedure155Status).includes('مؤهل') &&
        !String(w.procedure155Status).includes('تم') &&
        !String(w.procedure155Status).includes('معلق')
      ).length;

      // Status 4: Non-compliant / Rejected
      const rejected = officeOrders.filter(w => 
        String(w.procedure155Status).includes('غير') || 
        String(w.procedure155Status).includes('مرفوض')
      ).length;

      // Other calculated indicators
      const withPhotos = officeOrders.filter(w => w.photos && w.photos.length > 0).length;
      const totalPhotos = officeOrders.reduce((acc, curr) => acc + (curr.photos ? curr.photos.length : 0), 0);

      const boqCount = officeOrders.filter(w => 
        String(w.boqModification).includes('نعم') || String(w.boqModification).includes('تعديل')
      ).length;

      const completionRate = total > 0 ? Math.round((ready / total) * 100) : 0;
      const photosRate = total > 0 ? Math.round((withPhotos / total) * 100) : 0;
      const pendingRate = total > 0 ? Math.round((pending / total) * 100) : 0;
      const inProgressRate = total > 0 ? Math.round((inProgress / total) * 100) : 0;
      const systemShareRate = totalSystemOrders > 0 ? Math.round((total / totalSystemOrders) * 100) : 0;

      // Comprehensive Quality score formula (0-100)
      const score = total > 0 
        ? Math.min(100, Math.round((completionRate * 0.5) + (photosRate * 0.3) + (Math.max(0, 100 - pendingRate) * 0.2)))
        : 0;

      let tier = 'جيد جداً';
      let tierColor = 'text-blue-700 bg-blue-50 border-blue-200';
      if (score >= 90) {
        tier = 'مثالي 🏆';
        tierColor = 'text-emerald-800 bg-emerald-50 border-emerald-300';
      } else if (score >= 80) {
        tier = 'ممتاز ✨';
        tierColor = 'text-teal-800 bg-teal-50 border-teal-200';
      } else if (score < 65) {
        tier = 'بحاجة لمتابعة ⚠️';
        tierColor = 'text-amber-800 bg-amber-50 border-amber-300';
      }

      return {
        officeId: office.id,
        officeName: office.name,
        code: office.code,
        region: office.region || 'المنطقة الوسطى',
        contractor: office.defaultContractor || 'المقاول المعتمد',
        total,
        ready,
        inProgress,
        pending,
        rejected,
        withPhotos,
        totalPhotos,
        boqCount,
        completionRate,
        photosRate,
        pendingRate,
        inProgressRate,
        systemShareRate,
        score,
        tier,
        tierColor
      };
    });
  }, [offices, workOrders, totalSystemOrders]);

  // Overall system aggregate totals
  const systemTotals = useMemo(() => {
    const totalOrders = processedOffices.reduce((sum, o) => sum + o.total, 0);
    const readyCount = processedOffices.reduce((sum, o) => sum + o.ready, 0);
    const inProgressCount = processedOffices.reduce((sum, o) => sum + o.inProgress, 0);
    const pendingCount = processedOffices.reduce((sum, o) => sum + o.pending, 0);
    const rejectedCount = processedOffices.reduce((sum, o) => sum + o.rejected, 0);
    const photosCount = processedOffices.reduce((sum, o) => sum + o.withPhotos, 0);
    const boqCount = processedOffices.reduce((sum, o) => sum + o.boqCount, 0);
    const avgScore = processedOffices.length > 0
      ? Math.round(processedOffices.reduce((sum, o) => sum + o.score, 0) / processedOffices.length)
      : 0;
    const avgCompletion = totalOrders > 0 ? Math.round((readyCount / totalOrders) * 100) : 0;
    const avgPhotos = totalOrders > 0 ? Math.round((photosCount / totalOrders) * 100) : 0;

    return {
      totalOrders,
      readyCount,
      inProgressCount,
      pendingCount,
      rejectedCount,
      photosCount,
      boqCount,
      avgScore,
      avgCompletion,
      avgPhotos
    };
  }, [processedOffices]);

  // Filter and Sort
  const sortedOffices = useMemo(() => {
    let list = [...processedOffices];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(o => 
        o.officeName.toLowerCase().includes(q) || 
        o.code.toLowerCase().includes(q) ||
        o.contractor.toLowerCase().includes(q) ||
        o.region.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let diff = 0;
      switch (sortBy) {
        case 'score': diff = b.score - a.score; break;
        case 'completionRate': diff = b.completionRate - a.completionRate; break;
        case 'total': diff = b.total - a.total; break;
        case 'photosRate': diff = b.photosRate - a.photosRate; break;
        case 'pending': diff = a.pending - b.pending; break;
        case 'inProgress': diff = b.inProgress - a.inProgress; break;
      }
      return sortAsc ? -diff : diff;
    });

    return list;
  }, [processedOffices, sortBy, sortAsc, searchQuery]);

  // Data formatted specifically for the Recharts Bar Chart
  const chartData = useMemo(() => {
    return sortedOffices.map(o => ({
      name: o.officeName.replace('مكتب ', ''),
      fullName: o.officeName,
      code: o.code,
      contractor: o.contractor,
      total: o.total,
      'مؤهل 155': o.ready,
      'قيد التنفيذ': o.inProgress,
      'معلق لنواقص': o.pending,
      'غير مطابق': o.rejected,
      'نسبة الإنجاز %': o.completionRate,
      'نسبة الصور %': o.photosRate,
      'نسبة المعلق %': o.pendingRate,
      score: o.score
    }));
  }, [sortedOffices]);

  if (!isOpen) return null;

  // Top 3 Podium
  const topRanked = sortedOffices.slice(0, 3);

  // Trigger export feedback toast
  const triggerSuccessMsg = (msg: string) => {
    setExportSuccessMsg(msg);
    soundService.playActionSound('export');
    setTimeout(() => setExportSuccessMsg(null), 4000);
  };

  // 1. Export comparison statement to Excel
  const handleExportComparisonExcel = () => {
    const headerRows = [
      ['حوكمة جودة أعمال الإنشاءات - إدارة كهرباء الحدود الشمالية - المساندة الفنية'],
      ['منظومة التدقيق والرقابة الميدانية • إدارة الجودة'],
      [`بيان المفاضلة ومقارنة أداء وتوزيع حالات أوامر العمل للمكاتب الفرعية - معتمد آلياً - ${new Date().toLocaleDateString('ar-SA')}`],
      [`إجمالي أوامر المنظومة: ${totalSystemOrders} أمر عمل | إجمالي المكاتب: ${offices.length} مكاتب فرعية`],
      []
    ];

    const dataRows = sortedOffices.map((o, idx) => [
      idx + 1,
      o.officeName,
      o.code,
      o.contractor,
      o.total,
      o.ready,
      o.inProgress,
      o.pending,
      o.rejected,
      `${o.completionRate}%`,
      `${o.photosRate}%`,
      o.boqCount,
      o.score,
      o.tier
    ]);

    const totalsRow = [
      'المجموع العام',
      `كافة المكاتب (${processedOffices.length})`,
      'ALL',
      '-',
      systemTotals.totalOrders,
      systemTotals.readyCount,
      systemTotals.inProgressCount,
      systemTotals.pendingCount,
      systemTotals.rejectedCount,
      `${systemTotals.avgCompletion}%`,
      `${systemTotals.avgPhotos}%`,
      systemTotals.boqCount,
      systemTotals.avgScore,
      '-'
    ];

    const tableHeaders = [
      'الترتيب',
      'المكتب الفرعي',
      'الكود',
      'المقاول المنفذ',
      'إجمالي الأوامر',
      'مؤهل 155 (جاهز)',
      'قيد التنفيذ والتدقيق',
      'معلق لنواقص وملاحظات',
      'غير مطابق',
      'نسبة الإنجاز %',
      'نسبة التوثيق بالصور %',
      'تعديلات المقايسة',
      'تقييم الأداء الشامل (من 100)',
      'تصنيف الأداء'
    ];

    const filename = `حوكمة_جودة_أعمال_الإنشاءات_بيان_مقارنة_المكاتب_155_${Date.now()}.xlsx`;
    const fullSheetData = [
      ...headerRows,
      tableHeaders,
      ...dataRows,
      totalsRow
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(fullSheetData);
    worksheet['!views'] = [{ RTL: true }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'مقارنة أداء المكاتب 155');
    XLSX.writeFile(workbook, filename);
    triggerSuccessMsg('تم تصدير ملف Excel الشامل بنجاح');
  };

  // 2. Export preview as high-resolution PNG image
  const handleExportAsImage = async () => {
    if (!printableReportRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await captureElementToImage(printableReportRef.current, 'png');
      const link = document.createElement('a');
      link.download = `بيان_مقارنة_اداء_المكاتب_الفرعية_إجراء_155_${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      triggerSuccessMsg('تم حفظ وتصدير البيان كصورة عالية الدقة PNG');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تصدير الصورة، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Export preview as PDF
  const handleExportAsPdf = async () => {
    if (!printableReportRef.current) return;
    setIsExporting(true);
    try {
      await exportToPdf(
        printableReportRef.current,
        workOrders,
        `بيان مقارنة أداء وتوزيع حالات المكاتب الفرعية`,
        `تقرير_مقارنة_اداء_المكاتب_155_${Date.now()}.pdf`,
        { orientation: 'landscape', format: 'a4' }
      );
      triggerSuccessMsg('تم إصدار تقرير PDF المعتمد بنجاح');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تصدير ملف PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  // 4. Print statement directly
  const handleDirectPrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-['Cairo',sans-serif]"
      dir="rtl"
    >
      <div 
        className="bg-white w-full max-w-6xl max-h-[95vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-right"
      >
        {/* Top Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white flex items-center justify-center shadow-md shrink-0">
              <Award className="w-5 h-5 text-amber-100" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-white">
                  بيان مقارنة أداء وتوزيع حالات أوامر العمل للمكاتب الفرعية
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  لوحة القيادة والمفاضلة • بيان كامل
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                تحليل بياني وتفصيلي مقارن لحالات أوامر العمل ونسب الإنجاز لإجراء 155 لكل مكتب فرعي
              </p>
            </div>
          </div>

          {/* Action buttons & View mode switchers */}
          <div className="flex items-center gap-2 flex-wrap justify-between lg:justify-end">
            {/* View Switcher Tabs */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-750'
                }`}
                title="عرض لوحة القيادة المتكاملة"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>لوحة القيادة</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('chart')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'chart'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-750'
                }`}
                title="عرض الرسم البياني المقارن لحالات أوامر العمل"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>الرسم البياني</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('statement')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'statement'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-750'
                }`}
                title="عرض البيان الجدولي الكامل والشامل"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>البيان الكامل</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('export_preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'export_preview'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-400 hover:text-white hover:bg-slate-750'
                }`}
                title="معاينة التقرير الجاهز للطباعة والتصدير"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>معاينة للتصدير</span>
              </button>
            </div>

            {/* Unified WorkOrdersTable-Style Export Hub */}
            <UnifiedSectionExportBar
              orders={workOrders}
              sectionTitle="بيان_مقارنة_أداء_المكاتب_الفرعية"
              columns={columns}
              captureSelector="#export-comparison-canvas"
              onOpenExportModal={onOpenExportOrders}
            />

            {/* Quick Export to Excel */}
            <button
              type="button"
              onClick={handleExportComparisonExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              title="تصدير بيان المقارنة المعتمد إلى ملف Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">جدول المقارنة</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success Alert Toast */}
        {exportSuccessMsg && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between animate-in fade-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{exportSuccessMsg}</span>
            </div>
            <button onClick={() => setExportSuccessMsg(null)} className="text-emerald-200 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Global Summary KPI Ribbon */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-2.5 text-xs text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">إجمالي الأوامر:</span>
              <span className="font-mono font-black text-amber-400 text-sm">{systemTotals.totalOrders}</span>
            </div>
            <div className="w-px h-3 bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">مؤهل لإجراء 155:</span>
              <span className="font-mono font-black text-emerald-400 text-sm">{systemTotals.readyCount}</span>
              <span className="text-[10px] text-emerald-500 font-bold">({systemTotals.avgCompletion}%)</span>
            </div>
            <div className="w-px h-3 bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">قيد التنفيذ والتدقيق:</span>
              <span className="font-mono font-black text-blue-400 text-sm">{systemTotals.inProgressCount}</span>
            </div>
            <div className="w-px h-3 bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">معلق لنواقص:</span>
              <span className="font-mono font-black text-amber-400 text-sm">{systemTotals.pendingCount}</span>
            </div>
            <div className="w-px h-3 bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">توثيق الصور:</span>
              <span className="font-mono font-black text-indigo-400 text-sm">{systemTotals.photosCount}</span>
              <span className="text-[10px] text-indigo-400 font-bold">({systemTotals.avgPhotos}%)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">متوسط الأداء العام:</span>
            <span className="font-mono font-black text-emerald-400 text-sm bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-lg">
              {systemTotals.avgScore}/100
            </span>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/70">

          {/* ================= TAB 1: DASHBOARD (Podium + Chart + Quick Cards) ================= */}
          {(activeTab === 'dashboard' || activeTab === 'chart') && (
            <div className="space-y-5">
              
              {/* Podium: Top 3 Outstanding Offices Banner */}
              {activeTab === 'dashboard' && (
                <div className="bg-gradient-to-b from-slate-900 via-slate-850 to-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 text-white shadow-md">
                  <div className="text-center mb-3">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                      المراكز المتقدمة في الجاهزية والامتثال لإجراء 155
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Rank 2 (Silver) */}
                    {topRanked[1] && (
                      <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 flex flex-col justify-between text-right relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-900 font-bold text-xs shadow-xs">
                            🥈 2
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">المركز الثاني</span>
                        </div>
                        <div className="mt-2">
                          <h4 className="text-sm font-black text-white">{topRanked[1].officeName}</h4>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-lg font-black text-emerald-400 font-mono">
                              {topRanked[1].completionRate}%
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">إنجاز إجراء 155</span>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-300">
                          <span>توثيق الصور: <strong className="text-white">{topRanked[1].photosRate}%</strong></span>
                          <span className="text-amber-400 font-bold">تقييم: {topRanked[1].score}/100</span>
                        </div>
                      </div>
                    )}

                    {/* Rank 1 (Gold - Center & Elevated) */}
                    {topRanked[0] && (
                      <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/70 via-slate-800 to-amber-950/50 border-2 border-amber-500/80 shadow-lg flex flex-col justify-between text-right relative overflow-hidden sm:-translate-y-1">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-sm">
                            🥇 المتصدر الأول
                          </span>
                          <span className="text-[10px] font-extrabold text-amber-300">المركز الأول</span>
                        </div>
                        <div className="mt-2">
                          <h4 className="text-base font-black text-white">{topRanked[0].officeName}</h4>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-black text-emerald-400 font-mono">
                              {topRanked[0].completionRate}%
                            </span>
                            <span className="text-xs text-amber-200 font-bold">إنجاز نهائي معتمد</span>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-amber-500/30 flex items-center justify-between text-xs">
                          <span className="text-slate-200">الأوامر: <strong>{topRanked[0].total}</strong></span>
                          <span className="text-amber-300 font-black bg-amber-500/20 px-2 py-0.5 rounded">
                            تقييم {topRanked[0].score}/100
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Rank 3 (Bronze) */}
                    {topRanked[2] && (
                      <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 flex flex-col justify-between text-right relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white font-bold text-xs shadow-xs">
                            🥉 3
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">المركز الثالث</span>
                        </div>
                        <div className="mt-2">
                          <h4 className="text-sm font-black text-white">{topRanked[2].officeName}</h4>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-lg font-black text-emerald-400 font-mono">
                              {topRanked[2].completionRate}%
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">إنجاز إجراء 155</span>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-300">
                          <span>توثيق الصور: <strong className="text-white">{topRanked[2].photosRate}%</strong></span>
                          <span className="text-amber-400 font-bold">تقييم: {topRanked[2].score}/100</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* BAR CHART SECTION: Comparative Breakdown of Work Order Statuses per Sub-Office */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-900">
                        الرسم البياني المقارن لتوزيع حالات أوامر العمل لكل مكتب فرعي
                      </h3>
                      <p className="text-xs text-slate-500">
                        مقارنة مرئية لعدد الأوامر الجاهزة لإجراء 155، قيد التنفيذ، والمعلقة لنواقص
                      </p>
                    </div>
                  </div>

                  {/* Chart Display Mode Selector */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setChartViewMode('stacked')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        chartViewMode === 'stacked'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      أعمدة مكدّسة (إجمالي الحالات)
                    </button>

                    <button
                      type="button"
                      onClick={() => setChartViewMode('grouped')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        chartViewMode === 'grouped'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      أعمدة متجاورة (مقارنة مباشرة)
                    </button>

                    <button
                      type="button"
                      onClick={() => setChartViewMode('rates')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        chartViewMode === 'rates'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      نسب مئوية (%)
                    </button>
                  </div>
                </div>

                {/* Recharts Canvas */}
                <div className="w-full h-80 sm:h-96" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }}
                        interval={0}
                        dy={8}
                      />
                      <YAxis 
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        allowDecimals={false}
                        dx={-5}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontFamily: 'Cairo, sans-serif',
                          fontSize: '12px',
                          textAlign: 'right',
                          direction: 'rtl',
                          padding: '10px 14px'
                        }}
                        formatter={(value: any, name: any) => [
                          `${value} ${chartViewMode === 'rates' ? '%' : 'أمر'}`,
                          name
                        ]}
                        labelFormatter={(label: any) => `مكتب ${label}`}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '15px', fontFamily: 'Cairo, sans-serif', fontSize: '12px' }}
                      />

                      {chartViewMode === 'stacked' && (
                        <>
                          <Bar dataKey="مؤهل 155" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="مؤهل لإجراء 155" />
                          <Bar dataKey="قيد التنفيذ" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} name="قيد التنفيذ والتدقيق" />
                          <Bar dataKey="معلق لنواقص" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} name="معلق لنواقص وملاحظات" />
                          <Bar dataKey="غير مطابق" stackId="a" fill="#ef4444" radius={[6, 6, 0, 0]} name="غير مطابق" />
                        </>
                      )}

                      {chartViewMode === 'grouped' && (
                        <>
                          <Bar dataKey="مؤهل 155" fill="#10b981" radius={[4, 4, 0, 0]} name="مؤهل لإجراء 155" />
                          <Bar dataKey="قيد التنفيذ" fill="#3b82f6" radius={[4, 4, 0, 0]} name="قيد التنفيذ والتدقيق" />
                          <Bar dataKey="معلق لنواقص" fill="#f59e0b" radius={[4, 4, 0, 0]} name="معلق لنواقص وملاحظات" />
                          <Bar dataKey="غير مطابق" fill="#ef4444" radius={[4, 4, 0, 0]} name="غير مطابق" />
                        </>
                      )}

                      {chartViewMode === 'rates' && (
                        <>
                          <Bar dataKey="نسبة الإنجاز %" fill="#10b981" radius={[4, 4, 0, 0]} name="نسبة الإنجاز (155) %" />
                          <Bar dataKey="نسبة الصور %" fill="#6366f1" radius={[4, 4, 0, 0]} name="نسبة توثيق الصور %" />
                          <Bar dataKey="نسبة المعلق %" fill="#f59e0b" radius={[4, 4, 0, 0]} name="نسبة المعلق لنواقص %" />
                        </>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 font-bold text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                      مؤهل 155: جاهز للاعتماد والاستلام النهائي
                    </span>
                    <span className="flex items-center gap-1.5 font-bold text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                      قيد التنفيذ: أعمال ميدانية وتدقيق مستمر
                    </span>
                    <span className="flex items-center gap-1.5 font-bold text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                      معلق لنواقص: بانتظار استيفاء ملاحظات المقاول
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    انقر على أي مكتب في البيان أدناه لعرض أوامره في الجدول الرئيسي
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: FULL STATEMENT TABLE ("بيان كامل") ================= */}
          {(activeTab === 'dashboard' || activeTab === 'statement') && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              
              {/* Statement Controls Header */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  <h3 className="font-black text-slate-900 text-sm">
                    البيان الجدولي الكامل لتوزيع الحالات وتقييم أداء المكاتب
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                    {sortedOffices.length} مكاتب
                  </span>
                </div>

                {/* Sorting and Search */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Search box */}
                  <div className="relative w-48 sm:w-56">
                    <input
                      type="text"
                      placeholder="بحث باسم المكتب أو المقاول..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs py-1.5 pr-7 pl-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500 font-semibold text-slate-800"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2" />
                  </div>

                  {/* Sort field trigger */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortField)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                  >
                    <option value="score">ترتيب حسب: التقييم الشامل</option>
                    <option value="completionRate">ترتيب حسب: نسبة الإنجاز 155</option>
                    <option value="total">ترتيب حسب: إجمالي الأوامر</option>
                    <option value="photosRate">ترتيب حسب: نسبة توثيق الصور</option>
                    <option value="pending">ترتيب حسب: الأقل نواقص</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setSortAsc(!sortAsc)}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                    title={sortAsc ? 'ترتيب تصاعدي' : 'ترتيب تنازلي'}
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Full Statement Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white border-b border-slate-800">
                      <th className="py-3 px-3 text-center font-black w-12 border-l border-slate-800">#</th>
                      <th className="py-3 px-3 font-black border-l border-slate-800 min-w-[170px]">المكتب الفرعي</th>
                      <th className="py-3 px-3 font-black border-l border-slate-800 min-w-[180px]">المقاول المنفذ</th>
                      <th className="py-3 px-2 text-center font-black border-l border-slate-800">إجمالي الأوامر</th>
                      <th className="py-3 px-2 text-center font-black border-l border-slate-800 bg-emerald-950/80 text-emerald-300">
                        مؤهل 155 (جاهز)
                      </th>
                      <th className="py-3 px-2 text-center font-black border-l border-slate-800 bg-blue-950/80 text-blue-300">
                        قيد التنفيذ
                      </th>
                      <th className="py-3 px-2 text-center font-black border-l border-slate-800 bg-amber-950/80 text-amber-300">
                        معلق لنواقص
                      </th>
                      <th className="py-3 px-2 text-center font-black border-l border-slate-800">
                        غير مطابق
                      </th>
                      <th className="py-3 px-2 text-center font-black border-l border-slate-800">
                        نسبة الإنجاز %
                      </th>
                      <th className="py-3 px-2 text-center font-black border-l border-slate-800">
                        توثيق الصور %
                      </th>
                      <th className="py-3 px-2 text-center font-black border-l border-slate-800">
                        تعديل مقايسة
                      </th>
                      <th className="py-3 px-3 text-center font-black border-l border-slate-800 bg-amber-950/90 text-amber-300">
                        التقييم الشامل
                      </th>
                      <th className="py-3 px-3 text-center font-black">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sortedOffices.map((office, idx) => {
                      const isGold = idx === 0;
                      const isSilver = idx === 1;
                      const isBronze = idx === 2;

                      return (
                        <tr 
                          key={office.officeId}
                          className={`hover:bg-blue-50/70 transition-colors ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-mono font-bold border-l border-slate-200">
                            {isGold ? '🥇 1' : isSilver ? '🥈 2' : isBronze ? '🥉 3' : idx + 1}
                          </td>

                          <td className="py-2.5 px-3 border-l border-slate-200 font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="font-black">{office.officeName}</span>
                              <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1 py-0.2 rounded">
                                {office.code}
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 border-l border-slate-200 text-slate-900 font-bold">
                            <span className="truncate block max-w-[200px]" title={office.contractor}>
                              {office.contractor}
                            </span>
                          </td>

                          <td className="py-2.5 px-2 text-center border-l border-slate-200 font-mono font-black text-slate-900">
                            {office.total}
                          </td>

                          <td className="py-2.5 px-2 text-center border-l border-slate-200 font-mono font-black text-emerald-700 bg-emerald-50/50">
                            {office.ready}
                          </td>

                          <td className="py-2.5 px-2 text-center border-l border-slate-200 font-mono font-black text-blue-700 bg-blue-50/50">
                            {office.inProgress}
                          </td>

                          <td className="py-2.5 px-2 text-center border-l border-slate-200 font-mono font-black text-amber-700 bg-amber-50/50">
                            {office.pending}
                          </td>

                          <td className="py-2.5 px-2 text-center border-l border-slate-200 font-mono font-bold text-rose-700">
                            {office.rejected}
                          </td>

                          <td className="py-2.5 px-2 text-center border-l border-slate-200 font-mono font-black">
                            <span className={`px-2 py-0.5 rounded-full ${
                              office.completionRate >= 80 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : office.completionRate >= 60
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {office.completionRate}%
                            </span>
                          </td>

                          <td className="py-2.5 px-2 text-center border-l border-slate-200 font-mono font-bold text-indigo-700">
                            {office.photosRate}%
                          </td>

                          <td className="py-2.5 px-2 text-center border-l border-slate-200 font-mono text-slate-700">
                            {office.boqCount}
                          </td>

                          <td className="py-2.5 px-3 text-center border-l border-slate-200">
                            <div className="flex flex-col items-center">
                              <span className="font-mono font-black text-slate-900 text-sm">
                                {office.score}<span className="text-[10px] text-slate-400">/100</span>
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded border font-bold ${office.tierColor}`}>
                                {office.tier}
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onSelectOfficeAndFilter(office.officeName);
                                }}
                                className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 transition-colors text-[11px] font-bold cursor-pointer"
                                title={`عرض أوامر مكتب (${office.officeName}) في الجدول الرئيسي`}
                              >
                                عرض بالجدول
                              </button>

                              {onOpenExportOrders && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const officeOrders = workOrders.filter(w => w.office === office.officeName);
                                    onOpenExportOrders(officeOrders, office.officeName);
                                  }}
                                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                                  title={`معاينة وتصدير أوامر مكتب (${office.officeName})`}
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Totals Summary Row */}
                    <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-800">
                      <td colSpan={3} className="py-3 px-3 text-right font-black">
                        المجموع العام لكافة المكاتب الفرعية ({processedOffices.length} مكاتب)
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-black text-amber-400">
                        {systemTotals.totalOrders}
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-black text-emerald-400 bg-emerald-950/80">
                        {systemTotals.readyCount}
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-black text-blue-400 bg-blue-950/80">
                        {systemTotals.inProgressCount}
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-black text-amber-400 bg-amber-950/80">
                        {systemTotals.pendingCount}
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-black text-rose-400">
                        {systemTotals.rejectedCount}
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-black text-emerald-400">
                        {systemTotals.avgCompletion}%
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-black text-indigo-400">
                        {systemTotals.avgPhotos}%
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-black text-slate-300">
                        {systemTotals.boqCount}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black text-amber-300">
                        {systemTotals.avgScore}/100
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                        معتمد آلياً
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ================= TAB 3: EXPORT PREVIEW ("معاينة للتصدير") ================= */}
          <div className={activeTab === 'export_preview' ? 'space-y-4' : 'fixed -left-[9999px] top-0 pointer-events-none opacity-0'}>
            {activeTab === 'export_preview' && (
              /* Preview Action Header Controls */
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-emerald-600" />
                    <span>معاينة تقرير المفاضلة وتوزيع الحالات قبل التصدير والطباعة (A4 Landscape)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    مصمم بأبعاد قياسية متزنة (1123×794 بكسل) لضمان عدم التمدد أو التداخل واحتواء كامل البيانات داخل حيز الصفحة
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Export PDF */}
                  <button
                    type="button"
                    onClick={handleExportAsPdf}
                    disabled={isExporting}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>تصدير PDF</span>
                  </button>

                  {/* Export Image */}
                  <button
                    type="button"
                    onClick={handleExportAsImage}
                    disabled={isExporting}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>تصدير صورة PNG</span>
                  </button>

                  {/* Export Excel */}
                  <button
                    type="button"
                    onClick={handleExportComparisonExcel}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>تصدير Excel</span>
                  </button>

                  {/* Direct Print */}
                  <button
                    type="button"
                    onClick={handleDirectPrint}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة مباشرة</span>
                  </button>
                </div>
              </div>
            )}

            {/* The Actual Printable/Exportable Canvas Container - Exact A4 Landscape Sheet */}
            <div className="overflow-x-auto pb-2 flex justify-center">
              <div
                ref={printableReportRef}
                id="export-comparison-canvas"
                dir="rtl"
                style={{
                  width: '1123px',
                  minWidth: '1123px',
                  maxWidth: '1123px',
                  height: '794px',
                  minHeight: '794px',
                  maxHeight: '794px',
                  boxSizing: 'border-box',
                }}
                className="export-page-sheet bg-white px-8 py-6 rounded-xl border border-slate-300 shadow-md text-right flex flex-col justify-between overflow-hidden"
              >
                <div className="space-y-4">
                  {/* Official Header Strictly Conforming to User Requirements */}
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
                      <h2 className="text-xs sm:text-sm font-black text-slate-950">
                        مقارنة أداء المكاتب
                      </h2>
                    </div>

                    <div className="text-left font-mono text-xs font-bold text-slate-800">
                      التاريخ: {new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}
                    </div>
                  </div>

                  {/* ( مؤشرات الاداء ) */}
                  <div className="text-[11px] font-black text-slate-900 text-center -mb-2">
                    ( مؤشرات الاداء )
                  </div>
                  <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                      <span className="text-[11px] text-slate-500 font-bold block">إجمالي أوامر المنظومة</span>
                      <span className="text-xl font-black text-slate-900 font-mono">{systemTotals.totalOrders}</span>
                    </div>
                    <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                      <span className="text-[11px] text-emerald-800 font-bold block">مؤهل لإجراء 155 (جاهز)</span>
                      <span className="text-xl font-black text-emerald-700 font-mono">
                        {systemTotals.readyCount} <span className="text-xs">({systemTotals.avgCompletion}%)</span>
                      </span>
                    </div>
                    <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-200">
                      <span className="text-[11px] text-amber-800 font-bold block">معلق لنواقص وملاحظات</span>
                      <span className="text-xl font-black text-amber-700 font-mono">{systemTotals.pendingCount}</span>
                    </div>
                    <div className="bg-blue-50/60 p-2.5 rounded-lg border border-blue-200">
                      <span className="text-[11px] text-blue-800 font-bold block">متوسط الجودة والأداء</span>
                      <span className="text-xl font-black text-blue-700 font-mono">{systemTotals.avgScore}/100</span>
                    </div>
                  </div>

                  {/* Printable Table */}
                  <div className="overflow-hidden rounded-xl border border-slate-300">
                    <table className="w-full text-right border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                      <thead>
                        <tr className="bg-slate-900 text-white">
                          <th className="py-2.5 px-2 text-center border border-slate-800 w-[36px]">#</th>
                          <th className="py-2.5 px-3 border border-slate-800 w-[135px]">المكتب الفرعي</th>
                          <th className="py-2.5 px-3 border border-slate-800 w-[180px]">المقاول المعتمد</th>
                          <th className="py-2.5 px-2 text-center border border-slate-800 w-[85px]">إجمالي الأوامر</th>
                          <th className="py-2.5 px-2 text-center border border-slate-800 bg-emerald-950 text-emerald-300 w-[85px]">مؤهل 155</th>
                          <th className="py-2.5 px-2 text-center border border-slate-800 bg-blue-950 text-blue-300 w-[85px]">قيد التنفيذ</th>
                          <th className="py-2.5 px-2 text-center border border-slate-800 bg-amber-950 text-amber-300 w-[85px]">معلق لنواقص</th>
                          <th className="py-2.5 px-2 text-center border border-slate-800 w-[85px]">نسبة الإنجاز</th>
                          <th className="py-2.5 px-2 text-center border border-slate-800 w-[90px]">التوثيق بالصور</th>
                          <th className="py-2.5 px-2 text-center border border-slate-800 w-[85px]">التقييم العام</th>
                          <th className="py-2.5 px-2 text-center border border-slate-800">التصنيف</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedOffices.map((office, idx) => (
                          <tr key={office.officeId} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="py-2.5 px-2 text-center font-bold border border-slate-200">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-black text-slate-900 border border-slate-200 truncate">{office.officeName}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-800 border border-slate-200 truncate">{office.contractor}</td>
                            <td className="py-2.5 px-2 text-center font-bold border border-slate-200 font-mono">{office.total}</td>
                            <td className="py-2.5 px-2 text-center font-black text-emerald-700 bg-emerald-50/50 border border-slate-200 font-mono">{office.ready}</td>
                            <td className="py-2.5 px-2 text-center font-bold text-blue-700 bg-blue-50/50 border border-slate-200 font-mono">{office.inProgress}</td>
                            <td className="py-2.5 px-2 text-center font-bold text-amber-700 bg-amber-50/50 border border-slate-200 font-mono">{office.pending}</td>
                            <td className="py-2.5 px-2 text-center font-black border border-slate-200 font-mono">{office.completionRate}%</td>
                            <td className="py-2.5 px-2 text-center font-bold text-indigo-700 border border-slate-200 font-mono">{office.photosRate}%</td>
                            <td className="py-2.5 px-2 text-center font-black text-slate-900 border border-slate-200 font-mono">{office.score}/100</td>
                            <td className="py-2.5 px-2 text-center font-bold text-[10px] border border-slate-200 truncate">{office.tier}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-900 text-white font-black">
                          <td colSpan={3} className="py-2.5 px-3 border border-slate-800">المجموع الإجمالي / المتوسط العام</td>
                          <td className="py-2.5 px-2 text-center border border-slate-800 font-mono text-amber-400">{systemTotals.totalOrders}</td>
                          <td className="py-2.5 px-2 text-center border border-slate-800 font-mono text-emerald-400">{systemTotals.readyCount}</td>
                          <td className="py-2.5 px-2 text-center border border-slate-800 font-mono text-blue-400">{systemTotals.inProgressCount}</td>
                          <td className="py-2.5 px-2 text-center border border-slate-800 font-mono text-amber-400">{systemTotals.pendingCount}</td>
                          <td className="py-2.5 px-2 text-center border border-slate-800 font-mono text-emerald-400">{systemTotals.avgCompletion}%</td>
                          <td className="py-2.5 px-2 text-center border border-slate-800 font-mono text-indigo-400">{systemTotals.avgPhotos}%</td>
                          <td className="py-2.5 px-2 text-center border border-slate-800 font-mono text-amber-400">{systemTotals.avgScore}/100</td>
                          <td className="py-2.5 px-2 text-center border border-slate-800 font-mono text-[10px]">معتمد</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer: Strictly Page Number Only */}
                <div className="pt-2 border-t-2 border-slate-900 text-center text-xs text-slate-800 font-mono font-black shrink-0">
                  رقم الصفحة: 1
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Bottom Footer */}
        <div className="bg-slate-900 text-slate-300 p-3 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-800 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white">إجمالي المكاتب المدرجة:</span>
            <span className="font-mono font-bold text-amber-400">{processedOffices.length} مكاتب فرعية</span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-slate-400">إجمالي أوامر المنظومة:</span>
            <span className="font-mono font-bold text-blue-400">{totalSystemOrders} أمر عمل</span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Weekly Report Navigation */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenWeeklyReport();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>التقرير الأسبوعي الإداري PDF</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
