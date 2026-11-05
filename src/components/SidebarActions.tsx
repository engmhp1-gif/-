import React from 'react';
import {
  Home,
  PlusCircle,
  Search,
  Radio,
  Users,
  ShieldCheck,
  Lock,
  Calendar,
  BarChart3,
  RefreshCw,
  FolderSync,
  History,
  FileText,
  Zap,
  ChevronsRight,
  Building2,
  Briefcase,
  FileSpreadsheet,
  LogOut,
  UserCheck,
  ListChecks
} from 'lucide-react';
import { SyncStatus } from '../services/realtimeService';
import { PlatformUser } from '../types';
import { hasUserPermission, canAccessSidebarSection } from '../utils/security';

export type SidebarSectionId =
  | 'home'
  | 'projects'
  | 'work_orders'
  | 'quality_ncr'
  | 'visits'
  | 'documents'
  | 'admin_dashboard'
  | 'regions_dashboard'
  | 'contractors'
  | 'consultants'
  | 'calendar'
  | 'audit_trail'
  | 'settings';

export function normalizeSidebarSectionId(sec?: SidebarSectionId | string): SidebarSectionId {
  if (!sec) return 'home';
  if (sec === 'projects') return 'work_orders';
  if (sec === 'consultants') return 'contractors';
  return sec as SidebarSectionId;
}

interface SidebarActionsProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  syncStatus: SyncStatus;
  onlineCount: number;
  totalOrdersCount: number;
  ready155Count: number;
  columnsCount: number;
  officesCount?: number;
  contractorsCount?: number;
  trackedAuditCount?: number;
  fullyAuditedCount?: number;
  activeYear?: number;
  onManualSync: () => void;
  isManualSyncing: boolean;
  onOpenAddModal: () => void;
  onOpenEditSelector: () => void;
  onOpenEditBasicData?: () => void;
  onOpenImportModal?: () => void;
  onOpenCompatibleImport?: () => void;
  onOpenSearchModal: () => void;
  onOpenExportModal: () => void;
  onOpenWeeklyReport?: () => void;
  onOpenOfficeComparison?: () => void;
  onOpenManageOffices?: () => void;
  onOpenManageContractors?: () => void;
  onOpenDropdownManagerWithAuth: () => void;
  onOpenColumnManagerWithAuth: () => void;
  onOpenClearDataModal: () => void;
  onResetData: () => void;
  deletedOrdersCount?: number;
  onOpenRestoreDeletedModal?: () => void;
  onOpenNotificationSettings?: () => void;
  onOpenPermissionsManager?: () => void;
  onOpenContractorComparison?: () => void;
  onOpenSmartAudit?: () => void;
  onOpenDataRecovery?: () => void;
  onOpenAuditTrail?: () => void;
  currentUser?: PlatformUser | null;
  onLogout?: () => void;
  isSoundMuted?: boolean;
  onToggleSound?: () => void;
  onOpenAboutPlatform?: () => void;
  activeViewTab?: string;
  onSelectViewTab?: (tab: any) => void;
  activeSidebarSection?: SidebarSectionId;
  onSelectSidebarSection?: (section: SidebarSectionId) => void;
  onOpenExecutiveDashboard?: () => void;
  onOpenYearMonthPicker?: () => void;
}

export const SIDEBAR_SECTIONS_META: Array<{
  id: SidebarSectionId;
  label: string;
  subtitle: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColorClass: string;
}> = [
  {
    id: 'home',
    label: 'الصفحة الرئيسية',
    subtitle: 'النظرة التنفيذية الشاملة والملخص العام',
    icon: Home,
    iconColorClass: 'text-white'
  },
  {
    id: 'work_orders',
    label: 'جدول أوامر العمل والتدقيق',
    subtitle: 'السجل الميداني ومراحل التدقيق وجداول الشهور',
    icon: FileSpreadsheet,
    iconColorClass: 'text-emerald-300'
  },
  {
    id: 'admin_dashboard',
    label: 'مؤشرات الأداء والقياس (KPIs)',
    subtitle: 'لوحة القياس ونسب الإنجاز والامتثال',
    icon: BarChart3,
    iconColorClass: 'text-rose-300'
  },
  {
    id: 'quality_ncr',
    label: 'الدليل الإرشادي ومراحل التحقق',
    subtitle: 'ضوابط إجراء 155 ومراحل التحقق الـ 18',
    badge: '18 مرحلة',
    icon: ShieldCheck,
    iconColorClass: 'text-teal-300'
  },
  {
    id: 'audit_trail',
    label: 'متابعة التدقيق وأرشيف 155',
    subtitle: 'التنبيه العاجل، المؤهل 100%، وسجل العمليات',
    icon: ListChecks,
    iconColorClass: 'text-amber-300'
  },
  {
    id: 'regions_dashboard',
    label: 'المكاتب الفرعية ومقارنة الأداء',
    subtitle: 'عرعر • رفحاء • طريف • العويقيلة',
    icon: Building2,
    iconColorClass: 'text-sky-300'
  },
  {
    id: 'contractors',
    label: 'المقاولون والاستشاريون',
    subtitle: 'تقييم المقاولين ونماذج إجازة الاستشاري',
    icon: Briefcase,
    iconColorClass: 'text-indigo-300'
  },
  {
    id: 'calendar',
    label: 'الأرشيف السنوي وجداول الشهور',
    subtitle: 'إدارة الفترات المالية والجداول المستقلة',
    icon: Calendar,
    iconColorClass: 'text-yellow-300'
  },
  {
    id: 'visits',
    label: 'التقارير والملاحظات الميدانية',
    subtitle: 'التقارير المعتمدة والملاحظات والصور',
    icon: FileText,
    iconColorClass: 'text-purple-300'
  },
  {
    id: 'documents',
    label: 'الاستيراد والتصدير والنسخ الاحتياطي',
    subtitle: 'Excel • الجداول المتوافقة • الخزنة السحابية',
    icon: FolderSync,
    iconColorClass: 'text-emerald-300'
  },
  {
    id: 'settings',
    label: 'إعدادات النظام والصلاحيات',
    subtitle: 'المستخدمون، الأعمدة، القوائم، والإشعارات',
    icon: Lock,
    iconColorClass: 'text-pink-300'
  }
];

export const SidebarActions: React.FC<SidebarActionsProps> = ({
  isOpen,
  onClose,
  syncStatus,
  onlineCount,
  totalOrdersCount,
  ready155Count,
  columnsCount,
  officesCount = 4,
  contractorsCount = 0,
  trackedAuditCount = 0,
  fullyAuditedCount = 0,
  activeYear = new Date().getFullYear(),
  onManualSync,
  isManualSyncing,
  onOpenAddModal,
  onOpenSearchModal,
  currentUser,
  onLogout,
  activeSidebarSection = 'home',
  onSelectSidebarSection
}) => {
  const normalizedActive = normalizeSidebarSectionId(activeSidebarSection);
  const completionRate = totalOrdersCount > 0 ? Math.round((ready155Count / totalOrdersCount) * 100) : 0;

  const handleSelectSection = (secId: SidebarSectionId) => {
    onSelectSidebarSection?.(secId);
  };

  const getDynamicBadge = (secId: SidebarSectionId, fallback?: string): string | undefined => {
    switch (secId) {
      case 'home':
        return 'الافتراضية';
      case 'work_orders':
        return `${totalOrdersCount}`;
      case 'admin_dashboard':
        return `${completionRate}%`;
      case 'quality_ncr':
        return '18 مرحلة';
      case 'audit_trail':
        return `${trackedAuditCount + fullyAuditedCount}`;
      case 'regions_dashboard':
        return `${officesCount} مكاتب`;
      case 'contractors':
        return contractorsCount > 0 ? `${contractorsCount}` : undefined;
      case 'calendar':
        return `${activeYear}`;
      case 'settings':
        return `${columnsCount} عمود`;
      default:
        return fallback;
    }
  };

  return (
    <>
      {/* Mobile-only Backdrop overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-2xs transition-opacity duration-300 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Vertically Fixed Right Corporate Sidebar (Does not scroll with content, slides in/out via top arrow toggle) */}
      <aside
        className={`fixed top-14 right-0 bottom-0 w-72 xl:w-76 max-w-[88vw] bg-[#002855] text-white border-l border-[#003B73] shadow-2xl z-40 flex flex-col shrink-0 transition-transform duration-300 ease-in-out text-right font-['Cairo',sans-serif] overflow-hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        dir="rtl"
        aria-label="القائمة الجانبية المؤسسية"
      >
        {/* Corporate Brand Header with Dedicated Collapse Arrow */}
        <div className="bg-[#001D40] text-white px-4 py-3 flex items-center justify-between border-b border-blue-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F58220] via-amber-500 to-[#004B8D] p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-[#002855] rounded-[10px] flex items-center justify-center">
                <Zap className="w-4.5 h-4.5 text-[#F58220]" />
              </div>
            </div>
            <div>
              <div className="text-xs font-black tracking-tight text-white leading-tight">
                منظومة الحوكمة الإلكترونية
              </div>
              <div className="text-[11px] font-black text-[#F58220] leading-tight">
                حوكمة الجودة • إجراء 155
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#F58220] hover:text-amber-300 border border-white/15 transition-all cursor-pointer shadow-xs active:scale-95"
            title="إخفاء القائمة الجانبية"
            aria-label="إخفاء القائمة الجانبية"
          >
            <ChevronsRight className="w-4 h-4 stroke-[2.5]" />
            <span className="text-xs font-bold text-white hidden sm:inline">إخفاء</span>
          </button>
        </div>

        {/* Real-Time Cloud Sync Status Banner */}
        <div className="px-3 py-2 bg-[#001D40]/70 border-b border-blue-900/60 shrink-0">
          <div className="bg-[#002855] rounded-xl p-2 border border-[#003B73] shadow-sm space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-100 font-bold flex items-center gap-1.5 text-[11px]">
                <Radio className={`w-3.5 h-3.5 ${syncStatus === 'connected' ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
                <span>المزامنة السحابية الفورية</span>
              </span>
              <button
                type="button"
                onClick={onManualSync}
                disabled={isManualSyncing}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#F58220]/20 hover:bg-[#F58220]/30 text-[#F58220] border border-[#F58220]/40 transition-colors cursor-pointer"
                title="تحديث فوري من الخزنة السحابية"
              >
                <RefreshCw className={`w-3 h-3 ${isManualSyncing ? 'animate-spin' : ''}`} />
                <span>{isManualSyncing ? 'جارٍ...' : 'تحديث'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-center">
              <div className="bg-[#001D40] p-1 rounded-lg border border-blue-900/40">
                <span className="text-[9.5px] text-blue-200/80 block">المتصلون الآن</span>
                <span className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1 font-mono tabular-nums">
                  <Users className="w-3 h-3" />
                  <span>{onlineCount}</span>
                </span>
              </div>
              <div className="bg-[#001D40] p-1 rounded-lg border border-blue-900/40">
                <span className="text-[9.5px] text-blue-200/80 block">إجمالي الأوامر</span>
                <span className="text-xs font-bold text-[#FDB813] font-mono tabular-nums">
                  {totalOrdersCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Unified Platform Classifications Tabs */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-1 text-xs font-['Cairo',sans-serif]">
          <div className="px-2 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-black text-blue-200/80 uppercase tracking-wider">
              تصنيفات وتبويبات المنصة المعتمدة
            </span>
            <span className="text-[9.5px] font-mono text-[#FDB813] font-bold">
              {SIDEBAR_SECTIONS_META.length} أقسام
            </span>
          </div>

          {SIDEBAR_SECTIONS_META.map((sec) => {
            const IconComp = sec.icon;
            const isActive = normalizedActive === sec.id;
            const badgeText = getDynamicBadge(sec.id, sec.badge);
            const isTabPermitted = canAccessSidebarSection(currentUser, sec.id);
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => handleSelectSection(sec.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer text-right group ${
                  isActive
                    ? 'bg-gradient-to-l from-[#F58220] to-[#d96b12] text-white shadow-md ring-1 ring-amber-300/60'
                    : isTabPermitted
                    ? 'text-blue-100 hover:bg-white/10 border border-transparent hover:border-white/10'
                    : 'text-blue-300/50 hover:bg-rose-950/30 border border-transparent hover:border-rose-500/30 opacity-75'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isActive
                        ? 'bg-[#002855]/30 text-white'
                        : isTabPermitted
                        ? 'bg-[#001D40] border border-blue-800/60 group-hover:border-blue-700'
                        : 'bg-[#001D40]/60 border border-rose-800/40'
                    }`}
                  >
                    <IconComp className={`w-3.5 h-3.5 ${isActive ? 'text-white' : isTabPermitted ? sec.iconColorClass : 'text-rose-300/70'}`} />
                  </div>
                  <div className="min-w-0 leading-tight">
                    <div className={`text-[11.5px] truncate flex items-center gap-1 ${isActive ? 'font-black text-white' : 'font-bold text-blue-50'}`}>
                      <span className="truncate">{sec.label}</span>
                      {!isTabPermitted && <Lock className="w-3 h-3 text-rose-400 shrink-0" />}
                    </div>
                    <div className={`text-[9.5px] truncate mt-0.5 ${isActive ? 'text-amber-100 font-bold' : 'text-blue-300/75'}`}>
                      {sec.subtitle}
                    </div>
                  </div>
                </div>
                {badgeText && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-mono font-black shrink-0 ${
                      isActive
                        ? 'bg-[#002855] text-[#FDB813]'
                        : 'bg-[#001D40] text-blue-200 border border-blue-800/60'
                    }`}
                  >
                    {badgeText}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Compact Quick Action Bar (Zero Duplication with Tabs) */}
        <div className="px-3 py-2 bg-[#001D40]/90 border-t border-blue-900/60 grid grid-cols-2 gap-1.5 shrink-0">
          {hasUserPermission(currentUser, 'addWorkOrder') && (
            <button
              type="button"
              onClick={onOpenAddModal}
              id="btn-sidebar-add-order"
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-[#F58220] hover:bg-[#d96b12] text-white font-black text-[11px] transition-all cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">إضافة أمر عمل</span>
            </button>
          )}
          {hasUserPermission(currentUser, 'searchAndFilter') && (
            <button
              type="button"
              onClick={onOpenSearchModal}
              id="btn-sidebar-search"
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-[#002855] hover:bg-[#003B73] text-blue-100 border border-blue-800 font-bold text-[11px] transition-all cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-[#FDB813] shrink-0" />
              <span className="truncate">بحث شامل</span>
            </button>
          )}
        </div>

        {/* Sidebar Footer: Current User & Compliance Summary */}
        <div className="p-2.5 bg-[#001D40] border-t border-blue-900/60 shrink-0 space-y-1.5">
          {currentUser && (
            <div className="bg-[#002855] rounded-xl p-2 border border-[#003B73] flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 text-right leading-tight">
                  <div className="text-[11px] font-black text-white truncate">
                    {currentUser.displayName || currentUser.username}
                  </div>
                  <div className="text-[9.5px] text-[#F58220] font-bold truncate">
                    {currentUser.roleTitle || 'مستخدم معتمد'}
                  </div>
                </div>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-400/30 text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3 h-3" />
                  <span>خروج</span>
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-blue-200 px-1">
            <span>مؤهل 155:</span>
            <span className="font-bold text-emerald-400 font-mono tabular-nums">{ready155Count} أمر</span>
            <span className="text-blue-400/50">|</span>
            <span>نسبة الامتثال:</span>
            <span className="font-bold text-[#FDB813] font-mono tabular-nums">
              {completionRate}%
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
