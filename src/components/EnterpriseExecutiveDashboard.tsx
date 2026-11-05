import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  BadgeCheck,
  Clock,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Headphones,
  Download,
  PieChart,
  FileText,
  BarChart2,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  AlertTriangle,
  Flame,
  Calendar,
  TableProperties,
  ChevronDown,
  Plus,
  Building2,
  Archive
} from 'lucide-react';
import { WorkOrder, SubOffice, MonthTable, PlatformUser } from '../types';
import {
  getArabicMonthName,
  getDefaultTableId,
  isDefaultTableId,
  isTableInPeriod
} from '../utils/tableScope';
import { SidebarSectionId } from './SidebarActions';
import { KPIFilterType } from './KPIDashboard';
import {
  getEvaluatedSupportChecklistKeys,
  getEvaluatedColumnSupportChecklistKeys
} from './TechnicalSupportAuditModal';
import {
  isOrderQualified100InAllThreeAudits,
  isOrderArchivedIn155,
  getEffectiveProcedure155Status,
  getOrderAuditTrackerInfo
} from '../utils/auditTracker';
import { KPIContentPopupModal, KPIContentPopupData } from './KPIContentPopupModal';

interface EnterpriseExecutiveDashboardProps {
  workOrders: WorkOrder[];
  allWorkOrders?: WorkOrder[];
  offices?: SubOffice[];
  monthTables?: MonthTable[];
  selectedOffice: string;
  onSelectOffice?: (office: string) => void;
  onNavigateSection?: (section: SidebarSectionId) => void;
  activeYear?: number;
  activeMonth?: number | 'all';
  selectedTableId?: string;
  onSelectPeriod?: (year: number, month: number | 'all', tableId?: string) => void;
  onOpenYearMonthPicker?: () => void;
  onNavigateToOrderInTable?: (order: WorkOrder) => void;
  activePeriodLabel?: string;
  onOpenWeeklyReport?: () => void;
  onOpenOfficeComparison?: () => void;
  onOpenContractorComparison?: () => void;
  onOpenComprehensiveReports?: (initialMode?: 'aggregated' | 'detailed') => void;
  onOpenExportModal?: (orders?: WorkOrder[], title?: string, openEmail?: boolean) => void;
  onOpen155Guide?: () => void;
  onOpenAuditTrackerModal?: () => void;
  onOpenNotesReport?: () => void;
  urgentCount?: number;
  urgentDisqualifiedCount?: number;
  urgentQualifiedCount?: number;
  fullyAuditedCount?: number;
  completedAuditCount?: number;
  archive155Count?: number;
  onOpenCompletedAuditSection?: () => void;
  onOpenArchive155Section?: () => void;
  onSelectFilter?: (filter: KPIFilterType) => void;
  activeFilter?: KPIFilterType;
  currentUser?: PlatformUser | null;
}

export const EnterpriseExecutiveDashboard: React.FC<EnterpriseExecutiveDashboardProps> = ({
  workOrders = [],
  allWorkOrders = [],
  offices = [],
  monthTables = [],
  selectedOffice,
  onSelectOffice,
  onNavigateSection,
  activeYear = new Date().getFullYear(),
  activeMonth = 'all',
  selectedTableId = 'all',
  onSelectPeriod,
  onOpenYearMonthPicker,
  onNavigateToOrderInTable,
  activePeriodLabel,
  onOpenWeeklyReport,
  onOpenOfficeComparison,
  onOpenContractorComparison,
  onOpenComprehensiveReports,
  onOpenExportModal,
  onOpen155Guide,
  onOpenAuditTrackerModal,
  onOpenNotesReport,
  urgentCount = 0,
  urgentDisqualifiedCount = 0,
  onSelectFilter,
  activeFilter = 'all'
}) => {
  const [kpiPopup, setKpiPopup] = useState<KPIContentPopupData | null>(null);

  // Scoped workOrders (already filtered by activeYear, activeMonth, selectedTableId, selectedOffice in App.tsx)
  const currentOrders = workOrders;
  const totalOrders = currentOrders.length;

  // Available years for selector
  const availableYears = useMemo(() => {
    const yrs = new Set<number>([2024, 2025, 2026, 2027, activeYear]);
    monthTables.forEach((t) => {
      if (t.year) yrs.add(Number(t.year));
    });
    allWorkOrders.forEach((w) => {
      if (w.tableYear) yrs.add(Number(w.tableYear));
    });
    return Array.from(yrs).sort((a, b) => a - b);
  }, [monthTables, allWorkOrders, activeYear]);

  const normalizedMonth: number | 'all' = activeMonth === 'all' ? 'all' : Number(activeMonth);

  const defaultTblId = useMemo(
    () => getDefaultTableId(activeYear, normalizedMonth),
    [activeYear, normalizedMonth]
  );

  const periodCustomTables = useMemo(
    () =>
      monthTables.filter(
        (t) => !isDefaultTableId(t.id) && !t.isDefault && isTableInPeriod(t, activeYear, normalizedMonth)
      ),
    [monthTables, activeYear, normalizedMonth]
  );

  // 1. Ready 155 / Completed (in current selected scope)
  const ready155Orders = useMemo(() => {
    return currentOrders.filter((w) => {
      const evalKeys = getEvaluatedSupportChecklistKeys(w);
      const s = String(w.procedure155Status || '').trim();
      const eff155 = getEffectiveProcedure155Status(w);
      return (
        isOrderQualified100InAllThreeAudits(w) ||
        (!eff155.includes('غير') && (eff155.includes('مؤهل') || eff155.includes('تم'))) ||
        (evalKeys.length > 0 && !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد')))
      );
    });
  }, [currentOrders]);
  const ready155Count = ready155Orders.length;
  const ready155Rate = totalOrders > 0 ? Math.round((ready155Count / totalOrders) * 100) : 0;

  // 2. In Progress / Under Audit (in current selected scope)
  const inProgressOrders = useMemo(() => {
    return currentOrders.filter((w) => {
      const evalKeys = getEvaluatedSupportChecklistKeys(w);
      const pdcEval = getEvaluatedColumnSupportChecklistKeys(w, 'pdcAudit');
      const constEval = getEvaluatedColumnSupportChecklistKeys(w, 'constructionAudit');
      const s = String(w.procedure155Status || '').trim();
      const eff155 = getEffectiveProcedure155Status(w);
      const hasAnyEval =
        evalKeys.length > 0 ||
        pdcEval.length > 0 ||
        constEval.length > 0 ||
        Boolean(s && s !== 'قيد التدقيق' && s !== 'قيد التدقيق الفني') ||
        Boolean(eff155);
      if (!hasAnyEval) return false;
      const isReady =
        isOrderQualified100InAllThreeAudits(w) ||
        (!eff155.includes('غير') && (eff155.includes('مؤهل') || eff155.includes('تم'))) ||
        (evalKeys.length > 0 && !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد')));
      const isDisqualified = s.includes('غير') || eff155.includes('غير');
      return !isReady && !isDisqualified;
    });
  }, [currentOrders]);
  const inProgressCount = inProgressOrders.length;

  // 3. Disqualified / Notes (in current selected scope)
  const disqualifiedOrders = useMemo(() => {
    return currentOrders.filter((w) => {
      const evalKeys = getEvaluatedSupportChecklistKeys(w);
      const pdcEval = getEvaluatedColumnSupportChecklistKeys(w, 'pdcAudit');
      const constEval = getEvaluatedColumnSupportChecklistKeys(w, 'constructionAudit');
      const s = String(w.procedure155Status || '').trim();
      const eff155 = getEffectiveProcedure155Status(w);
      const hasAnyEval =
        evalKeys.length > 0 ||
        pdcEval.length > 0 ||
        constEval.length > 0 ||
        Boolean(s && s !== 'قيد التدقيق' && s !== 'قيد التدقيق الفني') ||
        Boolean(eff155);
      if (!hasAnyEval) return false;
      const isReady =
        isOrderQualified100InAllThreeAudits(w) ||
        (!eff155.includes('غير') && (eff155.includes('مؤهل') || eff155.includes('تم'))) ||
        (evalKeys.length > 0 && !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد')));
      return !isReady && (s.includes('غير') || eff155.includes('غير'));
    });
  }, [currentOrders]);
  const disqualifiedCount = disqualifiedOrders.length;

  // Urgent orders list in current scope (or platform-wide if urgentCount > 0)
  const urgentOrdersList = useMemo(() => {
    const scopedUrgent = currentOrders.filter((w) => {
      const info = getOrderAuditTrackerInfo(w);
      return info.hasAuditStarted && !info.isFullyAuditedByAllThree;
    });
    if (scopedUrgent.length > 0) return scopedUrgent;
    return (allWorkOrders.length > 0 ? allWorkOrders : currentOrders).filter((w) => {
      const info = getOrderAuditTrackerInfo(w);
      return info.hasAuditStarted && !info.isFullyAuditedByAllThree;
    });
  }, [currentOrders, allWorkOrders]);

  const effectiveUrgentTotal = urgentOrdersList.length || urgentCount;

  // Audited (تم التدقيق عليه) & Archive 155 (ارشيف 155) in current scope
  const auditedWaiting155Orders = useMemo(
    () => currentOrders.filter((w) => isOrderQualified100InAllThreeAudits(w) && !isOrderArchivedIn155(w)),
    [currentOrders]
  );
  const archived155Orders = useMemo(
    () => currentOrders.filter((w) => isOrderArchivedIn155(w)),
    [currentOrders]
  );

  // 4. Distribution by Office (Synchronized with currentOrders scope!)
  const officeDistribution = useMemo(() => {
    const list = currentOrders;
    const knownOffices = offices.length > 0 ? offices.map((o) => o.name) : ['عرعر', 'رفحاء', 'طريف', 'العويقيلة'];
    const ordersByOffice: Record<string, WorkOrder[]> = {};
    knownOffices.forEach((off) => {
      ordersByOffice[off] = [];
    });
    const otherOrders: WorkOrder[] = [];

    list.forEach((w) => {
      const off = (w.office || '').trim();
      const matched = knownOffices.find((k) => off === k || off.includes(k) || k.includes(off));
      if (matched) {
        ordersByOffice[matched].push(w);
      } else if (off) {
        otherOrders.push(w);
      }
    });

    const total = list.length || 1;
    const colors = ['#004B8D', '#10B981', '#F58220', '#8B5CF6', '#64748B'];
    const items = knownOffices.map((name, idx) => {
      const offList = ordersByOffice[name] || [];
      const count = offList.length;
      const pct = list.length > 0 ? Math.round((count / total) * 100) : 0;
      return {
        name,
        count,
        orders: offList,
        pct,
        color: colors[idx % colors.length]
      };
    });

    if (otherOrders.length > 0) {
      items.push({
        name: 'أخرى',
        count: otherOrders.length,
        orders: otherOrders,
        pct: list.length > 0 ? Math.round((otherOrders.length / total) * 100) : 0,
        color: '#94A3B8'
      });
    }

    return { total: list.length, items };
  }, [currentOrders, offices]);

  // SVG Donut calculation
  const donutSegments = useMemo(() => {
    const total = officeDistribution.total || 1;
    let accumulatedAngle = 0;
    return officeDistribution.items.map((item) => {
      const angle = officeDistribution.total > 0 ? (item.count / total) * 360 : 0;
      const startAngle = accumulatedAngle;
      accumulatedAngle += angle;
      return {
        ...item,
        startAngle,
        angle
      };
    });
  }, [officeDistribution]);

  // 5. Visits, Attachments and Quality Notes Bar Chart Data (100% real platform fields)
  const visitsAndNotes = useMemo(() => {
    const visitOrders = currentOrders.filter(
      (w) =>
        (w.photos && w.photos.length > 0) ||
        (w.photosFile && w.photosFile.length > 0) ||
        String(w.attachmentStatus || '').includes('جاهز')
    );
    const correctiveOrders = currentOrders.filter((w) => w.qualityNotes && w.qualityNotes.trim().length > 0);

    const totalVisits = visitOrders.length;
    const completedAudits = ready155Count;
    const correctiveNotes = correctiveOrders.length;

    const maxVal = Math.max(totalOrders, totalVisits, completedAudits, correctiveNotes, 1);
    return {
      visitOrders,
      correctiveOrders,
      totalVisits,
      completedAudits,
      correctiveNotes,
      maxVal,
      visitHeight: Math.min(100, Math.round((totalVisits / maxVal) * 100)),
      auditHeight: Math.min(100, Math.round((completedAudits / maxVal) * 100)),
      correctiveHeight: Math.min(100, Math.round((correctiveNotes / maxVal) * 100))
    };
  }, [currentOrders, ready155Count, totalOrders]);

  // 6. Offices Achievement Table Data (Synchronized with currentOrders scope)
  const officesPerformance = useMemo(() => {
    const list = currentOrders;
    const knownOffices = offices.length > 0 ? offices.map((o) => o.name) : ['عرعر', 'رفحاء', 'طريف', 'العويقيلة'];

    return knownOffices.map((name) => {
      const offOrders = list.filter((w) => {
        const off = (w.office || '').trim();
        return off === name || off.includes(name) || name.includes(off);
      });
      const target = offOrders.length;
      const actualOrders = offOrders.filter((w) => {
        const evalKeys = getEvaluatedSupportChecklistKeys(w);
        const s = String(w.procedure155Status || '').trim();
        const eff155 = getEffectiveProcedure155Status(w);
        return (
          isOrderQualified100InAllThreeAudits(w) ||
          (!eff155.includes('غير') && (eff155.includes('مؤهل') || eff155.includes('تم'))) ||
          (evalKeys.length > 0 && !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد')))
        );
      });
      const actual = actualOrders.length;
      const rate = target > 0 ? Math.round((actual / target) * 100) : 0;
      let statusLabel = target === 0 ? 'لا توجد أوامر' : 'يحتاج متابعة';
      let statusColor =
        target === 0
          ? 'bg-slate-100 text-slate-600 border-slate-300'
          : 'bg-rose-100 text-rose-800 border-rose-300';
      if (target > 0 && rate >= 90) {
        statusLabel = 'مكتمل';
        statusColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      } else if (target > 0 && rate >= 60) {
        statusLabel = 'جيد جداً';
        statusColor = 'bg-blue-100 text-blue-800 border-blue-300';
      }

      return {
        name,
        orders: offOrders,
        actualOrders,
        target,
        actual,
        rate,
        statusLabel,
        statusColor
      };
    });
  }, [currentOrders, offices]);

  return (
    <div className="w-full space-y-3.5 font-['Cairo',sans-serif] text-right" dir="rtl">
      {/* ========================================================================= */}
      {/* 0. UNIFIED TOP CONTROL BAR WITH COMPACT (YEAR / MONTH / TABLE / OFFICE)  */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-l from-[#001D40] via-[#002855] to-[#003B73] rounded-2xl border border-[#004B8D]/70 shadow-sm p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2.5 text-white">
        {/* Right: Title + Compact Dropdown Icons for (السنة • الشهر • الجدول • المكتب) */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-2 pl-2 border-l border-white/15">
            <div className="w-8 h-8 rounded-xl bg-[#F58220] text-white flex items-center justify-center shadow-xs shrink-0">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs sm:text-sm font-black text-white">
                  الصفحة الرئيسية ومؤشرات 155
                </h2>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[9.5px] font-black">
                  متزامن 100%
                </span>
              </div>
              <p className="text-[10px] text-blue-200 font-bold hidden sm:block">
                انقر على أي بطاقة أو رسم بياني لفتح قائمته المستقلة والتوجه للجدول
              </p>
            </div>
          </div>

          {/* 1. Compact Year Dropdown (السنة) */}
          <div className="relative inline-flex items-center shrink-0">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-black cursor-pointer transition-colors">
              <Calendar className="w-3.5 h-3.5 text-[#FDB813]" />
              <span className="text-[10px] text-blue-200">السنة:</span>
              <select
                value={activeYear}
                onChange={(e) => {
                  const yr = parseInt(e.target.value, 10);
                  if (onSelectPeriod) onSelectPeriod(yr, activeMonth, 'all');
                }}
                className="bg-transparent text-white font-black text-xs cursor-pointer focus:outline-none appearance-none pr-1 pl-3.5"
                title="اختر السنة للتحكم في مؤشرات الصفحة الرئيسية"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr} className="bg-[#002855] text-white">
                    {yr}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-blue-200 pointer-events-none -mr-2.5" />
            </div>
          </div>

          {/* 2. Compact Month Dropdown (الشهر) */}
          <div className="relative inline-flex items-center shrink-0">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-black cursor-pointer transition-colors">
              <Clock className="w-3.5 h-3.5 text-blue-300" />
              <span className="text-[10px] text-blue-200">الشهر:</span>
              <select
                value={activeMonth}
                onChange={(e) => {
                  const val = e.target.value;
                  const mn = val === 'all' ? 'all' : parseInt(val, 10);
                  if (onSelectPeriod) onSelectPeriod(activeYear, mn, 'all');
                }}
                className="bg-transparent text-white font-black text-xs cursor-pointer focus:outline-none appearance-none pr-1 pl-3.5"
                title="اختر الشهر للتحكم في مؤشرات الصفحة الرئيسية"
              >
                <option value="all" className="bg-[#002855] text-white">
                  كافة الشهور
                </option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m} className="bg-[#002855] text-white">
                    {getArabicMonthName(m)}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-blue-200 pointer-events-none -mr-2.5" />
            </div>
          </div>

          {/* 3. Compact Table Dropdown (الجدول) */}
          <div className="relative inline-flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-black cursor-pointer transition-colors">
              <TableProperties className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-blue-200">الجدول:</span>
              <select
                value={selectedTableId}
                onChange={(e) => {
                  const newTblId = e.target.value;
                  const matchedTbl = monthTables.find((t) => t.id === newTblId);
                  if (matchedTbl && onSelectPeriod) {
                    onSelectPeriod(matchedTbl.year, matchedTbl.month, matchedTbl.id);
                  } else if (onSelectPeriod) {
                    onSelectPeriod(activeYear, activeMonth, newTblId);
                  }
                }}
                className="bg-transparent text-white font-black text-xs cursor-pointer focus:outline-none appearance-none pr-1 pl-3.5 max-w-[155px] truncate"
                title="اختر الجدول للتحكم في ما يتم عرضه في المؤشرات"
              >
                <option value="all" className="bg-[#002855] text-white">
                  جميع الجداول ({normalizedMonth === 'all' ? activeYear : getArabicMonthName(normalizedMonth)})
                </option>
                <option value={defaultTblId} className="bg-[#002855] text-white">
                  الجدول الأساسي {normalizedMonth !== 'all' ? `(${getArabicMonthName(normalizedMonth)})` : ''}
                </option>
                {periodCustomTables.map((tbl) => (
                  <option key={tbl.id} value={tbl.id} className="bg-[#002855] text-white">
                    {tbl.name}
                  </option>
                ))}
                {monthTables
                  .filter(
                    (t) =>
                      !isDefaultTableId(t.id) &&
                      !t.isDefault &&
                      !isTableInPeriod(t, activeYear, normalizedMonth)
                  )
                  .map((tbl) => (
                    <option key={tbl.id} value={tbl.id} className="bg-[#001D40] text-blue-200">
                      {tbl.name} ({getArabicMonthName(tbl.month)} {tbl.year})
                    </option>
                  ))}
              </select>
              <ChevronDown className="w-3 h-3 text-blue-200 pointer-events-none -mr-2.5" />
            </div>

            {onOpenYearMonthPicker && (
              <button
                type="button"
                onClick={onOpenYearMonthPicker}
                className="p-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-black transition-colors cursor-pointer shrink-0 shadow-2xs"
                title="إدارة وإضافة جداول السنة والشهر"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 4. Compact Office Dropdown (المكتب) */}
          <div className="relative inline-flex items-center shrink-0">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-black cursor-pointer transition-colors">
              <Building2 className="w-3.5 h-3.5 text-[#F58220]" />
              <span className="text-[10px] text-blue-200">المكتب:</span>
              <select
                value={selectedOffice}
                onChange={(e) => {
                  if (onSelectOffice) onSelectOffice(e.target.value);
                }}
                className="bg-transparent text-white font-black text-xs cursor-pointer focus:outline-none appearance-none pr-1 pl-3.5"
                title="تصفية المؤشرات حسب المكتب الفرعي"
              >
                <option value="all" className="bg-[#002855] text-white">
                  كافة المكاتب
                </option>
                {(offices.length > 0
                  ? offices.map((o) => o.name)
                  : ['عرعر', 'رفحاء', 'طريف', 'العويقيلة']
                ).map((offName) => (
                  <option key={offName} value={offName} className="bg-[#002855] text-white">
                    {offName}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-blue-200 pointer-events-none -mr-2.5" />
            </div>
          </div>
        </div>

        {/* Left: Quick Action Button */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (onSelectFilter) onSelectFilter('all');
              if (onNavigateSection) onNavigateSection('work_orders');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F58220] hover:bg-[#d96b12] text-white text-xs font-black transition-all cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
            <span>فتح الجدول ({totalOrders})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. TOP 5 KPI METRIC CARDS (Clicking any card opens independent popup!)     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
        {/* Card 1: إجمالي أوامر العمل */}
        <div
          onClick={() =>
            setKpiPopup({
              title: 'إجمالي أوامر العمل في النطاق المحدد',
              subtitle: `جميع أوامر العمل المسجلة (${totalOrders} أمر عمل) • انقر على التوجه للجدول للانتقال لأي أمر مباشرة`,
              orders: currentOrders,
              filterType: 'all'
            })
          }
          title="انقر لفتح القائمة المستقلة لكافة أوامر العمل ومنها التوجه للجدول"
          className={`p-3.5 sm:p-4 rounded-2xl bg-[#004B8D] text-white shadow-md transition-all cursor-pointer border border-blue-900/60 relative overflow-hidden select-none hover:scale-[1.01] active:scale-[0.99] ${
            activeFilter === 'all' ? 'ring-2 ring-[#F58220]' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-black text-blue-100">
              إجمالي أوامر العمل
            </span>
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-blue-200" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white mt-1">
            {totalOrders}
          </div>
          <div className="text-[11px] text-blue-200 mt-1 font-bold flex items-center justify-between">
            <span>عرض القائمة المستقلة والتوجه للجدول</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#FDB813]" />
          </div>
        </div>

        {/* Card 2: مكتملة (مؤهل 155) */}
        <div
          onClick={() =>
            setKpiPopup({
              title: 'أوامر العمل المكتملة والمؤهلة لإجراء 155',
              subtitle: `إجمالي (${ready155Count}) أمر عمل مؤهل ومكتمل بنسبة (${ready155Rate}%)`,
              orders: ready155Orders,
              filterType: 'ready155'
            })
          }
          title="انقر لفتح القائمة المستقلة للأوامر المؤهلة لإجراء 155 ومنها التوجه للجدول"
          className={`p-3.5 sm:p-4 rounded-2xl bg-[#10B981] text-white shadow-md transition-all cursor-pointer border border-emerald-600 relative overflow-hidden select-none hover:scale-[1.01] active:scale-[0.99] ${
            activeFilter === 'ready155' ? 'ring-2 ring-white' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-black text-emerald-100">
              مكتملة (مؤهل 155)
            </span>
            <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center text-white shrink-0">
              <BadgeCheck className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
              {ready155Count}
            </span>
            <span className="text-xs font-mono font-black bg-white/20 px-2 py-0.5 rounded-lg text-white">
              {ready155Rate}%
            </span>
          </div>
          <div className="text-[11px] text-emerald-100 mt-1 font-bold flex items-center justify-between">
            <span>فتح القائمة المستقلة للمؤهلة</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        {/* Card 3: قيد المراجعة والتدقيق */}
        <div
          onClick={() =>
            setKpiPopup({
              title: 'أوامر العمل قيد المراجعة والتدقيق الفني',
              subtitle: `إجمالي (${inProgressCount}) أمر عمل جاري تدقيقها في الإدارات المختصة`,
              orders: inProgressOrders,
              filterType: 'inProgress'
            })
          }
          title="انقر لفتح القائمة المستقلة للأوامر قيد التدقيق ومنها التوجه للجدول"
          className={`p-3.5 sm:p-4 rounded-2xl bg-[#F58220] text-white shadow-md transition-all cursor-pointer border border-amber-600 relative overflow-hidden select-none hover:scale-[1.01] active:scale-[0.99] ${
            activeFilter === 'inProgress' ? 'ring-2 ring-white' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-black text-amber-100">
              قيد المراجعة والتدقيق
            </span>
            <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center text-white shrink-0">
              <Clock className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white mt-1">
            {inProgressCount}
          </div>
          <div className="text-[11px] text-amber-100 mt-1 font-bold flex items-center justify-between">
            <span>فتح القائمة المستقلة لقيد التدقيق</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        {/* Card 4: غير مؤهل / به ملاحظات */}
        <div
          onClick={() =>
            setKpiPopup({
              title: 'أوامر العمل غير المؤهلة أو التي بها ملاحظات',
              subtitle: `إجمالي (${disqualifiedCount}) أمر عمل يتطلب استيفاء الملاحظات الفنية`,
              orders: disqualifiedOrders,
              filterType: 'notReady155'
            })
          }
          title="انقر لفتح القائمة المستقلة للأوامر غير المؤهلة ومنها التوجه للجدول"
          className={`p-3.5 sm:p-4 rounded-2xl bg-[#6366F1] text-white shadow-md transition-all cursor-pointer border border-indigo-700 relative overflow-hidden select-none hover:scale-[1.01] active:scale-[0.99] ${
            activeFilter === 'notReady155' ? 'ring-2 ring-white' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-black text-indigo-100">
              غير مؤهل / ملاحظات
            </span>
            <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center text-white shrink-0">
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white mt-1">
            {disqualifiedCount}
          </div>
          <div className="text-[11px] text-indigo-100 mt-1 font-bold flex items-center justify-between">
            <span>فتح القائمة المستقلة لغير المؤهلة</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        {/* Card 5: قائمة التنبيه العاجل */}
        <div
          onClick={() => {
            if (onOpenAuditTrackerModal) {
              onOpenAuditTrackerModal();
            } else {
              setKpiPopup({
                title: 'قائمة التنبيه العاجل — أوامر العمل تحت التدقيق الجزئي',
                subtitle: 'أوامر العمل التي بدأ التدقيق عليها في إحدى الإدارات الثلاث وبانتظار استكمال الباقي',
                orders: urgentOrdersList,
                filterType: 'urgent'
              });
            }
          }}
          title="قائمة التنبيه العاجل — انقر لفتح جدول متابعة وترحيل أوامر العمل العاجلة والتوجه الفوري لأمر العمل"
          className="col-span-2 md:col-span-1 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#7F1D1D] via-[#991B1B] to-[#7F1D1D] text-white shadow-xl transition-all cursor-pointer border-2 border-red-400 relative overflow-hidden select-none animate-urgent-shake"
        >
          <span className="absolute top-2.5 left-2.5 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB813] opacity-90" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FDB813]" />
          </span>

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-black text-[#FDB813] drop-shadow-xs">
              قائمة التنبيه العاجل
            </span>
            <div className="w-9 h-9 rounded-xl bg-black/25 border border-[#FDB813]/60 flex items-center justify-center text-[#FDB813] shrink-0 shadow-inner">
              <AlertTriangle className="w-5 h-5 text-[#FDB813] animate-urgent-bell" />
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-2 mt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white drop-shadow-xs">
                {effectiveUrgentTotal}
              </span>
              <span className="text-[10.5px] font-black text-amber-100">
                أمر عاجل
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-[#FDB813] text-slate-950 font-mono text-[10px] font-black shadow-2xs flex items-center gap-1">
              <Flame className="w-3 h-3 text-red-700 fill-red-600" />
              <span>{urgentDisqualifiedCount > 0 ? `${urgentDisqualifiedCount} غير مؤهل` : 'متابعة فورية'}</span>
            </span>
          </div>

          <div className="text-[11px] text-amber-100 mt-1.5 font-black flex items-center justify-between pt-1 border-t border-white/20">
            <span>انقر لفتح القائمة والتوجيه للأمر</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#FDB813]" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. THREE-PANEL FEATURE ROW: Hero Graphic + Donut Chart + Bar Chart */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left Panel: Hero Graphic (4 cols) */}
        <div className="lg:col-span-4 bg-gradient-to-br from-[#004B8D] via-[#003B73] to-[#0A192F] text-white rounded-3xl p-5 shadow-lg border border-blue-900 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
            <svg viewBox="0 0 400 300" className="w-full h-full text-white" fill="none" stroke="currentColor">
              <line x1="200" y1="20" x2="160" y2="280" strokeWidth="2.5" />
              <line x1="200" y1="20" x2="240" y2="280" strokeWidth="2.5" />
              <line x1="180" y1="100" x2="220" y2="100" strokeWidth="3" />
              <line x1="160" y1="160" x2="240" y2="160" strokeWidth="3" />
              <line x1="140" y1="230" x2="260" y2="230" strokeWidth="3" />
              <line x1="180" y1="100" x2="240" y2="160" strokeWidth="1.5" />
              <line x1="220" y1="100" x2="160" y2="160" strokeWidth="1.5" />
              <line x1="160" y1="160" x2="260" y2="230" strokeWidth="1.5" />
              <line x1="240" y1="160" x2="140" y2="230" strokeWidth="1.5" />
              <path d="M 0 90 Q 180 120 400 90" strokeWidth="1" strokeDasharray="4 2" />
              <path d="M 0 150 Q 200 180 400 150" strokeWidth="1" strokeDasharray="4 2" />
            </svg>
          </div>

          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-[#FDB813] text-xs font-black shadow-xs">
              <Zap className="w-3.5 h-3.5 fill-[#FDB813]" />
              <span>منظومة كهرباء الحدود الشمالية</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white leading-snug tracking-tight pt-2">
              معاً.. <br />
              <span className="text-[#F58220]">لجودة أعلى</span> وموثوقية أكبر
            </h3>

            <p className="text-xs text-blue-100/90 font-medium leading-relaxed">
              حوكمة جودة أعمال الإنشاءات وإجراء 155 المعتمد لضمان دقة تنفيذ المشاريع الرأسمالية والشبكات الكهربائية.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-2 pt-5 border-t border-white/15 mt-4">
            <button
              type="button"
              onClick={() =>
                setKpiPopup({
                  title: 'تم التدقيق عليه — بانتظار إجراء 155',
                  subtitle: 'أوامر العمل المؤهلة 100% من الإدارات الثلاث وبانتظار اختيار (تم الاجراء) لأرشفتها في ارشيف 155',
                  orders: auditedWaiting155Orders,
                  filterType: 'ready155'
                })
              }
              className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all cursor-pointer group shadow-2xs"
            >
              <ShieldCheck className="w-4 h-4 text-[#FDB813] group-hover:scale-110 transition-transform mb-1" />
              <span className="text-[10px] font-black">تم التدقيق ({auditedWaiting155Orders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onOpen155Guide) onOpen155Guide();
                else if (onNavigateSection) onNavigateSection('quality_ncr');
              }}
              className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all cursor-pointer group shadow-2xs"
            >
              <BookOpen className="w-4 h-4 text-emerald-300 group-hover:scale-110 transition-transform mb-1" />
              <span className="text-[10px] font-black">الدليل الإرشادي</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setKpiPopup({
                  title: 'قائمة ( ارشيف 155 )',
                  subtitle: 'أوامر العمل التي تم اختيار (تم الاجراء) لها في عمود إجراء 155 وتمت أرشفتها نهائياً',
                  orders: archived155Orders,
                  filterType: 'ready155'
                })
              }
              className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all cursor-pointer group shadow-2xs"
            >
              <Archive className="w-4 h-4 text-purple-300 group-hover:scale-110 transition-transform mb-1" />
              <span className="text-[10px] font-black">ارشيف 155 ({archived155Orders.length})</span>
            </button>
          </div>
        </div>

        {/* Center Panel: توزيع الأوامر حسب المكتب الفرعي (Donut Chart) (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-sm font-black text-slate-900">
              توزيع الأوامر حسب المكتب الفرعي
            </h4>
            <span className="text-xs font-mono font-bold text-slate-500">
              إجمالي {officeDistribution.total}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 py-3 my-auto">
            <div
              onClick={() =>
                setKpiPopup({
                  title: 'توزيع أوامر العمل لكافة المكاتب الفرعية',
                  subtitle: `إجمالي (${officeDistribution.total}) أمر عمل في النطاق الحالي`,
                  orders: currentOrders,
                  filterType: 'all'
                })
              }
              title="انقر لفتح القائمة المستقلة لجميع أوامر العمل"
              className="relative w-36 h-36 shrink-0 flex items-center justify-center cursor-pointer"
            >
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F1F5F9" strokeWidth="18" />
                {donutSegments.map((seg) => {
                  const strokeDasharray = `${(seg.angle / 360) * 251.2} 251.2`;
                  const strokeDashoffset = -((seg.startAngle / 360) * 251.2);
                  return (
                    <circle
                      key={seg.name}
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="18"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-500 hover:opacity-80"
                    />
                  );
                })}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black font-mono text-slate-900 leading-tight">
                  {officeDistribution.total}
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  إجمالي
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-1.5 min-w-0">
              {officeDistribution.items.map((item) => (
                <div
                  key={item.name}
                  onClick={() =>
                    setKpiPopup({
                      title: `أوامر عمل مكتب (${item.name})`,
                      subtitle: `إجمالي (${item.count}) أمر عمل مسجل لمكتب ${item.name} في النطاق المحدد`,
                      orders: item.orders,
                      filterType: 'all',
                      targetOffice: item.name !== 'أخرى' ? item.name : 'all'
                    })
                  }
                  className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-blue-50/70 cursor-pointer transition-colors"
                  title={`انقر لعرض القائمة المستقلة لأوامر عمل مكتب ${item.name} والتوجه للجدول`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-bold text-slate-700 truncate">{item.name}</span>
                  </div>
                  <span className="font-mono font-black text-slate-900 text-xs shrink-0">
                    {item.count} (%{item.pct})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>انقر على أي مكتب لفتح قائمته المستقلة</span>
            <button
              type="button"
              onClick={() => onNavigateSection && onNavigateSection('regions_dashboard')}
              className="text-[#004B8D] hover:underline font-black cursor-pointer"
            >
              قسم المكاتب الفرعية ←
            </button>
          </div>
        </div>

        {/* Right Panel: مؤشرات المرفقات والتدقيق والملاحظات (Bar Chart) (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-sm font-black text-slate-900">
              مؤشرات المرفقات والتدقيق والملاحظات
            </h4>
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <span className="flex items-center gap-1 text-blue-700">
                <span className="w-2 h-2 rounded-full bg-[#004B8D]" /> صور ومرفقات
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <span className="w-2 h-2 rounded-full bg-[#F58220]" /> مؤهل 155
              </span>
              <span className="flex items-center gap-1 text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" /> ملاحظات الجودة
              </span>
            </div>
          </div>

          <div className="h-40 flex items-end justify-around gap-4 pt-4 px-2 my-auto">
            {/* Bar 1: المرفقات والصور */}
            <div
              onClick={() =>
                setKpiPopup({
                  title: 'أوامر العمل الموثقة بالصور والمرفقات (SharePoint)',
                  subtitle: `إجمالي (${visitsAndNotes.totalVisits}) أمر عمل يحتوي على ملفات صور أو جاهز للإرفاق`,
                  orders: visitsAndNotes.visitOrders,
                  filterType: 'all'
                })
              }
              title="انقر لفتح القائمة المستقلة لأوامر العمل الموثقة بالصور والمرفقات"
              className="flex flex-col items-center gap-1.5 flex-1 h-full justify-end group cursor-pointer"
            >
              <span className="font-mono font-black text-xs text-slate-700">
                {visitsAndNotes.totalVisits}
              </span>
              <div className="w-full max-w-[42px] bg-slate-100 rounded-t-xl overflow-hidden h-32 flex items-end">
                <div
                  className="w-full bg-[#004B8D] rounded-t-xl transition-all duration-700 group-hover:bg-blue-600"
                  style={{ height: `${Math.max(12, visitsAndNotes.visitHeight)}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-600 group-hover:text-[#004B8D]">صور ومرفقات</span>
            </div>

            {/* Bar 2: مؤهل 155 */}
            <div
              onClick={() =>
                setKpiPopup({
                  title: 'أوامر العمل المؤهلة لإجراء 155',
                  subtitle: `إجمالي (${ready155Count}) أمر عمل مؤهل ومكتمل التدقيق`,
                  orders: ready155Orders,
                  filterType: 'ready155'
                })
              }
              title="انقر لفتح القائمة المستقلة لأوامر العمل المؤهلة 155"
              className="flex flex-col items-center gap-1.5 flex-1 h-full justify-end group cursor-pointer"
            >
              <span className="font-mono font-black text-xs text-slate-700">
                {visitsAndNotes.completedAudits}
              </span>
              <div className="w-full max-w-[42px] bg-slate-100 rounded-t-xl overflow-hidden h-32 flex items-end">
                <div
                  className="w-full bg-[#F58220] rounded-t-xl transition-all duration-700 group-hover:bg-amber-500"
                  style={{ height: `${Math.max(12, visitsAndNotes.auditHeight)}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-600 group-hover:text-[#F58220]">مؤهل 155</span>
            </div>

            {/* Bar 3: ملاحظات الجودة */}
            <div
              onClick={() =>
                setKpiPopup({
                  title: 'أوامر العمل المسجل عليها ملاحظات جودة (155)',
                  subtitle: `إجمالي (${visitsAndNotes.correctiveNotes}) أمر عمل مسجل عليه ملاحظات فنية في عمود ملاحظات الجودة`,
                  orders: visitsAndNotes.correctiveOrders,
                  filterType: 'all'
                })
              }
              title="انقر لفتح القائمة المستقلة لأوامر العمل المسجل عليها ملاحظات الجودة"
              className="flex flex-col items-center gap-1.5 flex-1 h-full justify-end group cursor-pointer"
            >
              <span className="font-mono font-black text-xs text-slate-700">
                {visitsAndNotes.correctiveNotes}
              </span>
              <div className="w-full max-w-[42px] bg-slate-100 rounded-t-xl overflow-hidden h-32 flex items-end">
                <div
                  className="w-full bg-[#10B981] rounded-t-xl transition-all duration-700 group-hover:bg-emerald-500"
                  style={{ height: `${Math.max(12, visitsAndNotes.correctiveHeight)}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-600 group-hover:text-emerald-700">ملاحظات الجودة</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>انقر على أي عمود لعرض محتواه في قائمة مستقلة</span>
            <button
              type="button"
              onClick={() => {
                if (onOpenNotesReport) onOpenNotesReport();
                else if (onNavigateSection) onNavigateSection('visits');
              }}
              className="text-blue-800 hover:underline font-black cursor-pointer"
            >
              تقرير الملاحظات الشامل ←
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. BOTTOM ROW: Offices Achievement Table + Reports Hub                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Bottom Left Panel: Offices Achievement Table with Donut Gauge (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h4 className="text-sm font-black text-slate-900">
                تقارير إنجاز المكاتب الفرعية (متزامن مع النطاق المحدد)
              </h4>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                انقر على أي صف مكتب لعرض أوامر عمله في قائمة مستقلة والتوجه للجدول
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                {activeMonth === 'all' ? 'كافة الشهور' : getArabicMonthName(activeMonth)} {activeYear}
              </span>
              {onOpenOfficeComparison && (
                <button
                  type="button"
                  onClick={onOpenOfficeComparison}
                  className="px-2.5 py-1 rounded-lg bg-[#004B8D] hover:bg-blue-800 text-white text-xs font-black transition-colors cursor-pointer"
                >
                  عرض التقرير
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4 py-3">
            {/* Achievement Donut Gauge */}
            <div
              onClick={() =>
                setKpiPopup({
                  title: `أوامر العمل المؤهلة 155 — نسبة الإنجاز العامة (${ready155Rate}%)`,
                  subtitle: `إجمالي (${ready155Count}) أمر مؤهل من أصل (${totalOrders}) في النطاق المحدد`,
                  orders: ready155Orders,
                  filterType: 'ready155'
                })
              }
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-blue-50/70 border border-blue-200/80 w-36 shrink-0 cursor-pointer hover:bg-blue-100/60 transition-colors"
              title="انقر لفتح القائمة المستقلة للأوامر المؤهلة"
            >
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#E2E8F0" strokeWidth="12" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#10B981"
                    strokeWidth="12"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * ready155Rate) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                  <span className="text-xl font-black text-slate-900">{ready155Rate}%</span>
                </div>
              </div>
              <span className="text-[11px] font-black text-slate-800 text-center mt-2">
                نسبة الإنجاز العامة
              </span>
            </div>

            {/* Performance Table */}
            <div className="flex-1 w-full overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 font-black text-[11px]">
                    <th className="pb-2">المكتب الفرعي</th>
                    <th className="pb-2 text-center">إجمالي الأوامر</th>
                    <th className="pb-2 text-center">مؤهل 155</th>
                    <th className="pb-2 text-center">النسبة</th>
                    <th className="pb-2 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {officesPerformance.map((op) => (
                    <tr
                      key={op.name}
                      onClick={() =>
                        setKpiPopup({
                          title: `تفاصيل أوامر عمل مكتب (${op.name})`,
                          subtitle: `الإجمالي: ${op.target} أمر • المؤهل 155: ${op.actual} أمر (${op.rate}%)`,
                          orders: op.orders,
                          filterType: 'all',
                          targetOffice: op.name
                        })
                      }
                      title={`انقر لعرض أوامر عمل مكتب ${op.name} في قائمة مستقلة والتوجه للجدول`}
                      className="hover:bg-blue-50/60 transition-colors cursor-pointer"
                    >
                      <td className="py-2 font-bold text-[#004B8D] hover:underline">{op.name}</td>
                      <td className="py-2 text-center font-mono font-bold text-slate-600">{op.target}</td>
                      <td className="py-2 text-center font-mono font-black text-[#004B8D]">{op.actual}</td>
                      <td className="py-2 text-center font-mono font-bold text-slate-900">{op.rate}%</td>
                      <td className="py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${op.statusColor}`}>
                          {op.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Bottom Right Panel: Reports and Statistics 4-Card Hub (6 cols) */}
        <div className="lg:col-span-6 bg-gradient-to-br from-slate-900 via-[#002855] to-[#0A192F] text-white rounded-3xl p-5 shadow-sm border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/80">
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>التقارير والإحصائيات المعتمدة</span>
                <span className="w-2 h-2 rounded-full bg-[#F58220] animate-pulse" />
              </h4>
              <p className="text-[11px] text-blue-200 font-medium mt-0.5">
                تقارير فعلية متزامنة 100% مع أعمدة وبيانات المنصة المعتمدة فقط
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white font-mono text-[10px] font-bold">
              تصدير رسمي
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 my-3">
            <div
              onClick={() => onOpenExportModal && onOpenExportModal()}
              className="p-3.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-white transition-all cursor-pointer group shadow-2xs"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <Download className="w-4 h-4" />
              </div>
              <div className="font-black text-xs text-white">تقارير الجدول المخصصة</div>
              <div className="text-[10px] text-amber-200 mt-0.5">تصدير فعلي لأعمدة المنصة (Excel / PDF)</div>
            </div>

            <div
              onClick={() => onOpenWeeklyReport && onOpenWeeklyReport()}
              className="p-3.5 rounded-2xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/30 text-white transition-all cursor-pointer group shadow-2xs"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <PieChart className="w-4 h-4" />
              </div>
              <div className="font-black text-xs text-white">التقرير الأسبوعي للمكاتب</div>
              <div className="text-[10px] text-blue-200 mt-0.5">متابعة إنجاز المكاتب الفرعية</div>
            </div>

            <div
              onClick={() => onOpenContractorComparison && onOpenContractorComparison()}
              className="p-3.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-white transition-all cursor-pointer group shadow-2xs"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <FileText className="w-4 h-4" />
              </div>
              <div className="font-black text-xs text-white">أوامر العمل والإغلاق</div>
              <div className="text-[10px] text-emerald-200 mt-0.5">مقارنة إغلاقات المقاولين الدورية</div>
            </div>

            <div
              onClick={() => onOpenComprehensiveReports && onOpenComprehensiveReports('aggregated')}
              className="p-3.5 rounded-2xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-400/30 text-white transition-all cursor-pointer group shadow-2xs"
            >
              <div className="w-8 h-8 rounded-xl bg-purple-500 text-white flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <BarChart2 className="w-4 h-4" />
              </div>
              <div className="font-black text-xs text-white">مركز التقارير الشامل</div>
              <div className="text-[10px] text-purple-200 mt-0.5">مجمعة وتفصيلية مطابقة للمنصة</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-300 pt-2 border-t border-slate-700/80">
            <span>منظومة حوكمة الجودة والمساندة الفنية</span>
            <span className="text-[#F58220] font-bold">متزامن 100% مع بيانات المنصة</span>
          </div>
        </div>
      </div>

      {/* Independent Floating Popup Modal for any clicked KPI/Widget */}
      <KPIContentPopupModal
        popupData={kpiPopup}
        onClose={() => setKpiPopup(null)}
        monthTables={monthTables}
        activeYear={activeYear}
        activeMonth={activeMonth}
        selectedOffice={selectedOffice}
        onNavigateToOrderInTable={(order) => {
          if (onNavigateToOrderInTable) {
            onNavigateToOrderInTable(order);
          } else if (onNavigateSection) {
            onNavigateSection('work_orders');
          }
        }}
        onNavigateToTableWithFilter={(flt, off) => {
          if (off && onSelectOffice) onSelectOffice(off);
          if (flt && onSelectFilter) onSelectFilter(flt);
          if (onNavigateSection) onNavigateSection('work_orders');
        }}
      />
    </div>
  );
};
