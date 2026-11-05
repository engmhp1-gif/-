import React, { useMemo, useState } from 'react';
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
  FileSpreadsheet,
  Award,
  Zap,
  Camera,
  Users,
  Briefcase,
  FileDown,
  Calendar,
  BarChart3,
  Clock,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  TableProperties,
  ChevronDown,
  Plus
} from 'lucide-react';
import { ContractorClosureReportModal } from './ContractorClosureReportModal';
import { hasUserPermission } from '../utils/security';
import { UnifiedSectionExportBar } from './UnifiedSectionExportBar';
import {
  getEvaluatedSupportChecklistKeys,
  getEvaluatedColumnSupportChecklistKeys
} from './TechnicalSupportAuditModal';
import {
  isOrderQualified100InAllThreeAudits,
  getEffectiveProcedure155Status,
  getOrderAuditTrackerInfo
} from '../utils/auditTracker';
import {
  getArabicMonthName,
  getDefaultTableId,
  isDefaultTableId,
  isTableInPeriod
} from '../utils/tableScope';
import { KPIContentPopupModal, KPIContentPopupData } from './KPIContentPopupModal';

export type KPIFilterType = 'all' | 'ready155' | 'notReady155' | 'inProgress' | 'urgent';

interface KPIDashboardProps {
  workOrders: WorkOrder[];
  allWorkOrders?: WorkOrder[];
  offices?: SubOffice[];
  activeFilter: KPIFilterType;
  onSelectFilter: (filter: KPIFilterType) => void;
  selectedOffice: string;
  onSelectOffice?: (officeName: string) => void;
  onNavigateToTable?: () => void;
  onNavigateToOrderInTable?: (order: WorkOrder) => void;
  onOpenAuditTrackerModal?: () => void;
  urgentCount?: number;
  urgentDisqualifiedCount?: number;
  activePeriodLabel?: string;
  activeYear?: number;
  activeMonth?: number | 'all';
  selectedTableId?: string;
  onSelectPeriod?: (year: number, month: number | 'all', tableId?: string) => void;
  onOpenYearMonthPicker?: () => void;
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
  allWorkOrders = [],
  offices = [],
  activeFilter,
  onSelectFilter,
  selectedOffice,
  onSelectOffice,
  onNavigateToTable,
  onNavigateToOrderInTable,
  onOpenAuditTrackerModal,
  urgentCount = 0,
  urgentDisqualifiedCount = 0,
  activePeriodLabel,
  activeYear = new Date().getFullYear(),
  activeMonth = 'all',
  selectedTableId = 'all',
  onSelectPeriod,
  onOpenYearMonthPicker,
  onOpenWeeklyReport,
  onOpenOfficeComparison,
  onOpenContractorComparison,
  onOpenComprehensiveReports,
  onOpenExportModal,
  monthTables = [],
  currentUser
}) => {
  const [isContractorModalOpen, setIsContractorModalOpen] = useState(false);
  const [selectedMatrixOffice, setSelectedMatrixOffice] = useState<string>('all');
  const [kpiPopup, setKpiPopup] = useState<KPIContentPopupData | null>(null);

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

  const handleOpenContractorReport = () => {
    if (onOpenContractorComparison) {
      onOpenContractorComparison();
    } else {
      setIsContractorModalOpen(true);
    }
  };

  const totalOrders = workOrders.length;

  // 1. Qualified / Approved for Closure (مؤهل للاستلام ومعتمد)
  const ready155Orders = useMemo(
    () =>
      workOrders.filter((w) => {
        const evalKeys = getEvaluatedSupportChecklistKeys(w);
        const s = String(w.procedure155Status || '').trim();
        const eff155 = getEffectiveProcedure155Status(w);
        return (
          isOrderQualified100InAllThreeAudits(w) ||
          (!eff155.includes('غير') && (eff155.includes('مؤهل') || eff155.includes('تم'))) ||
          (evalKeys.length > 0 && !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد')))
        );
      }),
    [workOrders]
  );
  const ready155Count = ready155Orders.length;
  const ready155Rate = totalOrders > 0 ? Math.round((ready155Count / totalOrders) * 100) : 0;

  // 2. Disqualified / Critical Deficiencies (غير مؤهل للاستلام)
  const disqualifiedOrders = useMemo(
    () =>
      workOrders.filter((w) => {
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
      }),
    [workOrders]
  );
  const disqualifiedCount = disqualifiedOrders.length;
  const disqualifiedRate = totalOrders > 0 ? Math.round((disqualifiedCount / totalOrders) * 100) : 0;

  // 3. In-Progress / Under Audit Review (قيد التدقيق والفحص الفني)
  const inProgressOrders = useMemo(
    () =>
      workOrders.filter((w) => {
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
      }),
    [workOrders]
  );
  const inProgressCount = inProgressOrders.length;
  const inProgressRate = totalOrders > 0 ? Math.round((inProgressCount / totalOrders) * 100) : 0;

  const urgentOrdersList = useMemo(() => {
    const scopedUrgent = workOrders.filter((w) => {
      const info = getOrderAuditTrackerInfo(w);
      return info.hasAuditStarted && !info.isFullyAuditedByAllThree;
    });
    if (scopedUrgent.length > 0) return scopedUrgent;
    return (allWorkOrders.length > 0 ? allWorkOrders : workOrders).filter((w) => {
      const info = getOrderAuditTrackerInfo(w);
      return info.hasAuditStarted && !info.isFullyAuditedByAllThree;
    });
  }, [workOrders, allWorkOrders]);

  const effectiveUrgentTotal = urgentOrdersList.length || urgentCount;

  // 5. Sub-offices distribution and compliance (synchronized with workOrders scope)
  const officeMetrics = useMemo(() => {
    const list = workOrders;
    const knownOffices =
      offices.length > 0 ? offices.map((o) => o.name) : ['عرعر', 'العويقيلة', 'رفحاء', 'طريف'];

    return knownOffices
      .map((offName) => {
        const officeOrders = list.filter((w) => {
          const off = (w.office || '').trim();
          return off === offName.trim() || off.includes(offName.trim()) || offName.trim().includes(off);
        });
        const total = officeOrders.length;
        const ready = officeOrders.filter((w) => {
          const evalKeys = getEvaluatedSupportChecklistKeys(w);
          const s = String(w.procedure155Status || '').trim();
          const eff155 = getEffectiveProcedure155Status(w);
          return (
            isOrderQualified100InAllThreeAudits(w) ||
            (!eff155.includes('غير') && (eff155.includes('مؤهل') || eff155.includes('تم'))) ||
            (evalKeys.length > 0 && !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد')))
          );
        }).length;
        const rate = total > 0 ? Math.round((ready / total) * 100) : 0;
        return { name: offName, orders: officeOrders, total, ready, rate };
      })
      .sort((a, b) => b.total - a.total);
  }, [workOrders, offices]);

  // 6. Contractor breakdown for analytics
  const contractorMetrics = useMemo(() => {
    const map: Record<
      string,
      { total: number; ready: number; notReady: number; officesSet: Set<string>; orders: WorkOrder[] }
    > = {};
    const sourceList =
      selectedMatrixOffice === 'all'
        ? workOrders
        : workOrders.filter((o) => o.office === selectedMatrixOffice);

    sourceList.forEach((o) => {
      const c = (o.contractor || 'غير محدد').trim();
      if (!map[c]) map[c] = { total: 0, ready: 0, notReady: 0, officesSet: new Set(), orders: [] };
      map[c].total += 1;
      map[c].orders.push(o);
      if (o.office) map[c].officesSet.add(o.office);
      const evalKeys = getEvaluatedSupportChecklistKeys(o);
      const s = String(o.procedure155Status || '').trim();
      const eff155 = getEffectiveProcedure155Status(o);
      const isReady =
        isOrderQualified100InAllThreeAudits(o) ||
        (!eff155.includes('غير') && (eff155.includes('مؤهل') || eff155.includes('تم'))) ||
        (evalKeys.length > 0 && !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد')));
      if (isReady) map[c].ready += 1;
      else map[c].notReady += 1;
    });

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        orders: data.orders,
        officesText: Array.from(data.officesSet).join(' ، ') || 'غير محدد',
        total: data.total,
        ready: data.ready,
        notReady: data.notReady,
        rate: data.total > 0 ? Math.round((data.ready / data.total) * 100) : 0
      }))
      .sort((a, b) => {
        if (b.rate !== a.rate) return b.rate - a.rate;
        return b.total - a.total;
      });
  }, [workOrders, selectedMatrixOffice]);

  const topContractor = contractorMetrics[0] || null;
  const avgContractorClosureRate =
    contractorMetrics.length > 0
      ? Math.round(contractorMetrics.reduce((acc, c) => acc + c.rate, 0) / contractorMetrics.length)
      : 0;

  // 7. Documentation readiness
  const withPhotosOrders = useMemo(() => {
    return workOrders.filter(
      (w) =>
        (w.photos && w.photos.length > 0) ||
        (w.photosFile && w.photosFile.length > 0) ||
        String(w.attachmentStatus || '').includes('جاهز')
    );
  }, [workOrders]);
  const withPhotosCount = withPhotosOrders.length;
  const photoRate = totalOrders > 0 ? Math.round((withPhotosCount / totalOrders) * 100) : 0;

  return (
    <div className="mb-5 sm:mb-6 font-['Cairo',sans-serif] text-right" dir="rtl">
      {/* Top Unified Control Bar with Compact Year, Month, Table, Office Selectors */}
      <div className="bg-gradient-to-l from-[#001D40] via-[#002855] to-[#003B73] rounded-2xl border border-[#004B8D]/70 shadow-sm p-2.5 sm:p-3 mb-3.5 flex flex-wrap items-center justify-between gap-2.5 text-white">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-2 pl-2 border-l border-white/15">
            <div className="w-8 h-8 rounded-xl bg-[#F58220] text-white flex items-center justify-center shadow-xs shrink-0">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xs sm:text-sm font-black text-white leading-tight">
                  مؤشرات الأداء والقياس (KPIs) • إجراء 155
                </h2>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[9.5px] font-black">
                  متزامن 100%
                </span>
              </div>
              <p className="text-[10px] text-blue-200 font-bold hidden sm:block">
                انقر على أي مؤشر لفتح قائمته المستقلة والتوجه مباشرة للجدول
              </p>
            </div>
          </div>

          {/* 1. Compact Year Selector */}
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

          {/* 2. Compact Month Selector */}
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

          {/* 3. Compact Table Selector */}
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
                title="إدارة وإضافة الجداول"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 4. Compact Office Selector */}
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

        {/* Left Actions */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {hasUserPermission(currentUser, 'exportTable') && (
            <UnifiedSectionExportBar
              orders={workOrders}
              sectionTitle={`مؤشرات_الأداء_KPI_${activePeriodLabel || selectedOffice || 'جميع_المكاتب'}`}
              onOpenExportModal={onOpenExportModal}
              variant="light"
            />
          )}

          {onOpenComprehensiveReports && (
            <button
              type="button"
              onClick={() => onOpenComprehensiveReports('aggregated')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#F58220] hover:bg-[#d96b12] text-white shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <BarChart3 className="w-3.5 h-3.5 text-white shrink-0" />
              <span>مركز التقارير</span>
            </button>
          )}

          {onOpenOfficeComparison && hasUserPermission(currentUser, 'viewOfficeComparison') && (
            <button
              type="button"
              onClick={onOpenOfficeComparison}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-[#FDB813] shrink-0" />
              <span>مقارنة المكاتب</span>
            </button>
          )}

          {onOpenWeeklyReport && hasUserPermission(currentUser, 'viewWeeklyReport') && (
            <button
              type="button"
              onClick={onOpenWeeklyReport}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>التقرير الأسبوعي</span>
            </button>
          )}

          {activeFilter !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectFilter('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black bg-amber-400 text-slate-950 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>إلغاء الفلتر</span>
            </button>
          )}
        </div>
      </div>

      {/* 6 Executive KPI Metric Cards */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 ${
          hasUserPermission(currentUser, 'viewContractorClosureReport') ? 'lg:grid-cols-6' : 'lg:grid-cols-5'
        } gap-2 sm:gap-2.5 w-full`}
      >
        {/* Card 1: إجمالي أوامر العمل */}
        <div
          onClick={() =>
            setKpiPopup({
              title: 'إجمالي أوامر العمل المسجلة في النطاق المحدد',
              subtitle: `عرض (${totalOrders}) أمر عمل في قائمة مستقلة مع التوجه المباشر للجدول`,
              orders: workOrders,
              filterType: 'all'
            })
          }
          className={`min-w-0 relative p-3 sm:p-3.5 rounded-xl border transition-all duration-200 cursor-pointer text-right flex flex-col justify-between select-none ${
            activeFilter === 'all'
              ? 'bg-blue-50/90 border-[#004B8D] ring-2 ring-[#004B8D]/40 shadow-sm'
              : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-xs'
          }`}
          title="انقر لفتح القائمة المستقلة لكافة أوامر العمل والتوجه للجدول"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-black text-slate-800 leading-tight">
              إجمالي أوامر العمل
            </span>
            <div
              className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                activeFilter === 'all'
                  ? 'bg-[#004B8D] text-white shadow-xs'
                  : 'bg-blue-50 text-[#004B8D] border border-blue-200'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono tabular-nums">
                {totalOrders}
              </span>
              <span className="text-[10px] text-slate-500 font-bold">أمر مسجل</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium truncate">
              {selectedOffice === 'all' ? 'كافة المكاتب الفرعية' : selectedOffice}
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-blue-200/70 text-[10px] font-bold text-[#004B8D] flex items-center justify-between gap-1">
            <span className="truncate">عرض القائمة المستقلة</span>
            <ArrowUpRight className="w-3 h-3 shrink-0" />
          </div>
        </div>

        {/* Card 2: مؤهل للاستلام ومعتمد */}
        <div
          onClick={() =>
            setKpiPopup({
              title: 'أوامر العمل المؤهلة للاستلام والمعتمدة (إجراء 155)',
              subtitle: `إجمالي (${ready155Count}) أمر عمل مؤهل بنسبة (${ready155Rate}%)`,
              orders: ready155Orders,
              filterType: 'ready155'
            })
          }
          className={`min-w-0 relative p-3 sm:p-3.5 rounded-xl border transition-all duration-200 cursor-pointer text-right flex flex-col justify-between select-none ${
            activeFilter === 'ready155'
              ? 'bg-emerald-50/90 border-emerald-600 ring-2 ring-emerald-500/40 shadow-sm'
              : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-xs'
          }`}
          title="انقر لفتح القائمة المستقلة للأوامر المؤهلة والتوجه للجدول"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-black text-emerald-900 leading-tight">
              مؤهل للاستلام ومعتمد
            </span>
            <div
              className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                activeFilter === 'ready155'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              <BadgeCheck className="w-4 h-4 shrink-0" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight font-mono tabular-nums">
                {ready155Count}
              </span>
              <span className="text-xs font-black text-emerald-800 font-mono bg-emerald-100 px-1.5 py-0.2 rounded">
                {ready155Rate}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${ready155Rate}%` }}
              />
            </div>
            <div className="text-[10px] text-emerald-700 font-bold mt-1 truncate">
              مستوفٍ للاشتراطات الفنية بالكامل
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-emerald-700 font-black flex items-center justify-between">
            <span>فتح القائمة ({ready155Count})</span>
            <ArrowUpRight className="w-3 h-3 shrink-0" />
          </div>
        </div>

        {/* Card 3: قيد التدقيق والفحص الفني */}
        <div
          onClick={() =>
            setKpiPopup({
              title: 'أوامر العمل قيد التدقيق والفحص الفني',
              subtitle: `إجمالي (${inProgressCount}) أمر عمل قيد المراجعة والتدقيق`,
              orders: inProgressOrders,
              filterType: 'inProgress'
            })
          }
          className={`min-w-0 relative p-3 sm:p-3.5 rounded-xl border transition-all duration-200 cursor-pointer text-right flex flex-col justify-between select-none ${
            activeFilter === 'inProgress'
              ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/40 shadow-sm'
              : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-xs'
          }`}
          title="انقر لفتح القائمة المستقلة للأوامر قيد التدقيق والتوجه للجدول"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-black text-amber-900 leading-tight">
              قيد التدقيق والفحص
            </span>
            <div
              className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                activeFilter === 'inProgress'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-black text-amber-700 tracking-tight font-mono tabular-nums">
                {inProgressCount}
              </span>
              <span className="text-xs font-black text-amber-800 font-mono bg-amber-100 px-1.5 py-0.2 rounded">
                {inProgressRate}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${inProgressRate}%` }}
              />
            </div>
            <div className="text-[10px] text-amber-700 font-bold mt-1 truncate">
              جاري المراجعة بين الجهات
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-amber-700 font-black flex items-center justify-between">
            <span>فتح القائمة ({inProgressCount})</span>
            <ArrowUpRight className="w-3 h-3 shrink-0" />
          </div>
        </div>

        {/* Card 4: غير مؤهل وبها ملاحظات فنية */}
        <div
          onClick={() =>
            setKpiPopup({
              title: 'أوامر العمل غير المؤهلة (بها ملاحظات فنية)',
              subtitle: `إجمالي (${disqualifiedCount}) أمر عمل يتطلب استيفاء الملاحظات`,
              orders: disqualifiedOrders,
              filterType: 'notReady155'
            })
          }
          className={`min-w-0 relative p-3 sm:p-3.5 rounded-xl border transition-all duration-200 cursor-pointer text-right flex flex-col justify-between select-none ${
            activeFilter === 'notReady155'
              ? 'bg-rose-50/90 border-rose-600 ring-2 ring-rose-500/40 shadow-sm'
              : 'bg-white border-slate-200 hover:border-rose-300 hover:shadow-xs'
          }`}
          title="انقر لفتح القائمة المستقلة للأوامر غير المؤهلة والتوجه للجدول"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-black text-rose-900 leading-tight">
              غير مؤهل (ملاحظات)
            </span>
            <div
              className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                activeFilter === 'notReady155'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-black text-rose-700 tracking-tight font-mono tabular-nums">
                {disqualifiedCount}
              </span>
              <span className="text-xs font-black text-rose-800 font-mono bg-rose-100 px-1.5 py-0.2 rounded">
                {disqualifiedRate}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-rose-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${disqualifiedRate}%` }}
              />
            </div>
            <div className="text-[10px] text-rose-700 font-bold mt-1 truncate">
              نواقص وملاحظات قيد الاستيفاء
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-rose-700 font-black flex items-center justify-between">
            <span>فتح القائمة ({disqualifiedCount})</span>
            <ArrowUpRight className="w-3 h-3 shrink-0" />
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
          className="min-w-0 relative p-3 sm:p-3.5 rounded-xl border-2 border-red-400 bg-gradient-to-br from-[#7F1D1D] via-[#991B1B] to-[#7F1D1D] text-white text-right flex flex-col justify-between shadow-lg select-none cursor-pointer animate-urgent-shake"
          title="قائمة التنبيه العاجل — انقر لفتح جدول متابعة أوامر العمل العاجلة والتوجه الفوري لأمر العمل"
        >
          <span className="absolute top-2 left-2 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FDB813] opacity-90" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FDB813]" />
          </span>

          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-black text-[#FDB813] leading-tight">
              قائمة التنبيه العاجل
            </span>
            <div className="p-1.5 rounded-lg bg-black/25 text-[#FDB813] border border-[#FDB813]/50 shrink-0">
              <AlertTriangle className="w-4 h-4 shrink-0 animate-urgent-bell" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <span className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono tabular-nums">
                {effectiveUrgentTotal}
              </span>
              <span className="text-[10px] font-mono font-black bg-[#FDB813] text-slate-950 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Flame className="w-3 h-3 text-red-700 fill-red-600" />
                <span>عاجل</span>
              </span>
            </div>
            <div className="text-[10px] text-amber-100 font-bold mt-1.5 truncate">
              {urgentDisqualifiedCount > 0
                ? `${urgentDisqualifiedCount} أمر غير مؤهل يتطلب معالجة`
                : 'متابعة التدقيق الثلاثي الفوري'}
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-white/20 text-[10px] font-black text-[#FDB813] flex items-center justify-between gap-1">
            <span className="truncate">فتح القائمة والتوجيه</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-white" />
          </div>
        </div>

        {/* Card 6: مقارنة إغلاقات المقاولين والتقارير */}
        {hasUserPermission(currentUser, 'viewContractorClosureReport') && (
          <div
            onClick={handleOpenContractorReport}
            className="min-w-0 relative p-3 sm:p-3.5 rounded-xl border border-slate-800 bg-[#004B8D] text-white text-right flex flex-col justify-between shadow-xs select-none cursor-pointer hover:border-amber-400 transition-all group"
            title="مقارنة إغلاقات المقاولين وتصدير التقارير الدورية"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] sm:text-xs font-black text-[#F58220] leading-tight">
                إغلاقات المقاولين
              </span>
              <div className="p-1.5 rounded-lg bg-white/10 text-[#F58220] border border-white/20 shrink-0 group-hover:scale-110 transition-transform">
                <Briefcase className="w-4 h-4 shrink-0" />
              </div>
            </div>

            <div className="mt-2.5">
              <div className="flex items-baseline justify-between gap-1 flex-wrap">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono tabular-nums">
                    {avgContractorClosureRate}%
                  </span>
                  <span className="text-[10px] text-blue-200 font-bold">المتوسط</span>
                </div>
                <span className="text-[10px] font-mono font-black bg-white/15 px-1.5 py-0.2 rounded text-white">
                  {contractorMetrics.length} مقاول
                </span>
              </div>

              <div className="w-full bg-blue-950 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#F58220] to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${avgContractorClosureRate}%` }}
                />
              </div>

              <div className="text-[10px] text-blue-100 font-bold mt-1 truncate">
                {topContractor ? `الأعلى: ${topContractor.name} (${topContractor.rate}%)` : 'مقارنة نسب الإغلاق'}
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-white/15 text-[9.5px] font-black text-[#F58220] flex items-center justify-between gap-1">
              <span className="truncate">تصدير تقرير إغلاقات دوري</span>
              <FileDown className="w-3.5 h-3.5 shrink-0 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Sub-Offices Distribution & Compliance Cockpit */}
      {officeMetrics.length > 0 && (
        <div className="mt-3 bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-blue-50 text-[#004B8D] border border-blue-200 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-black text-slate-900">
                توزيع أوامر العمل ونسب الامتثال بالمكاتب الفرعية (انقر على أي مكتب لفتح قائمته المستقلة والتوجه للجدول)
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-500">
              إجمالي {totalOrders} أمر عمل في النطاق الحالي
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {officeMetrics.map((om) => (
              <div
                key={om.name}
                onClick={() =>
                  setKpiPopup({
                    title: `أوامر عمل مكتب (${om.name})`,
                    subtitle: `الإجمالي: ${om.total} أمر • المؤهل 155: ${om.ready} أمر (${om.rate}%)`,
                    orders: om.orders,
                    filterType: 'all',
                    targetOffice: om.name
                  })
                }
                title={`انقر لعرض القائمة المستقلة لأوامر عمل مكتب ${om.name} والتوجه للجدول`}
                className={`p-2.5 rounded-lg border transition-all text-right cursor-pointer ${
                  selectedOffice === om.name
                    ? 'bg-blue-50/90 border-[#004B8D] ring-1 ring-[#004B8D]'
                    : 'bg-slate-50/80 hover:bg-blue-50/50 border-slate-200 hover:border-[#004B8D]/50'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-black text-[#002855] flex items-center gap-1">
                    <span>{om.name}</span>
                    <ArrowUpRight className="w-3 h-3 text-[#004B8D]" />
                  </span>
                  <span
                    className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded ${
                      om.rate >= 70
                        ? 'bg-emerald-100 text-emerald-800'
                        : om.rate >= 40
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {om.rate}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-[11px] font-mono text-slate-600 mb-1.5">
                  <span className="font-bold">{om.ready} مؤهل</span>
                  <span className="text-slate-400">من {om.total}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      om.rate >= 70 ? 'bg-emerald-600' : om.rate >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${om.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    انقر على أي مقاول لعرض أوامر عمله في قائمة مستقلة والتوجه للجدول
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {offices.length > 0 && (
                  <select
                    value={selectedMatrixOffice}
                    onChange={(e) => setSelectedMatrixOffice(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="all">جميع المكاتب ({workOrders.length})</option>
                    {offices.map((off) => (
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
                  <span>تصدير تقرير إغلاقات المقاولين</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {contractorMetrics.slice(0, 7).map((cm, idx) => (
                <div
                  key={cm.name}
                  onClick={() =>
                    setKpiPopup({
                      title: `أوامر عمل المقاول: ${cm.name}`,
                      subtitle: `الإجمالي: ${cm.total} أمر • المؤهل 155: ${cm.ready} أمر (${cm.rate}%) • المكاتب: ${cm.officesText}`,
                      orders: cm.orders,
                      filterType: 'all'
                    })
                  }
                  title={`انقر لفتح القائمة المستقلة لأوامر عمل المقاول: ${cm.name}`}
                  className="flex items-center justify-between gap-3 text-xs bg-slate-50/70 hover:bg-blue-50/60 px-3 py-2 rounded-xl border border-slate-200/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0 w-52">
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] font-mono font-black flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? 'bg-amber-400 text-slate-950'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-900'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
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
                    <span className="font-black text-emerald-700">{cm.ready} مؤهل</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-slate-600 font-bold">{cm.total} إجمالي</span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-black min-w-[44px] text-center ${
                        cm.rate >= 70
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : cm.rate >= 40
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-rose-100 text-rose-900 border border-rose-300'
                      }`}
                    >
                      {cm.rate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quality Documentation Assurance Box */}
          <div
            onClick={() =>
              setKpiPopup({
                title: 'أوامر العمل الموثقة بملفات الصور والمرفقات (SharePoint)',
                subtitle: `إجمالي (${withPhotosCount}) أمر عمل جاهز للإرفاق من أصل (${totalOrders})`,
                orders: withPhotosOrders,
                filterType: 'all'
              })
            }
            className="bg-gradient-to-br from-[#002855] via-[#003B73] to-[#004B8D] text-white rounded-2xl p-4 border-2 border-[#F58220]/60 shadow-md flex flex-col justify-between text-right cursor-pointer hover:border-[#FDB813] transition-all"
          >
            <div>
              <div className="flex items-center gap-2.5 mb-3.5 pb-3 border-b border-white/15">
                <div className="w-8 h-8 rounded-xl bg-white/15 text-white border border-white/25 flex items-center justify-center shadow-xs shrink-0">
                  <Camera className="w-4 h-4 text-[#FDB813]" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-white leading-tight">
                    حالة الإرفاق وملفات الصور (SharePoint)
                  </h4>
                  <span className="text-[10.5px] text-blue-100 font-semibold block mt-0.5">
                    متزامن مع عمودي (ملف الصور SharePoint) و(حالة الإرفاق)
                  </span>
                </div>
              </div>

              <div className="space-y-3.5">
                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5 font-bold">
                    <span className="text-blue-50">
                      جاهزية المرفقات والصور ({withPhotosCount}/{totalOrders})
                    </span>
                    <span className="font-mono font-black text-white bg-white/20 px-2 py-0.5 rounded-lg border border-white/30">
                      {photoRate}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-950/70 border border-blue-400/30 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#F58220] to-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${photoRate}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-950/50 border border-blue-300/30 text-[11px] text-blue-50 leading-relaxed font-semibold">
                  📊 <strong className="text-[#FDB813] font-black">تقارير متزامنة 100%:</strong> انقر هنا لعرض قائمة أوامر العمل الموثقة بالصور والمرفقات والتوجه إليها في الجدول.
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-white/15 flex items-center justify-between text-[11px] font-black text-[#FDB813]">
              <span>فتح قائمة الأوامر الموثقة بالصور ({withPhotosCount})</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-white shrink-0" />
            </div>
          </div>
        </div>
      )}

      {/* Built-in Contractor Closure Report Modal if not controlled externally */}
      <ContractorClosureReportModal
        isOpen={isContractorModalOpen}
        onClose={() => setIsContractorModalOpen(false)}
        workOrders={allWorkOrders.length > 0 ? allWorkOrders : workOrders}
        offices={offices}
        selectedOffice={selectedOffice}
        activeYear={activeYear}
        activeMonth={activeMonth}
      />

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
          } else if (onNavigateToTable) {
            onNavigateToTable();
          }
        }}
        onNavigateToTableWithFilter={(flt, off) => {
          if (off && onSelectOffice) onSelectOffice(off);
          if (flt) onSelectFilter(flt);
          if (onNavigateToTable) onNavigateToTable();
        }}
      />
    </div>
  );
};
