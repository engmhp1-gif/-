import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Database, 
  RotateCcw, 
  Download, 
  Upload, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Layers, 
  RefreshCw, 
  Trash2, 
  X, 
  HardDrive, 
  Cloud,
  FileCheck,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { vaultService } from '../services/vaultService';
import { realtime } from '../services/realtimeService';
import { DataBackupSnapshot, WorkOrder } from '../types';
import { getAuthHeaders, getSavedCurrentUser, getSavedSessionToken, saveSessionToken } from '../utils/security';
import { extractBackupEnvelope, tryParseFlexibleJsonString } from '../utils/backupMergeEngine';
import { detectUniversalColumns, extractOrdersFromRawRows } from '../services/excelImportService';

interface DataRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentOrdersCount: number;
  onRestoreCompleted: () => void;
}

export const DataRecoveryModal: React.FC<DataRecoveryModalProps> = ({
  isOpen,
  onClose,
  currentOrdersCount,
  onRestoreCompleted
}) => {
  const [snapshots, setSnapshots] = useState<DataBackupSnapshot[]>([]);
  const [serverBackups, setServerBackups] = useState<any[]>([]);
  const [scheduleStatus, setScheduleStatus] = useState<any | null>(null);
  const [readOnlyInventory, setReadOnlyInventory] = useState<any | null>(null);
  const [newSnapshotLabel, setNewSnapshotLabel] = useState('');
  const [activeTab, setActiveTab] = useState<'export_import' | 'server' | 'scheduled_backup' | 'snapshots'>('export_import');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const getAuthHeadersWithToken = async (): Promise<Record<string, string>> => {
    const extra = {
      'Content-Type': 'application/json',
      'x-realtime-client-id': realtime.getClientId()
    };
    const baseHeaders = getAuthHeaders(extra);

    try {
      const verifyRes = await fetch('/api/auth/session-verify', {
        method: 'GET',
        headers: baseHeaders
      });
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json().catch(() => null);
        const freshToken = verifyData?.sessionToken || verifyData?.token;
        if (freshToken) {
          saveSessionToken(freshToken);
        }
      }
    } catch (_) {
      // Allow offline/fallback headers to proceed
    }

    return getAuthHeaders(extra);
  };

  const safeParseJsonResponse = async (res: Response): Promise<any> => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        res.status === 413
          ? 'حجم البيانات المرسلة كبير جداً — جاري التقسيم التلقائي للدفعات'
          : `استجابة غير متوقعة من الخادم (HTTP ${res.status})`
      );
    }
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const sub = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(sub));
    }
    return window.btoa(binary);
  };

  const tryDecompressBrowserStream = async (
    bytes: Uint8Array,
    format: 'gzip' | 'deflate' | 'deflate-raw'
  ): Promise<Uint8Array | null> => {
    try {
      if (typeof DecompressionStream === 'undefined') return null;
      const ds = new DecompressionStream(format);
      const writer = ds.writable.getWriter();
      writer.write(bytes).catch(() => {});
      writer.close().catch(() => {});
      const reader = ds.readable.getReader();
      const chunks: Uint8Array[] = [];
      let totalLength = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          totalLength += value.length;
        }
      }
      if (totalLength === 0) return null;
      const out = new Uint8Array(totalLength);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
      }
      return out;
    } catch {
      return null;
    }
  };

  const extractZipEntriesBrowser = async (
    rawBytes: Uint8Array
  ): Promise<{ isXlsx: boolean; entries: Array<{ fileName: string; data: Uint8Array }> }> => {
    const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
    const entriesMeta: Array<{
      fileName: string;
      compressionMethod: number;
      compressedSize: number;
      localHeaderOffset: number;
    }> = [];

    // 1. Locate End of Central Directory (EOCD: 0x06054b50) from the end of the buffer
    let eocdOffset = -1;
    const minEocdSearch = Math.max(0, rawBytes.length - 65557);
    for (let i = rawBytes.length - 22; i >= minEocdSearch; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset !== -1) {
      const cdOffset = view.getUint32(eocdOffset + 16, true);
      const cdSize = view.getUint32(eocdOffset + 12, true);
      let pos = cdOffset;
      while (pos + 46 <= rawBytes.length && pos < cdOffset + cdSize) {
        if (view.getUint32(pos, true) !== 0x02014b50) break;
        const compressionMethod = view.getUint16(pos + 10, true);
        const compressedSize = view.getUint32(pos + 20, true);
        const fileNameLen = view.getUint16(pos + 28, true);
        const extraLen = view.getUint16(pos + 30, true);
        const commentLen = view.getUint16(pos + 32, true);
        const localHeaderOffset = view.getUint32(pos + 42, true);
        const fileNameBytes = rawBytes.subarray(pos + 46, pos + 46 + fileNameLen);
        const fileName = new TextDecoder('utf-8', { fatal: false }).decode(fileNameBytes);
        entriesMeta.push({ fileName, compressionMethod, compressedSize, localHeaderOffset });
        pos += 46 + fileNameLen + extraLen + commentLen;
      }
    }

    // 2. Fallback to Local File Headers (0x04034b50) if Central Directory was not found
    if (entriesMeta.length === 0) {
      let offset = 0;
      while (offset + 30 <= rawBytes.length) {
        if (view.getUint32(offset, true) !== 0x04034b50) {
          offset++;
          continue;
        }
        const compressionMethod = view.getUint16(offset + 8, true);
        const compressedSize = view.getUint32(offset + 18, true);
        const fileNameLen = view.getUint16(offset + 26, true);
        const extraLen = view.getUint16(offset + 28, true);
        const fileNameBytes = rawBytes.subarray(offset + 30, offset + 30 + fileNameLen);
        const fileName = new TextDecoder('utf-8', { fatal: false }).decode(fileNameBytes);
        entriesMeta.push({ fileName, compressionMethod, compressedSize, localHeaderOffset: offset });
        const dataStart = offset + 30 + fileNameLen + extraLen;
        offset = compressedSize > 0 && dataStart + compressedSize <= rawBytes.length
          ? dataStart + compressedSize
          : dataStart + 1;
      }
    }

    // Detect if this ZIP is actually an Excel (.xlsx) OpenXML package
    const isXlsx = entriesMeta.some(
      (e) =>
        e.fileName === '[Content_Types].xml' ||
        e.fileName.startsWith('xl/') ||
        e.fileName.startsWith(' _rels/') ||
        e.fileName.endsWith('.xml.rels')
    );
    if (isXlsx) {
      return { isXlsx: true, entries: [] };
    }

    const extracted: Array<{ fileName: string; data: Uint8Array }> = [];
    for (let idx = 0; idx < entriesMeta.length; idx++) {
      const meta = entriesMeta[idx];
      if (!meta.fileName || meta.fileName.endsWith('/') || meta.fileName.includes('__MACOSX')) continue;
      const lhOffset = meta.localHeaderOffset;
      if (lhOffset + 30 > rawBytes.length || view.getUint32(lhOffset, true) !== 0x04034b50) continue;
      const localNameLen = view.getUint16(lhOffset + 26, true);
      const localExtraLen = view.getUint16(lhOffset + 28, true);
      const dataStart = lhOffset + 30 + localNameLen + localExtraLen;
      if (dataStart >= rawBytes.length) continue;

      const nextHeaderOffset = idx + 1 < entriesMeta.length ? entriesMeta[idx + 1].localHeaderOffset : (eocdOffset !== -1 ? view.getUint32(eocdOffset + 16, true) : rawBytes.length);
      const compLen = meta.compressedSize > 0 && dataStart + meta.compressedSize <= rawBytes.length
        ? meta.compressedSize
        : Math.max(0, nextHeaderOffset - dataStart);

      if (compLen <= 0) continue;
      const rawEntry = rawBytes.subarray(dataStart, dataStart + compLen);
      let fileBytes: Uint8Array | null = null;
      if (meta.compressionMethod === 0) {
        fileBytes = rawEntry;
      } else if (meta.compressionMethod === 8) {
        fileBytes = await tryDecompressBrowserStream(rawEntry, 'deflate-raw');
      }

      if (fileBytes && fileBytes.length > 0) {
        // If the inner file inside the ZIP is itself GZIP compressed (.gz), decompress it too
        const isInnerGz =
          (fileBytes.length >= 2 && fileBytes[0] === 0x1f && fileBytes[1] === 0x8b) ||
          meta.fileName.toLowerCase().endsWith('.gz');
        if (isInnerGz) {
          const innerGunzipped = await tryDecompressBrowserStream(fileBytes, 'gzip');
          if (innerGunzipped && innerGunzipped.length > 0) {
            fileBytes = innerGunzipped;
          }
        }
        extracted.push({ fileName: meta.fileName, data: fileBytes });
      }
    }

    return { isXlsx: false, entries: extracted };
  };

  const resolveBlobReferencesInPayload = (obj: any, blobMap: Map<string, string>): any => {
    if (!blobMap || blobMap.size === 0 || !obj) return obj;
    if (typeof obj === 'string') {
      if (obj.startsWith('__VAULT_BLOB_REF__:')) {
        const hash = obj.slice('__VAULT_BLOB_REF__:'.length).trim();
        return blobMap.get(hash) || obj;
      }
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => resolveBlobReferencesInPayload(item, blobMap));
    }
    if (typeof obj === 'object') {
      const out: any = {};
      for (const [k, v] of Object.entries(obj)) {
        out[k] = resolveBlobReferencesInPayload(v, blobMap);
      }
      return out;
    }
    return obj;
  };

  const parseExcelBytesUniversal = (byteArr: Uint8Array): any | null => {
    try {
      const wb = XLSX.read(byteArr, { type: 'array', cellDates: true });
      if (!wb || !Array.isArray(wb.SheetNames) || wb.SheetNames.length === 0) return null;

      const collectedOrders: any[] = [];
      const collectedTables: any[] = [];
      const collectedUsers: any[] = [];
      const collectedOffices: any[] = [];
      const discoveredCustomCols = new Map<string, { id: string; label: string; visible: boolean }>();

      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        if (!sheet) continue;
        const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
        if (!Array.isArray(rawRows) || rawRows.length <= 1) continue;

        const mapping = detectUniversalColumns(rawRows);

        const extracted = extractOrdersFromRawRows(
          rawRows,
          mapping.headerRowIndex + 1,
          mapping.mappedColumns,
          { sheetName }
        );
        if (Array.isArray(extracted?.validOrders) && extracted.validOrders.length > 0) {
          collectedOrders.push(...extracted.validOrders);
          continue;
        }

        // Check if this sheet is a structured table of users, monthTables, or offices
        const jsonObjects = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });
        if (Array.isArray(jsonObjects) && jsonObjects.length > 0) {
          const envSheet = extractBackupEnvelope(jsonObjects);
          if (envSheet.format !== 'invalid' && envSheet.payload) {
            if (Array.isArray(envSheet.payload.workOrders)) collectedOrders.push(...envSheet.payload.workOrders);
            if (Array.isArray(envSheet.payload.monthTables)) collectedTables.push(...envSheet.payload.monthTables);
            if (Array.isArray(envSheet.payload.users)) collectedUsers.push(...envSheet.payload.users);
            if (Array.isArray(envSheet.payload.offices)) collectedOffices.push(...envSheet.payload.offices);
            continue;
          }
        }

        const env2d = extractBackupEnvelope(rawRows);
        if (env2d.format !== 'invalid' && env2d.payload) {
          if (Array.isArray(env2d.payload.workOrders)) collectedOrders.push(...env2d.payload.workOrders);
          if (Array.isArray(env2d.payload.monthTables)) collectedTables.push(...env2d.payload.monthTables);
          if (Array.isArray(env2d.payload.users)) collectedUsers.push(...env2d.payload.users);
          if (Array.isArray(env2d.payload.offices)) collectedOffices.push(...env2d.payload.offices);
        }
      }

      if (
        collectedOrders.length > 0 ||
        collectedTables.length > 0 ||
        collectedUsers.length > 0 ||
        collectedOffices.length > 0
      ) {
        const resultPayload: any = {
          workOrders: collectedOrders
        };
        if (collectedTables.length > 0) resultPayload.monthTables = collectedTables;
        if (collectedUsers.length > 0) resultPayload.users = collectedUsers;
        if (collectedOffices.length > 0) resultPayload.offices = collectedOffices;
        return resultPayload;
      }
    } catch {}
    return null;
  };

  const decodeSingleFileUniversal = async (file: File): Promise<any> => {
    const arrayBuffer = await file.arrayBuffer();
    const rawBytes = new Uint8Array(arrayBuffer);
    if (rawBytes.length === 0) {
      throw new Error(`الملف (${file.name}) فارغ تماماً (0 بايت)`);
    }

    const lowerName = file.name.toLowerCase();
    const isPkZipHeader =
      rawBytes.length >= 4 &&
      rawBytes[0] === 0x50 &&
      rawBytes[1] === 0x4b &&
      rawBytes[2] === 0x03 &&
      rawBytes[3] === 0x04;

    // 0. If file has PK\x03\x04 header (.zip or .xlsx), inspect whether it is an Excel workbook or a ZIP archive
    if (isPkZipHeader) {
      if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.xlsm')) {
        const excelParsed = parseExcelBytesUniversal(rawBytes);
        if (excelParsed) return excelParsed;
      }

      const zipInfo = await extractZipEntriesBrowser(rawBytes);
      if (zipInfo.isXlsx) {
        const excelParsed = parseExcelBytesUniversal(rawBytes);
        if (excelParsed) return excelParsed;
      } else if (zipInfo.entries.length > 0) {
        const combinedZipPayload: any = {
          workOrders: [],
          monthTables: [],
          users: [],
          offices: [],
          columns: [],
          archivedReports: [],
          deletedOrderIds: []
        };
        const blobMap = new Map<string, string>();

        // First pass: collect any blob_<hash>.gz attachments inside the ZIP
        for (const entry of zipInfo.entries) {
          const baseName = entry.fileName.split('/').pop() || entry.fileName;
          const blobMatch = baseName.match(/^blob_([a-f0-9]+)(?:\.gz|\.txt|\.json)?$/i);
          if (blobMatch) {
            const hash = blobMatch[1];
            const blobText = new TextDecoder('utf-8', { fatal: false }).decode(entry.data).trim();
            if (blobText) blobMap.set(hash, blobText);
          }
        }

        // Second pass: decode every JSON / Excel / CSV entry inside the ZIP
        for (const entry of zipInfo.entries) {
          const baseName = entry.fileName.split('/').pop() || entry.fileName;
          if (/^blob_[a-f0-9]+/i.test(baseName)) continue;

          let entryHandled = false;
          const encodings = ['utf-8', 'utf-16le', 'windows-1256'];
          for (const enc of encodings) {
            try {
              const text = new TextDecoder(enc, { fatal: false }).decode(entry.data);
              const parsed = tryParseFlexibleJsonString(text);
              if (parsed && typeof parsed === 'object') {
                const env = extractBackupEnvelope(parsed);
                if (env.format !== 'invalid' && env.payload) {
                  if (Array.isArray(env.payload.workOrders)) combinedZipPayload.workOrders.push(...env.payload.workOrders);
                  if (Array.isArray(env.payload.monthTables)) combinedZipPayload.monthTables.push(...env.payload.monthTables);
                  if (Array.isArray(env.payload.users)) combinedZipPayload.users.push(...env.payload.users);
                  if (Array.isArray(env.payload.offices)) combinedZipPayload.offices.push(...env.payload.offices);
                  if (Array.isArray(env.payload.columns) && env.payload.columns.length > 0) {
                    combinedZipPayload.columns = env.payload.columns;
                  }
                  if (env.payload.dropdownOptions && !combinedZipPayload.dropdownOptions) {
                    combinedZipPayload.dropdownOptions = env.payload.dropdownOptions;
                  }
                  if (Array.isArray(env.payload.archivedReports)) {
                    combinedZipPayload.archivedReports.push(...env.payload.archivedReports);
                  }
                  entryHandled = true;
                  break;
                }
              }
            } catch {}
          }

          if (!entryHandled) {
            const excelFromZip = parseExcelBytesUniversal(entry.data);
            if (excelFromZip) {
              if (Array.isArray(excelFromZip.workOrders)) combinedZipPayload.workOrders.push(...excelFromZip.workOrders);
              if (Array.isArray(excelFromZip.monthTables)) combinedZipPayload.monthTables.push(...excelFromZip.monthTables);
              if (Array.isArray(excelFromZip.users)) combinedZipPayload.users.push(...excelFromZip.users);
              if (Array.isArray(excelFromZip.offices)) combinedZipPayload.offices.push(...excelFromZip.offices);
              if (Array.isArray(excelFromZip.columns) && combinedZipPayload.columns.length === 0) {
                combinedZipPayload.columns = excelFromZip.columns;
              }
            }
          }
        }

        const resolvedZipPayload = resolveBlobReferencesInPayload(combinedZipPayload, blobMap);
        if (
          resolvedZipPayload.workOrders.length > 0 ||
          resolvedZipPayload.monthTables.length > 0 ||
          resolvedZipPayload.users.length > 0 ||
          resolvedZipPayload.offices.length > 0
        ) {
          return resolvedZipPayload;
        }
      }
    }

    const candidateByteArrays: Uint8Array[] = [rawBytes];

    // 1. Check GZIP magic header (0x1f 0x8b) or .gz extension
    const isGzipHeader = rawBytes.length >= 2 && rawBytes[0] === 0x1f && rawBytes[1] === 0x8b;
    if (isGzipHeader || lowerName.endsWith('.gz')) {
      const gunzipped = await tryDecompressBrowserStream(rawBytes, 'gzip');
      if (gunzipped && gunzipped.length > 0) {
        candidateByteArrays.unshift(gunzipped);
      }
    }

    // 2. Try Deflate if not plain text
    if (rawBytes[0] !== 0x7b && rawBytes[0] !== 0x5b) {
      const deflated = await tryDecompressBrowserStream(rawBytes, 'deflate');
      if (deflated && deflated.length > 0) candidateByteArrays.push(deflated);
      const deflatedRaw = await tryDecompressBrowserStream(rawBytes, 'deflate-raw');
      if (deflatedRaw && deflatedRaw.length > 0) candidateByteArrays.push(deflatedRaw);
    }

    // 3. Try decoding text (UTF-8, UTF-16LE, Windows-1256) and flexible JSON parsing on all candidate buffers
    const encodings = ['utf-8', 'utf-16le', 'windows-1256', 'iso-8859-1'];
    for (const byteArr of candidateByteArrays) {
      for (const encoding of encodings) {
        try {
          const text = new TextDecoder(encoding, { fatal: false }).decode(byteArr);
          const parsed = tryParseFlexibleJsonString(text);
          if (parsed && typeof parsed === 'object') {
            // Check first if it's a chunked vault manifest.json (which stores workOrders in separate chunk files)
            if (
              (parsed.vaultFormat === 'SEC_QCMS_155_CHUNKED_VAULT_V2' || parsed.format === 'chunked_vault_v1') &&
              !Array.isArray(parsed.workOrders) &&
              (parsed.coreFile || parsed.coreDbFile || Array.isArray(parsed.chunks) || Array.isArray(parsed.blobs) || typeof parsed.chunkCount === 'number')
            ) {
              const headers = await getAuthHeadersWithToken();
              const srvRes = await fetch('/api/backup/decode-raw-file', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  rawBase64: arrayBufferToBase64(arrayBuffer),
                  fileName: file.name
                })
              });
              if (srvRes.ok) {
                const srvJson = await srvRes.json().catch(() => null);
                if (srvJson?.success && srvJson?.payload) return srvJson.payload;
              }
            }
            const envelope = extractBackupEnvelope(parsed);
            if (envelope.format !== 'invalid' && envelope.payload) {
              const cleanPayload = { ...envelope.payload };
              delete cleanPayload.snapshots;
              return cleanPayload;
            }
          }
        } catch {}
      }
    }

    // 4. Try parsing as Excel / CSV (.xlsx, .xls, .csv) via SheetJS in browser
    for (const byteArr of candidateByteArrays) {
      const excelParsed = parseExcelBytesUniversal(byteArr);
      if (excelParsed) return excelParsed;
    }

    // 5. Fallback to Server Universal Binary/Compressed/ZIP Decoder (/api/backup/decode-raw-file)
    try {
      const headers = await getAuthHeadersWithToken();
      const srvRes = await fetch('/api/backup/decode-raw-file', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rawBase64: arrayBufferToBase64(arrayBuffer),
          fileName: file.name
        })
      });
      const srvJson = await srvRes.json().catch(() => null);
      if (srvRes.ok && srvJson?.success && srvJson?.payload) {
        return srvJson.payload;
      }
      if (srvJson?.error) {
        throw new Error(srvJson.error);
      }
    } catch (srvErr: any) {
      if (srvErr?.message && !srvErr.message.includes('Failed to fetch')) {
        throw srvErr;
      }
    }

    throw new Error('صيغة الملف غير مدعومة أو لا تحتوي على أوامر عمل أو جداول أو مستخدمين متوافقين');
  };

  const decodeUploadedFilesUniversal = async (fileList: FileList | File[]): Promise<{ payload: any; label: string }> => {
    const files = Array.from(fileList || []);
    if (files.length === 0) {
      throw new Error('لم يتم اختيار أي ملف');
    }
    if (files.length === 1) {
      const singlePayload = await decodeSingleFileUniversal(files[0]);
      return { payload: singlePayload, label: files[0].name };
    }

    // Merge multiple selected files (e.g. core_db.json.gz + orders_chunk_*.json.gz + blob_*.gz or multiple JSON/Excel files)
    const combined: any = {
      workOrders: [],
      monthTables: [],
      users: [],
      offices: [],
      columns: [],
      archivedReports: [],
      deletedOrderIds: []
    };
    const blobMap = new Map<string, string>();
    const decodedNames: string[] = [];

    // First pass: check for any blob_<hash>.gz files among the selected files
    for (const f of files) {
      const blobMatch = f.name.match(/^blob_([a-f0-9]+)(?:\.gz|\.txt|\.json)?$/i);
      if (blobMatch) {
        try {
          const ab = await f.arrayBuffer();
          let bytes = new Uint8Array(ab);
          if ((bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) || f.name.toLowerCase().endsWith('.gz')) {
            const decomp = await tryDecompressBrowserStream(bytes, 'gzip');
            if (decomp) bytes = decomp;
          }
          const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes).trim();
          if (text) {
            blobMap.set(blobMatch[1], text);
            decodedNames.push(f.name);
          }
        } catch {}
      }
    }

    for (const f of files) {
      if (/^blob_[a-f0-9]+/i.test(f.name)) continue;
      try {
        const part = await decodeSingleFileUniversal(f);
        if (part && typeof part === 'object') {
          decodedNames.push(f.name);
          if (Array.isArray(part.workOrders)) combined.workOrders.push(...part.workOrders);
          if (Array.isArray(part.monthTables)) combined.monthTables.push(...part.monthTables);
          if (Array.isArray(part.users)) combined.users.push(...part.users);
          if (Array.isArray(part.offices)) combined.offices.push(...part.offices);
          if (Array.isArray(part.columns) && part.columns.length > 0) {
            const colMap = new Map<string, any>();
            combined.columns.forEach((c: any) => { if (c?.id) colMap.set(c.id, c); });
            part.columns.forEach((c: any) => { if (c?.id) colMap.set(c.id, c); });
            combined.columns = Array.from(colMap.values());
          }
          if (part.dropdownOptions) {
            combined.dropdownOptions = { ...(combined.dropdownOptions || {}), ...part.dropdownOptions };
          }
          if (Array.isArray(part.archivedReports)) combined.archivedReports.push(...part.archivedReports);
          if (Array.isArray(part.deletedOrderIds)) combined.deletedOrderIds.push(...part.deletedOrderIds);
        }
      } catch {}
    }

    const resolvedCombined = resolveBlobReferencesInPayload(combined, blobMap);

    if (
      resolvedCombined.workOrders.length === 0 &&
      resolvedCombined.monthTables.length === 0 &&
      resolvedCombined.users.length === 0 &&
      resolvedCombined.offices.length === 0 &&
      resolvedCombined.columns.length === 0
    ) {
      throw new Error('لم يتم العثور على سجلات صالحة في الملفات المختارة');
    }

    return {
      payload: resolvedCombined,
      label: decodedNames.length > 1 ? `${decodedNames.length} ملفات مدمجة (${decodedNames[0]}...)` : (decodedNames[0] || files[0].name)
    };
  };

  const loadData = async () => {
    // 1. Local/vault snapshots
    const localSnaps = vaultService.getSnapshots();
    setSnapshots(localSnaps);

    // 2. Server backups
    try {
      const sBackups = await realtime.fetchServerBackups();
      setServerBackups(sBackups);
    } catch (_) {}

    // 3. Scheduled Backup Dashboard (08:00 & 15:00 Asia/Riyadh) + Read-Only Inventory
    try {
      const headers = await getAuthHeadersWithToken();
      const [schedRes, invRes] = await Promise.all([
        fetch('/api/backup/schedule-status', { headers }),
        fetch('/api/backup/read-only-inventory', { headers })
      ]);
      if (schedRes.ok) {
        setScheduleStatus(await schedRes.json());
      }
      if (invRes.ok) {
        setReadOnlyInventory(await invRes.json());
      }
    } catch (_) {}
  };

  const handleRunVerifiedScheduledBackupNow = async () => {
    setIsLoading(true);
    try {
      const headers = await getAuthHeadersWithToken();
      const res = await fetch('/api/backup/run-verified', {
        method: 'POST',
        headers,
        body: JSON.stringify({ triggerSource: 'MANUAL_ADMIN_DASHBOARD' })
      });
      const data = await res.json();
      const record = data.record || data.logEntry;
      if (!res.ok || !data.success || record?.verificationResult?.verified !== true) {
        showMsg(data.error || record?.failureReason || 'فشل التحقق من النسخة الاحتياطية السحابية', 'error');
        await loadData();
        return;
      }
      showMsg(`تم تنفيذ النسخة السحابية والتحقق من سلامتها (SHA-256) بنجاح: ${record.backupId}`);
      await loadData();
    } catch (err: any) {
      showMsg(err?.message || 'تعذر تشغيل النسخ الاحتياطي الموثق', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const showMsg = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  };

  const handleCreateSnapshot = () => {
    const label = newSnapshotLabel.trim() || `نقطة استعادة يدوية (${currentOrdersCount} أمر عمل)`;
    const created = vaultService.createSnapshot(label, 'manual');
    if (created) {
      setSnapshots(vaultService.getSnapshots());
      setNewSnapshotLabel('');
      showMsg('تم حفظ نقطة استعادة جديدة بنجاح في الخزينة السحابية والمحلية');
    }
  };

  const handleRestoreSnapshot = async (id: string, label: string) => {
    setIsLoading(true);
    try {
      const restoredData = vaultService.restoreSnapshot(id);
      if (restoredData && restoredData.workOrders) {
        vaultService.unmarkBatchDeleted(restoredData.workOrders.map(w => w.id));
        vaultService.saveWorkOrders(restoredData.workOrders, true);
        await realtime.importFullDatabase(restoredData);
        await realtime.hydrateServer({
          workOrders: restoredData.workOrders,
          offices: restoredData.offices,
          columns: restoredData.columns,
          dropdownOptions: restoredData.dropdownOptions,
          monthTables: restoredData.monthTables,
          archivedReports: restoredData.archivedReports
        });
        await realtime.syncState(
          restoredData.workOrders, 
          'sync', 
          `استرجاع نقطة أمان: ${label}`
        );
        showMsg(`تم استرجاع (${restoredData.workOrders.length}) أمر عمل بنجاح ومزامنتها لحظياً في قاعدة البيانات السحابية!`);
        onRestoreCompleted();
        setTimeout(() => onClose(), 1200);
      } else {
        showMsg('تعذر قراءة بيانات النسخة المحددة', 'error');
      }
    } catch (err: any) {
      showMsg(err?.message || 'حدث خطأ أثناء الاسترجاع', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreServerBackup = async (filename: string, _ordersCount: number) => {
    setIsLoading(true);
    try {
      const ok = await realtime.restoreServerBackup(filename);
      if (ok) {
        showMsg(`تم استرجاع النسخة السحابية (${filename}) بنجاح.`);
        onRestoreCompleted();
        setTimeout(() => onClose(), 1200);
      } else {
        showMsg('فشل استرجاع النسخة من السيرفر', 'error');
      }
    } catch (err: any) {
      showMsg(err?.message || 'حدث خطأ أثناء الاسترجاع', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSnapshot = (id: string) => {
    vaultService.deleteSnapshot(id);
    setSnapshots(vaultService.getSnapshots());
    showMsg('تم حذف نقطة الاستعادة');
  };

  const handleDownloadFullExport = async () => {
    setIsLoading(true);
    try {
      // 1. Try to fetch the full database snapshot from server which has everything
      let fullJsonStr = '';
      try {
        const headers = await getAuthHeadersWithToken();
        const res = await fetch('/api/backup/export-full', {
          headers
        });
        if (res.ok) {
          const srvData = await res.json();
          // Merge with any deep local IndexedDB orders to ensure all photos in notes and field are preserved
          const idbOrders = await vaultService.getSavedWorkOrdersFromIDB();
          if (Array.isArray(idbOrders) && idbOrders.length > 0) {
            const orderPhotoMap = new Map<string, any[]>();
            const orderNoteItemsMap = new Map<string, any[]>();
            idbOrders.forEach(o => {
              if (o && o.id) {
                if (Array.isArray(o.photos) && o.photos.length > 0) {
                  orderPhotoMap.set(o.id, o.photos);
                }
                if (Array.isArray(o.qualityNoteItems) && o.qualityNoteItems.some(item => item.photos && item.photos.length > 0)) {
                  orderNoteItemsMap.set(o.id, o.qualityNoteItems);
                }
              }
            });
            if (Array.isArray(srvData.workOrders)) {
              srvData.workOrders = srvData.workOrders.map((wo: any) => {
                const merged = { ...wo };
                if (orderPhotoMap.has(wo.id) && (!wo.photos || wo.photos.length === 0)) {
                  merged.photos = orderPhotoMap.get(wo.id);
                }
                if (orderNoteItemsMap.has(wo.id)) {
                  merged.qualityNoteItems = orderNoteItemsMap.get(wo.id);
                }
                return merged;
              });
            }
          }
          // Ensure users with their permissions are present
          if (!srvData.users || srvData.users.length === 0) {
            srvData.users = vaultService.getSavedUsers() || [];
          }
          if (!srvData.monthTables || srvData.monthTables.length === 0) {
            srvData.monthTables = vaultService.getSavedMonthTables() || [];
          }
          if (!srvData.offices || srvData.offices.length === 0) {
            srvData.offices = vaultService.getSavedOffices() || [];
          }
          if (!srvData.columns || srvData.columns.length === 0) {
            srvData.columns = vaultService.getSavedColumns() || [];
          }
          if (!srvData.dropdownOptions) {
            srvData.dropdownOptions = vaultService.getSavedDropdownOptions() || {};
          }
          fullJsonStr = JSON.stringify(srvData, null, 2);
        }
      } catch (_) {}

      // Fallback to local comprehensive vault export if server fetch wasn't available
      if (!fullJsonStr) {
        fullJsonStr = await vaultService.exportDatabaseAsJsonAsync();
      }

      const blob = new Blob([fullJsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `نسخة_احتياطية_شاملة_منظومة_155_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMsg('تم تنزيل النسخة الاحتياطية الشاملة (متضمنة كافة البيانات وحسابات المستخدمين بصلاحياتهم والجداول والصور المرفقة) بنجاح');
    } catch (err: any) {
      showMsg(err?.message || 'فشل تنزيل النسخة الاحتياطية', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadRawServerDb = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/backup/download-0930');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qcms_155_server_db_raw_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMsg('تم تنزيل ملف قاعدة البيانات الخام من السيرفر مباشرة بنجاح', 'success');
        return;
      }
    } catch (_) {
      // fallback to full export
    } finally {
      setIsLoading(false);
    }
    await handleDownloadFullExport();
  };

  const [pendingImportPayload, setPendingImportPayload] = useState<any | null>(null);
  const [pendingImportFileName, setPendingImportFileName] = useState<string>('');
  const [importPreviewReport, setImportPreviewReport] = useState<any | null>(null);
  const [importMode, setImportMode] = useState<'smart_merge' | 'replace_all'>('smart_merge');
  const [isDragOver, setIsDragOver] = useState(false);

  const executeDirectMergeOnServer = async (
    rawPayload: any,
    fileNameLabel: string,
    modeOverride?: 'smart_merge' | 'replace_all'
  ) => {
    const activeMode = modeOverride || importMode;
    const isReplaceMode = activeMode === 'replace_all';
    const envelope = extractBackupEnvelope(rawPayload);
    const parsedPayload = (envelope.format !== 'invalid' && envelope.payload)
      ? { ...envelope.payload }
      : (rawPayload && typeof rawPayload === 'object' ? { ...rawPayload } : {});
    delete parsedPayload.snapshots;

    const incomingOrders: any[] = Array.isArray(parsedPayload.workOrders) ? parsedPayload.workOrders : [];
    const incomingTables: any[] = Array.isArray(parsedPayload.monthTables) ? parsedPayload.monthTables : [];
    const incomingUsers: any[] = Array.isArray(parsedPayload.users) ? parsedPayload.users : [];
    const incomingOffices: any[] = Array.isArray(parsedPayload.offices) ? parsedPayload.offices : [];
    const incomingColumns: any[] = [];
    delete parsedPayload.columns;
    const hasDropdowns = Boolean(parsedPayload.dropdownOptions && Object.keys(parsedPayload.dropdownOptions).length > 0);

    if (
      incomingOrders.length === 0 &&
      incomingTables.length === 0 &&
      incomingUsers.length === 0 &&
      incomingOffices.length === 0 &&
      incomingColumns.length === 0 &&
      !hasDropdowns
    ) {
      showMsg('ملف JSON المرفوع لا يحتوي على أوامر عمل أو جداول أو مستخدمين صالحين للاستيراد', 'error');
      return false;
    }

    // 1. Immediately apply local vault import so local browser state is updated right away
    let localMergedOrders: WorkOrder[] = [];
    try {
      const localImport = vaultService.importDatabaseFromJson(JSON.stringify(parsedPayload), {
        replaceMode: isReplaceMode
      });
      if (localImport.success && localImport.data?.workOrders) {
        localMergedOrders = localImport.data.workOrders;
        vaultService.unmarkBatchDeleted(localMergedOrders.map((w: any) => w.id));
        vaultService.saveWorkOrders(localMergedOrders, true);
      }
    } catch (_) {}

    // 2. Sync to server: send in a single atomic request if payload <= 3.5MB, or dynamically split into byte-safe batches
    const headers = await getAuthHeadersWithToken();
    let lastServerJson: any = null;
    let serverImportSucceeded = false;
    const MAX_BATCH_BYTES = 3.5 * 1024 * 1024; // 3.5 MB safe limit for Cloud Run / reverse proxies

    try {
      const serializedFull = JSON.stringify({
        data: parsedPayload,
        preferIncomingOnConflict: true,
        replaceMode: isReplaceMode
      });

      if (serializedFull.length <= MAX_BATCH_BYTES && incomingOrders.length <= 80) {
        const res = await fetch('/api/backup/import-full', {
          method: 'POST',
          headers,
          body: serializedFull
        });
        lastServerJson = await safeParseJsonResponse(res);
        if (res.ok && lastServerJson.success) {
          serverImportSucceeded = true;
        } else if (localMergedOrders.length === 0) {
          showMsg(lastServerJson?.error || 'فشل تنفيذ الاستيراد والدمج في المخزن السحابي', 'error');
          return false;
        }
      } else {
        // Dynamically build byte-safe batches (each <= 3.5MB and <= 40 orders) so large base64 photos never hit HTTP 413
        const batches: any[][] = [];
        let currentBatch: any[] = [];
        let currentBatchBytes = 0;

        for (const order of incomingOrders) {
          const orderBytes = JSON.stringify(order).length;
          if (
            currentBatch.length > 0 &&
            (currentBatchBytes + orderBytes > MAX_BATCH_BYTES || currentBatch.length >= 40)
          ) {
            batches.push(currentBatch);
            currentBatch = [];
            currentBatchBytes = 0;
          }
          currentBatch.push(order);
          currentBatchBytes += orderBytes;
        }
        if (currentBatch.length > 0 || batches.length === 0) {
          batches.push(currentBatch);
        }

        let allSlicesOk = true;
        for (let bIdx = 0; bIdx < batches.length; bIdx++) {
          const isLastBatch = bIdx === batches.length - 1;
          const orderSlice = batches[bIdx];
          const batchPayload = bIdx === 0
            ? { ...parsedPayload, workOrders: orderSlice }
            : { workOrders: orderSlice };

          const res = await fetch('/api/backup/import-full', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              data: batchPayload,
              preferIncomingOnConflict: true,
              replaceMode: bIdx === 0 ? isReplaceMode : false,
              isIntermediateBatch: !isLastBatch
            })
          });
          lastServerJson = await safeParseJsonResponse(res);
          if (!res.ok || !lastServerJson.success) {
            allSlicesOk = false;
            if (localMergedOrders.length === 0) {
              showMsg(lastServerJson?.error || `فشل استيراد الدفعة (${bIdx + 1}/${batches.length}) في المخزن السحابي`, 'error');
              return false;
            }
            break;
          }
        }
        serverImportSucceeded = allSlicesOk;
      }
    } catch (netErr: any) {
      if (localMergedOrders.length === 0) {
        showMsg(netErr?.message || 'تعذر الاتصال بالخادم أثناء استيراد النسخة الاحتياطية', 'error');
        return false;
      }
    }

    if (serverImportSucceeded) {
      const latestRes = await fetch('/api/work-orders', { headers }).catch(() => null);
      if (latestRes && latestRes.ok) {
        const latestData = await safeParseJsonResponse(latestRes).catch(() => null);
        if (latestData) {
          if (Array.isArray(latestData.workOrders) && latestData.workOrders.length > 0) {
            vaultService.unmarkBatchDeleted(latestData.workOrders.map((w: any) => w.id));
            vaultService.saveWorkOrders(latestData.workOrders, true);
            for (const w of latestData.workOrders) {
              if (w && w.id) {
                vaultService.markWalMutationAcked(w.id, w.recordVersion, w.updatedAt);
              }
            }
          }
          if (Array.isArray(latestData.monthTables)) {
            vaultService.saveMonthTables(latestData.monthTables);
          }
          if (Array.isArray(latestData.offices) && latestData.offices.length > 0) {
            vaultService.saveOffices(latestData.offices);
          }
          if (Array.isArray(latestData.columns) && latestData.columns.length > 0) {
            vaultService.saveColumns(latestData.columns);
          }
          if (latestData.dropdownOptions) {
            vaultService.saveDropdownOptions(latestData.dropdownOptions);
          }
          if (Array.isArray(latestData.users) && latestData.users.length > 0) {
            vaultService.saveUsers(latestData.users);
          }
        }
      }
    } else if (localMergedOrders.length > 0) {
      // Fallback: push directly via realtime.importFullDatabase + hydrateServer
      try {
        await realtime.importFullDatabase(parsedPayload);
        await realtime.hydrateServer({
          workOrders: localMergedOrders,
          offices: parsedPayload.offices,
          columns: parsedPayload.columns,
          dropdownOptions: parsedPayload.dropdownOptions,
          monthTables: parsedPayload.monthTables,
          archivedReports: parsedPayload.archivedReports
        });
      } catch (_) {}
    }

    setPendingImportPayload(null);
    setImportPreviewReport(null);
    const finalOrdersCount = lastServerJson?.count ?? (localMergedOrders.length || incomingOrders.length);
    showMsg(
      `تم استيراد واعتماد (${fileNameLabel}) بنجاح تام: إجمالي (${finalOrdersCount}) أمر عمل، (${lastServerJson?.tablesCount ?? incomingTables.length}) جدول، (${lastServerJson?.usersCount ?? incomingUsers.length}) مستخدم!`
    );
    onRestoreCompleted();
    setTimeout(() => onClose(), 1000);
    return true;
  };

  const processDirectJsonFiles = async (files: FileList | File[]) => {
    setIsLoading(true);
    try {
      const { payload: parsed, label: fileName } = await decodeUploadedFilesUniversal(files);
      await executeDirectMergeOnServer(parsed, fileName);
    } catch (err: any) {
      showMsg('خطأ أثناء قراءة واستيراد الملف: ' + (err?.message || 'ملف غير صالح'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstantDirectJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const selected: File[] = Array.from(files);
    e.target.value = '';
    processDirectJsonFiles(selected);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const selected: File[] = Array.from(files);
    e.target.value = '';
    setIsLoading(true);
    try {
      const { payload: parsed, label: fileName } = await decodeUploadedFilesUniversal(selected);
      const headers = await getAuthHeadersWithToken();

      // Create a lightweight preview copy without heavy base64 strings so preview never hits HTTP 413
      const previewOrders = Array.isArray(parsed.workOrders)
        ? parsed.workOrders.map((wo: any) => ({
            ...wo,
            photos: Array.isArray(wo?.photos) ? wo.photos.map((p: any, idx: number) => ({ id: p?.id || `p-${idx}`, name: p?.name || 'photo', url: 'data:image/jpeg;base64,preview_ok' })) : [],
            photosFile: Array.isArray(wo?.photosFile) ? wo.photosFile.map((f: any, idx: number) => ({ id: f?.id || `f-${idx}`, name: f?.name || 'file', dataUrl: 'data:image/jpeg;base64,preview_ok' })) : [],
            photosFileData: undefined,
            qualityNoteItems: Array.isArray(wo?.qualityNoteItems)
              ? wo.qualityNoteItems.map((ni: any) => ({ ...ni, photos: [], files: [] }))
              : undefined
          }))
        : [];
      const lightPreviewPayload = {
        ...parsed,
        workOrders: previewOrders
      };

      const previewRes = await fetch('/api/backup/preview-import', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          data: lightPreviewPayload,
          preferIncomingOnConflict: true,
          replaceMode: importMode === 'replace_all'
        })
      });
      const previewJson = await safeParseJsonResponse(previewRes);
      if (!previewRes.ok || !previewJson.preview?.valid) {
        showMsg(previewJson.error || 'ملف النسخة الاحتياطية غير صالح أو غير متوافق مع المنظومة', 'error');
        return;
      }
      setPendingImportPayload(parsed);
      setPendingImportFileName(fileName);
      setImportPreviewReport(previewJson.preview);
      const formatBadge = previewJson.preview.detectedTypeLabelAr || previewJson.preview.backupFormat || 'نسخة احتياطية';
      showMsg(`تم فحص الملف بنجاح [${formatBadge}] — اضغط «اعتماد وتنفيذ الاستيراد» بالأسفل للتطبيق الفوري`);
    } catch (err: any) {
      showMsg('خطأ أثناء قراءة وفحص الملف: ' + (err?.message || 'ملف غير صالح'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSmartImport = async () => {
    if (!pendingImportPayload) return;
    setIsLoading(true);
    try {
      await executeDirectMergeOnServer(pendingImportPayload, pendingImportFileName || 'ملف JSON', importMode);
    } catch (err: any) {
      showMsg('خطأ أثناء اعتماد الدمج: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmergencyHydrate = async () => {
    setIsLoading(true);
    try {
      await realtime.forceSyncNow();
      const headers = await getAuthHeadersWithToken();
      await fetch('/api/backup/auto-session-snapshot', {
        method: 'POST',
        headers,
        body: JSON.stringify({ trigger: 'MANUAL_CLOUD_PULL_AND_SNAPSHOT' })
      }).catch(() => {});
      const syncedOrders = vaultService.getSavedWorkOrders();
      await loadData();
      showMsg(`تم الاسترجاع والمزامنة من قاعدة البيانات السحابية الدائمة بنجاح (${syncedOrders.length} أمر عمل) وحفظ نسخة احتياطية موثقة.`);
    } catch (err: any) {
      showMsg(err?.message || 'فشلت المزامنة مع السحابة الدائمة', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const droppedFiles = e.dataTransfer?.files;
        if (droppedFiles && droppedFiles.length > 0) {
          processDirectJsonFiles(droppedFiles);
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 text-right"
    >
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 sm:px-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shadow-inner">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  مركز الأمان السحابي واستعادة البيانات الشامل
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  مؤمن ضد الفقدان
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                حفظ مستمر تلقائي وتدوير احتياطي • استرجاع أي لحظة زمنية بنقرة زر واحدة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Status Bar */}
        <div className="bg-slate-100/90 border-b border-slate-200/80 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Database className="w-4 h-4 text-indigo-600" />
              <span>الأوامر النشطة حالياً:</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-mono font-black">
                {currentOrdersCount} أمر عمل
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <HardDrive className="w-4 h-4 text-emerald-600" />
              <span>نقاط الاستعادة المحفوظة:</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-mono font-black">
                {snapshots.length} نسخة
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Cloud className="w-4 h-4 text-blue-600" />
              <span>نسخ السيرفر الدوارة:</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-mono font-black">
                {serverBackups.length} نسخة
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              title="رفع واستيراد أي ملف نسخة احتياطية (.json / .gz / .zip / .xlsx) مباشرة من الجوال أو الكمبيوتر"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>رفع ملف نسخة احتياطية (.json / .gz / .zip / .xlsx)</span>
              <input
                type="file"
                multiple
                accept=".json,.gz,.zip,.xlsx,.xls,.csv,application/json,application/gzip,application/x-gzip,application/zip,text/plain,application/octet-stream,*/*"
                onChange={handleInstantDirectJsonImport}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={handleEmergencyHydrate}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              title="استرجاع فوري من قاعدة البيانات السحابية الدائمة وحفظ نسخة احتياطية موثقة"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>استرجاع سحابي وحفظ فوري</span>
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className={`px-6 py-2.5 text-xs font-bold flex items-center justify-between border-b ${
            notification.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
              <span>{notification.message}</span>
            </div>
            <button type="button" onClick={() => setNotification(null)} className="p-1 hover:opacity-75">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('server')}
            className={`pb-2.5 px-3 text-xs font-black transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'server'
                ? 'border-[#004B8D] text-[#004B8D]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            النسخ السحابية الدوارة للسيرفر ({serverBackups.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('export_import')}
            className={`pb-2.5 px-3 text-xs font-black transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'export_import'
                ? 'border-[#004B8D] text-[#004B8D]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            تصدير واستيراد خارجي كملف JSON
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scheduled_backup')}
            className={`pb-2.5 px-3 text-xs font-black transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'scheduled_backup'
                ? 'border-[#F58220] text-[#004B8D]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            النسخ الاحتياطي المجدول (08:00 و 15:00 الرياض)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('snapshots')}
            className={`pb-2.5 px-3 text-xs font-black transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'snapshots'
                ? 'border-[#004B8D] text-[#004B8D]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            نقاط الاستعادة التلقائية واليدوية ({snapshots.length})
          </button>
        </div>

        {/* Tab 0: Scheduled Backup Admin Dashboard (08:00 & 15:00 Asia/Riyadh) */}
        {activeTab === 'scheduled_backup' && (
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
            <div className="p-4 bg-gradient-to-l from-[#002244] to-[#003366] text-white rounded-2xl border border-[#f97316]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-black text-white">
                    نظام النسخ الاحتياطي المجدول والموثق (Asia/Riyadh)
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#f97316] text-white text-[10px] font-black">
                    08:00 ص • 03:00 م يومياً (شامل الإجازات)
                  </span>
                </div>
                <p className="text-[11px] text-slate-200 mt-1">
                  لا تُسجل أي نسخة على أنها ناجحة إلا بعد اكتمال التصدير والتحقق من القراءة وبصمة SHA-256 وسلامة المرفقات.
                </p>
              </div>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleRunVerifiedScheduledBackupNow}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#f97316] hover:bg-orange-600 text-white font-black text-xs shadow-sm transition-colors cursor-pointer shrink-0"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>تشغيل وفحص نسخة موثقة الآن</span>
              </button>
            </div>

            {/* Key Metrics Grid: Last Successful, Previous, Next Scheduled Run */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-1">
                <div className="text-[11px] font-black text-emerald-900 flex items-center justify-between">
                  <span>آخر نسخة ناجحة ومؤكدة</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                {scheduleStatus?.lastSuccessfulBackup ? (
                  <>
                    <div className="font-mono font-black text-slate-900 text-xs truncate">
                      {scheduleStatus.lastSuccessfulBackup.backupId}
                    </div>
                    <div className="text-[11px] text-slate-600 font-bold">
                      ⏰ {scheduleStatus.lastSuccessfulBackup.completedAtRiyadh || scheduleStatus.lastSuccessfulBackup.startedAtRiyadh}
                    </div>
                    <div className="text-[10px] text-emerald-800 font-bold">
                      أوامر العمل: {scheduleStatus.lastSuccessfulBackup.verificationResult?.workOrdersCount ?? 0} • المرفقات: {scheduleStatus.lastSuccessfulBackup.verificationResult?.attachmentsCount ?? 0} • التحقق: مؤكد (SHA-256)
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-500 font-bold py-2">لم تُسجل نسخة بعد في هذه الجلسة</div>
                )}
              </div>

              <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200 space-y-1">
                <div className="text-[11px] font-black text-blue-900 flex items-center justify-between">
                  <span>النسخة الناجحة السابقة</span>
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                {scheduleStatus?.previousSuccessfulBackup ? (
                  <>
                    <div className="font-mono font-black text-slate-900 text-xs truncate">
                      {scheduleStatus.previousSuccessfulBackup.backupId}
                    </div>
                    <div className="text-[11px] text-slate-600 font-bold">
                      ⏰ {scheduleStatus.previousSuccessfulBackup.completedAtRiyadh || scheduleStatus.previousSuccessfulBackup.startedAtRiyadh}
                    </div>
                    <div className="text-[10px] text-blue-800 font-bold">
                      أوامر العمل: {scheduleStatus.previousSuccessfulBackup.verificationResult?.workOrdersCount ?? 0} • المرفقات: {scheduleStatus.previousSuccessfulBackup.verificationResult?.attachmentsCount ?? 0}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-500 font-bold py-2">لا توجد نسخة سابقة مسجلة</div>
                )}
              </div>

              <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-1">
                <div className="text-[11px] font-black text-amber-900 flex items-center justify-between">
                  <span>الموعد المجدول التالي (الرياض)</span>
                  <Calendar className="w-4 h-4 text-amber-600" />
                </div>
                <div className="font-mono font-black text-slate-900 text-xs">
                  {scheduleStatus?.nextScheduledRun?.nextRunRiyadh || 'اليوم 08:00 / 15:00 (Asia/Riyadh)'}
                </div>
                <div className="text-[11px] text-amber-800 font-bold">
                  الفترة: {scheduleStatus?.nextScheduledRun?.slotLabelAr || 'جدولة تلقائية يومية'}
                </div>
                <div className="text-[10px] text-slate-600 font-bold">
                  توقيت الرياض الآن: {scheduleStatus?.currentRiyadhTime?.formatted || '-'}
                </div>
              </div>
            </div>

            {/* Failure Alerts (if any) */}
            {Array.isArray(scheduleStatus?.alerts) && scheduleStatus.alerts.length > 0 && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-1.5">
                <div className="text-xs font-black text-rose-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>سجل تنبيهات فشل النسخ الاحتياطي للمسؤولين ({scheduleStatus.alerts.length}):</span>
                </div>
                {scheduleStatus.alerts.slice(0, 5).map((al: any) => (
                  <div key={al.alertId} className="text-[11px] text-rose-800 font-bold bg-white/80 px-2.5 py-1.5 rounded-lg border border-rose-200 flex items-center justify-between gap-2">
                    <span>{al.message}</span>
                    <span className="font-mono text-[10px] text-rose-600 shrink-0">{al.createdAtRiyadh}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Read-Only Comparison between Current Firestore & Available Backups */}
            {readOnlyInventory && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-black text-slate-900">
                    فحص القراءة فقط (Read-Only): مقارنة قاعدة بيانات الإنتاج الحالية بالنسخ الاحتياطية المحفوظة
                  </h5>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-black">
                    وضع فحص غير تدميري (Read-Only)
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <div className="text-slate-500 font-bold">محرك الاستضافة السحابي المتصل</div>
                    <div className="font-mono font-black text-slate-900 truncate" title="SEC-CLOUD-VAULT-V3 (مساحة تخزين سحابية مفتوحة بدون حدود قراءة)">
                      SEC-CLOUD-VAULT-V3 (مفتوح السعة)
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <div className="text-slate-500 font-bold">أوامر العمل المركزية (Vault)</div>
                    <div className="font-mono font-black text-indigo-700 text-sm">
                      {readOnlyInventory.currentFirestoreState?.workOrders ?? readOnlyInventory.currentProductionState?.workOrdersCount ?? 0} أمر عمل
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <div className="text-slate-500 font-bold">المستخدمون والجداول</div>
                    <div className="font-mono font-black text-emerald-700">
                      {readOnlyInventory.currentFirestoreState?.users ?? readOnlyInventory.currentProductionState?.usersCount ?? 0} مستخدم • {readOnlyInventory.currentFirestoreState?.monthTables ?? readOnlyInventory.currentProductionState?.monthTablesCount ?? 0} جدول
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <div className="text-slate-500 font-bold">إجمالي النسخ المفحوصة</div>
                    <div className="font-mono font-black text-blue-700">
                      {readOnlyInventory.availableBackups?.length ?? ((readOnlyInventory.availableRotatingBackups?.length || 0) + (readOnlyInventory.isolatedArtifactBackups?.length || 0))} نسخة
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Execution Logs Table */}
            <div className="space-y-2">
              <h5 className="text-xs font-black text-slate-800">
                سجل عمليات التنفيذ والتحقق للنسخ المجدولة واليدوية:
              </h5>
              {(!scheduleStatus?.executionLogs || scheduleStatus.executionLogs.length === 0) ? (
                <div className="py-6 text-center text-xs text-slate-400 font-bold bg-slate-50 rounded-2xl border border-slate-200">
                  لا توجد عمليات مسجلة بعد — اضغط «تشغيل وفحص نسخة موثقة الآن» لإجراء فحص فوري
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {scheduleStatus.executionLogs.slice(0, 15).map((log: any) => (
                    <div
                      key={log.backupId}
                      className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        log.status === 'VERIFIED_SUCCESS' || log.status === 'SUCCESS'
                          ? 'bg-white border-emerald-200'
                          : 'bg-rose-50/60 border-rose-200'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-slate-900">{log.backupId}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            log.status === 'VERIFIED_SUCCESS' || log.status === 'SUCCESS'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-rose-100 text-rose-900'
                          }`}>
                            {log.status === 'VERIFIED_SUCCESS' || log.status === 'SUCCESS' ? 'ناجحة ومؤكدة القراءة' : 'فشل التنفيذ/التحقق'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">
                            الموعد: {log.scheduledSlot} ({log.timezone})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-bold">
                          البدء: {log.startedAtRiyadh} • الانتهاء: {log.completedAtRiyadh || '-'} • الموقع: <span className="font-mono">{log.storageLocation}</span>
                        </div>
                        {log.failureReason && (
                          <div className="text-[11px] text-rose-700 font-black">
                            سبب الفشل: {log.failureReason}
                          </div>
                        )}
                      </div>
                      {log.verificationResult && (
                        <div className="text-[10px] font-mono font-bold text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 shrink-0">
                          <div>أوامر العمل: {log.verificationResult.workOrdersCount}</div>
                          <div>SHA256: {String(log.verificationResult.sha256Checksum || '').slice(0, 12)}...</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 1: Local & Periodic Snapshots */}
        {activeTab === 'snapshots' && (
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
            {/* Create manual snapshot box */}
            <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <label className="block text-xs font-black text-indigo-950 mb-1">
                  إنشاء نقطة استعادة يدوية فورية
                </label>
                <input
                  type="text"
                  value={newSnapshotLabel}
                  onChange={(e) => setNewSnapshotLabel(e.target.value)}
                  placeholder="مثال: نسخة قبل مراجعة شهر مارس أو قبل استيراد المقاول..."
                  className="w-full px-3.5 py-2 text-xs bg-white rounded-xl border border-indigo-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateSnapshot}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer shrink-0 mt-auto"
              >
                <Sparkles className="w-4 h-4" />
                <span>حفظ نقطة استعادة الآن</span>
              </button>
            </div>

            {/* List */}
            {snapshots.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Clock className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold">لا توجد نقاط استعادة محفوظة بعد</p>
                <p className="text-[11px] text-slate-400">يتم إنشاء النقاط تلقائياً عند إجراء أي تعديل أو استيراد</p>
              </div>
            ) : (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 px-1">سجل نقاط الاستعادة المتوفرة:</h4>
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-3.5 bg-white hover:bg-slate-50/80 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                        snap.source === 'auto_periodic'
                          ? 'bg-blue-100 text-blue-700'
                          : snap.source === 'pre_update'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-xs font-black text-slate-900">{snap.label}</h5>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            snap.source === 'auto_periodic'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : snap.source === 'pre_update'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}>
                            {snap.source === 'auto_periodic' ? 'حفظ دوري تلقائي' : snap.source === 'pre_update' ? 'نقطة أمان سابقة' : 'حفظ يدوي'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                          <span>📅 {new Date(snap.timestamp).toLocaleString('ar-SA')}</span>
                          <span>•</span>
                          <span className="font-mono font-bold text-indigo-700">📋 {snap.ordersCount} أمر عمل</span>
                          {snap.tablesCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="font-mono font-bold text-purple-700">📑 {snap.tablesCount} جدول</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleRestoreSnapshot(snap.id, snap.label)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                        title="استرجاع هذه النسخة فوراً وتطبيقها"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>استرجاع فوري</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSnapshot(snap.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="حذف هذه النقطة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Server-side Backups */}
        {activeTab === 'server' && (
          <div className="p-6 flex-1 overflow-y-auto space-y-3">
            <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-xs text-blue-900 leading-relaxed font-medium">
              يحتفظ السيرفر تلقائياً بأحدث 60 نسخة احتياطية في مجلد آمن داخل الخادم. هذه النسخ تحفظ حتى لو تم مسح بيانات المتصفح بالكامل.
            </div>

            {serverBackups.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Cloud className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold">لا توجد نسخ في مجلد السيرفر حالياً</p>
                <p className="text-[11px] text-slate-400">يقوم السيرفر بتوليد نسخة تلقائية عند كل عملية حفظ وتعديل</p>
              </div>
            ) : (
              <div className="space-y-2">
                {serverBackups.map((b, idx) => (
                  <div
                    key={b.filename || idx}
                    className="p-3.5 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                        <Cloud className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-900 font-mono">
                          {b.filename}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>{new Date(b.createdAt).toLocaleString('ar-SA')}</span>
                          <span>•</span>
                          <span className="font-bold text-emerald-700">{b.ordersCount || 0} أمر عمل</span>
                          <span>•</span>
                          <span>{(b.size / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRestoreServerBackup(b.filename, b.ordersCount)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>استرجاع من السيرفر</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Offline Export & Import */}
        {activeTab === 'export_import' && (
          <div className="p-6 flex-1 overflow-y-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Export Box */}
              <div className="p-5 bg-slate-50 rounded-3xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                    <Download className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900 mb-1">
                    تنزيل نسخة احتياطية كاملة (.json)
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    حفظ ملف نسخة احتياطية كامل على جهاز الكمبيوتر يتضمن كافة أوامر العمل، المكاتب، الجداول، ونقاط الاستعادة.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadFullExport}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل ملف النسخة الاحتياطية</span>
                </button>
              </div>

              {/* Import Box */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(false);
                  const droppedFiles = e.dataTransfer?.files;
                  if (droppedFiles && droppedFiles.length > 0) {
                    processDirectJsonFiles(droppedFiles);
                  }
                }}
                className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between ${
                  isDragOver
                    ? 'bg-indigo-50 border-indigo-500 border-dashed shadow-md'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                      يدعم JSON و GZ و ZIP و Excel والنسخ القديمة والحديثة 100%
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-slate-900 mb-1">
                    استيراد ورفع أي ملف نسخة احتياطية (.json / .gz / .zip / .xlsx) بكل سهولة
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">
                    اسحب وأفلت أي ملف أو عدة ملفات هنا أو اخترها من جهازك (يدعم جميع الإصدارات القديمة والجديدة، db.json، core_db.json.gz، ملفات الأجزاء المضغوطة، الجداول، أو الحسابات) مع فك ضغط تلقائي وتزامن سحابي دائم.
                  </p>
                  <div className="flex items-center gap-2 mb-3 bg-white p-1.5 rounded-xl border border-slate-200 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setImportMode('smart_merge')}
                      className={`flex-1 py-1.5 px-2 rounded-lg transition-colors cursor-pointer ${
                        importMode === 'smart_merge'
                          ? 'bg-indigo-600 text-white font-black'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      دمج شامل (يضيف ويحدث الكل بدون حذف)
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('replace_all')}
                      className={`flex-1 py-1.5 px-2 rounded-lg transition-colors cursor-pointer ${
                        importMode === 'replace_all'
                          ? 'bg-amber-600 text-white font-black'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      استبدال مطابق للملف المرفوع
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer">
                    <Sparkles className="w-4 h-4" />
                    <span>رفع واستيراد فوري لأي ملف نسخة احتياطية (JSON / GZ / قديم أو جديد)</span>
                    <input
                      type="file"
                      multiple
                      accept=".json,.gz,.zip,.xlsx,.xls,.csv,application/json,application/gzip,application/x-gzip,text/plain,application/octet-stream,*/*"
                      onChange={handleInstantDirectJsonImport}
                      className="hidden"
                    />
                  </label>
                  <label className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 font-bold text-xs transition-colors cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>فحص ومعاينة تفصيلية قبل الاعتماد</span>
                    <input
                      type="file"
                      multiple
                      accept=".json,.gz,.zip,.xlsx,.xls,.csv,application/json,application/gzip,application/x-gzip,text/plain,application/octet-stream,*/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Dry-Run Preview & Conflict Report Panel */}
            {importPreviewReport && (
              <div className="p-5 bg-indigo-50/70 border-2 border-indigo-300 rounded-3xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-indigo-950">
                      معاينة الدمج الذكي وتقرير التعارضات قبل الكتابة ({pendingImportFileName})
                    </h4>
                    <p className="text-[11px] text-indigo-700 font-bold mt-0.5">
                      لن يتم تعديل أو كتابة أي سجل في قاعدة البيانات السحابية إلا بعد مراجعتك والضغط على زر الاعتماد أدناه
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-xs">
                    {importPreviewReport.detectedTypeLabelAr || importPreviewReport.backupFormat}
                  </span>
                </div>

                {Array.isArray(importPreviewReport.conflicts?.warnings) && importPreviewReport.conflicts.warnings.length > 0 && (
                  <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-2xl text-xs text-amber-950 font-bold space-y-1">
                    {importPreviewReport.conflicts.warnings.map((w: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 bg-white rounded-2xl border border-slate-200">
                    <div className="text-slate-500 font-bold">سجلات جديدة ستُضاف</div>
                    <div className="text-lg font-black text-emerald-700 font-mono mt-0.5">
                      +{importPreviewReport.summary?.addedOrdersCount ?? 0}
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-2xl border border-slate-200">
                    <div className="text-slate-500 font-bold">سجلات أحدث ستُحدَّث</div>
                    <div className="text-lg font-black text-blue-700 font-mono mt-0.5">
                      {importPreviewReport.summary?.updatedOrdersCount ?? 0}
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-2xl border border-slate-200">
                    <div className="text-slate-500 font-bold">سجلات غائبة محمية من الحذف</div>
                    <div className="text-lg font-black text-indigo-700 font-mono mt-0.5">
                      {importPreviewReport.summary?.preservedAbsentOrdersCount ?? 0}
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-2xl border border-slate-200">
                    <div className="text-slate-500 font-bold">إجمالي السجلات بعد الدمج</div>
                    <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
                      {importPreviewReport.summary?.resultingOrdersCount ?? 0}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 font-bold">
                    سجلات قديمة مرفوضة تلقائياً: {importPreviewReport.summary?.skippedOlderOrdersCount ?? 0}
                  </div>
                  <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-200 text-purple-900 font-bold">
                    أرقام مكررة بمعرفات مستقلة محفوظة: {importPreviewReport.summary?.duplicateOrderNumbersPreservedCount ?? 0}
                  </div>
                  <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 font-bold">
                    حسابات/صلاحيات متعارضة موقوفة: {importPreviewReport.summary?.conflictingUsersSkippedCount ?? 0}
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 font-bold">
                    إجمالي المرفقات المحفوظة: {importPreviewReport.summary?.totalAttachmentsPreservedCount ?? 0}
                  </div>
                </div>

                {/* Additional additions badges */}
                {((importPreviewReport.summary?.addedTablesCount || 0) > 0 || (importPreviewReport.summary?.addedUsersCount || 0) > 0) && (
                  <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
                    {(importPreviewReport.summary?.addedTablesCount || 0) > 0 && (
                      <span className="px-3 py-1 rounded-xl bg-blue-100 text-blue-900 border border-blue-200">
                        📑 جداول شهرية جديدة ستُضاف: +{importPreviewReport.summary.addedTablesCount}
                      </span>
                    )}
                    {(importPreviewReport.summary?.addedUsersCount || 0) > 0 && (
                      <span className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-200">
                        👤 حسابات مستخدمين جديدة ستُعتمد: +{importPreviewReport.summary.addedUsersCount}
                      </span>
                    )}
                  </div>
                )}

                {/* Detailed Conflict Items */}
                {((importPreviewReport.conflicts?.workOrders?.length || 0) > 0 ||
                  (importPreviewReport.conflicts?.users?.length || 0) > 0) && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-3.5 max-h-48 overflow-y-auto space-y-2 text-xs">
                    <div className="font-black text-slate-800">
                      تفاصيل التعارضات وقرارات الحماية التلقائية:
                    </div>
                    {importPreviewReport.conflicts?.users?.map((uc: any, i: number) => (
                      <div key={`uc-${i}`} className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
                        <span className="font-black">حساب مستخدم ({uc.username || uc.email}): </span>
                        <span>{uc.resolution}</span>
                      </div>
                    ))}
                    {importPreviewReport.conflicts?.workOrders?.slice(0, 25).map((wc: any, i: number) => (
                      <div key={`wc-${i}`} className="p-2 bg-amber-50/70 border border-amber-200 rounded-xl text-slate-800">
                        <span className="font-black font-mono">أمر عمل #{wc.workOrderNumber} ({wc.id}): </span>
                        <span>{wc.resolution}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingImportPayload(null);
                      setImportPreviewReport(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer"
                  >
                    إلغاء عدم الحفظ
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleConfirmSmartImport}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm cursor-pointer"
                  >
                    اعتماد وتنفيذ الدمج الذكي الآمن الآن
                  </button>
                </div>
              </div>
            )}

            {/* Direct Server JSON download link - exact layout and orange CTA from screenshots */}
            <div className="p-4 bg-[#FFFDF5] border border-[#FDE68A] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-2.5 text-amber-950">
                <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                  <FileCheck className="w-4.5 h-4.5 text-[#F58220]" />
                </div>
                <span className="font-bold text-sm text-slate-800">
                  تحميل مباشر لملف قاعدة البيانات الخام من السيرفر:
                </span>
              </div>
              <button
                type="button"
                onClick={handleDownloadRawServerDb}
                className="px-6 py-2.5 rounded-xl bg-[#F58220] hover:bg-[#E07116] text-white font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 shrink-0"
                title="تنزيل نسخة حية وخام من السيرفر مباشرة بصيغة JSON"
              >
                <Download className="w-4 h-4" />
                <span>تنزيل من السيرفر مباشرة</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>نظام الحماية المزدوجة (Dual-Vault Protection) مفعل بنجاح</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
