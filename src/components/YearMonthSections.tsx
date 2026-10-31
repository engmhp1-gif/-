import React, { useState, useMemo } from 'react';
import { 
  WorkOrder, 
  SubOffice, 
  ArchivedReportSnapshot,
  MonthTable,
  PlatformUser
} from '../types';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  BarChart3, 
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  FileSpreadsheet, 
  FileDown, 
  Archive, 
  Layers, 
  Sparkles,
  Building2,
  Users,
  Clock,
  Trash2,
  Eye,
  Check,
  CalendarPlus
} from 'lucide-react';
import { realtime } from '../services/realtimeService';
import { resolveOrderYearMonth } from '../utils/tableScope';
import { hasUserPermission } from '../utils/security';
import { UnifiedSectionExportBar } from './UnifiedSectionExportBar';

interface YearMonthSectionsProps {
  orders: WorkOrder[];
  monthTables?: MonthTable[];
  offices: SubOffice[];
  activeYear: number;
  activeMonth: number | 'all';
  onSelectPeriod: (year: number, month: number | 'all') => void;
  onOpenYearMonthPicker?: () => void;
  onOpenExportForOrders?: (orders: WorkOrder[], title: string, openEmail?: boolean) => void;
  archivedReports: ArchivedReportSnapshot[];
  onSaveArchivedReport: (report: ArchivedReportSnapshot) => void;
  onDeleteArchivedReport?: (id: string) => void;
  currentUser?: PlatformUser | null;
}

const ARABIC_MONTHS = [
  { num: 1, name: 'يناير' },
  { num: 2, name: 'فبراير' },
  { num: 3, name: 'مارس' },
  { num: 4, name: 'أبريل' },
  { num: 5, name: 'مايو' },
  { num: 6, name: 'يونيو' },
  { num: 7, name: 'يوليو' },
  { num: 8, name: 'أغسطس' },
  { num: 9, name: 'سبتمبر' },
  { num: 10, name: 'أكتوبر' },
  { num: 11, name: 'نوفمبر' },
  { num: 12, name: 'ديسمبر' }
];

export const YearMonthSections: React.FC<YearMonthSectionsProps> = ({
  orders,
  monthTables = [],
  offices,
  activeYear,
  activeMonth,
  onSelectPeriod,
  onOpenYearMonthPicker,
  onOpenExportForOrders,
  archivedReports,
  onSaveArchivedReport,
  onDeleteArchivedReport,
  currentUser
}) => {
  // Period filter mode: 'single_month' | 'quarter' | 'semi_annual' | 'annual' | 'archive'
  const [periodMode, setPeriodMode] = useState<'single_month' | 'quarter' | 'semi_annual' | 'annual' | 'archive'>('single_month');
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1); // 1, 2, 3, 4
  const [selectedHalf, setSelectedHalf] = useState<number>(1); // 1, 2
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [viewingArchive, setViewingArchive] = useState<ArchivedReportSnapshot | null>(null);

  // Available years extracted from orders + tables + standard years
  const availableYears = useMemo(() => {
    const set = new Set<number>([2024, 2025, 2026, 2027, 2028]);
    const currYear = new Date().getFullYear();
    set.add(currYear);
    set.add(activeYear);
    monthTables.forEach(t => {
      if (t.year && t.year >= 2000 && t.year <= 2100) set.add(t.year);
    });
    orders.forEach(o => {
      const { year } = resolveOrderYearMonth(o, monthTables);
      if (!isNaN(year) && year > 2000 && year < 2100) set.add(year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [orders, monthTables, activeYear]);

  // Count orders per month for the active year using strict table scope
  const orderCountsByMonth = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) counts[m] = 0;

    orders.forEach(o => {
      const { year, month } = resolveOrderYearMonth(o, monthTables);
      if (year === activeYear && month >= 1 && month <= 12) {
        counts[month] = (counts[month] || 0) + 1;
      }
    });
    return counts;
  }, [orders, monthTables, activeYear]);

  // Determine active months according to period mode
  const activeMonthsList = useMemo<number[]>(() => {
    if (periodMode === 'single_month') {
      return activeMonth === 'all' ? [1,2,3,4,5,6,7,8,9,10,11,12] : [activeMonth as number];
    }
    if (periodMode === 'quarter') {
      if (selectedQuarter === 1) return [1, 2, 3];
      if (selectedQuarter === 2) return [4, 5, 6];
      if (selectedQuarter === 3) return [7, 8, 9];
      return [10, 11, 12];
    }
    if (periodMode === 'semi_annual') {
      return selectedHalf === 1 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
    }
    if (periodMode === 'annual') {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    }
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }, [periodMode, activeMonth, selectedQuarter, selectedHalf]);

  // Scoped orders for the active period using strict table scope
  const scopedOrders = useMemo(() => {
    return orders.filter(o => {
      const { year, month } = resolveOrderYearMonth(o, monthTables);
      if (year !== activeYear) return false;
      return activeMonthsList.includes(month);
    });
  }, [orders, monthTables, activeYear, activeMonthsList]);

  // Realtime Statistics & KPIs for the open period
  const stats = useMemo(() => {
    const total = scopedOrders.length;
    let qualified = 0;
    let unqualified = 0;
    const officeCounts: Record<string, { total: number; qualified: number; unqualified: number }> = {};
    const contractorCounts: Record<string, { total: number; qualified: number; unqualified: number }> = {};
    const statusCounts: Record<string, number> = {};

    scopedOrders.forEach(o => {
      const s = String(o.procedure155Status || '');
      const isQual = !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم'));
      if (isQual) qualified++;
      else unqualified++;

      // Office
      const off = o.office || 'غير محدد';
      if (!officeCounts[off]) officeCounts[off] = { total: 0, qualified: 0, unqualified: 0 };
      officeCounts[off].total++;
      if (isQual) officeCounts[off].qualified++;
      else officeCounts[off].unqualified++;

      // Contractor
      const c = o.contractor || 'غير محدد';
      if (!contractorCounts[c]) contractorCounts[c] = { total: 0, qualified: 0, unqualified: 0 };
      contractorCounts[c].total++;
      if (isQual) contractorCounts[c].qualified++;
      else contractorCounts[c].unqualified++;

      // Execution status
      const es = o.executionStatus || 'قيد التدقيق';
      statusCounts[es] = (statusCounts[es] || 0) + 1;
    });

    const completionRate = total > 0 ? Math.round((qualified / total) * 100) : 0;

    return {
      total,
      qualified,
      unqualified,
      completionRate,
      officeBreakdown: Object.entries(officeCounts).map(([office, data]) => ({ office, ...data })),
      contractorBreakdown: Object.entries(contractorCounts).map(([contractor, data]) => ({ contractor, ...data })),
      statusCounts
    };
  }, [scopedOrders]);

  // Current Period Title Label
  const periodLabel = useMemo(() => {
    if (periodMode === 'single_month') {
      if (activeMonth === 'all') return `كافة شهور سنة ${activeYear}`;
      const mObj = ARABIC_MONTHS.find(m => m.num === activeMonth);
      return `شهر ${mObj?.name || activeMonth} ${activeYear}`;
    }
    if (periodMode === 'quarter') {
      return `الربع ${selectedQuarter === 1 ? 'الأول' : selectedQuarter === 2 ? 'الثاني' : selectedQuarter === 3 ? 'الثالث' : 'الرابع'} (${activeYear})`;
    }
    if (periodMode === 'semi_annual') {
      return `تقرير ${selectedHalf === 1 ? 'النصف الأول' : 'النصف الثاني'} من عام ${activeYear}`;
    }
    if (periodMode === 'annual') {
      return `التقرير السنوي الشامل لعام ${activeYear}`;
    }
    return `فترة عام ${activeYear}`;
  }, [periodMode, activeMonth, activeYear, selectedQuarter, selectedHalf]);

  // Save current statistics to immutable Archive
  const handleSaveToArchive = () => {
    const reportSnapshot: ArchivedReportSnapshot = {
      id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: `تقرير إحصائي محفوظ • ${periodLabel}`,
      periodType: periodMode === 'quarter' ? 'quarter' : periodMode === 'semi_annual' ? 'semi_annual' : periodMode === 'annual' ? 'annual' : 'month',
      periodLabel,
      year: activeYear,
      months: activeMonthsList,
      createdAt: new Date().toISOString(),
      totalOrders: stats.total,
      qualifiedOrders: stats.qualified,
      unqualifiedOrders: stats.unqualified,
      completionRate: stats.completionRate,
      officeBreakdown: stats.officeBreakdown,
      contractorBreakdown: stats.contractorBreakdown,
      statusCounts: stats.statusCounts,
      archivedOrdersSummary: scopedOrders.slice(0, 100).map(o => ({
        id: o.id,
        workOrderNumber: o.workOrderNumber,
        workOrderCode: o.workOrderCode,
        receiptDate: o.receiptDate,
        office: o.office,
        contractor: o.contractor,
        status: o.procedure155Status || 'غير مؤهل للاغلاق'
      }))
    };

    onSaveArchivedReport(reportSnapshot);
    realtime.saveArchivedReport(reportSnapshot);
    setSaveSuccessMsg(`تم حفظ التقرير الإحصائي (${periodLabel}) بنجاح في الأرشيف الدائم.`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-6 text-right">
      
      {/* Top Bar: Years Tabs & Modes */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-900 rounded-xl font-bold text-xs">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>السنة المالية / التنفيذية:</span>
          </div>

          {availableYears.map(year => (
            <button
              key={year}
              type="button"
              onClick={() => onSelectPeriod(year, activeMonth)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeYear === year
                  ? 'bg-blue-600 text-white shadow-xs scale-105'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {year}
            </button>
          ))}

          {onOpenYearMonthPicker && (hasUserPermission(currentUser, 'manageMonthTables') || hasUserPermission(currentUser, 'viewArchive')) && (
            <button
              type="button"
              onClick={onOpenYearMonthPicker}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-l from-indigo-700 to-blue-700 hover:from-indigo-600 hover:to-blue-600 text-white font-black text-xs shadow-xs transition-all cursor-pointer"
              title="تحديد السنة والشهر لإدراج الجداول المستقلة"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-amber-300" />
              <span>تحديد السنة والشهر وإدراج جدول</span>
            </button>
          )}
        </div>

        {/* Period Mode Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl flex-wrap">
          <button
            type="button"
            onClick={() => {
              setPeriodMode('single_month');
              if (activeMonth === 'all') onSelectPeriod(activeYear, 1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              periodMode === 'single_month'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الأقسام الشهرية
          </button>

          <button
            type="button"
            onClick={() => setPeriodMode('quarter')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              periodMode === 'quarter'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ربع سنوي
          </button>

          <button
            type="button"
            onClick={() => setPeriodMode('semi_annual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              periodMode === 'semi_annual'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            نصف سنوي
          </button>

          <button
            type="button"
            onClick={() => setPeriodMode('annual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              periodMode === 'annual'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            تقرير سنوي
          </button>

          <button
            type="button"
            onClick={() => setIsArchiveModalOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="عرض التقارير الإحصائية السابقة المحفوظة"
          >
            <Archive className="w-3.5 h-3.5 text-amber-600" />
            <span>الأرشيف المحفوظ ({archivedReports.length})</span>
          </button>
        </div>
      </div>

      {/* Sub-bar for Period Options */}
      {periodMode === 'single_month' && (
        <div className="pt-3 pb-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 min-w-max">
            <button
              type="button"
              onClick={() => onSelectPeriod(activeYear, 'all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMonth === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>كافة الشهور</span>
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-200">
                {orders.length}
              </span>
            </button>

            {ARABIC_MONTHS.map(m => {
              const count = orderCountsByMonth[m.num] || 0;
              const isActive = activeMonth === m.num;
              return (
                <button
                  key={m.num}
                  type="button"
                  onClick={() => onSelectPeriod(activeYear, m.num)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-102'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>{m.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    isActive ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {periodMode === 'quarter' && (
        <div className="pt-3 pb-2 flex items-center gap-2 flex-wrap">
          {[
            { q: 1, label: 'الربع الأول (يناير - مارس)' },
            { q: 2, label: 'الربع الثاني (أبريل - يونيو)' },
            { q: 3, label: 'الربع الثالث (يوليو - سبتمبر)' },
            { q: 4, label: 'الربع الرابع (أكتوبر - ديسمبر)' }
          ].map(item => (
            <button
              key={item.q}
              type="button"
              onClick={() => setSelectedQuarter(item.q)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedQuarter === item.q
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {periodMode === 'semi_annual' && (
        <div className="pt-3 pb-2 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedHalf(1)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedHalf === 1
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            النصف الأول (يناير - يونيو)
          </button>
          <button
            type="button"
            onClick={() => setSelectedHalf(2)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedHalf === 2
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            النصف الثاني (يوليو - ديسمبر)
          </button>
        </div>
      )}

      {/* Live Statistics & KPI Dashboard Banner for the Open Month / Period */}
      <div className="mt-4 p-4 rounded-xl bg-gradient-to-l from-slate-900 to-slate-800 text-white shadow-inner">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-sm sm:text-base font-bold text-white">
                الإحصائيات و KPI التلقائية • {periodLabel}
              </h3>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              نتائج فورية محسوبة تلقائياً لأوامر العمل والملفات المندرجة في هذه الفترة
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {hasUserPermission(currentUser, 'viewArchive') && (
              <button
                type="button"
                onClick={handleSaveToArchive}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title="حفظ لقطة التقرير في الأرشيف حتى لو تم مسح الجدول لاحقاً"
              >
                <Archive className="w-3.5 h-3.5 text-slate-950" />
                <span>حفظ في الأرشيف الدائم</span>
              </button>
            )}

            {hasUserPermission(currentUser, 'exportTable') && (
              <UnifiedSectionExportBar
                orders={scopedOrders}
                sectionTitle={`تقرير_${periodLabel.replace(/\s+/g, '_')}`}
                onOpenExportModal={onOpenExportForOrders}
              />
            )}
          </div>
        </div>

        {/* Feedback message */}
        {saveSuccessMsg && (
          <div className="mt-2 p-2 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 rounded-lg text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* 4 KPI Cards in a single adaptive horizontal row */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 mt-3">
          <div className="bg-slate-800/80 p-2 sm:p-3 rounded-xl border border-slate-700/80 text-right min-w-0">
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block truncate">إجمالي أوامر العمل</span>
            <div className="text-lg sm:text-2xl font-black text-white mt-1 font-mono">{stats.total}</div>
            <span className="text-[9px] sm:text-[10px] text-blue-300 block truncate">أوامر مدرجة بالفترة</span>
          </div>

          <div className="bg-slate-800/80 p-2 sm:p-3 rounded-xl border border-slate-700/80 text-right min-w-0">
            <span className="text-[10px] sm:text-[11px] text-emerald-300 font-bold block truncate">مؤهل للاغلاق ( معتمد )</span>
            <div className="text-lg sm:text-2xl font-black text-emerald-400 mt-1 font-mono">{stats.qualified}</div>
            <span className="text-[9px] sm:text-[10px] text-emerald-200 block truncate">استوفت كافة المعايير</span>
          </div>

          <div className="bg-slate-800/80 p-2 sm:p-3 rounded-xl border border-slate-700/80 text-right min-w-0">
            <span className="text-[10px] sm:text-[11px] text-rose-300 font-bold block truncate">غير مؤهل للأغلاق</span>
            <div className="text-lg sm:text-2xl font-black text-rose-400 mt-1 font-mono">{stats.unqualified}</div>
            <span className="text-[9px] sm:text-[10px] text-rose-200 block truncate">تتطلب استكمال أو ملاحظات</span>
          </div>

          <div className="bg-slate-800/80 p-2 sm:p-3 rounded-xl border border-slate-700/80 text-right min-w-0">
            <span className="text-[10px] sm:text-[11px] text-amber-300 font-medium block truncate">نسبة الجاهزية والامتثال</span>
            <div className="text-lg sm:text-2xl font-black text-amber-400 mt-1 font-mono">{stats.completionRate}%</div>
            <div className="w-full bg-slate-700 h-1 sm:h-1.5 rounded-full mt-1.5 sm:mt-2 overflow-hidden">
              <div 
                className="bg-amber-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Office Mini Breakdown */}
        {stats.officeBreakdown.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center gap-2 flex-wrap text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span>توزيع المكاتب:</span>
            </span>
            {stats.officeBreakdown.map(ob => (
              <span key={ob.office} className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 text-[11px] flex items-center gap-1">
                <strong>{ob.office}:</strong>
                <span className="text-white font-bold">{ob.total}</span>
                <span className="text-emerald-400">({ob.qualified} مؤهل)</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Archive Modal for Past Preserved Reports */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-right animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm sm:text-base">سجل الأرشيف الدائم للتقارير الإحصائية</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsArchiveModalOpen(false);
                  setViewingArchive(null);
                }}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              <p className="text-xs text-slate-500">
                هذه التقارير محفوظة بشكل دائم في السحابة حتى لو تم مسح الجداول أو حذف الأقسام، ويمكن الاطلاع عليها وتصديرها في أي وقت:
              </p>

              {archivedReports.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  لا توجد تقارير محفوظة في الأرشيف حتى الآن. يمكنك النقر على "حفظ في الأرشيف الدائم" لحفظ تقرير هذه الفترة.
                </div>
              ) : (
                archivedReports.map(rep => (
                  <div key={rep.id} className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/60 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm">
                        {rep.title}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(rep.createdAt).toLocaleDateString('ar-SA')}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-200 text-xs text-center">
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-[10px] text-slate-400 block">الإجمالي</span>
                        <strong className="text-slate-900">{rep.totalOrders}</strong>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-[10px] text-emerald-600 block">مؤهل للإغلاق</span>
                        <strong className="text-emerald-700">{rep.qualifiedOrders}</strong>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-[10px] text-rose-600 block">غير مؤهل</span>
                        <strong className="text-rose-700">{rep.unqualifiedOrders}</strong>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-[10px] text-amber-600 block">نسبة الإنجاز</span>
                        <strong className="text-amber-700">{rep.completionRate}%</strong>
                      </div>
                    </div>

                    {/* Office breakdown in archive */}
                    {rep.officeBreakdown && rep.officeBreakdown.length > 0 && (
                      <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                        {rep.officeBreakdown.map(o => (
                          <span key={o.office} className="bg-white px-2 py-0.5 rounded border border-slate-200">
                            {o.office}: <strong>{o.total}</strong> ({o.qualified} مؤهل)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsArchiveModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
