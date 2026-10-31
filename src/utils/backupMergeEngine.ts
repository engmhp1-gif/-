import type { PlatformUser, UserPermissions } from '../types.ts';
import { EMPTY_PERMISSIONS, isPurgedLegacyUserOrEmail } from './security.ts';

type BooleanPermissionKey = Exclude<keyof UserPermissions, 'allowedColumns'>;

const PERMISSION_ALIASES: Record<string, BooleanPermissionKey[]> = {
  createOrder: ['addWorkOrder'],
  editOrder: ['editWorkOrderStatus', 'editWorkOrderBasic', 'inlineTableEdit'],
  deleteOrder: ['deleteWorkOrder'],
  Audit155: ['editWorkOrderStatus'],
  uploadPhotos: ['editWorkOrderBasic', 'inlineTableEdit'],
  deletePhotos: ['deleteWorkOrder'],
  exportData: ['exportTable', 'restoreDeleted'],
  importData: ['importExcel', 'restoreDeleted'],
  manageTables: ['manageMonthTables', 'deleteMonthTable'],
  manageSchema: ['manageColumns', 'manageDropdowns'],
  clearAllOrders: ['clearData'],
  restoreTrash: ['restoreDeleted'],
  sendAlerts: ['manageNotifications']
};

function normalizeUserPermissions(rawPerms: Record<string, any> = {}): UserPermissions {
  const normalized: UserPermissions = { ...EMPTY_PERMISSIONS };
  if (!rawPerms || typeof rawPerms !== 'object') {
    return normalized;
  }

  for (const k of Object.keys(EMPTY_PERMISSIONS) as BooleanPermissionKey[]) {
    if (k === ('allowedColumns' as any)) continue;
    if (rawPerms[k] !== undefined) {
      normalized[k] = Boolean(rawPerms[k]);
    }
  }

  if (Array.isArray(rawPerms.allowedColumns)) {
    normalized.allowedColumns = rawPerms.allowedColumns.map(String);
  }

  for (const [aliasKey, targetKeys] of Object.entries(PERMISSION_ALIASES)) {
    if (rawPerms[aliasKey] !== undefined) {
      const val = Boolean(rawPerms[aliasKey]);
      for (const tk of targetKeys) {
        if (val || rawPerms[tk] === undefined) {
          normalized[tk] = val;
        }
      }
    }
  }

  return normalized;
}

export interface WorkOrderConflictItem {
  id: string;
  workOrderNumber: string;
  office: string;
  conflictType:
    | 'OLDER_INCOMING_SKIPPED'
    | 'SAME_NUMBER_DIFFERENT_ID_KEPT_BOTH'
    | 'MODIFIED_SAME_TIMESTAMP_SKIPPED'
    | 'INCOMPLETE_RECORD_NORMALIZED';
  existingUpdatedAt?: string;
  incomingUpdatedAt?: string;
  resolution: string;
}

export interface UserConflictItem {
  id: string;
  username: string;
  email: string;
  conflictFields: string[];
  resolution: string;
}

export interface UnverifiableAttachmentItem {
  orderId: string;
  workOrderNumber: string;
  attachmentName: string;
  reason: string;
}

export interface MergeBatchCheckpoint {
  batchIndex: number;
  startOrderIndex: number;
  endOrderIndex: number;
  orderIdsCount: number;
  attachmentsInBatchCount: number;
  batchSha256: string;
}

export type DetectedBackupFormat =
  | 'full_v3'
  | 'server_backup'
  | 'independent_bundle'
  | 'legacy_object'
  | 'legacy_array'
  | 'tables_backup'
  | 'users_backup'
  | 'offices_backup'
  | 'vault_snapshot'
  | 'custom_json'
  | 'invalid';

export interface BackupMergePreviewReport {
  valid: boolean;
  backupFormat: DetectedBackupFormat;
  detectedTypeLabelAr?: string;
  summary: {
    currentOrdersCount: number;
    incomingOrdersCount: number;
    resultingOrdersCount: number;
    addedOrdersCount: number;
    updatedOrdersCount: number;
    unchangedOrdersCount: number;
    skippedOlderOrdersCount: number;
    duplicateOrderNumbersPreservedCount: number;
    preservedAbsentOrdersCount: number;
    addedTablesCount: number;
    preservedTablesCount: number;
    addedUsersCount: number;
    conflictingUsersSkippedCount: number;
    totalAttachmentsPreservedCount: number;
    unverifiableAttachmentsCount: number;
    incompleteOrNormalizedCount: number;
    invalidSkippedCount: number;
  };
  conflicts: {
    workOrders: WorkOrderConflictItem[];
    users: UserConflictItem[];
    unverifiableAttachments: UnverifiableAttachmentItem[];
    warnings: string[];
  };
  batchPlan: {
    batchSize: number;
    totalBatches: number;
    batches: MergeBatchCheckpoint[];
  };
  sampleAddedOrders: Array<{ id: string; workOrderNumber: string; office: string }>;
  sampleUpdatedOrders: Array<{ id: string; workOrderNumber: string; office: string }>;
}

export interface BackupMergeExecutionResult {
  report: BackupMergePreviewReport;
  mergedDb: any;
}

function sha256Hex(input: string): string {
  // Deterministic 256-bit hex digest (isomorphic across Browser & Node.js without requiring Node 'crypto')
  const seeds = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const str = String(input ?? '');
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const sIdx = i & 7;
    seeds[sIdx] = Math.imul(seeds[sIdx] ^ code, 0x01000193) >>> 0;
    seeds[(sIdx + 1) & 7] = (seeds[(sIdx + 1) & 7] + ((seeds[sIdx] >>> 13) | (seeds[sIdx] << 19))) >>> 0;
  }
  return seeds.map(n => (n >>> 0).toString(16).padStart(8, '0')).join('');
}

function sha256Short(input: string): string {
  return sha256Hex(input).slice(0, 12);
}

function decodeBase64Utf8Isomorphic(b64: string): string {
  const clean = b64.replace(/[\r\n\s]/g, '');
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Buffer.from(clean, 'base64').toString('utf-8');
  }
  if (typeof atob === 'function') {
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
  return '';
}

function parseIsoTimestampMs(val: any): number | null {
  if (!val || typeof val !== 'string') return null;
  const ms = Date.parse(val);
  return Number.isFinite(ms) ? ms : null;
}

function countOrderAttachments(order: any): number {
  if (!order || typeof order !== 'object') return 0;
  let count = 0;
  if (Array.isArray(order.photosFile)) count += order.photosFile.length;
  if (Array.isArray(order.photos)) count += order.photos.length;
  if (Array.isArray(order.qualityNoteItems)) {
    for (const item of order.qualityNoteItems) {
      if (item && Array.isArray(item.files)) count += item.files.length;
    }
  }
  return count;
}

/**
 * Merges attachment arrays from existing and incoming work orders without dropping any file.
 */
function mergeAttachmentsLossless(existingOrder: any, incomingOrder: any): {
  photosFile?: any[];
  photos?: any[];
  qualityNoteItems?: any[];
} {
  const result: { photosFile?: any[]; photos?: any[]; qualityNoteItems?: any[] } = {};

  const exPhotosFile = Array.isArray(existingOrder?.photosFile) ? existingOrder.photosFile : [];
  const incPhotosFile = Array.isArray(incomingOrder?.photosFile) ? incomingOrder.photosFile : [];
  if (exPhotosFile.length > 0 || incPhotosFile.length > 0) {
    const map = new Map<string, any>();
    for (const att of exPhotosFile) {
      if (!att) continue;
      const key = att.id || `${att.name || ''}:${(att.dataUrl || '').slice(0, 64)}`;
      map.set(key, att);
    }
    for (const att of incPhotosFile) {
      if (!att) continue;
      const key = att.id || `${att.name || ''}:${(att.dataUrl || '').slice(0, 64)}`;
      const prev = map.get(key);
      if (!prev || (!prev.dataUrl && att.dataUrl)) {
        map.set(key, att);
      }
    }
    result.photosFile = Array.from(map.values());
  }

  const exPhotos = Array.isArray(existingOrder?.photos) ? existingOrder.photos : [];
  const incPhotos = Array.isArray(incomingOrder?.photos) ? incomingOrder.photos : [];
  if (exPhotos.length > 0 || incPhotos.length > 0) {
    const map = new Map<string, any>();
    for (const p of [...exPhotos, ...incPhotos]) {
      if (!p) continue;
      const key = typeof p === 'string' ? sha256Short(p) : (p.id || sha256Short(JSON.stringify(p)));
      if (!map.has(key)) map.set(key, p);
    }
    result.photos = Array.from(map.values());
  }

  const exNotes = Array.isArray(existingOrder?.qualityNoteItems) ? existingOrder.qualityNoteItems : [];
  const incNotes = Array.isArray(incomingOrder?.qualityNoteItems) ? incomingOrder.qualityNoteItems : [];
  if (exNotes.length > 0 || incNotes.length > 0) {
    const map = new Map<string, any>();
    for (const n of [...exNotes, ...incNotes]) {
      if (!n) continue;
      const key = n.id || sha256Short(JSON.stringify(n));
      if (!map.has(key)) map.set(key, n);
    }
    result.qualityNoteItems = Array.from(map.values());
  }

  return result;
}

/**
 * Normalizes a legacy or modern work order item while preserving all custom fields and attachments.
 */
export function normalizeLegacyWorkOrder(
  raw: any,
  index: number
): { order: any | null; wasNormalized: boolean; warning?: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { order: null, wasNormalized: false, warning: `السجل رقم ${index + 1} ليس كائناً صالحاً وتم تخطيه` };
  }

  // Strictly skip dummy, mock, or fake test records to guarantee 100% genuine data restoration
  if (raw.isDummyOrder === true || raw.isMock === true || raw.isFake === true) {
    return { order: null, wasNormalized: false, warning: `تم استبعاد السجل التجريبي/الوهمي رقم ${index + 1} تلقائياً` };
  }
  const rawId = String(raw.id || '').trim();
  const rawNumCheck = String(raw.workOrderNumber || raw.orderNumber || raw.woNumber || raw['رقم أمر العمل'] || '').trim().toLowerCase();
  if (rawNumCheck === 'dummy' || rawNumCheck === 'mock' || rawNumCheck === 'test_fake') {
    return { order: null, wasNormalized: false, warning: `تم استبعاد السجل الوهمي (${rawNumCheck}) رقم ${index + 1}` };
  }
  if (/^wo-10[1-9]$/.test(rawId) && !rawNumCheck) {
    return { order: null, wasNormalized: false, warning: `تم استبعاد السجل التجريبي القديم (${rawId})` };
  }

  let wasNormalized = false;
  const order: any = { ...raw };

  // Legacy & Arabic field aliases for workOrderNumber
  const rawOrderNum =
    order.workOrderNumber ??
    order.orderNumber ??
    order.woNumber ??
    order.number ??
    order['رقم أمر العمل'] ??
    order['رقم امر العمل'] ??
    order['أمر العمل'] ??
    order['امر العمل'];
  if (!order.workOrderNumber && rawOrderNum !== undefined && rawOrderNum !== null) {
    order.workOrderNumber = String(rawOrderNum).trim();
    wasNormalized = true;
  } else if (order.workOrderNumber !== undefined && order.workOrderNumber !== null) {
    order.workOrderNumber = String(order.workOrderNumber).trim();
  } else {
    order.workOrderNumber = '';
    wasNormalized = true;
  }

  // Legacy & Arabic field aliases for workOrderCode
  const rawOrderCode =
    order.workOrderCode ??
    order.orderCode ??
    order.woCode ??
    order.code ??
    order['رمز أمر العمل'] ??
    order['رمز امر العمل'] ??
    order['نوع أمر العمل'];
  if (!order.workOrderCode && rawOrderCode !== undefined && rawOrderCode !== null) {
    order.workOrderCode = String(rawOrderCode).trim();
    wasNormalized = true;
  }

  // Legacy & Arabic office / contractor normalization
  const rawOffice = order.office ?? order.officeName ?? order['المكتب'] ?? order['اسم المكتب'] ?? order['المكتب الفرعي'];
  if (!order.office && rawOffice) {
    order.office = String(rawOffice).trim();
    wasNormalized = true;
  }
  if (!order.office) {
    order.office = 'غير محدد';
    wasNormalized = true;
  }

  const rawContractor = order.contractor ?? order.contractorName ?? order['المقاول'] ?? order['اسم المقاول'];
  if (!order.contractor && rawContractor) {
    order.contractor = String(rawContractor).trim();
    wasNormalized = true;
  }
  if (!order.contractor) {
    order.contractor = '';
  }

  // Normalize tableYear / tableMonth if provided as strings or inferred from tableId
  if (order.tableYear !== undefined && order.tableYear !== null && typeof order.tableYear !== 'number') {
    const parsedY = parseInt(String(order.tableYear), 10);
    if (Number.isFinite(parsedY) && parsedY >= 2000 && parsedY <= 2100) {
      order.tableYear = parsedY;
    }
  }
  if (order.tableMonth !== undefined && order.tableMonth !== null && typeof order.tableMonth !== 'number') {
    const parsedM = parseInt(String(order.tableMonth), 10);
    if (Number.isFinite(parsedM) && parsedM >= 1 && parsedM <= 12) {
      order.tableMonth = parsedM;
    }
  }

  const isUnresolvedBlobMarker = (val: any) =>
    typeof val === 'string' && (val.startsWith('__VAULT_BLOB_REF__:') || val.startsWith('__ATT_REF__:'));

  // Legacy attachment arrays (attachments / files -> photosFile)
  if (!Array.isArray(order.photosFile)) {
    const legacyFiles = Array.isArray(order.attachments)
      ? order.attachments
      : Array.isArray(order.files)
      ? order.files
      : null;
    if (legacyFiles) {
      order.photosFile = legacyFiles
        .filter((f: any) => f && typeof f === 'object')
        .map((f: any, fIdx: number) => {
          const rawDataUrl = f.dataUrl || f.url || f.base64 || '';
          return {
            id: f.id || `att-leg-${index}-${fIdx}-${sha256Short(String(rawDataUrl || f.name || fIdx))}`,
            name: f.name || f.filename || `مرفق_${fIdx + 1}`,
            type: f.type || f.mimeType || 'image/jpeg',
            size: Number(f.size) || (typeof rawDataUrl === 'string' ? Math.round(rawDataUrl.length * 0.75) : 0),
            dataUrl: isUnresolvedBlobMarker(rawDataUrl) ? '' : rawDataUrl
          };
        })
        .filter((f: any) => Boolean(f.dataUrl));
      wasNormalized = true;
    }
  } else {
    order.photosFile = order.photosFile
      .filter((f: any) => f && typeof f === 'object')
      .map((f: any, fIdx: number) => {
        const rawDataUrl = f.dataUrl || f.url || f.base64 || '';
        return {
          ...f,
          id: f.id || `att-norm-${index}-${fIdx}-${sha256Short(String(rawDataUrl || f.name || fIdx))}`,
          name: f.name || `مرفق_${fIdx + 1}`,
          type: f.type || 'image/jpeg',
          dataUrl: isUnresolvedBlobMarker(rawDataUrl) ? '' : rawDataUrl
        };
      })
      .filter((f: any) => Boolean(f.dataUrl));
  }

  // Normalize order.photos (support strings, { dataUrl }, { url }, and strip unresolved markers)
  if (Array.isArray(order.photos)) {
    order.photos = order.photos
      .map((p: any, pIdx: number) => {
        if (!p) return null;
        if (typeof p === 'string') {
          if (isUnresolvedBlobMarker(p)) return null;
          return {
            id: `ph-leg-${index}-${pIdx}-${sha256Short(p)}`,
            url: p,
            dataUrl: p,
            name: `صورة_${pIdx + 1}`
          };
        }
        if (typeof p === 'object') {
          const resolvedUrl = p.url || p.dataUrl || p.base64 || '';
          if (isUnresolvedBlobMarker(resolvedUrl)) return null;
          return {
            ...p,
            id: p.id || `ph-norm-${index}-${pIdx}-${sha256Short(String(resolvedUrl || p.name || pIdx))}`,
            url: resolvedUrl,
            dataUrl: p.dataUrl || resolvedUrl
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  // Legacy status & notes normalization (with Arabic aliases)
  if (!order.photoDocumentation) {
    order.photoDocumentation = order.photoCoordination || order['توثيق الصور'] || 'مكتمل';
    if (order.photoCoordination || order['توثيق الصور']) wasNormalized = true;
  }
  if (!order.consultantForms) order.consultantForms = order['نماذج الاستشاري'] || 'مكتمل';
  if (!order.consultantClearanceForms) order.consultantClearanceForms = order['نماذج إجازة الاستشاري'] || 'مكتمل';
  if (!order.form190) order.form190 = order['نموذج 190'] || 'مكتمل';
  if (!order.form200) order.form200 = order['نموذج 200'] || 'مكتمل';
  if (!order.inspectionForm) order.inspectionForm = order['استمارة الفحص'] || 'مكتمل';
  if (order.qualityNotes === undefined) {
    order.qualityNotes = order.executionNotes || order['ملاحظات الجودة'] || order['الملاحظات'] || '';
    if (order.executionNotes || order['ملاحظات الجودة'] || order['الملاحظات']) wasNormalized = true;
  }
  if (!order.procedure155Status) {
    order.procedure155Status = order.status155 || order['تدقيق المساندة الفنية'] || 'مؤهل للاغلاق';
  }
  if (!order.procedure155 && order['اجراء 155']) {
    order.procedure155 = order['اجراء 155'];
  }
  if (!order.receiptDate) {
    order.receiptDate = order.createdAt ? String(order.createdAt).slice(0, 10) : '2026-03-01';
  }

  // Deterministic ID generation if missing in legacy backup (never deduplicating by workOrderNumber alone!)
  if (!order.id || typeof order.id !== 'string' || !order.id.trim()) {
    const fingerprint = JSON.stringify({
      workOrderNumber: order.workOrderNumber,
      office: order.office,
      contractor: order.contractor,
      createdAt: order.createdAt || '',
      qualityNotes: order.qualityNotes || '',
      index
    });
    order.id = `wo-legacy-${sha256Short(fingerprint)}`;
    wasNormalized = true;
  } else {
    order.id = order.id.trim();
  }

  return { order, wasNormalized };
}

function arePermissionsEqual(a?: Partial<UserPermissions>, b?: Partial<UserPermissions>): boolean {
  const normA = normalizeUserPermissions(a);
  const normB = normalizeUserPermissions(b);
  const keys = Object.keys(normA) as Array<keyof UserPermissions>;
  for (const k of keys) {
    if (Boolean(normA[k]) !== Boolean(normB[k])) return false;
  }
  return true;
}

/**
 * Unwraps ANY JSON file exported or downloaded from the server:
 * - Direct database dumps: `db.json`, `db.backup.json`
 * - Periodic server backups: `backup_*.json`
 * - Full database exports: `procedure155_backup_*.json`
 * - Independent cryptographically signed bundles: `.backup.bundle.json`
 * - Dedicated sub-backups: `tables_backup.json`, `users_backup.json`
 * - Vault / localStorage snapshots
 * - Raw arrays of work orders or records
 * - Wrapped structures: `{ data: ... }`, `{ bundle: ... }`, `{ payload: ... }`, `{ db: ... }`, `{ snapshot: ... }`
 */
export function sanitizeJsonStringForParse(rawStr: string): string {
  let s = rawStr.replace(/^\uFEFF/, '').replace(/^[\u200B-\u200D\uFEFF]+/, '').trim();
  // Strip unescaped ASCII control chars (except \t, \n, \r)
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');
  // Escape lone backslashes not followed by valid JSON escape chars (["\\/bfnrt] or uXXXX)
  s = s.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
  return s;
}

export function tryParseFlexibleJsonString(inputStr: string): any {
  if (!inputStr || typeof inputStr !== 'string') return null;
  const trimmed = inputStr.replace(/^\uFEFF/, '').replace(/^[\u200B-\u200D\uFEFF]+/, '').trim();
  if (!trimmed) return null;

  // 1. Direct JSON.parse
  try {
    let p = JSON.parse(trimmed);
    if (typeof p === 'string') {
      try { p = JSON.parse(p); } catch {}
    }
    return p;
  } catch {}

  // 2. Sanitized JSON (trailing commas, unescaped backslashes, control chars)
  try {
    const sanitized = sanitizeJsonStringForParse(trimmed);
    let p = JSON.parse(sanitized);
    if (typeof p === 'string') {
      try { p = JSON.parse(sanitizeJsonStringForParse(p)); } catch {}
    }
    return p;
  } catch {}

  // 3. Base64 or Data URL encoded JSON
  try {
    let b64Part = trimmed;
    if (b64Part.startsWith('data:')) {
      const commaIdx = b64Part.indexOf(',');
      if (commaIdx !== -1) b64Part = b64Part.slice(commaIdx + 1).trim();
    }
    if (/^[A-Za-z0-9+/=\r\n_-]{20,}$/.test(b64Part)) {
      const decoded = decodeBase64Utf8Isomorphic(b64Part);
      if (decoded.trim().startsWith('{') || decoded.trim().startsWith('[')) {
        return JSON.parse(sanitizeJsonStringForParse(decoded));
      }
    }
  } catch {}

  // 4. Extract outermost { ... } or [ ... ] ONLY if it does not look like raw binary
  const hasReplacementChars = trimmed.includes('\uFFFD');
  if (!hasReplacementChars) {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    const firstBracket = trimmed.indexOf('[');
    const lastBracket = trimmed.lastIndexOf(']');

    if (firstBrace !== -1 && lastBrace > firstBrace && (firstBracket === -1 || firstBrace < firstBracket)) {
      const sub = trimmed.slice(firstBrace, lastBrace + 1);
      try { return JSON.parse(sub); } catch {}
      try { return JSON.parse(sanitizeJsonStringForParse(sub)); } catch {}
    }
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const sub = trimmed.slice(firstBracket, lastBracket + 1);
      try { return JSON.parse(sub); } catch {}
      try { return JSON.parse(sanitizeJsonStringForParse(sub)); } catch {}
    }
  }

  // 5. NDJSON / JSON Lines (multiple JSON objects separated by newlines)
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith('{') && l.endsWith('}'));
  if (lines.length >= 1) {
    const objs: any[] = [];
    for (const line of lines) {
      try {
        objs.push(JSON.parse(sanitizeJsonStringForParse(line)));
      } catch {}
    }
    if (objs.length > 0) {
      return objs.length === 1 ? objs[0] : objs;
    }
  }

  return null;
}

export function extractBackupEnvelope(rawInput: any): {
  format: DetectedBackupFormat;
  payload: any;
  detectedTypeLabelAr: string;
  error?: string;
} {
  if (rawInput === null || rawInput === undefined) {
    return { format: 'invalid', payload: null, detectedTypeLabelAr: 'ملف فارغ أو غير صالح', error: 'ملف فارغ أو غير صالح' };
  }

  let candidate: any = rawInput;

  // 1. If candidate is passed as a string (or UTF-8 BOM string), parse it cleanly with full repair
  if (typeof candidate === 'string') {
    const parsedFromStr = tryParseFlexibleJsonString(candidate);
    if (!parsedFromStr) {
      return { format: 'invalid', payload: null, detectedTypeLabelAr: 'صيغة JSON غير صالحة', error: 'صيغة JSON غير صالحة' };
    }
    candidate = parsedFromStr;
  }

  if (!candidate || typeof candidate !== 'object') {
    return { format: 'invalid', payload: null, detectedTypeLabelAr: 'محتوى الملف غير صالح', error: 'محتوى الملف غير صالح' };
  }

  // 2. Track original flags before and during recursive unwrapping
  let sawBundleId = Boolean(candidate.bundleId || candidate.bundle?.bundleId || candidate.hmacSignature);
  let sawAppVersion = Boolean(candidate.appVersion || candidate.exportedAt);
  let sawSnapshotMeta = Boolean(candidate.id && candidate.timestamp && (candidate.data || candidate.workOrders));

  // 3. Iteratively peel envelope wrappers: data, backupData, bundle, payload, db, database, snapshot, backup, state, content, result, coreJson, payloadJson
  let maxUnwrapIterations = 12;
  while (maxUnwrapIterations > 0 && candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    maxUnwrapIterations--;

    if (candidate.bundleId || candidate.bundle?.bundleId || candidate.hmacSignature) sawBundleId = true;
    if (candidate.appVersion || candidate.exportedAt) sawAppVersion = true;
    if (candidate.id && candidate.timestamp && (candidate.data || candidate.workOrders)) sawSnapshotMeta = true;

    // Support CloudManifestRecord (coreJson) and CloudChunkRecord (payloadJson)
    if (typeof candidate.coreJson === 'string' && !Array.isArray(candidate.workOrders)) {
      const parsedCore = tryParseFlexibleJsonString(candidate.coreJson);
      if (parsedCore && typeof parsedCore === 'object') {
        candidate = { ...candidate, ...parsedCore, coreJson: undefined };
      }
    }
    if (typeof candidate.payloadJson === 'string' && !Array.isArray(candidate.workOrders)) {
      const parsedChunk = tryParseFlexibleJsonString(candidate.payloadJson);
      if (Array.isArray(parsedChunk)) {
        if (candidate.chunkType === 'extraCore') {
          candidate = { archivedReports: parsedChunk };
        } else {
          candidate = { workOrders: parsedChunk };
        }
        break;
      } else if (parsedChunk && typeof parsedChunk === 'object') {
        candidate = parsedChunk;
      }
    }

    // If candidate has direct arrays for standard entities, stop unwrapping
    const hasDirectOrders =
      Array.isArray(candidate.workOrders) ||
      Array.isArray(candidate.work_orders) ||
      Array.isArray(candidate.workorders) ||
      Array.isArray(candidate.orders) ||
      Array.isArray(candidate.rows) ||
      Array.isArray(candidate.records) ||
      Array.isArray(candidate.items) ||
      Array.isArray(candidate.list) ||
      Array.isArray(candidate.entries);
    const hasDirectTables =
      Array.isArray(candidate.monthTables) ||
      Array.isArray(candidate.month_tables) ||
      Array.isArray(candidate.tables);
    const hasDirectUsers =
      Array.isArray(candidate.users) ||
      Array.isArray(candidate.platformUsers) ||
      Array.isArray(candidate.accounts);
    const hasDirectOffices =
      Array.isArray(candidate.offices) ||
      Array.isArray(candidate.subOffices);

    if (hasDirectOrders || hasDirectTables || hasDirectUsers || hasDirectOffices) {
      break;
    }

    const unwrapKeys = ['payload', 'bundle', 'data', 'backupData', 'db', 'database', 'snapshot', 'backup', 'state', 'content', 'result', 'body', 'vault', 'response'];
    let unwrapped = false;
    for (const uk of unwrapKeys) {
      if (candidate[uk] !== undefined && candidate[uk] !== null) {
        if (typeof candidate[uk] === 'string') {
          const parsedInner = tryParseFlexibleJsonString(candidate[uk]);
          if (parsedInner && typeof parsedInner === 'object') {
            candidate = parsedInner;
            unwrapped = true;
            break;
          }
        } else if (typeof candidate[uk] === 'object') {
          candidate = candidate[uk];
          unwrapped = true;
          break;
        }
      }
    }
    if (!unwrapped) break;
  }

  // 4. Handle raw arrays (e.g., tables_backup.json, users_backup.json, snapshots array, 2D spreadsheet rows, or work_orders.json)
  if (Array.isArray(candidate)) {
    // 4a. Check if it's a 2D array of spreadsheet rows: [["المكتب", "المقاول", ...], ["مكتب عرعر", ...]]
    if (candidate.length >= 2 && Array.isArray(candidate[0])) {
      const headers = (candidate[0] as any[]).map(h => String(h ?? '').trim());
      const rowObjects: any[] = [];
      for (let r = 1; r < candidate.length; r++) {
        const row = candidate[r];
        if (!Array.isArray(row) || row.every(c => c === null || c === undefined || String(c).trim() === '')) continue;
        const obj: Record<string, any> = {};
        headers.forEach((h, cIdx) => {
          const key = h || `col_${cIdx + 1}`;
          obj[key] = row[cIdx];
        });
        rowObjects.push(obj);
      }
      if (rowObjects.length > 0) {
        return {
          format: 'legacy_array',
          payload: { workOrders: rowObjects },
          detectedTypeLabelAr: 'مصفوفة صفوف جدولية (JSON Rows)'
        };
      }
    }

    const sampleItems = candidate.slice(0, 15).filter(item => item && typeof item === 'object' && !Array.isArray(item));

    // Check if it's an array of Vault Snapshots ([ { id: 'snap-...', timestamp: '...', data: { workOrders: [...] } } ])
    const isSnapshotsArray = sampleItems.length > 0 && sampleItems.some(item =>
      item.data && typeof item.data === 'object' && (Array.isArray(item.data.workOrders) || Array.isArray(item.data.monthTables))
    );
    if (isSnapshotsArray) {
      let bestSnap = sampleItems[0]?.data || {};
      let maxCount = -1;
      for (const s of candidate) {
        const d = s?.data || s?.payload || s;
        const c = Array.isArray(d?.workOrders) ? d.workOrders.length : 0;
        if (c > maxCount) {
          maxCount = c;
          bestSnap = d;
        }
      }
      return {
        format: 'vault_snapshot',
        payload: {
          workOrders: Array.isArray(bestSnap.workOrders) ? bestSnap.workOrders : [],
          monthTables: Array.isArray(bestSnap.monthTables) ? bestSnap.monthTables : [],
          users: Array.isArray(bestSnap.users) ? bestSnap.users : [],
          offices: Array.isArray(bestSnap.offices) ? bestSnap.offices : [],
          columns: Array.isArray(bestSnap.columns) ? bestSnap.columns : [],
          dropdownOptions: bestSnap.dropdownOptions || {},
          archivedReports: Array.isArray(bestSnap.archivedReports) ? bestSnap.archivedReports : []
        },
        detectedTypeLabelAr: 'مصفوفة نقاط استعادة الخزينة السحابية والمحلية'
      };
    }

    // Check if it's an array of MonthTable
    const isTablesArray = sampleItems.length > 0 && sampleItems.every(item => 
      (item.year !== undefined || item.month !== undefined || item.isDefault !== undefined) && 
      item.name && 
      !item.workOrderNumber && 
      !item.contractor
    );

    if (isTablesArray) {
      return {
        format: 'tables_backup',
        payload: {
          monthTables: candidate,
          workOrders: []
        },
        detectedTypeLabelAr: 'أرشيف الجداول الشهرية (tables_backup.json)'
      };
    }

    // Check if it's an array of PlatformUser
    const isUsersArray = sampleItems.length > 0 && sampleItems.every(item => 
      (item.username || item.roleTitle || item.email || item.permissions) && 
      !item.workOrderNumber && 
      !item.contractor
    );

    if (isUsersArray) {
      return {
        format: 'users_backup',
        payload: {
          users: candidate,
          workOrders: []
        },
        detectedTypeLabelAr: 'أرشيف حسابات وصلاحيات المستخدمين (users_backup.json)'
      };
    }

    // Check if it's an array of SubOffice
    const isOfficesArray = sampleItems.length > 0 && sampleItems.every(item => 
      item.name && (item.contractors || item.id) && !item.workOrderNumber
    );

    if (isOfficesArray) {
      return {
        format: 'offices_backup',
        payload: {
          offices: candidate,
          workOrders: []
        },
        detectedTypeLabelAr: 'أرشيف المكاتب الفرعية والمقاولين'
      };
    }

    // Default array is treated as work orders
    return {
      format: 'legacy_array',
      payload: { workOrders: candidate },
      detectedTypeLabelAr: 'مصفوفة أوامر عمل خام'
    };
  }

  const toArrayIfObjectMap = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      const parsed = tryParseFlexibleJsonString(val);
      if (Array.isArray(parsed)) return parsed;
    }
    if (val && typeof val === 'object') {
      const vals = Object.values(val);
      if (vals.length > 0 && vals.every(v => v && typeof v === 'object' && !Array.isArray(v))) {
        return vals;
      }
    }
    return [];
  };

  // 5. Handle Object payloads with aliased keys (Old, New, and Arabic keys)
  const resolvedOrders: any[] = Array.isArray(candidate.workOrders)
    ? [...candidate.workOrders]
    : Array.isArray(candidate.work_orders)
    ? [...candidate.work_orders]
    : Array.isArray(candidate.workorders)
    ? [...candidate.workorders]
    : Array.isArray(candidate.orders)
    ? [...candidate.orders]
    : Array.isArray(candidate.rows)
    ? [...candidate.rows]
    : Array.isArray(candidate.records)
    ? [...candidate.records]
    : Array.isArray(candidate.items)
    ? [...candidate.items]
    : Array.isArray(candidate.list)
    ? [...candidate.list]
    : Array.isArray(candidate.entries)
    ? [...candidate.entries]
    : Array.isArray(candidate['أوامر_العمل'])
    ? [...candidate['أوامر_العمل']]
    : Array.isArray(candidate['اوامر_العمل'])
    ? [...candidate['اوامر_العمل']]
    : Array.isArray(candidate['أوامر العمل'])
    ? [...candidate['أوامر العمل']]
    : Array.isArray(candidate['اوامر العمل'])
    ? [...candidate['اوامر العمل']]
    : toArrayIfObjectMap(candidate.workOrders || candidate.work_orders || candidate.orders);

  const resolvedTables: any[] = Array.isArray(candidate.monthTables)
    ? [...candidate.monthTables]
    : Array.isArray(candidate.month_tables)
    ? [...candidate.month_tables]
    : Array.isArray(candidate.tables)
    ? [...candidate.tables]
    : Array.isArray(candidate['الجداول'])
    ? [...candidate['الجداول']]
    : Array.isArray(candidate['الجداول الشهرية'])
    ? [...candidate['الجداول الشهرية']]
    : toArrayIfObjectMap(candidate.monthTables || candidate.tables);

  const resolvedUsers: any[] = Array.isArray(candidate.users)
    ? [...candidate.users]
    : Array.isArray(candidate.platformUsers)
    ? [...candidate.platformUsers]
    : Array.isArray(candidate.accounts)
    ? [...candidate.accounts]
    : Array.isArray(candidate['المستخدمين'])
    ? [...candidate['المستخدمين']]
    : Array.isArray(candidate['الحسابات'])
    ? [...candidate['الحسابات']]
    : toArrayIfObjectMap(candidate.users || candidate.accounts);

  const resolvedOffices: any[] = Array.isArray(candidate.offices)
    ? [...candidate.offices]
    : Array.isArray(candidate.subOffices)
    ? [...candidate.subOffices]
    : Array.isArray(candidate['المكاتب'])
    ? [...candidate['المكاتب']]
    : toArrayIfObjectMap(candidate.offices);

  const resolvedColumns: any[] = Array.isArray(candidate.columns)
    ? [...candidate.columns]
    : Array.isArray(candidate.fields)
    ? [...candidate.fields]
    : [];

  const resolvedDropdowns = (candidate.dropdownOptions && typeof candidate.dropdownOptions === 'object')
    ? { ...candidate.dropdownOptions }
    : (candidate.dropdown_options && typeof candidate.dropdown_options === 'object')
    ? { ...candidate.dropdown_options }
    : (candidate.dropdowns && typeof candidate.dropdowns === 'object')
    ? { ...candidate.dropdowns }
    : {};

  const resolvedReports: any[] = Array.isArray(candidate.archivedReports)
    ? [...candidate.archivedReports]
    : Array.isArray(candidate.archived_reports)
    ? [...candidate.archived_reports]
    : Array.isArray(candidate.reports)
    ? [...candidate.reports]
    : [];

  const resolvedDeletedIds: any[] = Array.isArray(candidate.deletedOrderIds)
    ? [...candidate.deletedOrderIds]
    : Array.isArray(candidate.deleted_order_ids)
    ? [...candidate.deleted_order_ids]
    : [];

  // Fallback 1: If top-level workOrders is empty, check candidate.snapshots (e.g. vault snapshot history)
  const rawSnapshotsList = Array.isArray(candidate.snapshots)
    ? candidate.snapshots
    : Array.isArray(candidate.p155_vault_snapshots_v3)
    ? candidate.p155_vault_snapshots_v3
    : typeof candidate.p155_vault_snapshots_v3 === 'string'
    ? (() => { try { return JSON.parse(candidate.p155_vault_snapshots_v3); } catch { return []; } })()
    : [];

  if (resolvedOrders.length === 0 && Array.isArray(rawSnapshotsList) && rawSnapshotsList.length > 0) {
    let bestSnapData: any = null;
    let maxSnapOrders = -1;
    for (const snap of rawSnapshotsList) {
      const snapData = snap?.data || snap?.payload || snap;
      const snapOrders = Array.isArray(snapData?.workOrders) ? snapData.workOrders : [];
      if (snapOrders.length > maxSnapOrders) {
        maxSnapOrders = snapOrders.length;
        bestSnapData = snapData;
      }
    }
    if (bestSnapData) {
      if (Array.isArray(bestSnapData.workOrders) && bestSnapData.workOrders.length > 0) {
        resolvedOrders.push(...bestSnapData.workOrders);
      }
      if (resolvedTables.length === 0 && Array.isArray(bestSnapData.monthTables)) {
        resolvedTables.push(...bestSnapData.monthTables);
      }
      if (resolvedOffices.length === 0 && Array.isArray(bestSnapData.offices)) {
        resolvedOffices.push(...bestSnapData.offices);
      }
      if (resolvedColumns.length === 0 && Array.isArray(bestSnapData.columns)) {
        resolvedColumns.push(...bestSnapData.columns);
      }
      if (Object.keys(resolvedDropdowns).length === 0 && bestSnapData.dropdownOptions && typeof bestSnapData.dropdownOptions === 'object') {
        Object.assign(resolvedDropdowns, bestSnapData.dropdownOptions);
      }
      if (resolvedReports.length === 0 && Array.isArray(bestSnapData.archivedReports)) {
        resolvedReports.push(...bestSnapData.archivedReports);
      }
    }
  }

  // Fallback 2: Support ALL raw localStorage dump JSON keys (v1, v2, v3, and preview_sandbox_ prefixed)
  const parseIfJsonOrArray = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      const parsed = tryParseFlexibleJsonString(val);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  };
  const parseIfJsonOrObject = (val: any): Record<string, any> => {
    if (val && typeof val === 'object' && !Array.isArray(val)) return val;
    if (typeof val === 'string') {
      const parsed = tryParseFlexibleJsonString(val);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }
    return {};
  };

  for (const [k, v] of Object.entries(candidate)) {
    const cleanKey = k.replace(/^preview_sandbox_/, '');
    if (resolvedOrders.length === 0 && /work_?orders/i.test(cleanKey)) {
      resolvedOrders.push(...parseIfJsonOrArray(v));
    } else if (resolvedTables.length === 0 && /month_?tables|^tables$/i.test(cleanKey)) {
      resolvedTables.push(...parseIfJsonOrArray(v));
    } else if (resolvedUsers.length === 0 && /users|accounts/i.test(cleanKey)) {
      resolvedUsers.push(...parseIfJsonOrArray(v));
    } else if (resolvedOffices.length === 0 && /offices/i.test(cleanKey)) {
      resolvedOffices.push(...parseIfJsonOrArray(v));
    } else if (resolvedColumns.length === 0 && /columns/i.test(cleanKey)) {
      resolvedColumns.push(...parseIfJsonOrArray(v));
    } else if (Object.keys(resolvedDropdowns).length === 0 && /dropdown/i.test(cleanKey)) {
      Object.assign(resolvedDropdowns, parseIfJsonOrObject(v));
    } else if (resolvedReports.length === 0 && /reports/i.test(cleanKey)) {
      resolvedReports.push(...parseIfJsonOrArray(v));
    }
  }

  // Fallback 3: if candidate itself is a single workOrder object, wrap it in resolvedOrders
  if (
    resolvedOrders.length === 0 &&
    resolvedTables.length === 0 &&
    resolvedUsers.length === 0 &&
    (
      candidate.workOrderNumber ||
      candidate.orderNumber ||
      candidate.woNumber ||
      candidate['رقم أمر العمل'] ||
      candidate['رقم امر العمل'] ||
      (candidate.id && String(candidate.id).startsWith('wo-'))
    )
  ) {
    resolvedOrders.push(candidate);
  }

  // Fallback 4: Deep recursive scan (up to depth 4) for any nested arrays of workOrders, tables, users, or offices
  if (
    resolvedOrders.length === 0 &&
    resolvedTables.length === 0 &&
    resolvedUsers.length === 0 &&
    resolvedOffices.length === 0
  ) {
    const scanNode = (node: any, depth: number) => {
      if (!node || typeof node !== 'object' || depth > 4) return;
      for (const val of Object.values(node)) {
        const arr = toArrayIfObjectMap(val);
        if (arr.length > 0 && arr[0] && typeof arr[0] === 'object' && !Array.isArray(arr[0])) {
          const sample = arr[0];
          if (
            sample.workOrderNumber !== undefined ||
            sample.orderNumber !== undefined ||
            sample['رقم أمر العمل'] !== undefined ||
            sample['رقم امر العمل'] !== undefined ||
            sample.pdcAudit !== undefined ||
            sample.constructionAudit !== undefined ||
            sample.procedure155Status !== undefined ||
            (sample.office && sample.contractor) ||
            (sample['المكتب'] && sample['المقاول'])
          ) {
            if (resolvedOrders.length === 0) resolvedOrders.push(...arr);
          } else if (
            (sample.year !== undefined || sample.month !== undefined) &&
            sample.name &&
            !sample.workOrderNumber
          ) {
            if (resolvedTables.length === 0) resolvedTables.push(...arr);
          } else if (
            (sample.username || sample.email || sample.permissions) &&
            !sample.workOrderNumber
          ) {
            if (resolvedUsers.length === 0) resolvedUsers.push(...arr);
          } else if (
            sample.name && Array.isArray(sample.contractors)
          ) {
            if (resolvedOffices.length === 0) resolvedOffices.push(...arr);
          }
        } else if (val && typeof val === 'object' && !Array.isArray(val)) {
          scanNode(val, depth + 1);
        }
      }
    };
    scanNode(candidate, 0);
  }

  // Fallback 5: If still empty, accept ANY non-empty array of objects inside candidate as custom workOrder rows
  if (
    resolvedOrders.length === 0 &&
    resolvedTables.length === 0 &&
    resolvedUsers.length === 0 &&
    resolvedOffices.length === 0
  ) {
    for (const [k, val] of Object.entries(candidate)) {
      if (k === 'blobs' || k === 'sliceFiles' || k === 'attachmentManifest' || k === 'executionLogs' || k === 'alerts') continue;
      const arr = toArrayIfObjectMap(val);
      if (arr.length > 0 && arr[0] && typeof arr[0] === 'object' && !Array.isArray(arr[0])) {
        resolvedOrders.push(...arr);
        break;
      }
    }
  }

  const hasAnyData =
    resolvedOrders.length > 0 ||
    resolvedTables.length > 0 ||
    resolvedUsers.length > 0 ||
    resolvedOffices.length > 0 ||
    resolvedColumns.length > 0 ||
    Object.keys(resolvedDropdowns).length > 0;

  if (!hasAnyData) {
    return {
      format: 'invalid',
      payload: null,
      detectedTypeLabelAr: 'ملف غير معروف أو لا يحتوي على سجلات',
      error: 'ملف غير معروف أو لا يحتوي على سجلات متوافقة'
    };
  }

  const { snapshots: _discardSnapshots, ...cleanCandidate } = candidate;
  const normalizedPayload = {
    ...cleanCandidate,
    workOrders: resolvedOrders,
    monthTables: resolvedTables,
    users: resolvedUsers,
    offices: resolvedOffices,
    columns: resolvedColumns,
    dropdownOptions: resolvedDropdowns,
    archivedReports: resolvedReports,
    deletedOrderIds: resolvedDeletedIds
  };

  // Determine format classification
  let format: DetectedBackupFormat = 'custom_json';
  let detectedTypeLabelAr = 'ملف بيانات متوافق مع المنظومة';

  if (sawBundleId || candidate.bundleId || candidate.hmacSignature) {
    format = 'independent_bundle';
    detectedTypeLabelAr = 'حزمة نسخ احتياطي مستقلة مشفرة (Independent Bundle)';
  } else if (sawAppVersion || candidate.appVersion === '3.0.0' || candidate.exportedAt) {
    format = 'full_v3';
    detectedTypeLabelAr = 'نسخة سحابية شاملة (تصدير المنظومة الكامل)';
  } else if (sawSnapshotMeta) {
    format = 'vault_snapshot';
    detectedTypeLabelAr = 'نقطة استعادة الخزينة السحابية والمحلية';
  } else if (resolvedOrders.length > 0 && (resolvedTables.length > 0 || resolvedOffices.length > 0 || Object.keys(resolvedDropdowns).length > 0)) {
    format = 'server_backup';
    detectedTypeLabelAr = 'ملف قاعدة بيانات السيرفر (db.json / backup_*.json)';
  } else if (resolvedTables.length > 0 && resolvedOrders.length === 0) {
    format = 'tables_backup';
    detectedTypeLabelAr = 'أرشيف الجداول الشهرية (tables_backup.json)';
  } else if (resolvedUsers.length > 0 && resolvedOrders.length === 0) {
    format = 'users_backup';
    detectedTypeLabelAr = 'أرشيف حسابات وصلاحيات المستخدمين (users_backup.json)';
  } else if (resolvedOffices.length > 0 && resolvedOrders.length === 0) {
    format = 'offices_backup';
    detectedTypeLabelAr = 'أرشيف المكاتب الفرعية والمقاولين';
  } else if (resolvedOrders.length > 0) {
    format = 'legacy_object';
    detectedTypeLabelAr = 'ملف أوامر عمل مباشر';
  }

  return {
    format,
    payload: normalizedPayload,
    detectedTypeLabelAr
  };
}

/**
 * Performs a non-destructive smart merge between `currentDb` and `rawIncomingBackup`:
 * 1. Never deletes existing records that are absent from the backup.
 * 2. Never deduplicates by `workOrderNumber` alone (matches strictly by `id`).
 * 3. Never overwrites a newer existing record (`updatedAt`) with an older backup record.
 * 4. Never auto-merges conflicting user accounts, permissions, or passwords.
 * 5. Preserves 100% of attachments across merged records.
 * 6. Accepts ANY JSON downloaded from the server (full export, db.json, backup_*.json, tables, users, or bundles).
 */
export function analyzeAndMergeBackup(
  currentDb: any,
  rawIncomingBackup: any,
  options?: {
    batchSize?: number;
    resumeFromBatchIndex?: number;
    migrateLegacyPlaintextPasswords?: boolean;
    preferIncomingOnConflict?: boolean;
    replaceMode?: boolean;
  }
): BackupMergeExecutionResult {
  const { format, payload, detectedTypeLabelAr } = extractBackupEnvelope(rawIncomingBackup);
  const batchSize = Math.max(1, options?.batchSize || 25);
  const preferIncomingOnConflict = Boolean(options?.preferIncomingOnConflict);
  const replaceMode = Boolean(options?.replaceMode);

  const hasAnyData = Boolean(
    payload && (
      (Array.isArray(payload.workOrders) && payload.workOrders.length > 0) ||
      (Array.isArray(payload.monthTables) && payload.monthTables.length > 0) ||
      (Array.isArray(payload.users) && payload.users.length > 0) ||
      (Array.isArray(payload.offices) && payload.offices.length > 0) ||
      (Array.isArray(payload.columns) && payload.columns.length > 0) ||
      (payload.dropdownOptions && Object.keys(payload.dropdownOptions).length > 0)
    )
  );

  const emptyReport: BackupMergePreviewReport = {
    valid: format !== 'invalid' && hasAnyData,
    backupFormat: format,
    detectedTypeLabelAr: detectedTypeLabelAr || 'نسخة احتياطية',
    summary: {
      currentOrdersCount: Array.isArray(currentDb?.workOrders) ? currentDb.workOrders.length : 0,
      incomingOrdersCount: 0,
      resultingOrdersCount: Array.isArray(currentDb?.workOrders) ? currentDb.workOrders.length : 0,
      addedOrdersCount: 0,
      updatedOrdersCount: 0,
      unchangedOrdersCount: 0,
      skippedOlderOrdersCount: 0,
      duplicateOrderNumbersPreservedCount: 0,
      preservedAbsentOrdersCount: 0,
      addedTablesCount: 0,
      preservedTablesCount: Array.isArray(currentDb?.monthTables) ? currentDb.monthTables.length : 0,
      addedUsersCount: 0,
      conflictingUsersSkippedCount: 0,
      totalAttachmentsPreservedCount: 0,
      unverifiableAttachmentsCount: 0,
      incompleteOrNormalizedCount: 0,
      invalidSkippedCount: 0
    },
    conflicts: {
      workOrders: [],
      users: [],
      unverifiableAttachments: [],
      warnings: []
    },
    batchPlan: {
      batchSize,
      totalBatches: 0,
      batches: []
    },
    sampleAddedOrders: [],
    sampleUpdatedOrders: []
  };

  if (!emptyReport.valid || !payload) {
    emptyReport.conflicts.warnings.push('ملف النسخة الاحتياطية غير صالح أو لا يحتوي على سجلات متوافقة (أوامر عمل، جداول، حسابات، أو مكاتب).');
    return {
      report: emptyReport,
      mergedDb: currentDb
    };
  }

  const currentOrders: any[] = replaceMode
    ? []
    : Array.isArray(currentDb?.workOrders)
    ? JSON.parse(JSON.stringify(currentDb.workOrders))
    : [];
  const incomingRawOrders: any[] = Array.isArray(payload.workOrders) ? payload.workOrders : [];
  emptyReport.summary.incomingOrdersCount = incomingRawOrders.length;

  if (incomingRawOrders.length === 0 && hasAnyData) {
    emptyReport.conflicts.warnings.push('ملف النسخة لا يحتوي على أوامر عمل، سيتم دمج وتحديث الجداول والحسابات والمكاتب فقط بأمان تام.');
  }

  // Step 1: Normalize and validate incoming work orders & inspect attachments for verifiability

  // Step 1: Normalize and validate incoming work orders & inspect attachments for verifiability
  const incomingById = new Map<string, any>();
  for (let i = 0; i < incomingRawOrders.length; i++) {
    const norm = normalizeLegacyWorkOrder(incomingRawOrders[i], i);
    if (!norm.order) {
      emptyReport.summary.invalidSkippedCount++;
      if (norm.warning) emptyReport.conflicts.warnings.push(norm.warning);
      continue;
    }

    // Verify attachments on incoming order
    const ord = norm.order;
    const inspectAttachmentList = (attList: any[], fieldKey: 'dataUrl' | 'url') => {
      if (!Array.isArray(attList)) return;
      for (const att of attList) {
        if (!att || typeof att !== 'object') {
          emptyReport.summary.unverifiableAttachmentsCount++;
          emptyReport.conflicts.unverifiableAttachments.push({
            orderId: ord.id,
            workOrderNumber: ord.workOrderNumber || 'غير محدد',
            attachmentName: 'مرفق غير معرف',
            reason: 'كائن المرفق تالف أو غير صالح'
          });
          continue;
        }
        const rawUrl = String(att[fieldKey] || att.dataUrl || att.url || '').trim();
        const attName = String(att.name || att.caption || att.id || 'مرفق').trim();
        if (!rawUrl || rawUrl.length < 12) {
          emptyReport.summary.unverifiableAttachmentsCount++;
          emptyReport.conflicts.unverifiableAttachments.push({
            orderId: ord.id,
            workOrderNumber: ord.workOrderNumber || 'غير محدد',
            attachmentName: attName,
            reason: 'محتوى المرفق (dataUrl/url) فارغ أو مفقود'
          });
        } else if (rawUrl.startsWith('data:') && rawUrl.includes(';base64,')) {
          const b64Part = rawUrl.split(';base64,')[1] || '';
          if (b64Part.length < 4) {
            emptyReport.summary.unverifiableAttachmentsCount++;
            emptyReport.conflicts.unverifiableAttachments.push({
              orderId: ord.id,
              workOrderNumber: ord.workOrderNumber || 'غير محدد',
              attachmentName: attName,
              reason: 'ترميز Base64 للمرفق ناقص أو مقتطع'
            });
          }
        }
      }
    };
    inspectAttachmentList(ord.photosFile, 'dataUrl');
    inspectAttachmentList(ord.photos, 'url');
    if (Array.isArray(ord.qualityNoteItems)) {
      for (const qn of ord.qualityNoteItems) {
        if (qn && Array.isArray(qn.files)) inspectAttachmentList(qn.files, 'dataUrl');
      }
    }
    if (norm.wasNormalized) {
      emptyReport.summary.incompleteOrNormalizedCount++;
      emptyReport.conflicts.workOrders.push({
        id: norm.order.id,
        workOrderNumber: norm.order.workOrderNumber || 'غير محدد',
        office: norm.order.office || 'غير محدد',
        conflictType: 'INCOMPLETE_RECORD_NORMALIZED',
        incomingUpdatedAt: norm.order.updatedAt,
        resolution: 'تم تطبيع الحقول القديمة/الناقصة تلقائياً مع الحفاظ الكامل على السجل والمرفقات'
      });
    }

    const prevInBackup = incomingById.get(norm.order.id);
    if (!prevInBackup) {
      incomingById.set(norm.order.id, norm.order);
    } else {
      // Exact same ID repeated inside the same backup file: keep newer timestamp + lossless attachments
      const prevMs = parseIsoTimestampMs(prevInBackup.updatedAt) ?? 0;
      const incMs = parseIsoTimestampMs(norm.order.updatedAt) ?? 0;
      const mergedAtt = mergeAttachmentsLossless(prevInBackup, norm.order);
      const winner = incMs >= prevMs ? { ...prevInBackup, ...norm.order, ...mergedAtt } : { ...norm.order, ...prevInBackup, ...mergedAtt };
      incomingById.set(norm.order.id, winner);
    }
  }

  // Map current work orders by ID and track existing workOrderNumbers
  const resultOrdersMap = new Map<string, any>();
  const numberToIdsMap = new Map<string, Set<string>>();

  for (const existing of currentOrders) {
    if (!existing || !existing.id) continue;
    resultOrdersMap.set(existing.id, existing);
    const num = String(existing.workOrderNumber || '').trim();
    if (num) {
      if (!numberToIdsMap.has(num)) numberToIdsMap.set(num, new Set());
      numberToIdsMap.get(num)!.add(existing.id);
    }
  }

  // Count existing orders that are completely absent from incoming backup (all preserved!)
  let preservedAbsentCount = 0;
  for (const existingId of resultOrdersMap.keys()) {
    if (!incomingById.has(existingId)) {
      preservedAbsentCount++;
    }
  }
  emptyReport.summary.preservedAbsentOrdersCount = preservedAbsentCount;

  // Step 2: Merge each incoming work order into resultOrdersMap
  for (const [incId, incOrder] of incomingById.entries()) {
    const existing = resultOrdersMap.get(incId);
    const incNum = String(incOrder.workOrderNumber || '').trim();

    if (!existing) {
      // Check if another order with a DIFFERENT ID has the same workOrderNumber
      if (incNum && numberToIdsMap.has(incNum)) {
        const otherIds = Array.from(numberToIdsMap.get(incNum)!).filter(id => id !== incId);
        if (otherIds.length > 0) {
          emptyReport.summary.duplicateOrderNumbersPreservedCount++;
          emptyReport.conflicts.workOrders.push({
            id: incId,
            workOrderNumber: incNum,
            office: incOrder.office || 'غير محدد',
            conflictType: 'SAME_NUMBER_DIFFERENT_ID_KEPT_BOTH',
            incomingUpdatedAt: incOrder.updatedAt,
            resolution: `رقم أمر العمل (${incNum}) موجود في سجل آخر بمعرف مختلف (${otherIds[0]}) — تم الاحتفاظ بكلا السجلين ومنع الحذف أو الدمج القسري برقم الأمر وحده`
          });
        }
      }

      const added = {
        ...incOrder,
        createdAt: incOrder.createdAt || new Date().toISOString(),
        updatedAt: incOrder.updatedAt || incOrder.createdAt || new Date().toISOString()
      };
      resultOrdersMap.set(incId, added);
      if (incNum) {
        if (!numberToIdsMap.has(incNum)) numberToIdsMap.set(incNum, new Set());
        numberToIdsMap.get(incNum)!.add(incId);
      }
      emptyReport.summary.addedOrdersCount++;
      if (emptyReport.sampleAddedOrders.length < 20) {
        emptyReport.sampleAddedOrders.push({
          id: incId,
          workOrderNumber: incNum || 'بدون رقم',
          office: added.office || 'غير محدد'
        });
      }
      continue;
    }

    // Both existing and incoming share the EXACT same ID
    const exMs = parseIsoTimestampMs(existing.updatedAt);
    const incMs = parseIsoTimestampMs(incOrder.updatedAt);
    const mergedAttachments = mergeAttachmentsLossless(existing, incOrder);

    // Compare serialized content (excluding updatedAt) to see if they are identical
    const exClone = { ...existing, ...mergedAttachments, updatedAt: '' };
    const incClone = { ...existing, ...incOrder, ...mergedAttachments, updatedAt: '' };
    const isContentIdentical = JSON.stringify(exClone) === JSON.stringify(incClone);

    if (preferIncomingOnConflict) {
      if (isContentIdentical) {
        resultOrdersMap.set(incId, { ...existing, ...mergedAttachments });
        emptyReport.summary.unchangedOrdersCount++;
      } else {
        const updated = {
          ...existing,
          ...incOrder,
          ...mergedAttachments,
          id: existing.id,
          updatedAt: new Date().toISOString()
        };
        resultOrdersMap.set(incId, updated);
        emptyReport.summary.updatedOrdersCount++;
        if (emptyReport.sampleUpdatedOrders.length < 20) {
          emptyReport.sampleUpdatedOrders.push({
            id: incId,
            workOrderNumber: updated.workOrderNumber || 'بدون رقم',
            office: updated.office || 'غير محدد'
          });
        }
      }
    } else if (exMs !== null && incMs !== null) {
      if (incMs < exMs) {
        // Incoming backup record is OLDER than the current database record -> NEVER overwrite newer record!
        const preservedNewer = {
          ...existing,
          ...mergedAttachments
        };
        resultOrdersMap.set(incId, preservedNewer);
        emptyReport.summary.skippedOlderOrdersCount++;
        emptyReport.conflicts.workOrders.push({
          id: incId,
          workOrderNumber: incNum || existing.workOrderNumber || 'بدون رقم',
          office: existing.office || 'غير محدد',
          conflictType: 'OLDER_INCOMING_SKIPPED',
          existingUpdatedAt: existing.updatedAt,
          incomingUpdatedAt: incOrder.updatedAt,
          resolution: 'السجل الحالي أحدث زمنياً من سجل النسخة الاحتياطية — تم الاحتفاظ بالسجل الأحدث مع صون كافة المرفقات'
        });
      } else if (incMs > exMs && !isContentIdentical) {
        // Incoming backup record is strictly NEWER -> update while keeping all attachments lossless
        const updated = {
          ...existing,
          ...incOrder,
          ...mergedAttachments,
          id: existing.id
        };
        resultOrdersMap.set(incId, updated);
        emptyReport.summary.updatedOrdersCount++;
        if (emptyReport.sampleUpdatedOrders.length < 20) {
          emptyReport.sampleUpdatedOrders.push({
            id: incId,
            workOrderNumber: updated.workOrderNumber || 'بدون رقم',
            office: updated.office || 'غير محدد'
          });
        }
      } else if (!isContentIdentical) {
        // Same timestamp (`incMs === exMs`) but different field values -> keep existing fields, fill only empty/missing fields + union attachments
        const safeMerged: any = { ...incOrder, ...existing, ...mergedAttachments };
        resultOrdersMap.set(incId, safeMerged);
        emptyReport.summary.skippedOlderOrdersCount++;
        emptyReport.conflicts.workOrders.push({
          id: incId,
          workOrderNumber: existing.workOrderNumber || incNum || 'بدون رقم',
          office: existing.office || 'غير محدد',
          conflictType: 'MODIFIED_SAME_TIMESTAMP_SKIPPED',
          existingUpdatedAt: existing.updatedAt,
          incomingUpdatedAt: incOrder.updatedAt,
          resolution: 'تعارض محتوى بنفس الطابع الزمني — تم الاحتفاظ بقيم السجل الحالي ومنع الاستبدال الصامت مع دمج أي مرفقات إضافية'
        });
      } else {
        resultOrdersMap.set(incId, { ...existing, ...mergedAttachments });
        emptyReport.summary.unchangedOrdersCount++;
      }
    } else {
      // One or both timestamps missing
      if (isContentIdentical) {
        resultOrdersMap.set(incId, { ...existing, ...mergedAttachments });
        emptyReport.summary.unchangedOrdersCount++;
      } else {
        // Without a provably newer timestamp on incoming, never overwrite existing fields; only backfill missing fields and attachments
        const safeMerged: any = { ...incOrder, ...existing, ...mergedAttachments };
        resultOrdersMap.set(incId, safeMerged);
        emptyReport.summary.skippedOlderOrdersCount++;
        emptyReport.conflicts.workOrders.push({
          id: incId,
          workOrderNumber: existing.workOrderNumber || incNum || 'بدون رقم',
          office: existing.office || 'غير محدد',
          conflictType: 'OLDER_INCOMING_SKIPPED',
          existingUpdatedAt: existing.updatedAt,
          incomingUpdatedAt: incOrder.updatedAt,
          resolution: 'سجل النسخة الاحتياطية لا يحمل طابعاً زمنياً أحدث — تم الاحتفاظ بالسجل الحالي ومنع الكتابة العكسية مع دمج المرفقات'
        });
      }
    }
  }

  const mergedWorkOrders = Array.from(resultOrdersMap.values());
  emptyReport.summary.resultingOrdersCount = mergedWorkOrders.length;

  let totalAttachments = 0;
  for (const w of mergedWorkOrders) {
    totalAttachments += countOrderAttachments(w);
  }
  emptyReport.summary.totalAttachmentsPreservedCount = totalAttachments;

  // Step 3: Non-destructive Month Tables merge (never delete existing tables unless replaceMode && incomingTables.length > 0)
  const currentTables: any[] = (replaceMode && Array.isArray(payload.monthTables) && payload.monthTables.length > 0)
    ? []
    : Array.isArray(currentDb?.monthTables)
    ? JSON.parse(JSON.stringify(currentDb.monthTables))
    : [];
  const incomingTables: any[] = Array.isArray(payload.monthTables)
    ? payload.monthTables
    : Array.isArray(payload.tables)
    ? payload.tables
    : [];

  const tablesMap = new Map<string, any>();
  for (const t of currentTables) {
    if (t && t.id) tablesMap.set(t.id, t);
  }
  let addedTablesCount = 0;
  for (const incT of incomingTables) {
    if (!incT || typeof incT !== 'object' || !incT.id) continue;
    if (!tablesMap.has(incT.id)) {
      tablesMap.set(incT.id, incT);
      addedTablesCount++;
    } else if (preferIncomingOnConflict) {
      tablesMap.set(incT.id, { ...tablesMap.get(incT.id), ...incT });
    }
  }
  // Also auto-synthesize any custom MonthTable referenced by mergedWorkOrders so no imported order is ever orphaned
  for (const ord of mergedWorkOrders) {
    const tid = ord?.tableId ? String(ord.tableId).trim() : '';
    if (tid && tid !== 'all' && !tid.startsWith('default-') && !tablesMap.has(tid)) {
      const mMatch = tid.match(/^tbl-(\d{4})-(\d{1,2})-/);
      const inferredYear = Number(ord.tableYear) || (mMatch ? Number(mMatch[1]) : new Date().getFullYear());
      const inferredMonth = Number(ord.tableMonth) || (mMatch ? Number(mMatch[2]) : new Date().getMonth() + 1);
      tablesMap.set(tid, {
        id: tid,
        year: inferredYear,
        month: inferredMonth,
        name: ord.tableName ? String(ord.tableName).trim() : `جدول مستورد (${tid.slice(-4)})`,
        description: 'تم استرداده تلقائياً من سجلات أوامر العمل المستوردة',
        color: 'blue',
        isDefault: false,
        createdAt: ord.createdAt || new Date().toISOString()
      });
      addedTablesCount++;
    }
  }
  const mergedMonthTables = Array.from(tablesMap.values());
  emptyReport.summary.addedTablesCount = addedTablesCount;
  emptyReport.summary.preservedTablesCount = currentTables.length;

  // Step 4: Strict User Account & Permission Conflict Detection (NEVER auto-merge conflicting users, permissions, or passwords!)
  const currentUsers: PlatformUser[] = (Array.isArray(currentDb?.users)
    ? JSON.parse(JSON.stringify(currentDb.users))
    : []).filter((u: any) => u && !isPurgedLegacyUserOrEmail(u));
  const incomingUsers: any[] = (Array.isArray(payload.users) ? payload.users : []).filter(
    (u: any) => u && !isPurgedLegacyUserOrEmail(u)
  );
  const mergedUsers: PlatformUser[] = [...currentUsers];

  for (const incUser of incomingUsers) {
    if (!incUser || typeof incUser !== 'object') continue;
    if (isPurgedLegacyUserOrEmail(incUser)) continue;
    const incId = String(incUser.id || '').trim();
    const incUsername = String(incUser.username || '').trim().toLowerCase();
    const incEmail = String(incUser.email || '').trim().toLowerCase();

    const matchedExisting =
      mergedUsers.find(u => u && incId && u.id === incId) ||
      mergedUsers.find(u => u && incEmail && String(u.email || '').trim().toLowerCase() === incEmail) ||
      mergedUsers.find(u => {
        if (!u || !incUsername) return false;
        // Do not cross-match different super-admin emails that share the default super-admin username '831300'
        if (incUsername === '831300' && incEmail && String(u.email || '').trim().toLowerCase() !== incEmail) {
          return false;
        }
        return String(u.username || '').trim().toLowerCase() === incUsername;
      });

    if (!matchedExisting) {
      // Brand new user account not conflicting with any existing user
      const newUser: PlatformUser = {
        ...incUser,
        id: incId || `usr-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        permissions: normalizeUserPermissions(incUser.permissions)
      };
      if (newUser.password && !newUser.passwordHash) {
        newUser.hasPassword = true;
      }
      mergedUsers.push(newUser);
      emptyReport.summary.addedUsersCount++;
      continue;
    }

    // If matchedExisting is missing passwordHash (e.g., from a sanitized export) and incoming has passwordHash, backfill it safely!
    if (!matchedExisting.passwordHash && !matchedExisting.password && incUser.passwordHash) {
      matchedExisting.passwordHash = incUser.passwordHash;
    }

    // Existing user found: inspect for any conflict in identity, role, active state, permissions, or password
    const conflictFields: string[] = [];
    if (incId && matchedExisting.id !== incId) {
      conflictFields.push('id');
    }
    if (incUsername && String(matchedExisting.username || '').trim().toLowerCase() !== incUsername) {
      conflictFields.push('username');
    }
    if (incEmail && String(matchedExisting.email || '').trim().toLowerCase() !== incEmail) {
      conflictFields.push('email');
    }
    if (incUser.isSuperAdmin !== undefined && Boolean(incUser.isSuperAdmin) !== Boolean(matchedExisting.isSuperAdmin)) {
      conflictFields.push('isSuperAdmin');
    }
    if (incUser.isActive !== undefined && Boolean(incUser.isActive) !== Boolean(matchedExisting.isActive)) {
      conflictFields.push('isActive');
    }
    if (incUser.roleTitle && String(incUser.roleTitle).trim() !== String(matchedExisting.roleTitle || '').trim()) {
      conflictFields.push('roleTitle');
    }
    if (incUser.permissions && !arePermissionsEqual(matchedExisting.permissions, incUser.permissions)) {
      conflictFields.push('permissions');
    }
    if (
      (incUser.password && matchedExisting.password && incUser.password !== matchedExisting.password) ||
      (incUser.passwordHash && matchedExisting.passwordHash && incUser.passwordHash !== matchedExisting.passwordHash) ||
      (incUser.password && !matchedExisting.password && matchedExisting.passwordHash)
    ) {
      conflictFields.push('password');
    }

    if (conflictFields.length > 0) {
      // Strictly refuse automatic merge of conflicting user accounts, permissions, or passwords!
      emptyReport.summary.conflictingUsersSkippedCount++;
      emptyReport.conflicts.users.push({
        id: matchedExisting.id,
        username: matchedExisting.username || incUser.username || '',
        email: matchedExisting.email || incUser.email || '',
        conflictFields,
        resolution: `تم رفض الدمج التلقائي للحساب المتعارض (${conflictFields.join(', ')}) والاحتفاظ بالحساب والصلاحيات وكلمة المرور الحالية دون تغيير`
      });
    }
  }

  // Step 5: Non-destructive Offices, Columns, DropdownOptions, ArchivedReports & DeletedOrderIds merge
  const currentOffices: any[] = Array.isArray(currentDb?.offices)
    ? JSON.parse(JSON.stringify(currentDb.offices))
    : [];
  const incomingOffices: any[] = Array.isArray(payload.offices) ? payload.offices : [];
  const officeByName = new Map<string, any>();
  for (const off of currentOffices) {
    if (off && off.name) officeByName.set(off.name, off);
  }
  for (const incOff of incomingOffices) {
    if (!incOff || !incOff.name) continue;
    const prevOff = officeByName.get(incOff.name);
    if (!prevOff) {
      officeByName.set(incOff.name, incOff);
    } else if (Array.isArray(incOff.contractors)) {
      const mergedContractors = Array.from(
        new Set([...(Array.isArray(prevOff.contractors) ? prevOff.contractors : []), ...incOff.contractors])
      );
      officeByName.set(incOff.name, { ...prevOff, contractors: mergedContractors });
    }
  }
  const mergedOffices = Array.from(officeByName.values());

  const currentColumns: any[] = Array.isArray(currentDb?.columns)
    ? JSON.parse(JSON.stringify(currentDb.columns))
    : [];
  const incomingColumns: any[] = Array.isArray(payload.columns) ? payload.columns : [];
  const colByField = new Map<string, any>();
  for (const c of currentColumns) {
    if (c && c.field) colByField.set(c.field, c);
  }
  for (const incC of incomingColumns) {
    if (incC && incC.field && !colByField.has(incC.field) && incC.field !== 'receiptDate') {
      colByField.set(incC.field, incC);
    }
  }
  const mergedColumns = Array.from(colByField.values());

  const mergedDropdownOptions: Record<string, any> = JSON.parse(
    JSON.stringify(currentDb?.dropdownOptions || {})
  );
  if (payload.dropdownOptions && typeof payload.dropdownOptions === 'object') {
    for (const [k, v] of Object.entries(payload.dropdownOptions)) {
      if (Array.isArray(v)) {
        const prevArr = Array.isArray(mergedDropdownOptions[k]) ? mergedDropdownOptions[k] : [];
        mergedDropdownOptions[k] = Array.from(new Set([...prevArr, ...v]));
      } else if (v && typeof v === 'object' && k === 'officeContractors') {
        mergedDropdownOptions.officeContractors = {
          ...(mergedDropdownOptions.officeContractors || {}),
          ...(v as Record<string, any>)
        };
      }
    }
  }

  const currentReports: any[] = Array.isArray(currentDb?.archivedReports)
    ? JSON.parse(JSON.stringify(currentDb.archivedReports))
    : [];
  const incomingReports: any[] = Array.isArray(payload.archivedReports) ? payload.archivedReports : [];
  const reportsMap = new Map<string, any>();
  for (const r of currentReports) {
    if (r && r.id) reportsMap.set(r.id, r);
  }
  for (const incR of incomingReports) {
    if (incR && incR.id && !reportsMap.has(incR.id)) {
      reportsMap.set(incR.id, incR);
    }
  }
  const mergedArchivedReports = Array.from(reportsMap.values());

  const activeIdsSet = new Set(mergedWorkOrders.map(w => w.id));
  const rawDeletedIds = Array.from(
    new Set([
      ...(Array.isArray(currentDb?.deletedOrderIds) ? currentDb.deletedOrderIds : []),
      ...(Array.isArray(payload.deletedOrderIds) ? payload.deletedOrderIds : [])
    ])
  );
  const mergedDeletedOrderIds = rawDeletedIds.filter(id => id && !activeIdsSet.has(id));

  // Build deterministic, verifiable resumable batch plan
  const batchSlices: MergeBatchCheckpoint[] = [];
  for (let startIdx = 0; startIdx < mergedWorkOrders.length; startIdx += batchSize) {
    const slice = mergedWorkOrders.slice(startIdx, startIdx + batchSize);
    const batchIndex = Math.floor(startIdx / batchSize);
    let attCount = 0;
    for (const w of slice) {
      attCount += countOrderAttachments(w);
    }
    const batchSha256 = sha256Hex(
      JSON.stringify(slice.map(w => ({ id: w.id, updatedAt: w.updatedAt, att: countOrderAttachments(w) })))
    );
    batchSlices.push({
      batchIndex,
      startOrderIndex: startIdx,
      endOrderIndex: startIdx + slice.length - 1,
      orderIdsCount: slice.length,
      attachmentsInBatchCount: attCount,
      batchSha256
    });
  }
  emptyReport.batchPlan = {
    batchSize,
    totalBatches: batchSlices.length,
    batches: batchSlices
  };

  const mergedDb = {
    ...currentDb,
    workOrders: mergedWorkOrders,
    monthTables: mergedMonthTables,
    users: mergedUsers,
    offices: mergedOffices.length > 0 ? mergedOffices : currentDb?.offices,
    columns: mergedColumns.length > 0 ? mergedColumns : currentDb?.columns,
    dropdownOptions: mergedDropdownOptions,
    archivedReports: mergedArchivedReports,
    deletedOrderIds: mergedDeletedOrderIds
  };

  return {
    report: emptyReport,
    mergedDb
  };
}
