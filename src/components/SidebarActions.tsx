import React from 'react';
import { 
  PlusCircle, 
  Search, 
  Edit3, 
  FileDown, 
  ListOrdered, 
  Columns3, 
  Trash2, 
  RotateCcw, 
  X, 
  ClipboardCheck, 
  Radio, 
  Users, 
  Layers3, 
  CheckCircle2, 
  ShieldCheck,
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Lock, 
  Calendar, 
  Activity, 
  ArrowRight, 
  RefreshCw, 
  FolderSync, 
  History, 
  Volume2, 
  VolumeX, 
  Award, 
  FileText, 
  Zap, 
  ChevronsRight, 
  ChevronsLeft,
  Building2,
  Briefcase,
  FileSpreadsheet,
  FileEdit,
  Bell,
  BellRing,
  KeyRound,
  LogOut,
  UserCheck
} from 'lucide-react';
import { SyncStatus } from '../services/realtimeService';
import { PlatformUser } from '../types';
import { hasUserPermission, hasFullPermissions } from '../utils/security';

interface SidebarActionsProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  syncStatus: SyncStatus;
  onlineCount: number;
  totalOrdersCount: number;
  ready155Count: number;
  columnsCount: number;
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
}

export const SidebarActions: React.FC<SidebarActionsProps> = ({
  isOpen,
  onClose,
  onToggle,
  syncStatus,
  onlineCount,
  totalOrdersCount,
  ready155Count,
  columnsCount,
  onManualSync,
  isManualSyncing,
  onOpenAddModal,
  onOpenEditSelector,
  onOpenEditBasicData,
  onOpenImportModal,
  onOpenCompatibleImport,
  onOpenSearchModal,
  onOpenExportModal,
  onOpenWeeklyReport,
  onOpenOfficeComparison,
  onOpenManageOffices,
  onOpenManageContractors,
  onOpenDropdownManagerWithAuth,
  onOpenColumnManagerWithAuth,
  onOpenClearDataModal,
  onResetData,
  deletedOrdersCount = 0,
  onOpenRestoreDeletedModal,
  onOpenNotificationSettings,
  onOpenPermissionsManager,
  onOpenContractorComparison,
  onOpenSmartAudit,
  onOpenDataRecovery,
  onOpenAuditTrail,
  currentUser,
  onLogout,
  isSoundMuted = false,
  onToggleSound,
  onOpenAboutPlatform,
}) => {
  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-2xs transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Full-Page-Height Adaptive Sidebar Column (بطول الصفحة وتكييفي مع الارتفاع) */}
      <aside
        className={`fixed top-0 right-0 h-screen max-h-screen w-80 max-w-[90vw] bg-white text-slate-800 border-l border-slate-200 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out text-right font-['Cairo',sans-serif] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        dir="rtl"
        aria-label="العمود الجانبي للعمليات"
      >
        {/* Sidebar Header: Close Button and Title */}
        <div className="bg-slate-50 p-4 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-indigo-800 border border-emerald-500/40 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-wide">
                  حوكمة جودة اعمال الانشاءات
                </h2>
                <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 text-[9px] font-bold border border-blue-200">
                  إجراء 155
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                شريط العمليات وإدارة الأدوات المعتمدة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-250 transition-all cursor-pointer shadow-2xs"
            title="إخفاء وطوي العمود الجانبي"
          >
            <span className="text-xs font-bold text-slate-700">طي</span>
            <ChevronsRight className="w-4 h-4 text-slate-700 stroke-[3]" />
          </button>
        </div>

        {/* Real-Time Live Sync Status Banner */}
        <div className="p-3 bg-slate-50/70 border-b border-slate-200 shrink-0">
          <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium flex items-center gap-1.5 text-[11px]">
                <Radio className={`w-3.5 h-3.5 ${syncStatus === 'connected' ? 'text-emerald-600 animate-pulse' : 'text-amber-500'}`} />
                <span>المزامنة السحابية:</span>
              </span>
              <button
                type="button"
                onClick={onManualSync}
                disabled={isManualSyncing}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer"
                title="اضغط للتحديث الفوري"
              >
                <RefreshCw className={`w-3 h-3 ${isManualSyncing ? 'animate-spin' : ''}`} />
                <span>{isManualSyncing ? 'جارٍ...' : 'تحديث'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1 text-center">
              <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">المتصلون</span>
                <span className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1 font-mono">
                  <Users className="w-3 h-3" />
                  <span>{onlineCount}</span>
                </span>
              </div>
              <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">إجمالي الأوامر</span>
                <span className="text-xs font-bold text-blue-700 font-mono">
                  {totalOrdersCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Adaptive Tool Groups (تكييفي مع ارتفاع الصفحة) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs font-['Cairo',sans-serif]">
          
          {/* Featured Permissions & Accounts Icon in Sidebar (الصلاحيات - لمن لديه الصلاحيات كاملة فقط) */}
          {onOpenPermissionsManager && hasFullPermissions(currentUser) && (
            <div className="space-y-1.5 pb-2 border-b border-slate-800">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider px-2 flex items-center justify-between">
                <span>الحوكمة وإدارة الحسابات</span>
                <KeyRound className="w-3 h-3 text-amber-400" />
              </span>
              <button
                type="button"
                onClick={onOpenPermissionsManager}
                id="btn-sidebar-permissions"
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 hover:from-emerald-600 hover:to-teal-600 text-white font-black border border-emerald-400/40 shadow-lg transition-all cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center text-amber-300 shrink-0 group-hover:scale-105 transition-transform">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div className="text-right flex-1">
                  <div className="font-black text-xs sm:text-sm text-white flex items-center justify-between">
                    <span>الصلاحيات</span>
                    <span className="text-[9px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-black">
                      إدارة المستخدمين
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-100 mt-0.5">
                    إنشاء حسابات بالإيميل وتخصيص الصلاحيات
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Group 1: Primary Field Actions */}
          {(hasUserPermission(currentUser, 'addWorkOrder') || 
            hasUserPermission(currentUser, 'editWorkOrderStatus') || 
            hasUserPermission(currentUser, 'editWorkOrderBasic') || 
            hasUserPermission(currentUser, 'importExcel') || 
            hasUserPermission(currentUser, 'searchAndFilter') || 
            hasUserPermission(currentUser, 'exportTable') || 
            hasUserPermission(currentUser, 'viewWeeklyReport') || 
            hasUserPermission(currentUser, 'viewOfficeComparison') || 
            hasUserPermission(currentUser, 'viewContractorClosureReport')) && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">
                العمليات الميدانية
              </span>

              {/* 1. Add New Work Order */}
              {hasUserPermission(currentUser, 'addWorkOrder') && (
                <button
                  type="button"
                  onClick={onOpenAddModal}
                  id="btn-sidebar-add-order"
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold border border-slate-200 shadow-2xs transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-105 transition-transform">
                    <PlusCircle className="w-4 h-4" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-xs text-slate-900">إضافة أمر عمل جديد</div>
                    <div className="text-[10px] text-slate-500">تسجيل وتوثيق أمر ميداني</div>
                  </div>
                </button>
              )}



              {/* 2. Edit Work Order Status */}
              {hasUserPermission(currentUser, 'editWorkOrderStatus') && (
                <button
                  type="button"
                  onClick={onOpenEditSelector}
                  id="btn-sidebar-edit-order"
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition-colors cursor-pointer group shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-amber-600 shrink-0">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-xs text-slate-900">تحديث الحالة</div>
                    <div className="text-[10px] text-slate-500">توثيق الصور، النماذج، وملاحظات الجودة</div>
                  </div>
                </button>
              )}

              {/* 2.1 Edit Basic Work Order Data */}
              {onOpenEditBasicData && hasUserPermission(currentUser, 'editWorkOrderBasic') && (
                <button
                  type="button"
                  onClick={onOpenEditBasicData}
                  id="btn-sidebar-edit-basic-order"
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition-colors cursor-pointer group shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-blue-600 shrink-0">
                    <FileEdit className="w-4 h-4" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-xs text-slate-900">تعديل بيانات أمر العمل</div>
                    <div className="text-[10px] text-slate-500">المكتب، المقاول، رقم الأمر، الرمز</div>
                  </div>
                </button>
              )}

              {/* 2.2 Import from Excel */}
              {onOpenImportModal && hasUserPermission(currentUser, 'importExcel') && (
                <button
                  type="button"
                  onClick={onOpenImportModal}
                  id="btn-sidebar-import-excel"
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition-colors cursor-pointer group shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-emerald-600 shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-xs text-slate-900">استيراد من Excel</div>
                    <div className="text-[10px] text-slate-500">إدراج فوري مع تحميل النموذج المعتمد</div>
                  </div>
                </button>
              )}

              {/* 3. Advanced Search & Filter */}
              {hasUserPermission(currentUser, 'searchAndFilter') && (
                <button
                  type="button"
                  onClick={onOpenSearchModal}
                  id="btn-sidebar-search"
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition-colors cursor-pointer group shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-indigo-600 shrink-0">
                    <Search className="w-4 h-4" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-xs text-slate-900">البحث والفلترة المتقدمة</div>
                    <div className="text-[10px] text-slate-500">استعلام برقم الأمر أو المقاول</div>
                  </div>
                </button>
              )}

              {/* 4. Export Reports */}
              {hasUserPermission(currentUser, 'exportTable') && (
                <button
                  type="button"
                  onClick={onOpenExportModal}
                  id="btn-sidebar-export"
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition-colors cursor-pointer group shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-amber-600 shrink-0">
                    <FileDown className="w-4 h-4" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-xs text-slate-900">تصدير التقارير المعتمدة</div>
                    <div className="text-[10px] text-slate-500">ملفات Excel ومحاضر PDF</div>
                  </div>
                </button>
              )}

              {/* 4.1 Weekly Administrative PDF Report */}
              {onOpenWeeklyReport && hasUserPermission(currentUser, 'viewWeeklyReport') && (
                <button
                  type="button"
                  onClick={onOpenWeeklyReport}
                  id="btn-sidebar-weekly-report"
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-blue-50/80 hover:bg-blue-100/90 text-blue-900 border border-blue-200 transition-colors cursor-pointer group shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <span>التقرير الأسبوعي الإداري</span>
                      <span className="text-[9px] bg-blue-600 px-1.5 py-0.2 rounded text-white font-mono">PDF</span>
                    </div>
                    <div className="text-[10px] text-blue-800/80">إنجازات المكاتب للجهات الإدارية</div>
                  </div>
                </button>
              )}

              {/* 4.2 Sub-Offices Performance Benchmarking */}
              {onOpenOfficeComparison && hasUserPermission(currentUser, 'viewOfficeComparison') && (
                <button
                  type="button"
                  onClick={onOpenOfficeComparison}
                  id="btn-sidebar-office-comparison"
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-amber-50/80 hover:bg-amber-100/90 text-amber-900 border border-amber-250 transition-colors cursor-pointer group shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-250 flex items-center justify-center text-amber-700 shrink-0">
                    <Award className="w-4 h-4" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <span>مقارنة أداء المكاتب</span>
                      <span className="text-[9px] bg-amber-600 px-1.5 py-0.2 rounded text-white font-bold">تنافسي</span>
                    </div>
                    <div className="text-[10px] text-amber-800/80">ترتيب ونسب إنجاز إجراء 155</div>
                  </div>
                </button>
              )}

              {/* 4.3 Contractors Closure Comparison & Periodic Reports */}
              {onOpenContractorComparison && hasUserPermission(currentUser, 'viewContractorClosureReport') && (
                <button
                  type="button"
                  onClick={onOpenContractorComparison}
                  id="btn-sidebar-contractor-comparison"
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-900 border border-emerald-250 transition-colors cursor-pointer group shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-250 flex items-center justify-center text-emerald-700 shrink-0">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <span>مقارنة المقاولين وتقارير الإغلاق</span>
                      <span className="text-[9px] bg-emerald-600 px-1.5 py-0.2 rounded text-white font-bold">دوري</span>
                    </div>
                    <div className="text-[10px] text-emerald-800/80">أسبوعي • شهري • ربع/نصف سنوي • سنوي</div>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Group 2: Administration & Customization */}
          {(hasUserPermission(currentUser, 'manageOffices') || 
            hasUserPermission(currentUser, 'manageContractors') || 
            hasUserPermission(currentUser, 'manageDropdowns') || 
            hasUserPermission(currentUser, 'manageColumns')) && (
            <div className="space-y-1.5 pt-2 border-t border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 flex items-center justify-between">
                <span>إدارة وتدقيق الهيكل</span>
                <Lock className="w-3 h-3 text-slate-400" />
              </span>

              {/* 4.9 Manage Offices */}
              {onOpenManageOffices && hasUserPermission(currentUser, 'manageOffices') && (
                <button
                  type="button"
                  onClick={onOpenManageOffices}
                  id="btn-sidebar-manage-offices"
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition-colors cursor-pointer group shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-blue-600 shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <span>إدارة وتعديل المكاتب</span>
                      <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-mono border border-blue-200">تعديل/إضافة/حذف</span>
                    </div>
                    <div className="text-[10px] text-slate-500">تعديل المكاتب الفرعية ونقل الأوامر</div>
                  </div>
                </button>
              )}

              {/* 4.10 Manage Contractors Distribution */}
              {onOpenManageContractors && hasUserPermission(currentUser, 'manageContractors') && (
                <button
                  type="button"
                  onClick={onOpenManageContractors}
                  id="btn-sidebar-manage-contractors"
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition-colors cursor-pointer group shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-amber-600 shrink-0">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <span>توزيع مقاولي المكاتب</span>
                      <span className="text-[9px] bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded font-bold border border-amber-200">معتمد ومتزامن</span>
                    </div>
                    <div className="text-[10px] text-slate-500">ربط المقاولين بالمكاتب وإضافة/حذف</div>
                  </div>
                </button>
              )}

              {/* 5. Dropdown Options Manager */}
              {hasUserPermission(currentUser, 'manageDropdowns') && (
                <button
                  type="button"
                  onClick={onOpenDropdownManagerWithAuth}
                  id="btn-sidebar-dropdowns"
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition-colors cursor-pointer group shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-purple-600 shrink-0">
                    <ListOrdered className="w-4 h-4" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-xs text-slate-900">إدارة القوائم المنسدلة</div>
                    <div className="text-[10px] text-slate-500">تعديل وإضافة الخيارات (PIN)</div>
                  </div>
                </button>
              )}

              {/* 6. Columns Manager */}
              {hasUserPermission(currentUser, 'manageColumns') && (
                <button
                  type="button"
                  onClick={onOpenColumnManagerWithAuth}
                  id="btn-sidebar-columns"
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition-colors cursor-pointer group shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-sky-600 shrink-0">
                    <Columns3 className="w-4 h-4" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-xs text-slate-900">إدارة مسميات الأعمدة</div>
                    <div className="text-[10px] text-slate-500">ترتيب وتخصيص الأعمدة ({columnsCount})</div>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Group 3: Data Management & Reset */}
          {(hasUserPermission(currentUser, 'clearData') || 
            hasUserPermission(currentUser, 'restoreDeleted') || 
            hasUserPermission(currentUser, 'manageNotifications') || 
            hasFullPermissions(currentUser)) && (
            <div className="space-y-1.5 pt-2 border-t border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">
                الصيانة والصلاحيات والبيانات
              </span>

              {/* إدارة المستخدمين والصلاحيات (تظهر لمن لديه كامل الصلاحيات فقط) */}
              {onOpenPermissionsManager && hasFullPermissions(currentUser) && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPermissionsManager();
                  }}
                  id="btn-sidebar-permissions"
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-300 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-250 group-hover:scale-105 transition-transform">
                    <KeyRound className="w-4 h-4 text-amber-700" />
                  </div>
                  <div className="text-right flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-amber-950">المستخدمون والصلاحيات</span>
                      <span className="text-[9px] bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded font-bold border border-amber-300">صلاحية كاملة</span>
                    </div>
                    <div className="text-[10px] text-amber-800 truncate">
                      إدارة حسابات المستفيدين والأدوار والتحكم الكامل
                    </div>
                  </div>
                </button>
              )}

              {/* 7. Clear All Data */}
              {hasUserPermission(currentUser, 'clearData') && (
                <button
                  type="button"
                  onClick={onOpenClearDataModal}
                  id="btn-sidebar-clear"
                  className="w-full flex items-center gap-3 p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-colors cursor-pointer shadow-2xs"
                >
                  <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700 shrink-0 border border-rose-200">
                    <Trash2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-xs text-rose-900">تفريغ البيانات جذرياً</div>
                    <div className="text-[10px] text-rose-700/80">حذف كافة الأوامر الميدانية</div>
                  </div>
                </button>
              )}

              {/* Restore Deleted Orders (Trash Bin) permanently disabled */}

              {/* 7.5 Immutable Audit Trail Viewer (سجل التدقيق التاريخي الشامل - للاستعراض فقط) */}
              {onOpenAuditTrail && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuditTrail();
                  }}
                  id="btn-sidebar-audit-trail"
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 border border-emerald-250 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                    <History className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-slate-900">سجل التدقيق الشامل (Audit Trail)</span>
                      <Lock className="w-3 h-3 text-emerald-700" />
                    </div>
                    <div className="text-[10px] text-emerald-800">
                      توثيق جميع العمليات النهائية (للاستعراض فقط)
                    </div>
                  </div>
                </button>
              )}

              {/* 7.6 Data Recovery & Cloud Vault */}
              {onOpenDataRecovery && hasUserPermission(currentUser, 'restoreDeleted') && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDataRecovery();
                  }}
                  id="btn-sidebar-data-recovery"
                  className="w-full flex items-center gap-3 p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 transition-colors cursor-pointer shadow-2xs"
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                    <FolderSync className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-indigo-900">مركز الأمان والنسخ الاحتياطية</span>
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    </div>
                    <div className="text-[10px] text-indigo-700">
                      استرجاع وحفظ النسخ السحابية التلقائية
                    </div>
                  </div>
                </button>
              )}

              {/* 8. Reset Sample Data */}
              {hasUserPermission(currentUser, 'clearData') && (
                <button
                  type="button"
                  onClick={onResetData}
                  id="btn-sidebar-reset"
                  className="w-full flex items-center gap-3 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-right flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800">استعادة البيانات النموذجية</span>
                      <Lock className="w-3 h-3 text-slate-400" />
                    </div>
                    <div className="text-[10px] text-slate-500">إعادة ضبط الأوامر (محمي برمز الأمان)</div>
                  </div>
                </button>
              )}

              {/* 8.5 Background Push Notifications Center Button */}
              {onOpenNotificationSettings && (hasUserPermission(currentUser, 'manageNotifications') || Boolean(currentUser?.isSuperAdmin)) && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenNotificationSettings();
                  }}
                  id="btn-sidebar-notifications"
                  className="w-full flex items-center gap-3 p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-250 transition-colors cursor-pointer shadow-2xs"
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 relative">
                    <BellRing className="w-3.5 h-3.5" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500"></span>
                  </div>
                  <div className="text-right flex-1">
                    <div className="font-bold text-xs text-amber-900">مركز الإشعارات الفورية</div>
                    <div className="text-[10px] text-amber-800">إشعارات التحديث وإرسال تنبيه جماعي</div>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Group 4: Device & Environment */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">
              الجهاز والتفضيلات
            </span>

            {/* 9. Sound Notification Toggle */}
            {onToggleSound && (
              <button
                type="button"
                onClick={onToggleSound}
                id="btn-sidebar-sound"
                className={`w-full flex items-center gap-3 p-2 rounded-xl border transition-colors cursor-pointer shadow-2xs ${
                  !isSoundMuted 
                    ? 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200' 
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  !isSoundMuted ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  {!isSoundMuted ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </div>
                <div className="text-right flex-1">
                  <div className="font-bold text-xs text-slate-900">
                    {!isSoundMuted ? 'التنبيهات الصوتية: نشطة' : 'التنبيهات الصوتية: صامتة'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {!isSoundMuted ? 'صوت تنبيه فوري عند كل إجراء' : 'انقر للتفعيل وسماع التنبيهات'}
                  </div>
                </div>
              </button>
            )}

          </div>

        </div>

        {/* Sidebar Footer: Current Logged-In User, Logout & Summary */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0 space-y-2.5">
          {currentUser && (
            <div className="bg-white rounded-xl p-2.5 border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-[11px] font-black text-slate-900 truncate">
                    {currentUser.displayName || currentUser.username}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-bold truncate">
                    {currentUser.roleTitle || 'مستخدم معتمد'}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono truncate">
                    User: {currentUser.username}
                  </div>
                </div>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-250 text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer shrink-0 shadow-2xs"
                  title="تسجيل الخروج من المنصة"
                >
                  <LogOut className="w-3 h-3" />
                  <span>خروج</span>
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>مؤهل 155:</span>
            <span className="font-bold text-emerald-700 font-mono">{ready155Count} أمر</span>
            <span className="text-slate-300">|</span>
            <span>الامتثال:</span>
            <span className="font-bold text-blue-700 font-mono">
              {totalOrdersCount > 0 ? Math.round((ready155Count / totalOrdersCount) * 100) : 0}%
            </span>
          </div>
        </div>

      </aside>
    </>
  );
};
