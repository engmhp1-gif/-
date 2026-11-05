import React from 'react';
import {
  BarChart3,
  TableProperties,
  Building2,
  Calendar,
  Settings,
  DatabaseBackup,
  CalendarRange,
  Scale,
  HardHat,
  FileSpreadsheet,
  SlidersHorizontal,
  Plus,
  Upload,
  Sparkles,
  FileWarning,
  X,
  Eye,
  EyeOff,
  ListChecks,
  CheckCircle2,
  AlertTriangle,
  Archive,
  ChevronDown,
  ShieldCheck,
  Layers
} from 'lucide-react';
import { SubOffice, PlatformUser, MonthTable, WorkOrder } from '../types';
import { hasUserPermission } from '../utils/security';
import { isDefaultTableId, isTableInPeriod } from '../utils/tableScope';

export type ActiveSectionCard = 'kpis' | 'month_tables' | 'offices' | 'hub' | 'audited_orders' | null;
export type ActiveSectionCardId = ActiveSectionCard;

interface MainSectionsRowProps {
  activeViewTab?: string;
  onSelectViewTab?: (tab: any) => void;
  activeSectionCard: ActiveSectionCard;
  onToggleSectionCard: (card: ActiveSectionCard) => void;
  isTableCardOpen: boolean;
  tablePresentationMode?: 'docked' | 'overlay';
  onToggleTableCard: () => void;
  onChangeTablePresentationMode?: (mode: 'docked' | 'overlay') => void;

  // Context Counts & Labels
  totalOrdersCount: number;
  ready155Count: number;
  readyRate?: number;
  underReviewCount?: number;
  notQualifiedCount?: number;
  currentMonthTablesCount?: number;
  monthTables?: MonthTable[];
  activeTableName: string;
  activeYear: number;
  activeMonth: number | 'all';
  selectedOffice: string;
  offices: SubOffice[];
  officeCounts?: Record<string, number>;
  workOrders?: WorkOrder[];
  onSelectOffice: (officeName: string) => void;
  onOpenYearMonthPicker?: () => void;
  onOpenOfficeManager?: () => void;

  // Audit Tracker & Archive Counts (Supports both naming conventions from App.tsx)
  auditTrackerCount?: number;
  auditTrackerPartialCount?: number;
  auditTrackerAuditedStatus?: 'idle' | 'qualified' | 'not_qualified';
  trackedAuditsCount?: number;
  inProgressAuditsCount?: number;
  fullyAuditedOrdersCount?: number;
  urgentQualificationStatus?: 'none' | 'qualified' | 'disqualified' | 'idle' | 'not_qualified';
  urgentDisqualifiedCount?: number;
  urgentQualifiedCount?: number;
  onOpenAuditTrackerModal?: () => void;
  onOpenDataRecovery: () => void;

  // Hub & Quick Actions
  onOpenContractorComparison: () => void;
  onOpenWeeklyReport: () => void;
  onOpenOfficeComparison: () => void;
  onOpenComprehensiveReports: () => void;
  onOpenCommandPalette: () => void;
  onOpenAddOrder: () => void;
  onOpenImportExcel: () => void;
  onOpenCompatibleImport: () => void;
  onOpenNotesReport: (contractorFilter?: string) => void;
  contractorsList: string[];
  currentUser?: PlatformUser | null;
}

const ARABIC_MONTH_NAMES: Record<number, string> = {
  1: 'يناير',
  2: 'فبراير',
  3: 'مارس',
  4: 'أبريل',
  5: 'مايو',
  6: 'يونيو',
  7: 'يوليو',
  8: 'أغسطس',
  9: 'سبتمبر',
  10: 'أكتوبر',
  11: 'نوفمبر',
  12: 'ديسمبر'
};

export const MainSectionsRow: React.FC<MainSectionsRowProps> = ({
  activeViewTab = 'table',
  onSelectViewTab,
  activeSectionCard,
  onToggleSectionCard,
  isTableCardOpen,
  onToggleTableCard,
  totalOrdersCount,
  ready155Count,
  readyRate: propReadyRate,
  currentMonthTablesCount: propMonthTablesCount,
  monthTables = [],
  activeTableName,
  activeYear,
  activeMonth,
  selectedOffice,
  offices,
  officeCounts = {} as Record<string, number>,
  onSelectOffice,
  onOpenYearMonthPicker,
  onOpenOfficeManager,
  auditTrackerCount,
  auditTrackerPartialCount,
  auditTrackerAuditedStatus,
  trackedAuditsCount,
  inProgressAuditsCount,
  fullyAuditedOrdersCount = 0,
  urgentQualificationStatus,
  urgentDisqualifiedCount = 0,
  urgentQualifiedCount = 0,
  onOpenAuditTrackerModal,
  onOpenDataRecovery,
  onOpenContractorComparison,
  onOpenWeeklyReport,
  onOpenOfficeComparison,
  onOpenComprehensiveReports,
  onOpenAddOrder,
  onOpenImportExcel,
  onOpenCompatibleImport,
  onOpenNotesReport,
  contractorsList,
  currentUser
}) => {
  const [selectedContractorForNotes, setSelectedContractorForNotes] = React.useState<string>('all');

  const readyRate =
    typeof propReadyRate === 'number'
      ? propReadyRate
      : totalOrdersCount > 0
      ? Math.round((ready155Count / totalOrdersCount) * 100)
      : 0;

  const monthName =
    activeMonth === 'all'
      ? `كافة شهور ${activeYear}`
      : `${ARABIC_MONTH_NAMES[Number(activeMonth)] || ''} ${activeYear}`;

  // Calculate live number of tables in the active period
  const computedMonthTablesCount = React.useMemo(() => {
    if (typeof propMonthTablesCount === 'number' && propMonthTablesCount > 0) {
      return propMonthTablesCount;
    }
    const customInPeriod = (Array.isArray(monthTables) ? monthTables : []).filter(
      (t) => t && !isDefaultTableId(t.id) && !t.isDefault && isTableInPeriod(t, activeYear, activeMonth)
    ).length;
    return customInPeriod + 1;
  }, [propMonthTablesCount, monthTables, activeYear, activeMonth]);

  // Unified urgent count & qualification status
  const urgentCount =
    trackedAuditsCount ??
    inProgressAuditsCount ??
    auditTrackerPartialCount ??
    auditTrackerCount ??
    0;

  const effectiveUrgentStatus: 'idle' | 'qualified' | 'not_qualified' = React.useMemo(() => {
    if (urgentQualificationStatus === 'disqualified' || urgentQualificationStatus === 'not_qualified' || auditTrackerAuditedStatus === 'not_qualified' || urgentDisqualifiedCount > 0) {
      return 'not_qualified';
    }
    if (urgentQualificationStatus === 'qualified' || auditTrackerAuditedStatus === 'qualified' || (urgentQualifiedCount > 0 && urgentDisqualifiedCount === 0)) {
      return 'qualified';
    }
    return 'idle';
  }, [urgentQualificationStatus, auditTrackerAuditedStatus, urgentDisqualifiedCount, urgentQualifiedCount]);

  return (
    <div className="relative mb-2.5">
      {/* شريط الأيقونات الخمس الرئيسية — حجم صغير ومنسق ومرتب وتفاعلي ومتزامن */}
      <div className="bg-white/95 backdrop-blur-xs rounded-xl border border-slate-200/90 shadow-xs px-2 py-1.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 items-center">
          
          {/* 1. مؤشرات الأداء KPIs */}
          <button
            type="button"
            onClick={() => {
              if (onSelectViewTab && activeViewTab !== 'table') onSelectViewTab('table');
              onToggleSectionCard(activeSectionCard === 'kpis' ? null : 'kpis');
            }}
            className={`group flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-right transition-all duration-150 cursor-pointer ${
              activeSectionCard === 'kpis'
                ? 'bg-gradient-to-l from-[#003B73] to-[#004B8D] text-white border-[#F58220] shadow-sm ring-1 ring-[#F58220]/40'
                : 'bg-slate-50/90 hover:bg-blue-50/70 text-slate-800 border-slate-200/90 hover:border-[#004B8D]/40'
            }`}
            title="فتح أو إغلاق لوحة مؤشرات الأداء والقياس (KPIs)"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                  activeSectionCard === 'kpis'
                    ? 'bg-[#F58220] text-white'
                    : 'bg-[#004B8D]/10 text-[#004B8D]'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 leading-tight">
                <span className="text-[11px] font-black block truncate">مؤشرات الأداء KPIs</span>
                <span
                  className={`text-[9.5px] font-bold block truncate ${
                    activeSectionCard === 'kpis' ? 'text-blue-100' : 'text-slate-500'
                  }`}
                >
                  جاهز {ready155Count} من {totalOrdersCount}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span
                className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-black ${
                  activeSectionCard === 'kpis'
                    ? 'bg-white/20 text-[#FDB813]'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {readyRate}%
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-150 ${
                  activeSectionCard === 'kpis' ? 'rotate-180 text-[#FDB813]' : 'text-slate-400'
                }`}
              />
            </div>
          </button>

          {/* 2. قائمة التنبيه العاجل (مهتزة وتنبيهية بشكل فعلي) */}
          {onOpenAuditTrackerModal && (
            <button
              type="button"
              onClick={onOpenAuditTrackerModal}
              className="group flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border-2 border-[#FDB813] bg-gradient-to-l from-[#DC2626] via-[#E11D48] to-[#F58220] text-white text-right transition-all duration-150 cursor-pointer shadow-md animate-urgent-shake"
              title="قائمة التنبيه العاجل: متابعة أوامر العمل العاجلة والمدققة جزئياً في مراحل التدقيق الثلاث — اضغط للفتح والتوجيه المباشر"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="relative w-6 h-6 rounded-md bg-black/25 border border-[#FDB813]/60 flex items-center justify-center shrink-0 text-[#FDB813]">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#FDB813] animate-urgent-bell" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#FDB813] ring-1 ring-white animate-ping" />
                </div>
                <div className="min-w-0 leading-tight">
                  <span className="text-[11px] font-black text-[#FDB813] block truncate">قائمة التنبيه العاجل</span>
                  <span className="text-[9.5px] font-bold text-white/95 block truncate">
                    {effectiveUrgentStatus === 'not_qualified'
                      ? 'غير مؤهل • متابعة فورية'
                      : effectiveUrgentStatus === 'qualified'
                      ? 'مؤهل • قيد الاستكمال'
                      : 'انقر للتوجيه المباشر'}
                  </span>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-black shrink-0 bg-[#FDB813] text-slate-950 shadow-2xs">
                {urgentCount}
              </span>
            </button>
          )}

          {/* 3. تم التدقيق عليه (الأرشيف الفعلي للأوامر المكتملة 100%) */}
          <button
            type="button"
            onClick={() => {
              if (onSelectViewTab && activeViewTab !== 'table') onSelectViewTab('table');
              onToggleSectionCard(activeSectionCard === 'audited_orders' ? null : 'audited_orders');
            }}
            className={`group flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-right transition-all duration-150 cursor-pointer ${
              activeSectionCard === 'audited_orders'
                ? 'bg-gradient-to-l from-emerald-800 to-teal-800 text-white border-amber-400 shadow-sm ring-1 ring-amber-400/40'
                : 'bg-emerald-50/60 hover:bg-emerald-100/70 text-slate-800 border-emerald-200/90 hover:border-emerald-400'
            }`}
            title="فتح جدول أرشيف (أوامر عمل تم التدقيق عليها) المؤهلة 100% مع إمكانية تعديل حالة إجراء 155"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                  activeSectionCard === 'audited_orders'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 leading-tight">
                <span className="text-[11px] font-black block truncate">تم التدقيق عليه</span>
                <span
                  className={`text-[9.5px] font-bold block truncate ${
                    activeSectionCard === 'audited_orders' ? 'text-emerald-100' : 'text-emerald-800/80'
                  }`}
                >
                  مؤهل 100% • أرشيف 155
                </span>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black shrink-0 ${
                activeSectionCard === 'audited_orders'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}
            >
              {fullyAuditedOrdersCount}
            </span>
          </button>

          {/* 4. جداول التدقيق (ينسدل منها قائمة فوق الصفحة بها السنين والشهور وجداول الشهور) */}
          <div
            onClick={() => {
              if (onSelectViewTab && activeViewTab !== 'table') onSelectViewTab('table');
              onToggleSectionCard(activeSectionCard === 'month_tables' ? null : 'month_tables');
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (onSelectViewTab && activeViewTab !== 'table') onSelectViewTab('table');
                onToggleSectionCard(activeSectionCard === 'month_tables' ? null : 'month_tables');
              }
            }}
            className={`group flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-right transition-all duration-150 cursor-pointer ${
              activeSectionCard === 'month_tables'
                ? 'bg-gradient-to-l from-[#003B73] to-[#004B8D] text-white border-[#F58220] shadow-sm ring-1 ring-[#F58220]/40'
                : 'bg-indigo-50/60 hover:bg-indigo-100/70 text-slate-800 border-indigo-200/90 hover:border-[#004B8D]'
            }`}
            title="فتح القائمة المنسدلة لجداول التدقيق (السنين ⬅ الشهور ⬅ جداول الشهر)"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                  activeSectionCard === 'month_tables'
                    ? 'bg-[#F58220] text-white'
                    : 'bg-[#004B8D] text-white'
                }`}
              >
                <TableProperties className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 leading-tight">
                <span className="text-[11px] font-black block truncate">جداول التدقيق</span>
                <span
                  className={`text-[9.5px] font-bold block truncate ${
                    activeSectionCard === 'month_tables' ? 'text-blue-100' : 'text-slate-500'
                  }`}
                >
                  {activeTableName || monthName}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span
                className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-black ${
                  activeSectionCard === 'month_tables'
                    ? 'bg-white/20 text-[#FDB813]'
                    : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                }`}
              >
                {computedMonthTablesCount}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleTableCard();
                }}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  activeSectionCard === 'month_tables'
                    ? 'hover:bg-white/20 text-white'
                    : 'hover:bg-indigo-200/70 text-slate-500 hover:text-slate-800'
                }`}
                title={isTableCardOpen ? 'طي الجدول الرئيسي' : 'إظهار الجدول الرئيسي'}
              >
                {isTableCardOpen ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-150 ${
                  activeSectionCard === 'month_tables' ? 'rotate-180 text-[#FDB813]' : 'text-slate-400'
                }`}
              />
            </div>
          </div>

          {/* 5. الحوكمة والتقارير */}
          <button
            type="button"
            onClick={() => onToggleSectionCard(activeSectionCard === 'hub' ? null : 'hub')}
            className={`col-span-2 sm:col-span-1 group flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-right transition-all duration-150 cursor-pointer ${
              activeSectionCard === 'hub' || activeSectionCard === 'offices'
                ? 'bg-gradient-to-l from-[#002855] to-[#003B73] text-white border-[#F58220] shadow-sm ring-1 ring-[#F58220]/40'
                : 'bg-amber-50/60 hover:bg-amber-100/70 text-slate-800 border-amber-300/80 hover:border-[#F58220]'
            }`}
            title="فتح القائمة المنسدلة للحوكمة والتقارير والمكاتب والنسخ السحابي"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                  activeSectionCard === 'hub' || activeSectionCard === 'offices'
                    ? 'bg-[#F58220] text-white'
                    : 'bg-[#F58220]/15 text-[#D96B12] border border-[#F58220]/30'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 leading-tight">
                <span className="text-[11px] font-black block truncate">الحوكمة والتقارير</span>
                <span
                  className={`text-[9.5px] font-bold block truncate ${
                    activeSectionCard === 'hub' || activeSectionCard === 'offices'
                      ? 'text-amber-200'
                      : 'text-slate-500'
                  }`}
                >
                  {selectedOffice === 'all' ? `كافة المكاتب (${offices.length})` : selectedOffice}
                </span>
              </div>
            </div>

            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
                activeSectionCard === 'hub' ? 'rotate-180 text-[#FDB813]' : 'text-slate-400'
              }`}
            />
          </button>

        </div>
      </div>

      {/* قائمة الحوكمة والتقارير المنسدلة فوق الصفحة (Floating Popover Overlay) */}
      {(activeSectionCard === 'hub' || activeSectionCard === 'offices') && (
        <div
          className="fixed inset-0 z-[9990] bg-slate-950/45 backdrop-blur-[2px] flex items-start justify-center pt-20 sm:pt-24 px-2 sm:px-4 animate-in fade-in duration-150"
          onClick={() => onToggleSectionCard(null)}
        >
          <div
            className="w-full max-w-5xl bg-white rounded-2xl border-2 border-[#004B8D] p-3.5 sm:p-4 shadow-2xl text-right space-y-3.5 animate-in zoom-in-95 duration-150 max-h-[82vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#003B73] to-[#004B8D] text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-4.5 h-4.5 text-[#FDB813]" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900">
                    مركز الحوكمة والتقارير التنفيذية وإدارة المكاتب — إجراء 155
                  </h4>
                  <p className="text-[10.5px] text-slate-500 font-bold">
                    التقارير الرسمية المعتمدة، تصفية المكاتب الفرعية، تقييم المقاولين، والنسخ الاحتياطية السحابية
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleSectionCard(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-colors cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>إغلاق</span>
              </button>
            </div>

            {/* القسم الأول: تصفية المكاتب الفرعية */}
            <div className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/80 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#004B8D]" />
                  <span className="text-[11px] font-black text-slate-800">
                    تصفية نطاق المكاتب الفرعية ({offices.length} مكاتب معتمدة)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {onOpenYearMonthPicker && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenYearMonthPicker();
                        onToggleSectionCard(null);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-blue-50 text-[#004B8D] border border-slate-200 text-[10.5px] font-black transition-colors cursor-pointer"
                    >
                      <Calendar className="w-3 h-3 text-[#F58220]" />
                      <span>الفترة: {monthName}</span>
                    </button>
                  )}
                  {onOpenOfficeManager && hasUserPermission(currentUser, 'manageOffices') && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenOfficeManager();
                        onToggleSectionCard(null);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#004B8D] hover:bg-[#003B73] text-white text-[10.5px] font-black transition-colors cursor-pointer"
                    >
                      <Settings className="w-3 h-3" />
                      <span>إدارة المكاتب</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    onSelectOffice('all');
                    onToggleSectionCard(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-black text-[11px] transition-all cursor-pointer flex items-center gap-1.5 border ${
                    selectedOffice === 'all'
                      ? 'bg-[#004B8D] text-white border-[#004B8D] shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span>كافة المكاتب</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono ${
                      selectedOffice === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {officeCounts.all ?? totalOrdersCount}
                  </span>
                </button>

                {offices.map((office) => {
                  const count = officeCounts[office.name];
                  const isSelected = selectedOffice === office.name;
                  return (
                    <button
                      key={office.id}
                      type="button"
                      onClick={() => {
                        onSelectOffice(office.name);
                        onToggleSectionCard(null);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5 border ${
                        isSelected
                          ? 'bg-[#F58220] text-white border-[#F58220] shadow-2xs font-black'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span>{office.name}</span>
                      {typeof count === 'number' && (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono font-black ${
                            isSelected ? 'bg-black/20 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* القسم الثاني: بطاقات التقارير التنفيذية */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {hasUserPermission(currentUser, 'viewWeeklyReport') && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenComprehensiveReports();
                    onToggleSectionCard(null);
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-gradient-to-l from-[#003B73] to-[#004B8D] hover:from-[#002855] hover:to-[#003B73] text-white font-black text-xs shadow-xs transition-all cursor-pointer text-right"
                >
                  <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4 text-[#FDB813]" />
                  </div>
                  <div>
                    <div className="text-[11.5px] font-black">مركز التقارير الشامل</div>
                    <div className="text-[9.5px] text-blue-100 font-normal">تقارير تفصيلية ومجمعة</div>
                  </div>
                </button>
              )}

              {hasUserPermission(currentUser, 'viewWeeklyReport') && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenWeeklyReport();
                    onToggleSectionCard(null);
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 text-blue-950 border border-blue-200 font-black text-xs transition-all cursor-pointer text-right"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <CalendarRange className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11.5px] font-black">التقرير الأسبوعي للمكاتب</div>
                    <div className="text-[9.5px] text-blue-700 font-bold">متابعة نسب الإنجاز الأسبوعية</div>
                  </div>
                </button>
              )}

              {hasUserPermission(currentUser, 'viewContractorClosureReport') && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenContractorComparison();
                    onToggleSectionCard(null);
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 text-amber-950 border border-amber-200 font-black text-xs transition-all cursor-pointer text-right"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#F58220] text-white flex items-center justify-center shrink-0">
                    <HardHat className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11.5px] font-black">مقارنة المقاولين والإغلاقات</div>
                    <div className="text-[9.5px] text-amber-800 font-bold">تحليل نسب المطابقة لكل مقاول</div>
                  </div>
                </button>
              )}

              {hasUserPermission(currentUser, 'viewOfficeComparison') && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenOfficeComparison();
                    onToggleSectionCard(null);
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-50/80 hover:bg-purple-100/80 text-purple-950 border border-purple-200 font-black text-xs transition-all cursor-pointer text-right"
                >
                  <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
                    <Scale className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11.5px] font-black">مقارنة أداء المكاتب</div>
                    <div className="text-[9.5px] text-purple-700 font-bold">ترتيب ومؤشرات المكاتب الفرعية</div>
                  </div>
                </button>
              )}
            </div>

            {/* القسم الثالث: الإجراءات السريعة، سجل الملاحظات، ومركز الأمان والنسخ السحابي */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5">
                {hasUserPermission(currentUser, 'addWorkOrder') && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAddOrder();
                      onToggleSectionCard(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] shadow-2xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة أمر عمل</span>
                  </button>
                )}

                {hasUserPermission(currentUser, 'importExcel') && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenImportExcel();
                        onToggleSectionCard(null);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-[11px] transition-all cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-600" />
                      <span>استيراد Excel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onOpenCompatibleImport();
                        onToggleSectionCard(null);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-[11px] transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                      <span>استيراد ذكي</span>
                    </button>
                  </>
                )}

                {onSelectViewTab && hasUserPermission(currentUser, 'viewContractorEvaluation') && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectViewTab(activeViewTab === 'contractors' ? 'table' : 'contractors');
                      onToggleSectionCard(null);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-[11px] border transition-all cursor-pointer ${
                      activeViewTab === 'contractors'
                        ? 'bg-[#004B8D] text-white border-[#004B8D]'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-[#F58220]" />
                    <span>{activeViewTab === 'contractors' ? 'العودة لجدول أوامر العمل' : 'بوابة تقييم المقاولين'}</span>
                  </button>
                )}

                {hasUserPermission(currentUser, 'restoreDeleted') && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenDataRecovery();
                      onToggleSectionCard(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200 font-black text-[11px] transition-all cursor-pointer"
                  >
                    <DatabaseBackup className="w-3.5 h-3.5 text-indigo-600" />
                    <span>مركز الأمان والنسخ السحابي</span>
                  </button>
                )}
              </div>

              {hasUserPermission(currentUser, 'viewQualityNotesReport') && (
                <div className="flex items-center gap-1.5 bg-rose-50/90 border border-rose-200 rounded-lg px-2 py-1">
                  <FileWarning className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <select
                    value={selectedContractorForNotes}
                    onChange={(e) => setSelectedContractorForNotes(e.target.value)}
                    className="bg-white border border-rose-200 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold text-slate-800 focus:outline-hidden"
                  >
                    <option value="all">سجل الملاحظات: كافة المقاولين</option>
                    {contractorsList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenNotesReport(selectedContractorForNotes);
                      onToggleSectionCard(null);
                    }}
                    className="px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-black text-[10.5px] transition-all cursor-pointer"
                  >
                    عرض السجل
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
