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
  Crown
} from 'lucide-react';
import { PlatformUser, UserPermissions, ColumnDefinition } from '../types';
import {
  SUPER_ADMIN_EMAILS,
  SUPER_ADMIN_USERNAME,
  FULL_PERMISSIONS,
  EMPTY_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  getMergedTableColumnsForPermissions,
  ensureDefaultSuperAdmins,
  isSuperAdminEmail,
  isPurgedLegacyUserOrEmail,
  PRIMARY_SUPER_ADMIN_NAME,
  PRIMARY_SUPER_ADMIN_ROLE_TITLE,
  normalizeMahmoudRoleTitle
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
    ...EMPTY_PERMISSIONS,
    addWorkOrder: true,
    editWorkOrderStatus: true,
    inlineTableEdit: true,
    auditPdcColumn: true,
    auditConstructionColumn: true,
    auditTechnicalSupportColumn: true,
    uploadInspectionFiles: true,
    exportTable: true,
    searchAndFilter: true,
    viewKpiDashboard: true,
    viewComprehensiveReports: true,
    viewNotesReport: true,
    viewContractorClosureReport: true,
    viewWeeklyReport: true,
    viewOfficeComparison: true
  });
  const [allowedColumns, setAllowedColumns] = useState<string[]>(() =>
    getMergedTableColumnsForPermissions(columns)
      .filter((c) => c.field !== 'procedure155')
      .map((c) => c.field)
  );

  const [showPassInForm, setShowPassInForm] = useState(true);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
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
      ...EMPTY_PERMISSIONS,
      addWorkOrder: true,
      editWorkOrderStatus: true,
      inlineTableEdit: true,
      auditPdcColumn: true,
      auditConstructionColumn: true,
      auditTechnicalSupportColumn: true,
      editProcedure155: false,
      uploadInspectionFiles: true,
      exportTable: true,
      searchAndFilter: true,
      viewKpiDashboard: true,
      viewComprehensiveReports: true,
      viewNotesReport: true,
      viewContractorClosureReport: true,
      viewWeeklyReport: true,
      viewOfficeComparison: true
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
    const hasProc155Perm = isPrimarySuper || Boolean(u.permissions?.editProcedure155);
    setEditingUserId(u.id);
    setUserEmail(u.email || '');
    setUsername(u.username || '');
    setPassword('');
    setDisplayName(u.displayName || '');
    setRoleTitle(u.roleTitle || 'مستخدم معتمد');
    setIsActive(u.isActive !== false);
    setPermissions(
      isPrimarySuper
        ? { ...FULL_PERMISSIONS }
        : { ...EMPTY_PERMISSIONS, ...(u.permissions || {}), editProcedure155: hasProc155Perm }
    );
    // Load allowed columns and synchronize procedure155 strictly with editProcedure155 permission
    const userCols = u.allowedColumns || u.permissions?.allowedColumns;
    const baseCols =
      Array.isArray(userCols)
        ? [...userCols]
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
      setPermissions((prev) => ({ ...prev, editProcedure155: true }));
    } else {
      // Keep universally editable columns (qualityNotes)
      setAllowedColumns(dynamicTableColumns.filter((c) => c.isUniversallyEditable).map((c) => c.field));
      setPermissions((prev) => ({ ...prev, editProcedure155: false }));
    }
  };

  const handleTogglePermission = (key: keyof UserPermissions) => {
    if (isSuperAdminEmail(userEmail)) {
      // Super admin emails always have full permissions
      setPermissions({ ...FULL_PERMISSIONS });
      setAllowedColumns(dynamicTableColumns.map((c) => c.field));
      return;
    }
    setPermissions((prev) => {
      const nextVal = !prev[key];
      if (key === 'editProcedure155') {
        setAllowedColumns((cols) =>
          nextVal
            ? Array.from(new Set([...cols, 'procedure155']))
            : cols.filter((f) => f !== 'procedure155')
        );
      }
      return {
        ...prev,
        [key]: nextVal
      };
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
      setAllowedColumns((cols) => cols.filter((f) => f !== 'procedure155'));
    }
  };

  const handleApplyPreset = (preset: 'full' | 'auditor' | 'reports_only' | 'none') => {
    if (isSuperAdminEmail(userEmail)) {
      setPermissions({ ...FULL_PERMISSIONS });
      setAllowedColumns(dynamicTableColumns.map((c) => c.field));
      return;
    }
    if (preset === 'full') {
      setPermissions({ ...FULL_PERMISSIONS });
      setAllowedColumns(dynamicTableColumns.map((c) => c.field));
      setRoleTitle('مسؤول بصلاحية كاملة');
    } else if (preset === 'auditor') {
      setPermissions({
        ...EMPTY_PERMISSIONS,
        addWorkOrder: true,
        editWorkOrderStatus: true,
        editWorkOrderBasic: true,
        inlineTableEdit: true,
        auditPdcColumn: true,
        auditConstructionColumn: true,
        auditTechnicalSupportColumn: true,
        editProcedure155: false,
        uploadInspectionFiles: true,
        importExcel: true,
        importCompatibleTables: true,
        exportTable: true,
        smartAudit: true,
        searchAndFilter: true,
        viewKpiDashboard: true,
        viewComprehensiveReports: true,
        viewNotesReport: true,
        viewContractorClosureReport: true,
        viewWeeklyReport: true,
        viewOfficeComparison: true,
        viewArchive: true
      });
      setAllowedColumns(
        dynamicTableColumns
          .filter((c) => c.field !== 'procedure155')
          .map((c) => c.field)
      );
      setRoleTitle('مدقق جودة ميداني');
    } else if (preset === 'reports_only') {
      setPermissions({
        ...EMPTY_PERMISSIONS,
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
      setAllowedColumns((cols) => cols.filter((f) => f !== 'procedure155'));
      setRoleTitle('مطلع تقارير ولوحات قياس');
    } else {
      setPermissions({ ...EMPTY_PERMISSIONS });
      setAllowedColumns((cols) => cols.filter((f) => f !== 'procedure155'));
    }
  };

  const handleToggleCategory = (category: 'tools' | 'reports' | 'structure' | 'system', enable: boolean) => {
    if (isSuperAdminEmail(userEmail)) return;
    const categoryKeys = PERMISSION_DEFINITIONS.filter((d) => d.category === category).map((d) => d.key);
    setPermissions((prev) => {
      const next = { ...prev };
      for (const k of categoryKeys) {
        (next as any)[k] = enable;
      }
      return next;
    });
    if (category === 'tools') {
      setAllowedColumns((cols) =>
        enable
          ? Array.from(new Set([...cols, 'procedure155']))
          : cols.filter((f) => f !== 'procedure155')
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
      const safeSlug = encodeURIComponent(cleanUser.replace(/\s+/g, '_')).replace(/%/g, '').toLowerCase() || `usr_${Date.now().toString().slice(-4)}`;
      cleanEmail = `${safeSlug}@platform.sec`;
    } else if (!cleanEmail.includes('@')) {
      const safeSlug = encodeURIComponent(cleanEmail.replace(/\s+/g, '_')).replace(/%/g, '').toLowerCase() || `usr_${Date.now().toString().slice(-4)}`;
      cleanEmail = `${safeSlug}@platform.sec`;
    }

    const isSuper = isSuperAdminEmail(cleanEmail);

    if (isPurgedLegacyUserOrEmail(cleanEmail) || isPurgedLegacyUserOrEmail(cleanUser)) {
      setFormError('هذا البريد الإلكتروني ملغى نهائياً من المنصة ولا يُسمح بإضافته.');
      return;
    }

    if (!isSuper && cleanUser === SUPER_ADMIN_USERNAME && !editingUserId) {
      setFormError('اسم المستخدم (831300) مخصص حصرياً للمسؤولين الرئيسيين للمنظومة. يرجى اختيار اسم مستخدم آخر للموظف (مثال: 831301 أو eng_ahmad).');
      return;
    }

    if (!editingUserId) {
      const duplicateEmail = allUsers.find(
        (u) => u.email?.toLowerCase().trim() === cleanEmail && !isSuperAdminEmail(cleanEmail)
      );
      if (duplicateEmail) {
        setFormError(`البريد الإلكتروني (${cleanEmail}) مسجل مسبقاً لمستخدم آخر. يمكنك تعديل حسابه من قائمة الحسابات المسجلة.`);
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
        (u) => u.id !== editingUserId && !u.isSuperAdmin && u.username?.toLowerCase().trim() === cleanUser.toLowerCase()
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
          (isSuper ? 'مدير عام المنظومة - صلاحية كاملة' : roleTitle.trim() || 'مستخدم معتمد'),
        isSuperAdmin: isSuper,
        isActive: isSuper ? true : isActive,
        permissions: isSuper
          ? { ...FULL_PERMISSIONS, allowedColumns: dynamicTableColumns.map((c) => c.field) }
          : { ...permissions, allowedColumns },
        allowedColumns: isSuper ? dynamicTableColumns.map((c) => c.field) : allowedColumns,
        createdByEmail: adminAuthorizerEmail
      });

      const msg = editingUserId
        ? `تم تحديث حساب وصلاحيات المستخدم (${cleanUser}) ومزامنتها فوراً`
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
    const text = `بيانات الدخول لمنصة حوكمة جودة اعمال الانشاءات:\nالبريد الإلكتروني: ${u.email}\nاسم المستخدم (User): ${u.username}\nكلمة المرور: [محفوظة ومشفرة على الخادم]`;
    navigator.clipboard?.writeText(text);
    setCopiedId(u.id);
    setTimeout(() => setCopiedId(null), 2000);
    if (onShowToast) onShowToast(`تم نسخ بيانات دخول المستخدم (${u.username})`, 'update');
  };

  const enabledCount = PERMISSION_DEFINITIONS.filter((d) => Boolean(permissions[d.key])).length;
  const totalPermsCount = PERMISSION_DEFINITIONS.length;

  const customUsers = allUsers.filter((u) => !isSuperAdminEmail(u.email) && !isPurgedLegacyUserOrEmail(u));

  const categories: { id: 'tools' | 'reports' | 'structure' | 'system'; title: string; badge: string }[] = [
    { id: 'tools', title: '1. صلاحيات أدوات الجدول وأوامر العمل', badge: 'الأدوات الأساسية' },
    { id: 'reports', title: '2. صلاحيات الاطلاع على التقارير ولوحات القياس (KPIs)', badge: 'التقارير والمقارنات' },
    { id: 'structure', title: '3. صلاحيات إدارة الجداول والهيكل والمكاتب والمقاولين', badge: 'إدارة الهيكل' },
    { id: 'system', title: '4. صلاحيات الصيانة المتقدمة وإدارة النظام', badge: 'إدارة النظام' }
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150 font-['Cairo',sans-serif]"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-l from-slate-950 via-emerald-950 to-slate-900 px-5 py-4 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 border border-emerald-300/40 flex items-center justify-center shadow-lg">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  إدارة الصلاحيات وحسابات المستخدمين
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black">
                  حوكمة جودة اعمال الانشاءات
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                إنشاء حسابات المستخدمين وتخصيص صلاحيات الأدوات والتقارير بدقة مع مزامنة سحابية فورية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Switch Tabs */}
            <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('create_edit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'create_edit'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
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
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
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
        <div className="bg-emerald-950/95 border-b border-emerald-800/60 px-5 py-2.5 text-white flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-black text-amber-300">
              <Crown className="w-4 h-4" />
              <span>أصحاب الصلاحية الكاملة لإنشاء المستخدمين ومنح الصلاحيات:</span>
            </span>
            {SUPER_ADMIN_EMAILS.map((email) => (
              <span
                key={email}
                className="px-2.5 py-0.5 rounded-lg bg-emerald-900/90 border border-emerald-500/40 text-emerald-100 font-mono font-bold text-[11px]"
              >
                {email}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono bg-slate-900/90 px-3 py-1 rounded-lg border border-slate-700">
            <span className="text-emerald-300 font-bold">إدارة مركزية موثقة</span>
          </div>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
          {activeTab === 'create_edit' ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {formError && (
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 text-rose-800 text-xs font-black flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-900 text-xs font-black flex items-center justify-between gap-2.5">
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

              {/* Section 1: User Account Credentials */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">
                        {editingUserId ? 'تعديل بيانات حساب المستخدم' : 'بيانات إنشاء حساب المستخدم الجديد'}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        أدخل البريد الإلكتروني واسم المستخدم (User) وكلمة المرور (Password) الخاصة بالمستخدم
                      </p>
                    </div>
                  </div>

                  {editingUserId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>إنشاء مستخدم جديد بدلاً من التعديل</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Authorizing Super Admin Email */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5">
                      مسؤول الصلاحيات المانح للحساب
                    </label>
                    <select
                      value={adminAuthorizerEmail}
                      onChange={(e) => setAdminAuthorizerEmail(e.target.value)}
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-emerald-600 text-slate-900 font-mono font-bold text-xs outline-none"
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
                    <label className="block text-xs font-black text-slate-700 mb-1.5">
                      البريد الإلكتروني للمستخدم (Email) <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                      <input
                        type="text"
                        inputMode="email"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        placeholder="user@example.com (أو اسم الموظف)"
                        dir="ltr"
                        className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-emerald-600 text-slate-900 font-mono font-bold text-xs text-right outline-none"
                      />
                    </div>
                  </div>

                  {/* Username (User) */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5">
                      اسم المستخدم للدخول (User) <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-emerald-600 absolute right-3.5 top-3" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="مثال: 831301 أو ahmad"
                        dir="ltr"
                        required
                        className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-emerald-600 text-slate-900 font-mono font-bold text-xs text-right outline-none"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5">
                      كلمة المرور (Password) {!editingUserId && <span className="text-rose-600">*</span>}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-amber-600 absolute right-3.5 top-3" />
                      <input
                        type={showPassInForm ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={editingUserId ? 'اتركها فارغة للاحتفاظ بكلمة المرور الحالية' : 'أدخل كلمة المرور للمستخدم'}
                        dir="ltr"
                        required={!editingUserId}
                        className="w-full pr-10 pl-10 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-emerald-600 text-slate-900 font-mono font-bold text-xs text-right outline-none"
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
                    <label className="block text-xs font-black text-slate-700 mb-1.5">
                      اسم المستخدم / الموظف (اختياري)
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="الاسم الظاهر في الإشعارات والمزامنة"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-emerald-600 text-slate-900 font-bold text-xs outline-none"
                    />
                  </div>

                  {/* Role / Job Title */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5">
                      المسمى الوظيفي / الدور
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={roleTitle}
                        onChange={(e) => setRoleTitle(e.target.value)}
                        placeholder="مثال: مهندس جودة / مدقق إجراء 155"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-emerald-600 text-slate-900 font-bold text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setIsActive((prev) => !prev)}
                        className={`px-3 py-2.5 rounded-xl font-black text-xs shrink-0 transition-all cursor-pointer border ${
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

              {/* Section 2: Granular Permissions Matrix */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-black text-slate-900">
                        تخصيص ومنح صلاحيات البرنامج للمستخدم
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                        مفعّل: {enabledCount} من {totalPermsCount} صلاحية
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      أي أداة أو تقرير غير مفعّل هنا لن يتمكن المستخدم من فتحه وستظهر له فوراً رسالة «لا توجد صلاحية»
                    </p>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetAllPermissions(true)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>منح كافة الصلاحيات (الكل)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('auditor')}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>صلاحيات مدقق جودة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('reports_only')}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <span>اطلاع وتقارير فقط</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllPermissions(false)}
                      className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 font-black text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>إلغاء الكل</span>
                    </button>
                  </div>
                </div>

                {/* Permission Categories */}
                <div className="space-y-6">
                  {categories.map((cat) => {
                    const catItems = PERMISSION_DEFINITIONS.filter((d) => d.category === cat.id);
                    const allCatEnabled = catItems.every((item) => permissions[item.key]);

                    return (
                      <div key={cat.id} className="space-y-3">
                        <div className="flex items-center justify-between bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xs sm:text-sm text-slate-900">
                              {cat.title}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 text-[10px] font-bold">
                              {cat.badge}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleCategory(cat.id, !allCatEnabled)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                                allCatEnabled
                                  ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                              }`}
                            >
                              {allCatEnabled ? 'إيقاف القسم' : 'تفعيل القسم بالكامل'}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {catItems.map((perm) => {
                            const isGranted = Boolean(permissions[perm.key]);
                            return (
                              <div
                                key={perm.key}
                                onClick={() => handleTogglePermission(perm.key)}
                                className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                  isGranted
                                    ? 'bg-emerald-50/70 border-emerald-500/60 shadow-2xs'
                                    : 'bg-slate-50/80 border-slate-200 opacity-80 hover:opacity-100'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-black text-xs text-slate-900 truncate">
                                    {perm.label}
                                  </div>
                                  <div className="text-[10px] text-slate-500 leading-snug mt-0.5">
                                    {perm.description}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTogglePermission(perm.key);
                                  }}
                                  className={`px-3 py-1.5 rounded-xl font-black text-[11px] flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                                    isGranted
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-rose-100 text-rose-700 border border-rose-200'
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
              </div>

              {/* Section 3: Column-Level Permissions Matrix (صلاحيات الأعمدة بالجدول بذكرها كلها) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-black text-slate-900">
                        صلاحيات الأعمدة في جدول أوامر العمل (تخصيص إمكانية تعديل أعمدة بعينها)
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-black">
                        مصرح: {allowedColumns.length} من {dynamicTableColumns.length} عمود
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      حدد بدقة الأعمدة التي يحق لهذا المستخدم تعديل خلاياها وقوائمها المنسدلة في الجدول (أي عمود جديد أو تعديل في المنصة يتزامن هنا تلقائياً). 
                      <span className="text-emerald-700 font-bold mx-1">
                        (ملاحظة هامة: عمود حالة اجراء 155 مقيد وغير متاح لأي مستخدم إلا بإعطاء صلاحية له، بينما عمود ملاحظات الجودة متاح للجميع).
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectAllColumns(true)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                    >
                      تحديد كافة الأعمدة ({dynamicTableColumns.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectAllColumns(false)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      إلغاء تحديد الكل (باستثناء المفتوحة للجميع)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {dynamicTableColumns.map((col, idx) => {
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
                            ? 'bg-amber-50/70 border-amber-400/80 shadow-2xs'
                            : isAllowed
                            ? 'bg-blue-50/70 border-blue-400/70 shadow-2xs cursor-pointer'
                            : 'bg-slate-50/80 border-slate-200 opacity-75 hover:opacity-100 cursor-pointer'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="font-black text-xs text-slate-900 truncate">
                              {col.title}
                            </div>
                            {isUniversal && (
                              <span className="px-1.5 py-0.2 rounded-md bg-amber-500 text-white font-black text-[9px] shadow-2xs shrink-0">
                                مفتوح للجميع
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 leading-snug mt-1 font-mono">
                            حقل: {col.field}
                          </div>
                          <div className="text-[10px] text-slate-600 leading-snug mt-0.5">
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
                              ? 'bg-blue-600 text-white shadow-xs cursor-pointer'
                              : 'bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer'
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

                {/* Submit Bar */}
                <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>
                      يتم حفظ الحساب والصلاحيات ومزامنتها فوراً لدى جميع المتصلين دون أي تأثير على سرعة المزامنة
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {editingUserId && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer"
                      >
                        إلغاء التعديل
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-60"
                    >
                      <Save className="w-4 h-4" />
                      <span>
                        {isSaving
                          ? 'جاري الحفظ والمزامنة...'
                          : editingUserId
                          ? 'حفظ تعديلات الحساب والصلاحيات'
                          : 'إنشاء الحساب واعتماد الصلاحيات'}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
          ) : (
            /* TAB 2: Registered Users & Super Admins List */
            <div className="space-y-5">
              {/* 1. Super Admins Card */}
              <div className="bg-white rounded-2xl border-2 border-emerald-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-500" />
                    <h3 className="text-sm font-black text-slate-900">
                      حسابات المسؤولين الرئيسيين (صلاحية كاملة ومطلقة في كل شيء)
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                    User: {SUPER_ADMIN_USERNAME} • مصادقة خادم مشفرة
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {SUPER_ADMIN_EMAILS.map((email) => (
                    <div
                      key={email}
                      className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/60 border border-emerald-200 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-emerald-700 text-white text-[10px] font-black">
                          {PRIMARY_SUPER_ADMIN_ROLE_TITLE}
                        </span>
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="font-black text-xs text-slate-900">
                        {PRIMARY_SUPER_ADMIN_NAME} ({PRIMARY_SUPER_ADMIN_ROLE_TITLE})
                      </div>
                      <div className="font-mono font-bold text-xs text-slate-700 break-all" dir="ltr">
                        {email}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60 text-[11px] font-mono text-slate-700">
                        <span>User: <strong>{SUPER_ADMIN_USERNAME}</strong></span>
                        <span className="text-emerald-700 font-bold">محمي على الخادم</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Custom Created Users List */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      حسابات المستخدمين المنشأة ({customUsers.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      يمكنك تعديل صلاحيات أي مستخدم أو تغيير كلمة المرور أو إيقاف الحساب في أي وقت
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setActiveTab('create_edit');
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>إضافة مستخدم جديد</span>
                  </button>
                </div>

                {customUsers.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <Users className="w-10 h-10 text-slate-300 mx-auto" />
                    <div className="text-sm font-black text-slate-700">
                      لم يتم إنشاء حسابات مستخدمين إضافية بعد
                    </div>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      اضغط على «إنشاء حساب ومنح صلاحيات» لإضافة مستخدم جديد عن طريق الإيميل وتحديد اسم المستخدم وكلمة المرور والصلاحيات المسموحة له.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customUsers.map((u) => {
                      const grantedList = PERMISSION_DEFINITIONS.filter(
                        (d) => u.permissions && u.permissions[d.key]
                      );
                      const isRevealed = Boolean(revealedPasswords[u.id]);

                      return (
                        <div
                          key={u.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between gap-3 hover:border-emerald-400 transition-colors"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-black text-sm text-slate-900 flex items-center gap-2">
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
                                <div className="text-[11px] text-slate-500 font-semibold">
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
                                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" />
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
                                <span className="font-black text-emerald-700">{u.username}</span>
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

                            {/* Granted Permissions Summary */}
                            <div className="pt-1">
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="font-bold text-slate-600">
                                  الصلاحيات الممنوحة ({grantedList.length} من {totalPermsCount}):
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
                                      className="px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 border border-emerald-200 text-[10px] font-bold"
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
                                <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-blue-100 text-blue-800">
                                  {Array.isArray(u.allowedColumns) ? u.allowedColumns.length : dynamicTableColumns.length} من {dynamicTableColumns.length} عمود
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                                {dynamicTableColumns.map((col) => {
                                  const isUniversal = Boolean(col.isUniversallyEditable);
                                  const isColAllowed = isUniversal || (Array.isArray(u.allowedColumns) ? u.allowedColumns.includes(col.field) : true);
                                  if (!isColAllowed) return null;
                                  return (
                                    <span
                                      key={col.field}
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                        isUniversal
                                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                                      }`}
                                    >
                                      {col.title} {isUniversal && '⭐'}
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
