import React, { useState, useMemo } from 'react';
import {
  X,
  ShieldCheck,
  UserPlus,
  Users,
  Mail,
  User,
  Lock,
  Check,
  Ban,
  Edit3,
  Trash2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  KeyRound,
  Save,
  RefreshCw,
  Crown,
  LayoutGrid,
  TableProperties,
  ListChecks,
  BarChart3,
  Building2,
  Settings,
  Columns3,
  Search
} from 'lucide-react';
import { PlatformUser, UserPermissions, ColumnDefinition } from '../types';
import {
  SUPER_ADMIN_EMAILS,
  SUPER_ADMIN_USERNAME,
  FULL_PERMISSIONS,
  EMPTY_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  PermissionCategoryId,
  getMergedTableColumnsForPermissions,
  ensureDefaultSuperAdmins,
  isSuperAdminEmail,
  isPurgedLegacyUserOrEmail,
  PRIMARY_SUPER_ADMIN_NAME,
  PRIMARY_SUPER_ADMIN_ROLE_TITLE,
  normalizeMahmoudRoleTitle,
  synchronizeUserPermissionsWithPlatformUpdates
} from '../utils/security';

interface PermissionsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: PlatformUser[];
  currentUser: PlatformUser | null;
  columns?: ColumnDefinition[];
  onSaveUser: (user: Partial<PlatformUser>) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onShowToast?: (msg: string, type?: 'create' | 'update' | 'delete') => void;
}

const DEFAULT_NEW_USER_PERMISSIONS: UserPermissions = {
  ...EMPTY_PERMISSIONS,
  // 1. Sidebar Tabs (open by default except system settings)
  tabHome: true,
  tabWorkOrders: true,
  tabKpis: true,
  tabQualityGuide: true,
  tabAuditHub: true,
  tabOffices: true,
  tabContractors: true,
  tabArchive: true,
  tabReports: true,
  tabDocuments: true,
  tabSettings: false,
  // 2. Table Tools
  addWorkOrder: true,
  editWorkOrderBasic: true,
  editWorkOrderStatus: true,
  inlineTableEdit: true,
  uploadInspectionFiles: true,
  viewPhotos: true,
  searchAndFilter: true,
  deleteWorkOrder: false,
  // 3. Audit 155
  auditPdcColumn: true,
  auditConstructionColumn: true,
  auditTechnicalSupportColumn: true,
  editProcedure155: false,
  smartAudit: true,
  manageArchive155: true,
  // 4. Reports & KPIs
  viewKpiDashboard: true,
  viewComprehensiveReports: true,
  viewWeeklyReport: true,
  viewOfficeComparison: true,
  viewContractorClosureReport: true,
  viewNotesReport: true,
  viewArchive: true,
  exportTable: true
};

export const PermissionsManagerModal: React.FC<PermissionsManagerModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  columns,
  onSaveUser,
  onDeleteUser,
  onShowToast
}) => {
  const allUsers = useMemo(() => ensureDefaultSuperAdmins(users), [users]);
  const dynamicTableColumns = useMemo(
    () => getMergedTableColumnsForPermissions(columns),
    [columns]
  );

  const [activeTab, setActiveTab] = useState<'create_edit' | 'users_list'>('create_edit');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [permSearchQuery, setPermSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<PermissionCategoryId | 'all' | 'columns'>('all');

  const authorizerEmails = useMemo(() => {
    const list = [...SUPER_ADMIN_EMAILS];
    if (currentUser?.email && !list.includes(currentUser.email)) {
      list.unshift(currentUser.email);
    }
    return list;
  }, [currentUser?.email]);

  // Form State
  const [adminAuthorizerEmail, setAdminAuthorizerEmail] = useState<string>(
    currentUser?.email || SUPER_ADMIN_EMAILS[0]
  );
  const [userEmail, setUserEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roleTitle, setRoleTitle] = useState('مدقق جودة وأوامر عمل');
  const [isActive, setIsActive] = useState(true);
  const [permissions, setPermissions] = useState<UserPermissions>({
    ...DEFAULT_NEW_USER_PERMISSIONS
  });
  const [allowedColumns, setAllowedColumns] = useState<string[]>(() =>
    getMergedTableColumnsForPermissions(columns)
      .filter((c) => c.field !== 'procedure155')
      .map((c) => c.field)
  );

  const [showPassInForm, setShowPassInForm] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingUserId(null);
    setUserEmail('');
    setUsername('');
    setPassword('');
    setDisplayName('');
    setRoleTitle('مدقق جودة وأوامر عمل');
    setIsActive(true);
    setPermissions({
      ...DEFAULT_NEW_USER_PERMISSIONS
    });
    setAllowedColumns(
      dynamicTableColumns
        .filter((c) => c.field !== 'procedure155')
        .map((c) => c.field)
    );
    setFormError(null);
    setFormSuccess(null);
  };

  const handleLoadUserToEdit = (u: PlatformUser) => {
    const isPrimarySuper = Boolean(isSuperAdminEmail(u.email) || u.username === SUPER_ADMIN_USERNAME);
    const syncdUser = synchronizeUserPermissionsWithPlatformUpdates(u);
    const hasProc155Perm = isPrimarySuper || Boolean(syncdUser.permissions?.editProcedure155);
    setEditingUserId(syncdUser.id);
    setUserEmail(syncdUser.email || '');
    setUsername(syncdUser.username || '');
    setPassword('');
    setDisplayName(syncdUser.displayName || '');
    setRoleTitle(syncdUser.roleTitle || 'مستخدم معتمد');
    setIsActive(syncdUser.isActive !== false);
    setPermissions(
      isPrimarySuper
        ? { ...FULL_PERMISSIONS }
        : { ...EMPTY_PERMISSIONS, ...(syncdUser.permissions || {}), editProcedure155: hasProc155Perm }
    );
    const userCols = syncdUser.allowedColumns || syncdUser.permissions?.allowedColumns;
    const baseCols = Array.isArray(userCols)
      ? userCols.filter((f) => f !== 'executionStatus')
      : dynamicTableColumns.map((c) => c.field);
    const syncedCols = hasProc155Perm
      ? Array.from(new Set([...baseCols, 'procedure155']))
      : baseCols.filter((f) => f !== 'procedure155');
    setAllowedColumns(syncedCols);
    setFormError(null);
    setFormSuccess(null);
    setActiveTab('create_edit');
  };

  const handleToggleColumn = (field: string) => {
    setAllowedColumns((prev) => {
      const willEnable = !prev.includes(field);
      if (field === 'procedure155') {
        setPermissions((p) => ({ ...p, editProcedure155: willEnable }));
      }
      if (field === 'pdcAudit') {
        setPermissions((p) => ({ ...p, auditPdcColumn: willEnable }));
      }
      if (field === 'constructionAudit') {
        setPermissions((p) => ({ ...p, auditConstructionColumn: willEnable }));
      }
      if (field === 'procedure155Status') {
        setPermissions((p) => ({ ...p, auditTechnicalSupportColumn: willEnable }));
      }
      if (field === 'photosFile') {
        setPermissions((p) => ({ ...p, uploadInspectionFiles: willEnable }));
      }
      if (!willEnable) {
        return prev.filter((f) => f !== field);
      } else {
        return [...prev, field];
      }
    });
  };

  const handleSelectAllColumns = (selectAll: boolean) => {
    if (selectAll) {
      setAllowedColumns(dynamicTableColumns.map((c) => c.field));
      setPermissions((prev) => ({
        ...prev,
        editProcedure155: true,
        auditPdcColumn: true,
        auditConstructionColumn: true,
        auditTechnicalSupportColumn: true,
        uploadInspectionFiles: true
      }));
    } else {
      setAllowedColumns(dynamicTableColumns.filter((c) => c.isUniversallyEditable).map((c) => c.field));
      setPermissions((prev) => ({ ...prev, editProcedure155: false }));
    }
  };

  const handleTogglePermission = (key: keyof UserPermissions) => {
    if (isSuperAdminEmail(userEmail)) {
      setPermissions({ ...FULL_PERMISSIONS });
      setAllowedColumns(dynamicTableColumns.map((c) => c.field));
      return;
    }
    setPermissions((prev) => {
      const nextVal = !prev[key];
      const nextPerms: UserPermissions = {
        ...prev,
        [key]: nextVal
      };

      // Bidirectional sync between KPI tab and KPI dashboard permission
      if (key === 'tabKpis') nextPerms.viewKpiDashboard = nextVal;
      if (key === 'viewKpiDashboard' && nextVal) nextPerms.tabKpis = true;
      if (key === 'tabArchive') nextPerms.viewArchive = nextVal;
      if (key === 'viewArchive' && nextVal) nextPerms.tabArchive = true;

      // Sync column-specific permissions with allowedColumns
      const colSyncMap: Partial<Record<keyof UserPermissions, string>> = {
        editProcedure155: 'procedure155',
        auditPdcColumn: 'pdcAudit',
        auditConstructionColumn: 'constructionAudit',
        auditTechnicalSupportColumn: 'procedure155Status',
        uploadInspectionFiles: 'photosFile'
      };
      const linkedField = colSyncMap[key];
      if (linkedField) {
        setAllowedColumns((cols) =>
          nextVal
            ? Array.from(new Set([...cols, linkedField]))
            : cols.filter((f) => f !== linkedField)
        );
      }

      return nextPerms;
    });
  };

  const handleSetAllPermissions = (enableAll: boolean) => {
    if (isSuperAdminEmail(userEmail)) {
      setPermissions({ ...FULL_PERMISSIONS });
      setAllowedColumns(dynamicTableColumns.map((c) => c.field));
      return;
    }
    setPermissions(enableAll ? { ...FULL_PERMISSIONS } : { ...EMPTY_PERMISSIONS });
    if (enableAll) {
      setAllowedColumns(dynamicTableColumns.map((c) => c.field));
    } else {
      setAllowedColumns(dynamicTableColumns.filter((c) => c.isUniversallyEditable).map((c) => c.field));
    }
  };

  const handleApplyPreset = (preset: 'full' | 'supervisor_155' | 'auditor' | 'reports_only' | 'none') => {
    if (isSuperAdminEmail(userEmail)) {
      setPermissions({ ...FULL_PERMISSIONS });
      setAllowedColumns(dynamicTableColumns.map((c) => c.field));
      return;
    }
    if (preset === 'full') {
      setPermissions({ ...FULL_PERMISSIONS });
      setAllowedColumns(dynamicTableColumns.map((c) => c.field));
      setRoleTitle('مسؤول بصلاحية كاملة');
    } else if (preset === 'supervisor_155') {
      setPermissions({
        ...FULL_PERMISSIONS,
        clearData: false,
        managePermissions: false,
        deleteMonthTable: false
      });
      setAllowedColumns(dynamicTableColumns.map((c) => c.field));
      setRoleTitle('مشرف ومعتمد إجراء 155 وأرشيف 155');
    } else if (preset === 'auditor') {
      setPermissions({
        ...DEFAULT_NEW_USER_PERMISSIONS,
        importExcel: true,
        importCompatibleTables: true
      });
      setAllowedColumns(
        dynamicTableColumns
          .filter((c) => c.field !== 'procedure155')
          .map((c) => c.field)
      );
      setRoleTitle('مدقق جودة ميداني (PDC / إنشاءات / مساندة)');
    } else if (preset === 'reports_only') {
      setPermissions({
        ...EMPTY_PERMISSIONS,
        tabHome: true,
        tabWorkOrders: true,
        tabKpis: true,
        tabQualityGuide: true,
        tabAuditHub: true,
        tabOffices: true,
        tabContractors: true,
        tabArchive: true,
        tabReports: true,
        tabDocuments: false,
        tabSettings: false,
        viewPhotos: true,
        exportTable: true,
        searchAndFilter: true,
        viewKpiDashboard: true,
        viewComprehensiveReports: true,
        viewNotesReport: true,
        viewContractorClosureReport: true,
        viewWeeklyReport: true,
        viewOfficeComparison: true,
        viewArchive: true
      });
      setAllowedColumns(dynamicTableColumns.filter((c) => c.isUniversallyEditable).map((c) => c.field));
      setRoleTitle('مطلع مؤشرات أداء (KPIs) وتقارير');
    } else {
      setPermissions({ ...EMPTY_PERMISSIONS });
      setAllowedColumns(dynamicTableColumns.filter((c) => c.isUniversallyEditable).map((c) => c.field));
    }
  };

  const handleToggleCategory = (category: PermissionCategoryId, enable: boolean) => {
    if (isSuperAdminEmail(userEmail)) return;
    const categoryKeys = PERMISSION_DEFINITIONS.filter((d) => d.category === category).map((d) => d.key);
    setPermissions((prev) => {
      const next = { ...prev };
      for (const k of categoryKeys) {
        (next as any)[k] = enable;
      }
      return next;
    });
    if (category === 'audit_155') {
      setAllowedColumns((cols) =>
        enable
          ? Array.from(new Set([...cols, 'pdcAudit', 'constructionAudit', 'procedure155Status', 'procedure155']))
          : cols.filter((f) => !['pdcAudit', 'constructionAudit', 'procedure155Status', 'procedure155'].includes(f))
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    let cleanEmail = userEmail.trim().toLowerCase();
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser) {
      setFormError('يرجى إدخال اسم المستخدم (User)');
      return;
    }
    if (!editingUserId && !cleanPass) {
      setFormError('يرجى إدخال كلمة المرور (Password) للمستخدم الجديد');
      return;
    }

    if (!cleanEmail) {
      const safeSlug =
        encodeURIComponent(cleanUser.replace(/\s+/g, '_')).replace(/%/g, '').toLowerCase() ||
        `usr_${Date.now().toString().slice(-4)}`;
      cleanEmail = `${safeSlug}@platform.sec`;
    } else if (!cleanEmail.includes('@')) {
      const safeSlug =
        encodeURIComponent(cleanEmail.replace(/\s+/g, '_')).replace(/%/g, '').toLowerCase() ||
        `usr_${Date.now().toString().slice(-4)}`;
      cleanEmail = `${safeSlug}@platform.sec`;
    }

    const isSuper = isSuperAdminEmail(cleanEmail);

    if (isPurgedLegacyUserOrEmail(cleanEmail) || isPurgedLegacyUserOrEmail(cleanUser)) {
      setFormError('هذا البريد الإلكتروني ملغى نهائياً من المنصة ولا يُسمح بإضافته.');
      return;
    }

    if (!isSuper && cleanUser === SUPER_ADMIN_USERNAME && !editingUserId) {
      setFormError(
        `اسم المستخدم (${SUPER_ADMIN_USERNAME}) مخصص حصرياً للمسؤول الرئيسي للمنظومة. يرجى اختيار اسم مستخدم آخر للموظف.`
      );
      return;
    }

    if (!editingUserId) {
      const duplicateEmail = allUsers.find(
        (u) => u.email?.toLowerCase().trim() === cleanEmail && !isSuperAdminEmail(cleanEmail)
      );
      if (duplicateEmail) {
        setFormError(
          `البريد الإلكتروني (${cleanEmail}) مسجل مسبقاً لمستخدم آخر. يمكنك تعديل حسابه من قائمة الحسابات المسجلة.`
        );
        return;
      }

      const duplicateUsername = allUsers.find(
        (u) => !u.isSuperAdmin && u.username?.toLowerCase().trim() === cleanUser.toLowerCase()
      );
      if (duplicateUsername) {
        setFormError(`اسم المستخدم (${cleanUser}) مستخدم مسبقاً لموظف آخر. يرجى اختيار اسم مستخدم مختلف.`);
        return;
      }
    } else {
      const duplicateUsername = allUsers.find(
        (u) =>
          u.id !== editingUserId &&
          !u.isSuperAdmin &&
          u.username?.toLowerCase().trim() === cleanUser.toLowerCase()
      );
      if (duplicateUsername) {
        setFormError(`اسم المستخدم (${cleanUser}) مستخدم مسبقاً لموظف آخر. يرجى اختيار اسم مستخدم آخر.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      await onSaveUser({
        id: editingUserId || undefined,
        email: cleanEmail,
        username: cleanUser,
        ...(cleanPass ? { password: cleanPass } : {}),
        displayName: displayName.trim() || cleanUser,
        roleTitle:
          normalizeMahmoudRoleTitle({ username: cleanUser, email: cleanEmail, displayName, roleTitle }) ||
          (isSuper ? PRIMARY_SUPER_ADMIN_ROLE_TITLE : roleTitle.trim() || 'مستخدم معتمد'),
        isSuperAdmin: isSuper,
        isActive: isSuper ? true : isActive,
        permissions: isSuper
          ? { ...FULL_PERMISSIONS, allowedColumns: dynamicTableColumns.map((c) => c.field) }
          : { ...permissions, allowedColumns },
        allowedColumns: isSuper ? dynamicTableColumns.map((c) => c.field) : allowedColumns,
        createdByEmail: adminAuthorizerEmail
      });

      const msg = editingUserId
        ? `تم تحديث حساب وصلاحيات المستخدم (${cleanUser}) ومزامنتها فوراً لدى جميع المتصلين`
        : `تم إنشاء حساب المستخدم (${cleanUser}) وتفعيل صلاحياته المحددة بنجاح ومزامنتها للجميع`;
      setFormSuccess(msg);
      if (onShowToast) onShowToast(msg, editingUserId ? 'update' : 'create');

      if (!editingUserId) {
        resetForm();
        setFormSuccess(msg);
      }
    } catch (err: any) {
      setFormError(err?.message || 'حدث خطأ أثناء حفظ بيانات المستخدم');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyCredentials = (u: PlatformUser) => {
    const text = `بيانات الدخول لمنصة حوكمة جودة أعمال الإنشاءات (إجراء 155):\nالبريد الإلكتروني: ${u.email}\nاسم المستخدم (User): ${u.username}\nكلمة المرور: [محفوظة ومشفرة على الخادم]`;
    navigator.clipboard?.writeText(text);
    setCopiedId(u.id);
    setTimeout(() => setCopiedId(null), 2000);
    if (onShowToast) onShowToast(`تم نسخ بيانات دخول المستخدم (${u.username})`, 'update');
  };

  const enabledCount = PERMISSION_DEFINITIONS.filter((d) => Boolean(permissions[d.key])).length;
  const totalPermsCount = PERMISSION_DEFINITIONS.length;

  const customUsers = allUsers.filter((u) => !isSuperAdminEmail(u.email) && !isPurgedLegacyUserOrEmail(u));

  const categories: {
    id: PermissionCategoryId;
    title: string;
    shortTitle: string;
    subtitle: string;
    badge: string;
    icon: React.ComponentType<{ className?: string }>;
    headerBg: string;
  }[] = [
    {
      id: 'sidebar_tabs',
      title: 'القسم 1: صلاحيات تبويبات العمود الجانبي والصفحات الرئيسية (11 تبويباً)',
      shortTitle: '1. تبويبات العمود الجانبي',
      subtitle: 'التحكم في إمكانية فتح واستعراض كل تبويب في القائمة الجانبية الموحدة للمنصة',
      badge: '11 تبويب جانبي',
      icon: LayoutGrid,
      headerBg: 'from-[#001D40] to-[#003B73]'
    },
    {
      id: 'tools',
      title: 'القسم 2: صلاحيات عمليات جدول أوامر العمل والمرفقات الميدانية',
      shortTitle: '2. عمليات الجدول والمرفقات',
      subtitle: 'الإضافة، تعديل البيانات الأساسية، تحديث الجودة، التعديل المباشر للخلايا، رفع ملفات الصور و PDF، والحذف',
      badge: 'عمليات الجدول',
      icon: TableProperties,
      headerBg: 'from-[#002855] to-[#004B8D]'
    },
    {
      id: 'audit_155',
      title: 'القسم 3: صلاحيات التدقيق الثلاثي المستقل واعتماد وأرشفة إجراء 155',
      shortTitle: '3. التدقيق وأرشيف 155',
      subtitle: 'تدقيق (PDC • الإنشاءات • المساندة الفنية)، اختيار (تم الاجراء) في عمود إجراء 155، وإدارة قائمتي (تم التدقيق عليه) و(ارشيف 155)',
      badge: 'التدقيق وأرشيف 155',
      icon: ListChecks,
      headerBg: 'from-emerald-900 to-teal-900'
    },
    {
      id: 'reports',
      title: 'القسم 4: صلاحيات مؤشرات الأداء التفاعلية (KPIs) والتقارير والتصدير',
      shortTitle: '4. المؤشرات (KPIs) والتقارير',
      subtitle: 'فتح لوحة المؤشرات والقوائم المنبثقة فوق الصفحة، التوجه المباشر للجدول، التقارير الدورية، والتصدير ومشاركة البريد',
      badge: 'المؤشرات والتقارير',
      icon: BarChart3,
      headerBg: 'from-indigo-950 to-[#002855]'
    },
    {
      id: 'structure',
      title: 'القسم 5: صلاحيات الاستيراد وإدارة الجداول والهيكل التنظيمي',
      shortTitle: '5. الاستيراد والهيكل',
      subtitle: 'استيراد Excel، الاستيراد الذكي المتوافق، الجداول الشهرية المستقلة، المكاتب الفرعية، المقاولين، والأعمدة والقوائم',
      badge: 'إدارة الهيكل',
      icon: Building2,
      headerBg: 'from-slate-900 to-[#002855]'
    },
    {
      id: 'system',
      title: 'القسم 6: صلاحيات الخزنة السحابية والإشعارات وإدارة النظام',
      shortTitle: '6. الخزنة وإدارة النظام',
      subtitle: 'استيراد وتصدير النسخ الاحتياطية السحابية، إدارة الإشعارات الفورية، تفريغ البيانات، وإدارة صلاحيات المستخدمين',
      badge: 'إدارة النظام',
      icon: Settings,
      headerBg: 'from-amber-950 to-slate-900'
    }
  ];

  const normalizedQuery = permSearchQuery.trim().toLowerCase();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150 font-['Cairo',sans-serif]"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl border-2 border-[#002855]/30 shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Modal Header - Unified SEC Corporate Navy & Orange Identity */}
        <div className="bg-gradient-to-l from-[#001D40] via-[#002855] to-[#003B73] px-5 py-3.5 text-white flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#F58220] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#F58220] border border-amber-300/40 flex items-center justify-center shadow-lg shrink-0">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white">
                  إدارة الصلاحيات وحسابات المستخدمين (الهيكلة الشاملة المحدثة)
                </h2>
                <span className="px-2.5 py-0.5 rounded-lg bg-white/10 text-[#FDB813] border border-[#FDB813]/30 text-[10px] font-black">
                  7 أقسام متزامنة • {totalPermsCount} صلاحية • {dynamicTableColumns.length} عمود
                </span>
              </div>
              <p className="text-[11px] text-blue-100 mt-0.5 font-bold">
                مزامنة لحظية لصلاحيات تبويبات العمود الجانبي، الإجراءات الميدانية، التدقيق الثلاثي، أرشيف 155، المؤشرات التفاعلية، والأعمدة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Switch Tabs */}
            <div className="flex items-center bg-[#001D40]/90 p-1 rounded-xl border border-white/15">
              <button
                type="button"
                onClick={() => setActiveTab('create_edit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'create_edit'
                    ? 'bg-[#F58220] text-white shadow-xs'
                    : 'text-blue-100 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{editingUserId ? 'تعديل حساب وصلاحيات' : 'إنشاء حساب ومنح صلاحيات'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('users_list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'users_list'
                    ? 'bg-[#F58220] text-white shadow-xs'
                    : 'text-blue-100 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>الحسابات المسجلة ({allUsers.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-600 text-white transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Super Admin Authorized Emails Banner */}
        <div className="bg-[#001D40] border-b border-[#003B73] px-5 py-2 text-white flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-black text-[#FDB813]">
              <Crown className="w-4 h-4 text-[#F58220]" />
              <span>مسؤول النظام الرئيسي (صلاحية كاملة ومطلقة):</span>
            </span>
            {SUPER_ADMIN_EMAILS.map((email) => (
              <span
                key={email}
                className="px-2.5 py-0.5 rounded-lg bg-[#002855] border border-blue-400/30 text-blue-100 font-mono font-bold text-[11px]"
              >
                {email}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold bg-[#002855] px-3 py-0.5 rounded-lg border border-blue-800 text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>حفظ تلقائي وبث فوري للصلاحيات دون تراجع</span>
          </div>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[#F4F6F9]">
          {activeTab === 'create_edit' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {formError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-xs font-black flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs font-black flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>{formSuccess}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('users_list')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                  >
                    عرض قائمة المستخدمين
                  </button>
                </div>
              )}

              {/* User Account Credentials Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#002855] text-[#F58220] flex items-center justify-center shrink-0">
                      <UserPlus className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-[#002855]">
                        {editingUserId ? 'بيانات حساب المستخدم الجاري تعديله' : 'بيانات إنشاء حساب المستخدم الجديد'}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-bold">
                        أدخل البريد الإلكتروني (يُستخدم أيضاً لإرسال كلمة السر الاحتياطية عند نسيان كلمة المرور) واسم المستخدم وكلمة المرور
                      </p>
                    </div>
                  </div>

                  {editingUserId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>إنشاء مستخدم جديد بدلاً من التعديل</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {/* Authorizing Super Admin Email */}
                  <div>
                    <label className="block text-xs font-black text-[#002855] mb-1">
                      مسؤول الصلاحيات المانح للحساب
                    </label>
                    <select
                      value={adminAuthorizerEmail}
                      onChange={(e) => setAdminAuthorizerEmail(e.target.value)}
                      dir="ltr"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 focus:border-[#004B8D] text-slate-900 font-mono font-bold text-xs outline-none"
                    >
                      {authorizerEmails.map((em) => (
                        <option key={em} value={em}>
                          {em} (صلاحية كاملة)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* User Email */}
                  <div>
                    <label className="block text-xs font-black text-[#002855] mb-1">
                      البريد الإلكتروني للمستخدم (Email) <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                      <input
                        type="text"
                        inputMode="email"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        placeholder="user@se.com.sa"
                        dir="ltr"
                        className="w-full pr-9 pl-3 py-2 rounded-xl bg-white border border-slate-300 focus:border-[#004B8D] text-slate-900 font-mono font-bold text-xs text-right outline-none"
                      />
                    </div>
                  </div>

                  {/* Username (User) */}
                  <div>
                    <label className="block text-xs font-black text-[#002855] mb-1">
                      اسم المستخدم للدخول (User) <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#004B8D] absolute right-3 top-2.5" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="مثال: 831301 أو eng_ahmad"
                        dir="ltr"
                        required
                        className="w-full pr-9 pl-3 py-2 rounded-xl bg-white border border-slate-300 focus:border-[#004B8D] text-slate-900 font-mono font-bold text-xs text-right outline-none"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-black text-[#002855] mb-1">
                      كلمة المرور (Password) {!editingUserId && <span className="text-rose-600">*</span>}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#F58220] absolute right-3 top-2.5" />
                      <input
                        type={showPassInForm ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={editingUserId ? 'اتركها فارغة للاحتفاظ بالحالية' : 'أدخل كلمة المرور للمستخدم'}
                        dir="ltr"
                        required={!editingUserId}
                        className="w-full pr-9 pl-9 py-2 rounded-xl bg-white border border-slate-300 focus:border-[#004B8D] text-slate-900 font-mono font-bold text-xs text-right outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassInForm(!showPassInForm)}
                        className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showPassInForm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="block text-xs font-black text-[#002855] mb-1">
                      اسم الموظف الظاهر في المنصة والاعتمادات
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="الاسم الظاهر في الإشعارات وتوثيق التدقيق"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 focus:border-[#004B8D] text-slate-900 font-bold text-xs outline-none"
                    />
                  </div>

                  {/* Role / Job Title */}
                  <div>
                    <label className="block text-xs font-black text-[#002855] mb-1">
                      المسمى الوظيفي / الإدارة وحالة الحساب
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={roleTitle}
                        onChange={(e) => setRoleTitle(e.target.value)}
                        placeholder="مثال: مهندس تدقيق PDC / المساندة الفنية"
                        className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-300 focus:border-[#004B8D] text-slate-900 font-bold text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setIsActive((prev) => !prev)}
                        className={`px-3 py-2 rounded-xl font-black text-xs shrink-0 transition-all cursor-pointer border ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                        }`}
                        title="تغيير حالة الحساب (نشط / موقوف)"
                      >
                        {isActive ? 'نشط ✓' : 'موقوف ✕'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation & Presets Control Bar for the 7 Permission Sections */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-[#002855]">
                        هيكلة أقسام الصلاحيات الموحدة (7 أقسام شاملة)
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-lg bg-[#002855] text-[#FDB813] text-xs font-mono font-black">
                        مفعّل: {enabledCount} / {totalPermsCount} صلاحية
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-[#004B8D] border border-blue-200 text-xs font-mono font-black">
                        الأعمدة المصرحة: {allowedColumns.length} / {dynamicTableColumns.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                      اختر قالباً جاهزاً أو انتقل بين الأقسام الـ 7 لتخصيص صلاحيات التبويبات الجانبية، الإجراءات، التدقيق الثلاثي، أرشيف 155، والأعمدة
                    </p>
                  </div>

                  {/* Quick Role Presets */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetAllPermissions(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>منح كافة الصلاحيات</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('supervisor_155')}
                      className="px-2.5 py-1.5 rounded-xl bg-[#002855] hover:bg-[#003B73] text-[#FDB813] font-black text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[#F58220]" />
                      <span>مشرف ومعتمد 155</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('auditor')}
                      className="px-2.5 py-1.5 rounded-xl bg-[#004B8D] hover:bg-[#003B73] text-white font-black text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>مدقق جودة ميداني</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('reports_only')}
                      className="px-2.5 py-1.5 rounded-xl bg-[#F58220] hover:bg-[#d96b12] text-white font-black text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <span>اطلاع وتقارير فقط</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllPermissions(false)}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 font-black text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>إلغاء الكل</span>
                    </button>
                  </div>
                </div>

                {/* Section Filter Tabs + Quick Search */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryFilter('all')}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                        selectedCategoryFilter === 'all'
                          ? 'bg-[#002855] text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      عرض كافة الأقسام (7)
                    </button>
                    {categories.map((cat) => {
                      const catItems = PERMISSION_DEFINITIONS.filter((d) => d.category === cat.id);
                      const catEnabledCount = catItems.filter((i) => Boolean(permissions[i.key])).length;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategoryFilter(cat.id)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                            selectedCategoryFilter === cat.id
                              ? 'bg-[#F58220] text-white shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <span>{cat.shortTitle}</span>
                          <span className="px-1.5 py-0.2 rounded bg-black/15 font-mono text-[10px]">
                            {catEnabledCount}/{catItems.length}
                          </span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryFilter('columns')}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedCategoryFilter === 'columns'
                          ? 'bg-[#F58220] text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span>7. أعمدة الجدول</span>
                      <span className="px-1.5 py-0.2 rounded bg-black/15 font-mono text-[10px]">
                        {allowedColumns.length}/{dynamicTableColumns.length}
                      </span>
                    </button>
                  </div>

                  <div className="relative min-w-[210px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      value={permSearchQuery}
                      onChange={(e) => setPermSearchQuery(e.target.value)}
                      placeholder="ابحث عن صلاحية أو تبويب أو عمود..."
                      className="w-full pr-8 pl-3 py-1.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-[#004B8D] text-xs font-bold text-slate-800 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sections 1..6: Categorized Platform Permissions */}
              <div className="space-y-4">
                {categories
                  .filter((cat) => selectedCategoryFilter === 'all' || selectedCategoryFilter === cat.id)
                  .map((cat) => {
                    const catItems = PERMISSION_DEFINITIONS.filter(
                      (d) =>
                        d.category === cat.id &&
                        (!normalizedQuery ||
                          d.label.toLowerCase().includes(normalizedQuery) ||
                          d.description.toLowerCase().includes(normalizedQuery))
                    );
                    if (catItems.length === 0) return null;

                    const allCatItems = PERMISSION_DEFINITIONS.filter((d) => d.category === cat.id);
                    const enabledInCat = allCatItems.filter((item) => Boolean(permissions[item.key])).length;
                    const allCatEnabled = allCatItems.every((item) => Boolean(permissions[item.key]));
                    const CatIcon = cat.icon;

                    return (
                      <div
                        key={cat.id}
                        className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs"
                      >
                        {/* Section Header */}
                        <div
                          className={`bg-gradient-to-l ${cat.headerBg} px-4 py-3 text-white flex flex-wrap items-center justify-between gap-2 border-b border-[#F58220]/60`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 text-[#FDB813]">
                              <CatIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-xs sm:text-sm text-white">
                                  {cat.title}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-white/15 text-[#FDB813] font-mono text-[10px] font-black">
                                  {enabledInCat} / {allCatItems.length} مفعّل
                                </span>
                              </div>
                              <p className="text-[10.5px] text-blue-100 font-bold mt-0.5">
                                {cat.subtitle}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleCategory(cat.id, !allCatEnabled)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-black cursor-pointer transition-all shrink-0 ${
                              allCatEnabled
                                ? 'bg-rose-500/90 hover:bg-rose-600 text-white'
                                : 'bg-[#F58220] hover:bg-[#d96b12] text-white shadow-2xs'
                            }`}
                          >
                            {allCatEnabled ? 'إيقاف القسم بالكامل' : 'تفعيل القسم بالكامل'}
                          </button>
                        </div>

                        {/* Section Permissions Grid */}
                        <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {catItems.map((perm) => {
                            const isGranted = Boolean(permissions[perm.key]);
                            return (
                              <div
                                key={perm.key}
                                onClick={() => handleTogglePermission(perm.key)}
                                className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                  isGranted
                                    ? 'bg-emerald-50/75 border-emerald-500/70 shadow-2xs'
                                    : 'bg-slate-50/80 border-slate-200 opacity-85 hover:opacity-100 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-black text-xs text-[#002855] leading-snug">
                                    {perm.label}
                                  </div>
                                  <div className="text-[10px] text-slate-600 font-semibold leading-snug mt-0.5">
                                    {perm.description}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTogglePermission(perm.key);
                                  }}
                                  className={`px-2.5 py-1.5 rounded-xl font-black text-[11px] flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                                    isGranted
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                                  }`}
                                >
                                  {isGranted ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      <span>مسموح</span>
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="w-3.5 h-3.5" />
                                      <span>ممنوع</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Section 7: Column-Level Permissions Matrix (14 Canonical Columns + Any Custom Columns, without Execution Status) */}
              {(selectedCategoryFilter === 'all' || selectedCategoryFilter === 'columns') && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="bg-gradient-to-l from-[#001D40] via-[#002855] to-[#004B8D] px-4 py-3 text-white flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#F58220]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 text-[#FDB813]">
                        <Columns3 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xs sm:text-sm font-black text-white">
                            القسم 7: مصفوفة صلاحيات أعمدة جدول أوامر العمل المعتمدة ({dynamicTableColumns.length} عموداً)
                          </h3>
                          <span className="px-2 py-0.5 rounded-md bg-white/15 text-[#FDB813] font-mono text-[10px] font-black">
                            مصرح: {allowedColumns.length} / {dynamicTableColumns.length} عمود
                          </span>
                        </div>
                        <p className="text-[10.5px] text-blue-100 font-bold mt-0.5">
                          متزامنة 100% مع هيكلة الجدول الحالية (بعد إزالة عمود حالة التنفيذ وإضافة أرشفة إجراء 155)
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSelectAllColumns(true)}
                        className="px-3 py-1.5 rounded-xl bg-[#F58220] hover:bg-[#d96b12] text-white text-[11px] font-black transition-colors cursor-pointer"
                      >
                        تفعيل كافة الأعمدة ({dynamicTableColumns.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectAllColumns(false)}
                        className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        إلغاء تحديد الأعمدة المقيدة
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {dynamicTableColumns
                      .filter(
                        (col) =>
                          !normalizedQuery ||
                          col.title.toLowerCase().includes(normalizedQuery) ||
                          col.field.toLowerCase().includes(normalizedQuery) ||
                          col.description.toLowerCase().includes(normalizedQuery)
                      )
                      .map((col, idx) => {
                        const isUniversal = Boolean(col.isUniversallyEditable);
                        const isAllowed = isUniversal || allowedColumns.includes(col.field);

                        return (
                          <div
                            key={col.field}
                            onClick={() => {
                              if (!isUniversal) {
                                handleToggleColumn(col.field);
                              }
                            }}
                            className={`p-3 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 ${
                              isUniversal
                                ? 'bg-amber-50/75 border-amber-400/80 shadow-2xs'
                                : isAllowed
                                ? 'bg-blue-50/75 border-blue-400/80 shadow-2xs cursor-pointer'
                                : 'bg-slate-50/80 border-slate-200 opacity-80 hover:opacity-100 cursor-pointer'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="w-5 h-5 rounded-md bg-[#002855] text-[#FDB813] font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <div className="font-black text-xs text-[#002855] truncate">
                                  {col.title}
                                </div>
                                {isUniversal && (
                                  <span className="px-1.5 py-0.2 rounded-md bg-amber-500 text-white font-black text-[9px] shadow-2xs shrink-0">
                                    مفتوح للجميع
                                  </span>
                                )}
                                {col.field === 'procedure155' && (
                                  <span className="px-1.5 py-0.2 rounded-md bg-indigo-700 text-[#FDB813] font-black text-[9px] shadow-2xs shrink-0">
                                    أرشفة 155
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-600 font-semibold leading-snug mt-1">
                                {col.description}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isUniversal) {
                                  handleToggleColumn(col.field);
                                }
                              }}
                              disabled={isUniversal}
                              className={`px-2.5 py-1.5 rounded-xl font-black text-[11px] flex items-center gap-1 shrink-0 transition-all ${
                                isUniversal
                                  ? 'bg-amber-600 text-white shadow-xs cursor-default'
                                  : isAllowed
                                  ? 'bg-[#004B8D] text-white shadow-xs cursor-pointer'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200 cursor-pointer'
                              }`}
                            >
                              {isUniversal ? (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                                  <span>متاح للجميع</span>
                                </>
                              ) : isAllowed ? (
                                <>
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>مسموح</span>
                                </>
                              ) : (
                                <>
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>محظور</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Submit Bar */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                  <span>
                    يتم حفظ الحساب والصلاحيات وبثها فوراً لجميع المتصلين في المنصة كإجراء نهائي معتمد
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {editingUserId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-black text-xs cursor-pointer"
                    >
                      إلغاء التعديل
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-l from-[#002855] via-[#003B73] to-[#004B8D] hover:from-[#F58220] hover:to-[#d96b12] text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-60 border border-[#F58220]/50"
                  >
                    <Save className="w-4 h-4 text-[#FDB813]" />
                    <span>
                      {isSaving
                        ? 'جاري الحفظ والمزامنة الفورية...'
                        : editingUserId
                        ? 'حفظ تعديلات الحساب والصلاحيات ومزامنتها'
                        : 'إنشاء الحساب واعتماد الصلاحيات فوراً'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* TAB 2: Registered Users & Super Admins List */
            <div className="space-y-5">
              {/* 1. Super Admins Card */}
              <div className="bg-white rounded-2xl border-2 border-[#002855]/25 p-5 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-[#F58220]" />
                    <h3 className="text-sm font-black text-[#002855]">
                      حساب المسؤول الرئيسي للمنظومة (صلاحية كاملة ومطلقة في كافة الأقسام والتبويبات)
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#002855] text-[#FDB813] text-xs font-mono font-black">
                    User: {SUPER_ADMIN_USERNAME} • مصادقة خادم مشفرة
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {SUPER_ADMIN_EMAILS.map((email) => (
                    <div
                      key={email}
                      className="p-4 rounded-2xl bg-gradient-to-l from-[#001D40] to-[#002855] text-white border border-[#F58220]/50 flex flex-col justify-between gap-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-md bg-[#F58220] text-white text-[10px] font-black">
                          {PRIMARY_SUPER_ADMIN_ROLE_TITLE}
                        </span>
                        <ShieldCheck className="w-4 h-4 text-[#FDB813]" />
                      </div>
                      <div className="font-black text-sm text-white">
                        {PRIMARY_SUPER_ADMIN_NAME} ({PRIMARY_SUPER_ADMIN_ROLE_TITLE})
                      </div>
                      <div className="font-mono font-bold text-xs text-blue-200 break-all" dir="ltr">
                        {email}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-white/15 text-[11px] font-mono text-blue-100">
                        <span>
                          User: <strong className="text-[#FDB813]">{SUPER_ADMIN_USERNAME}</strong>
                        </span>
                        <span className="text-emerald-300 font-bold">جميع التبويبات والأدوات والأعمدة مفعلة</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Custom Created Users List */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-[#002855]">
                      حسابات المستخدمين المسجلة ({customUsers.length})
                    </h3>
                    <p className="text-xs text-slate-500 font-bold">
                      يمكنك تعديل صلاحيات أي مستخدم أو تخصيص التبويبات والأعمدة المسموحة له أو تغيير كلمة المرور في أي وقت
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setActiveTab('create_edit');
                    }}
                    className="px-4 py-2 rounded-xl bg-[#F58220] hover:bg-[#d96b12] text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>إضافة مستخدم جديد</span>
                  </button>
                </div>

                {customUsers.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <Users className="w-10 h-10 text-slate-300 mx-auto" />
                    <div className="text-sm font-black text-[#002855]">
                      لم يتم إنشاء حسابات مستخدمين إضافية بعد
                    </div>
                    <p className="text-xs text-slate-500 max-w-md mx-auto font-bold">
                      اضغط على «إنشاء حساب ومنح صلاحيات» لإضافة مستخدم جديد وتحديد صلاحيات التبويبات الجانبية والإجراءات والأعمدة المسموحة له.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customUsers.map((u) => {
                      const grantedList = PERMISSION_DEFINITIONS.filter(
                        (d) => u.permissions && u.permissions[d.key]
                      );

                      return (
                        <div
                          key={u.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between gap-3 hover:border-[#004B8D] transition-colors"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-black text-sm text-[#002855] flex items-center gap-2">
                                  <span>{u.displayName || u.username}</span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      u.isActive !== false
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {u.isActive !== false ? 'نشط' : 'موقوف'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#F58220] font-black">
                                  {u.roleTitle || 'مستخدم بالمنصة'}
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleCopyCredentials(u)}
                                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                                  title="نسخ بيانات الدخول"
                                >
                                  {copiedId === u.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleLoadUserToEdit(u)}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#002855] hover:bg-[#004B8D] text-white font-black text-xs flex items-center gap-1 cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3 text-[#FDB813]" />
                                  <span>تعديل الصلاحيات</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteUser(u.id)}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer"
                                  title="حذف الحساب"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Credentials Box */}
                            <div className="bg-white rounded-xl p-2.5 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                              <div className="truncate">
                                <span className="text-[10px] text-slate-400 block font-sans">الإيميل:</span>
                                <span className="font-bold text-slate-800">{u.email}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block font-sans">اسم المستخدم (User):</span>
                                <span className="font-black text-[#004B8D]">{u.username}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-[10px] text-slate-400 block font-sans">كلمة المرور:</span>
                                  <span className="font-black text-emerald-700 text-[11px]">
                                    مشفرة ومحفوظة بالخادم
                                  </span>
                                </div>
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              </div>
                            </div>

                            {/* Per-Section Summary Badges */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                              {categories.map((cat) => {
                                const catTotal = PERMISSION_DEFINITIONS.filter((d) => d.category === cat.id);
                                const catGranted = catTotal.filter((d) => Boolean(u.permissions?.[d.key]));
                                return (
                                  <div
                                    key={cat.id}
                                    className="px-2 py-1 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-[10px]"
                                  >
                                    <span className="font-bold text-slate-700 truncate">{cat.shortTitle}</span>
                                    <span className="font-mono font-black text-[#004B8D]">
                                      {catGranted.length}/{catTotal.length}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Granted Permissions List */}
                            <div className="pt-1">
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="font-bold text-slate-600">
                                  إجمالي الصلاحيات الممنوحة ({grantedList.length} من {totalPermsCount}):
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                {grantedList.length === 0 ? (
                                  <span className="text-[10px] text-rose-600 font-bold">
                                    لا توجد أي صلاحيات مفعّلة لهذا المستخدم
                                  </span>
                                ) : (
                                  grantedList.map((g) => (
                                    <span
                                      key={g.key}
                                      className="px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-900 border border-emerald-200 text-[10px] font-bold"
                                    >
                                      {g.label}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>

                            {/* Allowed Table Columns Summary */}
                            <div className="pt-2 border-t border-slate-200/60">
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="font-bold text-slate-700">
                                  الأعمدة المصرح بتعديلها في الجدول:
                                </span>
                                <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-blue-100 text-[#002855]">
                                  {Array.isArray(u.allowedColumns)
                                    ? u.allowedColumns.length
                                    : dynamicTableColumns.length}{' '}
                                  من {dynamicTableColumns.length} عمود
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                                {dynamicTableColumns.map((col) => {
                                  const isUniversal = Boolean(col.isUniversallyEditable);
                                  const isColAllowed =
                                    isUniversal ||
                                    (Array.isArray(u.allowedColumns)
                                      ? u.allowedColumns.includes(col.field)
                                      : true);
                                  if (!isColAllowed) return null;
                                  return (
                                    <span
                                      key={col.field}
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                        isUniversal
                                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                          : 'bg-blue-50 text-[#002855] border border-blue-200'
                                      }`}
                                    >
                                      {col.title}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
