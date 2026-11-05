/**
 * Types and interfaces for the Procedure 155 Work Order Quality Audit Platform
 */

export type FourStateStatus = 'مكتمل' | 'غير مكتمل' | 'لا ينطبق' | 'لاينطبق' | 'مكتمل مع ملاحظات' | 'ملاحظات';
export type FiveStateStatus = 'مكتمل' | 'غير مكتمل' | 'لا ينطبق' | 'لاينطبق' | 'مكتمل مع ملاحظات' | 'ملاحظات';

export type AttachmentStatus =
  | 'جاهز للارفاق الكامل'
  | 'جاهز لارفاق صور العداد'
  | 'جاهز لارفاق صور الخفريات'
  | 'جاهز لارفاق صور المعدات'
  | 'جاهز لارفاق صور الهوائي'
  | 'غير جاهز للارفاق';

export type ExecutionStatus = 
  | 'قيد التدقيق' 
  | 'مكتمل ميدانياً' 
  | 'قيد التنفيذ' 
  | 'معلق لنواقص' 
  | 'جاهز للاستلام 155' 
  | 'مرفوض'
  | 'مكتمل';

export type Procedure155Status = 
  | 'مؤهل للاغلاق ( معتمد )'
  | 'غير مؤهل للأغلاق'
  | 'مؤهل للاغلاق' 
  | 'غير مؤهل للاغلاق'
  | 'مؤهل لأجراء 155' 
  | 'غير مؤهل لإجراء 155'
  | 'مؤهل للاستلام (معتمد)' 
  | 'تم الاستلام وإغلاق 155' 
  | 'بانتظار استيفاء الملاحظات' 
  | 'قيد التدقيق الفني' 
  | 'غير مطابق';

export type BoqModificationStatus = 
  | 'مطابق للمقايسة المعتمدة' 
  | 'نعم - تم اعتماد تعديل المقايسة' 
  | 'نعم - بانتظار اعتماد التعديل' 
  | 'لا يوجد تعديل مطلوب';

export interface PhotoItem {
  id: string;
  url: string;
  caption: string;
  stage: 'قبل البدء' | 'أثناء التنفيذ' | 'بعد الانتهاء' | 'فحص الجودة';
  timestamp: string;
}

export interface AttachedInspectionFile {
  id: string;
  name: string;
  size: number;
  type: string; // 'application/pdf' | 'image/jpeg' | etc.
  dataUrl: string; // base64 or object url
  uploadedAt: string;
  uploadedBy?: string;
}

export const SHAREPOINT_AUDIT_URL = "https://seccomsa-my.sharepoint.com/:f:/r/personal/1099399790_sec_se_com_sa/Documents/PDC_NBORDER_WO%20SHARE/%D9%85%D8%AA%D8%A7%D8%A8%D8%B9%D8%A9%20%D8%AC%D9%88%D8%AF%D8%A9%20%D8%A7%D9%84%D8%B5%D9%88%D8%B1%20%D9%82%D8%A8%D9%84%20%D8%A7%D9%84%D8%A7%D8%B1%D9%81%D8%A7%D9%82%20%D9%81%D9%8A%20%D8%A7%D9%84%D9%86%D8%B8%D8%A7%D9%85?d=w4d6cce1e1c444ad7bc569229dcc85069&csf=1&web=1&e=sq4nBV";
export const FILE_DELETE_SECRET_PIN = "321";

/**
 * Builds a direct SharePoint / OneDrive for Business deep-search URL that automatically searches
 * across all files and subfolders inside the shared folder for the specified workOrderNumber
 * and navigates directly to the matching work order folder/files.
 */
export function buildSharePointDirectWorkOrderSearchUrl(
  workOrderNumber?: string,
  customShareUrl?: string
): string {
  const baseUrl = (customShareUrl || SHAREPOINT_AUDIT_URL).trim();
  const cleanQuery = String(workOrderNumber || '').trim();
  if (!cleanQuery) {
    return baseUrl;
  }

  try {
    const parsed = new URL(baseUrl);

    // 1. Handle SharePoint / OneDrive sharing links like /:f:/r/personal/... or /:f:/r/sites/...
    const sharingPrefixMatch = parsed.pathname.match(/^\/:[a-z]:\/[a-z](\/.*)$/i);
    const rawServerRelativePath = sharingPrefixMatch ? sharingPrefixMatch[1] : parsed.pathname;

    // 2. If it's a personal OneDrive for Business folder (/personal/<user>/...)
    const personalSiteMatch = rawServerRelativePath.match(/^(\/personal\/[^/]+)(\/.*)?$/i);
    if (personalSiteMatch) {
      const personalSiteRoot = personalSiteMatch[1];
      let decodedFolderPath = rawServerRelativePath;
      try {
        decodedFolderPath = decodeURIComponent(rawServerRelativePath);
      } catch {
        // Keep raw path if already decoded
      }
      const existingId = parsed.searchParams.get('id');
      const targetFolderId = existingId || decodedFolderPath;

      const searchUrl = new URL(`${parsed.origin}${personalSiteRoot}/_layouts/15/onedrive.aspx`);
      searchUrl.searchParams.set('id', targetFolderId);
      searchUrl.searchParams.set('qt', 'search');
      searchUrl.searchParams.set('q', cleanQuery);
      searchUrl.searchParams.set('searchScope', 'folder');
      return searchUrl.toString();
    }

    // 3. If it's a SharePoint Team Site (/sites/<site>/...)
    const teamSiteMatch = rawServerRelativePath.match(/^(\/sites\/[^/]+)(\/.*)?$/i);
    if (teamSiteMatch) {
      let decodedFolderPath = rawServerRelativePath;
      try {
        decodedFolderPath = decodeURIComponent(rawServerRelativePath);
      } catch {
        // Keep raw path
      }
      if (parsed.pathname.toLowerCase().endsWith('/allitems.aspx')) {
        parsed.searchParams.set('view', '7');
        parsed.searchParams.set('q', cleanQuery);
        return parsed.toString();
      }
      const existingId = parsed.searchParams.get('id');
      const targetFolderId = existingId || decodedFolderPath;
      const searchUrl = new URL(`${parsed.origin}${teamSiteMatch[1]}/_layouts/15/onedrive.aspx`);
      searchUrl.searchParams.set('id', targetFolderId);
      searchUrl.searchParams.set('qt', 'search');
      searchUrl.searchParams.set('q', cleanQuery);
      searchUrl.searchParams.set('searchScope', 'folder');
      return searchUrl.toString();
    }

    // 4. Fallback for generic SharePoint/OneDrive URLs: attach search parameters directly
    parsed.searchParams.set('qt', 'search');
    parsed.searchParams.set('q', cleanQuery);
    return parsed.toString();
  } catch {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}qt=search&q=${encodeURIComponent(cleanQuery)}`;
  }
}

export interface ColumnDefinition {
  id: string;          // identifier, e.g. 'office', 'contractor', 'workOrderNumber', or 'col_...'
  title: string;       // display title, e.g. '1. المكتب'
  field?: string;       // field key in WorkOrder
  isRemovable?: boolean;// whether column can be deleted (custom columns can be deleted)
  hasDropdown?: boolean;// whether cells in this column have dropdown selection
  dropdownKey?: string;// key in dropdown options map
  order?: number;
  width?: string | number;
  minWidth?: string;
  type?: string;
  isCustom?: boolean;
  visible?: boolean;
  key?: string;
}

export interface DropdownOptionsMap {
  office?: string[];
  contractor?: string[];
  consultant?: string[];
  workOrderCode?: string[];
  executionStatus?: string[];
  procedure155Status?: string[];
  boqModification?: string[];
  photoCoordination?: string[];
  attachmentStatus?: string[];
  photoDocumentation?: string[];
  consultantForms?: string[];
  consultantClearanceForms?: string[];
  form190?: string[];
  form200?: string[];
  inspectionForm?: string[];
  officeContractors?: Record<string, string[]>;
  officeConsultants?: Record<string, string[]>;
  [key: string]: any;
}

export interface MonthTable {
  id: string;
  year: number;
  month: number | 'all';
  name: string;
  description?: string;
  createdAt: string;
  color?: string; // 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'indigo' | 'cyan'
  isDefault?: boolean;
  serialNumber?: number;
  isNew?: boolean;
}

export interface DataBackupSnapshot {
  id: string;
  timestamp: string;
  label: string;
  ordersCount: number;
  tablesCount: number;
  officesCount: number;
  source: 'auto_periodic' | 'manual' | 'pre_update' | 'excel_import' | 'server_sync' | 'recovery';
  data: {
    workOrders: WorkOrder[];
    offices: SubOffice[];
    columns: ColumnDefinition[];
    dropdownOptions: DropdownOptionsMap;
    monthTables?: MonthTable[];
    archivedReports?: ArchivedReportSnapshot[];
  };
}

export interface QualityNoteHistoryEntry {
  id: string;
  previousText: string;
  newText: string;
  editedAt: string;
  editedAtRiyadh: string;
  editorName: string;
  editorEmail: string;
  editorId: string;
}

export interface QualityNoteItem {
  id: string;
  text: string;
  photos?: string[]; // base64 or image URLs
  files?: AttachedInspectionFile[];
  createdAt?: string;
  createdAtRiyadh?: string;
  author?: string;
  authorName?: string;
  authorEmail?: string;
  authorId?: string;
  updatedAt?: string;
  updatedAtRiyadh?: string;
  updatedByName?: string;
  updatedByEmail?: string;
  updatedById?: string;
  editHistory?: QualityNoteHistoryEntry[];
}

export type AuditItemOption = 'ممتثل' | 'غير ممتثل' | 'لا ينطبق';

export type AuditSyncStatus =
  | 'محفوظ ومزامن'
  | 'جارٍ الحفظ'
  | 'تعذر الحفظ'
  | 'تعارض يحتاج إلى مراجعة'
  | 'synced'
  | 'saving'
  | 'error'
  | 'conflict';

export interface AuditEventLogEntry {
  id: string;
  orderId: string;
  columnField: 'pdcAudit' | 'constructionAudit' | 'procedure155Status';
  columnTitle: 'تدقيق PDC' | 'تدقيق الإنشاءات' | 'تدقيق المساندة الفنية';
  previousStatus?: string;
  newStatus: string;
  auditorUserId: string;
  auditorName: string;
  auditorEmail: string;
  auditDateRiyadh: string;
  auditTimeRiyadh: string;
  timestampIso: string;
  syncStatus: AuditSyncStatus;
  summary?: string;
}

export interface AuditSectionCategoryData {
  items?: Record<number, AuditItemOption>;
  notes?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  evaluatedByEmail?: string;
  evaluatedByUserId?: string;
  status?: 'ممتثل' | 'غير ممتثل' | 'لا ينطبق' | 'قيد التدقيق';
  compliancePercentage?: number;
}

export interface FinalVerificationData {
  status?: 'مؤهل' | 'غير مؤهل' | 'قيد التدقيق';
  notes?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verifiedByEmail?: string;
  verifiedByUserId?: string;
}

export type AuditChecklistCategoryKey =
  | 'stationRoom'
  | 'hvSwitchgear'
  | 'transformerSubstation'
  | 'lvPanel'
  | 'subDistributionPanel'
  | 'stationFoundations'
  | 'enclosures'
  | 'protectionBollards'
  | 'stationEarthing'
  | 'boxesAndMeters'
  | 'overheadPoles'
  | 'conductors'
  | 'stayWire'
  | 'riserCables'
  | 'overheadEquipment'
  | 'excavations'
  | 'joints'
  | 'terminations';

export interface WorkOrderAuditColumnData {
  mainStatus?: 'مؤهل' | 'غير مؤهل' | 'قيد التدقيق' | 'غير محدد' | string;
  stationRoom?: AuditSectionCategoryData;
  hvSwitchgear?: AuditSectionCategoryData;
  transformerSubstation?: AuditSectionCategoryData;
  lvPanel?: AuditSectionCategoryData;
  subDistributionPanel?: AuditSectionCategoryData;
  stationFoundations?: AuditSectionCategoryData;
  enclosures?: AuditSectionCategoryData;
  protectionBollards?: AuditSectionCategoryData;
  stationEarthing?: AuditSectionCategoryData;
  boxesAndMeters?: AuditSectionCategoryData;
  overheadPoles?: AuditSectionCategoryData;
  conductors?: AuditSectionCategoryData;
  stayWire?: AuditSectionCategoryData;
  riserCables?: AuditSectionCategoryData;
  overheadEquipment?: AuditSectionCategoryData;
  excavations?: AuditSectionCategoryData;
  joints?: AuditSectionCategoryData;
  terminations?: AuditSectionCategoryData;
  // Primary Technical Support 9-item checklist data for PDC & Construction Audit columns
  supportChecklist?: Record<string, 'مكتمل' | 'غير مكتمل' | 'لا ينطبق' | string>;
  evaluatedKeys?: string[];
  itemUpdatedAt?: Record<string, string>;
  compliancePercentage?: number;
  // Legacy keys kept optional for backward compatibility
  meter?: AuditSectionCategoryData;
  excavation?: AuditSectionCategoryData;
  equipment?: AuditSectionCategoryData;
  finalVerification?: FinalVerificationData;
  lastUpdatedAt?: string;
  lastUpdatedBy?: string;
  auditorUserId?: string;
  auditorName?: string;
  auditorEmail?: string;
  auditDateRiyadh?: string;
  auditTimeRiyadh?: string;
  syncStatus?: AuditSyncStatus;
  history?: AuditEventLogEntry[];
  [key: string]: any;
}

export interface TechnicalSupportAuditCardData {
  status?: Procedure155Status | string;
  auditorUserId?: string;
  auditorName?: string;
  auditorEmail?: string;
  auditDateRiyadh?: string;
  auditTimeRiyadh?: string;
  lastUpdatedAt?: string;
  syncStatus?: AuditSyncStatus;
  evaluatedKeys?: string[];
}

export interface WorkOrder {
  id: string;
  recordVersion?: number;
  fieldUpdatedAt?: Record<string, string>;
  // Table identifier & strict Year/Month container scope (prevents any cross-table or cross-month overlap)
  tableId?: string;
  tableYear?: number;
  tableMonth?: number;
  tableName?: string;
  // 1. المكتب (Sub-office)
  office: string;
  // 2. المقاول (Contractor)
  contractor: string;
  // 2b. الاستشاري (Consultant - immediately after Contractor)
  consultant?: string;
  // 3. رقم أمر العمل (Work Order Number)
  workOrderNumber: string;
  // 4. نوع أمر العمل (Work Order Code / Type)
  workOrderCode: string;
  // 4b. تاريخ الاستلام (Receipt Date - deprecated/removed per requirement)
  receiptDate?: string;
  // 5. حالة التنفيذ (Execution Status - set in Add Work Order)
  executionStatus?: string;
  
  // عمود ملف الصور (قبل عمود توثيق الصور) - استيراد ملفات PDF وصور مع رابط SharePoint الموحد وحماية الحذف بالرقم السري 321
  photosFile?: AttachedInspectionFile[];
  // عمود حالة الارفاق (بعد عمود ملف الصور مباشرة وقبل توثيق الصور)
  attachmentStatus?: AttachmentStatus | string;
  // بنود توثيق الصور التفصيلية في Check List المساندة الفنية وحالة الإرفاق:
  meterPhotoDocumentation?: FourStateStatus | string;
  excavationPhotoDocumentation?: FourStateStatus | string;
  equipmentPhotoDocumentation?: FourStateStatus | string;
  overheadPhotoDocumentation?: FourStateStatus | string;
  // 5 (Table Col 5). توثيق الصور (للتوافق مع السجلات السابقة)
  photoDocumentation?: FourStateStatus | string;
  // 6 (Table Col 6). نماذج الاستشاري
  consultantForms?: FourStateStatus | string;
  // 6b (Table Col 7). نماذج إجازة الاستشاري
  consultantClearanceForms?: FourStateStatus | string;
  // 7 (Table Col 8). نموذج 190
  form190?: FiveStateStatus | string;
  // 8 (Table Col 8). نموذج 200
  form200?: FiveStateStatus | string;
  // 9 (Table Col 9). نموذج الفحص
  inspectionForm?: FiveStateStatus | string;
  // 10 (Table Col 10). ملاحظات الجودة
  qualityNotes?: string;
  // عنصرة الملاحظات مع الصور المتعددة
  qualityNoteItems?: QualityNoteItem[];

  // بيانات المستخدم الذي قام بإضافة أمر العمل (تظهر أسفل اسم الاستشاري)
  addedByEmail?: string;
  addedByName?: string;
  createdByEmail?: string;

  // Legacy / backward-compat fields
  photoCoordination?: string;
  photos?: PhotoItem[];
  executionNotes?: string;
  boqModification?: BoqModificationStatus;
  boqDetails?: string;

  // أعمدة التدقيق الثلاثة المستقلة:
  // 1. تدقيق PDC
  pdcAudit?: WorkOrderAuditColumnData;
  // 2. تدقيق الإنشاءات
  constructionAudit?: WorkOrderAuditColumnData;
  // 3. تدقيق المساندة الفنية (سابقاً حالة أمر العمل)
  procedure155Status?: Procedure155Status | string;
  technicalSupportAudit?: TechnicalSupportAuditCardData;
  
  // 12. مزامنة التدقيق (بعد أعمدة التدقيق الثلاثة - تشمل حالة الحفظ ووقت وتاريخ وإيميل المدقق وسجل العمليات)
  statusSyncTime?: string;
  statusSyncEmail?: string;
  statusSyncUser?: string;
  statusSyncUserId?: string;
  statusSyncDateRiyadh?: string;
  statusSyncTimeRiyadh?: string;
  auditSyncStatus?: AuditSyncStatus | string;
  auditSyncError?: string;
  auditHistory?: AuditEventLogEntry[];
  
  // 13. اجراء 155 (بعد عمود مزامنة التدقيق)
  procedure155?: string;
  
  // 14. مزامنة الاجراء (بعد عمود اجراء 155 - تشمل وقت وتاريخ وايميل المستخدم)
  procedureSyncTime?: string;
  procedureSyncEmail?: string;
  procedureSyncUser?: string;
  
  // Metadata & Audit Trail
  createdAt?: string;
  updatedAt?: string;
  lastUpdatedBy?: string;
  priority?: 'عالية' | 'متوسطة' | 'عادية';
  inspectorName?: string;
  completionPercentage?: number;

  // Edit & New Tracking
  isNew?: boolean;
  isEdited?: boolean;
  lastEditedAt?: string;
  editedFields?: string[];

  // Imported from Compatible Tables Tracking & Distinction (استيراد البيانات من الجداول المتوافقة)
  isImported?: boolean;
  importedFromTableId?: string;
  importedFromTableName?: string;
  importedAt?: string;
  importedFields?: string[];
  importedSourceOrderId?: string;
  
  // Custom Visual Highlighting & Row Background
  rowBgColor?: string;
  cellStyles?: Record<string, {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    fontSize?: number;
    fontFamily?: string;
    textColor?: string | null;
    bgColor?: string | null;
    textAlign?: 'center' | 'right' | 'left';
  }>;

  // Support dynamic custom columns
  [key: string]: any;
}

export interface ArchivedReportSnapshot {
  id: string;
  title: string;
  periodType: 'month' | 'multi_month' | 'quarter' | 'semi_annual' | 'annual';
  periodLabel: string;
  year: number;
  months: number[];
  createdAt: string;
  totalOrders: number;
  qualifiedOrders: number;
  unqualifiedOrders: number;
  completionRate: number;
  officeBreakdown: { office: string; total: number; qualified: number; unqualified: number }[];
  contractorBreakdown: { contractor: string; total: number; qualified: number; unqualified: number }[];
  statusCounts: Record<string, number>;
  archivedOrdersSummary?: {
    id: string;
    workOrderNumber: string;
    workOrderCode: string;
    receiptDate?: string;
    office: string;
    contractor: string;
    status: string;
  }[];
}

export interface SubOffice {
  id: string;
  name: string;
  code: string;
  description?: string;
  region: string;
  manager?: string;
  contactNumber?: string;
  activeOrdersCount?: number;
  contractors?: string[];
  defaultContractor?: string;
  consultants?: string[];
  defaultConsultant?: string;
}

export interface HistoryStep {
  id: string;
  actionName: string;
  workOrders: WorkOrder[];
  timestamp: number;
}

export interface ConnectedUserInfo {
  clientId: string;
  userName: string;
  userRole: string;
  device?: string;
  connectedAt?: string;
  lastActiveAt?: string;
  lastSeen?: string;
  transport?: 'ws' | 'sse' | 'poll';
  mode?: string;
}

export interface LiveNotificationItem {
  id: string;
  eventId?: string;
  title: string;
  message: string;
  type: 'create' | 'update' | 'delete' | 'import' | 'restore' | 'sync' | 'broadcast' | 'office';
  priority?: 'high' | 'normal' | 'low';
  senderId: string;
  senderName: string;
  senderRole?: string;
  senderDevice?: string;
  office?: string;
  workOrderNumber?: string;
  orderId?: string;
  timestamp: string;
  read?: boolean;
  isUrgent?: boolean;
}

export interface UserPermissions {
  // 1. صلاحيات تبويبات العمود الجانبي والصفحات الرئيسية
  tabHome?: boolean;
  tabWorkOrders?: boolean;
  tabKpis?: boolean;
  tabQualityGuide?: boolean;
  tabAuditHub?: boolean;
  tabOffices?: boolean;
  tabContractors?: boolean;
  tabArchive?: boolean;
  tabReports?: boolean;
  tabDocuments?: boolean;
  tabSettings?: boolean;

  // 2. أدوات أوامر العمل والجدول والمرفقات
  addWorkOrder: boolean;
  editWorkOrderStatus: boolean;
  editWorkOrderBasic: boolean;
  inlineTableEdit: boolean;
  deleteWorkOrder: boolean;
  uploadInspectionFiles?: boolean;
  viewPhotos?: boolean;
  searchAndFilter: boolean;
  undoRedo?: boolean;

  // 3. التدقيق الثلاثي المستقل واعتماد وأرشفة إجراء 155
  auditPdcColumn?: boolean;
  auditConstructionColumn?: boolean;
  auditTechnicalSupportColumn?: boolean;
  editProcedure155?: boolean;
  smartAudit: boolean;
  manageArchive155?: boolean;

  // 4. الاطلاع على التقارير ولوحات القياس التفاعلية والتصدير
  viewKpiDashboard: boolean;
  viewComprehensiveReports?: boolean;
  viewWeeklyReport: boolean;
  viewOfficeComparison: boolean;
  viewContractorClosureReport: boolean;
  viewNotesReport?: boolean;
  viewArchive: boolean;
  exportTable: boolean;

  // 5. الاستيراد وإدارة الجداول والهيكل والمكاتب
  importExcel: boolean;
  importCompatibleTables?: boolean;
  manageMonthTables: boolean;
  deleteMonthTable: boolean;
  manageOffices: boolean;
  manageContractors: boolean;
  manageColumns: boolean;
  manageDropdowns: boolean;

  // 6. الخزنة السحابية والإشعارات وإدارة النظام
  clearData: boolean;
  restoreDeleted: boolean;
  manageCloudBackups?: boolean;
  manageNotifications: boolean;
  managePermissions: boolean;

  // 7. الصلاحيات المخصصة للأعمدة (قائمة معرفات الحقول المسموح بتعديلها)
  allowedColumns?: string[];
}

export interface PlatformUser {
  id: string;
  email: string;
  username: string;
  password?: string;
  passwordHash?: string;
  hasPassword?: boolean;
  displayName: string;
  roleTitle: string;
  isSuperAdmin?: boolean;
  isActive: boolean;
  permissions: UserPermissions;
  allowedColumns?: string[];
  createdByEmail?: string;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface RealtimeEvent {
  eventId?: string;
  type: 
    | 'SYNC_ALL' 
    | 'SYNC_STATE'
    | 'RESTORE_SNAPSHOT'
    | 'CREATE_ORDER' 
    | 'CREATE_BATCH_ORDERS'
    | 'UPDATE_ORDER' 
    | 'DELETE_ORDER' 
    | 'DELETE_BATCH_ORDERS'
    | 'CLEAR_ORDERS'
    | 'ADD_OFFICE'
    | 'UPDATE_OFFICE'
    | 'DELETE_OFFICE'
    | 'ADD_MONTH_TABLE'
    | 'UPDATE_MONTH_TABLE'
    | 'DELETE_MONTH_TABLE'
    | 'UPDATE_MONTH_TABLES'
    | 'UPDATE_COLUMNS' 
    | 'UPDATE_DROPDOWN_OPTIONS' 
    | 'UPDATE_OFFICE_CONTRACTORS'
    | 'UPDATE_USERS'
    | 'BROADCAST_ALERT'
    | 'USER_PRESENCE'
    | 'HEARTBEAT'
    | 'PING'
    | 'PONG'
    | 'PLATFORM_PUBLISHED';
  payload: any;
  senderId: string;
  senderName?: string;
  senderEmail?: string;
  senderRole?: string;
  senderDevice?: string;
  isStudioPreview?: boolean;
  timestamp: string;
  version?: number;
}

export interface ExportEmailRecipient {
  email: string;
  name: string;
  username?: string;
  roleTitle?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass?: string;
  fromEmail?: string;
  fromName?: string;
}

export interface ExportEmailRequest {
  recipients: ExportEmailRecipient[];
  exportType: 'pdf' | 'excel' | 'pptx' | 'image';
  fileName: string;
  fileBase64: string;
  fileMime?: string;
  subject?: string;
  customMessage?: string;
  senderName?: string;
  senderEmail?: string;
}

export interface SentEmailLogItem {
  id: string;
  timestamp: string;
  recipients: ExportEmailRecipient[];
  subject: string;
  fileName: string;
  exportType: string;
  senderName: string;
  senderEmail?: string;
  recipientSalutation?: string;
  status: 'sent' | 'simulated' | 'failed';
  previewText: string;
  mode?: string;
  previewUrl?: string;
  emlDownloadUrl?: string;
  htmlBody?: string;
  fileSizeBytes?: number;
}

