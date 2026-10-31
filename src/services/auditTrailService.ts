import { WorkOrder, PlatformUser } from '../types';
import { getSavedCurrentUser } from '../utils/security';

export type AuditOperationType =
  | 'DATA_ENTRY'           // إدخال البيانات
  | 'DATA_EDIT'            // تعديل البيانات
  | 'DATA_DELETE'          // حذف البيانات
  | 'AUDIT_OPERATION'      // عمليات التدقيق
  | 'ITEM_STATUS_CHANGE'   // تغيير حالات البنود
  | 'ORDER_STATUS_CHANGE'  // تغيير حالة أوامر العمل
  | 'ATTACHMENT_UPLOAD'    // رفع المرفقات
  | 'ATTACHMENT_DELETE'    // حذف المرفقات
  | 'AUDIT_APPROVAL'       // اعتماد التدقيق
  | 'APPROVAL_REVOKE'      // إلغاء الاعتماد
  | 'CHECKLIST_UPDATE'     // تحديث قوائم التحقق (Checklists)
  | 'BULK_EDIT';           // التعديلات الجماعية

export interface AuditTrailRecord {
  id: string;
  userName: string;
  userEmail: string;
  userRole: string;
  timestamp: string;
  riyadhTime: string;
  operationType: AuditOperationType;
  operationLabel: string;
  fieldLabel: string;
  previousValue: string;
  newValue: string;
  deviceSession: string;
  workOrderNumber: string;
  workOrderId: string;
  office?: string;
  isFinalAction: true;
}

const AUDIT_TRAIL_STORAGE_KEY = 'qcms_155_immutable_audit_trail_v1';
const SESSION_ID_STORAGE_KEY = 'qcms_155_active_session_id';
const MAX_AUDIT_RECORDS = 2500;

function getOrCreateSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_ID_STORAGE_KEY);
    if (!sid) {
      sid = `SES-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      sessionStorage.setItem(SESSION_ID_STORAGE_KEY, sid);
    }
    return sid;
  } catch {
    return 'SES-ACTIVE';
  }
}

export function getDeviceAndSessionLabel(): string {
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    let os = 'جهاز مكتبي';
    if (/Windows/i.test(ua)) os = 'Windows PC';
    else if (/Macintosh|Mac OS/i.test(ua)) os = 'Mac';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let browser = 'متصفح ويب';
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/Chrome\//i.test(ua)) browser = 'Chrome';
    else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';

    const sid = getOrCreateSessionId();
    return `${os} (${browser}) • ${sid}`;
  } catch {
    return 'جلسة ويب نشطة';
  }
}

export function formatRiyadhDateTime(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(date);
  } catch {
    return date.toLocaleString('ar-SA');
  }
}

const FIELD_ARABIC_NAMES: Record<string, string> = {
  office: 'المكتب الفرعي',
  contractor: 'المقاول المنفذ',
  consultant: 'الاستشاري',
  workOrderNumber: 'رقم أمر العمل',
  workOrderCode: 'نوع أمر العمل',
  executionStatus: 'حالة التنفيذ',
  attachmentStatus: 'حالة الإرفاق',
  procedure155Status: 'تدقيق المساندة الفنية',
  pdcAudit: 'تدقيق الـ PDC',
  constructionAudit: 'تدقيق الإنشاءات',
  publicationStatus: 'حالة النشر',
  extractNumber: 'المستخلص',
  qualityNotes: 'ملاحظات الجودة',
  photosFile: 'ملف الصور والمرفقات',
  photos: 'معرض الصور الميدانية',
  technicalSupportChecklist: 'قائمة تحقق المساندة الفنية (Check List)'
};

class AuditTrailService {
  private listeners: Set<(records: AuditTrailRecord[]) => void> = new Set();

  public getAllRecords(): AuditTrailRecord[] {
    try {
      const raw = localStorage.getItem(AUDIT_TRAIL_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveRecords(records: AuditTrailRecord[]): void {
    try {
      const trimmed = records.slice(0, MAX_AUDIT_RECORDS);
      localStorage.setItem(AUDIT_TRAIL_STORAGE_KEY, JSON.stringify(trimmed));
      this.notifyListeners(trimmed);
    } catch (e) {
      console.error('Failed to persist immutable audit trail:', e);
    }
  }

  public subscribe(listener: (records: AuditTrailRecord[]) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(records: AuditTrailRecord[]): void {
    this.listeners.forEach((cb) => {
      try {
        cb(records);
      } catch {
        // ignore listener errors
      }
    });
  }

  public recordAction(params: {
    operationType: AuditOperationType;
    operationLabel: string;
    fieldLabel?: string;
    previousValue?: string;
    newValue?: string;
    workOrderNumber?: string;
    workOrderId?: string;
    office?: string;
    user?: PlatformUser | null;
  }): AuditTrailRecord {
    const activeUser = params.user || getSavedCurrentUser();
    const now = new Date();
    const entry: AuditTrailRecord = {
      id: `AUD-${now.getTime()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      userName: activeUser?.displayName || activeUser?.username || 'مستخدم المنصة',
      userEmail: activeUser?.email || activeUser?.username || 'engmhp1@gmail.com',
      userRole: activeUser?.roleTitle || 'مهندس معتمد',
      timestamp: now.toISOString(),
      riyadhTime: formatRiyadhDateTime(now),
      operationType: params.operationType,
      operationLabel: params.operationLabel,
      fieldLabel: params.fieldLabel || params.operationLabel,
      previousValue: params.previousValue !== undefined && params.previousValue !== '' ? String(params.previousValue) : '—',
      newValue: params.newValue !== undefined && params.newValue !== '' ? String(params.newValue) : '—',
      deviceSession: getDeviceAndSessionLabel(),
      workOrderNumber: params.workOrderNumber || 'عام',
      workOrderId: params.workOrderId || '',
      office: params.office || '',
      isFinalAction: true
    };

    const existing = this.getAllRecords();
    const updated = [entry, ...existing];
    this.saveRecords(updated);
    return entry;
  }

  /**
   * Automatically compares previous and updated WorkOrder to log exact granular Audit Trail entries
   */
  public recordWorkOrderDiff(
    prevOrder: WorkOrder | undefined,
    nextOrder: WorkOrder,
    user?: PlatformUser | null
  ): AuditTrailRecord[] {
    const createdEntries: AuditTrailRecord[] = [];
    const won = nextOrder.workOrderNumber || prevOrder?.workOrderNumber || 'بدون رقم';
    const wid = nextOrder.id;
    const office = nextOrder.office || prevOrder?.office || '';

    if (!prevOrder) {
      createdEntries.push(
        this.recordAction({
          operationType: 'DATA_ENTRY',
          operationLabel: 'إدخال بيانات أمر عمل جديد',
          fieldLabel: 'إنشاء سجل أمر عمل',
          previousValue: 'غير موجود (سجل جديد)',
          newValue: `أمر عمل رقم ${won} - المكتب: ${office} - المقاول: ${nextOrder.contractor || 'غير محدد'}`,
          workOrderNumber: won,
          workOrderId: wid,
          office,
          user
        })
      );
      return createdEntries;
    }

    // 1. Check attachments (photosFile) upload or delete
    const prevFiles = prevOrder.photosFile || [];
    const nextFiles = nextOrder.photosFile || [];
    if (nextFiles.length > prevFiles.length) {
      const addedNames = nextFiles
        .filter((nf) => !prevFiles.some((pf) => pf.id === nf.id))
        .map((f) => f.name)
        .join('، ');
      createdEntries.push(
        this.recordAction({
          operationType: 'ATTACHMENT_UPLOAD',
          operationLabel: 'رفع مرفق في ملف الصور والمستندات',
          fieldLabel: 'ملف الصور والمرفقات',
          previousValue: `${prevFiles.length} مرفق`,
          newValue: `${nextFiles.length} مرفق (${addedNames || 'ملف جديد'})`,
          workOrderNumber: won,
          workOrderId: wid,
          office,
          user
        })
      );
    } else if (nextFiles.length < prevFiles.length) {
      const removedNames = prevFiles
        .filter((pf) => !nextFiles.some((nf) => nf.id === pf.id))
        .map((f) => f.name)
        .join('، ');
      createdEntries.push(
        this.recordAction({
          operationType: 'ATTACHMENT_DELETE',
          operationLabel: 'حذف مرفق من ملف الصور والمستندات',
          fieldLabel: 'ملف الصور والمرفقات',
          previousValue: `${prevFiles.length} مرفق (${removedNames || 'مرفق محذوف'})`,
          newValue: `${nextFiles.length} مرفق`,
          workOrderNumber: won,
          workOrderId: wid,
          office,
          user
        })
      );
    }

    // 2. Check Field Photos (photos) upload or delete
    const prevPhotos = prevOrder.photos || [];
    const nextPhotos = nextOrder.photos || [];
    if (nextPhotos.length > prevPhotos.length) {
      createdEntries.push(
        this.recordAction({
          operationType: 'ATTACHMENT_UPLOAD',
          operationLabel: 'رفع صور ميدانية لأمر العمل',
          fieldLabel: 'معرض الصور',
          previousValue: `${prevPhotos.length} صورة`,
          newValue: `${nextPhotos.length} صورة`,
          workOrderNumber: won,
          workOrderId: wid,
          office,
          user
        })
      );
    } else if (nextPhotos.length < prevPhotos.length) {
      createdEntries.push(
        this.recordAction({
          operationType: 'ATTACHMENT_DELETE',
          operationLabel: 'حذف صورة ميدانية من أمر العمل',
          fieldLabel: 'معرض الصور',
          previousValue: `${prevPhotos.length} صورة`,
          newValue: `${nextPhotos.length} صورة`,
          workOrderNumber: won,
          workOrderId: wid,
          office,
          user
        })
      );
    }

    // 3. Check Technical Support Checklist changes
    const prevTs = prevOrder.technicalSupportChecklist || {};
    const nextTs = nextOrder.technicalSupportChecklist || {};
    const tsKeys = new Set([...Object.keys(prevTs), ...Object.keys(nextTs)]);
    tsKeys.forEach((key) => {
      const pVal = (prevTs as any)[key] || 'غير مكتمل';
      const nVal = (nextTs as any)[key] || 'غير مكتمل';
      if (pVal !== nVal) {
        createdEntries.push(
          this.recordAction({
            operationType: 'CHECKLIST_UPDATE',
            operationLabel: 'تحديث قائمة تحقق المساندة الفنية',
            fieldLabel: `بند تدقيق المساندة (${key})`,
            previousValue: String(pVal),
            newValue: String(nVal),
            workOrderNumber: won,
            workOrderId: wid,
            office,
            user
          })
        );
      }
    });

    // 4. Check PDC & Construction Audit Checklists
    const checkAuditColumn = (colKey: 'pdcAudit' | 'constructionAudit', colTitle: string) => {
      const prevCheck = prevOrder.auditChecklists?.[colKey];
      const nextCheck = nextOrder.auditChecklists?.[colKey];
      if (JSON.stringify(prevCheck?.items || {}) !== JSON.stringify(nextCheck?.items || {})) {
        const pItems = prevCheck?.items || {};
        const nItems = nextCheck?.items || {};
        let changedCount = 0;
        Object.keys(nItems).forEach((k) => {
          if (pItems[k]?.status !== nItems[k]?.status || pItems[k]?.note !== nItems[k]?.note) {
            changedCount++;
          }
        });
        const prevStatusStr = typeof prevOrder[colKey] === 'object' && prevOrder[colKey] !== null
          ? (prevOrder[colKey] as any).status || 'قيد التدقيق'
          : String(prevOrder[colKey] || 'قيد التدقيق');
        const nextStatusStr = typeof nextOrder[colKey] === 'object' && nextOrder[colKey] !== null
          ? (nextOrder[colKey] as any).status || 'تم التحديث'
          : String(nextOrder[colKey] || 'تم التحديث');

        createdEntries.push(
          this.recordAction({
            operationType: 'CHECKLIST_UPDATE',
            operationLabel: `تحديث قوائم التحقق (${colTitle})`,
            fieldLabel: colTitle,
            previousValue: prevStatusStr,
            newValue: `${nextStatusStr} (${changedCount || 1} بند تم تحديثه)`,
            workOrderNumber: won,
            workOrderId: wid,
            office,
            user
          })
        );
      }
    };
    checkAuditColumn('pdcAudit', 'تدقيق الـ PDC');
    checkAuditColumn('constructionAudit', 'تدقيق الإنشاءات');

    // 5. Check standard fields & status approvals/revocations
    const standardFields: (keyof WorkOrder)[] = [
      'office',
      'contractor',
      'consultant',
      'workOrderNumber',
      'workOrderCode',
      'executionStatus',
      'attachmentStatus',
      'procedure155Status',
      'pdcAudit',
      'constructionAudit',
      'publicationStatus',
      'extractNumber',
      'qualityNotes'
    ];

    const isApprovedValue = (val: string) =>
      val.includes('مكتمل') ||
      val.includes('مؤهل') ||
      val.includes('تم النشر') ||
      val.includes('تم الاستلام') ||
      val.includes('معتمد') ||
      val.includes('جاهز للارفاق الكامل');

    standardFields.forEach((fieldKey) => {
      const pVal = String(prevOrder[fieldKey] ?? '').trim();
      const nVal = String(nextOrder[fieldKey] ?? '').trim();
      if (pVal !== nVal) {
        const fieldLabel = FIELD_ARABIC_NAMES[fieldKey] || String(fieldKey);
        let opType: AuditOperationType = 'DATA_EDIT';
        let opLabel = `تعديل ${fieldLabel}`;

        if (
          fieldKey === 'procedure155Status' ||
          fieldKey === 'pdcAudit' ||
          fieldKey === 'constructionAudit' ||
          fieldKey === 'publicationStatus'
        ) {
          if (!isApprovedValue(pVal) && isApprovedValue(nVal)) {
            opType = 'AUDIT_APPROVAL';
            opLabel = `اعتماد تدقيق (${fieldLabel})`;
          } else if (isApprovedValue(pVal) && !isApprovedValue(nVal)) {
            opType = 'APPROVAL_REVOKE';
            opLabel = `إلغاء اعتماد سابق (${fieldLabel})`;
          } else {
            opType = 'AUDIT_OPERATION';
            opLabel = `عملية تدقيق (${fieldLabel})`;
          }
        } else if (fieldKey === 'executionStatus' || fieldKey === 'attachmentStatus') {
          opType = 'ORDER_STATUS_CHANGE';
          opLabel = `تغيير حالة أمر العمل (${fieldLabel})`;
        }

        createdEntries.push(
          this.recordAction({
            operationType: opType,
            operationLabel: opLabel,
            fieldLabel,
            previousValue: pVal || 'فارغ',
            newValue: nVal || 'فارغ',
            workOrderNumber: won,
            workOrderId: wid,
            office,
            user
          })
        );
      }
    });

    return createdEntries;
  }
}

export const auditTrailService = new AuditTrailService();
