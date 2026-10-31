import type {
  WorkOrder,
  WorkOrderAuditColumnData,
  AuditEventLogEntry,
  QualityNoteItem,
  QualityNoteHistoryEntry,
  AuditSyncStatus,
} from '../types.ts';
import { getRiyadhNow } from './scheduledBackupService.ts';

export interface VerifiedSessionIdentity {
  id: string;
  email: string;
  displayName: string;
}

/**
 * Enforces strict server-verified auditor identity, Asia/Riyadh date & time,
 * independent column state, and append-only auditHistory for the 3 audit columns:
 * 1. تدقيق PDC (pdcAudit)
 * 2. تدقيق الإنشاءات (constructionAudit)
 * 3. تدقيق المساندة الفنية (procedure155Status)
 *
 * Also stamps qualityNoteItems with verified author identity & editHistory.
 */
export function applyServerVerifiedAuditAndNoteMetadata(
  existingOrder: WorkOrder | null,
  incomingOrder: Partial<WorkOrder>,
  verifiedUser: VerifiedSessionIdentity,
  syncStatus: AuditSyncStatus = 'محفوظ ومزامن'
): Partial<WorkOrder> {
  const riyadh = getRiyadhNow();
  const result: Partial<WorkOrder> = { ...incomingOrder };
  const orderId = String(incomingOrder.id || existingOrder?.id || '');

  // Preserve existing auditHistory (append-only, never overwrite)
  const existingHistory: AuditEventLogEntry[] = Array.isArray(existingOrder?.auditHistory)
    ? [...existingOrder!.auditHistory!]
    : Array.isArray(incomingOrder.auditHistory)
    ? [...incomingOrder.auditHistory]
    : [];

  let anyAuditColumnChanged = false;

  const ALL_18_CATEGORY_KEYS = [
    'stationRoom',
    'hvSwitchgear',
    'transformerSubstation',
    'lvPanel',
    'subDistributionPanel',
    'stationFoundations',
    'enclosures',
    'protectionBollards',
    'stationEarthing',
    'boxesAndMeters',
    'overheadPoles',
    'conductors',
    'stayWire',
    'riserCables',
    'overheadEquipment',
    'excavations',
    'joints',
    'terminations',
    'meter',
    'excavation',
    'equipment'
  ] as const;

  const sanitizeAuditObject = (raw: any): WorkOrderAuditColumnData => {
    if (!raw) return {};
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      return {
        mainStatus: trimmed === 'مؤهل' || trimmed === 'غير مؤهل' ? trimmed : 'غير محدد'
      };
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) return {};
    const cleaned: WorkOrderAuditColumnData = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!/^\d+$/.test(k)) {
        cleaned[k] = v;
      }
    }
    return cleaned;
  };

  const buildAuditComparableSnapshot = (auditObj?: WorkOrderAuditColumnData) => {
    const safe = sanitizeAuditObject(auditObj);
    const categoriesSnapshot: Record<string, any> = {};
    for (const key of ALL_18_CATEGORY_KEYS) {
      const cat = safe[key];
      if (cat && typeof cat === 'object') {
        categoriesSnapshot[key] = {
          items: cat.items || {},
          notes: cat.notes || '',
          status: cat.status || 'قيد التدقيق'
        };
      }
    }
    return {
      mainStatus: safe.mainStatus || 'غير محدد',
      categories: categoriesSnapshot,
      finalVerification: safe.finalVerification?.status
    };
  };

  const hasMeaningfulAuditInput = (auditObj?: WorkOrderAuditColumnData): boolean => {
    const safe = sanitizeAuditObject(auditObj);
    if (safe.mainStatus && safe.mainStatus !== 'غير محدد') return true;
    if (safe.finalVerification?.status && safe.finalVerification.status !== 'قيد التدقيق') return true;
    for (const key of ALL_18_CATEGORY_KEYS) {
      const cat = safe[key];
      if (cat && typeof cat === 'object') {
        if (cat.items && Object.keys(cat.items).length > 0) return true;
        if (cat.notes && String(cat.notes).trim().length > 0) return true;
        if (cat.status && cat.status !== 'قيد التدقيق') return true;
      }
    }
    return false;
  };

  // 1. Check تدقيق PDC (pdcAudit) independently
  if (incomingOrder.pdcAudit !== undefined) {
    const prevPdc = sanitizeAuditObject(existingOrder?.pdcAudit);
    const incPdc = sanitizeAuditObject(incomingOrder.pdcAudit);
    const nextPdc: WorkOrderAuditColumnData = {
      ...prevPdc,
      ...incPdc,
    };

    const prevJson = JSON.stringify(buildAuditComparableSnapshot(prevPdc));
    const nextJson = JSON.stringify(buildAuditComparableSnapshot(nextPdc));

    const pdcChanged = existingOrder ? prevJson !== nextJson : hasMeaningfulAuditInput(nextPdc);

    if (pdcChanged) {
      anyAuditColumnChanged = true;
      nextPdc.lastUpdatedAt = riyadh.dateTimeRiyadh;
      nextPdc.lastUpdatedBy = verifiedUser.displayName;
      nextPdc.auditorUserId = verifiedUser.id;
      nextPdc.auditorName = verifiedUser.displayName;
      nextPdc.auditorEmail = verifiedUser.email;
      nextPdc.auditDateRiyadh = riyadh.dateRiyadh;
      nextPdc.auditTimeRiyadh = riyadh.timeRiyadh;
      nextPdc.syncStatus = syncStatus;

      const entry: AuditEventLogEntry = {
        id: `aud_pdc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        orderId,
        columnField: 'pdcAudit',
        columnTitle: 'تدقيق PDC',
        previousStatus: prevPdc?.mainStatus || 'غير محدد',
        newStatus: nextPdc.mainStatus || 'قيد التدقيق',
        auditorUserId: verifiedUser.id,
        auditorName: verifiedUser.displayName,
        auditorEmail: verifiedUser.email,
        auditDateRiyadh: riyadh.dateRiyadh,
        auditTimeRiyadh: riyadh.timeRiyadh,
        timestampIso: riyadh.iso,
        syncStatus,
        summary: `تحديث تدقيق PDC إلى (${nextPdc.mainStatus || 'قيد التدقيق'}) بواسطة ${verifiedUser.email}`,
      };

      const colHistory = Array.isArray(prevPdc?.history) ? [...prevPdc!.history!] : [];
      colHistory.unshift(entry);
      nextPdc.history = colHistory.slice(0, 50);
      existingHistory.unshift(entry);
    }
    result.pdcAudit = nextPdc;
  }

  // 2. Check تدقيق الإنشاءات (constructionAudit) independently
  if (incomingOrder.constructionAudit !== undefined) {
    const prevConst = sanitizeAuditObject(existingOrder?.constructionAudit);
    const incConst = sanitizeAuditObject(incomingOrder.constructionAudit);
    const nextConst: WorkOrderAuditColumnData = {
      ...prevConst,
      ...incConst,
    };

    const prevJson = JSON.stringify(buildAuditComparableSnapshot(prevConst));
    const nextJson = JSON.stringify(buildAuditComparableSnapshot(nextConst));

    const constChanged = existingOrder ? prevJson !== nextJson : hasMeaningfulAuditInput(nextConst);

    if (constChanged) {
      anyAuditColumnChanged = true;
      nextConst.lastUpdatedAt = riyadh.dateTimeRiyadh;
      nextConst.lastUpdatedBy = verifiedUser.displayName;
      nextConst.auditorUserId = verifiedUser.id;
      nextConst.auditorName = verifiedUser.displayName;
      nextConst.auditorEmail = verifiedUser.email;
      nextConst.auditDateRiyadh = riyadh.dateRiyadh;
      nextConst.auditTimeRiyadh = riyadh.timeRiyadh;
      nextConst.syncStatus = syncStatus;

      const entry: AuditEventLogEntry = {
        id: `aud_con_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        orderId,
        columnField: 'constructionAudit',
        columnTitle: 'تدقيق الإنشاءات',
        previousStatus: prevConst?.mainStatus || 'غير محدد',
        newStatus: nextConst.mainStatus || 'قيد التدقيق',
        auditorUserId: verifiedUser.id,
        auditorName: verifiedUser.displayName,
        auditorEmail: verifiedUser.email,
        auditDateRiyadh: riyadh.dateRiyadh,
        auditTimeRiyadh: riyadh.timeRiyadh,
        timestampIso: riyadh.iso,
        syncStatus,
        summary: `تحديث تدقيق الإنشاءات إلى (${nextConst.mainStatus || 'قيد التدقيق'}) بواسطة ${verifiedUser.email}`,
      };

      const colHistory = Array.isArray(prevConst?.history) ? [...prevConst!.history!] : [];
      colHistory.unshift(entry);
      nextConst.history = colHistory.slice(0, 50);
      existingHistory.unshift(entry);
    }
    result.constructionAudit = nextConst;
  }

  // 3. Check تدقيق المساندة الفنية (procedure155Status) independently
  if (incomingOrder.procedure155Status !== undefined) {
    const prevStatus = String(existingOrder?.procedure155Status || '');
    const nextStatus = String(incomingOrder.procedure155Status || '');
    const tsChanged = existingOrder ? prevStatus !== nextStatus : Boolean(nextStatus);
    if (tsChanged) {
      anyAuditColumnChanged = true;
      result.technicalSupportAudit = {
        status: incomingOrder.procedure155Status,
        auditorUserId: verifiedUser.id,
        auditorName: verifiedUser.displayName,
        auditorEmail: verifiedUser.email,
        auditDateRiyadh: riyadh.dateRiyadh,
        auditTimeRiyadh: riyadh.timeRiyadh,
        lastUpdatedAt: riyadh.dateTimeRiyadh,
        syncStatus,
      };

      const entry: AuditEventLogEntry = {
        id: `aud_ts_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        orderId,
        columnField: 'procedure155Status',
        columnTitle: 'تدقيق المساندة الفنية',
        previousStatus: prevStatus || 'غير محدد',
        newStatus: nextStatus || 'غير محدد',
        auditorUserId: verifiedUser.id,
        auditorName: verifiedUser.displayName,
        auditorEmail: verifiedUser.email,
        auditDateRiyadh: riyadh.dateRiyadh,
        auditTimeRiyadh: riyadh.timeRiyadh,
        timestampIso: riyadh.iso,
        syncStatus,
        summary: `تحديث تدقيق المساندة الفنية إلى (${nextStatus || 'غير محدد'}) بواسطة ${verifiedUser.email}`,
      };

      existingHistory.unshift(entry);
    } else if (existingOrder?.technicalSupportAudit) {
      result.technicalSupportAudit = existingOrder.technicalSupportAudit;
    }
  }

  if (anyAuditColumnChanged) {
    result.statusSyncTime = `${riyadh.dateRiyadh} ${riyadh.timeRiyadh}`;
    result.statusSyncDateRiyadh = riyadh.dateRiyadh;
    result.statusSyncTimeRiyadh = riyadh.timeRiyadh;
    result.statusSyncEmail = verifiedUser.email;
    result.statusSyncUser = verifiedUser.displayName;
    result.statusSyncUserId = verifiedUser.id;
    result.auditSyncStatus = syncStatus;
    result.auditHistory = existingHistory.slice(0, 100);
  } else if (existingHistory.length > 0) {
    result.auditHistory = existingHistory;
  }

  // 4. Quality Notes (ملاحظات الجودة) - enforce server-verified author identity, creation date/time, and edit history
  const prevNoteItemsMap = new Map<string, QualityNoteItem>();
  if (Array.isArray(existingOrder?.qualityNoteItems)) {
    for (const item of existingOrder!.qualityNoteItems!) {
      if (item && item.id) {
        prevNoteItemsMap.set(item.id, item);
      }
    }
  }

  if (Array.isArray(incomingOrder.qualityNoteItems)) {
    result.qualityNoteItems = incomingOrder.qualityNoteItems.map((note, idx) => {
      const noteId = String(note.id || `qnote_${Date.now()}_${idx}`);
      const prevNote = prevNoteItemsMap.get(noteId);

      if (!prevNote) {
        // Brand new quality note item: stamp author strictly from verified server session
        return {
          ...note,
          id: noteId,
          text: String(note.text || '').trim(),
          createdAt: riyadh.dateTimeRiyadh,
          createdAtRiyadh: riyadh.dateTimeRiyadh,
          author: verifiedUser.displayName,
          authorName: verifiedUser.displayName,
          authorEmail: verifiedUser.email,
          authorId: verifiedUser.id,
          editHistory: Array.isArray(note.editHistory) ? note.editHistory : [],
        };
      }

      // Existing note item: preserve original creator identity, check if text or photos changed
      const prevText = String(prevNote.text || '').trim();
      const nextText = String(note.text || '').trim();
      const prevPhotosCount = Array.isArray(prevNote.photos) ? prevNote.photos.length : 0;
      const nextPhotosCount = Array.isArray(note.photos) ? note.photos.length : 0;

      const preservedAuthorName = prevNote.authorName || prevNote.author || verifiedUser.displayName;
      const preservedAuthorEmail = prevNote.authorEmail || verifiedUser.email;
      const preservedAuthorId = prevNote.authorId || verifiedUser.id;
      const preservedCreatedAt = prevNote.createdAtRiyadh || prevNote.createdAt || riyadh.dateTimeRiyadh;
      const historyList: QualityNoteHistoryEntry[] = Array.isArray(prevNote.editHistory)
        ? [...prevNote.editHistory]
        : [];

      if (prevText !== nextText || prevPhotosCount !== nextPhotosCount) {
        historyList.unshift({
          id: `qnh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          previousText: prevText,
          newText: nextText,
          editedAt: riyadh.iso,
          editedAtRiyadh: riyadh.dateTimeRiyadh,
          editorName: verifiedUser.displayName,
          editorEmail: verifiedUser.email,
          editorId: verifiedUser.id,
        });
        return {
          ...note,
          id: noteId,
          text: nextText,
          createdAt: preservedCreatedAt,
          createdAtRiyadh: preservedCreatedAt,
          author: preservedAuthorName,
          authorName: preservedAuthorName,
          authorEmail: preservedAuthorEmail,
          authorId: preservedAuthorId,
          updatedAt: riyadh.iso,
          updatedAtRiyadh: riyadh.dateTimeRiyadh,
          updatedByName: verifiedUser.displayName,
          updatedByEmail: verifiedUser.email,
          updatedById: verifiedUser.id,
          editHistory: historyList.slice(0, 50),
        };
      }

      return {
        ...note,
        id: noteId,
        createdAt: preservedCreatedAt,
        createdAtRiyadh: preservedCreatedAt,
        author: preservedAuthorName,
        authorName: preservedAuthorName,
        authorEmail: preservedAuthorEmail,
        authorId: preservedAuthorId,
        editHistory: historyList,
      };
    });
  } else if (
    typeof incomingOrder.qualityNotes === 'string' &&
    incomingOrder.qualityNotes.trim().length > 0 &&
    incomingOrder.qualityNotes.trim() !== String(existingOrder?.qualityNotes || '').trim() &&
    (!Array.isArray(existingOrder?.qualityNoteItems) || existingOrder!.qualityNoteItems!.length === 0)
  ) {
    // Plain-text qualityNotes updated directly inline -> create/update a structured QualityNoteItem with verified session identity
    result.qualityNoteItems = [
      {
        id: `qnote_${Date.now()}_inline`,
        text: incomingOrder.qualityNotes.trim(),
        createdAt: riyadh.dateTimeRiyadh,
        createdAtRiyadh: riyadh.dateTimeRiyadh,
        author: verifiedUser.displayName,
        authorName: verifiedUser.displayName,
        authorEmail: verifiedUser.email,
        authorId: verifiedUser.id,
        editHistory: [],
      },
    ];
  }

  return result;
}
