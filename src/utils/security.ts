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
  // 1. تبويبات العمود الجانبي والصفحات الرئيسية
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
  tabSettings: true,

  // 2. أدوات جدول أوامر العمل والمرفقات
  addWorkOrder: true,
  editWorkOrderStatus: true,
  editWorkOrderBasic: true,
  inlineTableEdit: true,
  deleteWorkOrder: true,
  uploadInspectionFiles: true,
  viewPhotos: true,
  searchAndFilter: true,
  undoRedo: true,

  // 3. التدقيق الثلاثي المستقل واعتماد وأرشفة إجراء 155
  auditPdcColumn: true,
  auditConstructionColumn: true,
  auditTechnicalSupportColumn: true,
  editProcedure155: true,
  smartAudit: true,
  manageArchive155: true,

  // 4. التقارير ولوحات القياس التفاعلية والتصدير
  viewKpiDashboard: true,
  viewComprehensiveReports: true,
  viewWeeklyReport: true,
  viewOfficeComparison: true,
  viewContractorClosureReport: true,
  viewNotesReport: true,
  viewArchive: true,
  exportTable: true,

  // 5. الاستيراد وإدارة الجداول والهيكل والمكاتب
  importExcel: true,
  importCompatibleTables: true,
  manageMonthTables: true,
  deleteMonthTable: true,
  manageOffices: true,
  manageContractors: true,
  manageColumns: true,
  manageDropdowns: true,

  // 6. الخزنة السحابية والإشعارات وإدارة النظام
  clearData: true,
  restoreDeleted: true,
  manageCloudBackups: true,
  manageNotifications: true,
  managePermissions: true
};

export const EMPTY_PERMISSIONS: UserPermissions = {
  tabHome: false,
  tabWorkOrders: false,
  tabKpis: false,
  tabQualityGuide: false,
  tabAuditHub: false,
  tabOffices: false,
  tabContractors: false,
  tabArchive: false,
  tabReports: false,
  tabDocuments: false,
  tabSettings: false,
  addWorkOrder: false,
  editWorkOrderStatus: false,
  editWorkOrderBasic: false,
  inlineTableEdit: false,
  deleteWorkOrder: false,
  uploadInspectionFiles: false,
  viewPhotos: false,
  searchAndFilter: false,
  undoRedo: false,
  auditPdcColumn: false,
  auditConstructionColumn: false,
  auditTechnicalSupportColumn: false,
  editProcedure155: false,
  smartAudit: false,
  manageArchive155: false,
  viewKpiDashboard: false,
  viewComprehensiveReports: false,
  viewWeeklyReport: false,
  viewOfficeComparison: false,
  viewContractorClosureReport: false,
  viewNotesReport: false,
  viewArchive: false,
  exportTable: false,
  importExcel: false,
  importCompatibleTables: false,
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

export type PermissionCategoryId =
  | 'sidebar_tabs'
  | 'tools'
  | 'audit_155'
  | 'reports'
  | 'structure'
  | 'system';

export interface PermissionItemMeta {
  key: keyof UserPermissions;
  label: string;
  description: string;
  category: PermissionCategoryId;
}

export const PERMISSION_DEFINITIONS: PermissionItemMeta[] = [
  // =========================================================================
  // 1. صلاحيات تبويبات العمود الجانبي والصفحات الرئيسية (11 تبويباً)
  // =========================================================================
  {
    key: 'tabHome',
    label: 'تبويب: الصفحة الرئيسية',
    description: 'الوصول للنظرة التنفيذية الشاملة، قوائم اختيار (السنة/الشهر/الجدول/المكتب)، والبطاقات التفاعلية',
    category: 'sidebar_tabs'
  },
  {
    key: 'tabWorkOrders',
    label: 'تبويب: جدول أوامر العمل والتدقيق',
    description: 'فتح جدول أوامر العمل الرئيسي، شريط التحكم العلوي، والتنقل بين الجداول الشهرية',
    category: 'sidebar_tabs'
  },
  {
    key: 'tabKpis',
    label: 'تبويب: مؤشرات الأداء والقياس (KPIs)',
    description: 'فتح لوحة مؤشرات الأداء التفاعلية والقوائم المنبثقة فوق الصفحة والتوجه المباشر للجدول',
    category: 'sidebar_tabs'
  },
  {
    key: 'tabQualityGuide',
    label: 'تبويب: الدليل الإرشادي ومراحل التحقق (18 مرحلة)',
    description: 'الاطلاع على ضوابط حوكمة الجودة ومراحل التحقق الـ 18 المعتمدة في إجراء 155',
    category: 'sidebar_tabs'
  },
  {
    key: 'tabAuditHub',
    label: 'تبويب: متابعة التدقيق • (تم التدقيق عليه) • (ارشيف 155)',
    description: 'فتح مركز متابعة التدقيق الثلاثي وقائمة (تم التدقيق عليه) وقائمة (ارشيف 155) وسجل العمليات',
    category: 'sidebar_tabs'
  },
  {
    key: 'tabOffices',
    label: 'تبويب: المكاتب الفرعية ومقارنة الأداء',
    description: 'استعراض بطاقات المكاتب الفرعية الأربعة (عرعر • رفحاء • طريف • العويقيلة) ومؤشرات إنجازها',
    category: 'sidebar_tabs'
  },
  {
    key: 'tabContractors',
    label: 'تبويب: المقاولون والاستشاريون',
    description: 'استعراض قسم تقييم المقاولين المعتمدين والمكاتب الاستشارية ونسب التأهيل في 155',
    category: 'sidebar_tabs'
  },
  {
    key: 'tabArchive',
    label: 'تبويب: الأرشيف السنوي وجداول الشهور',
    description: 'فتح أرشيف السنوات والشهور والجداول المستقلة والفترات المالية',
    category: 'sidebar_tabs'
  },
  {
    key: 'tabReports',
    label: 'تبويب: التقارير والملاحظات الميدانية',
    description: 'فتح مركز التقارير المعتمدة وسجل أوامر العمل المحتوية على ملاحظات فنية وصور ميدانية',
    category: 'sidebar_tabs'
  },
  {
    key: 'tabDocuments',
    label: 'تبويب: الاستيراد والتصدير والنسخ الاحتياطي',
    description: 'فتح مركز الاستيراد (Excel / الجداول المتوافقة) والتصدير والخزنة السحابية',
    category: 'sidebar_tabs'
  },
  {
    key: 'tabSettings',
    label: 'تبويب: إعدادات النظام والصلاحيات',
    description: 'فتح مركز إعدادات النظام، هيكلة الأعمدة، القوائم المنسدلة، وإدارة الحسابات',
    category: 'sidebar_tabs'
  },

  // =========================================================================
  // 2. صلاحيات عمليات جدول أوامر العمل والمرفقات الميدانية
  // =========================================================================
  {
    key: 'addWorkOrder',
    label: 'إضافة أمر عمل جديد',
    description: 'إدراج وتسجيل أوامر عمل جديدة في الجدول المحدد مع التحقق الآلي من عدم التكرار',
    category: 'tools'
  },
  {
    key: 'editWorkOrderBasic',
    label: 'تعديل البيانات الأساسية لأمر العمل',
    description: 'تعديل المكتب الفرعي، المقاول، الاستشاري، رقم أمر العمل، ونوع أمر العمل',
    category: 'tools'
  },
  {
    key: 'editWorkOrderStatus',
    label: 'تحديث بيانات الجودة والملاحظات الميدانية',
    description: 'فتح نافذة تعديل أمر العمل وتوثيق ملاحظات الجودة (155) وحالة الإرفاق',
    category: 'tools'
  },
  {
    key: 'inlineTableEdit',
    label: 'التعديل المباشر داخل خلايا الجدول',
    description: 'تغيير القوائم المنسدلة وتنسيق الخلايا المسموح بها مباشرة من داخل الجدول',
    category: 'tools'
  },
  {
    key: 'uploadInspectionFiles',
    label: 'إدارة ورفع ملفات الصور و PDF (عمود ملف الصور)',
    description: 'رفع واستعراض ملفات الفحص والصور و PDF في عمود ملف الصور وفتح مجلد SharePoint',
    category: 'tools'
  },
  {
    key: 'viewPhotos',
    label: 'استعراض ومعاينة معرض الصور الميدانية',
    description: 'فتح معرض الصور المرفقة بأمر العمل وتحميلها أو إضافة صور توثيقية جديدة',
    category: 'tools'
  },
  {
    key: 'deleteWorkOrder',
    label: 'حذف أوامر العمل (مفرد أو جماعي)',
    description: 'حذف أمر عمل مفرد أو حذف دفعة أوامر محددة نهائياً مع المزامنة السحابية الفورية',
    category: 'tools'
  },
  {
    key: 'searchAndFilter',
    label: 'البحث المتقدم الشامل ولوحة الأوامر الذكية',
    description: 'فتح نافذة البحث الشامل والفلترة المتقدمة عبر كافة الجداول وتصدير نتائجها',
    category: 'tools'
  },

  // =========================================================================
  // 3. صلاحيات التدقيق الثلاثي المستقل واعتماد وأرشفة إجراء 155
  // =========================================================================
  {
    key: 'auditPdcColumn',
    label: 'تدقيق عمود PDC المستقل (9 بنود تحقق)',
    description: 'فتح وتدقيق قائمة التحقق الـ 9 الخاصة بعمود (تدقيق PDC) واعتماد تأهيل الإدارة',
    category: 'audit_155'
  },
  {
    key: 'auditConstructionColumn',
    label: 'تدقيق عمود الإنشاءات المستقل (9 بنود تحقق)',
    description: 'فتح وتدقيق قائمة التحقق الـ 9 الخاصة بعمود (تدقيق الإنشاءات) واعتماد تأهيل الإدارة',
    category: 'audit_155'
  },
  {
    key: 'auditTechnicalSupportColumn',
    label: 'تدقيق عمود المساندة الفنية المستقل (9 بنود تحقق)',
    description: 'فتح وتدقيق قائمة التحقق الـ 9 الخاصة بعمود (تدقيق المساندة الفنية) وتحديد المؤهل/غير المؤهل',
    category: 'audit_155'
  },
  {
    key: 'editProcedure155',
    label: 'اعتماد عمود (إجراء 155) واختيار (تم الاجراء)',
    description: 'تحديد حالة عمود (إجراء 155) واختيار (تم الاجراء) لنقل الأمر فوراً إلى قائمة (ارشيف 155)',
    category: 'audit_155'
  },
  {
    key: 'smartAudit',
    label: 'نافذة التنبيه العاجل وسجل التدقيق التاريخي',
    description: 'فتح نافذة متابعة الأوامر تحت التدقيق الجزئي واستعراض سجل العمليات الموثق (Audit Trail)',
    category: 'audit_155'
  },
  {
    key: 'manageArchive155',
    label: 'إدارة وتصدير قائمة (تم التدقيق عليه) وقائمة (ارشيف 155)',
    description: 'التحكم في سجلات قائمتي (تم التدقيق عليه) و(ارشيف 155) وتصديرهما بشكل مستقل',
    category: 'audit_155'
  },

  // =========================================================================
  // 4. صلاحيات مؤشرات الأداء التفاعلية (KPIs) والتقارير والتصدير
  // =========================================================================
  {
    key: 'viewKpiDashboard',
    label: 'مؤشرات الأداء التفاعلية (KPIs) والقوائم المنبثقة',
    description: 'التفاعل مع بطاقات المؤشرات والرسوم البيانية وفتح القائمة المنبثقة للتوجه المباشر للجدول',
    category: 'reports'
  },
  {
    key: 'viewComprehensiveReports',
    label: 'مركز التقارير الشامل الموحد (تفصيلية ومجمعة)',
    description: 'فتح وتصدير التقارير التفصيلية والمجمعة الأسبوعية والشهرية والربع سنوية والسنوية',
    category: 'reports'
  },
  {
    key: 'viewWeeklyReport',
    label: 'التقرير الأسبوعي الإداري للمكاتب الفرعية',
    description: 'فتح وتصدير التقرير الأسبوعي الرسمي لنسب إنجاز المكاتب الفرعية',
    category: 'reports'
  },
  {
    key: 'viewOfficeComparison',
    label: 'مقارنة وتقييم أداء المكاتب الفرعية الأربعة',
    description: 'الاطلاع على الترتيب التنافسي ومؤشرات الإنجاز التفصيلية للمكاتب الفرعية',
    category: 'reports'
  },
  {
    key: 'viewContractorClosureReport',
    label: 'مقارنة المقاولين والاستشاريين وتقارير الإغلاقات',
    description: 'الاطلاع وتصدير تقارير إغلاقات المقاولين الدورية وتقييم المكاتب الاستشارية',
    category: 'reports'
  },
  {
    key: 'viewNotesReport',
    label: 'تقرير ملاحظات الجودة (NCR) والملاحظات المتكررة بالصور',
    description: 'عرض وتصدير تقرير ملاحظات الجودة والملاحظات المتكررة للمقاولين مع الصور المرفقة',
    category: 'reports'
  },
  {
    key: 'viewArchive',
    label: 'تصفح الأرشيف السنوي والشهري والتقارير المحفوظة',
    description: 'استعراض أرشيف السنوات والشهور والتقارير الإحصائية المؤرشفة',
    category: 'reports'
  },
  {
    key: 'exportTable',
    label: 'تصدير الجداول والتقارير وإرسال البريد الإلكتروني',
    description: 'تصدير البيانات بصيغ Excel • PDF • Word • PPTX • صور عالية الدقة ومشاركتها عبر البريد',
    category: 'reports'
  },

  // =========================================================================
  // 5. صلاحيات الاستيراد وإدارة الجداول والهيكل التنظيمي
  // =========================================================================
  {
    key: 'importExcel',
    label: 'استيراد أوامر العمل من ملفات Excel',
    description: 'رفع واستيراد ملفات الإكسل وإدراجها في الجدول الرئيسي أو في جدول مستقل للشهر',
    category: 'structure'
  },
  {
    key: 'importCompatibleTables',
    label: 'الاستيراد الذكي المتوافق بدلالة الأعمدة',
    description: 'دمج واستيراد البيانات تلقائياً بين الجداول الشهرية المتوافقة بدلالة الأعمدة',
    category: 'structure'
  },
  {
    key: 'manageMonthTables',
    label: 'إنشاء وتعديل الجداول الشهرية المستقلة',
    description: 'إضافة جداول جديدة للشهر أو تعديل مسمياتها وألوانها عبر نافذة إدارة الفترات',
    category: 'structure'
  },
  {
    key: 'deleteMonthTable',
    label: 'حذف الجداول الشهرية أو تفريغ جدول محدد',
    description: 'حذف جدول شهري مستقل أو تفريغ أوامر العمل التابعة لمكتب أو جدول محدد',
    category: 'structure'
  },
  {
    key: 'manageOffices',
    label: 'إدارة وتعديل المكاتب الفرعية',
    description: 'إضافة أو تعديل أو حذف المكاتب الفرعية وإعادة توجيه أوامر العمل التابعة لها',
    category: 'structure'
  },
  {
    key: 'manageContractors',
    label: 'إدارة وتوزيع مقاولي واستشاريي المكاتب',
    description: 'ربط المقاولين والاستشاريين بالمكاتب الفرعية وإضافة أو حذف مقاول أو استشاري معتمد',
    category: 'structure'
  },
  {
    key: 'manageColumns',
    label: 'إدارة هيكلة ومسميات وترتيب الأعمدة',
    description: 'تعديل أسماء الأعمدة وإضافة أو حذف أو ترتيب أعمدة جدول أوامر العمل',
    category: 'structure'
  },
  {
    key: 'manageDropdowns',
    label: 'إدارة وتخصيص القوائم المنسدلة للخلايا',
    description: 'تعديل وإضافة وحذف خيارات القوائم المنسدلة لخلايا أعمدة الجدول',
    category: 'structure'
  },

  // =========================================================================
  // 6. صلاحيات الخزنة السحابية والإشعارات وإدارة النظام
  // =========================================================================
  {
    key: 'restoreDeleted',
    label: 'فتح مركز الأمان السحابي والنسخ الاحتياطية',
    description: 'الوصول إلى الخزنة السحابية واستعراض النسخ الاحتياطية الدورية الفورية',
    category: 'system'
  },
  {
    key: 'manageCloudBackups',
    label: 'استيراد وتصدير ملفات النسخ الاحتياطية الكاملة (.json / .gz)',
    description: 'تصدير نسخة احتياطية كاملة للمنصة أو استيراد ودمج نسخة احتياطية مع المزامنة الفورية للجميع',
    category: 'system'
  },
  {
    key: 'manageNotifications',
    label: 'إدارة مركز الإشعارات الفورية والتنبيهات والتعاميم',
    description: 'ضبط تنبيهات المتصفح والصوت وإرسال إشعارات وتعاميم فورية لكافة المتصلين',
    category: 'system'
  },
  {
    key: 'clearData',
    label: 'المسح الجذري وتفريغ البيانات أو استعادة البيانات النموذجية',
    description: 'تفريغ كافة أوامر العمل في المنظومة أو إعادة تعيين البيانات النموذجية',
    category: 'system'
  },
  {
    key: 'managePermissions',
    label: 'إدارة حسابات المستخدمين وتخصيص الصلاحيات والأعمدة',
    description: 'إنشاء وتعديل حسابات المستفيدين وتخصيص صلاحيات التبويبات والأدوات والتقارير والأعمدة',
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
  if (permKey === 'manageArchive155' && user.permissions?.manageArchive155 === undefined) {
    return Boolean(user.permissions?.smartAudit || user.permissions?.exportTable || user.permissions?.editProcedure155);
  }
  if (permKey === 'viewPhotos' && user.permissions?.viewPhotos === undefined) {
    return Boolean(user.permissions?.editWorkOrderStatus || user.permissions?.uploadInspectionFiles || user.permissions?.inlineTableEdit);
  }
  if (
    (permKey === 'auditPdcColumn' || permKey === 'auditConstructionColumn' || permKey === 'auditTechnicalSupportColumn' || permKey === 'uploadInspectionFiles') &&
    user.permissions?.[permKey as keyof UserPermissions] === undefined
  ) {
    return Boolean(user.permissions?.editWorkOrderStatus || user.permissions?.inlineTableEdit);
  }
  // Sidebar tabs fallback when undefined on legacy user records
  if (permKey.startsWith('tab') && user.permissions?.[permKey as keyof UserPermissions] === undefined) {
    if (permKey === 'tabKpis') return Boolean(user.permissions?.viewKpiDashboard ?? true);
    if (permKey === 'tabArchive') return Boolean(user.permissions?.viewArchive ?? true);
    return true;
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

export const SIDEBAR_SECTION_PERMISSION_MAP: Record<string, { key: keyof UserPermissions; label: string }> = {
  home: { key: 'tabHome', label: 'تبويب الصفحة الرئيسية' },
  work_orders: { key: 'tabWorkOrders', label: 'تبويب جدول أوامر العمل والتدقيق' },
  projects: { key: 'tabWorkOrders', label: 'تبويب جدول أوامر العمل والتدقيق' },
  admin_dashboard: { key: 'tabKpis', label: 'تبويب مؤشرات الأداء والقياس (KPIs)' },
  quality_ncr: { key: 'tabQualityGuide', label: 'تبويب الدليل الإرشادي ومراحل التحقق (18 مرحلة)' },
  audit_trail: { key: 'tabAuditHub', label: 'تبويب متابعة التدقيق وقائمة (تم التدقيق عليه) و(ارشيف 155)' },
  regions_dashboard: { key: 'tabOffices', label: 'تبويب المكاتب الفرعية ومقارنة الأداء' },
  contractors: { key: 'tabContractors', label: 'تبويب المقاولون والاستشاريون' },
  consultants: { key: 'tabContractors', label: 'تبويب المقاولون والاستشاريون' },
  calendar: { key: 'tabArchive', label: 'تبويب الأرشيف السنوي وجداول الشهور' },
  visits: { key: 'tabReports', label: 'تبويب التقارير والملاحظات الميدانية' },
  documents: { key: 'tabDocuments', label: 'تبويب الاستيراد والتصدير والنسخ الاحتياطي' },
  settings: { key: 'tabSettings', label: 'تبويب إعدادات النظام والصلاحيات' }
};

export const canAccessSidebarSection = (
  user: PlatformUser | null | undefined,
  sectionId: string
): boolean => {
  const mapped = SIDEBAR_SECTION_PERMISSION_MAP[sectionId];
  if (!mapped) return true;
  return hasUserPermission(user, mapped.key);
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
  { field: 'office', title: 'المكتب', description: 'تعديل واختيار المكتب الفرعي الميداني (عرعر • رفحاء • طريف • العويقيلة)' },
  { field: 'contractor', title: 'المقاول', description: 'تعديل واختيار المقاول المنفذ المعتمد للمكتب' },
  { field: 'consultant', title: 'الاستشاري', description: 'تعديل واختيار الاستشاري المشرف المعتمد' },
  { field: 'workOrderNumber', title: 'رقم امر العمل', description: 'تعديل رقم أمر العمل المعتمد' },
  { field: 'workOrderCode', title: 'نوع امر العمل', description: 'تعديل وتحديد نوع أمر العمل (801، 401، 912، ...)' },
  { field: 'photosFile', title: 'ملف الصور', description: 'رفع واستعراض ملفات الصور و PDF المرفقة وفتح مجلد SharePoint' },
  { field: 'attachmentStatus', title: 'حالة الارفاق', description: 'تحديث حالة إرفاق الصور (العداد، الحفريات، المعدات، الهوائي، الإرفاق الكامل)' },
  {
    field: 'qualityNotes',
    title: 'الملاحظات',
    description: 'تعديل ملاحظات الجودة وإرفاق الصور (صلاحية مفتوحة ومتاحة للجميع افتراضياً)',
    isUniversallyEditable: true
  },
  { field: 'pdcAudit', title: 'تدقيق PDC', description: 'تحديث وتدقيق قائمة التحقق الـ 9 لعمود (تدقيق PDC) المستقل' },
  { field: 'constructionAudit', title: 'تدقيق الانشاءات', description: 'تحديث وتدقيق قائمة التحقق الـ 9 لعمود (تدقيق الإنشاءات) المستقل' },
  { field: 'procedure155Status', title: 'تدقيق المساندة الفنية', description: 'تحديث وتدقيق قائمة التحقق الـ 9 لعمود (تدقيق المساندة الفنية) المستقل' },
  { field: 'statusSyncTime', title: 'مزامنة التدقيق', description: 'بطاقة مزامنة أعمدة التدقيق الثلاثة بالترتيب وسجل الأحداث (تُحدّث تلقائياً)' },
  {
    field: 'procedure155',
    title: 'إجراء 155',
    description: 'اعتماد حالة إجراء 155 واختيار (تم الاجراء) للأرشفة الفورية في قائمة (ارشيف 155)'
  },
  { field: 'procedureSyncTime', title: 'مزامنة الإجراء', description: 'تحديث وقت وتاريخ ومستخدم مزامنة حالة إجراء 155' }
];

/**
 * Returns the canonical 14 table columns in exact order plus any custom columns added in ColumnManagerModal,
 * while strictly excluding any removed executionStatus ('حالة التنفيذ') column.
 */
export const getMergedTableColumnsForPermissions = (
  liveColumns?: Array<{ field?: string; id?: string; title: string; isCustom?: boolean }>
): TableColumnPermissionMeta[] => {
  const baseCols = ALL_TABLE_COLUMNS.map((stdCol) => ({ ...stdCol }));
  if (!Array.isArray(liveColumns) || liveColumns.length === 0) {
    return baseCols;
  }

  const knownFields = new Set(baseCols.map((c) => c.field));
  // Sync custom titles if user renamed a standard column, and append custom columns
  for (const liveCol of liveColumns) {
    const f = String(liveCol.field || liveCol.id || '').trim();
    if (!f || f === 'executionStatus' || liveCol.title?.includes('حالة التنفيذ')) continue;
    const cleanTitle = String(liveCol.title || '').replace(/^\d+\.\s*/, '').trim();
    const existing = baseCols.find((c) => c.field === f);
    if (existing && cleanTitle) {
      existing.title = cleanTitle;
    } else if (!knownFields.has(f)) {
      knownFields.add(f);
      baseCols.push({
        field: f,
        title: cleanTitle || f,
        description: 'عمود مخصص تمت إضافته في هيكلة جدول أوامر العمل',
        isCustom: true
      });
    }
  }
  return baseCols;
};

export const isColumnUniversallyEditable = (columnField: string): boolean => {
  const cleanField = String(columnField || '').trim();
  const isTestIsolation =
    typeof process !== 'undefined' && process?.env?.SEC_TEST_ISOLATION === 'true';
  return (
    cleanField === 'qualityNotes' ||
    cleanField === 'executionNotes' ||
    cleanField === 'qualityNoteItems' ||
    (!isTestIsolation && cleanField === 'procedure155')
  );
};

export const canUserEditColumn = (
  user: PlatformUser | null | undefined,
  columnField: string
): boolean => {
  const cleanField = String(columnField || '').trim();

  // QualityNotes & Procedure155 are universally open to all active users per platform specification
  if (isColumnUniversallyEditable(cleanField)) {
    return true;
  }

  if (!user) return false;
  if (user.isActive === false && !isPrimarySuperAdminUser(user)) return false;
  if (isPrimarySuperAdminUser(user)) return true;

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

/**
 * Automatically synchronizes an existing user's permissions with all newly added platform features,
 * tools, reports, and columns periodically, WITHOUT ever overriding their existing customized permissions or
 * affecting previously added users or resetting custom settings.
 */
export const synchronizeUserPermissionsWithPlatformUpdates = (user: PlatformUser): PlatformUser => {
  if (!user) return user;
  const isPrimary = isPrimarySuperAdminUser(user);
  if (isPrimary || user.isSuperAdmin) {
    return {
      ...user,
      permissions: { ...FULL_PERMISSIONS },
      roleTitle: isPrimary ? PRIMARY_SUPER_ADMIN_ROLE_TITLE : user.roleTitle
    };
  }

  const existingPerms: Partial<UserPermissions> = user.permissions || {};
  const updatedPerms: UserPermissions = { ...EMPTY_PERMISSIONS };

  // For every permission key defined in the platform
  for (const def of PERMISSION_DEFINITIONS) {
    const key = def.key;
    if (typeof (existingPerms as any)[key] === 'boolean') {
      // Strictly keep the user's previously configured preference!
      (updatedPerms as any)[key] = (existingPerms as any)[key];
    } else {
      // New platform addition that was not present when this user was created:
      // Automatically grant newly added tools and reports so all users immediately benefit,
      // while keeping destructive system keys (clearData, deleteMonthTable, managePermissions) protected.
      if (
        def.category === 'sidebar_tabs' ||
        def.category === 'reports' ||
        def.category === 'tools' ||
        def.category === 'audit_155'
      ) {
        if (key === 'editProcedure155' || key === 'deleteWorkOrder') {
          (updatedPerms as any)[key] = false;
        } else {
          (updatedPerms as any)[key] = true;
        }
      } else {
        (updatedPerms as any)[key] = false;
      }
    }
  }

  // Strictly preserve the user's configured allowedColumns without re-injecting restricted columns
  const existingAllowed = user.allowedColumns || existingPerms.allowedColumns;
  let resolvedAllowed: string[] | undefined = undefined;
  if (Array.isArray(existingAllowed)) {
    resolvedAllowed = Array.from(
      new Set(existingAllowed.filter((col) => Boolean(col) && col !== 'executionStatus'))
    );
  }

  return {
    ...user,
    roleTitle: normalizeMahmoudRoleTitle(user) || user.roleTitle,
    permissions: {
      ...updatedPerms,
      ...(Array.isArray(resolvedAllowed) ? { allowedColumns: resolvedAllowed } : {})
    },
    ...(Array.isArray(resolvedAllowed) ? { allowedColumns: resolvedAllowed } : {})
  };
};

export const ensureDefaultSuperAdmins = (users: PlatformUser[] = []): PlatformUser[] => {
  const rawList = Array.isArray(users) ? users : [];
  const isBrowser = typeof window !== 'undefined';

  const userMap = new Map<string, PlatformUser>();

  // 1. Seed with all defaults (super admins + registered users)
  for (const def of DEFAULT_SUPER_ADMIN_USERS) {
    const syncd = synchronizeUserPermissionsWithPlatformUpdates(def);
    userMap.set(def.id, isBrowser ? stripUserSecretsForBrowser(syncd) : { ...syncd });
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
      const upgraded = synchronizeUserPermissionsWithPlatformUpdates(merged);
      userMap.set(u.id, isBrowser ? stripUserSecretsForBrowser(upgraded) : upgraded);
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
      const upgraded = synchronizeUserPermissionsWithPlatformUpdates(added);
      userMap.set(u.id, isBrowser ? stripUserSecretsForBrowser(upgraded) : upgraded);
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
  const baseResolved: PlatformUser = {
    ...matchedUser,
    isSuperAdmin: isAdmin,
    permissions: isAdmin
      ? { ...FULL_PERMISSIONS }
      : { ...EMPTY_PERMISSIONS, ...(matchedUser.permissions || {}) },
    lastLoginAt: new Date().toISOString()
  };
  const resolvedUser = stripUserSecretsForBrowser(synchronizeUserPermissionsWithPlatformUpdates(baseResolved));

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

    return stripUserSecretsForBrowser(synchronizeUserPermissionsWithPlatformUpdates(parsed));
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
 * (next to the edit chat panel) or explicitly opened with ?readonly_observer=true / ?preview_sandbox=true.
 * Top-level browser tabs opened by real users (window.self === window.top) are NEVER treated as preview iframes.
 */
export const isPlatformRunningInStudioIframe = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    if (window.self !== window.top) {
      return true;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('readonly_observer') === 'true' || params.get('preview_sandbox') === 'true') {
      return true;
    }
    return false;
  } catch (_) {
    return true;
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

