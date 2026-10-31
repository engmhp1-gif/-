import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { computeSha256, type CloudDatabaseSchema } from './chunkEngine.ts';
import type { PlatformUser } from '../types.ts';
import { isUserSuperAdmin, hasUserPermission } from './security.ts';

export interface IndependentBackupBundle {
  bundleFormat: 'SEC_QCMS_155_INDEPENDENT_BACKUP_V2';
  bundleId: string;
  createdAtIso: string;
  createdBy: {
    userId: string;
    username: string;
    role: string;
  };
  storageLayer: 'OUT_OF_DATABASE_INDEPENDENT_ARCHIVE';
  counts: {
    workOrders: number;
    monthTables: number;
    offices: number;
    users: number;
    archivedReports: number;
    totalAttachments: number;
    attachments?: number;
    totalAttachmentBytes: number;
  };
  checksums: {
    workOrdersSha256: string;
    monthTablesSha256: string;
    officesSha256: string;
    usersSha256: string;
    archivedReportsSha256: string;
    attachmentsInventorySha256: string;
    payloadSha256: string;
  };
  hmacSignature: string;
  attachmentManifest: Array<{
    orderId: string;
    kind: 'photosFile' | 'photo' | 'qualityNotePhoto';
    itemId: string;
    name?: string;
    length: number;
    sha256: string;
  }>;
  payload: CloudDatabaseSchema;
}

/**
 * Builds a complete inventory of all attachments across all work orders
 * with individual SHA-256 digests so zero attachment loss can be proved cryptographically.
 */
export function buildAttachmentInventory(data: CloudDatabaseSchema): {
  items: IndependentBackupBundle['attachmentManifest'];
  totalBytes: number;
  inventorySha256: string;
} {
  const items: IndependentBackupBundle['attachmentManifest'] = [];
  let totalBytes = 0;

  for (const wo of data.workOrders || []) {
    if (!wo) continue;
    if (Array.isArray(wo.photosFile)) {
      for (const pf of wo.photosFile) {
        if (!pf) continue;
        const raw = String(pf.dataUrl || '');
        const len = Buffer.byteLength(raw, 'utf-8');
        totalBytes += len;
        items.push({
          orderId: wo.id,
          kind: 'photosFile',
          itemId: pf.id || pf.name || 'file',
          name: pf.name,
          length: len,
          sha256: computeSha256(raw)
        });
      }
    }
    if (Array.isArray(wo.photos)) {
      for (const ph of wo.photos) {
        if (!ph) continue;
        const raw = String(ph.url || '');
        const len = Buffer.byteLength(raw, 'utf-8');
        totalBytes += len;
        items.push({
          orderId: wo.id,
          kind: 'photo',
          itemId: ph.id || 'photo',
          length: len,
          sha256: computeSha256(raw)
        });
      }
    }
    if (Array.isArray(wo.qualityNoteItems)) {
      for (const qni of wo.qualityNoteItems) {
        if (!qni || !Array.isArray(qni.photos)) continue;
        qni.photos.forEach((pUrl, idx) => {
          const raw = String(pUrl || '');
          const len = Buffer.byteLength(raw, 'utf-8');
          totalBytes += len;
          items.push({
            orderId: wo.id,
            kind: 'qualityNotePhoto',
            itemId: `${qni.id || 'qn'}_${idx}`,
            length: len,
            sha256: computeSha256(raw)
          });
        });
      }
    }
  }

  const inventorySha256 = computeSha256(JSON.stringify(items));
  return { items, totalBytes, inventorySha256 };
}

/**
 * Verifies separate Backup Operator authorization (requires both SuperAdmin/restoreDeleted
 * permission OR dedicated backupOperatorSecret header).
 */
export function authorizeIndependentBackupOperation(
  user: PlatformUser | null | undefined,
  providedOperatorSecret?: string,
  configuredOperatorSecret?: string
): { authorized: boolean; error?: string } {
  if (
    configuredOperatorSecret &&
    providedOperatorSecret &&
    providedOperatorSecret.length === configuredOperatorSecret.length &&
    crypto.timingSafeEqual(
      Buffer.from(providedOperatorSecret, 'utf-8'),
      Buffer.from(configuredOperatorSecret, 'utf-8')
    )
  ) {
    return { authorized: true };
  }

  if (!user) {
    return {
      authorized: false,
      error: 'غير مصرح (401): تتطلب عمليات النسخ الاحتياطي المستقل مصادقة مسؤول معتمد أو مفتاح مشغل النسخ الاحتياطي المنفصل'
    };
  }

  if (isUserSuperAdmin(user) || hasUserPermission(user, 'restoreDeleted')) {
    return { authorized: true };
  }

  return {
    authorized: false,
    error: 'مرفوض (403): صلاحية إدارة واستعادة النسخ الاحتياطية المستقلة غير متوفرة لهذا الحساب'
  };
}

/**
 * Creates a cryptographically signed, out-of-database backup bundle with section-level
 * and attachment-level SHA-256 digests.
 */
export function createIndependentBackupBundle(
  data: CloudDatabaseSchema,
  signingSecret: string,
  actor?: { userId?: string; username?: string; role?: string }
): IndependentBackupBundle {
  const payloadClone: CloudDatabaseSchema = JSON.parse(JSON.stringify(data));
  const payloadJson = JSON.stringify(payloadClone);

  const workOrdersSha256 = computeSha256(JSON.stringify(payloadClone.workOrders || []));
  const monthTablesSha256 = computeSha256(JSON.stringify(payloadClone.monthTables || []));
  const officesSha256 = computeSha256(JSON.stringify(payloadClone.offices || []));
  const usersSha256 = computeSha256(JSON.stringify(payloadClone.users || []));
  const archivedReportsSha256 = computeSha256(JSON.stringify(payloadClone.archivedReports || []));
  const payloadSha256 = computeSha256(payloadJson);

  const attInv = buildAttachmentInventory(payloadClone);

  const bundleId = `sec155_ind_bkp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const createdAtIso = new Date().toISOString();

  const checksums = {
    workOrdersSha256,
    monthTablesSha256,
    officesSha256,
    usersSha256,
    archivedReportsSha256,
    attachmentsInventorySha256: attInv.inventorySha256,
    payloadSha256
  };

  const signingInput = `${bundleId}|${createdAtIso}|${payloadSha256}|${attInv.inventorySha256}`;
  const hmacSignature = crypto
    .createHmac('sha256', signingSecret)
    .update(signingInput, 'utf-8')
    .digest('hex');

  return {
    bundleFormat: 'SEC_QCMS_155_INDEPENDENT_BACKUP_V2',
    bundleId,
    createdAtIso,
    createdBy: {
      userId: actor?.userId || 'system-backup-operator',
      username: actor?.username || 'Backup Operator',
      role: actor?.role || 'BACKUP_OPERATOR'
    },
    storageLayer: 'OUT_OF_DATABASE_INDEPENDENT_ARCHIVE',
    counts: {
      workOrders: (payloadClone.workOrders || []).length,
      monthTables: (payloadClone.monthTables || []).length,
      offices: (payloadClone.offices || []).length,
      users: (payloadClone.users || []).length,
      archivedReports: (payloadClone.archivedReports || []).length,
      totalAttachments: attInv.items.length,
      attachments: attInv.items.length,
      totalAttachmentBytes: attInv.totalBytes
    },
    checksums,
    hmacSignature,
    attachmentManifest: attInv.items,
    payload: payloadClone
  };
}

/**
 * Independently verifies a backup bundle's HMAC signature, section SHA-256 digests,
 * and every single attachment's SHA-256 digest before allowing restoration.
 */
export function verifyIndependentBackupBundle(
  bundle: IndependentBackupBundle,
  signingSecret: string
): {
  valid: boolean;
  errors: string[];
  verifiedCounts?: IndependentBackupBundle['counts'];
} {
  const errors: string[] = [];
  if (!bundle || bundle.bundleFormat !== 'SEC_QCMS_155_INDEPENDENT_BACKUP_V2') {
    return { valid: false, errors: ['Invalid or unsupported backup bundle format'] };
  }
  if (!bundle.payload || typeof bundle.payload !== 'object') {
    return { valid: false, errors: ['Missing backup payload'] };
  }

  const actualWorkOrdersSha = computeSha256(JSON.stringify(bundle.payload.workOrders || []));
  const actualTablesSha = computeSha256(JSON.stringify(bundle.payload.monthTables || []));
  const actualOfficesSha = computeSha256(JSON.stringify(bundle.payload.offices || []));
  const actualUsersSha = computeSha256(JSON.stringify(bundle.payload.users || []));
  const actualReportsSha = computeSha256(JSON.stringify(bundle.payload.archivedReports || []));
  const actualPayloadSha = computeSha256(JSON.stringify(bundle.payload));
  const actualAttInv = buildAttachmentInventory(bundle.payload);

  if (actualWorkOrdersSha !== bundle.checksums?.workOrdersSha256) {
    errors.push('workOrders SHA-256 mismatch');
  }
  if (actualTablesSha !== bundle.checksums?.monthTablesSha256) {
    errors.push('monthTables SHA-256 mismatch');
  }
  if (actualOfficesSha !== bundle.checksums?.officesSha256) {
    errors.push('offices SHA-256 mismatch');
  }
  if (actualUsersSha !== bundle.checksums?.usersSha256) {
    errors.push('users SHA-256 mismatch');
  }
  if (actualReportsSha !== bundle.checksums?.archivedReportsSha256) {
    errors.push('archivedReports SHA-256 mismatch');
  }
  if (actualPayloadSha !== bundle.checksums?.payloadSha256) {
    errors.push('payload SHA-256 mismatch');
  }
  if (actualAttInv.inventorySha256 !== bundle.checksums?.attachmentsInventorySha256) {
    errors.push('attachmentsInventory SHA-256 mismatch');
  }

  const signingInput = `${bundle.bundleId}|${bundle.createdAtIso}|${bundle.checksums?.payloadSha256}|${bundle.checksums?.attachmentsInventorySha256}`;
  const expectedHmac = crypto
    .createHmac('sha256', signingSecret)
    .update(signingInput, 'utf-8')
    .digest('hex');

  const sigA = Buffer.from(String(bundle.hmacSignature || ''), 'utf-8');
  const sigB = Buffer.from(expectedHmac, 'utf-8');
  if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
    errors.push('Cryptographic HMAC signature verification failed');
  }

  return {
    valid: errors.length === 0,
    errors,
    verifiedCounts: {
      workOrders: (bundle.payload.workOrders || []).length,
      monthTables: (bundle.payload.monthTables || []).length,
      offices: (bundle.payload.offices || []).length,
      users: (bundle.payload.users || []).length,
      archivedReports: (bundle.payload.archivedReports || []).length,
      totalAttachments: actualAttInv.items.length,
      attachments: actualAttInv.items.length,
      totalAttachmentBytes: actualAttInv.totalBytes
    }
  };
}

/**
 * Writes an independent backup bundle to an isolated external directory outside Firestore,
 * along with a detached `.sha256` verification file, and verifies read-back immediately.
 */
export function writeIndependentBackupToDisk(
  bundle: IndependentBackupBundle,
  externalArchiveDir: string,
  signingSecret: string
): {
  filePath: string;
  checksumFilePath: string;
  fileSha256: string;
  sizeBytes: number;
} {
  fs.mkdirSync(externalArchiveDir, { recursive: true });
  const fileName = `${bundle.bundleId}.backup.bundle.json`;
  const filePath = path.join(externalArchiveDir, fileName);
  const checksumFilePath = `${filePath}.sha256`;

  const rawJson = JSON.stringify(bundle, null, 2);
  const fileSha256 = computeSha256(rawJson);

  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, rawJson, 'utf-8');
  fs.renameSync(tmpPath, filePath);
  fs.writeFileSync(checksumFilePath, `${fileSha256}  ${fileName}\n`, 'utf-8');

  // Immediate independent read-back verification
  const readBackRaw = fs.readFileSync(filePath, 'utf-8');
  const readBackSha = computeSha256(readBackRaw);
  if (readBackSha !== fileSha256) {
    throw new Error('Disk read-back SHA-256 mismatch on independent backup');
  }
  const parsed = JSON.parse(readBackRaw) as IndependentBackupBundle;
  const check = verifyIndependentBackupBundle(parsed, signingSecret);
  if (!check.valid) {
    throw new Error(`Independent backup verification failed after write: ${check.errors.join(', ')}`);
  }

  return {
    filePath,
    checksumFilePath,
    fileSha256,
    sizeBytes: Buffer.byteLength(rawJson, 'utf-8')
  };
}
