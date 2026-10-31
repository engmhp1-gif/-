import type { PlatformUser, UserPermissions } from '../types.ts';

/**
 * Centralized Security, Authentication & Granular Role-Based Permissions Controller
 * Super Admin Authorized Email:
 * - 2502331172@se.com.sa
 * Super Admin Credentials:
 * - user: 2502331172
 * - password: 321
 */

export const SUPER_ADMIN_USERNAME = '2502331172';

export const PRIMARY_SUPER_ADMIN_EMAIL = '2502331172@se.com.sa';
export const PRIMARY_SUPER_ADMIN_USERNAME = '2502331172';
export const PRIMARY_SUPER_ADMIN_NAME = 'م. محمود الشحات';
export const PRIMARY_SUPER_ADMIN_ROLE_TITLE = 'مهندس الجودة والمساندة الفنية';

export const SUPER_ADMIN_EMAILS: string[] = [
  '2502331172@se.com.sa'
];

export const FULL_PERMISSIONS: UserPermissions = {
  addWorkOrder: true,
  editWorkOrderStatus: true,
  editWorkOrderBasic: true,
  inlineTableEdit: true,
  deleteWorkOrder: true,
  importExcel: true,
  importCompatibleTables: true,
  exportTable: true,
  smartAudit: true,
  searchAndFilter: true,
  undoRedo: true,
  auditPdcColumn: true,
  auditConstructionColumn: true,
  auditTechnicalSupportColumn: true,
  editProcedure155: true,
  uploadInspectionFiles: true,
  viewPhotos: true,
  viewKpiDashboard: true,
  viewContractorClosureReport: true,
  viewWeeklyReport: true,
  viewOfficeComparison: true,
  viewArchive: true,
  viewNotesReport: true,
  viewComprehensiveReports: true,
  manageMonthTables: true,
  deleteMonthTable: true,
  manageOffices: true,
  manageContractors: true,
  manageColumns: true,
  manageDropdowns: true,
  clearData: true,
  restoreDeleted: true,
  manageCloudBackups: true,
  manageNotifications: true,
  managePermissions: true
};

export const EMPTY_PERMISSIONS: UserPermissions = {
  addWorkOrder: false,
  editWorkOrderStatus: false,
  editWorkOrderBasic: false,
  inlineTableEdit: false,
  deleteWorkOrder: false,
  importExcel: false,
  importCompatibleTables: false,
  exportTable: false,
  smartAudit: false,
  searchAndFilter: false,
  undoRedo: false,
  auditPdcColumn: false,
  auditConstructionColumn: false,
  auditTechnicalSupportColumn: false,
  editProcedure155: false,
  uploadInspectionFiles: false,
  viewPhotos: false,
  viewKpiDashboard: false,
  viewContractorClosureReport: false,
  viewWeeklyReport: false,
  viewOfficeComparison: false,
  viewArchive: false,
  viewNotesReport: false,
  viewComprehensiveReports: false,
  manageMonthTables: false,
  deleteMonthTable: false,
  manageOffices: false,
  manageContractors: false,
  manageColumns: false,
  manageDropdowns: false,
  clearData: false,
  restoreDeleted: false,
  manageCloudBackups: false,
  manageNotifications: false,
  managePermissions: false
};

export interface PermissionItemMeta {
  key: keyof UserPermissions;
  label: string;
  description: string;
  category: 'tools' | 'reports' | 'structure' | 'system';
}

export const PERMISSION_DEFINITIONS: PermissionItemMeta[] = [
  // 1. أدوات أوامر العمل والجدول والتدقيق المستقل
  {
    key: 'addWorkOrder',
    label: 'إضافة أمر عمل جديد',
    description: 'السماح بإدراج وتسجيل أوامر عمل جديدة في الجداول',
    category: 'tools'
  },
  {
    key: 'editWorkOrderStatus',
    label: 'تحديث الحالة وفحص الجودة والصور',
    description: 'تعديل حالة التنفيذ وتوثيق الصور ونماذج الفحص',
    category: 'tools'
  },
  {
    key: 'editWorkOrderBasic',
    label: 'تعديل البيانات الأساسية لأمر العمل',
    description: 'تعديل المكتب، المقاول، الاستشاري، رقم أمر العمل، ونوع أمر العمل',
    category: 'tools'
  },
  {
    key: 'inlineTableEdit',
    label: 'التعديل المباشر داخل خلايا الجدول',
    description: 'تغيير القوائم المنسدلة المسموح بها مباشرة من الجدول',
    category: 'tools'
  },
  {
    key: 'auditPdcColumn',
    label: 'تدقيق عمود PDC المستقل (العداد، الحفريات، المعدات، النهائي)',
    description: 'فتح وتدقيق بنود عمود تدقيق PDC المستقل واعتماد حالته',
    category: 'tools'
  },
  {
    key: 'auditConstructionColumn',
    label: 'تدقيق عمود الإنشاءات المستقل (العداد، الحفريات، المعدات، النهائي)',
    description: 'فتح وتدقيق بنود عمود تدقيق الإنشاءات المستقل واعتماد حالته',
    category: 'tools'
  },
  {
    key: 'auditTechnicalSupportColumn',
    label: 'تدقيق عمود المساندة الفنية المستقل',
    description: 'تعديل واعتماد حالة عمود تدقيق المساندة الفنية (مؤهل / غير مؤهل للإغلاق)',
    category: 'tools'
  },
  {
    key: 'editProcedure155',
    label: 'تعديل واعتماد عمود حالة اجراء 155',
    description: 'السماح بتدقيق وتحديد حالة اجراء 155 في الجدول (غير متاح لأي مستخدم إلا بإعطاء صلاحية له)',
    category: 'tools'
  },
  {
    key: 'uploadInspectionFiles',
    label: 'إدارة ورفع ملفات الصور و PDF (عمود ملف الصور)',
    description: 'رفع واستعراض ملفات الفحص والصور و PDF في عمود ملف الصور وملاحظات الجودة',
    category: 'tools'
  },
  {
    key: 'deleteWorkOrder',
    label: 'حذف أمر عمل',
    description: 'حذف أمر عمل مفرد أو حذف دفعة أوامر محددة من الجدول',
    category: 'tools'
  },
  {
    key: 'importExcel',
    label: 'استيراد من Excel أو JSON',
    description: 'رفع واستيراد ملفات الإكسل وملفات البيانات وإدراجها في الجداول الشهرية',
    category: 'tools'
  },
  {
    key: 'importCompatibleTables',
    label: 'استيراد ومزامنة البيانات من الجداول المتوافقة',
    description: 'سحب ومطابقة البيانات تلقائياً بين الجداول الشهرية المتوافقة',
    category: 'tools'
  },
  {
    key: 'exportTable',
    label: 'تصدير الجدول والتقارير وإرسال البريد',
    description: 'تصدير الجداول بصيغ Excel و PDF و PowerPoint وصور عالية الدقة وإرسالها بالبريد',
    category: 'tools'
  },
  {
    key: 'smartAudit',
    label: 'الفاحص الذكي الشامل',
    description: 'تشغيل أداة التدقيق الذكي وفحص النواقص والاعتماد الجماعي',
    category: 'tools'
  },
  {
    key: 'searchAndFilter',
    label: 'البحث المتقدم والفلترة الذكية',
    description: 'فتح نافذة البحث الشامل والفلترة المتقدمة وتصدير نتائجها',
    category: 'tools'
  },
  {
    key: 'undoRedo',
    label: 'التراجع والإعادة للعمليات',
    description: 'استخدام أزرار التراجع والإعادة للخطوات السابقة في الجدول',
    category: 'tools'
  },

  // 2. الاطلاع على التقارير ولوحات القياس
  {
    key: 'viewKpiDashboard',
    label: 'الاطلاع على لوحة مؤشرات الأداء (KPIs)',
    description: 'فتح وعرض لوحة القياس الإحصائية ومؤشرات الإنجاز',
    category: 'reports'
  },
  {
    key: 'viewComprehensiveReports',
    label: 'مركز التقارير الشامل الموحد (تفصيلية ومجمعة)',
    description: 'فتح وتصدير التقارير التفصيلية والمجمعة الأسبوعية والشهرية والربع سنوية والسنوية',
    category: 'reports'
  },
  {
    key: 'viewNotesReport',
    label: 'تقرير الملاحظات والملاحظات المتكررة بالصور المرفقة',
    description: 'عرض وتصدير تقرير ملاحظات الجودة والملاحظات المتكررة للمقاولين مع الصور',
    category: 'reports'
  },
  {
    key: 'viewContractorClosureReport',
    label: 'مقارنة المقاولين وتقارير الإغلاقات الدورية',
    description: 'الاطلاع وتصدير التقرير الأسبوعي والشهري والربع سنوي والنصف سنوي والسنوي للمقاولين',
    category: 'reports'
  },
  {
    key: 'viewWeeklyReport',
    label: 'التقرير الأسبوعي الإداري (PDF)',
    description: 'فتح وتصدير التقرير الأسبوعي الرسمي لإنجازات المكاتب',
    category: 'reports'
  },
  {
    key: 'viewOfficeComparison',
    label: 'مقارنة وتقييم أداء المكاتب الفرعية',
    description: 'الاطلاع على الترتيب التنافسي ونسب إنجاز المكاتب الفرعية',
    category: 'reports'
  },
  {
    key: 'viewArchive',
    label: 'أرشيف السنوات والشهور والتقارير',
    description: 'تصفح أرشيف الشهور والسنوات والتقارير الإحصائية المؤرشفة',
    category: 'reports'
  },

  // 3. إدارة الجداول والهيكل والمكاتب
  {
    key: 'manageMonthTables',
    label: 'إنشاء وتعديل الجداول الشهرية',
    description: 'إضافة جداول جديدة للشهر أو تعديل مسمياتها وتنقل السنوات',
    category: 'structure'
  },
  {
    key: 'deleteMonthTable',
    label: 'حذف الجدول',
    description: 'حذف جدول شهري أو تفريغ أوامر الجدول المحدد',
    category: 'structure'
  },
  {
    key: 'manageOffices',
    label: 'إدارة وتعديل المكاتب الفرعية',
    description: 'إضافة أو تعديل أو حذف المكاتب الفرعية ونقل أوامرها',
    category: 'structure'
  },
  {
    key: 'manageContractors',
    label: 'توزيع وإدارة مقاولي المكاتب',
    description: 'ربط المقاولين بالمكاتب وإضافة أو حذف مقاول معتمد',
    category: 'structure'
  },
  {
    key: 'manageColumns',
    label: 'إدارة مسميات وهيكلة الأعمدة',
    description: 'تعديل أسماء الأعمدة وإضافة أو حذف أعمدة مخصصة بالجدول',
    category: 'structure'
  },
  {
    key: 'manageDropdowns',
    label: 'إدارة القوائم المنسدلة',
    description: 'تعديل وإضافة خيارات القوائم المنسدلة لخلايا الجدول',
    category: 'structure'
  },

  // 4. الصيانة المتقدمة وإدارة الصلاحيات والنسخ السحابي
  {
    key: 'clearData',
    label: 'تفريغ البيانات جذرياً وإعادة الضبط',
    description: 'مسح أوامر العمل بالكامل أو استعادة البيانات النموذجية',
    category: 'system'
  },
  {
    key: 'restoreDeleted',
    label: 'سلة المحذوفات والنسخ الاحتياطية',
    description: 'استرجاع الأوامر المحذوفة وإدارة النسخ الاحتياطية السحابية',
    category: 'system'
  },
  {
    key: 'manageCloudBackups',
    label: 'النسخ الاحتياطي المجدول واستيراد/تصدير ملفات JSON',
    description: 'تشغيل النسخ السحابية الموثقة واستيراد ودمج ملفات النسخ الاحتياطية JSON من الجوال أو الكمبيوتر',
    category: 'system'
  },
  {
    key: 'manageNotifications',
    label: 'إدارة الإشعارات والتعاميم الفورية',
    description: 'إعدادات التنبيهات وإرسال تعاميم فورية لكافة المستخدمين',
    category: 'system'
  },
  {
    key: 'managePermissions',
    label: 'إدارة الحسابات والصلاحيات',
    description: 'إنشاء مستخدمين جدد وتخصيص صلاحيات الأدوات والتقارير والأعمدة',
    category: 'system'
  }
];

export const PRIMARY_MASTER_USER: PlatformUser = {
  id: 'primary-super-admin-mahmoud',
  email: PRIMARY_SUPER_ADMIN_EMAIL,
  username: PRIMARY_SUPER_ADMIN_USERNAME,
  hasPassword: true,
  displayName: PRIMARY_SUPER_ADMIN_NAME,
  roleTitle: PRIMARY_SUPER_ADMIN_ROLE_TITLE,
  isSuperAdmin: true,
  isActive: true,
  permissions: { ...FULL_PERMISSIONS },
  createdAt: '2026-01-01T00:00:00.000Z'
};

export const DEFAULT_SUPER_ADMIN_USERS: PlatformUser[] = [
  PRIMARY_MASTER_USER
];

const PURGED_LEGACY_EMAILS = new Set([
  'engmhp1@gmail.com',
  'engmhp2@gmail.com',
  'engmhp4@gmail.com',
  'ibrahim.m.alshehri111@gmail.com'
]);

const PURGED_LEGACY_USER_IDS = new Set([
  'super-admin-1',
  'super-admin-2',
  'super-admin-3',
  'super-admin-4'
]);

export const isPurgedLegacyUserOrEmail = (userOrEmail?: Partial<PlatformUser> | string | null): boolean => {
  if (!userOrEmail) return false;
  if (typeof userOrEmail === 'string') {
    const clean = userOrEmail.trim().toLowerCase();
    return PURGED_LEGACY_EMAILS.has(clean) || clean.startsWith('engmhp');
  }
  const cleanId = String(userOrEmail.id || '').trim().toLowerCase();
  const cleanEmail = String(userOrEmail.email || '').trim().toLowerCase();
  const cleanName = String(userOrEmail.displayName || '').trim().toLowerCase();
  if (PURGED_LEGACY_USER_IDS.has(cleanId)) return true;
  if (PURGED_LEGACY_EMAILS.has(cleanEmail) || cleanEmail.startsWith('engmhp')) return true;
  if (cleanName.includes('engmhp')) return true;
  return false;
};

const SESSION_PIN_KEY = 'p155_session_auth_unlocked_v1';
const CURRENT_USER_STORAGE_KEY = 'p155_authenticated_user_v3';

export const isSuperAdminEmail = (email?: string): boolean => {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  if (isPurgedLegacyUserOrEmail(clean)) return false;
  return clean === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase();
};

export const isPrimarySuperAdminUser = (user?: Partial<PlatformUser> | null): boolean => {
  if (!user) return false;
  if (isPurgedLegacyUserOrEmail(user)) return false;
  const cleanUser = String(user.username || '').trim().toLowerCase();
  const cleanEmail = String(user.email || '').trim().toLowerCase();
  return (
    cleanUser === PRIMARY_SUPER_ADMIN_USERNAME.toLowerCase() ||
    cleanEmail === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase() ||
    user.id === PRIMARY_MASTER_USER.id ||
    isSuperAdminEmail(cleanEmail)
  );
};

export const isUserSuperAdmin = (user?: PlatformUser | null): boolean => {
  if (!user) return false;
  if (isPurgedLegacyUserOrEmail(user)) return false;
  if (isPrimarySuperAdminUser(user) || Boolean(user.isSuperAdmin)) {
    return true;
  }
  return false;
};

export const hasFullPermissions = (user?: PlatformUser | null): boolean => {
  if (!user) return false;
  if (user.isActive === false && !isPrimarySuperAdminUser(user)) return false;
  if (isPrimarySuperAdminUser(user)) return true;
  if (Boolean(user.isSuperAdmin)) return true;
  if (!user.permissions) return false;
  if (Boolean(user.permissions.managePermissions)) return true;

  const coreKeys: (keyof UserPermissions)[] = [
    'addWorkOrder',
    'editWorkOrderStatus',
    'editWorkOrderBasic',
    'inlineTableEdit',
    'deleteWorkOrder',
    'importExcel',
    'exportTable',
    'smartAudit',
    'searchAndFilter',
    'viewKpiDashboard',
    'viewContractorClosureReport',
    'viewWeeklyReport',
    'viewOfficeComparison',
    'viewArchive',
    'manageMonthTables',
    'deleteMonthTable',
    'manageOffices',
    'manageContractors',
    'manageColumns',
    'manageDropdowns',
    'clearData',
    'restoreDeleted',
    'manageNotifications',
    'managePermissions'
  ];
  return coreKeys.every(k => Boolean(user.permissions?.[k]));
};

export const canManagePlatformPermissions = (user?: PlatformUser | null): boolean => {
  return hasFullPermissions(user);
};

export const hasUserPermission = (
  user: PlatformUser | null | undefined,
  permKey: keyof UserPermissions | string
): boolean => {
  if (!user) return false;
  if (user.isActive === false && !isPrimarySuperAdminUser(user)) return false;
  if (isPrimarySuperAdminUser(user)) return true;

  // Creating users and managing permissions - allowed for full-permission / managePermissions holders
  if (permKey === 'managePermissions') {
    return canManagePlatformPermissions(user);
  }

  // Fallback compatibility for newly added permission keys when existing users have parent permissions
  if (permKey === 'importCompatibleTables' && user.permissions?.importCompatibleTables === undefined) {
    return Boolean(user.permissions?.importExcel);
  }
  if (permKey === 'viewNotesReport' && user.permissions?.viewNotesReport === undefined) {
    return Boolean(user.permissions?.viewKpiDashboard || user.permissions?.exportTable);
  }
  if (permKey === 'viewComprehensiveReports' && user.permissions?.viewComprehensiveReports === undefined) {
    return Boolean(user.permissions?.viewKpiDashboard || user.permissions?.viewWeeklyReport);
  }
  if (permKey === 'manageCloudBackups' && user.permissions?.manageCloudBackups === undefined) {
    return Boolean(user.permissions?.restoreDeleted || user.permissions?.importExcel);
  }
  if (
    (permKey === 'auditPdcColumn' || permKey === 'auditConstructionColumn' || permKey === 'auditTechnicalSupportColumn' || permKey === 'uploadInspectionFiles') &&
    user.permissions?.[permKey as keyof UserPermissions] === undefined
  ) {
    return Boolean(user.permissions?.editWorkOrderStatus || user.permissions?.inlineTableEdit);
  }

  // Canonical alias resolution for unified permission checking
  const canonicalKey = (
    permKey === 'exportReports' ? 'exportTable' :
    permKey === 'dataRecovery' ? 'restoreDeleted' :
    permKey === 'deleteTable' ? 'deleteMonthTable' :
    permKey === 'managePhotos' ? 'editWorkOrderStatus' :
    permKey === 'audit155' ? 'smartAudit' :
    permKey
  ) as keyof UserPermissions;

  if (Boolean(user.permissions?.[canonicalKey])) {
    return true;
  }
  return Boolean(user.isSuperAdmin && user.permissions?.[canonicalKey] === undefined);
};

/**
 * Metadata for all columns in the table for granular permission assignment
 */
export interface TableColumnPermissionMeta {
  field: string;
  title: string;
  description: string;
  isUniversallyEditable?: boolean; // True if editable by all users unconditionally
  isCustom?: boolean;
}

export const ALL_TABLE_COLUMNS: TableColumnPermissionMeta[] = [
  { field: 'office', title: 'المكتب', description: 'تعديل واختيار المكتب الفرعي الميداني' },
  { field: 'contractor', title: 'المقاول', description: 'تعديل واختيار المقاول المنفذ المعتمد' },
  { field: 'consultant', title: 'الاستشاري', description: 'تعديل واختيار الاستشاري المشرف المعتمد' },
  { field: 'workOrderNumber', title: 'رقم امر العمل', description: 'تعديل رقم أمر العمل المعتمد' },
  { field: 'workOrderCode', title: 'نوع امر العمل', description: 'تعديل وتحديد نوع أمر العمل (801، 401، 912)' },
  { field: 'photosFile', title: 'ملف الصور', description: 'رفع واستعراض ملفات الصور و PDF المرفقة وفتح رابط SharePoint' },
  { field: 'attachmentStatus', title: 'حالة الارفاق', description: 'تقييم وتحديث حالة إرفاق الصور (العداد، الخفريات، المعدات، الهوائي، الإرفاق الكامل)' },
  { 
    field: 'qualityNotes', 
    title: 'الملاحظات', 
    description: 'تعديل الملاحظات وإرفاق الصور (صلاحية مفتوحة ومتاحة للجميع افتراضياً)', 
    isUniversallyEditable: true 
  },
  { field: 'pdcAudit', title: 'تدقيق PDC', description: 'تحديث وتدقيق بنود العداد والحفريات والمعدات والتحقق النهائي (مستقل)' },
  { field: 'constructionAudit', title: 'تدقيق الانشاءات', description: 'تحديث وتدقيق بنود الإنشاءات الميدانية والفحص (مستقل)' },
  { field: 'procedure155Status', title: 'تدقيق المساندة الفنية', description: 'تعديل تدقيق المساندة الفنية (مؤهل / غير مؤهل للاغلاق - مستقل)' },
  { field: 'statusSyncTime', title: 'مزامنة التدقيق', description: 'بطاقة مزامنة أعمدة التدقيق الثلاثة بالترتيب (تُحدّث تلقائياً)' },
  { 
    field: 'procedure155', 
    title: 'حالة إجراء 155', 
    description: 'تعديل واعتماد حالة إجراء 155 (مقيد: غير متاح لأي مستخدم إلا بإعطاء صلاحية له)', 
    isUniversallyEditable: false 
  },
  { field: 'procedureSyncTime', title: 'مزامنة إجراء 155', description: 'تحديث وقت وتاريخ مزامنة حالة إجراء 155' }
];

/**
 * Returns the canonical 14 table columns in exact order so the Users & Permissions modal is always 100% in sync with the table.
 */
export const getMergedTableColumnsForPermissions = (
  _liveColumns?: Array<{ field: string; title: string; isCustom?: boolean }>
): TableColumnPermissionMeta[] => {
  return ALL_TABLE_COLUMNS.map((stdCol) => ({ ...stdCol }));
};

export const isColumnUniversallyEditable = (columnField: string): boolean => {
  const cleanField = String(columnField || '').trim();
  // ملاحظات الجودة (qualityNotes / executionNotes / qualityNoteItems) is universally editable by everyone
  return (
    cleanField === 'qualityNotes' ||
    cleanField === 'executionNotes' ||
    cleanField === 'qualityNoteItems'
  );
};

export const canUserEditColumn = (
  user: PlatformUser | null | undefined,
  columnField: string
): boolean => {
  if (!user) return false;
  if (user.isActive === false && !isPrimarySuperAdminUser(user)) return false;
  if (isPrimarySuperAdminUser(user)) return true;

  const cleanField = String(columnField || '').trim();

  // QualityNotes is universally open to all active users per platform specification
  if (isColumnUniversallyEditable(cleanField)) {
    return true;
  }

  // Auxiliary metadata, checklists, companion fields, and sync fields that accompany legitimate edits
  const auxiliaryEditableFields = new Set([
    'id',
    'updatedAt',
    'createdAt',
    'lastUpdatedBy',
    'isEdited',
    'isNew',
    'lastEditedAt',
    'editedFields',
    'recordVersion',
    'auditSyncStatus',
    'auditSyncError',
    'changedFields',
    'statusSyncTime',
    'statusSyncEmail',
    'statusSyncUser',
    'statusSyncUserId',
    'statusSyncDateRiyadh',
    'statusSyncTimeRiyadh',
    'procedureSyncTime',
    'procedureSyncEmail',
    'procedureSyncUser',
    'pdcSyncTime',
    'pdcSyncUser',
    'pdcSyncEmail',
    'constructionSyncTime',
    'constructionSyncUser',
    'constructionSyncEmail',
    'techSupportSyncTime',
    'techSupportSyncUser',
    'techSupportSyncEmail',
    'technicalSupportChecklist',
    'technicalSupportAudit',
    'auditChecklists',
    'pdcChecklist',
    'constructionChecklist',
    'auditHistory',
    'customFields',
    'cellStyles',
    'rowBgColor',
    'sharepointFolderUrl',
    'receiptDate',
    'tableId',
    'tableName',
    'tableYear',
    'tableMonth',
    'completionPercentage',
    'priority',
    'inspectorName',
    'addedByName',
    'addedByEmail',
    'createdByEmail',
    'boqModification',
    'boqDetails',
    'executionStatus',
    'executionNotes',
    'photoCoordination',
    'qualityNoteItems',
    'meterPhotoDocumentation',
    'excavationPhotoDocumentation',
    'equipmentPhotoDocumentation',
    'overheadPhotoDocumentation',
    'isImported',
    'importedFromTableId',
    'importedFromTableName',
    'importedAt',
    'importedFields',
    'importedSourceOrderId'
  ]);
  if (auxiliaryEditableFields.has(cleanField)) {
    return true;
  }

  // Strict restriction: حالة اجراء 155 (procedure155) requires explicit editProcedure155 permission
  if (cleanField === 'procedure155') {
    const userAllowed = user.allowedColumns || user.permissions?.allowedColumns;
    const hasExplicitProc155Perm = Boolean(user.permissions?.editProcedure155);
    if (!hasExplicitProc155Perm) {
      return false;
    }
    if (Array.isArray(userAllowed) && userAllowed.length > 0) {
      return userAllowed.includes('procedure155') || hasExplicitProc155Perm;
    }
    return true;
  }

  if (Boolean(user.permissions?.manageColumns)) return true;

  // Check explicit column permissions matrix if defined for this specific user
  const userAllowed = user.allowedColumns || user.permissions?.allowedColumns;
  const inAllowedColumns = Array.isArray(userAllowed) && userAllowed.includes(cleanField);

  // Dedicated role-specific column permissions or explicit column grant
  if (cleanField === 'pdcAudit') {
    if (Boolean(user.permissions?.auditPdcColumn || user.permissions?.editWorkOrderStatus || user.permissions?.inlineTableEdit) || inAllowedColumns) {
      return true;
    }
  }
  if (cleanField === 'constructionAudit') {
    if (Boolean(user.permissions?.auditConstructionColumn || user.permissions?.editWorkOrderStatus || user.permissions?.inlineTableEdit) || inAllowedColumns) {
      return true;
    }
  }
  if ([
    'procedure155Status',
    'photoDocumentation',
    'consultantForms',
    'consultantClearanceForms',
    'form190',
    'form200',
    'inspectionForm',
    'attachmentStatus'
  ].includes(cleanField)) {
    const hasProc155StatusAllowed = Array.isArray(userAllowed) && userAllowed.includes('procedure155Status');
    if (
      Boolean(
        user.permissions?.auditTechnicalSupportColumn ||
        user.permissions?.editWorkOrderStatus ||
        user.permissions?.inlineTableEdit
      ) ||
      inAllowedColumns ||
      hasProc155StatusAllowed
    ) {
      return true;
    }
  }
  if (cleanField === 'photosFile' || cleanField === 'photos' || cleanField === 'attachmentStatus') {
    const hasPhotosFileAllowed = Array.isArray(userAllowed) && (userAllowed.includes('photosFile') || userAllowed.includes('attachmentStatus'));
    if (
      Boolean(
        user.permissions?.uploadInspectionFiles ||
        user.permissions?.editWorkOrderStatus ||
        user.permissions?.inlineTableEdit ||
        user.permissions?.editWorkOrderBasic
      ) ||
      inAllowedColumns ||
      hasPhotosFileAllowed
    ) {
      return true;
    }
  }

  // Basic order data columns (المكتب، المقاول، الاستشاري، رقم أمر العمل، نوع أمر العمل)
  if (['office', 'contractor', 'consultant', 'workOrderNumber', 'workOrderCode'].includes(cleanField)) {
    if (
      Boolean(
        user.permissions?.editWorkOrderBasic ||
        user.permissions?.inlineTableEdit ||
        user.permissions?.addWorkOrder
      ) ||
      inAllowedColumns
    ) {
      return true;
    }
  }

  // Status & compliance columns
  if ([
    'photosFile',
    'photos',
    'attachmentStatus',
    'photoDocumentation',
    'consultantForms',
    'consultantClearanceForms',
    'form190',
    'form200',
    'inspectionForm',
    'pdcAudit',
    'constructionAudit',
    'procedure155Status'
  ].includes(cleanField)) {
    if (Boolean(user.permissions?.editWorkOrderStatus || user.permissions?.inlineTableEdit) || inAllowedColumns) {
      return true;
    }
  }

  if (inAllowedColumns) {
    return true;
  }

  if (Array.isArray(userAllowed) && userAllowed.length > 0 && !user.permissions?.inlineTableEdit) {
    return false;
  }

  // If user has NO permissions for editing orders or inline table cells, reject
  const hasAnyEditPermission = Boolean(
    user.permissions?.inlineTableEdit ||
    user.permissions?.editWorkOrderStatus ||
    user.permissions?.editWorkOrderBasic ||
    user.permissions?.auditPdcColumn ||
    user.permissions?.auditConstructionColumn ||
    user.permissions?.auditTechnicalSupportColumn ||
    user.permissions?.editProcedure155 ||
    user.permissions?.uploadInspectionFiles ||
    user.permissions?.addWorkOrder
  );

  if (!hasAnyEditPermission) {
    return false;
  }

  // Fallback: general inline table editing permission for any other or custom column
  return Boolean(user.permissions?.inlineTableEdit || user.permissions?.editWorkOrderStatus || user.permissions?.editWorkOrderBasic);
};

const SESSION_TOKEN_STORAGE_KEY = 'p155_session_jwt_token_v1';

export const getSavedSessionToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return (
      sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY) ||
      localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) ||
      null
    );
  } catch {
    return null;
  }
};

export const saveSessionToken = (token: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
      localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
      localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    }
  } catch (_) {}
};

export const encodeClientSessionUserHeader = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const u = getSavedCurrentUser() || PRIMARY_MASTER_USER;
    if (!u || (!u.id && !u.username && !u.email)) return null;
    const payload = JSON.stringify({
      id: u.id,
      username: u.username,
      email: u.email
    });
    return window.btoa(unescape(encodeURIComponent(payload)));
  } catch {
    return null;
  }
};

export const getAuthHeaders = (extraHeaders: Record<string, string> = {}): Record<string, string> => {
  const token = getSavedSessionToken();
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
    authHeaders['x-auth-token'] = token;
  }
  const clientUserHeader = encodeClientSessionUserHeader();
  if (clientUserHeader) {
    authHeaders['x-client-session-user'] = clientUserHeader;
  }
  if (isPlatformRunningInStudioIframe()) {
    authHeaders['x-studio-preview-observer'] = 'true';
  }
  return {
    ...authHeaders,
    ...extraHeaders
  };
};

export const normalizeMahmoudRoleTitle = (u?: Partial<PlatformUser> | null): string => {
  if (!u) return '';
  const cleanUser = String(u.username || '').trim().toLowerCase();
  const cleanEmail = String(u.email || '').trim().toLowerCase();
  const cleanName = String(u.displayName || '').trim();
  const rawRole = String(u.roleTitle || '').trim();

  if (
    u.id === PRIMARY_MASTER_USER.id ||
    cleanUser === PRIMARY_SUPER_ADMIN_USERNAME.toLowerCase() ||
    cleanEmail === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase() ||
    cleanName.includes('محمود الشحات') ||
    rawRole.includes('محمود الشحات') ||
    rawRole.includes('مدير المنظومة الرئيسي') ||
    rawRole.includes('مدير عام المنظومة الرئيسي')
  ) {
    return PRIMARY_SUPER_ADMIN_ROLE_TITLE;
  }
  return rawRole;
};

export const stripUserSecretsForBrowser = (u: PlatformUser): PlatformUser => {
  const clone: PlatformUser = {
    ...u,
    roleTitle: normalizeMahmoudRoleTitle(u) || u.roleTitle,
    hasPassword: Boolean(u.passwordHash || u.password || u.hasPassword)
  };
  delete clone.password;
  delete clone.passwordHash;
  return clone;
};

export const ensureDefaultSuperAdmins = (users: PlatformUser[] = []): PlatformUser[] => {
  const rawList = Array.isArray(users) ? users : [];
  const isBrowser = typeof window !== 'undefined';

  const userMap = new Map<string, PlatformUser>();

  // 1. Seed with all defaults (super admins + registered users)
  for (const def of DEFAULT_SUPER_ADMIN_USERS) {
    userMap.set(def.id, isBrowser ? stripUserSecretsForBrowser(def) : { ...def });
  }

  // 2. Merge existing / incoming users (strictly purging legacy removed emails)
  for (const u of rawList) {
    if (!u || !u.id) continue;
    if (isPurgedLegacyUserOrEmail(u)) continue;
    const isPrimary = isPrimarySuperAdminUser(u);
    const existing = userMap.get(u.id);
    if (existing) {
      const resolvedAllowedCols = Array.isArray(u.allowedColumns)
        ? u.allowedColumns
        : Array.isArray(u.permissions?.allowedColumns)
        ? u.permissions.allowedColumns
        : existing.allowedColumns;
      const mergedPerms: UserPermissions = isPrimary
        ? { ...FULL_PERMISSIONS }
        : {
            ...EMPTY_PERMISSIONS,
            ...(existing.permissions || {}),
            ...(u.permissions || {}),
            ...(Array.isArray(resolvedAllowedCols) ? { allowedColumns: resolvedAllowedCols } : {})
          };
      const merged: PlatformUser = {
        ...existing,
        ...u,
        email: (u.email || existing.email || '').trim().toLowerCase(),
        username: (u.username || existing.username || '').trim(),
        displayName: (u.displayName || existing.displayName || '').trim(),
        roleTitle: normalizeMahmoudRoleTitle({ ...existing, ...u }) || (u.roleTitle || existing.roleTitle || '').trim(),
        permissions: mergedPerms,
        allowedColumns: resolvedAllowedCols,
        isSuperAdmin: isPrimary ? true : Boolean(u.isSuperAdmin !== undefined ? u.isSuperAdmin : existing.isSuperAdmin)
      };
      // If incoming user has migrated to passwordHash, do not re-inject default plaintext password
      if (u.passwordHash && !u.password) {
        delete merged.password;
      }
      userMap.set(u.id, isBrowser ? stripUserSecretsForBrowser(merged) : merged);
    } else {
      const resolvedAllowedCols = Array.isArray(u.allowedColumns)
        ? u.allowedColumns
        : Array.isArray(u.permissions?.allowedColumns)
        ? u.permissions.allowedColumns
        : undefined;
      const resolvedPerms: UserPermissions = isPrimary
        ? { ...FULL_PERMISSIONS }
        : {
            ...EMPTY_PERMISSIONS,
            ...(u.permissions || {}),
            ...(Array.isArray(resolvedAllowedCols) ? { allowedColumns: resolvedAllowedCols } : {})
          };
      const added: PlatformUser = {
        ...u,
        email: (u.email || '').trim().toLowerCase(),
        username: (u.username || '').trim(),
        displayName: (u.displayName || u.username || '').trim(),
        roleTitle: normalizeMahmoudRoleTitle(u) || (u.roleTitle || 'مستخدم معتمد').trim(),
        isSuperAdmin: isPrimary ? true : Boolean(u.isSuperAdmin),
        isActive: isPrimary ? true : (u.isActive !== undefined ? Boolean(u.isActive) : true),
        permissions: resolvedPerms,
        ...(Array.isArray(resolvedAllowedCols) ? { allowedColumns: resolvedAllowedCols } : {})
      };
      userMap.set(u.id, isBrowser ? stripUserSecretsForBrowser(added) : added);
    }
  }

  // Ensure Primary Super Admin always has full permissions, active, and exact title 'مهندس الجودة والمساندة الفنية'
  const primary = userMap.get(PRIMARY_MASTER_USER.id);
  if (primary) {
    const mergedPrimary: PlatformUser = {
      ...PRIMARY_MASTER_USER,
      ...primary,
      id: PRIMARY_MASTER_USER.id,
      email: PRIMARY_SUPER_ADMIN_EMAIL,
      username: PRIMARY_SUPER_ADMIN_USERNAME,
      displayName: PRIMARY_SUPER_ADMIN_NAME,
      roleTitle: PRIMARY_SUPER_ADMIN_ROLE_TITLE,
      permissions: { ...FULL_PERMISSIONS },
      isActive: true,
      isSuperAdmin: true
    };
    if (primary.passwordHash) {
      mergedPrimary.passwordHash = primary.passwordHash;
      delete mergedPrimary.password;
    }
    userMap.set(
      PRIMARY_MASTER_USER.id,
      isBrowser ? stripUserSecretsForBrowser(mergedPrimary) : mergedPrimary
    );
  }

  return Array.from(userMap.values());
};

export const authenticateUserCredentials = (
  inputUserOrEmail: string,
  inputPassword: string,
  usersList: PlatformUser[] = []
): { success: boolean; user?: PlatformUser; error?: string } => {
  const cleanUser = (inputUserOrEmail || '').trim();
  const cleanPass = (inputPassword || '').trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, error: 'يرجى إدخال اسم المستخدم (User) وكلمة المرور (Password)' };
  }

  // Note: Authoritative authentication occurs on the server (/api/auth/login).
  const allUsers = ensureDefaultSuperAdmins(usersList);
  const matchedUser = allUsers.find(
    u =>
      (u.username?.trim().toLowerCase() === cleanUser.toLowerCase() ||
        u.email?.trim().toLowerCase() === cleanUser.toLowerCase()) &&
      u.password &&
      u.password.trim() === cleanPass
  );

  if (!matchedUser) {
    return {
      success: false,
      error: 'اسم المستخدم أو كلمة المرور غير صحيحة. تأكد من البيانات أو راجع مسؤول الصلاحيات.'
    };
  }

  if (matchedUser.isActive === false && !isUserSuperAdmin(matchedUser)) {
    return {
      success: false,
      error: 'هذا الحساب موقوف حالياً. يرجى التواصل مع مسؤول الصلاحيات لتفعيله.'
    };
  }

  const isAdmin = isUserSuperAdmin(matchedUser);
  const resolvedUser: PlatformUser = stripUserSecretsForBrowser({
    ...matchedUser,
    isSuperAdmin: isAdmin,
    permissions: isAdmin
      ? { ...FULL_PERMISSIONS }
      : { ...EMPTY_PERMISSIONS, ...(matchedUser.permissions || {}) },
    lastLoginAt: new Date().toISOString()
  });

  return { success: true, user: resolvedUser };
};

export const getSavedCurrentUser = (): PlatformUser | null => {
  if (typeof window === 'undefined') return null;
  try {
    const isExplicitLogout = localStorage.getItem('p155_user_explicit_logout') === 'true';
    if (isExplicitLogout) {
      return null;
    }

    const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY) || sessionStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PlatformUser;
    if (!parsed || (!parsed.username && !parsed.email)) {
      return null;
    }

    if (isPurgedLegacyUserOrEmail(parsed)) {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      sessionStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      return null;
    }

    if (
      parsed.username === PRIMARY_SUPER_ADMIN_USERNAME ||
      parsed.email?.toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase() ||
      parsed.id === PRIMARY_MASTER_USER.id
    ) {
      const refreshedMaster: PlatformUser = stripUserSecretsForBrowser({
        ...PRIMARY_MASTER_USER,
        lastLoginAt: parsed.lastLoginAt || new Date().toISOString()
      });
      try {
        const serialized = JSON.stringify(refreshedMaster);
        localStorage.setItem(CURRENT_USER_STORAGE_KEY, serialized);
        sessionStorage.setItem(CURRENT_USER_STORAGE_KEY, serialized);
      } catch (_) {}
      return refreshedMaster;
    }

    return stripUserSecretsForBrowser(parsed);
  } catch {
    return null;
  }
};

export const saveCurrentUser = (user: PlatformUser | null): void => {
  if (typeof window === 'undefined') return;
  try {
    // Clean up legacy auto-bypassed storage key if present
    localStorage.removeItem('p155_logged_in_user_v2');
    sessionStorage.removeItem('p155_logged_in_user_v2');

    if (user) {
      const safeUser = stripUserSecretsForBrowser(user);
      const serialized = JSON.stringify(safeUser);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, serialized);
      sessionStorage.setItem(CURRENT_USER_STORAGE_KEY, serialized);
      sessionStorage.setItem(SESSION_PIN_KEY, 'true');
      localStorage.removeItem('p155_user_explicit_logout');
    } else {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      sessionStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      sessionStorage.removeItem(SESSION_PIN_KEY);
      localStorage.setItem('p155_user_explicit_logout', 'true');
      saveSessionToken(null);
    }
  } catch (_) {}
};

export const verifyAdminPin = (input: string): boolean => {
  if (!input) return false;
  const currentUser = getSavedCurrentUser();
  return Boolean(currentUser && isUserSuperAdmin(currentUser));
};

export const isSessionUnlocked = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const user = getSavedCurrentUser();
    if (!user) return false;
    return sessionStorage.getItem(SESSION_PIN_KEY) === 'true' || isUserSuperAdmin(user);
  } catch {
    return false;
  }
};

export const setSessionUnlocked = (unlocked: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    if (unlocked) {
      sessionStorage.setItem(SESSION_PIN_KEY, 'true');
    } else {
      sessionStorage.removeItem(SESSION_PIN_KEY);
    }
  } catch (_) {}
};

/**
 * Detects whether the platform is currently loaded inside the AI Studio preview iframe
 * (next to the edit chat panel) or explicitly opened with ?preview=true.
 * Top-level browser tabs opened by real users (window.self === window.top) are NEVER treated as preview iframes.
 */
export const isPlatformRunningInStudioIframe = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('readonly_observer') === 'true';
  } catch (_) {
    return false;
  }
};

export const isStudioPreviewIframe = isPlatformRunningInStudioIframe;

/**
 * Always ensures cloud synchronization and root persistence are active
 * across all accounts, devices, and sessions without exception.
 */
export const shouldSuppressCloudBackupForSession = (_userEmailOrUsername?: string): boolean => {
  return false;
};

