import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { OfficeSelector } from './components/OfficeSelector';
import { WorkOrdersTable } from './components/WorkOrdersTable';
import { AddWorkOrderModal } from './components/AddWorkOrderModal';
import { SearchModal } from './components/SearchModal';
import { EditWorkOrderModal } from './components/EditWorkOrderModal';
import { PhotoGalleryModal } from './components/PhotoGalleryModal';
import { Procedure155DetailsModal } from './components/Procedure155DetailsModal';
import { PinAuthModal } from './components/PinAuthModal';
import { DropdownManagerModal } from './components/DropdownManagerModal';
import { ColumnManagerModal } from './components/ColumnManagerModal';
import { ClearDataModal } from './components/ClearDataModal';
import { SidebarActions, SidebarSectionId, SIDEBAR_SECTIONS_META, normalizeSidebarSectionId } from './components/SidebarActions';
import { KPIDashboard, KPIFilterType } from './components/KPIDashboard';
import { EnterpriseExecutiveDashboard } from './components/EnterpriseExecutiveDashboard';
import { Procedure18GuideView } from './components/Procedure18GuideView';
import { DeletedOrderEntry } from './components/RestoreDeletedModal';
import { EditBasicWorkOrderModal } from './components/EditBasicWorkOrderModal';
import type { CompatibleImportResultOptions } from './components/CompatibleTableImportModal';
import type { NotesReportMode } from './components/QualityNotesReportModal';
import { ManageOfficesModal } from './components/ManageOfficesModal';
import { ManageContractorsModal } from './components/ManageContractorsModal';
import { GlobalSmartSearch } from './components/GlobalSmartSearch';
import { YearMonthSections } from './components/YearMonthSections';
import { MonthTablesBar } from './components/MonthTablesBar';
import { YearMonthPickerModal } from './components/YearMonthPickerModal';
import { YearMonthTablesTree } from './components/YearMonthTablesTree';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { NotificationPromptBanner } from './components/NotificationPromptBanner';
import { notificationService } from './services/notificationService';
import { ExecutiveHubBar, MainViewTab } from './components/ExecutiveHubBar';
import { MainSectionsRow, ActiveSectionCardId } from './components/MainSectionsRow';
import { QuickCommandPalette } from './components/QuickCommandPalette';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { LoginScreen } from './components/LoginScreen';
import { AccessDeniedModal } from './components/AccessDeniedModal';
import { OfficialEnterpriseDock } from './components/OfficialEnterpriseDock';
import { useUIDesignMode } from './utils/uiDesignMode';
import { getContractorsForOffice, getConsultantsForOffice, sanitizeConsultantsList } from './services/contractorService';
import { soundService, ActionSoundType } from './services/soundService';
import { realtime, SyncStatus } from './services/realtimeService';
import { vaultService } from './services/vaultService';
import { auditTrailService } from './services/auditTrailService';
import { DuplicateWorkOrderAlertModal } from './components/DuplicateWorkOrderAlertModal';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

const ExportPreviewModal = React.lazy(() => import('./components/ExportPreviewModal').then(m => ({ default: m.ExportPreviewModal })));
const ImportExcelModal = React.lazy(() => import('./components/ImportExcelModal').then(m => ({ default: m.ImportExcelModal })));
const CompatibleTableImportModal = React.lazy(() => import('./components/CompatibleTableImportModal').then(m => ({ default: m.CompatibleTableImportModal })));
const QualityNotesReportModal = React.lazy(() => import('./components/QualityNotesReportModal').then(m => ({ default: m.QualityNotesReportModal })));
const WeeklyReportModal = React.lazy(() => import('./components/WeeklyReportModal').then(m => ({ default: m.WeeklyReportModal })));
const OfficePerformanceComparisonModal = React.lazy(() => import('./components/OfficePerformanceComparisonModal').then(m => ({ default: m.OfficePerformanceComparisonModal })));
const ContractorClosureReportModal = React.lazy(() => import('./components/ContractorClosureReportModal').then(m => ({ default: m.ContractorClosureReportModal })));
const ComprehensiveReportsModal = React.lazy(() => import('./components/ComprehensiveReportsModal').then(m => ({ default: m.ComprehensiveReportsModal })));
const DataRecoveryModal = React.lazy(() => import('./components/DataRecoveryModal').then(m => ({ default: m.DataRecoveryModal })));
const PermissionsManagerModal = React.lazy(() => import('./components/PermissionsManagerModal').then(m => ({ default: m.PermissionsManagerModal })));
const AboutPlatformModal = React.lazy(() => import('./components/AboutPlatformModal').then(m => ({ default: m.AboutPlatformModal })));
const AuditTrailModal = React.lazy(() => import('./components/AuditTrailModal').then(m => ({ default: m.AuditTrailModal })));
import { db as firestoreDb, auth as firebaseAuth, handleFirestoreError, OperationType } from './firebase';
import {
  getDefaultTableId,
  isDefaultTableId,
  doesOrderMatchTableView,
  resolveOrderYearMonth,
  resolveOrderTableId,
  resolveOrderScope,
  findMatchingMonthTable,
  getArabicMonthName,
  getNextTableSerialNumber,
  findExistingWorkOrderConflicts,
  DuplicateWorkOrderConflict,
  getWorkOrderIdentityKey,
  isSameWorkOrderIdentity,
  deduplicateWorkOrdersByIdentity,
  isTableInPeriod
} from './utils/tableScope';
import { 
  WorkOrder, 
  SubOffice, 
  PhotoItem, 
  Procedure155Status, 
  ColumnDefinition, 
  DropdownOptionsMap, 
  ArchivedReportSnapshot, 
  HistoryStep, 
  MonthTable,
  PlatformUser,
  UserPermissions,
  ConnectedUserInfo
} from './types';
import {
  isSessionUnlocked,
  setSessionUnlocked,
  getSavedCurrentUser,
  saveCurrentUser,
  hasUserPermission,
  hasFullPermissions,
  canManagePlatformPermissions,
  ensureDefaultSuperAdmins,
  DEFAULT_SUPER_ADMIN_USERS,
  isUserSuperAdmin,
  isPlatformRunningInStudioIframe,
  SIDEBAR_SECTION_PERMISSION_MAP
} from './utils/security';
import { 
  INITIAL_OFFICES, 
  INITIAL_WORK_ORDERS, 
  INITIAL_COLUMNS, 
  INITIAL_DROPDOWN_OPTIONS,
  ensurePhotosFileColumn
} from './data/initialData';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  FileSpreadsheet, 
  AlertTriangle, 
  Radio, 
  Bell, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  Check,
  Building2,
  Trash2,
  RotateCcw,
  X,
  Volume2,
  VolumeX,
  Lock,
  History,
  Loader2,
  BarChart3,
  Table2,
  FolderTree,
  TableProperties,
  ListChecks,
  Archive,
  Calendar,
  Zap,
  BookOpen,
  Plus,
  Home
} from 'lucide-react';
import { AuditTrackerModal } from './components/AuditTrackerModal';
import {
  getOrderAuditTrackerInfo,
  findWorkOrderByNumberAndType,
  isOrderQualified100InAllThreeAudits,
  isOrderArchivedIn155,
  getEffectiveProcedure155Status
} from './utils/auditTracker';
import {
  getEvaluatedSupportChecklistKeys,
  getEvaluatedColumnSupportChecklistKeys
} from './components/TechnicalSupportAuditModal';

// Helper to ensure strictly unique work order IDs and (workOrderNumber, workOrderCode) identities in state
function deduplicateOrders(orders: WorkOrder[]): WorkOrder[] {
  return deduplicateWorkOrdersByIdentity(orders);
}

function normalizeOfficesConsultants(rawOffices: SubOffice[]): SubOffice[] {
  return rawOffices.map(off => ({
    ...off,
    consultants: sanitizeConsultantsList(off.consultants),
    defaultConsultant: sanitizeConsultantsList(off.consultants)[0] || 'المحايد'
  }));
}

function normalizeDropdownConsultants(rawOpts: DropdownOptionsMap): DropdownOptionsMap {
  const officeConsultants: Record<string, string[]> = { ...(INITIAL_DROPDOWN_OPTIONS.officeConsultants || {}) };
  if (rawOpts.officeConsultants && typeof rawOpts.officeConsultants === 'object') {
    for (const [k, v] of Object.entries(rawOpts.officeConsultants)) {
      officeConsultants[k] = sanitizeConsultantsList(v);
    }
  }
  const normalized: DropdownOptionsMap = {
    ...INITIAL_DROPDOWN_OPTIONS,
    ...rawOpts,
    consultant: sanitizeConsultantsList(rawOpts.consultant),
    officeConsultants,
    attachmentStatus: Array.isArray(rawOpts.attachmentStatus) && rawOpts.attachmentStatus.length > 0
      ? rawOpts.attachmentStatus
      : INITIAL_DROPDOWN_OPTIONS.attachmentStatus
  };
  delete normalized.workOrderCode;
  return normalized;
}

export default function App() {
  const [uiMode] = useUIDesignMode();
  const isERP = uiMode === 'official_erp';
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() => {
    const cached = vaultService.getSavedWorkOrders();
    if (Array.isArray(cached) && cached.length > 0) {
      return deduplicateOrders(cached);
    }
    return [];
  });
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false);
  const [offices, setOffices] = useState<SubOffice[]>(() => {
    const saved = vaultService.getSavedOffices();
    return normalizeOfficesConsultants(Array.isArray(saved) && saved.length > 0 ? saved : INITIAL_OFFICES);
  });
  const [columns, setColumns] = useState<ColumnDefinition[]>(() => {
    const saved = vaultService.getSavedColumns();
    const cols = Array.isArray(saved) && saved.length > 0 ? saved : INITIAL_COLUMNS;
    return ensurePhotosFileColumn(cols);
  });
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOptionsMap>(() => {
    const saved = vaultService.getSavedDropdownOptions();
    if (saved && Object.keys(saved).length > 0) {
      return normalizeDropdownConsultants(saved);
    }
    return INITIAL_DROPDOWN_OPTIONS;
  });

  const [selectedOffice, setSelectedOffice] = useState<string>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [kpiFilter, setKpiFilter] = useState<KPIFilterType>('all');
  const [is155GuideOpen, setIs155GuideOpen] = useState<boolean>(false);
  const [tablePresentationMode, setTablePresentationMode] = useState<'docked' | 'overlay'>('docked');
  const [isTableCardOpen, setIsTableCardOpen] = useState<boolean>(true);
  const [activeSectionCard, setActiveSectionCard] = useState<ActiveSectionCardId>(null);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [connectedUsersList, setConnectedUsersList] = useState<ConnectedUserInfo[]>([]);
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);
  const [liveToast, setLiveToast] = useState<{ 
    message: string; 
    type: ActionSoundType;
    undoOrders?: WorkOrder[];
  } | null>(null);

  // Instant Alert & Sound Notification Helper (Defined early to eliminate TDZ)
  const showNotification = useCallback((
    message: string, 
    type: ActionSoundType = 'update',
    undoOrders?: WorkOrder[]
  ) => {
    try {
      soundService.playActionSound(type);
    } catch (_) {}

    setLiveToast({ message, type, undoOrders });
    setTimeout(() => {
      setLiveToast((curr) => curr?.message === message ? null : curr);
    }, 6000);
  }, []);

  // Sound Alerts Mute / Unmute State
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(!soundService.isSoundEnabled());

  // Deleted Orders Trash Bin & Protected Undo
  const [deletedOrders, setDeletedOrders] = useState<DeletedOrderEntry[]>([]);
  const [pendingUndoOrders, setPendingUndoOrders] = useState<WorkOrder[] | null>(null);
  const [isRestoreDeletedModalOpen, setIsRestoreDeletedModalOpen] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [isBasicEditModalOpen, setIsBasicEditModalOpen] = useState(false);
  const [basicEditingOrder, setBasicEditingOrder] = useState<WorkOrder | null>(null);
  const [isImportExcelModalOpen, setIsImportExcelModalOpen] = useState(false);
  const [isCompatibleImportModalOpen, setIsCompatibleImportModalOpen] = useState(false);
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [duplicateAlertState, setDuplicateAlertState] = useState<{
    isOpen: boolean;
    conflicts: DuplicateWorkOrderConflict[];
    sourceLabel: string;
    acceptedCount?: number;
  }>({
    isOpen: false,
    conflicts: [],
    sourceLabel: ''
  });

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportCustomOrders, setExportCustomOrders] = useState<WorkOrder[] | null>(null);
  const [exportCustomTitle, setExportCustomTitle] = useState<string>('');
  const [tableFilteredOrders, setTableFilteredOrders] = useState<WorkOrder[]>([]);
  const [isEmailExportInitiallyOpen, setIsEmailExportInitiallyOpen] = useState<boolean>(false);

  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [photoOrder, setPhotoOrder] = useState<WorkOrder | null>(null);

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditOrder, setAuditOrder] = useState<WorkOrder | null>(null);

  // Quality Notes Report Modal State (تقرير الملاحظات والملاحظات المتكررة بالصور المرفقة)
  const [isQualityNotesReportModalOpen, setIsQualityNotesReportModalOpen] = useState(false);
  const [qualityNotesReportMode, setQualityNotesReportMode] = useState<NotesReportMode>('all');
  const [qualityNotesReportContractor, setQualityNotesReportContractor] = useState<string>('');

  // Weekly Report, Office Comparison & Contractor Closure Comparison Modals
  const [isWeeklyReportModalOpen, setIsWeeklyReportModalOpen] = useState(false);
  const [isOfficeComparisonModalOpen, setIsOfficeComparisonModalOpen] = useState(false);
  const [isContractorClosureReportOpen, setIsContractorClosureReportOpen] = useState(false);
  const [isComprehensiveReportsOpen, setIsComprehensiveReportsOpen] = useState(false);
  const [comprehensiveReportsMode, setComprehensiveReportsMode] = useState<'aggregated' | 'detailed'>('aggregated');
  const [isAboutPlatformModalOpen, setIsAboutPlatformModalOpen] = useState(false);
  const [isAuditTrailModalOpen, setIsAuditTrailModalOpen] = useState(false);
  const [sensitiveOrderConfirm, setSensitiveOrderConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    workOrderNumber: string;
    previousStatus: string;
    newStatus: string;
    pendingOrder: WorkOrder;
  } | null>(null);

  // Manage Offices Modal State
  const [isManageOfficesModalOpen, setIsManageOfficesModalOpen] = useState(false);
  const [officeToEditInModal, setOfficeToEditInModal] = useState<SubOffice | null>(null);

  // Manage Contractors Distribution Modal State
  const [isManageContractorsModalOpen, setIsManageContractorsModalOpen] = useState(false);

  const allContractors = useMemo(() => {
    const set = new Set<string>();
    workOrders.forEach(o => { if (o.contractor?.trim()) set.add(o.contractor.trim()); });
    offices.forEach(off => { off.contractors?.forEach(c => set.add(c.trim())); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [workOrders, offices]);

  // User Authentication & Granular Role-Based Permissions State
  const [users, setUsers] = useState<PlatformUser[]>(() => {
    const saved = vaultService.getSavedUsers();
    return ensureDefaultSuperAdmins(Array.isArray(saved) && saved.length > 0 ? saved : DEFAULT_SUPER_ADMIN_USERS);
  });
  const [currentUser, setCurrentUser] = useState<PlatformUser | null>(() => getSavedCurrentUser());
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState<boolean>(false);
  const [accessDeniedModal, setAccessDeniedModal] = useState<{ isOpen: boolean; title: string }>({
    isOpen: false,
    title: ''
  });

  // Admin PIN Protection & Session Security Controller
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => isSessionUnlocked());
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pinAction, setPinAction] = useState<'dropdown' | 'columns' | 'reset' | 'undo' | 'restore_deleted' | null>(null);
  const [pendingAuthAction, setPendingAuthAction] = useState<(() => void) | null>(null);
  const [pinAuthTitle, setPinAuthTitle] = useState<string>('حوكمة جودة اعمال الانشاءات - تفعيل الصلاحيات');
  const [pinAuthSubtitle, setPinAuthSubtitle] = useState<string>('يرجى إدخال الرمز السري للمصادقة وتفعيل كافة أدوات المنظومة والجدول (عمود حالة أمر العمل متاح للجميع دون قفل)');
  const [isDropdownManagerOpen, setIsDropdownManagerOpen] = useState(false);
  const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false);
  const [selectedDropdownKeyForEditor, setSelectedDropdownKeyForEditor] = useState<string | undefined>(undefined);

  // Year & Month Sections, Multiple Month Tables and Archive State (Isolated with zero overlap)
  const [activeYear, setActiveYear] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('p155_active_year');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 2000 && parsed <= 2100) return parsed;
      }
    } catch (_) {}
    return new Date().getFullYear();
  });

  const [activeMonth, setActiveMonth] = useState<number | 'all'>(() => {
    try {
      const saved = localStorage.getItem('p155_active_month');
      if (saved === 'all') return 'all';
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) return parsed;
      }
    } catch (_) {}
    return new Date().getMonth() + 1;
  });

  const [monthTables, setMonthTables] = useState<MonthTable[]>(() => vaultService.getSavedMonthTables());

  const [selectedTableId, setSelectedTableId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('p155_selected_table_id');
      if (saved) return saved;
    } catch (_) {}
    const y = new Date().getFullYear();
    const m = new Date().getMonth() + 1;
    return getDefaultTableId(y, m);
  });

  const [isYearMonthPickerOpen, setIsYearMonthPickerOpen] = useState<boolean>(false);
  const [archivedReports, setArchivedReports] = useState<ArchivedReportSnapshot[]>([]);

  // Persist active year, month, and table selection to prevent any confusion on reload
  useEffect(() => {
    try {
      localStorage.setItem('p155_active_year', String(activeYear));
      localStorage.setItem('p155_active_month', String(activeMonth));
      localStorage.setItem('p155_selected_table_id', selectedTableId);
    } catch (_) {}
  }, [activeYear, activeMonth, selectedTableId]);

  // Unified Period Switcher that automatically selects the month's primary aggregate table
  const handleSelectPeriod = useCallback((year: number, month: number | 'all', explicitTableId?: string) => {
    try {
      localStorage.setItem('p155_user_explicit_period', 'true');
    } catch (_) {}
    setActiveYear(year);
    setActiveMonth(month);
    if (explicitTableId) {
      setSelectedTableId(explicitTableId);
    } else if (month === 'all') {
      setSelectedTableId('all');
    } else {
      setSelectedTableId(getDefaultTableId(year, month));
    }
  }, []);

  // Cloud Data Safety & Disaster Recovery Modal
  const [isDataRecoveryModalOpen, setIsDataRecoveryModalOpen] = useState(false);

  // Background Push Notifications & Service Worker State (حتى والمنصة مغلقة)
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [showNotificationPromptBanner, setShowNotificationPromptBanner] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => notificationService.getPermissionStatus());
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(() => notificationService.getUnreadCount());

  // Executive Hub View Tabs & Unified Corporate Sidebar State (Default is always 'home' on open/refresh)
  const [activeViewTab, setActiveViewTabState] = useState<MainViewTab>('table');
  const [activeSidebarSection, setActiveSidebarSection] = useState<SidebarSectionId>('home');
  const [auditHubSubTab, setAuditHubSubTab] = useState<'completed_audit' | 'archive_155'>('completed_audit');

  const setActiveViewTab = useCallback((tab: MainViewTab) => {
    setActiveViewTabState(tab);
    if (tab === 'guide') setActiveSidebarSection('quality_ncr');
    else if (tab === 'kpis') setActiveSidebarSection('admin_dashboard');
    else if (tab === 'archive') setActiveSidebarSection('calendar');
    else if (tab === 'offices') setActiveSidebarSection('regions_dashboard');
    else if (tab === 'table') {
      setActiveSidebarSection('work_orders');
      setIsTableCardOpen(true);
    }
  }, []);

  const handleSelectSidebarSection = useCallback((sec: SidebarSectionId) => {
    const normalized: SidebarSectionId =
      sec === 'projects' ? 'work_orders' : sec === 'consultants' ? 'contractors' : sec;

    const mappedPerm = SIDEBAR_SECTION_PERMISSION_MAP[normalized];
    if (mappedPerm && currentUser && !hasUserPermission(currentUser, mappedPerm.key)) {
      soundService.playActionSound('delete');
      setAccessDeniedModal({ isOpen: true, title: mappedPerm.label });
      showNotification(`لا توجد صلاحية: ${mappedPerm.label}`, 'delete');
      return;
    }

    setActiveSidebarSection(normalized);
    setActiveSectionCard(null);
    if (normalized === 'work_orders') {
      setActiveViewTabState('table');
      setIsTableCardOpen(true);
    } else if (normalized === 'quality_ncr') {
      setActiveViewTabState('guide');
    } else if (normalized === 'admin_dashboard') {
      setActiveViewTabState('kpis');
    } else if (normalized === 'regions_dashboard') {
      setActiveViewTabState('offices');
    } else if (normalized === 'calendar') {
      setActiveViewTabState('archive');
    } else {
      setActiveViewTabState('table');
    }
  }, [currentUser, showNotification]);

  const [isInlineKpiOpen, setIsInlineKpiOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Undo & Redo History State (تم إيقاف التراجع نهائياً لحماية البيانات وضمان عدم فقدان أي أوامر عمل)
  const isHistoryOperationRef = useRef<boolean>(false);

  const recordHistoryStep = useCallback((_actionName: string, _previousOrders: WorkOrder[]) => {
    // Disabled permanently per user directive to guarantee 100% data preservation
  }, []);

  const handleUndo = useCallback(async () => {
    showNotification('تم إيقاف خاصية التراجع نهائياً لحماية البيانات ومنع فقدان أي أوامر عمل', 'update');
  }, [showNotification]);

  const handleRedo = useCallback(async () => {
    showNotification('تم إيقاف خاصية التقدم/التراجع نهائياً لحماية البيانات ومنع فقدان أي أوامر عمل', 'update');
  }, [showNotification]);

  // Lock browser back navigation and prevent state rollbacks or showing deleted cache
  useEffect(() => {
    try {
      window.history.pushState(null, '', window.location.href);
    } catch (_) {}

    const handlePopState = (e: PopStateEvent) => {
      try {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
      } catch (_) {}
      showNotification('تم قفل الرجوع للخلف لمنع التراجع عن التعديلات السحابية أو استرجاع بيانات محذوفة', 'update');
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Track whether this browser tab has completed authoritative server hydration
  const hasHydratedFromServerRef = useRef<boolean>(false);

  // Debounced vault synchronizer: saves to local persistent storage without blocking the UI thread on rapid clicks
  const lastPersistedOrdersRef = useRef<WorkOrder[] | null>(null);
  useEffect(() => {
    if (!hasHydratedFromServerRef.current) return;
    if (lastPersistedOrdersRef.current === workOrders) return;
    lastPersistedOrdersRef.current = workOrders;
    vaultService.saveWorkOrders(workOrders);
  }, [workOrders]);

  // Fast flush of any pending debounced writes on page refresh / tab close without blocking unmodified refreshes
  useEffect(() => {
    const handleFlushOnExit = () => {
      vaultService.flushPendingWritesSync();
    };
    window.addEventListener('beforeunload', handleFlushOnExit);
    window.addEventListener('pagehide', handleFlushOnExit);
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        handleFlushOnExit();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', handleFlushOnExit);
      window.removeEventListener('pagehide', handleFlushOnExit);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Dedicated background snapshot timer: runs strictly every 3 minutes, entirely independent of render cycles
  useEffect(() => {
    const snapshotTimer = setInterval(() => {
      if (workOrders.length > 0) {
        vaultService.autoSnapshotIfDue(workOrders, offices, columns, dropdownOptions, monthTables);
      }
    }, 180000);

    return () => clearInterval(snapshotTimer);
  }, [workOrders, offices, columns, dropdownOptions, monthTables]);

  // Permanently cache registered accounts locally and keep currentUser permissions synchronized in real time
  const lastSavedUsersRef = useRef<PlatformUser[] | null>(null);
  useEffect(() => {
    if (Array.isArray(users) && users.length > 0 && lastSavedUsersRef.current !== users) {
      lastSavedUsersRef.current = users;
      vaultService.saveUsers(users);
      setCurrentUser((prevUser) => {
        if (!prevUser) return null;
        const matched = users.find(
          (u) =>
            u &&
            (u.id === prevUser.id ||
              (u.username && prevUser.username && u.username.trim().toLowerCase() === prevUser.username.trim().toLowerCase()) ||
              (u.email && prevUser.email && u.email.trim().toLowerCase() === prevUser.email.trim().toLowerCase()))
        );
        if (!matched) return prevUser;
        if (matched.isActive === false && !isUserSuperAdmin(matched)) {
          saveCurrentUser(null);
          return null;
        }
        const prevSerialized = JSON.stringify({
          permissions: prevUser.permissions,
          allowedColumns: prevUser.allowedColumns,
          roleTitle: prevUser.roleTitle,
          displayName: prevUser.displayName,
          isActive: prevUser.isActive,
          isSuperAdmin: prevUser.isSuperAdmin
        });
        const nextSerialized = JSON.stringify({
          permissions: matched.permissions,
          allowedColumns: matched.allowedColumns,
          roleTitle: matched.roleTitle,
          displayName: matched.displayName,
          isActive: matched.isActive,
          isSuperAdmin: matched.isSuperAdmin
        });
        if (prevSerialized !== nextSerialized) {
          saveCurrentUser(matched);
          return matched;
        }
        return prevUser;
      });
    }
  }, [users]);

  // Load initial server data, harvest all browser vaults since yesterday 7:00 AM, and subscribe to real-time sync
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        // 1. Fetch authoritative server data and reconcile with any genuinely active in-flight mutations
        const data = await realtime.fetchAllData(true);
        if (data && isMounted) {
          const isAuthoritativeServerData = !(data as any).networkFallback;
          if (isAuthoritativeServerData) {
            hasHydratedFromServerRef.current = true;
          }
          let loadedOrders: WorkOrder[] = [];
          let loadedTables: MonthTable[] = [];
          let ordersToPush: WorkOrder[] = [];

          if (Array.isArray(data.workOrders)) {
            const { mergedOrders, needsServerHydration, ordersToHydrate } = vaultService.reconcileWithVault(
              data.workOrders,
              data.deletedOrderIds
            );
            const deduped = deduplicateOrders(mergedOrders);
            loadedOrders = deduped;
            realtime.recordKnownOrders(deduped);
            lastPersistedOrdersRef.current = deduped;
            setWorkOrders(deduped);
            vaultService.saveWorkOrders(deduped, true);

            if (isAuthoritativeServerData && needsServerHydration && ordersToHydrate.length > 0) {
              ordersToPush = ordersToHydrate;
            }
          }

          let normalizedOffs: SubOffice[] = [];
          if (Array.isArray(data.offices) && data.offices.length > 0) {
            normalizedOffs = normalizeOfficesConsultants(data.offices);
            setOffices(normalizedOffs);
            vaultService.saveOffices(normalizedOffs);
          }

          if (Array.isArray(data.columns) && data.columns.length > 0) {
            const safeCols = ensurePhotosFileColumn(data.columns);
            setColumns(safeCols);
            vaultService.saveColumns(safeCols);
          }

          if (data.dropdownOptions && Object.keys(data.dropdownOptions).length > 0) {
            const mergedOpts = normalizeDropdownConsultants(data.dropdownOptions);
            setDropdownOptions(mergedOpts);
            vaultService.saveDropdownOptions(mergedOpts);
          }

          if (Array.isArray(data.monthTables)) {
            if (isAuthoritativeServerData) {
              loadedTables = data.monthTables.filter((st): st is MonthTable => Boolean(st && st.id));
            } else {
              const localSavedTables = vaultService.getSavedMonthTables() || [];
              const tableMap = new Map<string, MonthTable>();
              for (const lt of localSavedTables) {
                if (lt && lt.id) tableMap.set(lt.id, lt);
              }
              for (const st of data.monthTables) {
                if (st && st.id) tableMap.set(st.id, st);
              }
              loadedTables = Array.from(tableMap.values());
            }
            setMonthTables(loadedTables);
            vaultService.saveMonthTables(loadedTables);
          }

          if (Array.isArray(data.archivedReports)) {
            setArchivedReports(data.archivedReports);
            vaultService.saveArchivedReports(data.archivedReports);
          }

          if (Array.isArray(data.users)) {
            // Treat server users as 100% authoritative on refresh/reopen so deleted accounts are never resurrected from localStorage
            const authoritativeUsers = ensureDefaultSuperAdmins(data.users.filter((u): u is PlatformUser => Boolean(u && u.id)));
            setUsers(authoritativeUsers);
            vaultService.saveUsers(authoritativeUsers);
            setCurrentUser((prevCur) => {
              if (!prevCur) return prevCur;
              const matched = authoritativeUsers.find((u) => u.id === prevCur.id);
              if (matched) {
                saveCurrentUser(matched);
                return matched;
              }
              return prevCur;
            });
          }

          // Push any actively unacknowledged in-flight local orders to the server vault immediately
          if (!isPlatformRunningInStudioIframe() && isAuthoritativeServerData && ordersToPush.length > 0) {
            realtime.hydrateServer({
              workOrders: ordersToPush
            }).catch(() => {});
          }

          // Automatically secure a single snapshot per real user browser session (never from preview iframe)
          if (!isPlatformRunningInStudioIframe() && loadedOrders.length > 0) {
            try {
              if (!sessionStorage.getItem('p155_session_snapshot_taken')) {
                sessionStorage.setItem('p155_session_snapshot_taken', 'true');
                fetch('/api/backup/auto-session-snapshot', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ reason: 'browser-link-open' })
                }).catch(() => {});
              }
            } catch (_) {}
          }
        }
      } catch (_) {
        // Fallback already in state
      } finally {
        if (isMounted) {
          setIsInitialLoading(false);
        }
      }
    })();

    // 2. Status changes
    const unsubStatus = realtime.onStatusChange((status, count, users) => {
      setSyncStatus(status);
      setOnlineCount(count);
      setConnectedUsersList(users || []);
    });

    // 2.5 Background Web Push & Service Worker Initialization (Deferred for instant launch speed)
    if (notificationService.isSupported()) {
      const scheduleInit = () => {
        notificationService.init().then(() => {
          const perm = notificationService.getPermissionStatus();
          setNotificationPermission(perm);
          if (perm === 'default') {
            try {
              const dismissed = sessionStorage.getItem('p155_notification_banner_dismissed');
              if (!dismissed) {
                setTimeout(() => {
                  setShowNotificationPromptBanner(true);
                }, 2000);
              }
            } catch (_) {}
          }
        }).catch(() => {});
      };

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(scheduleInit);
      } else {
        setTimeout(scheduleInit, 800);
      }
    }

    // 2.6 Subscribe to live notification history for unread badge count & Service Worker messages
    const unsubNotifHistory = notificationService.subscribeHistory((_items, unread) => {
      setUnreadNotificationsCount(unread);
    });

    const handleSwMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'NOTIFICATION_CLICKED') {
        setIsNotificationModalOpen(true);
      } else if (e.data && e.data.type === 'BACKGROUND_SYNC_TRIGGERED') {
        realtime.forceSyncNow().catch(() => {});
      }
    };
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    // 3. Real-time events subscriber
    const unsubEvents = realtime.subscribe((event) => {
      const myId = realtime.getClientId();
      const isRemote = event.senderId !== myId;
      const isDuplicateDelivery = Boolean((event as any)._isDuplicateDelivery);
      const shouldNotifyToast = isRemote && !isDuplicateDelivery;
      const senderLabel = event.senderName || 'مستخدم آخر';

      if (event.type === 'BROADCAST_ALERT') {
        if (isDuplicateDelivery) return;
        const title = event.payload?.title || 'تنبيه فوري للفريق';
        const msg = event.payload?.message || '';
        const isLoginAlert = String(title).includes('تسجيل دخول') || String(title).includes('دخول إلى المنصة');
        if (isLoginAlert) {
          soundService.playActionSound('auth_success');
          showNotification(`👤 ${title}: ${msg}`, 'create');
        } else {
          soundService.playActionSound('notification');
          showNotification(`📢 ${title}: ${msg} (بواسطة ${senderLabel})`, 'notification');
        }
        return;
      }

      if (event.type === 'SYNC_ALL' || event.type === 'RESTORE_SNAPSHOT' || event.type === 'SYNC_STATE') {
        if (Array.isArray(event.payload?.workOrders)) {
          if (event.type === 'RESTORE_SNAPSHOT') {
            const restoredIds = event.payload.workOrders
              .filter((w: WorkOrder) => w && w.id)
              .map((w: WorkOrder) => w.id);
            vaultService.unmarkBatchDeleted(restoredIds);
            const { mergedOrders } = vaultService.reconcileWithVault(
              event.payload.workOrders,
              event.payload.deletedOrderIds
            );
            const deduped = deduplicateOrders(mergedOrders);
            lastPersistedOrdersRef.current = deduped;
            setWorkOrders(deduped);
            vaultService.saveWorkOrders(deduped, true);
          } else {
            if (event.type === 'SYNC_STATE') {
              const incomingIds = (event.payload.workOrders || [])
                .filter((w: WorkOrder) => w && w.id)
                .map((w: WorkOrder) => w.id);
              if (incomingIds.length > 0) {
                vaultService.unmarkBatchDeleted(incomingIds);
              }
            }
            if (Array.isArray(event.payload.deletedOrderIds) && event.payload.deletedOrderIds.length > 0) {
              vaultService.syncTombstones(event.payload.deletedOrderIds);
            }
            const tombstones = vaultService.getTombstones();

            // Reconcile server payload with local persistent vault & Anti-Rollback WAL ledger
            const { mergedOrders, needsServerHydration, ordersToHydrate } = vaultService.reconcileWithVault(
              event.payload.workOrders,
              event.payload.deletedOrderIds
            );
            if (!isPlatformRunningInStudioIframe() && needsServerHydration && ordersToHydrate.length > 0) {
              realtime.hydrateServer({ workOrders: ordersToHydrate }).catch(() => {});
            }

            // Reconcile with in-memory React state while protecting active in-flight edits & respecting deletions
            setWorkOrders((currentOrders) => {
              const currentById = new Map<string, WorkOrder>();
              for (const c of currentOrders) {
                if (c && c.id) currentById.set(c.id, c);
              }

              const finalMap = new Map<string, WorkOrder>();
              for (const o of mergedOrders) {
                if (o && o.id && !tombstones.has(o.id)) {
                  const existingLocal = currentById.get(o.id);
                  const mergedOrder = realtime.mergeIncomingOrderWithInFlight(existingLocal, o, true);
                  finalMap.set(o.id, mergedOrder);
                }
              }

              // Only preserve an in-memory order missing from mergedOrders if it has active in-flight edits right now
              for (const [id, c] of currentById.entries()) {
                if (!finalMap.has(id) && !tombstones.has(id) && realtime.hasActiveInFlightEdits(id)) {
                  finalMap.set(id, vaultService.applyWalProtectionToOrder(c).order);
                }
              }

              const deduped = deduplicateOrders(Array.from(finalMap.values()));
              lastPersistedOrdersRef.current = deduped;
              vaultService.saveWorkOrders(deduped, true);
              return deduped;
            });
          }
        }
        if (event.payload.offices) {
          const normalizedOffs = normalizeOfficesConsultants(event.payload.offices);
          setOffices(normalizedOffs);
          vaultService.saveOffices(normalizedOffs);
        }
        if (event.payload.columns) {
          const safeCols = ensurePhotosFileColumn(event.payload.columns);
          setColumns(safeCols);
          vaultService.saveColumns(safeCols);
        }
        if (event.payload.dropdownOptions) {
          const mergedOpts = normalizeDropdownConsultants(event.payload.dropdownOptions);
          setDropdownOptions(mergedOpts);
          vaultService.saveDropdownOptions(mergedOpts);
        }
        if (Array.isArray(event.payload.monthTables)) {
          const authoritativeTables = event.payload.monthTables.filter((t: MonthTable) => Boolean(t && t.id));
          setMonthTables(authoritativeTables);
          vaultService.saveMonthTables(authoritativeTables);
        }
        if (Array.isArray(event.payload.archivedReports)) {
          setArchivedReports(event.payload.archivedReports);
          vaultService.saveArchivedReports(event.payload.archivedReports);
        }
        if (Array.isArray(event.payload.users)) {
          setUsers((prevUsers) => {
            const prevMap = new Map<string, PlatformUser>();
            for (const u of prevUsers) {
              if (u && u.id) prevMap.set(u.id, u);
            }
            const uMap = new Map<string, PlatformUser>();
            for (const u of event.payload.users) {
              if (u && u.id) {
                const prev = prevMap.get(u.id);
                uMap.set(u.id, { ...(prev || {}), ...u });
              }
            }
            const mergedUsers = ensureDefaultSuperAdmins(Array.from(uMap.values()));
            vaultService.saveUsers(mergedUsers);
            setCurrentUser((prevCur) => {
              if (!prevCur) return prevCur;
              const matched = mergedUsers.find((u) => u.id === prevCur.id);
              if (matched) {
                saveCurrentUser(matched);
                return matched;
              }
              return prevCur;
            });
            return mergedUsers;
          });
        }
        setIsInitialLoading(false);
        if (event.type === 'RESTORE_SNAPSHOT') {
          hasAutoFocusedPopulatedViewRef.current = false;
          setSelectedOffice('all');
          setKpiFilter('all');
          setIsTableCardOpen(true);
          if (shouldNotifyToast) {
            showNotification(`تمت استعادة نسخة احتياطية سحابية بواسطة ${senderLabel}`, 'restore');
          }
        } else if (event.type === 'SYNC_STATE' && shouldNotifyToast) {
          showNotification(`تمت مزامنة حالة السجلات (${event.payload?.actionName || 'تحديث جماعي'}) بواسطة ${senderLabel}`, 'sync');
        }
      } else if (event.type === 'ADD_MONTH_TABLE') {
        setMonthTables((prev) => {
          const next = [...prev.filter(t => t.id !== event.payload.id), event.payload];
          vaultService.saveMonthTables(next);
          return next;
        });
        if (shouldNotifyToast) {
          showNotification(`تمت إضافة جدول جديد (${event.payload.name}) بواسطة ${senderLabel}`, 'create');
        }
      } else if (event.type === 'UPDATE_MONTH_TABLE') {
        setMonthTables((prev) => {
          const next = prev.map(t => t.id === event.payload.id ? event.payload : t);
          vaultService.saveMonthTables(next);
          return next;
        });
        if (shouldNotifyToast) {
          showNotification(`تم تحديث بيانات الجدول (${event.payload?.name || ''}) بواسطة ${senderLabel}`, 'update');
        }
      } else if (event.type === 'DELETE_MONTH_TABLE') {
        if (Array.isArray(event.payload?.deletedOrderIds)) {
          vaultService.syncTombstones(event.payload.deletedOrderIds);
        }
        setMonthTables((prev) => {
          const next = prev.filter(t => t.id !== event.payload.id);
          vaultService.saveMonthTables(next);
          return next;
        });
        if (event.payload?.reassignToTableId) {
          setWorkOrders((prev) => {
            const next = prev.map(w => w.tableId === event.payload.id ? { ...w, tableId: event.payload.reassignToTableId === 'default' ? undefined : event.payload.reassignToTableId } : w);
            vaultService.saveWorkOrders(next, true);
            return next;
          });
        } else {
          const tombstones = vaultService.getTombstones();
          setWorkOrders((prev) => {
            const next = prev.filter(w => w.tableId !== event.payload.id && !tombstones.has(w.id));
            vaultService.saveWorkOrders(next, true);
            return next;
          });
        }
        if (shouldNotifyToast) {
          showNotification(`تم حذف الجدول (${event.payload?.name || ''}) بواسطة ${senderLabel}`, 'delete');
        }
      } else if (event.type === 'UPDATE_ARCHIVED_REPORTS' as any) {
        if (Array.isArray(event.payload)) {
          setArchivedReports(event.payload);
        }
      } else if (event.type === 'CREATE_ORDER') {
        const incoming = event.payload;
        vaultService.unmarkDeleted(incoming.id);
        setWorkOrders((prev) => {
          const existing = prev.find((w) => w.id === incoming.id);
          let next: WorkOrder[];
          if (existing) {
            next = prev.map((w) => (w.id === incoming.id ? realtime.mergeIncomingOrderWithInFlight(w, incoming, isRemote) : w));
          } else {
            next = deduplicateOrders([incoming, ...prev]);
          }
          vaultService.saveWorkOrders(next);
          return next;
        });
        if (shouldNotifyToast) {
          showNotification(`تم إدراج أمر عمل جديد (${incoming.workOrderNumber || ''}) بواسطة ${senderLabel}`, 'create');
        }
      } else if (event.type === 'CREATE_BATCH_ORDERS') {
        const batchOrders: WorkOrder[] = Array.isArray(event.payload?.orders) ? event.payload.orders : [];
        if (batchOrders.length > 0) {
          const batchIds = batchOrders.map((b) => b.id).filter(Boolean);
          if (batchIds.length > 0) {
            vaultService.unmarkBatchDeleted(batchIds);
          }
          setWorkOrders((prev) => {
            const existingIdMap = new Map<string, number>(prev.map((w, idx) => [w.id, idx]));
            const next = [...prev];
            const toAppend: WorkOrder[] = [];
            for (const b of batchOrders) {
              const foundIdx = existingIdMap.get(b.id);
              if (foundIdx !== undefined) {
                next[foundIdx] = { ...next[foundIdx], ...b };
              } else {
                realtime.recordKnownOrders([b]);
                toAppend.push(b);
              }
            }
            const finalOrders = deduplicateOrders([...next, ...toAppend]);
            vaultService.saveWorkOrders(finalOrders);
            return finalOrders;
          });
          if (shouldNotifyToast) {
            showNotification(`تم استيراد وإدراج (${batchOrders.length}) أمر عمل جديد بواسطة ${senderLabel}`, 'create');
          }
        }
      } else if (event.type === 'UPDATE_ORDER') {
        const incomingPayload = event.payload;
        if (isRemote) {
          vaultService.acknowledgeRemoteOrderUpdate(incomingPayload, (incomingPayload as any).changedFields);
        }
        setWorkOrders((prev) => {
          const idx = prev.findIndex((w) => w.id === incomingPayload.id);
          let next: WorkOrder[];
          if (idx !== -1) {
            const merged = realtime.mergeIncomingOrderWithInFlight(prev[idx], incomingPayload, isRemote);
            next = [...prev];
            next[idx] = merged;
          } else {
            next = deduplicateOrders([incomingPayload, ...prev]);
          }
          vaultService.saveWorkOrders(next);
          return next;
        });

        // Instant live sync inside any open editing modals so concurrent edits on the same work order merge seamlessly
        setEditingOrder((prev) => (prev && prev.id === incomingPayload.id ? realtime.mergeIncomingOrderWithInFlight(prev, incomingPayload, isRemote) : prev));
        setBasicEditingOrder((prev) => (prev && prev.id === incomingPayload.id ? realtime.mergeIncomingOrderWithInFlight(prev, incomingPayload, isRemote) : prev));
        setAuditOrder((prev) => (prev && prev.id === incomingPayload.id ? realtime.mergeIncomingOrderWithInFlight(prev, incomingPayload, isRemote) : prev));
        setPhotoOrder((prev) => (prev && prev.id === incomingPayload.id ? realtime.mergeIncomingOrderWithInFlight(prev, incomingPayload, isRemote) : prev));

        if (shouldNotifyToast) {
          showNotification(`تم تحديث أمر العمل (${incomingPayload.workOrderNumber || ''}) بواسطة ${senderLabel}`, 'update');
        }
      } else if (event.type === 'DELETE_ORDER') {
        if (isRemote && realtime.hasActiveInFlightEdits(event.payload.id)) {
          return;
        }
        vaultService.markAsDeleted(event.payload.id);
        if (Array.isArray(event.payload?.deletedOrderIds)) {
          vaultService.syncTombstones(event.payload.deletedOrderIds);
        }
        setWorkOrders((prev) => {
          const next = prev.filter((w) => w.id !== event.payload.id);
          vaultService.saveWorkOrders(next, true);
          return next;
        });

        // Close or nullify active modal if the order was deleted remotely
        setEditingOrder((prev) => (prev?.id === event.payload.id ? null : prev));
        setBasicEditingOrder((prev) => (prev?.id === event.payload.id ? null : prev));
        setAuditOrder((prev) => (prev?.id === event.payload.id ? null : prev));
        setPhotoOrder((prev) => (prev?.id === event.payload.id ? null : prev));

        if (shouldNotifyToast) {
          showNotification(`تم حذف أمر عمل (${event.payload?.workOrderNumber || ''}) بواسطة ${senderLabel}`, 'delete');
        }
      } else if (event.type === 'DELETE_BATCH_ORDERS') {
        const idsToRemove: string[] = event.payload.ids || [];
        vaultService.markBatchAsDeleted(idsToRemove);
        if (Array.isArray(event.payload?.deletedOrderIds)) {
          vaultService.syncTombstones(event.payload.deletedOrderIds);
        }
        const idsSet = new Set(idsToRemove);
        setWorkOrders((prev) => {
          const next = prev.filter((w) => !idsSet.has(w.id));
          vaultService.saveWorkOrders(next, true);
          return next;
        });

        setEditingOrder((prev) => (prev && idsSet.has(prev.id) ? null : prev));
        setBasicEditingOrder((prev) => (prev && idsSet.has(prev.id) ? null : prev));
        setAuditOrder((prev) => (prev && idsSet.has(prev.id) ? null : prev));
        setPhotoOrder((prev) => (prev && idsSet.has(prev.id) ? null : prev));

        if (shouldNotifyToast) {
          showNotification(`تم حذف (${idsToRemove.length}) أمر عمل بواسطة ${senderLabel}`, 'delete');
        }
      } else if (event.type === 'CLEAR_ORDERS') {
        const officeFilter = event.payload?.office;
        vaultService.markTableCleared(officeFilter);
        if (Array.isArray(event.payload?.deletedOrderIds)) {
          vaultService.syncTombstones(event.payload.deletedOrderIds);
        }
        if (!officeFilter || officeFilter === 'all' || officeFilter === 'جميع المكاتب الفرعية') {
          setWorkOrders([]);
          vaultService.saveWorkOrders([], true);
          setEditingOrder(null);
          setBasicEditingOrder(null);
          setAuditOrder(null);
          setPhotoOrder(null);
        } else {
          setWorkOrders((prev) => {
            const next = prev.filter((w) => w.office !== officeFilter);
            vaultService.saveWorkOrders(next, true);
            return next;
          });
          setEditingOrder((prev) => (prev?.office === officeFilter ? null : prev));
          setBasicEditingOrder((prev) => (prev?.office === officeFilter ? null : prev));
          setAuditOrder((prev) => (prev?.office === officeFilter ? null : prev));
          setPhotoOrder((prev) => (prev?.office === officeFilter ? null : prev));
        }
        if (shouldNotifyToast) {
          const isAll = !officeFilter || officeFilter === 'all' || officeFilter === 'جميع المكاتب الفرعية';
          showNotification(isAll ? `تم مسح وتفريغ كافة السجلات بالكامل بواسطة ${senderLabel}` : `تم مسح وتفريغ سجلات مكتب (${officeFilter}) بواسطة ${senderLabel}`, 'delete');
        }
      } else if (event.type === 'ADD_OFFICE') {
        const newOff = event.payload?.office || event.payload;
        setOffices((prev) => {
          const next = prev.some((o) => o.id === newOff.id)
            ? prev.map((o) => (o.id === newOff.id ? newOff : o))
            : [...prev, newOff];
          vaultService.saveOffices(next);
          return next;
        });
        setDropdownOptions((prev) => {
          if (newOff?.name && !prev.office.includes(newOff.name)) {
            const next = { ...prev, office: [...prev.office, newOff.name] };
            vaultService.saveDropdownOptions(next);
            return next;
          }
          return prev;
        });
        if (shouldNotifyToast) {
          showNotification(`تمت إضافة وتفعيل مكتب فرعي جديد (${newOff?.name || ''}) بواسطة ${senderLabel}`, 'create');
        }
      } else if (event.type === 'UPDATE_OFFICE') {
        const { office: updatedOffice, oldName } = event.payload;
        setOffices((prev) => {
          const next = prev.map((o) => (o.id === updatedOffice.id ? updatedOffice : o));
          vaultService.saveOffices(next);
          return next;
        });
        if (oldName && oldName !== updatedOffice.name) {
          setWorkOrders((prev) => {
            const next = prev.map((w) => (w.office === oldName ? { ...w, office: updatedOffice.name } : w));
            vaultService.saveWorkOrders(next, true);
            return next;
          });
          setDropdownOptions((prev) => {
            const next = {
              ...prev,
              office: prev.office.map((n) => (n === oldName ? updatedOffice.name : n))
            };
            vaultService.saveDropdownOptions(next);
            return next;
          });
          setSelectedOffice((prev) => (prev === oldName ? updatedOffice.name : prev));
        }
        if (shouldNotifyToast) {
          showNotification(`تم تحديث بيانات المكتب الفرعي (${updatedOffice.name}) بواسطة ${senderLabel}`, 'update');
        }
      } else if (event.type === 'DELETE_OFFICE') {
        const { id: deletedId, name: deletedName, reassignTo } = event.payload;
        setOffices((prev) => {
          const next = prev.filter((o) => o.id !== deletedId && o.name !== deletedName);
          vaultService.saveOffices(next);
          return next;
        });
        if (deletedName) {
          setDropdownOptions((prev) => {
            const next = {
              ...prev,
              office: prev.office.filter((n) => n !== deletedName)
            };
            vaultService.saveDropdownOptions(next);
            return next;
          });
          if (reassignTo) {
            setWorkOrders((prev) => {
              const next = prev.map((w) => (w.office === deletedName ? { ...w, office: reassignTo } : w));
              vaultService.saveWorkOrders(next, true);
              return next;
            });
          }
          setSelectedOffice((prev) => (prev === deletedName ? (reassignTo || 'all') : prev));
        }
        if (shouldNotifyToast) {
          showNotification(`تم حذف مكتب فرعي (${deletedName || ''}) بواسطة ${senderLabel}`, 'delete');
        }
      } else if (event.type === 'UPDATE_COLUMNS') {
        if (event.payload.columns) {
          const canonicalCols = ensurePhotosFileColumn(event.payload.columns);
          setColumns(canonicalCols);
          vaultService.saveColumns(canonicalCols);
        }
        if (event.payload.dropdownOptions) {
          setDropdownOptions(event.payload.dropdownOptions);
          vaultService.saveDropdownOptions(event.payload.dropdownOptions);
        }
        if (shouldNotifyToast) {
          showNotification(`تم تحديث هيكلة ومسميات أعمدة الجدول بواسطة ${senderLabel}`, 'update');
        }
      } else if (event.type === 'UPDATE_DROPDOWN_OPTIONS') {
        if (event.payload) {
          setDropdownOptions(event.payload);
          vaultService.saveDropdownOptions(event.payload);
        }
        if (shouldNotifyToast) {
          showNotification(`تم تحديث خيارات القوائم المنسدلة بواسطة ${senderLabel}`, 'update');
        }
      } else if (event.type === 'UPDATE_OFFICE_CONTRACTORS') {
        const { officeName, contractors } = event.payload;
        if (officeName && Array.isArray(contractors)) {
          setOffices((prev) => {
            const next = prev.map((o) => (o.name === officeName ? { ...o, contractors } : o));
            vaultService.saveOffices(next);
            return next;
          });
          setDropdownOptions((prev) => {
            const next = {
              ...prev,
              officeContractors: {
                ...(prev.officeContractors || {}),
                [officeName]: contractors
              },
              contractor: Array.from(new Set([...prev.contractor, ...contractors]))
            };
            vaultService.saveDropdownOptions(next);
            return next;
          });
          if (shouldNotifyToast) {
            showNotification(`تم تحديث قائمة مقاولي (${officeName}) بواسطة ${senderLabel}`, 'update');
          }
        }
      } else if (event.type === 'UPDATE_USERS') {
        if (Array.isArray(event.payload?.users)) {
          const updatedUsersList = ensureDefaultSuperAdmins(event.payload.users);
          setUsers(updatedUsersList);
          vaultService.saveUsers(updatedUsersList);
          setCurrentUser((prevUser) => {
            if (!prevUser) return null;
            const matched = updatedUsersList.find(
              (u) => u.id === prevUser.id || (u.username === prevUser.username && !prevUser.isSuperAdmin)
            );
            if (matched) {
              if (matched.isActive === false && !isUserSuperAdmin(matched)) {
                saveCurrentUser(null);
                return null;
              }
              saveCurrentUser(matched);
              return matched;
            }
            return prevUser;
          });
          if (shouldNotifyToast) {
            showNotification(`تم تحديث صلاحيات وحسابات المستخدمين بواسطة ${senderLabel}`, 'update');
          }
        }
      } else if (event.type === 'PLATFORM_PUBLISHED') {
        const publishedAt = event.payload?.publishedAt || new Date().toISOString();
        const deployId = event.payload?.deployId || '';
        soundService.playActionSound('auth_success');
        setPlatformPublishAlert({
          publishedAt,
          deployId,
          countdown: 4
        });
      }
    });

    return () => {
      unsubStatus();
      unsubNotifHistory();
      unsubEvents();
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);

  const handleToggleSound = () => {
    const isNowActive = soundService.toggleSound();
    setIsSoundMuted(!isNowActive);
    if (isNowActive) {
      soundService.playActionSound('create');
    }
  };

  // State for Audit Tracker Modal & Active Checklist Modal Order ID (so archiving happens smoothly without closing an open checklist mid-click)
  const [isAuditTrackerModalOpen, setIsAuditTrackerModalOpen] = useState<boolean>(false);
  const [activeAuditingOrderId, setActiveAuditingOrderId] = useState<string | null>(null);

  // Platform Publish & Reboot Alert State (إغلاق المتصفح عند جميع المستخدمين بعد أي نشر للمنصة لإعادة تسجيل الدخول وتحميل التحديثات)
  const [platformPublishAlert, setPlatformPublishAlert] = useState<{
    publishedAt: string;
    deployId: string;
    countdown: number;
  } | null>(null);

  // Global listener for platform published broadcast event
  useEffect(() => {
    const handlePlatformPublishedEvent = (e: any) => {
      soundService.playActionSound('auth_success');
      setPlatformPublishAlert({
        publishedAt: e?.detail?.publishedAt || new Date().toISOString(),
        deployId: e?.detail?.deployId || '',
        countdown: 4
      });
    };

    window.addEventListener('p155:platform_published', handlePlatformPublishedEvent);
    return () => {
      window.removeEventListener('p155:platform_published', handlePlatformPublishedEvent);
    };
  }, []);

  // Platform Publish Countdown & Zero-Impact Auto-Reload (يحدث واجهة البرمجيات فقط دون المساس ببيانات الجداول أو حسابات المستخدمين)
  useEffect(() => {
    if (!platformPublishAlert) return;
    if (platformPublishAlert.countdown <= 0) {
      window.location.replace(`/?published=${Date.now()}`);
      return;
    }

    const timer = setTimeout(() => {
      setPlatformPublishAlert((prev) => (prev ? { ...prev, countdown: prev.countdown - 1 } : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [platformPublishAlert]);

  // Real-time Audit Tracker summary, Completed Audit Orders (تم التدقيق عليه), & Archive 155 (ارشيف 155)
  const auditTrackerSummary = useMemo(() => {
    let trackedCount = 0;
    let inProgressCount = 0;
    let fullyAuditedCount = 0;
    let archive155Count = 0;
    let disqualifiedCount = 0;
    let qualifiedCount = 0;
    const fullyAuditedList: WorkOrder[] = [];
    const archive155List: WorkOrder[] = [];
    const fullyAuditedIds = new Set<string>();
    const archive155Ids = new Set<string>();
    const postAuditIds = new Set<string>();

    for (const w of workOrders) {
      if (!w || !w.id) continue;
      const info = getOrderAuditTrackerInfo(w);
      if (info.hasAuditStarted) {
        trackedCount++;
        if (info.isFullyAuditedByAllThree) {
          postAuditIds.add(w.id);
          if (info.isArchived155) {
            // Immediately archived into (ارشيف 155) when procedure155 is 'تم الاجراء'
            archive155Count++;
            archive155List.push(w);
            archive155Ids.add(w.id);
          } else {
            // Remains in (تم التدقيق عليه) until 'تم الاجراء' is selected in procedure155
            fullyAuditedCount++;
            fullyAuditedList.push(w);
            fullyAuditedIds.add(w.id);
          }
        } else {
          inProgressCount++;
          if (info.hasAnyDisqualifiedDepartment) {
            disqualifiedCount++;
          } else {
            const hasQualifiedDept =
              (info.pdcAudited && info.pdcQualification === 'مؤهل') ||
              (info.constructionAudited && info.constructionQualification === 'مؤهل') ||
              (info.technicalSupportAudited && info.technicalSupportQualification === 'مؤهل');
            if (hasQualifiedDept) {
              qualifiedCount++;
            }
          }
        }
      }
    }

    let urgentQualificationStatus: 'غير مؤهل' | 'مؤهل' | 'قيد التدقيق' = 'قيد التدقيق';
    if (disqualifiedCount > 0) {
      urgentQualificationStatus = 'غير مؤهل';
    } else if (qualifiedCount > 0 && inProgressCount > 0) {
      urgentQualificationStatus = 'مؤهل';
    } else if (inProgressCount > 0) {
      urgentQualificationStatus = 'قيد التدقيق';
    }

    const filteredArchivedOrders =
      selectedOffice === 'all'
        ? fullyAuditedList
        : fullyAuditedList.filter((w) => w.office === selectedOffice);

    const filteredArchive155Orders =
      selectedOffice === 'all'
        ? archive155List
        : archive155List.filter((w) => w.office === selectedOffice);

    return {
      trackedCount,
      inProgressCount,
      fullyAuditedCount,
      archive155Count,
      disqualifiedCount,
      qualifiedCount,
      urgentQualificationStatus,
      fullyAuditedList,
      archive155List,
      filteredArchivedOrders,
      filteredArchive155Orders,
      fullyAuditedIds,
      archive155Ids,
      postAuditIds
    };
  }, [workOrders, selectedOffice]);

  // Filtered orders for the selected sub-office, active Year & Month section, & strict isolated MonthTable
  // Excludes orders that completed all 3 audits (they move to تم التدقيق عليه, and then to ارشيف 155 upon تم الاجراء)
  const displayOrders = useMemo(() => {
    let result = workOrders.filter(
      (w) => !auditTrackerSummary.postAuditIds.has(w.id) || w.id === activeAuditingOrderId
    );
    if (selectedOffice !== 'all') {
      result = result.filter((w) => w.office === selectedOffice);
    }
    if (kpiFilter === 'ready155') {
      result = result.filter((w) => {
        const s = String(w.procedure155Status || '');
        if (s.includes('غير')) return false;
        return s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم');
      });
    } else if (kpiFilter === 'notReady155') {
      result = result.filter((w) => {
        const s = String(w.procedure155Status || '');
        if (s.includes('غير')) return true;
        return !(s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم'));
      });
    } else if (kpiFilter === 'inProgress') {
      result = result.filter((w) => {
        const s = String(w.procedure155Status || '');
        if (s.includes('غير')) return false;
        if (s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم')) return false;
        return true;
      });
    } else if (kpiFilter === 'urgent') {
      result = result.filter((w) => {
        const info = getOrderAuditTrackerInfo(w);
        return info.hasAuditStarted && !info.isFullyAuditedByAllThree;
      });
    }
    // Strict zero-overlap filter by (activeYear, activeMonth, selectedTableId)
    result = result.filter((w) =>
      doesOrderMatchTableView(w, activeYear, activeMonth, selectedTableId, monthTables)
    );
    return result;
  }, [workOrders, auditTrackerSummary.postAuditIds, activeAuditingOrderId, selectedOffice, kpiFilter, activeYear, activeMonth, selectedTableId, monthTables]);

  // Smart Auto-Focus on Populated Tables:
  // If workOrders exist in the database, but the currently selected table has 0 matching orders or is an orphaned table ID,
  // automatically switch to the matching equivalent table or 'all' (combined view of all tables in the month) so records are immediately visible.
  const hasAutoFocusedPopulatedViewRef = useRef<boolean>(false);
  useEffect(() => {
    if (workOrders.length === 0) return;

    // 1. If selectedTableId is a custom table ID that does not exist in monthTables, resolve it to its equivalent table in monthTables or 'all'
    if (
      selectedTableId &&
      selectedTableId !== 'all' &&
      !isDefaultTableId(selectedTableId) &&
      monthTables.length > 0 &&
      !monthTables.some((t) => t && t.id === selectedTableId)
    ) {
      const resolvedEquivalent = findMatchingMonthTable(
        selectedTableId,
        undefined,
        activeYear,
        activeMonth !== 'all' ? Number(activeMonth) : undefined,
        monthTables
      );
      if (resolvedEquivalent) {
        setSelectedTableId(resolvedEquivalent.id);
        return;
      }
      setSelectedTableId('all');
      return;
    }

    const currentViewMatches = workOrders.filter((w) =>
      doesOrderMatchTableView(w, activeYear, activeMonth, selectedTableId, monthTables)
    );
    if (currentViewMatches.length > 0) {
      hasAutoFocusedPopulatedViewRef.current = true;
      return;
    }
    // Whenever a default month table (e.g. default-2026-10) is empty but custom tables in that month have orders, show 'all'
    if (isDefaultTableId(selectedTableId) || !hasAutoFocusedPopulatedViewRef.current) {
      const monthAllMatches = workOrders.filter((w) =>
        doesOrderMatchTableView(w, activeYear, activeMonth, 'all', monthTables)
      );
      if (monthAllMatches.length > 0) {
        hasAutoFocusedPopulatedViewRef.current = true;
        setSelectedTableId('all');
        return;
      }
    }
    if (hasAutoFocusedPopulatedViewRef.current) return;
    // Otherwise find the year/month of the first available order or custom table
    const firstOrderWithTable = workOrders.find((w) => w.tableYear || w.tableMonth || w.tableId);
    if (firstOrderWithTable) {
      const targetTable = monthTables.find((t) => t.id === firstOrderWithTable.tableId);
      const y = Number(firstOrderWithTable.tableYear || targetTable?.year || activeYear);
      const m = firstOrderWithTable.tableMonth || targetTable?.month || activeMonth;
      hasAutoFocusedPopulatedViewRef.current = true;
      setActiveYear(y);
      setActiveMonth(m as any);
      setSelectedTableId('all');
    }
  }, [workOrders, monthTables, activeYear, activeMonth, selectedTableId]);

  const activeTableName = useMemo(() => {
    const mName = activeMonth === 'all' ? 'كافة الشهور' : getArabicMonthName(activeMonth);
    if (selectedTableId === 'all') return `الجدول التجميعي الشامل (${mName} ${activeYear})`;
    if (isDefaultTableId(selectedTableId)) return `الجدول التجميعي لكافة أوامر العمل (${mName} ${activeYear})`;
    const found = monthTables.find(t => t.id === selectedTableId);
    if (found?.name) return found.name;
    // Check if any order in this table has a designated tableName
    const sampleOrder = workOrders.find(w => w.tableId === selectedTableId);
    if (sampleOrder?.tableName) return sampleOrder.tableName;
    return `الجدول التجميعي لكافة أوامر العمل (${mName} ${activeYear})`;
  }, [selectedTableId, monthTables, activeMonth, activeYear, workOrders]);

  // Real-time synchronized orders for KPI Dashboard (scoped by office and active period/table)
  const ordersForKpi = useMemo(() => {
    let result = workOrders;
    if (selectedOffice !== 'all') {
      result = result.filter((w) => w.office === selectedOffice);
    }
    result = result.filter((w) =>
      doesOrderMatchTableView(w, activeYear, activeMonth, selectedTableId, monthTables)
    );
    return result;
  }, [workOrders, selectedOffice, activeYear, activeMonth, selectedTableId, monthTables]);

  const kpiCardSummary = useMemo(() => {
    const total = ordersForKpi.length;
    let ready = 0;
    let notReady = 0;
    for (const w of ordersForKpi) {
      const evalKeys = getEvaluatedSupportChecklistKeys(w);
      const pdcEval = getEvaluatedColumnSupportChecklistKeys(w, 'pdcAudit');
      const constEval = getEvaluatedColumnSupportChecklistKeys(w, 'constructionAudit');
      const s = String(w.procedure155Status || '').trim();
      const eff155 = getEffectiveProcedure155Status(w);
      const hasAnyEvaluated =
        evalKeys.length > 0 ||
        pdcEval.length > 0 ||
        constEval.length > 0 ||
        Boolean(s && s !== 'قيد التدقيق' && s !== 'قيد التدقيق الفني') ||
        Boolean(eff155);

      const isReady =
        isOrderQualified100InAllThreeAudits(w) ||
        (!eff155.includes('غير') && (eff155.includes('مؤهل') || eff155.includes('تم'))) ||
        (evalKeys.length > 0 && !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد')));

      if (isReady) {
        ready++;
      } else if (hasAnyEvaluated) {
        notReady++;
      }
    }
    const rate = total > 0 ? Math.round((ready / total) * 100) : 0;
    return { total, ready, notReady, rate };
  }, [ordersForKpi]);

  const totalReady155Count = useMemo(() => {
    return workOrders.filter(w => {
      const evalKeys = getEvaluatedSupportChecklistKeys(w);
      const s = String(w?.procedure155Status || '').trim();
      const eff155 = getEffectiveProcedure155Status(w);
      return (
        isOrderQualified100InAllThreeAudits(w) ||
        (!eff155.includes('غير') && (eff155.includes('مؤهل') || eff155.includes('تم'))) ||
        (evalKeys.length > 0 && !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد')))
      );
    }).length;
  }, [workOrders]);

  const activePeriodLabel = useMemo(() => {
    if (activeMonth === 'all') {
      return `عام ${activeYear} (كافة الشهور)`;
    }
    const mNum = typeof activeMonth === 'number' ? activeMonth : parseInt(String(activeMonth), 10);
    return `شهر ${mNum} (${getArabicMonthName(mNum)}) • ${activeYear}${activeTableName ? ` • ${activeTableName}` : ''}`;
  }, [activeYear, activeMonth, activeTableName]);

  const handleNavigateToConflictOrder = useCallback((conflict: DuplicateWorkOrderConflict) => {
    setDuplicateAlertState(prev => ({ ...prev, isOpen: false }));
    setIsAddModalOpen(false);
    setIsImportExcelModalOpen(false);
    setIsCompatibleImportModalOpen(false);
    setIsBasicEditModalOpen(false);
    setBasicEditingOrder(null);
    setIsEditModalOpen(false);

    handleSelectPeriod(conflict.year, conflict.month, conflict.tableId);
    setActiveViewTab('table');
    setTablePresentationMode('docked');
    setIsTableCardOpen(true);
    setActiveSectionCard(null);
    setSelectedOffice('all');
    setKpiFilter('all');
    setHighlightedOrderId(conflict.existingOrder.id);

    setTimeout(() => {
      setEditingOrder(conflict.existingOrder);
      setIsEditModalOpen(true);
    }, 150);
  }, [handleSelectPeriod]);

  // Direct Navigation from the Top Audit Tracker Icon Table by (رقم أمر العمل + نوع أمر العمل)
  const handleNavigateFromAuditTracker = useCallback(
    (
      workOrderNumber: string,
      workOrderCode: string,
      fallbackOrderId: string,
      isFullyAuditedByAllThree: boolean
    ) => {
      const targetOrder = findWorkOrderByNumberAndType(
        workOrders,
        workOrderNumber,
        workOrderCode,
        fallbackOrderId
      );

      if (!targetOrder) {
        showNotification(
          `تعذر العثور على أمر العمل (${workOrderNumber}) - نوع (${workOrderCode || 'غير محدد'})`,
          'delete'
        );
        return;
      }

      setIsAuditTrackerModalOpen(false);
      setSelectedOffice('all');
      setKpiFilter('all');
      setActiveViewTab('table');
      setTablePresentationMode('docked');

      const info = getOrderAuditTrackerInfo(targetOrder);
      const isArchivedOrder = isFullyAuditedByAllThree || info.isFullyAuditedByAllThree;

      if (isArchivedOrder) {
        setActiveSidebarSection('audit_trail');
        setAuditHubSubTab(info.isArchived155 ? 'archive_155' : 'completed_audit');
      } else {
        // Navigate directly to the active row in the main table
        const scope = resolveOrderScope(targetOrder, monthTables);
        handleSelectPeriod(scope.year, scope.month, targetOrder.tableId || 'all');
        setActiveSidebarSection('work_orders');
        setActiveSectionCard(null);
        setIsTableCardOpen(true);
      }

      setHighlightedOrderId(null);
      setTimeout(() => {
        setHighlightedOrderId(targetOrder.id);
      }, 30);

      showNotification(
        `تم التوجيه مباشرة إلى صف أمر العمل (${targetOrder.workOrderNumber}) - نوع (${targetOrder.workOrderCode || 'عام'}) في ${
          info.isArchived155
            ? 'قائمة ( ارشيف 155 )'
            : isArchivedOrder
            ? 'قائمة ( تم التدقيق عليه )'
            : 'الجدول الرئيسي'
        }`,
        'update'
      );
    },
    [workOrders, monthTables, handleSelectPeriod, showNotification]
  );

  // Direct Navigation from KPI Popup Modal to the exact work order in its corresponding table
  const handleNavigateToOrderFromKpi = useCallback(
    (targetOrder: WorkOrder) => {
      if (!targetOrder) return;
      const info = getOrderAuditTrackerInfo(targetOrder);
      setKpiFilter('all');

      if (info.isFullyAuditedByAllThree) {
        handleSelectSidebarSection('audit_trail');
        setAuditHubSubTab(info.isArchived155 ? 'archive_155' : 'completed_audit');
      } else {
        const scope = resolveOrderScope(targetOrder, monthTables);
        handleSelectPeriod(scope.year, scope.month, targetOrder.tableId || 'all');
        handleSelectSidebarSection('work_orders');
      }

      setHighlightedOrderId(null);
      setTimeout(() => {
        setHighlightedOrderId(targetOrder.id);
      }, 60);

      showNotification(
        `تم التوجه مباشرة إلى أمر العمل (${targetOrder.workOrderNumber}) في ${
          info.isArchived155
            ? 'قائمة ( ارشيف 155 )'
            : info.isFullyAuditedByAllThree
            ? 'قائمة ( تم التدقيق عليه )'
            : 'جدول أوامر العمل'
        }`,
        'update'
      );
    },
    [monthTables, handleSelectPeriod, handleSelectSidebarSection, showNotification]
  );

  // Handlers for Work Orders (with strict Year, Month, and Table scoping + Global Duplicate Rejection)
  const handleAddOrder = async (orderData: Partial<WorkOrder>): Promise<boolean> => {
    const { conflicts } = findExistingWorkOrderConflicts([orderData], workOrders, monthTables);
    if (conflicts.length > 0) {
      soundService.playActionSound('delete');
      setDuplicateAlertState({
        isOpen: true,
        conflicts,
        sourceLabel: 'رفض إضافة أمر عمل جديد — موجود مسبقاً في المنصة',
        acceptedCount: 0
      });
      return false;
    }

    recordHistoryStep('إضافة صف أمر عمل جديد', workOrders);
    const targetYear = orderData.tableYear || activeYear;
    const targetMonth = orderData.tableMonth || (activeMonth === 'all' ? (new Date().getMonth() + 1) : activeMonth);
    const defaultTblId = getDefaultTableId(targetYear, targetMonth);
    const resolvedTableId = orderData.tableId || (selectedTableId !== 'all' && !isDefaultTableId(selectedTableId) ? selectedTableId : defaultTblId);
    const customTbl = monthTables.find(t => t.id === resolvedTableId);
    const resolvedTableName = orderData.tableName || (customTbl ? customTbl.name : `الجدول الأساسي - ${getArabicMonthName(targetMonth)} ${targetYear}`);

    const effectiveUser = currentUser || getSavedCurrentUser();
    const creatorEmail = (orderData.addedByEmail || orderData.createdByEmail || effectiveUser?.email || effectiveUser?.username || 'engmhp1@gmail.com').trim();
    const creatorName = (orderData.addedByName || effectiveUser?.displayName || effectiveUser?.username || 'مستخدم معتمد').trim();

    const enrichedOrder: Partial<WorkOrder> = {
      ...orderData,
      addedByEmail: creatorEmail,
      createdByEmail: creatorEmail,
      addedByName: creatorName,
      isNew: true,
      tableId: resolvedTableId,
      tableYear: targetYear,
      tableMonth: targetMonth,
      tableName: resolvedTableName,
      receiptDate: orderData.receiptDate || `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
    };

    const created = await realtime.createWorkOrder(enrichedOrder);
    if ((created as any)?.conflictError) {
      const serverDupOrder: WorkOrder | undefined = (created as any)?.existingConflictOrder;
      const conflictPool = serverDupOrder ? [serverDupOrder, ...workOrders] : workOrders;
      const serverConflicts = findExistingWorkOrderConflicts([orderData], conflictPool, monthTables).conflicts;
      soundService.playActionSound('delete');
      if (serverConflicts.length > 0) {
        setDuplicateAlertState({
          isOpen: true,
          conflicts: serverConflicts,
          sourceLabel: 'رفض إضافة أمر عمل جديد — موجود مسبقاً في المنصة',
          acceptedCount: 0
        });
      }
      return false;
    }

    // Automatically focus the target year/month/table where the order was added
    setActiveYear(targetYear);
    setActiveMonth(targetMonth);
    setSelectedTableId(resolvedTableId);

    auditTrailService.recordWorkOrderDiff(undefined, created, effectiveUser);
    setWorkOrders((prev) => {
      const next = deduplicateOrders([created, ...prev.filter((w) => w.id !== created.id)]);
      vaultService.saveWorkOrders(next);
      return next;
    });
    showNotification(`تم إدراج أمر العمل (${created.workOrderNumber}) في [${resolvedTableName}] لشهر ${getArabicMonthName(targetMonth)} ${targetYear} بنجاح كإجراء نهائي`, 'create');
    return true;
  };

  const commitFinalOrderUpdate = async (updatedOrder: WorkOrder, prevOrder?: WorkOrder) => {
    const nowIso = new Date().toISOString();
    const silentToast = Boolean((updatedOrder as any)._silentToast);
    if ('_silentToast' in updatedOrder) {
      delete (updatedOrder as any)._silentToast;
    }
    if ('_skipSensitiveConfirm' in updatedOrder) {
      delete (updatedOrder as any)._skipSensitiveConfirm;
    }

    const latestLiveOrder =
      workOrders.find((w) => w.id === updatedOrder.id) ||
      realtime.getLastKnownOrder(updatedOrder.id) ||
      prevOrder;

    // Resolve the baseline snapshot from when the user started editing (e.g. modal open snapshot or pre-edit state)
    const baselineOrder =
      editingOrder && editingOrder.id === updatedOrder.id
        ? editingOrder
        : basicEditingOrder && basicEditingOrder.id === updatedOrder.id
        ? basicEditingOrder
        : prevOrder || latestLiveOrder;

    const IGNORED_DIFF_KEYS = new Set([
      'id',
      'updatedAt',
      'lastEditedAt',
      'lastUpdatedBy',
      'recordVersion',
      'fieldUpdatedAt',
      'auditSyncStatus',
      '_userTouchedFields',
      '_silentToast',
      '_skipSensitiveConfirm'
    ]);

    const explicitUserTouchedFields: string[] | undefined = Array.isArray((updatedOrder as any)._userTouchedFields)
      ? (updatedOrder as any)._userTouchedFields
      : undefined;
    if ('_userTouchedFields' in updatedOrder) {
      delete (updatedOrder as any)._userTouchedFields;
    }

    const changedFields: string[] = [];
    if (explicitUserTouchedFields && explicitUserTouchedFields.length > 0) {
      for (const key of explicitUserTouchedFields) {
        if (!IGNORED_DIFF_KEYS.has(key)) {
          changedFields.push(key);
        }
      }
    } else if (baselineOrder) {
      const candidateKeys = new Set([...Object.keys(updatedOrder), ...Object.keys(baselineOrder)]);
      for (const key of candidateKeys) {
        if (IGNORED_DIFF_KEYS.has(key)) continue;
        const aVal = (updatedOrder as any)[key];
        const bVal = (baselineOrder as any)[key];
        if (aVal === bVal) continue;
        if (JSON.stringify(aVal) !== JSON.stringify(bVal)) {
          changedFields.push(key);
        }
      }
    } else {
      for (const key of Object.keys(updatedOrder)) {
        if (!IGNORED_DIFF_KEYS.has(key)) {
          changedFields.push(key);
        }
      }
    }

    // Helper to merge user-changed fields onto the latest state (preserving concurrent edits by other users on untouched fields)
    const mergeOrderFieldsTransactionally = (
      latestState: WorkOrder | undefined,
      incomingOrder: WorkOrder,
      fieldsModifiedByUser: string[]
    ): WorkOrder => {
      const base: Record<string, any> = latestState ? { ...latestState } : { ...incomingOrder };
      const mergedFieldTimestamps: Record<string, string> = {
        ...(latestState?.fieldUpdatedAt || {}),
        ...(incomingOrder.fieldUpdatedAt || {})
      };

      if (latestState && fieldsModifiedByUser.length > 0) {
        for (const field of fieldsModifiedByUser) {
          if (field === 'customFields' && incomingOrder.customFields && latestState.customFields) {
            base.customFields = { ...latestState.customFields, ...incomingOrder.customFields };
          } else {
            base[field] = (incomingOrder as any)[field];
          }
          mergedFieldTimestamps[field] = nowIso;
        }
      } else {
        Object.assign(base, incomingOrder);
        for (const field of fieldsModifiedByUser) {
          mergedFieldTimestamps[field] = nowIso;
        }
      }

      const nextRecordVersion =
        Math.max(
          Number(latestState?.recordVersion) || 1,
          Number(incomingOrder.recordVersion) || 1,
          Number(prevOrder?.recordVersion) || 1
        ) + 1;

      return {
        ...(base as WorkOrder),
        id: incomingOrder.id,
        fieldUpdatedAt: mergedFieldTimestamps,
        recordVersion: nextRecordVersion,
        updatedAt: nowIso,
        isNew: false,
        isEdited: true,
        lastEditedAt: nowIso
      };
    };

    let markedOrder: WorkOrder = mergeOrderFieldsTransactionally(latestLiveOrder, updatedOrder, changedFields);

    // 1. OPTIMISTIC ZERO-LATENCY UI UPDATE BEFORE ANY NETWORK / FIRESTORE ROUND-TRIP!
    setWorkOrders((prev) => {
      const currentInState = prev.find((w) => w.id === markedOrder.id);
      const reconciledLocal = currentInState
        ? mergeOrderFieldsTransactionally(currentInState, markedOrder, changedFields)
        : markedOrder;
      markedOrder = reconciledLocal;
      return prev.map((w) => (w.id === reconciledLocal.id ? reconciledLocal : w));
    });

    auditTrailService.recordWorkOrderDiff(baselineOrder || prevOrder, markedOrder, currentUser);

    // 2. Dispatch immediate real-time WebSocket + HTTP sync to the authoritative server vault
    const saved = await realtime.updateWorkOrder(markedOrder, changedFields);

    if ((saved as any)?.conflictError) {
      // If user did not change workOrderNumber or workOrderCode, this was an internal server collision.
      // Do NOT revert the order or block saving! Keep the user's updated order locally and sync.
      const numChanged = prevOrder && String(prevOrder.workOrderNumber || '').trim() !== String(updatedOrder.workOrderNumber || '').trim();
      const codeChanged = prevOrder && String(prevOrder.workOrderCode || '').trim() !== String(updatedOrder.workOrderCode || '').trim();
      if (!numChanged && !codeChanged) {
        vaultService.saveWorkOrders(workOrders);
        if (!silentToast) {
          showNotification(`تم حفظ واعتماد بيانات أمر العمل (${updatedOrder.workOrderNumber}) ومزامنتها بنجاح`, 'update');
        }
        return;
      }

      const serverDupOrder: WorkOrder | undefined = (saved as any)?.existingConflictOrder;
      const conflictPool = serverDupOrder ? [serverDupOrder, ...workOrders] : workOrders;
      const serverConflicts = findExistingWorkOrderConflicts([updatedOrder], conflictPool, monthTables, updatedOrder.id).conflicts;
      soundService.playActionSound('delete');
      if (serverConflicts.length > 0) {
        setDuplicateAlertState({
          isOpen: true,
          conflicts: serverConflicts,
          sourceLabel: 'رفض تعديل رقم/نوع أمر العمل — مسجل مسبقاً في المنصة',
          acceptedCount: 0
        });
      }
      if (prevOrder) {
        setWorkOrders((prev) => prev.map((w) => (w.id === prevOrder.id ? prevOrder : w)));
      }
      return;
    }

    if (!silentToast) {
      const wasArchived155 = prevOrder ? isOrderArchivedIn155(prevOrder) : false;
      const nowArchived155 = isOrderArchivedIn155(saved);
      if (!wasArchived155 && nowArchived155) {
        showNotification(
          `تم اعتماد (تم الاجراء) ونقل أمر العمل (${saved.workOrderNumber}) فوراً من قائمة (تم التدقيق عليه) إلى قائمة (ارشيف 155)`,
          'restore'
        );
      } else {
        showNotification(`تم حفظ وتوثيق بيانات أمر العمل (${saved.workOrderNumber}) ومزامنتها فوراً كإجراء نهائي`, 'update');
      }
    }
  };

  const handleUpdateOrder = async (updatedOrder: WorkOrder, skipSensitiveConfirm: boolean = false) => {
    const prevOrder = workOrders.find((w) => w.id === updatedOrder.id);
    const effectiveSkipConfirm = Boolean(skipSensitiveConfirm || (updatedOrder as any)._skipSensitiveConfirm);

    // Only check if the updated workOrderNumber / workOrderCode was actually changed by the user
    const numberChanged = prevOrder && String(prevOrder.workOrderNumber || '').trim() !== String(updatedOrder.workOrderNumber || '').trim();
    const codeChanged = prevOrder && String(prevOrder.workOrderCode || '').trim() !== String(updatedOrder.workOrderCode || '').trim();

    if (numberChanged || codeChanged || (!prevOrder && updatedOrder.workOrderNumber)) {
      if (!prevOrder || !isSameWorkOrderIdentity(prevOrder.workOrderNumber, prevOrder.workOrderCode, updatedOrder.workOrderNumber, updatedOrder.workOrderCode)) {
        const { conflicts } = findExistingWorkOrderConflicts([updatedOrder], workOrders, monthTables, updatedOrder.id);
        if (conflicts.length > 0) {
          soundService.playActionSound('delete');
          setDuplicateAlertState({
            isOpen: true,
            conflicts,
            sourceLabel: 'رفض تعديل رقم/نوع أمر العمل — مسجل مسبقاً في المنصة',
            acceptedCount: 0
          });
          return;
        }
      }
    }

    // Check if this is a sensitive approval or revocation operation (اعتماد نهائي أو إلغاء حالة معتمدة)
    if (prevOrder && !effectiveSkipConfirm) {
      const isFinalApprovedStatus = (val: string) => {
        const s = String(val || '').trim();
        return (
          s === 'مؤهل للاستلام (معتمد)' ||
          s === 'تم الاستلام وإغلاق 155' ||
          s === 'تم النشر'
        );
      };

      const prev155 = String(prevOrder.procedure155Status || '').trim();
      const next155 = String(updatedOrder.procedure155Status || '').trim();
      const prevPub = String(prevOrder.publicationStatus || '').trim();
      const nextPub = String(updatedOrder.publicationStatus || '').trim();

      const checklistChanged =
        prevOrder.technicalSupportAudit !== updatedOrder.technicalSupportAudit ||
        prevOrder.pdcAudit !== updatedOrder.pdcAudit ||
        prevOrder.constructionAudit !== updatedOrder.constructionAudit ||
        prevOrder.technicalSupportChecklist !== updatedOrder.technicalSupportChecklist ||
        prevOrder.auditChecklists !== updatedOrder.auditChecklists;

      if (!checklistChanged) {
        if (prev155 !== next155 && (!isFinalApprovedStatus(prev155) && isFinalApprovedStatus(next155))) {
          setSensitiveOrderConfirm({
            isOpen: true,
            title: 'تأكيد اعتماد نهائي لتدقيق المساندة (إجراء 155)',
            description: `سيتم اعتماد أمر العمل رقم (${updatedOrder.workOrderNumber}) نهائياً.`,
            workOrderNumber: updatedOrder.workOrderNumber,
            previousStatus: prev155 || 'قيد التدقيق',
            newStatus: next155,
            pendingOrder: updatedOrder
          });
          return;
        }
        if (prev155 !== next155 && (isFinalApprovedStatus(prev155) && !isFinalApprovedStatus(next155))) {
          setSensitiveOrderConfirm({
            isOpen: true,
            title: 'تأكيد إلغاء حالة معتمدة (تدقيق المساندة)',
            description: `سيتم إلغاء الحالة المعتمدة لأمر العمل رقم (${updatedOrder.workOrderNumber}).`,
            workOrderNumber: updatedOrder.workOrderNumber,
            previousStatus: prev155,
            newStatus: next155 || 'قيد التدقيق',
            pendingOrder: updatedOrder
          });
          return;
        }
        if (prevPub !== nextPub && nextPub === 'تم النشر') {
          setSensitiveOrderConfirm({
            isOpen: true,
            title: 'تأكيد اعتماد نهائي للنشر',
            description: `سيتم اعتماد نشر أمر العمل رقم (${updatedOrder.workOrderNumber}) نهائياً.`,
            workOrderNumber: updatedOrder.workOrderNumber,
            previousStatus: prevPub || 'لم يتم النشر',
            newStatus: nextPub,
            pendingOrder: updatedOrder
          });
          return;
        }
        if (prevPub === 'تم النشر' && nextPub !== 'تم النشر') {
          setSensitiveOrderConfirm({
            isOpen: true,
            title: 'تأكيد إلغاء حالة النشر المعتمدة',
            description: `سيتم إلغاء حالة النشر المعتمدة لأمر العمل رقم (${updatedOrder.workOrderNumber}).`,
            workOrderNumber: updatedOrder.workOrderNumber,
            previousStatus: prevPub,
            newStatus: nextPub,
            pendingOrder: updatedOrder
          });
          return;
        }
      }
    }

    await commitFinalOrderUpdate(updatedOrder, prevOrder);
  };

  const handleDeleteOrder = async (id: string) => {
    const target = workOrders.find((w) => w.id === id);
    if (target) {
      auditTrailService.recordAction({
        operationType: 'DATA_DELETE',
        operationLabel: 'حذف سجل أمر عمل نهائياً',
        fieldLabel: 'حذف سجل أمر العمل',
        previousValue: `أمر عمل رقم ${target.workOrderNumber} (${target.office} - ${target.contractor})`,
        newValue: 'تم الحذف النهائي (Final Action)',
        workOrderNumber: target.workOrderNumber,
        workOrderId: target.id,
        office: target.office,
        user: currentUser
      });
    }
    vaultService.markAsDeleted(id);
    setWorkOrders((prev) => {
      const next = prev.filter((w) => w.id !== id);
      vaultService.saveWorkOrders(next, true);
      return next;
    });
    await realtime.deleteWorkOrder(id);
    showNotification(
      'تم حذف أمر العمل وتحديث السجلات السحابية لكافة المستخدمين نهائياً دون تراجع', 
      'delete'
    );
  };

  const handleDeleteBatch = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idsSet = new Set(ids);
    const deletedTargets = workOrders.filter((w) => idsSet.has(w.id));
    auditTrailService.recordAction({
      operationType: 'DATA_DELETE',
      operationLabel: `حذف جماعي لعدد (${ids.length}) أمر عمل نهائياً`,
      fieldLabel: 'حذف سجلات متعددة',
      previousValue: deletedTargets.map((t) => t.workOrderNumber).slice(0, 6).join('، '),
      newValue: 'تم الحذف النهائي (Final Action)',
      workOrderNumber: deletedTargets[0]?.workOrderNumber || 'متعدد',
      user: currentUser
    });
    vaultService.markBatchAsDeleted(ids);
    setWorkOrders((prev) => {
      const next = prev.filter((w) => !idsSet.has(w.id));
      vaultService.saveWorkOrders(next, true);
      return next;
    });
    await realtime.deleteBatchWorkOrders(ids);
    showNotification(
      `تم حذف (${ids.length}) أمر عمل وحفظ التعديل السحابي فوراً لكافة المستخدمين دون تراجع`, 
      'delete'
    );
  };

  const handleClearOfficeOrders = async (officeName: string) => {
    if (officeName === 'all' || officeName === 'جميع المكاتب الفرعية') {
      await handleClearAllOrders();
      return;
    }
    auditTrailService.recordAction({
      operationType: 'DATA_DELETE',
      operationLabel: `تفريغ سجلات مكتب (${officeName}) نهائياً`,
      fieldLabel: `سجلات مكتب ${officeName}`,
      previousValue: `سجلات مكتب ${officeName}`,
      newValue: 'تم التفريغ النهائي (Final Action)',
      workOrderNumber: 'عام',
      office: officeName,
      user: currentUser
    });
    vaultService.markTableCleared(officeName);
    setWorkOrders((prev) => {
      const next = prev.filter((w) => w.office !== officeName);
      vaultService.saveWorkOrders(next, true);
      return next;
    });
    await realtime.clearWorkOrders(officeName);
    showNotification(
      `تم مسح وتفريغ سجلات مكتب (${officeName}) سحابياً بشكل نهائي دون تراجع`, 
      'delete'
    );
  };

  const handleClearAllOrders = async () => {
    auditTrailService.recordAction({
      operationType: 'DATA_DELETE',
      operationLabel: 'تفريغ كافة أوامر العمل في المنظومة نهائياً',
      fieldLabel: 'كافة جداول المنظومة',
      previousValue: `${workOrders.length} أمر عمل`,
      newValue: 'تم التفريغ النهائي (Final Action)',
      workOrderNumber: 'عام',
      user: currentUser
    });
    vaultService.markTableCleared('all');
    setWorkOrders([]);
    vaultService.saveWorkOrders([], true);
    await realtime.clearWorkOrders();
    showNotification(
      'تم مسح وتفريغ كافة أوامر العمل في المنظومة السحابية كاملة بشكل نهائي دون تراجع', 
      'delete'
    );
  };

  const handleDeleteOffice = async (officeId: string, officeName?: string, reassignTo?: string) => {
    try {
      await realtime.deleteOffice(officeId, officeName, reassignTo);
      setOffices((prev) => {
        const next = prev.filter((o) => o.id !== officeId && o.name !== officeName);
        vaultService.saveOffices(next);
        return next;
      });
      if (officeName) {
        setDropdownOptions((prev) => {
          const next = {
            ...prev,
            office: prev.office.filter((n) => n !== officeName)
          };
          vaultService.saveDropdownOptions(next);
          return next;
        });
        if (reassignTo) {
          setWorkOrders((prev) => {
            const next = prev.map((w) => (w.office === officeName ? { ...w, office: reassignTo } : w));
            vaultService.saveWorkOrders(next, true);
            return next;
          });
        }
        if (selectedOffice === officeName) {
          setSelectedOffice(reassignTo || 'all');
        }
      }
      showNotification(`تم حذف المكتب الفرعي (${officeName || ''}) ${reassignTo ? `وتحويل أوامره إلى (${reassignTo})` : ''} نهائياً دون تراجع`, 'delete');
    } catch (err) {
      console.error('Error deleting office:', err);
      showNotification('حدث خطأ أثناء حذف المكتب الفرعي', 'delete');
    }
  };

  const handleUpdateOffice = async (updatedOffice: SubOffice, oldName?: string) => {
    try {
      await realtime.updateOffice(updatedOffice, oldName);
      setOffices((prev) => prev.map((o) => (o.id === updatedOffice.id ? updatedOffice : o)));
      
      const previousName = oldName || updatedOffice.name;
      if (previousName !== updatedOffice.name) {
        setWorkOrders((prev) =>
          prev.map((w) => (w.office === previousName ? { ...w, office: updatedOffice.name } : w))
        );
        setDropdownOptions((prev) => ({
          ...prev,
          office: prev.office.map((n) => (n === previousName ? updatedOffice.name : n))
        }));
        if (selectedOffice === previousName) {
          setSelectedOffice(updatedOffice.name);
        }
      }
      showNotification(`تم تحديث بيانات المكتب الفرعي (${updatedOffice.name}) ومزامنة أوامره بنجاح`, 'update');
    } catch (err) {
      console.error('Error updating office:', err);
      showNotification('حدث خطأ أثناء حفظ تعديل المكتب', 'delete');
    }
  };

  // Cell Dropdown Quick Update Handler
  const handleUpdateCell = async (orderId: string, field: string, newValue: any) => {
    const target = workOrders.find(w => w.id === orderId);
    if (!target) return;

    const updated = {
      ...target,
      [field]: newValue
    };

    await handleUpdateOrder(updated);
  };

  const handleAddNewOffice = async (newOffice: Partial<SubOffice>) => {
    try {
      const saved = await realtime.addOffice(newOffice);
      setOffices((prev) => {
        if (prev.some((o) => o.id === saved.id)) return prev;
        return [...prev, saved];
      });
      setDropdownOptions((prev) => {
        if (!prev.office.includes(saved.name)) {
          return { ...prev, office: [...prev.office, saved.name] };
        }
        return prev;
      });
      setSelectedOffice(saved.name);
      showNotification(`تمت إضافة وتفعيل المكتب الفرعي (${saved.name}) بنجاح`, 'create');
    } catch (err) {
      console.error('Error adding office:', err);
      showNotification('حدث خطأ أثناء إضافة المكتب الفرعي', 'delete');
    }
  };

  const handleUpdateOfficeContractors = async (officeName: string, contractors: string[]) => {
    try {
      setOffices((prev) =>
        prev.map((o) => (o.name === officeName ? { ...o, contractors } : o))
      );
      setDropdownOptions((prev) => ({
        ...prev,
        officeContractors: {
          ...(prev.officeContractors || {}),
          [officeName]: contractors
        },
        contractor: Array.from(new Set([...prev.contractor, ...contractors]))
      }));
      await realtime.updateOfficeContractors(officeName, contractors);
      showNotification(`تم تحديث قائمة مقاولي (${officeName}) بنجاح`, 'update');
    } catch (err) {
      console.error('Error updating office contractors:', err);
      showNotification('حدث خطأ أثناء تحديث قائمة المقاولين', 'delete');
    }
  };

  const handleAddContractorToOffice = async (officeName: string, contractorName: string) => {
    const currentList = getContractorsForOffice(officeName, dropdownOptions?.officeContractors, offices);
    if (!currentList.includes(contractorName)) {
      const updated = [...currentList, contractorName];
      await handleUpdateOfficeContractors(officeName, updated);
    }
  };

  const handleDeleteContractorFromOffice = async (officeName: string, contractorName: string) => {
    const currentList = getContractorsForOffice(officeName, dropdownOptions?.officeContractors, offices);
    const updated = currentList.filter(c => c !== contractorName);
    await handleUpdateOfficeContractors(officeName, updated);
  };

  const handleUpdateOfficeConsultants = async (officeName: string, consultants: string[]) => {
    try {
      const updatedOffices = offices.map((o) => (o.name === officeName ? { ...o, consultants } : o));
      setOffices(updatedOffices);
      vaultService.saveOffices(updatedOffices);

      const updatedDropdowns: DropdownOptionsMap = {
        ...dropdownOptions,
        officeConsultants: {
          ...(dropdownOptions.officeConsultants || {}),
          [officeName]: consultants
        },
        consultant: Array.from(new Set([...(dropdownOptions.consultant || []), ...consultants]))
      };
      setDropdownOptions(updatedDropdowns);
      vaultService.saveDropdownOptions(updatedDropdowns);
      await realtime.updateDropdownOptions(updatedDropdowns);
      showNotification(`تم تحديث قائمة استشاريي (${officeName}) بنجاح`, 'update');
    } catch (err) {
      console.error('Error updating office consultants:', err);
      showNotification('حدث خطأ أثناء تحديث قائمة الاستشاريين', 'delete');
    }
  };

  const handleAddConsultantToOffice = async (officeName: string, consultantName: string) => {
    const currentList = getConsultantsForOffice(officeName, dropdownOptions?.officeConsultants, offices);
    if (!currentList.includes(consultantName)) {
      const updated = [...currentList, consultantName];
      await handleUpdateOfficeConsultants(officeName, updated);
    }
  };

  const handleDeleteConsultantFromOffice = async (officeName: string, consultantName: string) => {
    const currentList = getConsultantsForOffice(officeName, dropdownOptions?.officeConsultants, offices);
    const updated = currentList.filter(c => c !== consultantName);
    await handleUpdateOfficeConsultants(officeName, updated);
  };

  // Month Tables Management Handlers (لإتاحة أكثر من جدول لنفس الشهر مع منع التداخل نهائياً)
  const handleCreateMonthTable = async (
    name: string,
    description?: string,
    color?: string,
    targetYear?: number,
    targetMonth?: number
  ): Promise<MonthTable | void> => {
    try {
      const y = targetYear || activeYear;
      const m = targetMonth || (activeMonth === 'all' ? (new Date().getMonth() + 1) : activeMonth);
      const serialNum = getNextTableSerialNumber(monthTables, y, m);

      const created = await realtime.createMonthTable({
        name,
        description,
        color: color || 'blue',
        year: y,
        month: m,
        serialNumber: serialNum,
        isNew: true
      });
      setMonthTables((prev) => {
        const next = [...prev.filter(t => t.id !== created.id), created];
        vaultService.saveMonthTables(next);
        return next;
      });
      setActiveYear(y);
      setActiveMonth(m);
      setSelectedTableId(created.id);
      soundService.playActionSound('create');
      showNotification(`تم إنشاء الجدول المستقل (${created.name}) لشهر ${getArabicMonthName(m)} ${y} بنجاح`, 'create');
      return created;
    } catch (err: any) {
      showNotification(err?.message || 'حدث خطأ أثناء إنشاء الجدول', 'delete');
    }
  };

  const handleUpdateMonthTable = async (table: MonthTable) => {
    try {
      const updatedTbl: MonthTable = { ...table, isNew: false };
      await realtime.updateMonthTable(updatedTbl);
      setMonthTables((prev) => {
        const exists = prev.some(t => t.id === updatedTbl.id);
        const next = exists
          ? prev.map(t => t.id === updatedTbl.id ? updatedTbl : t)
          : [...prev, updatedTbl];
        vaultService.saveMonthTables(next);
        return next;
      });
      showNotification(`تم تحديث بيانات الجدول (${table.name}) بنجاح`, 'update');
    } catch (err: any) {
      showNotification(err?.message || 'حدث خطأ أثناء تعديل الجدول', 'delete');
    }
  };

  const handleDeleteMonthTable = async (tableId: string) => {
    try {
      const targetTable = monthTables.find(t => t.id === tableId);
      const y = targetTable?.year || activeYear;
      const m = (targetTable?.month && targetTable.month !== 'all') ? targetTable.month : (activeMonth === 'all' ? (new Date().getMonth() + 1) : activeMonth);
      const fallbackDefaultId = getDefaultTableId(y, m);

      const idsToRemove: string[] = [];
      workOrders.forEach(w => {
        if (w.tableId === tableId) {
          idsToRemove.push(w.id);
        } else if (isDefaultTableId(tableId)) {
          const scope = resolveOrderScope(w, monthTables);
          if (!scope.isCustomTable && scope.year === y && scope.month === m) {
            idsToRemove.push(w.id);
          }
        }
      });

      if (idsToRemove.length > 0) {
        vaultService.markBatchAsDeleted(idsToRemove);
      }

      setMonthTables((prev) => {
        const next = prev.filter(t => t.id !== tableId);
        vaultService.saveMonthTables(next);
        return next;
      });

      const removeSet = new Set(idsToRemove);
      setWorkOrders((prev) => {
        const next = prev.filter(w => !removeSet.has(w.id) && w.tableId !== tableId);
        vaultService.saveWorkOrders(next, true);
        return next;
      });

      await realtime.deleteMonthTable(tableId);
      if (idsToRemove.length > 0) {
        await realtime.deleteBatchWorkOrders(idsToRemove);
      }

      if (selectedTableId === tableId) {
        setSelectedTableId(fallbackDefaultId);
      }
      showNotification('تم حذف الجدول وأوامره بشكل مستقل ونهائي دون تراجع', 'delete');
    } catch (err: any) {
      showNotification(err?.message || 'حدث خطأ أثناء حذف الجدول', 'delete');
    }
  };

  const handleResetData = async () => {
    await realtime.resetData();
    setWorkOrders(INITIAL_WORK_ORDERS);
    setOffices(INITIAL_OFFICES);
    setColumns(INITIAL_COLUMNS);
    setDropdownOptions(JSON.parse(JSON.stringify(INITIAL_DROPDOWN_OPTIONS)));
    showNotification('تمت استعادة وإعادة تعيين البيانات النموذجية بنجاح لكافة المستخدمين', 'update');
  };

  // Open Edit Modal from Navbar
  const handleOpenEditFromNav = () => {
    if (displayOrders.length > 0) {
      setEditingOrder(displayOrders[0]);
      setIsEditModalOpen(true);
    } else if (workOrders.length > 0) {
      setEditingOrder(workOrders[0]);
      setIsEditModalOpen(true);
    } else {
      setIsAddModalOpen(true);
    }
  };

  // Open Edit Basic Data Modal
  const handleOpenEditBasicFromNav = () => {
    if (displayOrders.length > 0) {
      setBasicEditingOrder(displayOrders[0]);
      setIsBasicEditModalOpen(true);
    } else if (workOrders.length > 0) {
      setBasicEditingOrder(workOrders[0]);
      setIsBasicEditModalOpen(true);
    } else {
      setIsAddModalOpen(true);
    }
  };

  // Basic Work Order Data Edit Handler (المكتب - المقاول - رقم أمر العمل - رمز أمر العمل)
  const handleSaveBasicOrder = async (updatedOrder: WorkOrder) => {
    const prevOrder = workOrders.find((w) => w.id === updatedOrder.id);
    if (
      !prevOrder ||
      String(prevOrder.workOrderNumber || '').trim() !== String(updatedOrder.workOrderNumber || '').trim() ||
      String(prevOrder.workOrderCode || '').trim() !== String(updatedOrder.workOrderCode || '').trim() ||
      !isSameWorkOrderIdentity(prevOrder.workOrderNumber, prevOrder.workOrderCode, updatedOrder.workOrderNumber, updatedOrder.workOrderCode)
    ) {
      const { conflicts } = findExistingWorkOrderConflicts([updatedOrder], workOrders, monthTables, updatedOrder.id);
      if (conflicts.length > 0) {
        soundService.playActionSound('delete');
        setDuplicateAlertState({
          isOpen: true,
          conflicts,
          sourceLabel: 'رفض تعديل رقم/نوع أمر العمل — مسجل مسبقاً في المنصة',
          acceptedCount: 0
        });
        return;
      }
    }

    await commitFinalOrderUpdate(updatedOrder, prevOrder);
  };

  // Immediate Adaptive Excel Import & Insertion Handler - Strictly Scoped to Target Year, Month, and Independent Table
  const handleImportExcelSuccess = async (
    rawImportedList: Partial<WorkOrder>[],
    options?: {
      mode: 'append' | 'merge';
      targetType: 'existing' | 'new_table';
      targetYear?: number;
      targetMonth?: number;
      targetTableId?: string;
      newTableName?: string;
      newTableColor?: string;
      newTableDesc?: string;
      discoveredCustomColumns?: { title: string; field: string }[];
    }
  ): Promise<boolean> => {
    if (!rawImportedList || rawImportedList.length === 0) return false;

    const { conflicts, acceptedOrders: importedList } = findExistingWorkOrderConflicts(
      rawImportedList,
      workOrders,
      monthTables
    );

    if (conflicts.length > 0) {
      soundService.playActionSound('delete');
      setDuplicateAlertState({
        isOpen: true,
        conflicts,
        sourceLabel: 'استيراد أوامر عمل من ملف Excel — تم رفض الأوامر الموجودة مسبقاً في المنصة',
        acceptedCount: importedList.length
      });
    }

    if (importedList.length === 0) {
      return false;
    }

    recordHistoryStep(`استيراد إكسل (${importedList.length}) أوامر عمل`, workOrders);

    // 1. Canonical Table Columns Enforcement: Always keep the exact 14 canonical columns
    const canonicalColumns = ensurePhotosFileColumn(columns);
    setColumns(canonicalColumns);
    vaultService.saveColumns(canonicalColumns);

    // 2. Explicit Target Year, Target Month, and Target Table Resolution (Zero Overlap Guarantee)
    const targetYear = options?.targetYear || (typeof activeYear === 'number' ? activeYear : new Date().getFullYear());
    const targetMonth = options?.targetMonth || (activeMonth !== 'all' ? activeMonth : (new Date().getMonth() + 1));
    const defaultMonthTableId = getDefaultTableId(targetYear, targetMonth);

    let assignedTableId: string = defaultMonthTableId;
    let targetTableName = `الجدول الأساسي - ${getArabicMonthName(targetMonth)} ${targetYear}`;

    if (options?.targetType === 'new_table') {
      const serialNum = getNextTableSerialNumber(monthTables, targetYear, targetMonth);
      const newTable = await realtime.createMonthTable({
        name: options.newTableName?.trim() || `جدول (${serialNum}) - ${getArabicMonthName(targetMonth)} ${targetYear}`,
        color: options.newTableColor || 'emerald',
        description: options.newTableDesc?.trim() || `جدول مستقل لشهر ${getArabicMonthName(targetMonth)} ${targetYear} بعدد ${importedList.length} أمر عمل`,
        year: targetYear,
        month: targetMonth,
        serialNumber: serialNum,
        isNew: true
      });
      setMonthTables((prev) => {
        const next = [...prev.filter(t => t.id !== newTable.id), newTable];
        vaultService.saveMonthTables(next);
        return next;
      });
      assignedTableId = newTable.id;
      targetTableName = newTable.name;
    } else if (options?.targetType === 'existing' && options.targetTableId && !isDefaultTableId(options.targetTableId)) {
      assignedTableId = options.targetTableId;
      const existingT = monthTables.find(t => t.id === options.targetTableId);
      targetTableName = existingT ? existingT.name : `الجدول المحدد - ${getArabicMonthName(targetMonth)} ${targetYear}`;
    } else {
      assignedTableId = defaultMonthTableId;
      targetTableName = `الجدول الأساسي - ${getArabicMonthName(targetMonth)} ${targetYear}`;
    }

    // Switch active view directly to the target Year, Month, and Table
    setActiveYear(targetYear);
    setActiveMonth(targetMonth);
    setSelectedTableId(assignedTableId);

    const effectiveUser = currentUser || getSavedCurrentUser();
    const importerEmail = (effectiveUser?.email || effectiveUser?.username || 'engmhp1@gmail.com').trim();
    const importerName = (effectiveUser?.displayName || effectiveUser?.username || 'مستخدم معتمد').trim();

    // Attach explicit tableId, tableYear, tableMonth, tableName, and addedByEmail to all incoming work orders, marking as isNew
    const preparedItems: Partial<WorkOrder>[] = importedList.map(item => ({
      ...item,
      addedByEmail: (item.addedByEmail || item.createdByEmail || importerEmail).trim(),
      createdByEmail: (item.createdByEmail || item.addedByEmail || importerEmail).trim(),
      addedByName: (item.addedByName || importerName).trim(),
      isNew: true,
      tableId: assignedTableId,
      tableYear: targetYear,
      tableMonth: targetMonth,
      tableName: targetTableName
    }));

    // Create new orders (all duplicates were already strictly filtered out)
    const createdOrders = await realtime.createBatchWorkOrders(preparedItems);

    setWorkOrders((prev) => {
      const existingIdMap = new Map<string, number>(prev.map((w, idx) => [w.id, idx]));
      const next = [...prev];
      const toAppend: WorkOrder[] = [];
      for (const order of createdOrders) {
        const foundIdx = existingIdMap.get(order.id);
        if (foundIdx !== undefined) {
          next[foundIdx] = order;
        } else {
          toAppend.push(order);
        }
      }
      const combined = [...next, ...toAppend];
      vaultService.saveWorkOrders(combined);
      return combined;
    });

    // Reset view filters so newly imported records are 100% visible
    setSelectedOffice('all');
    setKpiFilter('all');

    // Register any new sub-offices discovered in the file
    const newOfficesFound = Array.from(new Set(importedList.map(o => o.office).filter(Boolean))) as string[];
    const existingOfficeNames = new Set(offices.map(o => o.name));
    for (const offName of newOfficesFound) {
      if (!existingOfficeNames.has(offName)) {
        await handleAddNewOffice({ name: offName, contractors: [] });
      }
    }

    // Register any new contractors and consultants into dropdown options
    const newContractorsFound = Array.from(new Set(importedList.map(o => o.contractor).filter(Boolean))) as string[];
    const newConsultantsFound = Array.from(new Set(importedList.map(o => o.consultant).filter(Boolean))) as string[];
    setDropdownOptions(prev => {
      const existingConts = new Set(prev.contractor || []);
      const existingCons = new Set(prev.consultant || []);
      const toAddConts = newContractorsFound.filter(c => !existingConts.has(c));
      const toAddCons = newConsultantsFound.filter(c => !existingCons.has(c));
      if (toAddConts.length === 0 && toAddCons.length === 0) return prev;
      const updated: DropdownOptionsMap = {
        ...prev,
        contractor: [...(prev.contractor || []), ...toAddConts],
        consultant: [...(prev.consultant || []), ...toAddCons]
      };
      vaultService.saveDropdownOptions(updated);
      return updated;
    });

    auditTrailService.recordAction({
      operationType: 'DATA_ENTRY',
      operationLabel: `استيراد وإدراج (${preparedItems.length}) أمر عمل من ملف Excel`,
      fieldLabel: `الجدول المستهدف: ${targetTableName}`,
      previousValue: 'إضافة صفوف جديدة',
      newValue: `${preparedItems.length} أمر عمل في (${targetTableName})`,
      workOrderNumber: preparedItems[0]?.workOrderNumber || 'متعدد',
      user: effectiveUser
    });

    soundService.playActionSound('create');
    showNotification(
      `تم استيراد (${preparedItems.length}) أمر عمل جديد بنجاح في (${targetTableName})${conflicts.length > 0 ? ` — وتم رفض (${conflicts.length}) أمر عمل مكرر` : ''}!`, 
      'create'
    );
    return true;
  };

  // Semantic Compatible Table Import Handler (استيراد متوافق بدلالة الأعمدة مع التمييز البصري)
  const handleExecuteCompatibleImport = async (
    rawImportedOrders: WorkOrder[],
    options: CompatibleImportResultOptions
  ): Promise<boolean> => {
    if (!rawImportedOrders || rawImportedOrders.length === 0) return false;

    const { conflicts, acceptedOrders: importedOrders } = findExistingWorkOrderConflicts(
      rawImportedOrders,
      workOrders,
      monthTables
    );

    if (conflicts.length > 0) {
      soundService.playActionSound('delete');
      setDuplicateAlertState({
        isOpen: true,
        conflicts,
        sourceLabel: 'استيراد من الجداول المتوافقة — تم رفض أوامر العمل الموجودة مسبقاً في المنصة',
        acceptedCount: importedOrders.length
      });
    }

    if (importedOrders.length === 0) {
      return false;
    }

    recordHistoryStep(`استيراد متوافق (${importedOrders.length}) أوامر عمل`, workOrders);

    const targetTableId = selectedTableId;
    const targetYear = activeYear;
    const targetMonth = activeMonth === 'all' ? 1 : activeMonth;
    const targetTableName = activeTableName;

    const ordersToCreate: Partial<WorkOrder>[] = importedOrders.map(item => ({
      ...item,
      id: undefined,
      tableId: targetTableId,
      tableYear: targetYear,
      tableMonth: targetMonth,
      tableName: targetTableName,
      isImported: true,
      importedFromTableId: options.sourceTableId,
      importedFromTableName: options.sourceTableName,
      importedAt: new Date().toISOString(),
      importedFields: options.importedFieldKeys,
      highlightColor: options.distinctHighlight ? options.highlightColor : undefined,
      isNew: true
    }));

    let created: WorkOrder[] = [];
    if (ordersToCreate.length > 0) {
      created = await realtime.createBatchWorkOrders(ordersToCreate);
    }

    setWorkOrders(prev => {
      const combined = [...prev, ...created];
      vaultService.saveWorkOrders(combined);
      return combined;
    });

    showNotification(
      `تم استيراد البيانات المتوافقة بنجاح: تمت إضافة (${created.length}) صف جديد${conflicts.length > 0 ? ` — وتم رفض (${conflicts.length}) أمر عمل مكرر` : ''}.`,
      'create'
    );
    return true;
  };

  // Open Export Modal (defaults to filtered orders if table has active filters)
  const handleOpenMainExport = (customOrders?: WorkOrder[], customTitle?: string, openEmail: boolean = false) => {
    const isFilteredActive = tableFilteredOrders.length > 0 && tableFilteredOrders.length < displayOrders.length;
    const targetOrders = customOrders || (isFilteredActive ? tableFilteredOrders : null);
    setExportCustomOrders(targetOrders);

    let defaultTitle = selectedOffice === 'all' ? 'كافة المكاتب الفرعية' : selectedOffice;
    if (!customTitle && isFilteredActive && !customOrders) {
      defaultTitle = `${defaultTitle} (الجدول المفلتر)`;
    }
    setExportCustomTitle(customTitle || defaultTitle);
    setIsEmailExportInitiallyOpen(openEmail);
    setIsExportModalOpen(true);
  };

  // Open Export Modal for Search Results
  const handleExportSearchResults = (results: WorkOrder[], customTitle?: string, openEmail = false) => {
    handleOpenMainExport(results, customTitle || `نتائج البحث المجدولة (${results.length} أمر عمل)`, openEmail);
  };

  // Photo updates
  const handleUpdatePhotos = async (orderId: string, updatedPhotos: PhotoItem[]) => {
    const target = workOrders.find((w) => w.id === orderId);
    if (!target) return;
    const updated = { ...target, photos: updatedPhotos };
    await handleUpdateOrder(updated);
    setPhotoOrder(updated);
  };

  // Audit 155 quick status change
  const handleUpdate155Status = async (orderId: string, status: Procedure155Status) => {
    const target = workOrders.find((w) => w.id === orderId);
    if (!target) return;
    const updated = { 
      ...target, 
      procedure155Status: status,
      _skipSensitiveConfirm: true,
      _userTouchedFields: ['procedure155Status']
    };
    await handleUpdateOrder(updated, true);
  };

  // Undo and Restore on deletion are permanently disabled per platform governance policy
  const handleRequestUndo = (_orders: WorkOrder[]) => {
    setPendingUndoOrders(null);
    showNotification('التراجع عن عمليات الحذف غير مسموح به نهائياً في المنصة', 'delete');
  };

  const executePendingUndo = async () => {
    setPendingUndoOrders(null);
    showNotification('التراجع عن عمليات الحذف غير مسموح به نهائياً في المنصة', 'delete');
  };

  const handleRestoreDeletedOrder = async (_order: WorkOrder) => {
    showNotification('استرجاع السجلات المحذوفة غير مسموح به نهائياً في المنصة', 'delete');
  };

  const handleRestoreAllDeletedOrders = async (_orders: WorkOrder[]) => {
    showNotification('استرجاع السجلات المحذوفة غير مسموح به نهائياً في المنصة', 'delete');
  };

  const handlePermanentlyClearTrash = () => {
    setDeletedOrders([]);
  };

  // Centralized Granular Permission Guard for All Tools, Actions & Reports
  const checkPermission = useCallback(
    (permKey: keyof UserPermissions | string, actionTitle: string, callback?: () => void): boolean => {
      if (!currentUser) {
        setAccessDeniedModal({ isOpen: true, title: actionTitle });
        return false;
      }
      if (hasUserPermission(currentUser, permKey)) {
        if (callback) callback();
        return true;
      }
      soundService.playActionSound('delete');
      setAccessDeniedModal({ isOpen: true, title: actionTitle });
      showNotification(`لا توجد صلاحية: ${actionTitle}`, 'delete');
      return false;
    },
    [currentUser, showNotification]
  );

  // Dedicated Guard for Permissions Management - strictly for full permissions holders
  const handleOpenPermissionsManager = useCallback(() => {
    if (!currentUser) {
      setAccessDeniedModal({ isOpen: true, title: 'إدارة الصلاحيات وحسابات المستخدمين' });
      return;
    }
    if (!hasFullPermissions(currentUser)) {
      soundService.playActionSound('delete');
      setAccessDeniedModal({
        isOpen: true,
        title: 'إدارة الصلاحيات وحسابات المستخدمين (مقتصرة على من لديه كامل الصلاحيات فقط)'
      });
      showNotification('لا توجد صلاحية: أيقونة وإدارة الصلاحيات مقتصرة فقط على من لديه كامل الصلاحيات', 'delete');
      return;
    }
    setIsPermissionsModalOpen(true);
  }, [currentUser, showNotification]);

  // Centralized Require Auth Guard mapped to Granular User Permissions
  const requireAuth = useCallback(
    (actionDescription: string, callback?: () => void, permKey?: keyof UserPermissions) => {
      if (permKey) {
        return checkPermission(permKey, actionDescription, callback);
      }
      if (currentUser && isUserSuperAdmin(currentUser)) {
        if (callback) callback();
        return true;
      }
      if (isSessionUnlocked() && currentUser) {
        if (callback) callback();
        return true;
      }
      setAccessDeniedModal({ isOpen: true, title: actionDescription });
      showNotification(`لا توجد صلاحية: ${actionDescription}`, 'delete');
      return false;
    },
    [currentUser, checkPermission, showNotification]
  );

  const handleLoginSuccess = useCallback((loggedInUser: PlatformUser, serverUsers?: PlatformUser[]) => {
    saveCurrentUser(loggedInUser);
    setCurrentUser(loggedInUser);
    setSessionUnlocked(true);
    setIsUnlocked(true);
    setActiveSidebarSection('home');
    setActiveSectionCard(null);
    if (Array.isArray(serverUsers) && serverUsers.length > 0) {
      const mergedUsers = ensureDefaultSuperAdmins(serverUsers);
      setUsers(mergedUsers);
      vaultService.saveUsers(mergedUsers);
    }
    notificationService.saveUserIdentity({
      userName: loggedInUser.displayName || loggedInUser.username,
      userRole: loggedInUser.roleTitle || 'مستخدم معتمد',
      userEmail: loggedInUser.email || loggedInUser.username
    });
    realtime.updatePresenceIdentity();
    soundService.playActionSound('auth_success');
    showNotification(`مرحباً بك (${loggedInUser.displayName || loggedInUser.username}) في منصة حوكمة جودة اعمال الانشاءات [${loggedInUser.roleTitle || 'مستخدم معتمد'}]`, 'auth_success');
    
    // Always trigger native browser/OS notification as well
    notificationService.showLocalNotification('تسجيل دخول إلى المنصة', {
      body: `تم تسجيل دخول (${loggedInUser.displayName || loggedInUser.username}) بنجاح [${loggedInUser.roleTitle || 'مستخدم معتمد'}]`,
      tag: `login-alert-${Date.now()}`
    });

    // Broadcast user entry across the entire platform to all connected users
    realtime.broadcastUserLogin(loggedInUser);
  }, [showNotification]);

  const handleLogout = useCallback(() => {
    saveCurrentUser(null);
    setCurrentUser(null);
    notificationService.saveUserIdentity({
      userName: '',
      userRole: 'مستخدم المنظومة',
      userEmail: ''
    });
    setSessionUnlocked(false);
    setIsUnlocked(false);
    setIsPermissionsModalOpen(false);
    showNotification('تم تسجيل الخروج من المنصة بنجاح', 'update');
  }, [showNotification]);

  const handleSaveUserAccount = useCallback(async (userPayload: Partial<PlatformUser>) => {
    const res = await realtime.saveUser(userPayload);
    const usersList = (res as any)?.users || (Array.isArray(res) ? res : null);
    if (usersList) {
      const nextUsers = ensureDefaultSuperAdmins(usersList);
      setUsers(nextUsers);
      vaultService.saveUsers(nextUsers);
      if (currentUser && (res as any)?.user && (res as any).user.id === currentUser.id) {
        saveCurrentUser((res as any).user);
        setCurrentUser((res as any).user);
      }
      showNotification(`تم حفظ حساب المستخدم (${(res as any)?.user?.displayName || userPayload.displayName || userPayload.username}) وصلاحياته بنجاح دائم`, 'create');
    }
  }, [currentUser, showNotification]);

  const handleDeleteUserAccount = useCallback(async (userId: string) => {
    const nextUsers = await realtime.deleteUser(userId);
    const updated = ensureDefaultSuperAdmins(nextUsers);
    setUsers(updated);
    vaultService.saveUsers(updated);
    showNotification('تم حذف حساب المستخدم وتحديث الصلاحيات فوراً', 'delete');
  }, [showNotification]);

  const handleLockSession = useCallback(() => {
    handleLogout();
  }, [handleLogout]);

  const handleOpenNotesReportFromGlobal = useCallback((mode: NotesReportMode = 'all', contractor: string = '') => {
    checkPermission('viewQualityNotesReport', 'سجل وتقرير الملاحظات والصور الميدانية', () => {
      setQualityNotesReportMode(mode);
      setQualityNotesReportContractor(contractor);
      setIsQualityNotesReportModalOpen(true);
    });
  }, [checkPermission]);

  const handleOpenDropdownManagerWithAuth = () => {
    checkPermission('manageDropdowns', 'إدارة القوائم المنسدلة', () => setIsDropdownManagerOpen(true));
  };

  const handleOpenColumnManagerWithAuth = () => {
    checkPermission('manageColumns', 'إدارة هيكلة الأعمدة', () => setIsColumnManagerOpen(true));
  };

  const handleOpenResetWithAuth = () => {
    checkPermission('clearData', 'استعادة البيانات النموذجية', () => handleResetData());
  };

  const handlePinSuccess = () => {
    setIsUnlocked(true);
    setSessionUnlocked(true);
    setIsPinModalOpen(false);
    showNotification('تم التحقق بنجاح وتفعيل كافة أدوات المنظومة لهذه الجلسة', 'auth_success');

    const cb = pendingAuthAction;
    const currentAction = pinAction;
    setPendingAuthAction(null);
    setPinAction(null);

    if (cb) {
      setTimeout(() => cb(), 80);
      return;
    }

    if (currentAction === 'dropdown') {
      setIsDropdownManagerOpen(true);
    } else if (currentAction === 'columns') {
      setIsColumnManagerOpen(true);
    } else if (currentAction === 'reset') {
      handleResetData();
    } else if (currentAction === 'undo') {
      executePendingUndo();
    } else if (currentAction === 'restore_deleted') {
      setIsRestoreDeletedModalOpen(true);
    }
  };

  const handleSaveColumns = async (updatedColumns: ColumnDefinition[], updatedDropdowns?: DropdownOptionsMap) => {
    const canonicalColumns = ensurePhotosFileColumn(updatedColumns);
    setColumns(canonicalColumns);
    vaultService.saveColumns(canonicalColumns);
    if (updatedDropdowns) {
      setDropdownOptions(updatedDropdowns);
      vaultService.saveDropdownOptions(updatedDropdowns);
    }
    await realtime.updateColumns(canonicalColumns, updatedDropdowns);
    showNotification('تم حفظ وتحديث مسميات وهيكلة الأعمدة للجميع', 'update');
  };

  const handleSaveDropdownOptions = async (updatedOptions: DropdownOptionsMap) => {
    setDropdownOptions(updatedOptions);
    vaultService.saveDropdownOptions(updatedOptions);
    await realtime.updateDropdownOptions(updatedOptions);
    showNotification('تم تحديث بيانات القوائم المنسدلة وترحيلها لكافة المتصلين', 'update');
  };

  // Real Manual Synchronization Trigger (مزامنة يدوية حقيقية وتحديث فوري لكافة السجلات)
  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      const data = await realtime.fetchAllData(true);
      if (data) {
        if (Array.isArray(data.workOrders)) {
          const { mergedOrders } = vaultService.reconcileWithVault(data.workOrders, data.deletedOrderIds);
          const deduped = deduplicateOrders(mergedOrders);
          realtime.recordKnownOrders(deduped);
          lastPersistedOrdersRef.current = deduped;
          setWorkOrders(deduped);
          vaultService.saveWorkOrders(deduped, true);
        }
        if (Array.isArray(data.offices) && data.offices.length > 0) {
          const normalizedOffs = normalizeOfficesConsultants(data.offices);
          setOffices(normalizedOffs);
          vaultService.saveOffices(normalizedOffs);
        }
        if (Array.isArray(data.columns) && data.columns.length > 0) {
          const safeCols = ensurePhotosFileColumn(data.columns);
          setColumns(safeCols);
          vaultService.saveColumns(safeCols);
        }
        if (data.dropdownOptions && Object.keys(data.dropdownOptions).length > 0) {
          const mergedOpts = normalizeDropdownConsultants(data.dropdownOptions);
          setDropdownOptions(mergedOpts);
          vaultService.saveDropdownOptions(mergedOpts);
        }
        if (Array.isArray(data.monthTables)) {
          const loadedTables = data.monthTables.filter((t): t is MonthTable => Boolean(t && t.id));
          setMonthTables(loadedTables);
          vaultService.saveMonthTables(loadedTables);
        }
        if (Array.isArray(data.archivedReports)) {
          setArchivedReports(data.archivedReports);
          vaultService.saveArchivedReports(data.archivedReports);
        }
        if (Array.isArray(data.users)) {
          const authoritativeUsers = ensureDefaultSuperAdmins(data.users.filter((u): u is PlatformUser => Boolean(u && u.id)));
          lastSavedUsersRef.current = authoritativeUsers;
          setUsers(authoritativeUsers);
          vaultService.saveUsers(authoritativeUsers);
        }
      }
      showNotification('تمت المزامنة السحابية المباشرة بنجاح وتأكيد أحدث السجلات للجميع دون تراجع', 'update');
    } catch (err) {
      console.error('Manual sync failed:', err);
    } finally {
      setTimeout(() => setIsManualSyncing(false), 600);
    }
  };

  // Global Keyboard Shortcuts (Strict No Undo Policy: Ctrl+Z & Ctrl+Y permanently blocked everywhere)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentUser) return;

      // Strictly block Ctrl+Z, Ctrl+Y, Cmd+Z, Cmd+Shift+Z globally across all inputs and screens (No Undo Policy)
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        e.stopPropagation();
        showNotification('سياسة منع التراجع (No Undo Policy): جميع الإجراءات داخل المنصة نهائية ولا يمكن التراجع عنها', 'update');
        return;
      }

      // 1. Command Palette (Ctrl+K or Cmd+K) - works globally
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        return;
      }

      const activeEl = document.activeElement;
      const isInput = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement || (activeEl as HTMLElement)?.isContentEditable;
      if (isInput) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      } else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        checkPermission('addWorkOrder', 'إضافة أمر عمل جديد', () => setIsAddModalOpen(true));
      } else if (e.altKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        checkPermission('importExcel', 'استيراد بيانات من Excel', () => setIsImportExcelModalOpen(true));
      } else if (e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        checkPermission('exportTable', 'تصدير الجدول والتقارير', () => handleOpenMainExport());
      } else if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleToggleSound();
      } else if (e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        checkPermission('manageNotifications', 'إعدادات الإشعارات الفورية', () => setIsNotificationModalOpen(true));
      } else if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleManualSync();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [currentUser, checkPermission, handleUndo, handleRedo, handleOpenMainExport, handleToggleSound, handleManualSync]);

  // If no authenticated user session is active, show the Login Screen (while real-time sync stays connected in the background)
  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        users={users}
        syncStatus={syncStatus}
        onlineCount={onlineCount}
      />
    );
  }

  return (
    <div className="min-h-screen text-slate-900 flex flex-col font-['Cairo',sans-serif] bg-[#F4F6F9]">
      {/* Real-time Notification Floating Banner with Sound Feedback and Protected Undo */}
      {liveToast && (
        <div className="fixed bottom-5 left-5 z-50 bg-slate-950 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className={`p-2 rounded-xl shrink-0 ${
            liveToast.type === 'create' ? 'bg-blue-600' :
            liveToast.type === 'update' ? 'bg-amber-600' :
            liveToast.type === 'restore' ? 'bg-emerald-600' :
            liveToast.type === 'export' ? 'bg-purple-600' : 'bg-rose-600'
          }`}>
            {liveToast.type === 'restore' ? (
              <RotateCcw className="w-4 h-4 text-white" />
            ) : liveToast.type === 'delete' ? (
              <Trash2 className="w-4 h-4 text-white" />
            ) : (
              <Bell className="w-4 h-4 text-white" />
            )}
          </div>
          
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-100">{liveToast.message}</span>
            {liveToast.undoOrders && liveToast.undoOrders.length > 0 && (
              <span className="text-[10px] text-amber-300/90 flex items-center gap-1 mt-0.5">
                <Lock className="w-2.5 h-2.5" />
                استعادة البيانات المحذوفة محمية بالصلاحيات
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setLiveToast(null)}
            className="p-1 text-slate-400 hover:text-white rounded-md transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Super Admin Platform Publish Handler (نشر التحديث وإغلاق الجلسات لجميع المتصلين) */}
      {/* Main Navbar with Brand Card, Live Time/Date Cards, Sidebar Arrow, Manual Sync & Sound Alert */}
      <Navbar
        syncStatus={syncStatus}
        onlineCount={onlineCount}
        connectedUsers={connectedUsersList}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        isSidebarOpen={isSidebarOpen}
        onResetData={() => checkPermission('clearData', 'استعادة البيانات النموذجية', handleResetData)}
        onManualSync={handleManualSync}
        isManualSyncing={isManualSyncing}
        totalOrdersCount={workOrders.length}
        ready155Count={totalReady155Count}
        isSoundMuted={isSoundMuted}
        onToggleSound={handleToggleSound}
        onOpenWeeklyReport={() => checkPermission('viewWeeklyReport', 'التقرير الأسبوعي للمكاتب الفرعية', () => setIsWeeklyReportModalOpen(true))}
        onOpenOfficeComparison={() => checkPermission('viewOfficeComparison', 'مقارنة وتقييم أداء المكاتب الفرعية', () => setIsOfficeComparisonModalOpen(true))}
        onOpenContractorComparison={() => checkPermission('viewContractorClosureReport', 'مقارنة المقاولين وإنجاز الإغلاقات', () => setIsContractorClosureReportOpen(true))}
        onOpenComprehensiveReports={() => checkPermission('viewComprehensiveReports', 'مركز التقارير الموحد (تفصيلية ومجمعة)', () => {
          setComprehensiveReportsMode('aggregated');
          setIsComprehensiveReportsOpen(true);
        })}
        onOpenExportModal={(openEmail) => checkPermission('exportTable', 'تصدير الجدول والتقارير', () => handleOpenMainExport(undefined, undefined, Boolean(openEmail)))}
        onOpenDataRecovery={() => checkPermission('manageCloudBackups', 'مركز الأمان والنسخ الاحتياطية', () => setIsDataRecoveryModalOpen(true))}
        onOpenNotificationSettings={() => checkPermission('manageNotifications', 'إعدادات الإشعارات الفورية', () => setIsNotificationModalOpen(true))}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenCommandPalette={() => checkPermission('searchAndFilter', 'لوحة الأوامر والبحث', () => setIsCommandPaletteOpen(true))}
        activeYear={activeYear}
        activeMonth={activeMonth}
        onOpenYearMonthPicker={() => setIsYearMonthPickerOpen(true)}
        isSessionUnlockedState={isUnlocked}
        onOpenPinModal={handleOpenPermissionsManager}
        onLockSession={handleLockSession}
        currentUser={currentUser}
        onOpenPermissionsManager={handleOpenPermissionsManager}
        onPublishPlatform={async () => {
          const confirmed = window.confirm(
            'هل أنت متأكد من رغبتك في نشر تحديث البرنامج الآن؟ سيتم تحديث المنصة لدى جميع المتصلين بأمان تام دون المساس ببيانات الجداول أو الصلاحيات أو المستخدمين.'
          );
          if (!confirmed) return;
          try {
            showNotification('جاري نشر تحديث المنصة لجميع المستخدمين مع الحفاظ الكامل على البيانات...', 'update');
            const ok = await realtime.triggerPlatformPublish();
            if (ok) {
              setPlatformPublishAlert({
                publishedAt: new Date().toISOString(),
                deployId: `manual-${Date.now()}`,
                countdown: 4
              });
            }
          } catch (err) {
            console.error('Publish error:', err);
          }
        }}
        onLogout={handleLogout}
      />

      {/* Primary Unified Enterprise Workspace: Persistent Right Sidebar + Dynamic Main Viewport */}
      <div className={`flex-1 flex w-full max-w-full ${isERP ? 'pt-14' : 'pt-20 sm:pt-22'}`} dir="rtl">
        {/* Persistent Corporate Right Sidebar (11 Unified & Deduplicated Platform Sections) */}
        <SidebarActions
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onToggle={() => setIsSidebarOpen(prev => !prev)}
          syncStatus={syncStatus}
          onlineCount={onlineCount}
          totalOrdersCount={workOrders.length}
          ready155Count={totalReady155Count}
          columnsCount={columns.length}
          officesCount={offices.length}
          contractorsCount={allContractors.length}
          trackedAuditCount={auditTrackerSummary.trackedCount}
          fullyAuditedCount={auditTrackerSummary.fullyAuditedCount}
          activeYear={activeYear}
          onManualSync={handleManualSync}
          isManualSyncing={isManualSyncing}
          onOpenAddModal={() => {
            checkPermission('addWorkOrder', 'إضافة أمر عمل جديد', () => setIsAddModalOpen(true));
          }}
          onOpenEditSelector={() => {
            checkPermission('editWorkOrderStatus', 'تعديل حالة أمر العمل وملاحظات 155', handleOpenEditFromNav);
          }}
          onOpenEditBasicData={() => {
            checkPermission('editWorkOrderBasic', 'تعديل البيانات الأساسية لأمر العمل', handleOpenEditBasicFromNav);
          }}
          onOpenImportModal={() => {
            checkPermission('importExcel', 'استيراد بيانات من Excel', () => setIsImportExcelModalOpen(true));
          }}
          onOpenCompatibleImport={() => {
            checkPermission('importCompatibleTables', 'استيراد البيانات من الجداول المتوافقة', () => setIsCompatibleImportModalOpen(true));
          }}
          onOpenSearchModal={() => {
            checkPermission('searchAndFilter', 'البحث والفلترة المتقدمة', () => setIsSearchModalOpen(true));
          }}
          onOpenExportModal={() => {
            checkPermission('exportTable', 'تصدير الجدول والتقارير', () => handleOpenMainExport());
          }}
          onOpenWeeklyReport={() => {
            checkPermission('viewWeeklyReport', 'التقرير الأسبوعي للمكاتب الفرعية', () => setIsWeeklyReportModalOpen(true));
          }}
          onOpenOfficeComparison={() => {
            checkPermission('viewOfficeComparison', 'مقارنة وتقييم أداء المكاتب الفرعية', () => setIsOfficeComparisonModalOpen(true));
          }}
          onOpenContractorComparison={() => {
            checkPermission('viewContractorClosureReport', 'مقارنة المقاولين وإنجاز الإغلاقات', () => setIsContractorClosureReportOpen(true));
          }}
          onOpenDataRecovery={() => {
            checkPermission('manageCloudBackups', 'مركز الأمان والنسخ الاحتياطية', () => setIsDataRecoveryModalOpen(true));
          }}
          onOpenManageOffices={() => {
            checkPermission('manageOffices', 'إدارة المكاتب الفرعية', () => setIsManageOfficesModalOpen(true));
          }}
          onOpenManageContractors={() => {
            checkPermission('manageContractors', 'إدارة وتوزيع مقاولي المكاتب', () => setIsManageContractorsModalOpen(true));
          }}
          onOpenDropdownManagerWithAuth={() => {
            checkPermission('manageDropdowns', 'إدارة القوائم المنسدلة', () => setIsDropdownManagerOpen(true));
          }}
          onOpenColumnManagerWithAuth={() => {
            checkPermission('manageColumns', 'إدارة هيكلة الأعمدة', () => setIsColumnManagerOpen(true));
          }}
          onOpenClearDataModal={() => {
            checkPermission('clearData', 'مسح وتفريغ البيانات', () => setIsClearDataModalOpen(true));
          }}
          onResetData={() => {
            checkPermission('clearData', 'استعادة البيانات النموذجية', handleResetData);
          }}
          deletedOrdersCount={0}
          onOpenRestoreDeletedModal={undefined}
          onOpenNotificationSettings={() => {
            checkPermission('manageNotifications', 'إعدادات الإشعارات الفورية', () => setIsNotificationModalOpen(true));
          }}
          onOpenPermissionsManager={() => {
            handleOpenPermissionsManager();
          }}
          currentUser={currentUser}
          onLogout={handleLogout}
          isSoundMuted={isSoundMuted}
          onToggleSound={handleToggleSound}
          onOpenAboutPlatform={() => setIsAboutPlatformModalOpen(true)}
          onOpenAuditTrail={() => checkPermission('smartAudit', 'استعراض سجل التدقيق التاريخي الشامل (Audit Trail)', () => setIsAuditTrailModalOpen(true))}
          activeViewTab={activeViewTab}
          onSelectViewTab={(tab) => setActiveViewTab(tab)}
          activeSidebarSection={activeSidebarSection}
          onSelectSidebarSection={handleSelectSidebarSection}
          onOpenExecutiveDashboard={() => {
            handleSelectSidebarSection('admin_dashboard');
          }}
          onOpenYearMonthPicker={() => setIsYearMonthPickerOpen(true)}
        />

      <main className={`flex-1 min-w-0 w-full max-w-full mx-auto transition-all duration-300 ease-in-out ${
        isSidebarOpen ? 'lg:mr-72 xl:mr-76' : 'mr-0'
      } ${
        normalizeSidebarSectionId(activeSidebarSection) === 'work_orders'
          ? 'px-2 pt-2 pb-11'
          : isERP ? 'px-2 sm:px-4 pt-3 pb-20 sm:pb-24' : 'px-2 sm:px-4 lg:px-6 pt-3 pb-20 sm:pb-24'
      }`}>
        {isInitialLoading && workOrders.length === 0 ? (
          <div className="w-full py-32 flex flex-col items-center justify-center gap-3 text-slate-600">
            <Loader2 className="w-9 h-9 animate-spin text-[#004B8D]" />
            <span className="font-bold text-sm text-slate-700">جاري تهيئة المنظومة...</span>
          </div>
        ) : (
          <>
            {/* Unified Active Section Breadcrumb & Return to Home Bar (Shown on all non-Home tabs except work_orders) */}
            {normalizeSidebarSectionId(activeSidebarSection) !== 'home' && normalizeSidebarSectionId(activeSidebarSection) !== 'work_orders' && (() => {
              const currentMeta = SIDEBAR_SECTIONS_META.find(
                (s) => s.id === normalizeSidebarSectionId(activeSidebarSection)
              );
              const IconComp = currentMeta?.icon || ShieldCheck;
              return (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs px-3.5 py-2.5 mb-3 flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#002855] text-[#F58220] flex items-center justify-center shrink-0">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 leading-tight">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-black text-[#002855]">
                          {currentMeta?.label || 'قسم المنصة'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#004B8D] border border-blue-200 text-[10px] font-black">
                          {selectedOffice === 'all' ? 'كافة المكاتب الفرعية' : `مكتب ${selectedOffice}`}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-mono font-bold">
                          {activePeriodLabel}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-500 font-bold truncate mt-0.5">
                        {currentMeta?.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedOffice !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setSelectedOffice('all')}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black transition-colors cursor-pointer"
                      >
                        إلغاء فلتر المكتب ({selectedOffice}) ✕
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSectionCard(null);
                        handleSelectSidebarSection('home');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#002855] hover:bg-[#003B73] text-white text-xs font-black transition-all cursor-pointer shadow-2xs"
                      title="العودة للصفحة الرئيسية"
                    >
                      <Home className="w-3.5 h-3.5 text-[#FDB813]" />
                      <span>الصفحة الرئيسية</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* ========================================================================= */}
            {/* TAB 1 (DEFAULT ON OPEN & REFRESH): الصفحة الرئيسية (Executive Overview) */}
            {/* ========================================================================= */}
            {normalizeSidebarSectionId(activeSidebarSection) === 'home' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <EnterpriseExecutiveDashboard
                  workOrders={ordersForKpi}
                  allWorkOrders={workOrders}
                  offices={offices}
                  monthTables={monthTables}
                  selectedOffice={selectedOffice}
                  onSelectOffice={(off) => setSelectedOffice(off)}
                  onNavigateSection={(sec) => handleSelectSidebarSection(sec)}
                  activeYear={activeYear}
                  activeMonth={activeMonth}
                  selectedTableId={selectedTableId}
                  onSelectPeriod={handleSelectPeriod}
                  onOpenYearMonthPicker={() => setIsYearMonthPickerOpen(true)}
                  onNavigateToOrderInTable={handleNavigateToOrderFromKpi}
                  onOpenCompletedAuditSection={() => {
                    handleSelectSidebarSection('audit_trail');
                    setAuditHubSubTab('completed_audit');
                  }}
                  onOpenArchive155Section={() => {
                    handleSelectSidebarSection('audit_trail');
                    setAuditHubSubTab('archive_155');
                  }}
                  completedAuditCount={auditTrackerSummary.fullyAuditedCount}
                  archive155Count={auditTrackerSummary.archive155Count}
                  activePeriodLabel={activePeriodLabel}
                  activeFilter={kpiFilter}
                  onSelectFilter={setKpiFilter}
                  currentUser={currentUser}
                  urgentCount={auditTrackerSummary.inProgressCount}
                  urgentDisqualifiedCount={auditTrackerSummary.disqualifiedCount}
                  urgentQualifiedCount={auditTrackerSummary.qualifiedCount}
                  onOpenAuditTrackerModal={() => setIsAuditTrackerModalOpen(true)}
                  onOpenNotesReport={() => handleOpenNotesReportFromGlobal('all')}
                  onOpenWeeklyReport={() => checkPermission('viewWeeklyReport', 'التقرير الأسبوعي للمكاتب الفرعية', () => setIsWeeklyReportModalOpen(true))}
                  onOpenOfficeComparison={() => checkPermission('viewOfficeComparison', 'مقارنة وتقييم أداء المكاتب الفرعية', () => setIsOfficeComparisonModalOpen(true))}
                  onOpenContractorComparison={() => checkPermission('viewContractorClosureReport', 'مقارنة المقاولين وإنجاز الإغلاقات', () => setIsContractorClosureReportOpen(true))}
                  onOpenComprehensiveReports={(mode) => checkPermission('viewComprehensiveReports', 'مركز التقارير الموحد (تفصيلية ومجمعة)', () => {
                    setComprehensiveReportsMode(mode || 'aggregated');
                    setIsComprehensiveReportsOpen(true);
                  })}
                  onOpenExportModal={(customOrders, customTitle, openEmail) => checkPermission('exportTable', 'تصدير بيانات لوحة المؤشرات', () => handleOpenMainExport(customOrders, customTitle, openEmail))}
                  onOpen155Guide={() => handleSelectSidebarSection('quality_ncr')}
                />
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: جدول أوامر العمل والتدقيق (Main Work Orders Table & Quick Strip) */}
            {/* ========================================================================= */}
            {normalizeSidebarSectionId(activeSidebarSection) === 'work_orders' && (
              <div className="flex flex-col h-[calc(100vh-105px)] min-h-[460px] animate-in fade-in duration-150">
                {/* Dynamic Corporate Control Deck Above the Table (تصميم الجزء فوق الجداول: قوائم التدقيق على أوامر العمل) */}
                {(() => {
                  const defaultTblId = getDefaultTableId(activeYear, activeMonth);
                  const periodCustomTables = monthTables.filter(
                    (t) => !isDefaultTableId(t.id) && !t.isDefault && isTableInPeriod(t, activeYear, activeMonth)
                  );

                  return (
                    <div className="bg-gradient-to-l from-[#001D40] via-[#002855] to-[#004B8D] rounded-2xl border-b-2 border-[#F58220] shadow-sm px-3 py-2 mb-1.5 flex items-center justify-between gap-2 flex-wrap font-['Cairo',sans-serif] text-white shrink-0">
                      {/* Right Section: Year + Month + Table Selectors + Dynamic Sub-Office Filter Pills */}
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {/* 1. Small Year Selector */}
                        <div className="relative inline-flex items-center shrink-0">
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-black cursor-pointer transition-colors">
                            <Calendar className="w-3.5 h-3.5 text-[#FDB813]" />
                            <select
                              value={activeYear}
                              onChange={(e) => {
                                const yr = parseInt(e.target.value, 10);
                                handleSelectPeriod(yr, activeMonth, 'default');
                              }}
                              className="bg-transparent text-white font-black text-xs cursor-pointer focus:outline-none appearance-none pr-1 pl-3.5"
                              title="اختر رقم السنة"
                            >
                              {[2024, 2025, 2026, 2027].map((yr) => (
                                <option key={yr} value={yr} className="bg-[#002855] text-white">
                                  {yr}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3 h-3 text-blue-200 pointer-events-none -mr-2.5" />
                          </div>
                        </div>

                        {/* 2. Small Month Selector */}
                        <div className="relative inline-flex items-center shrink-0">
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-black cursor-pointer transition-colors">
                            <Clock className="w-3.5 h-3.5 text-[#F58220]" />
                            <select
                              value={activeMonth}
                              onChange={(e) => {
                                const val = e.target.value;
                                const mn = val === 'all' ? 'all' : parseInt(val, 10);
                                handleSelectPeriod(activeYear, mn, 'default');
                              }}
                              className="bg-transparent text-white font-black text-xs cursor-pointer focus:outline-none appearance-none pr-1 pl-3.5"
                              title="اختر الشهر المطلوب"
                            >
                              <option value="all" className="bg-[#002855] text-white">كافة الشهور</option>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                <option key={m} value={m} className="bg-[#002855] text-white">
                                  {getArabicMonthName(m)}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3 h-3 text-blue-200 pointer-events-none -mr-2.5" />
                          </div>
                        </div>

                        {/* 3. Tables of the Selected Month */}
                        <div className="relative inline-flex items-center gap-1 shrink-0">
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-black cursor-pointer transition-colors">
                            <TableProperties className="w-3.5 h-3.5 text-emerald-400" />
                            <select
                              value={selectedTableId}
                              onChange={(e) => {
                                const newTblId = e.target.value;
                                setSelectedTableId(newTblId);
                                setIsTableCardOpen(true);
                              }}
                              className="bg-transparent text-white font-black text-xs cursor-pointer focus:outline-none appearance-none pr-1 pl-3.5 max-w-[150px] truncate"
                              title="الجداول الخاصة بالشهر المحدد"
                            >
                              <option value={defaultTblId} className="bg-[#002855] text-white">
                                الرئيسي {activeMonth !== 'all' ? `(${getArabicMonthName(activeMonth)})` : ''}
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
                                    !isTableInPeriod(t, activeYear, activeMonth)
                                )
                                .map((tbl) => (
                                  <option key={tbl.id} value={tbl.id} className="bg-[#001D40] text-blue-200">
                                    {tbl.name} ({getArabicMonthName(tbl.month)} {tbl.year})
                                  </option>
                                ))}
                            </select>
                            <ChevronDown className="w-3 h-3 text-blue-200 pointer-events-none -mr-2.5" />
                          </div>

                          <button
                            type="button"
                            onClick={() => setIsYearMonthPickerOpen(true)}
                            className="p-1.5 rounded-xl bg-[#F58220] hover:bg-[#d96b12] text-white text-xs font-black transition-colors cursor-pointer shrink-0 shadow-2xs"
                            title="إضافة جدول جديد لهذا الشهر أو إدارة الجداول"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* 4. Dynamic Sub-Office Selector Pills */}
                        <div className="hidden md:flex items-center gap-1 bg-white/10 p-0.5 rounded-xl border border-white/15">
                          <button
                            type="button"
                            onClick={() => setSelectedOffice('all')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                              selectedOffice === 'all'
                                ? 'bg-[#F58220] text-white shadow-2xs'
                                : 'text-blue-100 hover:bg-white/10'
                            }`}
                          >
                            كل المكاتب
                          </button>
                          {offices.map((off) => (
                            <button
                              key={off.id}
                              type="button"
                              onClick={() => setSelectedOffice(off.name)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                                selectedOffice === off.name
                                  ? 'bg-[#F58220] text-white shadow-2xs'
                                  : 'text-blue-100 hover:bg-white/10'
                              }`}
                            >
                              {off.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Left Section: Completed Audit & Archive 155 Quick Badges + Urgent Alert (Dark Red) + Return to Home */}
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectSidebarSection('audit_trail');
                            setAuditHubSubTab('completed_audit');
                          }}
                          className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white text-[11px] font-black border border-emerald-400/40 transition-all cursor-pointer"
                          title="قائمة أوامر العمل التي تم التدقيق عليها بالكامل"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-[#FDB813]" />
                          <span>تم التدقيق:</span>
                          <span className="font-mono">{auditTrackerSummary.fullyAuditedCount}</span>
                        </button>

                        {/* 1. أيقونة التنبيه العاجل (بلون أحمر غامق وكتابة بيضاء واضحة) */}
                        <button
                          type="button"
                          onClick={() => setIsAuditTrackerModalOpen(true)}
                          className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#7F1D1D] hover:bg-[#991B1B] text-white text-xs font-black shadow-sm cursor-pointer transition-all active:scale-95 border border-red-400/50 animate-urgent-shake"
                          title="قائمة التنبيه العاجل — أوامر العمل تحت التدقيق الجزئي"
                        >
                          <Bell className="w-3.5 h-3.5 text-[#FDB813] animate-[bounce_1.2s_infinite]" />
                          <span>التنبيه العاجل</span>
                          <span className="px-1.5 py-0.2 rounded-full bg-white text-[#7F1D1D] font-mono text-[10px] font-black shadow-xs">
                            {auditTrackerSummary.inProgressCount}
                          </span>
                        </button>

                        {/* 2. زر العودة للصفحة الرئيسية */}
                        <button
                          type="button"
                          onClick={() => handleSelectSidebarSection('home')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-black transition-all cursor-pointer active:scale-95"
                          title="العودة للصفحة الرئيسية"
                        >
                          <Home className="w-3.5 h-3.5 text-[#FDB813]" />
                          <span>الرئيسية</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* The Work Orders Table occupies full available viewport space */}
                <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
                  <WorkOrdersTable
                    orders={displayOrders}
                    allOrders={workOrders}
                    monthTables={monthTables}
                    presentationMode="docked"
                    onChangePresentationMode={setTablePresentationMode}
                    onCloseTable={() => handleSelectSidebarSection('home')}
                    officeTitle={selectedOffice === 'all' ? 'جميع المكاتب الفرعية' : selectedOffice}
                    offices={offices}
                    columns={columns}
                    dropdownOptions={dropdownOptions}
                    currentUser={currentUser}
                    onUpdateOrder={handleUpdateOrder}
                    onRequestAuth={(actionName, cb) => checkPermission('inlineTableEdit', actionName || 'تعديل بيانات الجدول', cb)}
                    onCheckPermission={checkPermission}
                    isSessionUnlockedState={isUnlocked}
                    onEdit={(order) => {
                      checkPermission('editWorkOrderStatus', 'تعديل حالة أمر العمل وملاحظات 155', () => {
                        setEditingOrder(order);
                        setIsEditModalOpen(true);
                      });
                    }}
                    onEditBasicData={(order) => {
                      checkPermission('editWorkOrderBasic', 'تعديل البيانات الأساسية لأمر العمل', () => {
                        setBasicEditingOrder(order);
                        setIsBasicEditModalOpen(true);
                      });
                    }}
                    onDelete={(id) => {
                      checkPermission('deleteWorkOrder', 'حذف أمر العمل', () => handleDeleteOrder(id));
                    }}
                    onDeleteBatch={(ids) => {
                      checkPermission('deleteWorkOrder', 'حذف أوامر العمل المحددة', () => handleDeleteBatch(ids));
                    }}
                    onViewPhotos={(order) => {
                      checkPermission('viewPhotos', 'استعراض الصور والمرفقات', () => {
                        setPhotoOrder(order);
                        setIsPhotoModalOpen(true);
                      });
                    }}
                    onAudit155={(order) => {
                      checkPermission('smartAudit', 'اعتماد وتدقيق معايير إجراء 155', () => {
                        setAuditOrder(order);
                        setIsAuditModalOpen(true);
                      });
                    }}
                    onOpenAddModal={() => checkPermission('addWorkOrder', 'إضافة أمر عمل جديد', () => setIsAddModalOpen(true))}
                    onOpenImportModal={() => checkPermission('importExcel', 'استيراد بيانات من Excel', () => setIsImportExcelModalOpen(true))}
                    onOpenCompatibleImport={() => checkPermission('importCompatibleTables', 'استيراد بيانات من الجداول المتوافقة بدلالة الأعمدة', () => setIsCompatibleImportModalOpen(true))}
                    onOpenColumnManager={handleOpenColumnManagerWithAuth}
                    onOpenDropdownManager={handleOpenDropdownManagerWithAuth}
                    onOpenExportModal={(customOrders, customTitle, openEmail) => checkPermission('exportTable', 'تصدير الجدول والتقارير', () => handleOpenMainExport(customOrders, customTitle, openEmail))}
                    onClearOfficeOrders={(office) => {
                      checkPermission('deleteMonthTable', 'حذف وتفريغ أوامر العمل للجدول', () => handleClearOfficeOrders(office));
                    }}
                    onClearAllOrders={() => {
                      checkPermission('clearData', 'حذف وتفريغ كامل الجدول', handleClearAllOrders);
                    }}
                    onFilteredOrdersChange={(filtered) => setTableFilteredOrders(filtered)}
                    onOpenDataRecovery={() => checkPermission('manageCloudBackups', 'مركز الأمان والنسخ الاحتياطية', () => setIsDataRecoveryModalOpen(true))}
                    activeTableName={activeTableName}
                    activeYear={activeYear}
                    activeMonth={activeMonth}
                    onOpenYearMonthPicker={() => setIsYearMonthPickerOpen(true)}
                    onOpenNotesReport={handleOpenNotesReportFromGlobal}
                    highlightedOrderId={highlightedOrderId}
                    onActiveAuditOrderChange={setActiveAuditingOrderId}
                  />
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: مؤشرات الأداء والقياس (KPIs) */}
            {/* ========================================================================= */}
            {normalizeSidebarSectionId(activeSidebarSection) === 'admin_dashboard' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <KPIDashboard
                  workOrders={ordersForKpi}
                  allWorkOrders={workOrders}
                  offices={offices}
                  activeFilter={kpiFilter}
                  onSelectFilter={(flt) => {
                    setKpiFilter(flt);
                  }}
                  selectedOffice={selectedOffice}
                  onSelectOffice={(off) => setSelectedOffice(off)}
                  onNavigateToTable={() => handleSelectSidebarSection('work_orders')}
                  onNavigateToOrderInTable={handleNavigateToOrderFromKpi}
                  onOpenAuditTrackerModal={() => setIsAuditTrackerModalOpen(true)}
                  urgentCount={auditTrackerSummary.inProgressCount}
                  urgentDisqualifiedCount={auditTrackerSummary.disqualifiedCount}
                  activePeriodLabel={activePeriodLabel}
                  activeYear={activeYear}
                  activeMonth={activeMonth}
                  selectedTableId={selectedTableId}
                  onSelectPeriod={handleSelectPeriod}
                  onOpenYearMonthPicker={() => setIsYearMonthPickerOpen(true)}
                  monthTables={monthTables}
                  currentUser={currentUser}
                  onOpenWeeklyReport={() => checkPermission('viewWeeklyReport', 'التقرير الأسبوعي للمكاتب الفرعية', () => setIsWeeklyReportModalOpen(true))}
                  onOpenOfficeComparison={() => checkPermission('viewOfficeComparison', 'مقارنة وتقييم أداء المكاتب الفرعية', () => setIsOfficeComparisonModalOpen(true))}
                  onOpenContractorComparison={() => checkPermission('viewContractorClosureReport', 'مقارنة المقاولين وإنجاز الإغلاقات', () => setIsContractorClosureReportOpen(true))}
                  onOpenComprehensiveReports={(mode) => checkPermission('viewComprehensiveReports', 'مركز التقارير الموحد (تفصيلية ومجمعة)', () => {
                    setComprehensiveReportsMode(mode || 'aggregated');
                    setIsComprehensiveReportsOpen(true);
                  })}
                  onOpenExportModal={(customOrders, customTitle, openEmail) => checkPermission('exportTable', 'تصدير بيانات لوحة المؤشرات', () => handleOpenMainExport(customOrders, customTitle, openEmail))}
                />
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: الدليل الإرشادي ومراحل التحقق (18 Verification Stages) */}
            {/* ========================================================================= */}
            {normalizeSidebarSectionId(activeSidebarSection) === 'quality_ncr' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <Procedure18GuideView
                  workOrders={workOrders}
                  offices={offices}
                  currentUser={currentUser}
                />
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 5: متابعة التدقيق، قائمة (تم التدقيق عليه)، وقائمة (ارشيف 155) */}
            {/* ========================================================================= */}
            {normalizeSidebarSectionId(activeSidebarSection) === 'audit_trail' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Top Summary & Action Header */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-l from-[#002855] via-[#003B73] to-[#004B8D] text-white p-4 sm:p-5 border-b-2 border-[#F58220] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-[#F58220] text-white flex items-center justify-center shadow-md shrink-0">
                        <ListChecks className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-black text-white">
                          متابعة التدقيق الثلاثي • قائمة ( تم التدقيق عليه ) • قائمة ( ارشيف 155 )
                        </h2>
                        <p className="text-xs text-blue-100 mt-0.5">
                          أي أمر عمل في قائمة (تم التدقيق عليه) يتم اختيار (تم الاجراء) له في عمود إجراء 155 يتم أرشفته فوراً في قائمة (ارشيف 155)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 4 Synchronized KPI Counters & Interactive List Selectors inside Audit Hub */}
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#F4F6F9]">
                    <div
                      onClick={() => setIsAuditTrackerModalOpen(true)}
                      className="bg-white rounded-xl p-4 border-2 border-amber-300 shadow-2xs cursor-pointer hover:border-[#F58220] transition-all flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-black text-amber-800 block">الأوامر تحت التدقيق الجزئي (تنبيه عاجل)</span>
                        <span className="text-[11px] text-slate-500 font-bold mt-0.5 block">بدأت المراجعة في إحدى الإدارات الثلاث</span>
                      </div>
                      <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 font-mono text-lg font-black">
                        {auditTrackerSummary.inProgressCount}
                      </span>
                    </div>

                    <div
                      onClick={() => setAuditHubSubTab('completed_audit')}
                      className={`rounded-xl p-4 border-2 shadow-2xs cursor-pointer transition-all flex items-center justify-between ${
                        auditHubSubTab === 'completed_audit'
                          ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/20'
                          : 'bg-white border-emerald-300 hover:border-emerald-500'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-black text-emerald-900 block">قائمة ( تم التدقيق عليه )</span>
                        <span className="text-[11px] text-slate-600 font-bold mt-0.5 block">مكتمل التدقيق وبانتظار (تم الاجراء) في 155</span>
                      </div>
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-mono text-lg font-black">
                        {auditTrackerSummary.filteredArchivedOrders.length}
                      </span>
                    </div>

                    <div
                      onClick={() => setAuditHubSubTab('archive_155')}
                      className={`rounded-xl p-4 border-2 shadow-2xs cursor-pointer transition-all flex items-center justify-between ${
                        auditHubSubTab === 'archive_155'
                          ? 'bg-indigo-50 border-indigo-700 ring-2 ring-indigo-500/20'
                          : 'bg-white border-indigo-300 hover:border-indigo-600'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-black text-indigo-950 block">قائمة ( ارشيف 155 )</span>
                        <span className="text-[11px] text-slate-600 font-bold mt-0.5 block">تم اختيار (تم الاجراء) في عمود إجراء 155</span>
                      </div>
                      <span className="px-3 py-1.5 rounded-xl bg-indigo-700 text-[#FDB813] font-mono text-lg font-black">
                        {auditTrackerSummary.filteredArchive155Orders.length}
                      </span>
                    </div>

                    <div
                      onClick={() => setIsAuditTrailModalOpen(true)}
                      className="bg-white rounded-xl p-4 border-2 border-blue-200 shadow-2xs cursor-pointer hover:border-[#004B8D] transition-all flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-black text-[#002855] block">سجل العمليات والتدقيق الموثق</span>
                        <span className="text-[11px] text-slate-500 font-bold mt-0.5 block">توثيق زمني لكافة التعديلات والاعتمادات</span>
                      </div>
                      <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-[#004B8D] font-mono text-xs font-black">
                        عرض السجل ←
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Table for either (تم التدقيق عليه) or (ارشيف 155) */}
                {auditHubSubTab === 'completed_audit' ? (
                  <div className="bg-white rounded-2xl border-2 border-emerald-600/30 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-gradient-to-l from-emerald-900 to-teal-900 text-white flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-[#FDB813]" />
                        <h3 className="text-sm font-black text-white">
                          قائمة ( تم التدقيق عليه ) — مؤهلة 100% وبانتظار (تم الاجراء) في عمود إجراء 155 للأرشفة الفورية
                        </h3>
                        <span className="px-2 py-0.5 rounded-md bg-white/20 text-white font-mono text-xs font-black">
                          {auditTrackerSummary.filteredArchivedOrders.length} أمر
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          checkPermission('exportTable', 'تصدير أوامر العمل المدققة', () =>
                            handleOpenMainExport(
                              auditTrackerSummary.filteredArchivedOrders,
                              'قائمة أوامر عمل تم التدقيق عليها'
                            )
                          )
                        }
                        className="px-3 py-1 rounded-lg bg-[#F58220] hover:bg-[#d96b12] text-white text-xs font-black cursor-pointer"
                      >
                        تصدير قائمة (تم التدقيق عليه)
                      </button>
                    </div>

                    <div className="p-2 sm:p-3">
                      <WorkOrdersTable
                        orders={auditTrackerSummary.filteredArchivedOrders}
                        allOrders={workOrders}
                        monthTables={monthTables}
                        presentationMode="docked"
                        officeTitle={
                          selectedOffice === 'all'
                            ? 'قائمة ( تم التدقيق عليه ) — جميع المكاتب'
                            : `قائمة ( تم التدقيق عليه ) — (${selectedOffice})`
                        }
                        offices={offices}
                        columns={columns}
                        dropdownOptions={dropdownOptions}
                        currentUser={currentUser}
                        onUpdateOrder={handleUpdateOrder}
                        onRequestAuth={(actionName, cb) => checkPermission('inlineTableEdit', actionName || 'تعديل بيانات الجدول', cb)}
                        onCheckPermission={checkPermission}
                        isSessionUnlockedState={isUnlocked}
                        onEdit={(order) => {
                          checkPermission('editWorkOrderStatus', 'تعديل حالة أمر العمل وملاحظات 155', () => {
                            setEditingOrder(order);
                            setIsEditModalOpen(true);
                          });
                        }}
                        onEditBasicData={(order) => {
                          checkPermission('editWorkOrderBasic', 'تعديل البيانات الأساسية لأمر العمل', () => {
                            setBasicEditingOrder(order);
                            setIsBasicEditModalOpen(true);
                          });
                        }}
                        onDelete={(id) => {
                          checkPermission('deleteWorkOrder', 'حذف أمر العمل', () => handleDeleteOrder(id));
                        }}
                        onDeleteBatch={(ids) => {
                          checkPermission('deleteWorkOrder', 'حذف أوامر العمل المحددة', () => handleDeleteBatch(ids));
                        }}
                        onViewPhotos={(order) => {
                          checkPermission('viewPhotos', 'استعراض الصور والمرفقات', () => {
                            setPhotoOrder(order);
                            setIsPhotoModalOpen(true);
                          });
                        }}
                        onAudit155={(order) => {
                          checkPermission('smartAudit', 'اعتماد وتدقيق معايير إجراء 155', () => {
                            setAuditOrder(order);
                            setIsAuditModalOpen(true);
                          });
                        }}
                        onOpenAddModal={() => checkPermission('addWorkOrder', 'إضافة أمر عمل جديد', () => setIsAddModalOpen(true))}
                        onOpenImportModal={() => checkPermission('importExcel', 'استيراد بيانات من Excel', () => setIsImportExcelModalOpen(true))}
                        onOpenCompatibleImport={() => checkPermission('importCompatibleTables', 'استيراد بيانات من الجداول المتوافقة بدلالة الأعمدة', () => setIsCompatibleImportModalOpen(true))}
                        onOpenColumnManager={handleOpenColumnManagerWithAuth}
                        onOpenDropdownManager={handleOpenDropdownManagerWithAuth}
                        onOpenExportModal={(customOrders, customTitle, openEmail) =>
                          checkPermission('exportTable', 'تصدير أوامر العمل المدققة', () =>
                            handleOpenMainExport(
                              customOrders || auditTrackerSummary.filteredArchivedOrders,
                              customTitle || 'قائمة تم التدقيق عليه',
                              openEmail
                            )
                          )
                        }
                        activeTableName="قائمة: تم التدقيق عليه"
                        activeYear={activeYear}
                        activeMonth={activeMonth}
                        onOpenYearMonthPicker={() => setIsYearMonthPickerOpen(true)}
                        onOpenNotesReport={handleOpenNotesReportFromGlobal}
                        highlightedOrderId={highlightedOrderId}
                        onActiveAuditOrderChange={setActiveAuditingOrderId}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border-2 border-[#002855]/40 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-gradient-to-l from-[#001D40] via-[#002855] to-[#004B8D] text-white flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#F58220]">
                      <div className="flex items-center gap-2">
                        <Archive className="w-5 h-5 text-[#FDB813]" />
                        <h3 className="text-sm font-black text-white">
                          قائمة ( ارشيف 155 ) — الأوامر المؤرشفة بعد اعتماد (تم الاجراء) في عمود إجراء 155
                        </h3>
                        <span className="px-2 py-0.5 rounded-md bg-[#F58220] text-white font-mono text-xs font-black">
                          {auditTrackerSummary.filteredArchive155Orders.length} أمر مؤرشف
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          checkPermission('exportTable', 'تصدير ارشيف 155', () =>
                            handleOpenMainExport(
                              auditTrackerSummary.filteredArchive155Orders,
                              'قائمة ارشيف 155 المعتمدة'
                            )
                          )
                        }
                        className="px-3 py-1 rounded-lg bg-[#F58220] hover:bg-[#d96b12] text-white text-xs font-black cursor-pointer"
                      >
                        تصدير قائمة (ارشيف 155)
                      </button>
                    </div>

                    <div className="p-2 sm:p-3">
                      <WorkOrdersTable
                        orders={auditTrackerSummary.filteredArchive155Orders}
                        allOrders={workOrders}
                        monthTables={monthTables}
                        presentationMode="docked"
                        officeTitle={
                          selectedOffice === 'all'
                            ? 'قائمة ( ارشيف 155 ) — جميع المكاتب'
                            : `قائمة ( ارشيف 155 ) — (${selectedOffice})`
                        }
                        offices={offices}
                        columns={columns}
                        dropdownOptions={dropdownOptions}
                        currentUser={currentUser}
                        onUpdateOrder={handleUpdateOrder}
                        onRequestAuth={(actionName, cb) => checkPermission('inlineTableEdit', actionName || 'تعديل بيانات الجدول', cb)}
                        onCheckPermission={checkPermission}
                        isSessionUnlockedState={isUnlocked}
                        onEdit={(order) => {
                          checkPermission('editWorkOrderStatus', 'تعديل حالة أمر العمل وملاحظات 155', () => {
                            setEditingOrder(order);
                            setIsEditModalOpen(true);
                          });
                        }}
                        onEditBasicData={(order) => {
                          checkPermission('editWorkOrderBasic', 'تعديل البيانات الأساسية لأمر العمل', () => {
                            setBasicEditingOrder(order);
                            setIsBasicEditModalOpen(true);
                          });
                        }}
                        onDelete={(id) => {
                          checkPermission('deleteWorkOrder', 'حذف أمر العمل', () => handleDeleteOrder(id));
                        }}
                        onDeleteBatch={(ids) => {
                          checkPermission('deleteWorkOrder', 'حذف أوامر العمل المحددة', () => handleDeleteBatch(ids));
                        }}
                        onViewPhotos={(order) => {
                          checkPermission('viewPhotos', 'استعراض الصور والمرفقات', () => {
                            setPhotoOrder(order);
                            setIsPhotoModalOpen(true);
                          });
                        }}
                        onAudit155={(order) => {
                          checkPermission('smartAudit', 'اعتماد وتدقيق معايير إجراء 155', () => {
                            setAuditOrder(order);
                            setIsAuditModalOpen(true);
                          });
                        }}
                        onOpenAddModal={() => checkPermission('addWorkOrder', 'إضافة أمر عمل جديد', () => setIsAddModalOpen(true))}
                        onOpenImportModal={() => checkPermission('importExcel', 'استيراد بيانات من Excel', () => setIsImportExcelModalOpen(true))}
                        onOpenCompatibleImport={() => checkPermission('importCompatibleTables', 'استيراد بيانات من الجداول المتوافقة بدلالة الأعمدة', () => setIsCompatibleImportModalOpen(true))}
                        onOpenColumnManager={handleOpenColumnManagerWithAuth}
                        onOpenDropdownManager={handleOpenDropdownManagerWithAuth}
                        onOpenExportModal={(customOrders, customTitle, openEmail) =>
                          checkPermission('exportTable', 'تصدير ارشيف 155', () =>
                            handleOpenMainExport(
                              customOrders || auditTrackerSummary.filteredArchive155Orders,
                              customTitle || 'قائمة ارشيف 155',
                              openEmail
                            )
                          )
                        }
                        activeTableName="قائمة: ارشيف 155"
                        activeYear={activeYear}
                        activeMonth={activeMonth}
                        onOpenYearMonthPicker={() => setIsYearMonthPickerOpen(true)}
                        onOpenNotesReport={handleOpenNotesReportFromGlobal}
                        highlightedOrderId={highlightedOrderId}
                        onActiveAuditOrderChange={setActiveAuditingOrderId}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 6: المكاتب الفرعية ومقارنة الأداء (Sub-Offices Management & Comparison) */}
            {/* ========================================================================= */}
            {normalizeSidebarSectionId(activeSidebarSection) === 'regions_dashboard' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <OfficeSelector
                  offices={offices}
                  selectedOffice={selectedOffice}
                  onSelectOffice={(off) => setSelectedOffice(off)}
                  workOrders={workOrders}
                  currentUser={currentUser}
                  onAddNewOffice={(newOff) => {
                    checkPermission('manageOffices', 'إضافة مكتب فرعي جديد', () => handleAddNewOffice(newOff));
                  }}
                  onUpdateOffice={(updated, oldName) => {
                    checkPermission('manageOffices', 'تعديل مكتب فرعي', () => handleUpdateOffice(updated, oldName));
                  }}
                  onDeleteOffice={(delId, delName, reassignTo) => {
                    checkPermission('manageOffices', 'حذف مكتب فرعي', () => handleDeleteOffice(delId, delName, reassignTo));
                  }}
                  onOpenManageOffices={() => {
                    checkPermission('manageOffices', 'إدارة المكاتب الفرعية', () => {
                      setOfficeToEditInModal(null);
                      setIsManageOfficesModalOpen(true);
                    });
                  }}
                  onOpenOfficeComparison={() => checkPermission('viewOfficeComparison', 'مقارنة وتقييم أداء المكاتب الفرعية', () => setIsOfficeComparisonModalOpen(true))}
                  onOpenManageContractors={() => {
                    checkPermission('manageContractors', 'إدارة وتوزيع مقاولي المكاتب', () => setIsManageContractorsModalOpen(true));
                  }}
                  defaultExpanded={true}
                />
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 7: المقاولون والاستشاريون (Merged Contractors & Consultants Hub) */}
            {/* ========================================================================= */}
            {normalizeSidebarSectionId(activeSidebarSection) === 'contractors' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Part 1: Contractors Closure & Evaluation */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-l from-[#002855] via-[#003B73] to-[#004B8D] text-white p-4 sm:p-5 border-b-2 border-[#F58220] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-[#F58220] text-white flex items-center justify-center shadow-md shrink-0">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-black text-white">أولاً: إدارة وتقييم المقاولين المعتمدين وإغلاقات 155</h2>
                        <p className="text-xs text-blue-100 mt-0.5">متابعة نسب إنجاز الإغلاقات وتوزيع المقاولين على المكاتب الفرعية ({allContractors.length} مقاول معتمد)</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => checkPermission('manageContractors', 'إدارة وتوزيع مقاولي المكاتب', () => setIsManageContractorsModalOpen(true))}
                        className="px-3.5 py-2 rounded-xl bg-[#F58220] hover:bg-[#d96b12] text-white text-xs font-black transition-all cursor-pointer shadow-xs"
                      >
                        إدارة وتوزيع المقاولين والاستشاريين
                      </button>
                      <button
                        type="button"
                        onClick={() => checkPermission('viewContractorClosureReport', 'مقارنة المقاولين وإنجاز الإغلاقات', () => setIsContractorClosureReportOpen(true))}
                        className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/25 text-xs font-black transition-all cursor-pointer"
                      >
                        تقرير إغلاقات المقاولين الدوري
                      </button>
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-[#F4F6F9]">
                    {allContractors.map((contractorName) => {
                      const cOrders = workOrders.filter((w) => w.contractor === contractorName);
                      const cReady = cOrders.filter((w) => {
                        const s = String(w.procedure155Status || '');
                        return !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم'));
                      }).length;
                      const cRate = cOrders.length > 0 ? Math.round((cReady / cOrders.length) * 100) : 0;
                      const assignedOffices = offices.filter((o) => o.contractors?.includes(contractorName)).map((o) => o.name);
                      return (
                        <div key={contractorName} className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between gap-3">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-black text-sm text-[#002855]">{contractorName}</h4>
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#004B8D] font-mono text-xs font-black shrink-0">{cOrders.length} أمر</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              المكاتب: {assignedOffices.length > 0 ? assignedOffices.join('، ') : 'جميع المكاتب'}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-emerald-700">مؤهل 155: {cReady}</span>
                              <span className="font-mono font-black text-[#002855]">{cRate}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-l from-[#10B981] to-[#004B8D] rounded-full" style={{ width: `${cRate}%` }} />
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleOpenNotesReportFromGlobal('all', contractorName)}
                                className="text-[11px] font-black text-rose-700 hover:underline cursor-pointer"
                              >
                                سجل الملاحظات
                              </button>
                              <button
                                type="button"
                                onClick={() => checkPermission('exportTable', 'تصدير أوامر المقاول', () => handleOpenMainExport(cOrders, `أوامر عمل المقاول - ${contractorName}`))}
                                className="text-[11px] font-black text-[#004B8D] hover:underline cursor-pointer"
                              >
                                تصدير الأوامر ({cOrders.length})
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Part 2: Engineering Consultants & Platform Audit Stages */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-l from-[#002855] via-[#003B73] to-[#004B8D] text-white p-4 sm:p-5 border-b-2 border-[#F58220] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-[#F58220] text-white flex items-center justify-center shadow-md shrink-0">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-black text-white">ثانياً: المكاتب الاستشارية ومعدلات التأهيل في إجراء 155</h2>
                        <p className="text-xs text-blue-100 mt-0.5">متابعة أوامر العمل المسندة لكل استشاري ونسب التأهيل الفعلية في أعمدة التدقيق بالمنصة</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-[#F4F6F9]">
                    {Array.from(new Set([
                      ...(dropdownOptions.consultant || []),
                      ...workOrders.map((w) => w.consultant).filter(Boolean) as string[]
                    ])).map((consultantName) => {
                      const cOrders = workOrders.filter((w) => w.consultant === consultantName);
                      const qualified155 = cOrders.filter((w) => {
                        const s = String(w.procedure155Status || '');
                        return !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم'));
                      }).length;
                      const attachReady = cOrders.filter((w) => {
                        const a = String(w.attachmentStatus || '');
                        return !a.includes('غير') && a.includes('جاهز');
                      }).length;
                      const rate = cOrders.length > 0 ? Math.round((qualified155 / cOrders.length) * 100) : 0;
                      return (
                        <div key={consultantName} className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between gap-3">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-black text-sm text-[#002855]">{consultantName}</h4>
                              <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-900 font-mono text-xs font-black shrink-0">{cOrders.length} أمر</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">مؤهل للإغلاق (155)</span>
                                <span className="font-mono font-black text-xs text-emerald-700">{qualified155}/{cOrders.length}</span>
                              </div>
                              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">جاهزية الإرفاق</span>
                                <span className="font-mono font-black text-xs text-[#004B8D]">{attachReady}/{cOrders.length}</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#F58220] rounded-full" style={{ width: `${rate}%` }} />
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                              <span className="text-[10.5px] font-bold text-slate-500">نسبة التأهيل: {rate}%</span>
                              <button
                                type="button"
                                onClick={() => checkPermission('exportTable', 'تصدير أوامر الاستشاري', () => handleOpenMainExport(cOrders, `أوامر عمل الاستشاري - ${consultantName}`))}
                                className="text-[11px] font-black text-[#004B8D] hover:underline cursor-pointer"
                              >
                                تصدير الأوامر ({cOrders.length})
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 8: الأرشيف السنوي وجداول الشهور (Year & Month Archive + Month Tables) */}
            {/* ========================================================================= */}
            {normalizeSidebarSectionId(activeSidebarSection) === 'calendar' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <MonthTablesBar
                  inlineMode={true}
                  activeYear={activeYear}
                  activeMonth={activeMonth}
                  onSelectPeriod={(y, m, tblId) => {
                    handleSelectPeriod(y, m, tblId);
                  }}
                  monthTables={monthTables}
                  selectedTableId={selectedTableId}
                  onSelectTable={(tblId) => {
                    setSelectedTableId(tblId);
                    handleSelectSidebarSection('work_orders');
                  }}
                  onClose={() => handleSelectSidebarSection('home')}
                  currentUser={currentUser}
                  onCreateTable={(name, description, color, targetYear, targetMonth) => {
                    return new Promise<any>((resolve) => {
                      const allowed = checkPermission('manageMonthTables', 'إنشاء جدول مستقل للشهر', async () => {
                        const res = await handleCreateMonthTable(name, description, color, targetYear, targetMonth);
                        resolve(res);
                      });
                      if (!allowed) resolve(undefined);
                    });
                  }}
                  onUpdateTable={async (tbl) => {
                    await handleUpdateMonthTable(tbl);
                  }}
                  onDeleteTable={async (tblId) => {
                    await handleDeleteMonthTable(tblId);
                  }}
                  onOpenYearMonthPicker={() => setIsYearMonthPickerOpen(true)}
                  onOpenImportForTable={(y, m, tblId) => {
                    handleSelectPeriod(y, m, tblId);
                    checkPermission('importExcel', 'استيراد بيانات من Excel للجدول', () => setIsImportExcelModalOpen(true));
                  }}
                  onOpenCompatibleImport={() => checkPermission('importCompatibleTables', 'استيراد بيانات من الجداول المتوافقة بدلالة الأعمدة', () => setIsCompatibleImportModalOpen(true))}
                  orders={selectedOffice === 'all' ? workOrders : workOrders.filter(w => w.office === selectedOffice)}
                />

                <YearMonthSections
                  orders={selectedOffice === 'all' ? workOrders : workOrders.filter(w => w.office === selectedOffice)}
                  monthTables={monthTables}
                  offices={offices}
                  activeYear={activeYear}
                  activeMonth={activeMonth}
                  currentUser={currentUser}
                  onSelectPeriod={(year, month) => handleSelectPeriod(year, month)}
                  onOpenYearMonthPicker={() => setIsYearMonthPickerOpen(true)}
                  onOpenExportForOrders={(scopedList, title, openEmail) => {
                    checkPermission('exportTable', 'تصدير بيانات الأرشيف', () => {
                      handleOpenMainExport(scopedList, title, Boolean(openEmail));
                    });
                  }}
                  archivedReports={archivedReports}
                  onSaveArchivedReport={(rep) => {
                    setArchivedReports(prev => [rep, ...prev.filter(r => r.id !== rep.id)]);
                  }}
                  onDeleteArchivedReport={async (id) => {
                    checkPermission('deleteMonthTable', 'حذف تقرير من الأرشيف', async () => {
                      setArchivedReports(prev => prev.filter(r => r.id !== id));
                      await realtime.deleteArchivedReport(id);
                    });
                  }}
                />
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 9: التقارير والملاحظات الميدانية (Official Reports & Field Notes Hub) */}
            {/* ========================================================================= */}
            {normalizeSidebarSectionId(activeSidebarSection) === 'visits' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-l from-[#002855] via-[#003B73] to-[#004B8D] text-white p-4 sm:p-5 border-b-2 border-[#F58220] flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-white">مركز التقارير المعتمدة، الزيارات، والملاحظات الميدانية المصورة</h2>
                      <p className="text-xs text-blue-100 mt-0.5">إصدار واستعراض التقارير الأسبوعية والشهرية وسجل الملاحظات الفنية المتكررة بالصور المرفقة</p>
                    </div>
                  </div>

                  {/* 5 Interactive Report Launch Cards */}
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-[#F4F6F9]">
                    <button
                      type="button"
                      onClick={() => checkPermission('viewComprehensiveReports', 'مركز التقارير الموحد (تفصيلية ومجمعة)', () => {
                        setComprehensiveReportsMode('aggregated');
                        setIsComprehensiveReportsOpen(true);
                      })}
                      className="bg-white hover:bg-blue-50/50 p-4 rounded-xl border border-slate-200 hover:border-[#004B8D] text-right transition-all cursor-pointer shadow-2xs flex flex-col justify-between gap-2"
                    >
                      <span className="font-black text-sm text-[#002855]">مركز التقارير الموحد</span>
                      <span className="text-[11px] text-slate-600">التقارير المجمعة والتفصيلية لكافة المكاتب</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => checkPermission('viewWeeklyReport', 'التقرير الأسبوعي للمكاتب الفرعية', () => setIsWeeklyReportModalOpen(true))}
                      className="bg-white hover:bg-blue-50/50 p-4 rounded-xl border border-slate-200 hover:border-[#004B8D] text-right transition-all cursor-pointer shadow-2xs flex flex-col justify-between gap-2"
                    >
                      <span className="font-black text-sm text-blue-800">التقرير الأسبوعي للمكاتب</span>
                      <span className="text-[11px] text-slate-600">متابعة نسب إنجاز المكاتب الفرعية أسبوعياً</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenNotesReportFromGlobal('all')}
                      className="bg-white hover:bg-rose-50/50 p-4 rounded-xl border border-slate-200 hover:border-rose-600 text-right transition-all cursor-pointer shadow-2xs flex flex-col justify-between gap-2"
                    >
                      <span className="font-black text-sm text-rose-800">سجل الملاحظات والصور</span>
                      <span className="text-[11px] text-slate-600">الملاحظات الفنية والملاحظات المتكررة بالصور</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => checkPermission('viewOfficeComparison', 'مقارنة وتقييم أداء المكاتب الفرعية', () => setIsOfficeComparisonModalOpen(true))}
                      className="bg-white hover:bg-emerald-50/50 p-4 rounded-xl border border-slate-200 hover:border-emerald-600 text-right transition-all cursor-pointer shadow-2xs flex flex-col justify-between gap-2"
                    >
                      <span className="font-black text-sm text-emerald-800">مقارنة أداء المكاتب</span>
                      <span className="text-[11px] text-slate-600">ترتيب ومؤشرات المكاتب الفرعية الأربعة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => checkPermission('viewContractorClosureReport', 'مقارنة المقاولين وإنجاز الإغلاقات', () => setIsContractorClosureReportOpen(true))}
                      className="bg-white hover:bg-amber-50/50 p-4 rounded-xl border border-slate-200 hover:border-[#F58220] text-right transition-all cursor-pointer shadow-2xs flex flex-col justify-between gap-2"
                    >
                      <span className="font-black text-sm text-[#D96B12]">تقارير إغلاقات المقاولين</span>
                      <span className="text-[11px] text-slate-600">تحليل نسب الإغلاق الدوري لكل مقاول</span>
                    </button>
                  </div>
                </div>

                {/* Live Table of Work Orders with Field Notes or Photos */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-[#002855] text-white flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#F58220]" />
                      <h3 className="text-xs sm:text-sm font-black">
                        سجل أوامر العمل المحتوية على ملاحظات فنية أو توثيق فوتوغرافي ميداني
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenNotesReportFromGlobal('all')}
                      className="px-3 py-1 rounded-lg bg-[#F58220] hover:bg-[#d96b12] text-white text-xs font-black cursor-pointer"
                    >
                      تصدير سجل الملاحظات والصور
                    </button>
                  </div>

                  <div className="p-3 overflow-x-auto">
                    {(() => {
                      const notedOrders = (selectedOffice === 'all' ? workOrders : workOrders.filter(w => w.office === selectedOffice)).filter(
                        (w) => (w.qualityNotes && w.qualityNotes.trim().length > 0) || (w.photos && w.photos.length > 0)
                      );
                      if (notedOrders.length === 0) {
                        return (
                          <div className="py-10 text-center text-xs font-bold text-slate-500">
                            لا توجد ملاحظات مسجلة حالياً في هذا النطاق — يمكنك إضافة ملاحظات أو صور مباشرة من جدول أوامر العمل.
                          </div>
                        );
                      }
                      return (
                        <table className="w-full text-right text-xs border-separate border-spacing-0 border border-slate-300 rounded-xl overflow-hidden shadow-xs tabular-nums">
                          <thead className="bg-[#002855] text-white font-black border-b-2 border-[#F58220]">
                            <tr>
                              <th className="p-2.5 border-b-2 border-[#F58220] border-r border-blue-800/70 bg-[#001D40] text-center w-12 text-[#FDB813] font-mono">#</th>
                              <th className="p-2.5 border-b-2 border-[#F58220] border-r border-blue-800/70">رقم أمر العمل</th>
                              <th className="p-2.5 border-b-2 border-[#F58220] border-r border-blue-800/70">الرمز</th>
                              <th className="p-2.5 border-b-2 border-[#F58220] border-r border-blue-800/70">المكتب</th>
                              <th className="p-2.5 border-b-2 border-[#F58220] border-r border-blue-800/70">المقاول</th>
                              <th className="p-2.5 border-b-2 border-[#F58220] border-r border-blue-800/70">ملاحظات الجودة (155)</th>
                              <th className="p-2.5 border-b-2 border-[#F58220] border-r border-blue-800/70 text-center">الصور</th>
                              <th className="p-2.5 border-b-2 border-[#F58220] bg-[#001D40] text-center">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {notedOrders.slice(0, 50).map((ord, idx) => (
                              <tr key={ord.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/85'} hover:bg-blue-50/50 transition-colors`}>
                                <td className="p-2.5 border-b border-r border-slate-200 text-center font-mono font-black text-slate-700 bg-slate-100/80">{idx + 1}</td>
                                <td className="p-2.5 border-b border-r border-slate-200 font-mono font-black text-[#002855]">{ord.workOrderNumber}</td>
                                <td className="p-2.5 border-b border-r border-slate-200 font-mono font-bold text-slate-600">{ord.workOrderCode || '-'}</td>
                                <td className="p-2.5 border-b border-r border-slate-200 font-bold text-slate-800">{ord.office}</td>
                                <td className="p-2.5 border-b border-r border-slate-200 font-bold text-slate-700">{ord.contractor}</td>
                                <td className="p-2.5 border-b border-r border-slate-200 text-slate-700 max-w-md truncate font-bold">{ord.qualityNotes || 'توثيق صوري مرفق'}</td>
                                <td className="p-2.5 border-b border-r border-slate-200 text-center font-mono font-black text-emerald-700">
                                  {ord.photos?.length || 0}
                                </td>
                                <td className="p-2.5 border-b border-slate-200 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        checkPermission('viewPhotos', 'استعراض الصور والمرفقات', () => {
                                          setPhotoOrder(ord);
                                          setIsPhotoModalOpen(true);
                                        });
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-200 text-[10.5px] font-black cursor-pointer transition-colors"
                                    >
                                      الصور
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        checkPermission('editWorkOrderStatus', 'تعديل حالة أمر العمل وملاحظات 155', () => {
                                          setEditingOrder(ord);
                                          setIsEditModalOpen(true);
                                        });
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-[#004B8D] text-[#004B8D] hover:text-white border border-blue-200 text-[10.5px] font-black cursor-pointer transition-colors"
                                    >
                                      تعديل
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 10: الاستيراد والتصدير والنسخ الاحتياطي (Import, Export & Cloud Backup Hub) */}
            {/* ========================================================================= */}
            {normalizeSidebarSectionId(activeSidebarSection) === 'documents' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-l from-[#002855] via-[#003B73] to-[#004B8D] text-white p-4 sm:p-5 border-b-2 border-[#F58220] flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-white">مركز الاستيراد والتصدير والخزنة السحابية والنسخ الاحتياطية</h2>
                      <p className="text-xs text-blue-100 mt-0.5">إدراج أوامر العمل من ملفات Excel، الاستيراد المتوافق بدلالة الأعمدة، التصدير المعتمد، واسترجاع النسخ الاحتياطية</p>
                    </div>
                  </div>

                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#F4F6F9]">
                    <button
                      type="button"
                      onClick={() => checkPermission('importExcel', 'استيراد بيانات من Excel', () => setIsImportExcelModalOpen(true))}
                      className="bg-white hover:bg-emerald-50/50 p-4 rounded-xl border border-slate-200 hover:border-emerald-600 text-right transition-all cursor-pointer shadow-2xs flex flex-col justify-between gap-2"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-[#002855]">استيراد من ملف Excel</h4>
                        <p className="text-xs text-slate-600 mt-1">إدراج أوامر العمل في الجدول الأساسي أو في جدول مستقل للشهر</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => checkPermission('importCompatibleTables', 'استيراد من الجداول المتوافقة بدلالة الأعمدة', () => setIsCompatibleImportModalOpen(true))}
                      className="bg-white hover:bg-blue-50/50 p-4 rounded-xl border border-slate-200 hover:border-[#004B8D] text-right transition-all cursor-pointer shadow-2xs flex flex-col justify-between gap-2"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#004B8D] text-white flex items-center justify-center">
                        <TableProperties className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-[#002855]">الاستيراد الذكي المتوافق</h4>
                        <p className="text-xs text-slate-600 mt-1">دمج واستيراد البيانات من الجداول المتوافقة بدلالة الأعمدة</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => checkPermission('exportTable', 'تصدير الجدول والتقارير', () => handleOpenMainExport())}
                      className="bg-white hover:bg-indigo-50/50 p-4 rounded-xl border border-slate-200 hover:border-indigo-600 text-right transition-all cursor-pointer shadow-2xs flex flex-col justify-between gap-2"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-[#002855]">تصدير التقارير والجداول</h4>
                        <p className="text-xs text-slate-600 mt-1">تصدير رسمي بصيغ Excel • PDF • Word • CSV ومشاركة البريد</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => checkPermission('manageCloudBackups', 'مركز الأمان والنسخ الاحتياطية', () => setIsDataRecoveryModalOpen(true))}
                      className="bg-white hover:bg-amber-50/50 p-4 rounded-xl border border-slate-200 hover:border-[#F58220] text-right transition-all cursor-pointer shadow-2xs flex flex-col justify-between gap-2"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#F58220] text-white flex items-center justify-center">
                        <Archive className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-[#002855]">الخزنة السحابية والنسخ الاحتياطي</h4>
                        <p className="text-xs text-slate-600 mt-1">استيراد وتصدير ملفات النسخ الاحتياطية الكاملة (.json / .gz)</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 11: إعدادات النظام والصلاحيات (System Settings, Permissions & Columns) */}
            {/* ========================================================================= */}
            {normalizeSidebarSectionId(activeSidebarSection) === 'settings' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-l from-[#002855] via-[#003B73] to-[#004B8D] text-white p-4 sm:p-5 border-b-2 border-[#F58220]">
                    <h2 className="text-base sm:text-lg font-black text-white">مركز إعدادات النظام والحوكمة والصلاحيات — إجراء 155</h2>
                    <p className="text-xs text-blue-100 mt-0.5">التحكم في حسابات المستخدمين، الصلاحيات، هيكلة الأعمدة، القوائم المنسدلة، والنسخ الاحتياطية السحابية</p>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-[#F4F6F9]">
                    <button
                      type="button"
                      onClick={handleOpenPermissionsManager}
                      className="bg-white hover:bg-blue-50/50 p-4 rounded-xl border border-slate-200 hover:border-[#004B8D] text-right transition-all cursor-pointer shadow-2xs flex items-start gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#002855] text-[#F58220] flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-[#002855]">المستخدمون والصلاحيات ({users.length})</h4>
                        <p className="text-xs text-slate-600 mt-1">إنشاء وتعديل حسابات المستفيدين وتخصيص الصلاحيات</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => checkPermission('manageColumns', 'إدارة هيكلة الأعمدة', () => setIsColumnManagerOpen(true))}
                      className="bg-white hover:bg-blue-50/50 p-4 rounded-xl border border-slate-200 hover:border-[#004B8D] text-right transition-all cursor-pointer shadow-2xs flex items-start gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#004B8D] text-white flex items-center justify-center shrink-0">
                        <TableProperties className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-[#002855]">هيكلة ومسميات الأعمدة ({columns.length})</h4>
                        <p className="text-xs text-slate-600 mt-1">ترتيب وتخصيص وإضافة أعمدة جدول أوامر العمل</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => checkPermission('manageDropdowns', 'إدارة القوائم المنسدلة', () => setIsDropdownManagerOpen(true))}
                      className="bg-white hover:bg-blue-50/50 p-4 rounded-xl border border-slate-200 hover:border-[#004B8D] text-right transition-all cursor-pointer shadow-2xs flex items-start gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                        <ListChecks className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-[#002855]">إدارة القوائم المنسدلة</h4>
                        <p className="text-xs text-slate-600 mt-1">تحديث خيارات الخلايا المنسدلة وحالات التدقيق</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => checkPermission('manageCloudBackups', 'مركز الأمان والنسخ الاحتياطية', () => setIsDataRecoveryModalOpen(true))}
                      className="bg-white hover:bg-blue-50/50 p-4 rounded-xl border border-slate-200 hover:border-[#004B8D] text-right transition-all cursor-pointer shadow-2xs flex items-start gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#F58220] text-white flex items-center justify-center shrink-0">
                        <Archive className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-[#002855]">الخزنة السحابية واستيراد النسخ الاحتياطية</h4>
                        <p className="text-xs text-slate-600 mt-1">تصدير واستيراد ملفات النسخ الاحتياطية الكاملة (.json / .gz / .zip)</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => checkPermission('manageOffices', 'إدارة المكاتب الفرعية', () => setIsManageOfficesModalOpen(true))}
                      className="bg-white hover:bg-blue-50/50 p-4 rounded-xl border border-slate-200 hover:border-[#004B8D] text-right transition-all cursor-pointer shadow-2xs flex items-start gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-700 text-white flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-[#002855]">إدارة المكاتب الفرعية ({offices.length})</h4>
                        <p className="text-xs text-slate-600 mt-1">تعديل وإضافة المكاتب الفرعية وتوزيع المقاولين</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => checkPermission('manageNotifications', 'إعدادات الإشعارات الفورية', () => setIsNotificationModalOpen(true))}
                      className="bg-white hover:bg-blue-50/50 p-4 rounded-xl border border-slate-200 hover:border-[#004B8D] text-right transition-all cursor-pointer shadow-2xs flex items-start gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-[#002855]">مركز الإشعارات والتنبيهات الفورية</h4>
                        <p className="text-xs text-slate-600 mt-1">إدارة تنبيهات المتصفح والبريد الإلكتروني</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      </div>

      {/* Fixed Bottom Bar: Small Labels All on the Left Side of the Bar */}
      <footer
        className={`fixed bottom-0 left-0 ${
          isSidebarOpen ? 'lg:right-72 xl:right-76' : 'right-0'
        } z-30 bg-[#001D40]/95 backdrop-blur-md border-t border-[#003B73] py-1.5 px-4 sm:px-6 shadow-[0_-4px_20px_rgba(0,29,64,0.35)] select-none transition-all duration-300 font-['Cairo',sans-serif]`}
      >
        <div className="w-full mx-auto flex items-center justify-end gap-2.5 sm:gap-3 text-[10px] sm:text-[11px]">
          <span className="font-bold text-slate-300">
            حقوق الملكية محفوظة
          </span>
          <span className="text-[#F58220] font-bold">•</span>
          <span className="font-black text-white tracking-wide">
            منصة حوكمة جودة أعمال الإنشاءات
          </span>
        </div>
      </footer>

      <React.Suspense fallback={null}>
      {/* 1. Modal: إضافة أمر عمل */}
      {isAddModalOpen && (
        <AddWorkOrderModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddOrder}
          offices={offices}
          defaultOffice={selectedOffice}
          dropdownOptions={dropdownOptions}
          onUpdateOfficeContractors={handleUpdateOfficeContractors}
          onAddContractor={handleAddContractorToOffice}
          onDeleteContractor={handleDeleteContractorFromOffice}
          onUpdateOfficeConsultants={handleUpdateOfficeConsultants}
          onAddConsultant={handleAddConsultantToOffice}
          onDeleteConsultant={handleDeleteConsultantFromOffice}
          activeYear={activeYear}
          activeMonth={activeMonth}
          selectedTableId={selectedTableId}
          monthTables={monthTables}
          existingOrders={workOrders}
          onNavigateToExistingOrder={handleNavigateToConflictOrder}
        />
      )}

      {/* 1.5 Modal: نافذة تحديد السنة والشهر وإدراج الجداول المستقلة دون أي تداخل */}
      {isYearMonthPickerOpen && (
        <YearMonthPickerModal
          isOpen={isYearMonthPickerOpen}
          onClose={() => setIsYearMonthPickerOpen(false)}
          activeYear={activeYear}
          activeMonth={activeMonth}
          selectedTableId={selectedTableId}
          monthTables={monthTables}
          workOrders={workOrders}
          orders={workOrders}
          onSelectYearMonthTable={(year, month, tableId) => {
            handleSelectPeriod(year, month, tableId);
            setActiveViewTab('table');
          }}
          onCreateTableInYearMonth={async (year, month, name, description, color) => {
            return new Promise((resolve) => {
              const allowed = checkPermission('manageMonthTables', 'إنشاء جدول مستقل للشهر', async () => {
                const created = await handleCreateMonthTable(name, description, color, year, month);
                setActiveViewTab('table');
                resolve(created);
              });
              if (!allowed) resolve(undefined);
            });
          }}
          onOpenImportForYearMonth={(year, month, tableId) => {
            checkPermission('importExcel', 'استيراد بيانات من Excel', () => {
              handleSelectPeriod(year, month, tableId);
              setActiveViewTab('table');
              setIsImportExcelModalOpen(true);
            });
          }}
          onOpenAddOrderForYearMonth={(year, month, tableId) => {
            checkPermission('addWorkOrder', 'إضافة أمر عمل جديد', () => {
              handleSelectPeriod(year, month, tableId);
              setActiveViewTab('table');
              setIsAddModalOpen(true);
            });
          }}
        />
      )}

      {/* 2. Modal: البحث المتقدم */}
      {isSearchModalOpen && (
        <SearchModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          workOrders={workOrders}
          onEdit={(order) => {
            checkPermission('editWorkOrderStatus', 'تعديل حالة أمر العمل', () => {
              setEditingOrder(order);
              setIsEditModalOpen(true);
            });
          }}
          onDelete={(id) => checkPermission('deleteWorkOrder', 'حذف أمر العمل', () => handleDeleteOrder(id))}
          onDeleteBatch={(ids) => checkPermission('deleteWorkOrder', 'حذف أوامر العمل المحددة', () => handleDeleteBatch(ids))}
          onExportSearchResults={(results, customTitle, openEmail) => checkPermission('exportTable', 'تصدير نتائج البحث', () => handleExportSearchResults(results, customTitle, openEmail))}
          onViewPhotos={(order) => {
            checkPermission('viewPhotos', 'معاينة وتوثيق صور أمر العمل', () => {
              setPhotoOrder(order);
              setIsPhotoModalOpen(true);
            });
          }}
        />
      )}

      {/* 3. Modal: تعديل أمر العمل */}
      {isEditModalOpen && (
        <EditWorkOrderModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingOrder(null);
          }}
          order={editingOrder}
          onSave={handleUpdateOrder}
          offices={offices}
          onDelete={handleDeleteOrder}
          dropdownOptions={dropdownOptions}
          onUpdateOfficeContractors={handleUpdateOfficeContractors}
          onAddContractor={handleAddContractorToOffice}
          onDeleteContractor={handleDeleteContractorFromOffice}
          onUpdateOfficeConsultants={handleUpdateOfficeConsultants}
          onAddConsultant={handleAddConsultantToOffice}
          onDeleteConsultant={handleDeleteConsultantFromOffice}
        />
      )}

      {/* 3.1 Modal: تعديل بيانات أمر العمل الأساسية */}
      {isBasicEditModalOpen && (
        <EditBasicWorkOrderModal
          isOpen={isBasicEditModalOpen}
          onClose={() => {
            setIsBasicEditModalOpen(false);
            setBasicEditingOrder(null);
          }}
          order={basicEditingOrder}
          onSave={handleSaveBasicOrder}
          offices={offices}
          dropdownOptions={dropdownOptions}
          onUpdateOfficeContractors={handleUpdateOfficeContractors}
          onAddContractor={handleAddContractorToOffice}
          onDeleteContractor={handleDeleteContractorFromOffice}
          onUpdateOfficeConsultants={handleUpdateOfficeConsultants}
          onAddConsultant={handleAddConsultantToOffice}
          onDeleteConsultant={handleDeleteConsultantFromOffice}
        />
      )}

      {/* 3.2 Modal: استيراد بيانات من ملف Excel */}
      {isImportExcelModalOpen && (
        <ImportExcelModal
          isOpen={isImportExcelModalOpen}
          onClose={() => setIsImportExcelModalOpen(false)}
          onImportSuccess={handleImportExcelSuccess}
          monthTables={monthTables}
          selectedTableId={selectedTableId}
          activeYear={activeYear}
          activeMonth={activeMonth}
          columns={columns}
          dropdownOptions={dropdownOptions}
          allPlatformOrders={workOrders}
          onNavigateToExistingOrder={handleNavigateToConflictOrder}
        />
      )}

      {/* 3.3 Modal: استيراد البيانات من الجداول المتوافقة */}
      {isCompatibleImportModalOpen && (
        <CompatibleTableImportModal
          isOpen={isCompatibleImportModalOpen}
          onClose={() => setIsCompatibleImportModalOpen(false)}
          currentTableId={selectedTableId}
          currentTableName={activeTableName}
          currentOrders={displayOrders}
          allPlatformOrders={workOrders}
          monthTables={monthTables}
          columns={columns}
          dropdownOptions={dropdownOptions}
          onExecuteImport={handleExecuteCompatibleImport}
        />
      )}

      {/* 3.4 Modal: رسالة منبثقة لرفض إضافة أو استيراد أمر عمل موجود مسبقاً */}
      {duplicateAlertState.isOpen && (
        <DuplicateWorkOrderAlertModal
          isOpen={duplicateAlertState.isOpen}
          onClose={() => setDuplicateAlertState(prev => ({ ...prev, isOpen: false }))}
          conflicts={duplicateAlertState.conflicts}
          sourceLabel={duplicateAlertState.sourceLabel}
          acceptedCount={duplicateAlertState.acceptedCount}
          onNavigateAndOpenOrder={handleNavigateToConflictOrder}
        />
      )}

      {/* 4. Modal: التصدير التكييفي الذكي مع معاينة قبل التصدير */}
      {isExportModalOpen && (
        <ExportPreviewModal
          isOpen={isExportModalOpen}
          onClose={() => {
            setIsExportModalOpen(false);
            setExportCustomOrders(null);
            setExportCustomTitle('');
            setIsEmailExportInitiallyOpen(false);
          }}
          orders={exportCustomOrders || (tableFilteredOrders.length > 0 && tableFilteredOrders.length < displayOrders.length ? tableFilteredOrders : displayOrders)}
          allOrders={displayOrders}
          filteredOrders={exportCustomOrders || (tableFilteredOrders.length > 0 ? tableFilteredOrders : displayOrders)}
          officeTitle={exportCustomTitle || (selectedOffice === 'all' ? 'كافة المكاتب' : selectedOffice)}
          columns={columns}
          users={users}
          currentUser={currentUser}
          initialOpenEmail={isEmailExportInitiallyOpen}
        />
      )}

      {/* 5. Modal: معرض توثيق الصور */}
      {isPhotoModalOpen && (
        <PhotoGalleryModal
          isOpen={isPhotoModalOpen}
          onClose={() => {
            setIsPhotoModalOpen(false);
            setPhotoOrder(null);
          }}
          order={photoOrder}
          onUpdatePhotos={handleUpdatePhotos}
        />
      )}

      {/* 6. Modal: تدقيق وفحص معايير إجراء 155 */}
      {isAuditModalOpen && (
        <Procedure155DetailsModal
          isOpen={isAuditModalOpen}
          onClose={() => {
            setIsAuditModalOpen(false);
            setAuditOrder(null);
          }}
          order={auditOrder}
          onUpdateStatus={handleUpdate155Status}
        />
      )}

      {/* 7. Modal: PIN Authentication Modal */}
      {isPinModalOpen && (
        <PinAuthModal
          isOpen={isPinModalOpen}
          onClose={() => {
            setIsPinModalOpen(false);
            setPinAction(null);
            setPendingAuthAction(null);
            setPendingUndoOrders(null);
          }}
          onSuccess={handlePinSuccess}
          title={
            pinAction === 'dropdown'
              ? 'التحقق للوصول إلى إدارة القوائم المنسدلة'
              : pinAction === 'columns'
              ? 'التحقق للوصول إلى هيكلة ومسميات الأعمدة'
              : pinAction === 'reset'
              ? 'التحقق لاستعادة البيانات النموذجية'
              : pinAction === 'undo'
              ? 'تأكيد التراجع واستعادة البيانات المحذوفة'
              : pinAuthTitle || 'التحقق الأمني للعمليات المحمية'
          }
          subtitle={
            pinAction === 'dropdown'
              ? 'أدخل الرمز السري المخفي بالرموز لتعديل أو إضافة أو حذف أسطر القوائم المنسدلة لخلايا أعمدة الجدول.'
              : pinAction === 'columns'
              ? 'أدخل الرمز السري المخفي بالرموز لتعديل مسميات الأعمدة أو إضافة وحذف أعمدة الجدول وقوائمها المنسدلة.'
              : pinAction === 'reset'
              ? 'عملية استعادة وإعادة تعيين البيانات النموذجية محمية برمز الأمان. أدخل الرمز السري المصرح به للمتابعة.'
              : pinAction === 'undo'
              ? 'عملية التراجع واستعادة البيانات المحذوفة محمية برمز الأمان. أدخل الرمز السري المصرح به لإتمام الاسترجاع.'
              : pinAuthSubtitle || 'أدخل الرمز السري المصرح به لتفعيل أدوات المنظومة (عمود حالة أمر العمل متاح للجميع دون قفل).'
          }
        />
      )}

      {/* 8. Modal: Dropdown Manager Modal */}
      {isDropdownManagerOpen && (
        <DropdownManagerModal
          isOpen={isDropdownManagerOpen}
          onClose={() => {
            setIsDropdownManagerOpen(false);
            setSelectedDropdownKeyForEditor(undefined);
          }}
          columns={columns}
          dropdownOptions={dropdownOptions}
          onSaveOptions={handleSaveDropdownOptions}
          initialSelectedColumnKey={selectedDropdownKeyForEditor}
        />
      )}

      {/* 9. Modal: Column Manager Modal */}
      {isColumnManagerOpen && (
        <ColumnManagerModal
          isOpen={isColumnManagerOpen}
          onClose={() => setIsColumnManagerOpen(false)}
          columns={columns}
          dropdownOptions={dropdownOptions}
          onSaveColumns={handleSaveColumns}
          onOpenDropdownEditorForColumn={(dropdownKey) => {
            setIsColumnManagerOpen(false);
            setSelectedDropdownKeyForEditor(dropdownKey);
            setIsDropdownManagerOpen(true);
          }}
        />
      )}

      {/* 10. Modal: Clear & Radical Delete Data Modal */}
      {isClearDataModalOpen && (
        <ClearDataModal
          isOpen={isClearDataModalOpen}
          onClose={() => setIsClearDataModalOpen(false)}
          offices={offices}
          selectedOffice={selectedOffice}
          totalOrdersCount={workOrders.length}
          onClearOfficeOrders={handleClearOfficeOrders}
          onClearAllOrders={handleClearAllOrders}
          onResetToInitial={handleResetData}
          onDeleteOffice={handleDeleteOffice}
        />
      )}

      {/* 12. Modal: التقرير الأسبوعي لإنجازات المكاتب الفرعية */}
      {isWeeklyReportModalOpen && (
        <WeeklyReportModal
          isOpen={isWeeklyReportModalOpen}
          onClose={() => setIsWeeklyReportModalOpen(false)}
          workOrders={workOrders}
          offices={offices}
          selectedOffice={selectedOffice}
          onSelectOffice={(off) => setSelectedOffice(off)}
          onOpenExportModal={(customOrders, customTitle, openEmail) => checkPermission('exportTable', 'تصدير التقرير الأسبوعي', () => handleOpenMainExport(customOrders, customTitle, openEmail))}
        />
      )}

      {/* 13. Modal: مقارنة وتقييم أداء المكاتب الفرعية */}
      {isOfficeComparisonModalOpen && (
        <OfficePerformanceComparisonModal
          isOpen={isOfficeComparisonModalOpen}
          onClose={() => setIsOfficeComparisonModalOpen(false)}
          workOrders={workOrders}
          offices={offices}
          columns={columns}
          onSelectOfficeAndFilter={(officeName) => {
            setSelectedOffice(officeName);
            handleSelectSidebarSection('work_orders');
            showNotification(`تمت تصفية الجدول لعرض أوامر مكتب: ${officeName}`, 'update');
          }}
          onOpenWeeklyReport={() => {
            setIsWeeklyReportModalOpen(true);
          }}
          onOpenExportOrders={(customOrders, customTitle, openEmail) => {
            checkPermission('exportTable', 'تصدير مقارنة المكاتب الفرعية', () => handleOpenMainExport(customOrders, customTitle, Boolean(openEmail)));
          }}
        />
      )}

      {/* 14. Modal: إدارة وتعديل وإضافة وحذف المكاتب الفرعية */}
      {isManageOfficesModalOpen && (
        <ManageOfficesModal
          isOpen={isManageOfficesModalOpen}
          onClose={() => {
            setIsManageOfficesModalOpen(false);
            setOfficeToEditInModal(null);
          }}
          offices={offices}
          workOrders={workOrders}
          onAddNewOffice={handleAddNewOffice}
          onUpdateOffice={handleUpdateOffice}
          onDeleteOffice={handleDeleteOffice}
          initialOfficeToEdit={officeToEditInModal}
        />
      )}

      {/* 15. Modal: إدارة وتوزيع مقاولي المكاتب الفرعية */}
      {isManageContractorsModalOpen && (
        <ManageContractorsModal
          isOpen={isManageContractorsModalOpen}
          onClose={() => setIsManageContractorsModalOpen(false)}
          offices={offices}
          dropdownOptions={dropdownOptions}
          onUpdateOfficeContractors={handleUpdateOfficeContractors}
          onUpdateOfficeConsultants={handleUpdateOfficeConsultants}
          selectedOfficeDefault={selectedOffice}
        />
      )}

      {/* 16. Modal: مركز الأمان السحابي واستعادة البيانات والنسخ الاحتياطية الفورية */}
      {isDataRecoveryModalOpen && (
        <DataRecoveryModal
          isOpen={isDataRecoveryModalOpen}
          onClose={() => setIsDataRecoveryModalOpen(false)}
          currentOrdersCount={workOrders.length}
          onRestoreCompleted={() => {
            hasAutoFocusedPopulatedViewRef.current = false;
            setSelectedOffice('all');
            setKpiFilter('all');
            setActiveViewTab('table');
            setIsTableCardOpen(true);
            const freshTables = vaultService.getSavedMonthTables();
            if (Array.isArray(freshTables)) {
              setMonthTables(freshTables);
            }
            const fresh = vaultService.getSavedWorkOrders();
            if (Array.isArray(fresh) && fresh.length > 0) {
              const deduped = deduplicateOrders(fresh);
              lastPersistedOrdersRef.current = deduped;
              setWorkOrders(deduped);

              const yearCounts = new Map<number, number>();
              const monthCounts = new Map<string, number>();
              for (const o of deduped) {
                const y = Number(o.tableYear) || 2026;
                const m = Number(o.tableMonth) || 10;
                yearCounts.set(y, (yearCounts.get(y) || 0) + 1);
                monthCounts.set(`${y}-${m}`, (monthCounts.get(`${y}-${m}`) || 0) + 1);
              }
              let bestYear = activeYear;
              let maxYearCount = 0;
              yearCounts.forEach((cnt, y) => {
                if (cnt > maxYearCount) {
                  maxYearCount = cnt;
                  bestYear = y;
                }
              });
              setActiveYear(bestYear);
              const monthsInBestYear = Array.from(monthCounts.keys()).filter((k) => k.startsWith(`${bestYear}-`));
              if (monthsInBestYear.length === 1) {
                const singleMonth = Number(monthsInBestYear[0].split('-')[1]) || 10;
                setActiveMonth(singleMonth);
                setSelectedTableId(getDefaultTableId(bestYear, singleMonth));
              } else {
                setActiveMonth('all');
                setSelectedTableId('all');
              }
            }
            const freshUsers = vaultService.getSavedUsers();
            if (Array.isArray(freshUsers) && freshUsers.length > 0) {
              const nextU = ensureDefaultSuperAdmins(freshUsers);
              lastSavedUsersRef.current = nextU;
              setUsers(nextU);
            }
            const freshOffices = vaultService.getSavedOffices();
            if (Array.isArray(freshOffices) && freshOffices.length > 0) {
              setOffices(freshOffices);
            }
            const freshCols = vaultService.getSavedColumns();
            if (Array.isArray(freshCols) && freshCols.length > 0) {
              setColumns(ensurePhotosFileColumn(freshCols));
            }
            const freshDropdowns = vaultService.getSavedDropdownOptions();
            if (freshDropdowns) {
              setDropdownOptions(freshDropdowns);
            }
            handleManualSync().catch(() => {});
            showNotification('تم استيراد واسترجاع ومزامنة النسخة الاحتياطية بنجاح بنسبة 100%', 'restore');
          }}
        />
      )}

      {/* 17. Modal: مركز الإشعارات الفورية والتنبيهات الخارجية */}
      {isNotificationModalOpen && (
        <NotificationSettingsModal
          isOpen={isNotificationModalOpen}
          onClose={() => setIsNotificationModalOpen(false)}
          onShowAppNotification={(msg, type) => showNotification(msg, type || 'update')}
          officesList={offices.map((o) => o.name)}
        />
      )}

      {/* 18. Floating Prompt Banner: تفعيل الإشعارات الفورية بضغطة زر واحدة */}
      {showNotificationPromptBanner && (
        <NotificationPromptBanner
          isOpen={showNotificationPromptBanner}
          onClose={() => setShowNotificationPromptBanner(false)}
          onSubscribed={() => {
            setNotificationPermission('granted');
            setShowNotificationPromptBanner(false);
          }}
          onShowToast={(msg, type) => showNotification(msg, type || 'update')}
        />
      )}

      {/* 20. Modal: مقارنة المقاولين في المكاتب بنسبة إنجاز الإغلاقات */}
      {isContractorClosureReportOpen && (
        <ContractorClosureReportModal
          isOpen={isContractorClosureReportOpen}
          onClose={() => setIsContractorClosureReportOpen(false)}
          workOrders={workOrders}
          offices={offices}
          selectedOffice={selectedOffice}
          activeYear={activeYear}
          activeMonth={activeMonth}
          onOpenExportModal={(customOrders, customTitle, openEmail) => checkPermission('exportTable', 'تصدير تقرير تقييم المقاولين', () => handleOpenMainExport(customOrders, customTitle, openEmail))}
        />
      )}

      {/* 20.5 Modal: مركز التقارير الشامل الموحد */}
      {isComprehensiveReportsOpen && (
        <ComprehensiveReportsModal
          isOpen={isComprehensiveReportsOpen}
          onClose={() => setIsComprehensiveReportsOpen(false)}
          workOrders={workOrders}
          allWorkOrders={workOrders}
          monthTables={monthTables}
          offices={offices}
          columns={columns}
          activeYear={activeYear}
          activeMonth={activeMonth}
          selectedOffice={selectedOffice}
          currentUser={currentUser}
          initialMode={comprehensiveReportsMode}
          onOpenOrderFiles={(order) => {
            setIsComprehensiveReportsOpen(false);
            handleSelectSidebarSection('work_orders');
            setBasicEditingOrder(order);
            setIsBasicEditModalOpen(true);
          }}
          onOpenExportModal={(customOrders, customTitle, openEmail) => checkPermission('exportTable', 'تصدير مركز التقارير الموحد', () => handleOpenMainExport(customOrders, customTitle, openEmail))}
        />
      )}

      {/* 21. Modal: إدارة الصلاحيات وإنشاء حسابات المستخدمين */}
      {isPermissionsModalOpen && (
        <PermissionsManagerModal
          isOpen={isPermissionsModalOpen}
          onClose={() => setIsPermissionsModalOpen(false)}
          currentUser={currentUser}
          users={users}
          columns={columns}
          onSaveUser={handleSaveUserAccount}
          onDeleteUser={handleDeleteUserAccount}
          onShowToast={(msg, type) => showNotification(msg, type || 'update')}
        />
      )}

      {/* 22. Modal: رسالة عدم وجود صلاحية */}
      {accessDeniedModal.isOpen && (
        <AccessDeniedModal
          isOpen={accessDeniedModal.isOpen}
          onClose={() => setAccessDeniedModal({ isOpen: false, title: '' })}
          actionTitle={accessDeniedModal.title}
          currentUser={currentUser}
        />
      )}

      {/* 23. Modal: حول المنصة وفريق الإعداد */}
      {isAboutPlatformModalOpen && (
        <AboutPlatformModal
          isOpen={isAboutPlatformModalOpen}
          onClose={() => setIsAboutPlatformModalOpen(false)}
        />
      )}

      {/* 24. Quick Command Palette */}
      {isCommandPaletteOpen && (
        <QuickCommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          orders={workOrders}
          offices={offices}
          onSelectOrder={(order) => {
            setEditingOrder(order);
            setIsEditModalOpen(true);
          }}
          onOpenAddModal={() => checkPermission('addWorkOrder', 'إضافة أمر عمل جديد', () => setIsAddModalOpen(true))}
          onOpenImportModal={() => checkPermission('importExcel', 'استيراد بيانات من Excel', () => setIsImportExcelModalOpen(true))}
          onOpenCompatibleImport={() => checkPermission('importCompatibleTables', 'استيراد البيانات من الجداول المتوافقة', () => setIsCompatibleImportModalOpen(true))}
          onOpenExportModal={() => checkPermission('exportTable', 'تصدير الجدول والتقارير', () => handleOpenMainExport())}
          onOpenWeeklyReport={() => checkPermission('viewWeeklyReport', 'التقرير الأسبوعي للمكاتب الفرعية', () => setIsWeeklyReportModalOpen(true))}
          onOpenOfficeComparison={() => checkPermission('viewOfficeComparison', 'مقارنة وتقييم أداء المكاتب الفرعية', () => setIsOfficeComparisonModalOpen(true))}
          onOpenManageOffices={() => checkPermission('manageOffices', 'إدارة المكاتب الفرعية', () => setIsManageOfficesModalOpen(true))}
          onOpenManageContractors={() => checkPermission('manageContractors', 'إدارة وتوزيع مقاولي المكاتب', () => setIsManageContractorsModalOpen(true))}
          onOpenNotificationSettings={() => checkPermission('manageNotifications', 'إعدادات الإشعارات الفورية', () => setIsNotificationModalOpen(true))}
          onOpenDataRecovery={() => checkPermission('manageCloudBackups', 'مركز الأمان والنسخ الاحتياطية', () => setIsDataRecoveryModalOpen(true))}
          onOpenRestoreDeleted={() => checkPermission('manageCloudBackups', 'مركز الأمان والنسخ الاحتياطية', () => setIsDataRecoveryModalOpen(true))}
          onManualSync={handleManualSync}
          isSoundMuted={isSoundMuted}
          onToggleSound={handleToggleSound}
          onSelectOffice={(off) => setSelectedOffice(off)}
          onSetKpiFilter={(f) => {
            setKpiFilter(f === 'ready' ? 'ready155' : f === 'not_ready' ? 'notReady155' : 'all');
            setActiveViewTab('table');
          }}
          onOpenContractorComparison={() => checkPermission('viewContractorClosureReport', 'مقارنة المقاولين وإنجاز الإغلاقات', () => setIsContractorClosureReportOpen(true))}
          currentUser={currentUser}
        />
      )}

      {/* 25. Keyboard Shortcuts Modal */}
      {isShortcutsModalOpen && (
        <KeyboardShortcutsModal
          isOpen={isShortcutsModalOpen}
          onClose={() => setIsShortcutsModalOpen(false)}
        />
      )}

      {/* 26. Modal: تقرير الملاحظات والملاحظات المتكررة بالصور المرفقة والتصدير الموحد */}
      {isQualityNotesReportModalOpen && (
        <QualityNotesReportModal
          isOpen={isQualityNotesReportModalOpen}
          onClose={() => setIsQualityNotesReportModalOpen(false)}
          orders={displayOrders.length > 0 ? displayOrders : workOrders}
          offices={offices}
          initialMode={qualityNotesReportMode}
          initialContractor={qualityNotesReportContractor}
          activePeriodLabel={activeTableName || (selectedOffice === 'all' ? 'كافة المكاتب' : selectedOffice)}
          currentUser={currentUser}
          onOpenExportModal={(customOrders, customTitle, openEmail) => checkPermission('exportTable', 'تصدير تقرير الملاحظات الفنية', () => handleOpenMainExport(customOrders, customTitle, openEmail))}
        />
      )}

      {/* 27. Modal: سجل التدقيق التاريخي الشامل غير القابل للتراجع (Immutable Audit Trail) */}
      {isAuditTrailModalOpen && (
        <AuditTrailModal
          isOpen={isAuditTrailModalOpen}
          onClose={() => setIsAuditTrailModalOpen(false)}
          workOrders={workOrders}
          currentUser={currentUser}
        />
      )}

      {/* 27.5 Modal: جدول متابعة وترحيل أوامر العمل التي تم البدء بالتدقيق عليها من أي جهة */}
      {isAuditTrackerModalOpen && (
        <AuditTrackerModal
          isOpen={isAuditTrackerModalOpen}
          onClose={() => setIsAuditTrackerModalOpen(false)}
          workOrders={workOrders}
          onNavigateToOrder={handleNavigateFromAuditTracker}
          onOpenArchivedAuditedSection={() => {
            setIsAuditTrackerModalOpen(false);
            handleSelectSidebarSection('audit_trail');
            setAuditHubSubTab('completed_audit');
          }}
        />
      )}
      </React.Suspense>

      {/* 28. Modal: رسالة تأكيد العمليات الحساسة (اعتماد نهائي / إلغاء حالة معتمدة) */}
      {sensitiveOrderConfirm && sensitiveOrderConfirm.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150 font-['Cairo',sans-serif]"
          dir="rtl"
        >
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-amber-400 max-w-md w-full overflow-hidden text-right animate-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white p-4 flex items-center justify-between border-b border-amber-500/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">{sensitiveOrderConfirm.title}</h3>
                  <p className="text-[11px] text-amber-200/90">حماية العمليات الحساسة (No Undo Policy)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSensitiveOrderConfirm(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-950 space-y-1">
                  <p className="font-black text-rose-800 text-sm">
                    هذا الإجراء نهائي ولا يمكن التراجع عنه بعد التنفيذ.
                  </p>
                  <p className="font-semibold text-rose-900">
                    {sensitiveOrderConfirm.description}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">رقم أمر العمل:</span>
                  <span className="font-mono font-black text-slate-900">{sensitiveOrderConfirm.workOrderNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">الحالة السابقة:</span>
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">{sensitiveOrderConfirm.previousStatus}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">الحالة الجديدة:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-black">{sensitiveOrderConfirm.newStatus}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSensitiveOrderConfirm(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const orderToCommit = sensitiveOrderConfirm.pendingOrder;
                    setSensitiveOrderConfirm(null);
                    await handleUpdateOrder(orderToCommit, true);
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-black shadow-md transition-all cursor-pointer"
                >
                  تأكيد وتنفيذ الإجراء النهائي
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Platform Published Reboot Overlay — يحدث برنامج المنصة فوراً لجميع المستخدمين مع الحفاظ الكامل على البيانات والجلسات */}
      {platformPublishAlert && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 font-['Cairo',sans-serif] animate-in fade-in duration-200 select-none">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95 duration-200 text-slate-900">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-lg animate-bounce">
              <Zap className="w-8 h-8 text-white" />
            </div>
            
            <h3 className="text-xl font-black text-slate-900 mb-2">
              تم نشر تحديث للبرنامج بنجاح
            </h3>
            
            <p className="text-xs sm:text-sm font-semibold text-slate-600 mb-5 leading-relaxed">
              تم تحديث برنامج المنصة والسيرفر بنجاح مع الحفاظ الكامل بنسبة 100% على كافة بيانات الجداول، أوامر العمل، الصلاحيات، وحسابات المستخدمين المعتمدين دون أي تغيير.
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 mb-5 flex items-center justify-center gap-2">
              <span className="text-xs font-bold text-slate-500">تحديث تلقائي للواجهة خلال:</span>
              <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-mono font-black text-lg flex items-center justify-center shadow-xs">
                {platformPublishAlert.countdown}
              </span>
              <span className="text-xs font-bold text-slate-500">ثوانٍ</span>
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.replace(`/?published=${Date.now()}`);
              }}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer"
            >
              تحديث الواجهة الآن (البيانات والجلسة محفوظة)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
