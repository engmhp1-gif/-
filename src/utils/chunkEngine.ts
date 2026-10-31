import crypto from 'crypto';
import type {
  WorkOrder,
  SubOffice,
  ColumnDefinition,
  DropdownOptionsMap,
  MonthTable,
  ArchivedReportSnapshot,
  LiveNotificationItem,
  PlatformUser
} from '../types.ts';
import { INITIAL_OFFICES, INITIAL_COLUMNS, INITIAL_DROPDOWN_OPTIONS } from '../data/initialData.ts';
import { ensureDefaultSuperAdmins, DEFAULT_SUPER_ADMIN_USERS } from './security.ts';

export interface CloudDatabaseSchema {
  workOrders: WorkOrder[];
  offices: SubOffice[];
  columns: ColumnDefinition[];
  dropdownOptions: DropdownOptionsMap;
  monthTables?: MonthTable[];
  archivedReports?: ArchivedReportSnapshot[];
  deletedOrderIds?: string[];
  lastClearedAt?: string;
  notificationsLog?: LiveNotificationItem[];
  users?: PlatformUser[];
  smtpSettings?: any;
}

export interface CloudChunkRecord {
  vaultKey: string;
  chunkId: string;
  chunkType: 'workOrders' | 'customTemplate' | 'extraCore';
  chunkIndex: number;
  version: number;
  updatedAtIso: string;
  payloadJson: string;
  sha256?: string;
}

export interface CloudManifestRecord {
  vaultKey: string;
  version: number;
  updatedAtIso: string;
  workOrderCount: number;
  tableCount: number;
  userCount: number;
  chunkCount: number;
  chunkIds: string[];
  coreJson: string;
  coreSha256?: string;
  chunkChecksums?: Record<string, string>;
}

export interface CloudStoreAdapter {
  getManifest(vaultKey: string): Promise<CloudManifestRecord | null>;
  setManifest(vaultKey: string, manifest: CloudManifestRecord): Promise<void>;
  getChunk(vaultKey: string, chunkId: string): Promise<CloudChunkRecord | null>;
  setChunk(vaultKey: string, chunkId: string, chunk: CloudChunkRecord): Promise<void>;
}

export function computeSha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf-8').digest('hex');
}

export interface AttachmentSlice {
  __sliceRecord: true;
  attKey: string;
  sliceIndex: number;
  totalSlices: number;
  dataSlice: string;
  sha256?: string;
}

const MAX_ATTACHMENT_SLICE_CHARS = 320000;
const MAX_CHUNK_JSON_CHARS = 350000;

/**
 * Extracts base64 data from workOrders (`photosFile`, `photos`, `qualityNoteItems`)
 * into slice records so no workOrder or attachment ever exceeds Firestore's 1 MiB document limit,
 * while guaranteeing 100% lossless reassembly.
 */
export function detachAndSliceAttachments(workOrders: WorkOrder[]): {
  lightweightOrders: WorkOrder[];
  attachmentSlices: any[];
  totalAttachmentsCount: number;
} {
  const attachmentSlices: any[] = [];
  let attCounter = 0;
  const seenHashToAttKey = new Map<string, string>();

  const pushSlicedString = (rawStr: string, prefix: string): string => {
    const rawSha = computeSha256(rawStr);
    const existingKey = seenHashToAttKey.get(rawSha);
    if (existingKey) {
      return `__ATT_REF__:${existingKey}`;
    }
    const attKey = `${prefix}_${attCounter++}`;
    seenHashToAttKey.set(rawSha, attKey);
    const totalLen = rawStr.length;
    const totalSlices = Math.max(1, Math.ceil(totalLen / MAX_ATTACHMENT_SLICE_CHARS));
    for (let i = 0; i < totalSlices; i++) {
      const start = i * MAX_ATTACHMENT_SLICE_CHARS;
      const dataSlice = rawStr.slice(start, start + MAX_ATTACHMENT_SLICE_CHARS);
      attachmentSlices.push({
        __sliceRecord: true,
        attKey,
        sliceIndex: i,
        totalSlices,
        dataSlice,
        sha256: computeSha256(dataSlice)
      });
    }
    return `__ATT_REF__:${attKey}`;
  };

  const lightweightOrders: WorkOrder[] = (Array.isArray(workOrders) ? workOrders : []).map((wo) => {
    if (!wo || typeof wo !== 'object') return wo;
    const clone: WorkOrder = { ...wo };

    // 1. Detach photosFile dataUrl
    if (Array.isArray(clone.photosFile) && clone.photosFile.length > 0) {
      clone.photosFile = clone.photosFile.map((pf) => {
        if (pf && typeof pf.dataUrl === 'string' && pf.dataUrl.length > 16) {
          return {
            ...pf,
            dataUrl: pushSlicedString(pf.dataUrl, `pf_${wo.id}_${pf.id || 'f'}`)
          };
        }
        return pf;
      });
    }

    // 2. Detach photos url
    if (Array.isArray(clone.photos) && clone.photos.length > 0) {
      clone.photos = clone.photos.map((p) => {
        if (p && typeof p.url === 'string' && p.url.length > 16) {
          return {
            ...p,
            url: pushSlicedString(p.url, `ph_${wo.id}_${p.id || 'p'}`)
          };
        }
        return p;
      });
    }

    // 3. Detach qualityNoteItems photos & files
    if (Array.isArray(clone.qualityNoteItems) && clone.qualityNoteItems.length > 0) {
      clone.qualityNoteItems = clone.qualityNoteItems.map((qni, qIdx) => {
        if (!qni || typeof qni !== 'object') return qni;
        const nextQni = { ...qni };
        if (Array.isArray(nextQni.photos) && nextQni.photos.length > 0) {
          nextQni.photos = nextQni.photos.map((pUrl, idx) =>
            typeof pUrl === 'string' && pUrl.length > 16
              ? pushSlicedString(pUrl, `qn_${wo.id}_${qni.id || qIdx}_${idx}`)
              : pUrl
          );
        }
        if (Array.isArray(nextQni.files) && nextQni.files.length > 0) {
          nextQni.files = nextQni.files.map((qf, fIdx) =>
            qf && typeof qf.dataUrl === 'string' && qf.dataUrl.length > 16
              ? { ...qf, dataUrl: pushSlicedString(qf.dataUrl, `qnf_${wo.id}_${qni.id || qIdx}_${qf.id || fIdx}`) }
              : qf
          );
        }
        return nextQni;
      });
    }

    return clone;
  });

  return { lightweightOrders, attachmentSlices, totalAttachmentsCount: attCounter };
}

/**
 * Reassembles detached attachment slices back into their exact original workOrders fields.
 */
export function reassembleAttachmentsIntoOrders(
  lightweightOrders: WorkOrder[],
  attachmentSlices: any[]
): { orders: WorkOrder[]; missingAttachments: string[] } {
  const slicesByKey = new Map<string, any[]>();
  for (const s of attachmentSlices) {
    if (s && s.__sliceRecord && s.attKey) {
      if (s.sha256 && computeSha256(s.dataSlice || '') !== s.sha256) {
        throw new Error(`Attachment slice checksum mismatch for ${s.attKey} slice ${s.sliceIndex}`);
      }
      const list = slicesByKey.get(s.attKey) || [];
      list.push(s);
      slicesByKey.set(s.attKey, list);
    }
  }

  const reassembledMap = new Map<string, string>();
  const missingAttachments = [] as string[];

  for (const [attKey, list] of slicesByKey.entries()) {
    list.sort((a, b) => a.sliceIndex - b.sliceIndex);
    const expectedTotal = list[0]?.totalSlices || 1;
    if (list.length !== expectedTotal) {
      missingAttachments.push(`${attKey} (expected ${expectedTotal} slices, found ${list.length})`);
      continue;
    }
    reassembledMap.set(attKey, list.map((x) => x.dataSlice).join(''));
  }

  const resolveRef = (val: string): string => {
    if (typeof val === 'string' && val.startsWith('__ATT_REF__:')) {
      const key = val.slice('__ATT_REF__:'.length);
      if (reassembledMap.has(key)) {
        return reassembledMap.get(key)!;
      }
      missingAttachments.push(key);
    }
    return val;
  };

  const orders = (Array.isArray(lightweightOrders) ? lightweightOrders : []).map((wo) => {
    if (!wo || typeof wo !== 'object') return wo;
    const clone: WorkOrder = { ...wo };

    if (Array.isArray(clone.photosFile) && clone.photosFile.length > 0) {
      clone.photosFile = clone.photosFile.map((pf) =>
        pf && typeof pf.dataUrl === 'string'
          ? { ...pf, dataUrl: resolveRef(pf.dataUrl) }
          : pf
      );
    }

    if (Array.isArray(clone.photos) && clone.photos.length > 0) {
      clone.photos = clone.photos.map((p) =>
        p && typeof p.url === 'string'
          ? { ...p, url: resolveRef(p.url) }
          : p
      );
    }

    if (Array.isArray(clone.qualityNoteItems) && clone.qualityNoteItems.length > 0) {
      clone.qualityNoteItems = clone.qualityNoteItems.map((qni) => {
        if (!qni || typeof qni !== 'object') return qni;
        const nextQni = { ...qni };
        if (Array.isArray(nextQni.photos)) {
          nextQni.photos = nextQni.photos.map((pUrl) => (typeof pUrl === 'string' ? resolveRef(pUrl) : pUrl));
        }
        if (Array.isArray(nextQni.files)) {
          nextQni.files = nextQni.files.map((qf) =>
            qf && typeof qf.dataUrl === 'string'
              ? { ...qf, dataUrl: resolveRef(qf.dataUrl) }
              : qf
          );
        }
        return nextQni;
      });
    }

    return clone;
  });

  return { orders, missingAttachments };
}

export function splitArrayIntoHashedChunks(
  items: any[],
  versionPrefix: string,
  chunkType: 'workOrders' | 'customTemplate' | 'extraCore',
  maxChars = MAX_CHUNK_JSON_CHARS
): Array<{
  chunkId: string;
  chunkType: 'workOrders' | 'customTemplate' | 'extraCore';
  chunkIndex: number;
  payloadJson: string;
  sha256: string;
}> {
  const chunks: Array<{
    chunkId: string;
    chunkType: 'workOrders' | 'customTemplate' | 'extraCore';
    chunkIndex: number;
    payloadJson: string;
    sha256: string;
  }> = [];

  if (!Array.isArray(items) || items.length === 0) return chunks;

  let currentBatch: any[] = [];
  let currentSize = 2; // "[]"
  let chunkIndex = 0;

  for (const item of items) {
    const itemStr = JSON.stringify(item);
    if (currentBatch.length > 0 && currentSize + itemStr.length + 1 > maxChars) {
      const payloadJson = JSON.stringify(currentBatch);
      chunks.push({
        chunkId: `${versionPrefix}_${chunkIndex}`,
        chunkType,
        chunkIndex,
        payloadJson,
        sha256: computeSha256(payloadJson)
      });
      chunkIndex++;
      currentBatch = [item];
      currentSize = itemStr.length + 2;
    } else {
      currentBatch.push(item);
      currentSize += itemStr.length + 1;
    }
  }

  if (currentBatch.length > 0) {
    const payloadJson = JSON.stringify(currentBatch);
    chunks.push({
      chunkId: `${versionPrefix}_${chunkIndex}`,
      chunkType,
      chunkIndex,
      payloadJson,
      sha256: computeSha256(payloadJson)
    });
  }

  return chunks;
}

/**
 * Atomically writes versioned chunks to the cloud store, verifies every chunk's read-back
 * existence and SHA-256 checksum, and ONLY commits the parent manifest after 100% verification.
 * If any chunk write or verification fails, the previous manifest and its chunks remain untouched.
 */
export async function commitDatabaseToCloudStore(
  store: CloudStoreAdapter,
  vaultKey: string,
  data: CloudDatabaseSchema,
  versionToCommit: number,
  options?: {
    allowExplicitZeroOrders?: boolean;
    lastKnownOrderCount?: number;
    parentManifestInitialized?: boolean;
    strictRuleCompatibleManifest?: boolean;
    reason?: string;
  }
): Promise<{
  committed: boolean;
  version: number;
  chunkCount: number;
  workOrderCount: number;
  coreSha256?: string;
  chunkChecksums?: Record<string, string>;
  error?: string;
  failedChunkId?: string;
}> {
  const ordersList = Array.isArray(data.workOrders) ? data.workOrders : [];
  const lastKnown = options?.lastKnownOrderCount || 0;

  if (ordersList.length === 0 && !options?.allowExplicitZeroOrders && lastKnown > 0) {
    return {
      committed: false,
      version: versionToCommit,
      chunkCount: 0,
      workOrderCount: 0,
      error: `Anti-Wipe Guard: Blocked saving 0 work orders over ${lastKnown} cloud orders`
    };
  }

  const nowIso = new Date().toISOString();
  const safeVersion = Math.max(1, Math.floor(versionToCommit));
  const vTag = `v${safeVersion}`;

  // 1. Detach & slice heavy attachments so no chunk exceeds Firestore limits and zero attachments are lost
  const { lightweightOrders, attachmentSlices, totalAttachmentsCount } = detachAndSliceAttachments(ordersList);

  const woChunks = splitArrayIntoHashedChunks(lightweightOrders, `${vTag}_wo`, 'workOrders', MAX_CHUNK_JSON_CHARS);
  const attChunks = splitArrayIntoHashedChunks(attachmentSlices, `${vTag}_att`, 'customTemplate', MAX_CHUNK_JSON_CHARS);
  const repChunks = splitArrayIntoHashedChunks(data.archivedReports || [], `${vTag}_rep`, 'extraCore', MAX_CHUNK_JSON_CHARS);

  if (options?.strictRuleCompatibleManifest) {
    for (const c of woChunks) c.chunkId = `wo_h_${c.sha256.slice(0, 24)}_${c.chunkIndex}`;
    for (const c of attChunks) c.chunkId = `att_h_${c.sha256.slice(0, 24)}_${c.chunkIndex}`;
    for (const c of repChunks) c.chunkId = `rep_h_${c.sha256.slice(0, 24)}_${c.chunkIndex}`;
  }

  const allChunks = [...woChunks, ...attChunks, ...repChunks];
  const chunkIds = allChunks.map((c) => c.chunkId);
  const chunkChecksums: Record<string, string> = {};
  for (const ch of allChunks) {
    chunkChecksums[ch.chunkId] = ch.sha256;
  }

  const coreSectionsPayload = JSON.stringify({
    offices: data.offices || INITIAL_OFFICES,
    columns: data.columns || INITIAL_COLUMNS,
    monthTables: data.monthTables || [],
    users: ensureDefaultSuperAdmins(data.users || [])
  });
  const sectionsSha256 = computeSha256(coreSectionsPayload);

  const coreObject = {
    offices: data.offices || INITIAL_OFFICES,
    columns: data.columns || INITIAL_COLUMNS,
    dropdownOptions: data.dropdownOptions || INITIAL_DROPDOWN_OPTIONS,
    monthTables: data.monthTables || [],
    deletedOrderIds: data.deletedOrderIds || [],
    lastClearedAt: data.lastClearedAt || null,
    notificationsLog: (data.notificationsLog || []).slice(0, 100),
    users: ensureDefaultSuperAdmins(data.users || []),
    smtpSettings: data.smtpSettings || null,
    __integrity: {
      version: safeVersion,
      sectionsSha256,
      chunkChecksums,
      attachmentSliceCount: attachmentSlices.length,
      totalAttachmentsCount,
      attachmentChunkIds: attChunks.map((c) => c.chunkId)
    }
  };

  let coreJson = JSON.stringify(coreObject);
  if (coreJson.length > 880000) {
    coreObject.notificationsLog = coreObject.notificationsLog.slice(0, 20);
    coreJson = JSON.stringify(coreObject);
  }
  const coreSha256 = computeSha256(coreJson);

  // 2. Ensure parent manifest exists if first-ever bootstrap (so subcollection Master Gate succeeds),
  // WITHOUT overwriting an existing manifest!
  if (!options?.parentManifestInitialized) {
    const existingManifest = await store.getManifest(vaultKey);
    if (!existingManifest) {
      const bootstrapManifest: CloudManifestRecord = {
        vaultKey,
        version: safeVersion,
        updatedAtIso: nowIso,
        workOrderCount: 0,
        tableCount: 0,
        userCount: coreObject.users.length,
        chunkCount: 0,
        chunkIds: [],
        coreJson
      };
      try {
        await store.setManifest(vaultKey, bootstrapManifest);
      } catch (bootErr: any) {
        return {
          committed: false,
          version: safeVersion,
          chunkCount: allChunks.length,
          workOrderCount: ordersList.length,
          error: `Bootstrap manifest write failed: ${bootErr?.message || String(bootErr)}`
        };
      }
    }
  }

  // 3. Stage all versioned chunks (`v${safeVersion}_...`) in controlled parallel batches (concurrency = 15)
  // without touching any previous version's chunks
  const CONCURRENCY = 15;
  for (let i = 0; i < allChunks.length; i += CONCURRENCY) {
    const batch = allChunks.slice(i, i + CONCURRENCY);
    try {
      await Promise.all(
        batch.map(async (ch) => {
          const chunkPayload: CloudChunkRecord = {
            vaultKey,
            chunkId: ch.chunkId,
            chunkType: ch.chunkType,
            chunkIndex: ch.chunkIndex,
            version: safeVersion,
            updatedAtIso: nowIso,
            payloadJson: ch.payloadJson
          };
          if (!options?.strictRuleCompatibleManifest) {
            chunkPayload.sha256 = ch.sha256;
          }
          await store.setChunk(vaultKey, ch.chunkId, chunkPayload);
        })
      );
    } catch (chunkErr: any) {
      return {
        committed: false,
        version: safeVersion,
        chunkCount: allChunks.length,
        workOrderCount: ordersList.length,
        failedChunkId: batch[0]?.chunkId,
        error: `Chunk write failed: ${chunkErr?.message || String(chunkErr)}`
      };
    }
  }

  // 4. Pre-Commit Read-Back & Cryptographic SHA-256 Verification in parallel batches
  // Verify that every single staged chunk exists in the store and its SHA-256 matches before committing manifest!
  for (let i = 0; i < allChunks.length; i += CONCURRENCY) {
    const batch = allChunks.slice(i, i + CONCURRENCY);
    const verifiedBatch = await Promise.all(
      batch.map(async (ch) => {
        const verifiedChunk = await store.getChunk(vaultKey, ch.chunkId);
        return { ch, verifiedChunk };
      })
    );
    for (const { ch, verifiedChunk } of verifiedBatch) {
      if (!verifiedChunk || typeof verifiedChunk.payloadJson !== 'string') {
        return {
          committed: false,
          version: safeVersion,
          chunkCount: allChunks.length,
          workOrderCount: ordersList.length,
          failedChunkId: ch.chunkId,
          error: `Pre-commit verification failed: Chunk ${ch.chunkId} missing on read-back`
        };
      }
      const actualSha = computeSha256(verifiedChunk.payloadJson);
      if (actualSha !== ch.sha256) {
        return {
          committed: false,
          version: safeVersion,
          chunkCount: allChunks.length,
          workOrderCount: ordersList.length,
          failedChunkId: ch.chunkId,
          error: `Pre-commit verification failed: SHA-256 mismatch on chunk ${ch.chunkId} (expected ${ch.sha256}, got ${actualSha})`
        };
      }
    }
  }

  // 5. Commit Authoritative Manifest ONLY after all chunks are verified
  const finalManifest: CloudManifestRecord = {
    vaultKey,
    version: safeVersion,
    updatedAtIso: nowIso,
    workOrderCount: ordersList.length,
    tableCount: (data.monthTables || []).length,
    userCount: coreObject.users.length,
    chunkCount: allChunks.length,
    chunkIds,
    coreJson
  };
  if (!options?.strictRuleCompatibleManifest) {
    finalManifest.coreSha256 = coreSha256;
    finalManifest.chunkChecksums = chunkChecksums;
  }

  try {
    await store.setManifest(vaultKey, finalManifest);
  } catch (manifestErr: any) {
    return {
      committed: false,
      version: safeVersion,
      chunkCount: allChunks.length,
      workOrderCount: ordersList.length,
      error: `Manifest write failed: ${manifestErr?.message || String(manifestErr)}`
    };
  }

  return {
    committed: true,
    version: safeVersion,
    chunkCount: allChunks.length,
    workOrderCount: ordersList.length,
    coreSha256,
    chunkChecksums
  };
}

/**
 * Loads the authoritative database state from the cloud store, verifying every chunk's
 * existence and SHA-256 checksum, and reassembling all detached attachments.
 */
export async function loadDatabaseFromCloudStore(
  store: CloudStoreAdapter,
  vaultKey: string = 'sec_qcms_v2_831300_321_perm'
): Promise<{
  loaded: boolean;
  success: boolean;
  data?: CloudDatabaseSchema;
  db?: CloudDatabaseSchema;
  manifest?: CloudManifestRecord & {
    workOrdersCount: number;
    totalAttachmentsCount: number;
    attachmentChunkIds: string[];
  };
  version?: number;
  updatedAtIso?: string;
  verifiedChunksCount?: number;
  error?: string;
}> {
  const manifest = await store.getManifest(vaultKey);
  if (!manifest) {
    return { loaded: false, success: false };
  }

  const core = JSON.parse(manifest.coreJson || '{}');
  if (manifest.coreSha256) {
    const actualCoreSha = computeSha256(manifest.coreJson || '');
    if (actualCoreSha !== manifest.coreSha256) {
      throw new Error(`Manifest coreJson SHA-256 mismatch: expected ${manifest.coreSha256}, got ${actualCoreSha}`);
    }
  }

  const expectedChecksums: Record<string, string> =
    manifest.chunkChecksums || core.__integrity?.chunkChecksums || {};
  const chunkIds: string[] = Array.isArray(manifest.chunkIds) ? manifest.chunkIds : [];

  const lightweightOrders: WorkOrder[] = [];
  const attachmentSlices: any[] = [];
  const loadedReports: ArchivedReportSnapshot[] = [];
  const attachmentChunkIds: string[] = [];

  const LOAD_CONCURRENCY = 20;
  const loadedChunksOrdered: Array<{ chunkId: string; chData: CloudChunkRecord | null }> = [];
  for (let i = 0; i < chunkIds.length; i += LOAD_CONCURRENCY) {
    const batchIds = chunkIds.slice(i, i + LOAD_CONCURRENCY);
    const batchResults = await Promise.all(
      batchIds.map(async (chunkId) => {
        const chData = await store.getChunk(vaultKey, chunkId);
        return { chunkId, chData };
      })
    );
    loadedChunksOrdered.push(...batchResults);
  }

  for (const { chunkId, chData } of loadedChunksOrdered) {
    if (!chData) {
      throw new Error(`Integrity Error: Referenced chunk ${chunkId} is missing from cloud store`);
    }
    const expectedSha = expectedChecksums[chunkId] || chData.sha256;
    if (expectedSha) {
      const actualSha = computeSha256(chData.payloadJson || '');
      if (actualSha !== expectedSha) {
        throw new Error(`Integrity Error: Chunk ${chunkId} SHA-256 mismatch (expected ${expectedSha}, got ${actualSha})`);
      }
    }

    const parsedSlice = JSON.parse(chData.payloadJson || '[]');
    if (Array.isArray(parsedSlice)) {
      if (chData.chunkType === 'workOrders') {
        lightweightOrders.push(...parsedSlice);
      } else if (chData.chunkType === 'customTemplate') {
        attachmentChunkIds.push(chunkId);
        attachmentSlices.push(...parsedSlice);
      } else if (chData.chunkType === 'extraCore') {
        loadedReports.push(...parsedSlice);
      }
    }
  }

  const { orders: reassembledOrders, missingAttachments } = reassembleAttachmentsIntoOrders(
    lightweightOrders,
    attachmentSlices
  );
  if (missingAttachments.length > 0) {
    throw new Error(`Integrity Error: Missing attachment slices during reassembly: ${missingAttachments.join(', ')}`);
  }

  const uniqueAttKeys = new Set(attachmentSlices.map((s) => s?.attKey).filter(Boolean));
  const totalAttachmentsCount = core.__integrity?.totalAttachmentsCount ?? uniqueAttKeys.size;

  const activeOrderIds = new Set(reassembledOrders.map((w) => w.id));
  const cleanDeletedIds = (Array.isArray(core.deletedOrderIds) ? core.deletedOrderIds : []).filter(
    (id: string) => id && !activeOrderIds.has(id)
  );

  const cloudData: CloudDatabaseSchema = {
    workOrders: reassembledOrders,
    offices: Array.isArray(core.offices) && core.offices.length > 0 ? core.offices : INITIAL_OFFICES,
    columns: Array.isArray(core.columns) && core.columns.length > 0 ? core.columns : INITIAL_COLUMNS,
    dropdownOptions: core.dropdownOptions || INITIAL_DROPDOWN_OPTIONS,
    monthTables: Array.isArray(core.monthTables) ? core.monthTables : [],
    archivedReports: loadedReports,
    deletedOrderIds: cleanDeletedIds,
    lastClearedAt: reassembledOrders.length > 0 ? undefined : core.lastClearedAt || undefined,
    notificationsLog: Array.isArray(core.notificationsLog) ? core.notificationsLog : [],
    users: ensureDefaultSuperAdmins(Array.isArray(core.users) ? core.users : DEFAULT_SUPER_ADMIN_USERS),
    smtpSettings: core.smtpSettings || undefined
  };

  return {
    loaded: true,
    success: true,
    data: cloudData,
    db: cloudData,
    manifest: {
      ...manifest,
      workOrdersCount: manifest.workOrderCount ?? reassembledOrders.length,
      totalAttachmentsCount,
      attachmentChunkIds
    },
    version: Number(manifest.version) || Date.now(),
    updatedAtIso: manifest.updatedAtIso,
    verifiedChunksCount: chunkIds.length
  };
}
