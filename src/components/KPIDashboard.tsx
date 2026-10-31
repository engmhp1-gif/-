import React, { useState } from 'react';
import { 
  WorkOrder, 
  SubOffice,
  PlatformUser,
  MonthTable
} from '../types';
import { 
  BadgeCheck, 
  AlertCircle, 
  Building2, 
  RotateCcw, 
  Check, 
  FileSpreadsheet,
  Award,
  Zap,
  TrendingUp,
  Sparkles,
  Camera,
  Users,
  Briefcase,
  FileDown,
  Calendar,
  BarChart3
} from 'lucide-react';
import { ContractorClosureReportModal } from './ContractorClosureReportModal';
import { hasUserPermission } from '../utils/security';
import { UnifiedSectionExportBar } from './UnifiedSectionExportBar';

export type KPIFilterType = 'all' | 'ready155' | 'notReady155';

interface KPIDashboardProps {
  workOrders: WorkOrder[];
  allWorkOrders?: WorkOrder[];
  offices?: SubOffice[];
  activeFilter: KPIFilterType;
  onSelectFilter: (filter: KPIFilterType) => void;
  selectedOffice: string;
  activePeriodLabel?: string;
  activeYear?: number;
  activeMonth?: number | 'all';
  onOpenWeeklyReport?: () => void;
  onOpenOfficeComparison?: () => void;
  onOpenContractorComparison?: () => void;
  onOpenSmartAudit?: () => void;
  onOpenComprehensiveReports?: (initialMode?: 'aggregated' | 'detailed') => void;
  onOpenExportModal?: (orders: WorkOrder[], title: string, openEmail?: boolean) => void;
  monthTables?: MonthTable[];
  currentUser?: PlatformUser | null;
}

export const KPIDashboard: React.FC<KPIDashboardProps> = ({
  workOrders,
  allWorkOrders,
  offices = [],
  monthTables = [],
  activeFilter,
  onSelectFilter,
  selectedOffice,
  activePeriodLabel,
  activeYear,
  activeMonth,
  onOpenWeeklyReport,
  onOpenOfficeComparison,
  onOpenContractorComparison,
  onOpenSmartAudit,
  onOpenComprehensiveReports,
  onOpenExportModal,
  currentUser
}) => {
  const [isContractorModalOpen, setIsContractorModalOpen] = useState(false);
  const [selectedMatrixOffice, setSelectedMatrixOffice] = useState<string>('all');

  const handleOpenContractorReport = () => {
    if (onOpenContractorComparison) {
      onOpenContractorComparison();
    } else {
      setIsContractorModalOpen(true);
    }
  };

  const totalOrders = workOrders.length;
  
  // 1. Qualified / Approved for Closure (مؤهل للاغلاق ( معتمد ))
  const ready155Orders = workOrders.filter(w => {
    const s = String(w.procedure155Status || '');
    if (s.includes('غير')) return false;
    return s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم');
  });
  const ready155Count = ready155Orders.length;
  const ready155Rate = totalOrders > 0 ? Math.round((ready155Count / totalOrders) * 100) : 0;

  // 2. Not Qualified for Closure (غير مؤهل للأغلاق)
  const notReady155Orders = workOrders.filter(w => {
    const s = String(w.procedure155Status || '');
    if (s.includes('غير')) return true;
    return !(s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم'));
  });
  const notReady155Count = notReady155Orders.length;
  const notReady155Rate = totalOrders > 0 ? Math.round((notReady155Count / totalOrders) * 100) : 0;

  // 3. Overall Quality Index (مؤشر الجودة العام)
  const qualityIndex = totalOrders > 0 ? ready155Rate : 100;

  // 4. Contractor breakdown for analytics (filtered by selectedMatrixOffice if chosen)
  const contractorMetrics = React.useMemo(() => {
    const map: Record<string, { total: number; ready: number; notReady: number; officesSet: Set<string> }> = {};
    const sourceList = selectedMatrixOffice === 'all'
      ? workOrders
      : workOrders.filter(o => o.office === selectedMatrixOffice);

    sourceList.forEach(o => {
      const c = (o.contractor || 'غير محدد').trim();
      if (!map[c]) map[c] = { total: 0, ready: 0, notReady: 0, officesSet: new Set() };
      map[c].total += 1;
      if (o.office) map[c].officesSet.add(o.office);
      const s = String(o.procedure155Status || '');
      const isReady = !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم'));
      if (isReady) map[c].ready += 1;
      else map[c].notReady += 1;
    });

    return Object.entries(map).map(([name, data]) => ({
      name,
      officesText: Array.from(data.officesSet).join(' ، ') || 'غير محدد',
      total: data.total,
      ready: data.ready,
      notReady: data.notReady,
      rate: data.total > 0 ? Math.round((data.ready / data.total) * 100) : 0
    })).sort((a, b) => {
      if (b.rate !== a.rate) return b.rate - a.rate;
      return b.total - a.total;
    });
  }, [workOrders, selectedMatrixOffice]);

  const topContractor = contractorMetrics[0] || null;
  const avgContractorClosureRate = contractorMetrics.length > 0
    ? Math.round(contractorMetrics.reduce((acc, c) => acc + c.rate, 0) / contractorMetrics.length)
    : 0;

  // 5. Documentation readiness
  const withPhotosCount = React.useMemo(() => {
    return workOrders.filter(w => (w.photos && w.photos.length > 0) || String(w.photoDocumentation).includes('مكتمل') || String(w.photoCoordination).includes('مرفق')).length;
  }, [workOrders]);
  const photoRate = totalOrders > 0 ? Math.round((withPhotosCount / totalOrders) * 100) : 0;

  return (
    <div className="mb-5 sm:mb-6 font-['Cairo',sans-serif] text-right">
      
      {/* Top Header Row: Title, Scope, and Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-xs shrink-0">
            <Zap className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                حوكمة جودة اعمال الانشاءات • بطاقات مؤشرات الإغلاق ومقارنة المقاولين
              </h2>
              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold border border-emerald-300">
                إجراء 155
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5">
              إحصائيات تفاعلية ومقارنة فورية لنسب إنجاز الإغلاقات بين المقاولين في المكاتب مع تصدير التقارير الدورية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {hasUserPermission(currentUser, 'exportTable') && (
            <UnifiedSectionExportBar
              orders={workOrders}
              sectionTitle={`مؤشرات_الأداء_KPI_${activePeriodLabel || selectedOffice || 'جميع_المكاتب'}`}
              onOpenExportModal={onOpenExportModal}
              variant="light"
            />
          )}

          {/* Comprehensive Unified Reports Hub (Detailed & Aggregated) */}
          {onOpenComprehensiveReports && (
            <button
              type="button"
              onClick={() => onOpenComprehensiveReports('aggregated')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-2xs transition-all cursor-pointer border border-slate-700 active:scale-95"
              title="فتح مركز التقارير الموحد: تقارير تفصيلية وتقارير مجمعة (أسبوعية • شهرية • ربع سنوية • نصف سنوية • سنوية)"
            >
              <BarChart3 className="w-4 h-4 text-slate-300 shrink-0" />
              <span>مركز التقارير (تفصيلية ومجمعة)</span>
            </button>
          )}

          {/* Contractor Closure Comparison & Periodic Reports Button */}
          {hasUserPermission(currentUser, 'viewContractorClosureReport') && (
            <button
              type="button"
              onClick={handleOpenContractorReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-2xs transition-all cursor-pointer border border-slate-700"
              title="مقارنة المقاولين في المكاتب بنسبة إنجاز الإغلاقات وتصدير تقرير أسبوعي أو شهري أو ربع سنوي أو نصف سنوي أو سنوي"
            >
              <Briefcase className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>مقارنة إغلاقات المقاولين والتقارير الدورية</span>
            </button>
          )}



          {/* Quick Office Comparison Button */}
          {onOpenOfficeComparison && hasUserPermission(currentUser, 'viewOfficeComparison') && (
            <button
              type="button"
              onClick={onOpenOfficeComparison}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-all cursor-pointer shadow-2xs"
              title="مقارنة أداء المكاتب الفرعية وتصنيفها التنافسي"
            >
              <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>مقارنة أداء المكاتب</span>
            </button>
          )}

          {/* Quick Weekly Report Button */}
          {onOpenWeeklyReport && hasUserPermission(currentUser, 'viewWeeklyReport') && (
            <button
              type="button"
              onClick={onOpenWeeklyReport}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 transition-all cursor-pointer shadow-2xs"
              title="توليد التقرير الأسبوعي الرسمي وتصديره كملف PDF"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>التقرير الأسبوعي PDF</span>
            </button>
          )}

          {/* Active Filter Pill with Reset Button */}
          {activeFilter !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectFilter('all')}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-black bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-400 transition-all cursor-pointer shadow-xs animate-in fade-in"
              title="انقر لإلغاء الفلتر والعودة لكافة أوامر العمل"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-800 animate-spin-hover shrink-0" />
              <span>
                إلغاء الفلتر النشط ({activeFilter === 'ready155' ? 'مؤهل للاغلاق ( معتمد )' : 'غير مؤهل للأغلاق'})
              </span>
            </button>
          )}

          {/* Current Scope & Period Indicator */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>نطاق العرض:</span>
            <strong className="text-blue-700">{selectedOffice === 'all' ? 'كافة المكاتب' : selectedOffice}</strong>
            {activePeriodLabel && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-700 font-semibold">{activePeriodLabel}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 5 KPI Cards Row:
          1. اجمالي الاوامر
          2. مؤهل للاغلاق ( معتمد )
          3. غير مؤهل للأغلاق
          4. مؤشر الجودة العام
          5. مقارنة إغلاقات المقاولين في المكاتب (NEW KPI + Periodic Reports) */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 ${hasUserPermission(currentUser, 'viewContractorClosureReport') ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-2 sm:gap-2.5 md:gap-3 w-full`}>
        
        {/* Card 1: اجمالي الاوامر (Total Work Orders) */}
        <div
          onClick={() => onSelectFilter('all')}
          className={`min-w-0 relative p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all duration-200 cursor-pointer text-right flex flex-col justify-between select-none ${
            activeFilter === 'all'
              ? 'bg-blue-50/95 border-blue-600 ring-2 ring-blue-500 shadow-sm'
              : 'bg-white border-slate-200/90 hover:border-blue-400 hover:shadow-xs'
          }`}
          title="عرض كافة أوامر العمل في الجدول دون فلترة"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs md:text-sm font-black text-slate-800 leading-tight">
              اجمالي الاوامر
            </span>
            <div className={`p-1.5 rounded-xl shrink-0 transition-colors ${
              activeFilter === 'all' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight font-mono">
                {totalOrders}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-500 font-bold">
                أمر مسجل
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium truncate">
              {selectedOffice === 'all' ? 'كافة المكاتب الفرعية' : selectedOffice}
            </div>
          </div>

          {activeFilter === 'all' ? (
            <div className="mt-2 pt-1.5 border-t border-blue-200 text-[10px] font-bold text-blue-700 flex items-center gap-1">
              <Check className="w-3 h-3 shrink-0" />
              <span className="truncate">عرض كامل الأوامر</span>
            </div>
          ) : (
            <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-400 font-medium truncate">
              انقر لعرض الكل
            </div>
          )}
        </div>

        {/* Card 2: مؤهل للاغلاق ( معتمد ) */}
        <div
          onClick={() => onSelectFilter(activeFilter === 'ready155' ? 'all' : 'ready155')}
          className={`min-w-0 relative p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all duration-200 cursor-pointer text-right flex flex-col justify-between select-none ${
            activeFilter === 'ready155'
              ? 'bg-emerald-50/95 border-emerald-600 ring-2 ring-emerald-500 shadow-sm'
              : 'bg-white border-slate-200/90 hover:border-emerald-400 hover:shadow-xs'
          }`}
          title="تصفية الجدول لعرض الأوامر: مؤهل للاغلاق ( معتمد )"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs md:text-sm font-black text-emerald-900 leading-tight">
              مؤهل للاغلاق <span className="font-bold text-emerald-700 whitespace-nowrap">( معتمد )</span>
            </span>
            <div className={`p-1.5 rounded-xl shrink-0 transition-colors ${
              activeFilter === 'ready155' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              <BadgeCheck className="w-4 h-4 shrink-0" />
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg sm:text-xl md:text-2xl font-black text-emerald-700 tracking-tight font-mono">
                {ready155Count}
              </span>
              <span className="text-xs font-black text-emerald-800 font-mono bg-emerald-100/90 px-1.5 py-0.5 rounded-md">
                {ready155Rate}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div 
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${ready155Rate}%` }}
              />
            </div>
            <div className="text-[10px] text-emerald-700 font-bold mt-1 truncate">
              جاهز للاعتماد والاستلام
            </div>
          </div>

          {activeFilter === 'ready155' ? (
            <div className="mt-2 pt-1.5 border-t border-emerald-300 text-[10px] font-black text-emerald-800 flex items-center gap-1">
              <Check className="w-3 h-3 shrink-0" />
              <span className="truncate">مفلتر نشط (المؤهلة فقط)</span>
            </div>
          ) : (
            <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-emerald-700 font-semibold truncate">
              انقر لفلترة المؤهلة
            </div>
          )}
        </div>

        {/* Card 3: غير مؤهل للأغلاق */}
        <div
          onClick={() => onSelectFilter(activeFilter === 'notReady155' ? 'all' : 'notReady155')}
          className={`min-w-0 relative p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all duration-200 cursor-pointer text-right flex flex-col justify-between select-none ${
            activeFilter === 'notReady155'
              ? 'bg-rose-50/95 border-rose-600 ring-2 ring-rose-500 shadow-sm'
              : 'bg-white border-slate-200/90 hover:border-rose-400 hover:shadow-xs'
          }`}
          title="تصفية الجدول لعرض الأوامر: غير مؤهل للأغلاق"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs md:text-sm font-black text-rose-900 leading-tight">
              غير مؤهل للأغلاق
            </span>
            <div className={`p-1.5 rounded-xl shrink-0 transition-colors ${
              activeFilter === 'notReady155' 
                ? 'bg-rose-600 text-white shadow-xs' 
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg sm:text-xl md:text-2xl font-black text-rose-700 tracking-tight font-mono">
                {notReady155Count}
              </span>
              <span className="text-xs font-black text-rose-800 font-mono bg-rose-100/90 px-1.5 py-0.5 rounded-md">
                {notReady155Rate}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div 
                className="bg-rose-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${notReady155Rate}%` }}
              />
            </div>
            <div className="text-[10px] text-rose-700 font-bold mt-1 truncate">
              نواقص وملاحظات قيد الاستيفاء
            </div>
          </div>

          {activeFilter === 'notReady155' ? (
            <div className="mt-2 pt-1.5 border-t border-rose-300 text-[10px] font-black text-rose-800 flex items-center gap-1">
              <Check className="w-3 h-3 shrink-0" />
              <span className="truncate">مفلتر نشط (غير المؤهلة فقط)</span>
            </div>
          ) : (
            <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-rose-700 font-semibold truncate">
              انقر لفلترة غير المؤهلة
            </div>
          )}
        </div>

        {/* Card 4: مؤشر الجودة العام (Overall Quality Index) */}
        <div 
          onClick={() => onSelectFilter(activeFilter === 'ready155' ? 'all' : 'ready155')}
          className="min-w-0 relative p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white text-right flex flex-col justify-between shadow-xs select-none cursor-pointer hover:border-slate-700 transition-all"
          title="مؤشر الجودة العام ونسبة الامتثال - انقر للتصفية"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs md:text-sm font-black text-slate-100 leading-tight">
              مؤشر الجودة العام
            </span>
            <div className="p-1.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30 shrink-0">
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg sm:text-xl md:text-2xl font-black text-emerald-400 tracking-tight font-mono">
                {qualityIndex}%
              </span>
              <span className="text-[10px] sm:text-xs text-slate-300 font-bold">
                نسبة الامتثال
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-400 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${qualityIndex}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-300 font-medium mt-1 flex items-center justify-between gap-1 truncate">
              <span className="truncate">الجاهزية والاعتماد</span>
              <span className="text-emerald-400 font-bold shrink-0">{qualityIndex >= 70 ? 'ممتاز' : qualityIndex >= 50 ? 'متوسط' : 'يحتاج تحسين'}</span>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-700/60 text-[10px] text-slate-300 flex items-center justify-between gap-1">
            <span className="truncate">محدث تلقائياً</span>
            <span className="font-mono text-emerald-400 font-bold shrink-0">{ready155Count}/{totalOrders}</span>
          </div>
        </div>

        {/* Card 5 (NEW KPI): مقارنة المقاولين في المكاتب بنسبة إنجاز الإغلاقات + تصدير التقارير الدورية */}
        {hasUserPermission(currentUser, 'viewContractorClosureReport') && (
          <div
            onClick={handleOpenContractorReport}
            className="col-span-2 sm:col-span-1 min-w-0 relative p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border-2 border-indigo-500/40 bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950 text-white text-right flex flex-col justify-between shadow-sm select-none cursor-pointer hover:border-amber-400/70 transition-all group"
            title="انقر لفتح مقارنة المقاولين في المكاتب بنسبة إنجاز الإغلاقات وتصدير تقرير (أسبوعي / شهري / ربع سنوي / نصف سنوي / سنوي)"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] sm:text-xs md:text-sm font-black text-amber-300 leading-tight">
                مقارنة إغلاقات المقاولين
              </span>
              <div className="p-1.5 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40 shrink-0 group-hover:scale-110 transition-transform">
                <Briefcase className="w-4 h-4 shrink-0" />
              </div>
            </div>

            <div className="mt-2">
              <div className="flex items-baseline justify-between gap-1 flex-wrap">
                <div className="flex items-baseline gap-1">
                  <span className="text-lg sm:text-xl md:text-2xl font-black text-white tracking-tight font-mono">
                    {avgContractorClosureRate}%
                  </span>
                  <span className="text-[10px] text-emerald-300 font-bold">
                    متوسط الإغلاق
                  </span>
                </div>
                <span className="text-[10px] font-mono font-black bg-white/10 px-1.5 py-0.5 rounded text-amber-200">
                  {contractorMetrics.length} مقاول
                </span>
              </div>

              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${avgContractorClosureRate}%` }}
                />
              </div>

              <div className="text-[10px] text-slate-200 font-bold mt-1 truncate">
                {topContractor ? `الأعلى إغلاقاً: ${topContractor.name} (${topContractor.rate}%)` : 'مقارنة نسب الإغلاق بالمكاتب'}
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-white/15 text-[9.5px] font-black text-amber-300 flex items-center justify-between gap-1">
              <span className="truncate">تصدير: أسبوعي • شهري • ربع • نصف • سنوي</span>
              <FileDown className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            </div>
          </div>
        )}

      </div>

      {/* Contractor Compliance Matrix & Field Quality Audit Breakdown */}
      {hasUserPermission(currentUser, 'viewContractorClosureReport') && contractorMetrics.length > 0 && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Contractor Compliance Ranking */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 text-right">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900">
                    مقارنة المقاولين في المكاتب بنسبة إنجاز الإغلاقات (إجراء 155)
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    ترتيب تنافسي للمقاولين من حيث نسبة الإغلاق المعتمدة وإمكانية تصدير التقارير الدورية
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {offices.length > 0 && (
                  <select
                    value={selectedMatrixOffice}
                    onChange={e => setSelectedMatrixOffice(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="all">جميع المكاتب ({workOrders.length})</option>
                    {offices.map(off => (
                      <option key={off.id} value={off.name}>
                        {off.name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={handleOpenContractorReport}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black shadow-2xs transition-colors cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-amber-200" />
                  <span>تصدير تقرير (أسبوعي / شهري / ربع / نصف / سنوي)</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {contractorMetrics.slice(0, 7).map((cm, idx) => (
                <div key={cm.name} className="flex items-center justify-between gap-3 text-xs bg-slate-50/70 hover:bg-slate-100/80 px-3 py-2 rounded-xl border border-slate-200/60 transition-colors">
                  <div className="flex items-center gap-2 min-w-0 w-52">
                    <span className={`w-5 h-5 rounded-full text-[10px] font-mono font-black flex items-center justify-center shrink-0 ${
                      idx === 0 ? 'bg-amber-400 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-900' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-black text-slate-900 truncate" title={cm.name}>
                        {cm.name}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate" title={cm.officesText}>
                        {cm.officesText}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-[100px]">
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          cm.rate >= 70 ? 'bg-emerald-600' : cm.rate >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${cm.rate}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                    <span className="font-black text-emerald-700">{cm.ready} مغلق</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-slate-600 font-bold">{cm.total} إجمالي</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[11px] font-black min-w-[44px] text-center ${
                      cm.rate >= 70 ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : cm.rate >= 40 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-rose-100 text-rose-900 border border-rose-300'
                    }`}>
                      {cm.rate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quality Documentation Assurance Box - Styled with Rich Blue Theme & High-Contrast Typography */}
          <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white rounded-2xl p-4 border-2 border-blue-400/60 shadow-md flex flex-col justify-between text-right">
            <div>
              <div className="flex items-center gap-2.5 mb-3.5 pb-3 border-b border-blue-400/40">
                <div className="w-8 h-8 rounded-xl bg-white/20 text-white border border-white/30 flex items-center justify-center shadow-xs shrink-0">
                  <Camera className="w-4 h-4 text-cyan-200" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-white leading-tight">
                    التوثيق الميداني وتقارير الإغلاق
                  </h4>
                  <span className="text-[10.5px] text-blue-100 font-semibold block mt-0.5">
                    اكتمال متطلبات الصور وتقارير المقاولين المعتمدة
                  </span>
                </div>
              </div>

              <div className="space-y-3.5">
                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5 font-bold">
                    <span className="text-blue-50">نسبة اكتمال الصور الميدانية</span>
                    <span className="font-mono font-black text-white bg-white/20 px-2 py-0.5 rounded-lg border border-white/30">{photoRate}%</span>
                  </div>
                  <div className="w-full bg-blue-950/70 border border-blue-400/30 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-cyan-300 to-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${photoRate}%` }} />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-950/50 border border-blue-300/40 text-[11px] text-blue-50 leading-relaxed font-semibold">
                  📊 <strong className="text-amber-300 font-black">تقارير إغلاقات المقاولين:</strong> يمكنك استخراج تقارير مقارنة المقاولين في المكاتب (أسبوعي، شهري، ربع سنوي، نصف سنوي، سنوي) بصيغة PDF وExcel وPNG بتنسيق قياسي.
                </div>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <button
                type="button"
                onClick={handleOpenContractorReport}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95"
              >
                <FileDown className="w-4 h-4 text-slate-950" />
                <span>تصدير تقارير إغلاقات المقاولين الدورية</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Built-in Contractor Closure Report Modal if not controlled externally */}
      <ContractorClosureReportModal
        isOpen={isContractorModalOpen}
        onClose={() => setIsContractorModalOpen(false)}
        workOrders={allWorkOrders || workOrders}
        offices={offices}
        selectedOffice={selectedOffice}
        activeYear={activeYear}
        activeMonth={activeMonth}
      />

    </div>
  );
};
