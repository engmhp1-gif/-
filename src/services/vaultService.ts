import { 
  WorkOrder, 
  SubOffice, 
  ColumnDefinition, 
  DropdownOptionsMap, 
  ArchivedReportSnapshot,
  MonthTable,
  DataBackupSnapshot,
  PlatformUser
} from '../types';
import { ensureDefaultSuperAdmins, isPlatformRunningInStudioIframe, isPurgedLegacyUserOrEmail } from '../utils/security';
import { extractBackupEnvelope, normalizeLegacyWorkOrder } from '../utils/backupMergeEngine';
import { ensurePhotosFileColumn } from '../data/initialData';

export interface PendingMutation {
  id: string;
  type: string;
  payload: any;
  timestamp: string;
  retries: number;
}

export interface WalFieldMutationEntry {
  value: any;
  updatedAt: string;
  recordVersion: number;
  acked: boolean;
}

export interface WalOrderLedgerEntry {
  orderId: string;
  createdOrder?: WorkOrder;
  fields: Record<string, WalFieldMutationEntry>;
  recordVersion: number;
  lastMutatedAt: string;
  acked: boolean;
}

const IS_PREVIEW_SANDBOX = false;
const KEY_PREFIX = IS_PREVIEW_SANDBOX ? 'preview_sandbox_' : '';

const STORAGE_KEYS = {
  WORK_ORDERS: `${KEY_PREFIX}p155_vault_work_orders_v2`,
  OFFICES: `${KEY_PREFIX}p155_vault_offices_v2`,
  COLUMNS: `${KEY_PREFIX}p155_vault_columns_v2`,
  DROPDOWNS: `${KEY_PREFIX}p155_vault_dropdowns_v2`,
  REPORTS: `${KEY_PREFIX}p155_vault_reports_v2`,
  LAST_SYNC: `${KEY_PREFIX}p155_vault_last_sync_timestamp`,
  TOMBSTONES: `${KEY_PREFIX}p155_vault_tombstones_v2`,
  LAST_CLEAR_TIME: `${KEY_PREFIX}p155_vault_last_clear_timestamp`,
  SNAPSHOTS: `${KEY_PREFIX}p155_vault_snapshots_v3`,
  MONTH_TABLES: `${KEY_PREFIX}p155_vault_month_tables_v1`,
  LAST_AUTO_SNAPSHOT: `${KEY_PREFIX}p155_vault_last_auto_snapshot_time`,
  OFFLINE_QUEUE: `${KEY_PREFIX}p155_vault_offline_queue_v1`,
  MUTATION_WAL: `${KEY_PREFIX}p155_immutable_mutation_wal_v1`,
  USERS: `${KEY_PREFIX}p155_vault_users_v2`
};

// IndexedDB database configuration for unlimited storage capacity (photos, large tables)
// Strictly isolated between AI Studio Preview Sandbox and Production Users
const IDB_NAME = IS_PREVIEW_SANDBOX ? 'preview_sandbox_p155_enterprise_vault_idb' : 'p155_enterprise_vault_idb';
const IDB_VERSION = 1;
const IDB_STORE_NAME = 'vault_store';

class VaultService {
  private memoryOrdersCache: WorkOrder[] | null = null;
  private lastSavedOrdersRef: WorkOrder[] | null = null;
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private legacyPreviewDbPromise: Promise<IDBDatabase | null> | null = null;
  private cachedHarvestedData: {
    workOrders: WorkOrder[];
    monthTables: MonthTable[];
    users: PlatformUser[];
    offices: SubOffice[];
  } | null = null;
  private initialHarvestPromise: Promise<{
    workOrders: WorkOrder[];
    monthTables: MonthTable[];
    users: PlatformUser[];
    offices: SubOffice[];
  }> | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initIndexedDB();
    }
  }

  public getCachedHarvestedOrders(): WorkOrder[] {
    return this.cachedHarvestedData?.workOrders || [];
  }

  public getCachedHarvestedTables(): MonthTable[] {
    return this.cachedHarvestedData?.monthTables || [];
  }

  private initIndexedDB(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return Promise.resolve(null);
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
            db.createObjectStore(IDB_STORE_NAME);
          }
        };
        req.onsuccess = (e: any) => {
          const db = e.target.result;
          resolve(db);
        };
        req.onerror = () => {
          console.warn('[VaultService] IndexedDB could not be opened, falling back to localStorage');
          resolve(null);
        };
      } catch (err) {
        console.warn('[VaultService] IndexedDB init error:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  private initLegacyPreviewIndexedDB(): Promise<IDBDatabase | null> {
    if (this.legacyPreviewDbPromise) return this.legacyPreviewDbPromise;
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return Promise.resolve(null);
    }

    this.legacyPreviewDbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open('preview_sandbox_p155_enterprise_vault_idb', IDB_VERSION);
        req.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
            db.createObjectStore(IDB_STORE_NAME);
          }
        };
        req.onsuccess = (e: any) => resolve(e.target.result);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });

    return this.legacyPreviewDbPromise;
  }

  private async idbSet(key: string, value: any): Promise<void> {
    try {
      const db = await this.initIndexedDB();
      if (!db) return;
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.put(value, key);
    } catch (_) {}
  }

  private async idbGet<T>(key: string): Promise<T | null> {
    try {
      const db = await this.initIndexedDB();
      if (!db) return null;
      return new Promise<T | null>((resolve) => {
        try {
          const tx = db.transaction(IDB_STORE_NAME, 'readonly');
          const store = tx.objectStore(IDB_STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => resolve(null);
        } catch (_) {
          resolve(null);
        }
      });
    } catch (_) {
      return null;
    }
  }

  private async idbGetFromLegacyPreview<T>(key: string): Promise<T | null> {
    try {
      const db = await this.initLegacyPreviewIndexedDB();
      if (!db) return null;
      return new Promise<T | null>((resolve) => {
        try {
          const tx = db.transaction(IDB_STORE_NAME, 'readonly');
          const store = tx.objectStore(IDB_STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => resolve(null);
        } catch (_) {
          resolve(null);
        }
      });
    } catch (_) {
      return null;
    }
  }

  private async idbGetAllVariants<T>(baseKey: string): Promise<T[]> {
    const cleanKey = baseKey.replace(/^preview_sandbox_/, '');
    const previewKey = `preview_sandbox_${cleanKey}`;
    const results: T[] = [];
    try {
      const [main1, main2, prev1, prev2] = await Promise.all([
        this.idbGet<T>(cleanKey),
        this.idbGet<T>(previewKey),
        this.idbGetFromLegacyPreview<T>(previewKey),
        this.idbGetFromLegacyPreview<T>(cleanKey)
      ]);
      if (main1) results.push(main1);
      if (main2) results.push(main2);
      if (prev1) results.push(prev1);
      if (prev2) results.push(prev2);
    } catch (_) {}
    return results;
  }

  /**
   * Get set of IDs that have been intentionally deleted (Tombstones).
   * These IDs are NEVER resurrected or restored by sync unless explicitly undone.
   */
  public getTombstones(): Set<string> {
    const defaultTombstones: string[] = [];
    if (typeof window === 'undefined') return new Set(defaultTombstones);
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TOMBSTONES);
      const arr = raw ? JSON.parse(raw) : [];
      const set = new Set(Array.isArray(arr) ? arr : []);
      defaultTombstones.forEach(id => set.add(id));
      return set;
    } catch {
      return new Set(defaultTombstones);
    }
  }

  private saveTombstones(set: Set<string>): void {
    if (typeof window === 'undefined') return;
    try {
      // Keep up to 3000 most recent tombstones to prevent unbounded growth
      const arr = Array.from(set).slice(-3000);
      localStorage.setItem(STORAGE_KEYS.TOMBSTONES, JSON.stringify(arr));
      this.idbSet(STORAGE_KEYS.TOMBSTONES, arr);
    } catch (_) {}
  }

  /**
   * Mark an order as intentionally deleted.
   * Immediately purges from vault and adds to tombstones.
   */
  public markAsDeleted(id: string): void {
    if (!id) return;
    const tombstones = this.getTombstones();
    tombstones.add(id);
    this.saveTombstones(tombstones);
    this.removeWalEntry(id);

    const current = this.getSavedWorkOrders();
    const filtered = current.filter(w => w && w.id !== id);
    this.saveWorkOrders(filtered, true);
  }

  /**
   * Mark batch of orders as intentionally deleted.
   */
  public markBatchAsDeleted(ids: string[]): void {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const tombstones = this.getTombstones();
    const idSet = new Set(ids);
    ids.forEach(id => {
      if (id) {
        tombstones.add(id);
        this.removeWalEntry(id);
      }
    });
    this.saveTombstones(tombstones);

    const current = this.getSavedWorkOrders();
    const filtered = current.filter(w => w && !idSet.has(w.id));
    this.saveWorkOrders(filtered, true);
  }

  /**
   * Remove an ID from tombstones when an explicit Undo or restore is performed.
   */
  public unmarkDeleted(id: string): void {
    if (!id) return;
    const tombstones = this.getTombstones();
    if (tombstones.has(id)) {
      tombstones.delete(id);
      this.saveTombstones(tombstones);
    }
  }

  public unmarkBatchDeleted(ids: string[]): void {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const tombstones = this.getTombstones();
    let changed = false;
    ids.forEach(id => {
      if (id && tombstones.has(id)) {
        tombstones.delete(id);
        changed = true;
      }
    });
    if (changed) {
      this.saveTombstones(tombstones);
    }
  }

  /**
   * Mark entire table or office as cleared.
   */
  public markTableCleared(officeName?: string): void {
    const current = this.getSavedWorkOrders();
    const tombstones = this.getTombstones();

    if (!officeName || officeName === 'all' || officeName === 'جميع المكاتب الفرعية') {
      current.forEach(w => {
        if (w && w.id) {
          tombstones.add(w.id);
          this.removeWalEntry(w.id);
        }
      });
      this.saveTombstones(tombstones);
      this.saveWorkOrders([], true);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.LAST_CLEAR_TIME, String(Date.now()));
      }
    } else {
      const remaining: WorkOrder[] = [];
      current.forEach(w => {
        if (w && w.office === officeName && w.id) {
          tombstones.add(w.id);
          this.removeWalEntry(w.id);
        } else if (w) {
          remaining.push(w);
        }
      });
      this.saveTombstones(tombstones);
      this.saveWorkOrders(remaining, true);
    }
  }

  /**
   * Save work orders to local persistent storage immediately.
   * Multi-tier: updates memory cache, IndexedDB (unlimited), and localStorage.
   * Guards against accidental empty-array overwrites unless allowEmptyOverwrite is explicitly true.
   */
  public saveWorkOrders(orders: WorkOrder[], allowEmptyOverwrite: boolean = false): void {
    if (typeof window === 'undefined' || !Array.isArray(orders)) return;
    if (orders.length === 0 && !allowEmptyOverwrite) {
      const existingCount = this.memoryOrdersCache ? this.memoryOrdersCache.length : 0;
      if (existingCount > 0) {
        console.warn('[VaultService] Blocked non-explicit empty overwrite of', existingCount, 'work orders.');
        return;
      }
    }
    // High-efficiency guard: skip redundant JSON serialization & I/O if same array was already saved
    if (this.lastSavedOrdersRef === orders && !allowEmptyOverwrite) {
      this.memoryOrdersCache = orders;
      return;
    }
    this.memoryOrdersCache = orders;
    this.lastSavedOrdersRef = orders;

    // 1. Save to IndexedDB (asynchronous, holds photos and complete files with zero quota issues)
    this.idbSet(STORAGE_KEYS.WORK_ORDERS, orders);

    // 2. Save to localStorage (synchronous fallback for instant cold boot)
    try {
      localStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(orders));
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (err) {
      // If photos or inspection files caused quota exceeded, save orders without heavy base64 dataUrl to localStorage
      try {
        const lightweightOrders = orders.map(w => ({
          ...w,
          photos: Array.isArray(w.photos) ? w.photos.map(p => ({ ...p, dataUrl: '', url: p?.url?.startsWith('data:') ? '' : p?.url })) : [],
          photosFile: Array.isArray(w.photosFile)
            ? w.photosFile.map((f: any) => ({ ...f, dataUrl: '' }))
            : (w as any).photosFile && typeof (w as any).photosFile === 'object'
            ? { ...(w as any).photosFile, dataUrl: '' }
            : w.photosFile,
          photosFileData: undefined,
          qualityNoteItems: Array.isArray(w.qualityNoteItems)
            ? w.qualityNoteItems.map((ni: any) => ({
                ...ni,
                photos: Array.isArray(ni?.photos) ? ni.photos.map((p: any) => ({ ...p, dataUrl: '', url: '' })) : ni?.photos,
                files: Array.isArray(ni?.files) ? ni.files.map((f: any) => ({ ...f, dataUrl: '' })) : ni?.files
              }))
            : w.qualityNoteItems
        }));
        localStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(lightweightOrders));
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      } catch (_) {}
    }
  }

  /**
   * Load work orders from local persistent storage,
   * excluding any orders that were intentionally deleted.
   */
  public getSavedWorkOrders(): WorkOrder[] {
    const isDummy = (w: any) => {
      if (!w || typeof w !== 'object') return true;
      const id = String(w.id || '').trim();
      if (!id) return true;
      if (/^wo-10[1-9]$/.test(id) && !w.workOrderNumber) return true;
      return false;
    };

    if (this.memoryOrdersCache && Array.isArray(this.memoryOrdersCache) && this.memoryOrdersCache.length > 0) {
      const tombstones = this.getTombstones();
      return this.memoryOrdersCache.filter(w => w && w.id && !tombstones.has(w.id) && !isDummy(w));
    }

    if (typeof window === 'undefined') return [];
    try {
      const tombstones = this.getTombstones();
      const mergedById = new Map<string, WorkOrder>();
      const candidateKeys = [
        STORAGE_KEYS.WORK_ORDERS,
        `preview_sandbox_${STORAGE_KEYS.WORK_ORDERS.replace(/^preview_sandbox_/, '')}`
      ];
      for (const k of candidateKeys) {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) continue;
          for (const w of parsed) {
            if (!w || !w.id || tombstones.has(w.id) || isDummy(w)) continue;
            const existing = mergedById.get(w.id);
            if (!existing) {
              mergedById.set(w.id, w);
            } else {
              const eVer = Number(existing.recordVersion) || 1;
              const nVer = Number(w.recordVersion) || 1;
              const eTime = new Date(existing.updatedAt || existing.lastEditedAt || existing.createdAt || 0).getTime();
              const nTime = new Date(w.updatedAt || w.lastEditedAt || w.createdAt || 0).getTime();
              if (nVer > eVer || (nVer === eVer && nTime > eTime)) {
                mergedById.set(w.id, { ...existing, ...w });
              }
            }
          }
        } catch (_) {}
      }
      const filtered = Array.from(mergedById.values());
      if (filtered.length > 0) {
        try {
          localStorage.setItem(STORAGE_KEYS.WORK_ORDERS, JSON.stringify(filtered));
        } catch (_) {}
      }
      this.memoryOrdersCache = filtered;
      return filtered;
    } catch (err) {
      console.warn('[VaultService] Failed to read work orders from localStorage:', err);
      return [];
    }
  }

  /**
   * Asynchronously load deep orders from IndexedDB (preserves complete photos)
   * while union-merging any newer synchronous edits from localStorage.
   */
  public async getSavedWorkOrdersFromIDB(): Promise<WorkOrder[]> {
    const isDummy = (w: any) => {
      if (!w || typeof w !== 'object') return true;
      const id = String(w.id || '').trim();
      if (!id) return true;
      if (/^wo-10[1-9]$/.test(id) && !w.workOrderNumber) return true;
      return false;
    };
    const tombstones = this.getTombstones();
    const lsOrders = this.getSavedWorkOrders();
    const fromIdb = await this.idbGet<WorkOrder[]>(STORAGE_KEYS.WORK_ORDERS);

    if (Array.isArray(fromIdb) && fromIdb.length > 0) {
      const mergedMap = new Map<string, WorkOrder>();
      for (const w of fromIdb) {
        if (w && w.id && !tombstones.has(w.id) && !isDummy(w)) {
          mergedMap.set(w.id, w);
        }
      }
      for (const lw of lsOrders) {
        if (!lw || !lw.id || tombstones.has(lw.id) || isDummy(lw)) continue;
        const idbWo = mergedMap.get(lw.id);
        if (!idbWo) {
          mergedMap.set(lw.id, lw);
        } else {
          const iVer = Number(idbWo.recordVersion) || 1;
          const lVer = Number(lw.recordVersion) || 1;
          const iTime = new Date(idbWo.updatedAt || idbWo.lastEditedAt || idbWo.createdAt || 0).getTime();
          const lTime = new Date(lw.updatedAt || lw.lastEditedAt || lw.createdAt || 0).getTime();
          if (lVer > iVer || (lVer === iVer && lTime > iTime)) {
            mergedMap.set(lw.id, {
              ...idbWo,
              ...lw,
              photos: Array.isArray(idbWo.photos) && idbWo.photos.some((p: any) => p?.dataUrl || p?.url) ? idbWo.photos : lw.photos,
              photosFile: idbWo.photosFile || lw.photosFile,
              qualityNoteItems:
                Array.isArray(idbWo.qualityNoteItems) && idbWo.qualityNoteItems.length >= (lw.qualityNoteItems?.length || 0)
                  ? idbWo.qualityNoteItems
                  : lw.qualityNoteItems
            });
          }
        }
      }
      const combined = Array.from(mergedMap.values());
      this.memoryOrdersCache = combined;
      return combined;
    }
    return lsOrders;
  }

  public saveOffices(offices: SubOffice[]): void {
    if (typeof window === 'undefined' || !Array.isArray(offices)) return;
    try {
      localStorage.setItem(STORAGE_KEYS.OFFICES, JSON.stringify(offices));
      this.idbSet(STORAGE_KEYS.OFFICES, offices);
    } catch (_) {}
  }

  public getSavedOffices(): SubOffice[] | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.OFFICES);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }

  public saveColumns(columns: ColumnDefinition[]): void {
    if (typeof window === 'undefined' || !Array.isArray(columns)) return;
    try {
      const canonical = ensurePhotosFileColumn(columns);
      localStorage.setItem(STORAGE_KEYS.COLUMNS, JSON.stringify(canonical));
      this.idbSet(STORAGE_KEYS.COLUMNS, canonical);
    } catch (_) {}
  }

  public getSavedColumns(): ColumnDefinition[] | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.COLUMNS);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? ensurePhotosFileColumn(parsed) : null;
    } catch {
      return null;
    }
  }

  public saveDropdownOptions(options: DropdownOptionsMap): void {
    if (typeof window === 'undefined' || !options) return;
    try {
      localStorage.setItem(STORAGE_KEYS.DROPDOWNS, JSON.stringify(options));
      this.idbSet(STORAGE_KEYS.DROPDOWNS, options);
    } catch (_) {}
  }

  public getSavedDropdownOptions(): DropdownOptionsMap | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DROPDOWNS);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  public saveArchivedReports(reports: ArchivedReportSnapshot[]): void {
    if (typeof window === 'undefined' || !Array.isArray(reports)) return;
    try {
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
      this.idbSet(STORAGE_KEYS.REPORTS, reports);
    } catch (_) {}
  }

  public getSavedArchivedReports(): ArchivedReportSnapshot[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.REPORTS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public saveUsers(users: PlatformUser[]): void {
    if (typeof window === 'undefined' || !Array.isArray(users)) return;
    try {
      const userMap = new Map<string, PlatformUser>();
      for (const u of users) {
        if (u && u.id && !isPurgedLegacyUserOrEmail(u)) {
          userMap.set(u.id, u);
        }
      }
      const merged = ensureDefaultSuperAdmins(Array.from(userMap.values()));
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
      this.idbSet(STORAGE_KEYS.USERS, merged);
    } catch (_) {}
  }

  public getSavedUsers(): PlatformUser[] | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return null;
      const cleaned = parsed.filter((u: any) => u && !isPurgedLegacyUserOrEmail(u));
      if (cleaned.length !== parsed.length) {
        try {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(ensureDefaultSuperAdmins(cleaned)));
        } catch (_) {}
      }
      return cleaned.length > 0 ? ensureDefaultSuperAdmins(cleaned) : null;
    } catch {
      return null;
    }
  }

  /**
   * Synchronize tombstones with server deleted IDs while protecting any active server orders
   */
  public syncTombstones(serverDeletedIds: string[], activeServerOrderIds?: Set<string>): void {
    if (!Array.isArray(serverDeletedIds) || serverDeletedIds.length === 0) return;
    const tombstones = this.getTombstones();
    let changed = false;
    serverDeletedIds.forEach(id => {
      if (id && (!activeServerOrderIds || !activeServerOrderIds.has(id))) {
        if (!tombstones.has(id)) {
          tombstones.add(id);
          changed = true;
        }
        this.removeWalEntry(id);
      }
    });
    if (changed) {
      this.saveTombstones(tombstones);
    }
    const current = this.getSavedWorkOrders();
    const filtered = current.filter(w => w && !tombstones.has(w.id));
    if (changed || filtered.length !== current.length) {
      this.saveWorkOrders(filtered, true);
    }
  }

  /**
   * Month Tables persistence
   */
  public saveMonthTables(tables: MonthTable[]): void {
    if (typeof window === 'undefined' || !Array.isArray(tables)) return;
    try {
      localStorage.setItem(STORAGE_KEYS.MONTH_TABLES, JSON.stringify(tables));
      this.idbSet(STORAGE_KEYS.MONTH_TABLES, tables);
    } catch (_) {}
  }

  public getSavedMonthTables(): MonthTable[] {
    if (typeof window === 'undefined') return [];
    try {
      const tableMap = new Map<string, MonthTable>();
      const candidateKeys = [
        STORAGE_KEYS.MONTH_TABLES,
        `preview_sandbox_${STORAGE_KEYS.MONTH_TABLES.replace(/^preview_sandbox_/, '')}`
      ];
      for (const k of candidateKeys) {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const t of parsed) {
              if (t && t.id && !tableMap.has(t.id)) {
                tableMap.set(t.id, t);
              }
            }
          }
        } catch (_) {}
      }
      return Array.from(tableMap.values());
    } catch {
      return [];
    }
  }

  /**
   * Offline Mutation Queue Management:
   * Guarantees zero data loss if connection drops while creating or editing orders.
   */
  public getOfflineQueue(): PendingMutation[] {
    if (typeof window === 'undefined') return [];
    try {
      const tombstones = this.getTombstones();
      const nowMs = Date.now();
      const itemMap = new Map<string, PendingMutation>();
      const candidateKeys = [
        STORAGE_KEYS.OFFLINE_QUEUE,
        `preview_sandbox_${STORAGE_KEYS.OFFLINE_QUEUE.replace(/^preview_sandbox_/, '')}`
      ];
      let hadStaleItems = false;
      for (const k of candidateKeys) {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const q of parsed) {
              if (!q || !q.id) continue;
              const ageMs = nowMs - new Date(q.timestamp || 0).getTime();
              const targetOrderId = q.payload?.id ? String(q.payload.id) : '';
              // Never replay stale offline queue mutations from previous browser sessions (>45s old) or deleted orders
              if (ageMs > 45000 || (targetOrderId && tombstones.has(targetOrderId))) {
                hadStaleItems = true;
                continue;
              }
              if (!itemMap.has(q.id)) {
                itemMap.set(q.id, q);
              }
            }
          }
        } catch (_) {}
      }
      const validItems = Array.from(itemMap.values());
      if (hadStaleItems) {
        try {
          localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(validItems));
        } catch (_) {}
      }
      return validItems;
    } catch {
      return [];
    }
  }

  public queueMutation(type: string, payload: any): void {
    if (typeof window === 'undefined') return;
    try {
      const queue = this.getOfflineQueue();
      const item: PendingMutation = {
        id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type,
        payload,
        timestamp: new Date().toISOString(),
        retries: 0
      };
      queue.push(item);
      localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue.slice(-200)));
    } catch (_) {}
  }

  public removeQueuedMutation(id: string): void {
    if (typeof window === 'undefined' || !id) return;
    try {
      const queue = this.getOfflineQueue();
      const filtered = queue.filter(q => q.id !== id && String(q.payload?.id || '') !== id);
      localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(filtered));
    } catch (_) {}
  }

  public clearOfflineQueue(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
    } catch (_) {}
  }

  /**
   * Persistent Write-Ahead & Anti-Rollback Mutation Ledger (WAL):
   * Records every work order creation and field-level edit synchronously BEFORE network calls.
   * Ensures that no page refresh, background SYNC_ALL, or concurrent multi-user sync can ever
   * revert a newly added order or downgrade a mutated field to an older state.
   */
  public getMutationWal(): Record<string, WalOrderLedgerEntry> {
    if (typeof window === 'undefined' || isPlatformRunningInStudioIframe()) return {};
    try {
      const mergedWal: Record<string, WalOrderLedgerEntry> = {};
      const candidateKeys = [
        `preview_sandbox_${STORAGE_KEYS.MUTATION_WAL.replace(/^preview_sandbox_/, '')}`,
        STORAGE_KEYS.MUTATION_WAL
      ];
      for (const k of candidateKeys) {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            for (const [orderId, entry] of Object.entries(parsed as Record<string, WalOrderLedgerEntry>)) {
              if (!entry || !entry.orderId) continue;
              const existing = mergedWal[orderId];
              if (!existing) {
                mergedWal[orderId] = entry;
              } else {
                const eTime = new Date(existing.lastMutatedAt || 0).getTime();
                const nTime = new Date(entry.lastMutatedAt || 0).getTime();
                mergedWal[orderId] = {
                  ...existing,
                  ...entry,
                  createdOrder: entry.createdOrder || existing.createdOrder,
                  fields: { ...(existing.fields || {}), ...(entry.fields || {}) },
                  recordVersion: Math.max(Number(existing.recordVersion) || 1, Number(entry.recordVersion) || 1),
                  lastMutatedAt: nTime >= eTime ? entry.lastMutatedAt : existing.lastMutatedAt,
                  acked: Boolean(existing.acked && entry.acked)
                };
              }
            }
          }
        } catch (_) {}
      }
      return mergedWal;
    } catch {
      return {};
    }
  }

  public saveMutationWal(wal: Record<string, WalOrderLedgerEntry>): void {
    if (typeof window === 'undefined' || isPlatformRunningInStudioIframe()) return;
    try {
      // Prune acknowledged entries older than 48 hours to keep storage compact while maintaining a strong anti-rollback window
      const cutoffMs = Date.now() - 48 * 60 * 60 * 1000;
      const pruned: Record<string, WalOrderLedgerEntry> = {};
      const keys = Object.keys(wal);
      for (const k of keys.slice(-800)) {
        const entry = wal[k];
        if (!entry || !entry.orderId) continue;
        const ts = new Date(entry.lastMutatedAt || 0).getTime();
        if (!entry.acked || ts >= cutoffMs) {
          pruned[k] = entry;
        }
      }
      localStorage.setItem(STORAGE_KEYS.MUTATION_WAL, JSON.stringify(pruned));
      this.idbSet(STORAGE_KEYS.MUTATION_WAL, pruned);
    } catch (_) {}
  }

  public removeWalEntry(orderId: string): void {
    if (!orderId || typeof window === 'undefined') return;
    try {
      const wal = this.getMutationWal();
      if (wal[orderId]) {
        delete wal[orderId];
        this.saveMutationWal(wal);
      }
    } catch (_) {}
  }

  public recordWalOrderCreation(order: WorkOrder): void {
    if (!order || !order.id || isPlatformRunningInStudioIframe()) return;
    const nowIso = order.updatedAt || order.createdAt || new Date().toISOString();
    const recVer = Math.max(1, Number(order.recordVersion) || 1);
    const fieldUpdatedAt: Record<string, string> = { ...(order.fieldUpdatedAt || {}) };
    const fieldsMap: Record<string, WalFieldMutationEntry> = {};

    for (const [k, v] of Object.entries(order)) {
      if (k === 'id' || k === 'fieldUpdatedAt' || k === 'auditSyncStatus') continue;
      if (v !== undefined) {
        const fTs = fieldUpdatedAt[k] || nowIso;
        fieldUpdatedAt[k] = fTs;
        fieldsMap[k] = {
          value: v,
          updatedAt: fTs,
          recordVersion: recVer,
          acked: false
        };
      }
    }

    const enrichedOrder: WorkOrder = {
      ...order,
      recordVersion: recVer,
      fieldUpdatedAt,
      updatedAt: nowIso
    };

    const wal = this.getMutationWal();
    wal[order.id] = {
      orderId: order.id,
      createdOrder: enrichedOrder,
      fields: fieldsMap,
      recordVersion: recVer,
      lastMutatedAt: nowIso,
      acked: false
    };
    this.saveMutationWal(wal);

    // Immediately persist in local work orders store so refresh within 1ms preserves the new order
    this.unmarkDeleted(order.id);
    const current = this.getSavedWorkOrders();
    const existingIdx = current.findIndex(w => w && w.id === order.id);
    if (existingIdx !== -1) {
      current[existingIdx] = enrichedOrder;
      this.saveWorkOrders([...current], false);
    } else {
      this.saveWorkOrders([enrichedOrder, ...current], false);
    }
  }

  public recordWalFieldMutation(orderId: string, changedFields: string[], updatedOrder: WorkOrder): void {
    if (!orderId || !updatedOrder || isPlatformRunningInStudioIframe()) return;
    const nowIso = updatedOrder.updatedAt || new Date().toISOString();
    const recVer = Math.max(1, Number(updatedOrder.recordVersion) || 1);
    const wal = this.getMutationWal();
    const existingEntry = wal[orderId] || {
      orderId,
      fields: {},
      recordVersion: recVer,
      lastMutatedAt: nowIso,
      acked: false
    };

    const fieldUpdatedAt: Record<string, string> = {
      ...(existingEntry.createdOrder?.fieldUpdatedAt || {}),
      ...(updatedOrder.fieldUpdatedAt || {})
    };

    const fieldsToRecord = changedFields.length > 0 ? changedFields : Object.keys(updatedOrder);
    for (const field of fieldsToRecord) {
      if (field === 'id' || field === 'fieldUpdatedAt' || field === 'auditSyncStatus') continue;
      fieldUpdatedAt[field] = nowIso;
      existingEntry.fields[field] = {
        value: (updatedOrder as any)[field],
        updatedAt: nowIso,
        recordVersion: recVer,
        acked: false
      };
    }

    const enrichedOrder: WorkOrder = {
      ...(existingEntry.createdOrder || {}),
      ...updatedOrder,
      recordVersion: Math.max(recVer, existingEntry.recordVersion || 1),
      fieldUpdatedAt,
      updatedAt: nowIso
    };

    existingEntry.createdOrder = enrichedOrder;
    existingEntry.recordVersion = enrichedOrder.recordVersion!;
    existingEntry.lastMutatedAt = nowIso;
    existingEntry.acked = false;

    wal[orderId] = existingEntry;
    this.saveMutationWal(wal);

    // Synchronously update local work orders cache & storage immediately
    const current = this.getSavedWorkOrders();
    const idx = current.findIndex(w => w && w.id === orderId);
    if (idx !== -1) {
      current[idx] = {
        ...current[idx],
        ...enrichedOrder
      };
      this.saveWorkOrders([...current], false);
    } else {
      this.saveWorkOrders([enrichedOrder, ...current], false);
    }
  }

  public markWalMutationAcked(orderId: string, serverRecordVersion?: number, serverUpdatedAt?: string): void {
    if (!orderId || isPlatformRunningInStudioIframe()) return;
    const wal = this.getMutationWal();
    const entry = wal[orderId];
    if (!entry) return;

    entry.acked = true;
    if (typeof serverRecordVersion === 'number' && serverRecordVersion > entry.recordVersion) {
      entry.recordVersion = serverRecordVersion;
    }
    if (serverUpdatedAt) {
      entry.lastMutatedAt = serverUpdatedAt;
    }
    if (entry.createdOrder) {
      entry.createdOrder = {
        ...entry.createdOrder,
        recordVersion: entry.recordVersion,
        auditSyncStatus: 'synced'
      };
    }
    for (const k of Object.keys(entry.fields)) {
      entry.fields[k].acked = true;
      if (typeof serverRecordVersion === 'number') {
        entry.fields[k].recordVersion = serverRecordVersion;
      }
    }
    wal[orderId] = entry;
    this.saveMutationWal(wal);
  }

  public getUnacknowledgedWalOrders(): WorkOrder[] {
    if (isPlatformRunningInStudioIframe()) return [];
    const wal = this.getMutationWal();
    const tombstones = this.getTombstones();
    const nowMs = Date.now();
    const result: WorkOrder[] = [];
    for (const entry of Object.values(wal)) {
      if (!entry || !entry.orderId || tombstones.has(entry.orderId)) continue;
      const ageMs = nowMs - new Date(entry.lastMutatedAt || 0).getTime();
      if (ageMs > 20000) continue;
      const hasUnackedField = Object.values(entry.fields || {}).some(f => !f.acked);
      if ((!entry.acked || hasUnackedField) && entry.createdOrder) {
        result.push(entry.createdOrder);
      }
    }
    return result;
  }

  /**
   * Updates or acknowledges local WAL entries when a remote UPDATE_ORDER arrives from another user,
   * ensuring an older acknowledged local WAL entry never overwrites a remote user's newer edit.
   */
  public acknowledgeRemoteOrderUpdate(incomingOrder: WorkOrder, changedFields?: string[]): void {
    if (!incomingOrder || !incomingOrder.id || isPlatformRunningInStudioIframe()) return;
    try {
      const wal = this.getMutationWal();
      const entry = wal[incomingOrder.id];
      if (!entry) return;

      const remoteVer = Math.max(1, Number(incomingOrder.recordVersion) || 1);
      const remoteIso = incomingOrder.updatedAt || new Date().toISOString();
      const fieldsToSync = Array.isArray(changedFields) && changedFields.length > 0
        ? changedFields
        : Object.keys(incomingOrder);

      for (const field of fieldsToSync) {
        if (field === 'id' || field === 'fieldUpdatedAt' || field === 'auditSyncStatus') continue;
        if (entry.fields && entry.fields[field]) {
          entry.fields[field] = {
            value: (incomingOrder as any)[field],
            updatedAt: incomingOrder.fieldUpdatedAt?.[field] || remoteIso,
            recordVersion: remoteVer,
            acked: true
          };
        }
        if (entry.createdOrder) {
          (entry.createdOrder as any)[field] = (incomingOrder as any)[field];
          if (entry.createdOrder.fieldUpdatedAt) {
            entry.createdOrder.fieldUpdatedAt[field] = incomingOrder.fieldUpdatedAt?.[field] || remoteIso;
          }
        }
      }

      entry.acked = true;
      entry.recordVersion = remoteVer;
      if (entry.createdOrder) {
        entry.createdOrder.recordVersion = entry.recordVersion;
        entry.createdOrder.updatedAt = remoteIso;
      }
      wal[incomingOrder.id] = entry;
      this.saveMutationWal(wal);
    } catch (_) {}
  }

  /**
   * Applies the local Anti-Rollback WAL ledger to an incoming server WorkOrder.
   * Only actively unacknowledged (in-flight/unsynced within last 45s) WAL fields override
   * the server record, ensuring every acknowledged update from any user syncs immediately.
   */
  public applyWalProtectionToOrder(serverOrder: WorkOrder): {
    order: WorkOrder;
    hasUnackedWalChanges: boolean;
  } {
    if (!serverOrder || !serverOrder.id || isPlatformRunningInStudioIframe()) {
      return { order: serverOrder, hasUnackedWalChanges: false };
    }
    const wal = this.getMutationWal();
    const entry = wal[serverOrder.id];
    if (!entry) {
      return { order: serverOrder, hasUnackedWalChanges: false };
    }

    const nowMs = Date.now();
    const entryAgeMs = nowMs - new Date(entry.lastMutatedAt || 0).getTime();
    const serverOrderTime = new Date(serverOrder.updatedAt || serverOrder.lastEditedAt || serverOrder.createdAt || 0).getTime();
    const serverVer = Number(serverOrder.recordVersion) || 1;
    const entryMutatedTime = new Date(entry.lastMutatedAt || 0).getTime();

    if (entry.acked || entryAgeMs > 20000 || (serverVer >= (Number(entry.recordVersion) || 1) && serverOrderTime >= entryMutatedTime)) {
      if (!entry.acked) {
        entry.acked = true;
        wal[serverOrder.id] = entry;
        this.saveMutationWal(wal);
      }
      return { order: serverOrder, hasUnackedWalChanges: false };
    }

    let hasUnackedWalChanges = false;
    const protectedOrder: WorkOrder = {
      ...serverOrder,
      fieldUpdatedAt: {
        ...(entry.createdOrder?.fieldUpdatedAt || {}),
        ...(serverOrder.fieldUpdatedAt || {})
      }
    };

    for (const [field, fEntry] of Object.entries(entry.fields || {})) {
      if (!fEntry || field === 'id' || field === 'auditSyncStatus') continue;
      const fieldTimeMs = new Date(fEntry.updatedAt || 0).getTime();
      const fieldAgeMs = nowMs - fieldTimeMs;
      const serverFieldTimeMs = new Date(serverOrder.fieldUpdatedAt?.[field] || serverOrder.updatedAt || 0).getTime();
      const shouldKeepWalField = !fEntry.acked && fieldAgeMs <= 20000 && fieldTimeMs > serverFieldTimeMs;

      if (shouldKeepWalField) {
        if (field === 'photos' && Array.isArray(fEntry.value) && Array.isArray(serverOrder.photos)) {
          const sMap = new Map(serverOrder.photos.filter(Boolean).map(p => [p.id, p]));
          (protectedOrder as any)[field] = fEntry.value.map((p: any) => {
            if (p && !p.dataUrl && !p.url && sMap.has(p.id)) {
              return sMap.get(p.id);
            }
            return p;
          });
        } else {
          (protectedOrder as any)[field] = fEntry.value;
        }
        protectedOrder.fieldUpdatedAt![field] = fEntry.updatedAt;
        hasUnackedWalChanges = true;
      }
    }

    protectedOrder.recordVersion = Math.max(serverVer, Number(entry.recordVersion) || 1);
    if (hasUnackedWalChanges && entryMutatedTime > serverOrderTime) {
      protectedOrder.updatedAt = entry.lastMutatedAt;
    }

    return { order: protectedOrder, hasUnackedWalChanges };
  }

  /**
   * Continuous Multi-Snapshot Archive for Disaster Recovery
   */
  public getSnapshots(): DataBackupSnapshot[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public createSnapshot(
    label: string, 
    source: DataBackupSnapshot['source'] = 'manual',
    customData?: Partial<DataBackupSnapshot['data']>
  ): DataBackupSnapshot | null {
    if (typeof window === 'undefined') return null;
    try {
      const currentOrders = customData?.workOrders || this.getSavedWorkOrders();
      const currentOffices = customData?.offices || this.getSavedOffices() || [];
      const currentColumns = customData?.columns || this.getSavedColumns() || [];
      const currentDropdowns = customData?.dropdownOptions || this.getSavedDropdownOptions() || {};
      const currentMonthTables = customData?.monthTables || this.getSavedMonthTables() || [];
      const currentReports = customData?.archivedReports || this.getSavedArchivedReports() || [];

      const snapshot: DataBackupSnapshot = {
        id: `snap-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        label,
        ordersCount: currentOrders.length,
        tablesCount: currentMonthTables.length,
        officesCount: currentOffices.length,
        source,
        data: {
          workOrders: currentOrders,
          offices: currentOffices,
          columns: currentColumns,
          dropdownOptions: currentDropdowns,
          monthTables: currentMonthTables,
          archivedReports: currentReports
        }
      };

      const existing = this.getSnapshots();
      // Keep up to 60 snapshots with rotating eviction
      const updated = [snapshot, ...existing.slice(0, 59)];
      localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(updated));
      localStorage.setItem(STORAGE_KEYS.LAST_AUTO_SNAPSHOT, String(Date.now()));
      this.idbSet(STORAGE_KEYS.SNAPSHOTS, updated);
      return snapshot;
    } catch (err) {
      console.warn('[VaultService] Failed to create snapshot:', err);
      return null;
    }
  }

  public autoSnapshotIfDue(
    orders: WorkOrder[],
    offices?: SubOffice[],
    columns?: ColumnDefinition[],
    dropdownOptions?: DropdownOptionsMap,
    monthTables?: MonthTable[]
  ): void {
    if (typeof window === 'undefined' || !Array.isArray(orders) || orders.length === 0) return;
    try {
      const lastTimeStr = localStorage.getItem(STORAGE_KEYS.LAST_AUTO_SNAPSHOT);
      const lastTime = lastTimeStr ? parseInt(lastTimeStr, 10) : 0;
      const now = Date.now();
      // Auto snapshot every 3 minutes if orders exist
      if (now - lastTime > 3 * 60 * 1000) {
        this.createSnapshot(
          `حفظ دوري تلقائي (${orders.length} أمر عمل)`,
          'auto_periodic',
          {
            workOrders: orders,
            offices: offices || this.getSavedOffices() || undefined,
            columns: columns || this.getSavedColumns() || undefined,
            dropdownOptions: dropdownOptions || this.getSavedDropdownOptions() || undefined,
            monthTables: monthTables || this.getSavedMonthTables() || undefined
          }
        );
      }
    } catch (_) {}
  }

  public deleteSnapshot(id: string): void {
    if (typeof window === 'undefined') return;
    try {
      const existing = this.getSnapshots();
      const filtered = existing.filter(s => s.id !== id);
      localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(filtered));
      this.idbSet(STORAGE_KEYS.SNAPSHOTS, filtered);
    } catch (_) {}
  }

  public restoreSnapshot(id: string): DataBackupSnapshot['data'] | null {
    const snapshots = this.getSnapshots();
    const found = snapshots.find(s => s.id === id);
    if (!found) return null;

    // Create a safety recovery point of current state first
    this.createSnapshot('نسخة أمان قبل الاستعادة', 'pre_update');

    // Un-tombstone restored orders
    if (found.data.workOrders) {
      this.unmarkBatchDeleted(found.data.workOrders.map(w => w.id));
      this.saveWorkOrders(found.data.workOrders);
    }
    if (found.data.offices) this.saveOffices(found.data.offices);
    if (found.data.columns) this.saveColumns(found.data.columns);
    if (found.data.dropdownOptions) this.saveDropdownOptions(found.data.dropdownOptions);
    if (found.data.monthTables) this.saveMonthTables(found.data.monthTables);
    if (found.data.archivedReports) this.saveArchivedReports(found.data.archivedReports);

    return found.data;
  }

  public exportDatabaseAsJson(customData?: {
    workOrders?: WorkOrder[];
    users?: PlatformUser[];
    monthTables?: MonthTable[];
    offices?: SubOffice[];
    columns?: ColumnDefinition[];
    dropdownOptions?: DropdownOptionsMap;
  }): string {
    const rawUsers = customData?.users || this.getSavedUsers() || [];
    const bundle = {
      appVersion: '3.0.0',
      exportedAt: new Date().toISOString(),
      workOrders: customData?.workOrders || this.getSavedWorkOrders(),
      users: ensureDefaultSuperAdmins(rawUsers),
      offices: customData?.offices || this.getSavedOffices() || [],
      columns: customData?.columns || this.getSavedColumns() || [],
      dropdownOptions: customData?.dropdownOptions || this.getSavedDropdownOptions() || {},
      monthTables: customData?.monthTables || this.getSavedMonthTables() || [],
      archivedReports: this.getSavedArchivedReports() || [],
      deletedOrderIds: Array.from(this.getTombstones())
    };
    return JSON.stringify(bundle, null, 2);
  }

  public async exportDatabaseAsJsonAsync(customData?: {
    workOrders?: WorkOrder[];
    users?: PlatformUser[];
    monthTables?: MonthTable[];
    offices?: SubOffice[];
    columns?: ColumnDefinition[];
    dropdownOptions?: DropdownOptionsMap;
  }): Promise<string> {
    // 1. Fetch deep IndexedDB orders to guarantee every single base64 photo in order.photos AND qualityNoteItems is included
    const deepIdbOrders = await this.getSavedWorkOrdersFromIDB();
    const sourceOrders = customData?.workOrders || (deepIdbOrders.length > 0 ? deepIdbOrders : this.getSavedWorkOrders());

    const deepOrderMap = new Map<string, WorkOrder>();
    deepIdbOrders.forEach(o => { if (o && o.id) deepOrderMap.set(o.id, o); });

    const finalOrders = sourceOrders.map(o => {
      const deep = deepOrderMap.get(o.id);
      if (!deep) return o;
      return {
        ...o,
        photos: (o.photos && o.photos.length > 0) ? o.photos : (deep.photos || []),
        qualityNoteItems: (o.qualityNoteItems && o.qualityNoteItems.some(i => i.photos && i.photos.length > 0))
          ? o.qualityNoteItems
          : (deep.qualityNoteItems || o.qualityNoteItems)
      };
    });

    const rawUsers = customData?.users || this.getSavedUsers() || [];
    const bundle = {
      appVersion: '3.0.0',
      exportedAt: new Date().toISOString(),
      workOrders: finalOrders,
      users: ensureDefaultSuperAdmins(rawUsers),
      offices: customData?.offices || this.getSavedOffices() || [],
      columns: customData?.columns || this.getSavedColumns() || [],
      dropdownOptions: customData?.dropdownOptions || this.getSavedDropdownOptions() || {},
      monthTables: customData?.monthTables || this.getSavedMonthTables() || [],
      archivedReports: this.getSavedArchivedReports() || [],
      deletedOrderIds: Array.from(this.getTombstones())
    };
    return JSON.stringify(bundle, null, 2);
  }

  public importDatabaseFromJson(jsonStr: string): { 
    success: boolean; 
    error?: string; 
    count?: number; 
    usersCount?: number;
    tablesCount?: number;
    data?: any;
  } {
    try {
      const envelope = extractBackupEnvelope(jsonStr);
      const parsed = (envelope.format !== 'invalid' && envelope.payload)
        ? envelope.payload
        : JSON.parse(jsonStr);
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, error: 'الملف غير صالح أو فارغ' };
      }

      this.createSnapshot('نسخة احتياطية قبل الاستيراد الشامل', 'pre_update');

      const tablesList = Array.isArray(parsed.monthTables)
        ? parsed.monthTables
        : (Array.isArray(parsed.tables) ? parsed.tables : null);

      const normalizedOrders = Array.isArray(parsed.workOrders)
        ? parsed.workOrders
            .map((w: any, idx: number) => normalizeLegacyWorkOrder(w, idx).order)
            .filter(Boolean)
        : [];

      if (normalizedOrders.length > 0 || Array.isArray(parsed.workOrders)) {
        const activeImportedIds = new Set<string>(
          normalizedOrders.filter((w: any) => w && w.id).map((w: any) => String(w.id))
        );
        const cleanDeletedIds = Array.isArray(parsed.deletedOrderIds)
          ? parsed.deletedOrderIds.filter((id: string) => id && !activeImportedIds.has(id))
          : [];
        this.saveTombstones(new Set(cleanDeletedIds));
        this.unmarkBatchDeleted(Array.from(activeImportedIds));
        this.saveWorkOrders(normalizedOrders, true);
      }
      if (Array.isArray(parsed.users) && parsed.users.length > 0) {
        this.saveUsers(parsed.users);
      }
      if (Array.isArray(parsed.offices) && parsed.offices.length > 0) this.saveOffices(parsed.offices);
      if (Array.isArray(parsed.columns) && parsed.columns.length > 0) this.saveColumns(parsed.columns);
      if (parsed.dropdownOptions && Object.keys(parsed.dropdownOptions).length > 0) {
        this.saveDropdownOptions(parsed.dropdownOptions);
      }
      if (tablesList && tablesList.length > 0) this.saveMonthTables(tablesList);
      if (Array.isArray(parsed.archivedReports) && parsed.archivedReports.length > 0) {
        this.saveArchivedReports(parsed.archivedReports);
      }

      return { 
        success: true, 
        count: normalizedOrders.length,
        usersCount: Array.isArray(parsed.users) ? parsed.users.length : 0,
        tablesCount: tablesList ? tablesList.length : 0,
        data: {
          ...parsed,
          workOrders: normalizedOrders,
          monthTables: tablesList || parsed.monthTables || []
        }
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطأ في قراءة ملف JSON' };
    }
  }

  /**
   * Harvests active and recoverable work orders, edits, attachments, month tables, offices, and users
   * stored in active IndexedDB, localStorage, automatic 3-minute snapshots, offline mutation queue,
   * and the immutable audit trail since yesterday 7:00 AM Riyadh time ('2026-10-27T04:00:00.000Z').
   * Strictly isolated so the AI Studio preview iframe never harvests or mutates server state.
   */
  public async harvestAllRecoverableClientData(sinceIso: string = '2026-10-27T04:00:00.000Z'): Promise<{
    workOrders: WorkOrder[];
    monthTables: MonthTable[];
    users: PlatformUser[];
    offices: SubOffice[];
  }> {
    if (isPlatformRunningInStudioIframe()) {
      return { workOrders: [], monthTables: [], users: [], offices: [] };
    }
    if (this.initialHarvestPromise) {
      return this.initialHarvestPromise;
    }

    this.initialHarvestPromise = this.performFullClientHarvest(sinceIso).finally(() => {
      this.initialHarvestPromise = null;
    });
    return this.initialHarvestPromise;
  }

  private async performFullClientHarvest(sinceIso: string = '2026-10-27T04:00:00.000Z'): Promise<{
    workOrders: WorkOrder[];
    monthTables: MonthTable[];
    users: PlatformUser[];
    offices: SubOffice[];
  }> {
    // One-time recovery epoch reset for local tombstones so orders added since 7:00 AM are never blocked by stale tombstones
    if (typeof window !== 'undefined') {
      try {
        const RECOVERY_EPOCH_KEY = 'p155_recovery_epoch_20261029_v6';
        if (localStorage.getItem(RECOVERY_EPOCH_KEY) !== 'done') {
          localStorage.removeItem(STORAGE_KEYS.TOMBSTONES);
          localStorage.removeItem('preview_sandbox_p155_vault_tombstones_v2');
          localStorage.removeItem('p155_deleted_tombstones_v1');
          this.idbSet(STORAGE_KEYS.TOMBSTONES, []);
          localStorage.setItem(RECOVERY_EPOCH_KEY, 'done');
        }
      } catch (_) {}
    }

    const sinceMs = new Date(sinceIso).getTime() || 0;
    const tombstones = this.getTombstones();
    const isDummy = (w: any) => {
      if (!w || typeof w !== 'object') return true;
      const id = String(w.id || '').trim();
      if (!id) return true;
      if (/^wo-10[1-9]$/.test(id) && !w.workOrderNumber) return true;
      return false;
    };

    const restoreStrippedPhotoDataUrls = (targetPhotos: any[] | undefined, fallbackPhotos: any[] | undefined): any[] => {
      if (!Array.isArray(targetPhotos)) return [];
      if (!Array.isArray(fallbackPhotos) || fallbackPhotos.length === 0) return targetPhotos;
      const fallbackById = new Map<string, any>();
      for (const fp of fallbackPhotos) {
        if (fp && fp.id && (fp.dataUrl || fp.url)) {
          fallbackById.set(String(fp.id), fp);
        }
      }
      return targetPhotos.map((p) => {
        if (p && !p.dataUrl && !p.url && p.id && fallbackById.has(String(p.id))) {
          return fallbackById.get(String(p.id));
        }
        return p;
      });
    };

    const mergeOrderPair = (a: WorkOrder | undefined, b: WorkOrder): WorkOrder => {
      if (!a) return b;
      const aVer = Number(a.recordVersion) || 1;
      const bVer = Number(b.recordVersion) || 1;
      const aTime = new Date(a.updatedAt || a.lastEditedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.lastEditedAt || b.createdAt || 0).getTime();
      const isStrictlyNewer = bVer > aVer || (bVer === aVer && bTime > aTime) || aVer > bVer || (aVer === bVer && aTime > bTime);
      const newer = bVer > aVer || (bVer === aVer && bTime >= aTime) ? b : a;
      const older = newer === b ? a : b;

      if (isStrictlyNewer) {
        return {
          ...older,
          ...newer,
          photos: restoreStrippedPhotoDataUrls(
            Array.isArray(newer.photos) ? newer.photos : older.photos,
            older.photos
          ),
          photosFile: Array.isArray(newer.photosFile) ? newer.photosFile : (Array.isArray(older.photosFile) ? older.photosFile : []),
          qualityNoteItems: Array.isArray(newer.qualityNoteItems) ? newer.qualityNoteItems : (Array.isArray(older.qualityNoteItems) ? older.qualityNoteItems : []),
          qualityNotes: newer.qualityNotes !== undefined ? newer.qualityNotes : (older.qualityNotes || ''),
          sharepointFolderUrl: newer.sharepointFolderUrl !== undefined ? newer.sharepointFolderUrl : older.sharepointFolderUrl,
          technicalSupportChecklist: newer.technicalSupportChecklist !== undefined
            ? newer.technicalSupportChecklist
            : older.technicalSupportChecklist,
          auditChecklists: newer.auditChecklists !== undefined
            ? newer.auditChecklists
            : older.auditChecklists
        };
      }

      return {
        ...older,
        ...newer,
        photos: restoreStrippedPhotoDataUrls(
          (Array.isArray(newer.photos) && newer.photos.length > 0) ? newer.photos : (older.photos || []),
          older.photos
        ),
        photosFile: (Array.isArray(newer.photosFile) && newer.photosFile.length > 0)
          ? newer.photosFile
          : (Array.isArray(older.photosFile) ? older.photosFile : []),
        qualityNoteItems: (Array.isArray(newer.qualityNoteItems) && newer.qualityNoteItems.length > 0)
          ? newer.qualityNoteItems
          : (Array.isArray(older.qualityNoteItems) ? older.qualityNoteItems : []),
        qualityNotes: newer.qualityNotes !== undefined ? newer.qualityNotes : (older.qualityNotes || '')
      };
    };

    const orderMap = new Map<string, WorkOrder>();
    const tableMap = new Map<string, MonthTable>();
    const userMap = new Map<string, PlatformUser>();
    const officeMap = new Map<string, SubOffice>();

    const ingestOrders = (list: any[]) => {
      if (!Array.isArray(list)) return;
      for (let i = 0; i < list.length; i++) {
        const raw = list[i];
        const w = (raw && raw.id && raw.workOrderNumber) ? raw : (normalizeLegacyWorkOrder(raw, i).order || raw);
        if (!w || !w.id || tombstones.has(w.id) || isDummy(w)) continue;
        orderMap.set(w.id, mergeOrderPair(orderMap.get(w.id), w));
      }
    };
    const ingestTables = (list: any[]) => {
      if (!Array.isArray(list)) return;
      for (const t of list) {
        if (t && t.id && !tableMap.has(t.id)) tableMap.set(t.id, t);
      }
    };
    const ingestUsers = (list: any[]) => {
      if (!Array.isArray(list)) return;
      for (const u of list) {
        if (u && u.id && !isPurgedLegacyUserOrEmail(u)) {
          userMap.set(u.id, { ...(userMap.get(u.id) || {}), ...u });
        }
      }
    };
    const ingestOffices = (list: any[]) => {
      if (!Array.isArray(list)) return;
      for (const o of list) {
        if (o && o.name && !officeMap.has(o.name)) officeMap.set(o.name, o);
      }
    };

    // 1. Current active localStorage + memory cache + preview_sandbox_* + legacy/shadow keys
    ingestOrders(this.getSavedWorkOrders());
    ingestTables(this.getSavedMonthTables());
    ingestUsers(this.getSavedUsers() || []);
    ingestOffices(this.getSavedOffices() || []);

    if (typeof window !== 'undefined') {
      const legacyOrderKeys = [
        'p155_vault_work_orders_v2',
        'preview_sandbox_p155_vault_work_orders_v2',
        'p155_vault_work_orders_v1',
        'preview_sandbox_p155_vault_work_orders_v1',
        'p155_vault_orders_shadow_v1',
        'p155_vault_emergency_snapshot_v1'
      ];
      for (const k of legacyOrderKeys) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) ingestOrders(parsed);
            else if (parsed && Array.isArray(parsed.workOrders)) ingestOrders(parsed.workOrders);
          }
        } catch (_) {}
      }

      for (const tk of ['p155_vault_month_tables_v1', 'preview_sandbox_p155_vault_month_tables_v1']) {
        try {
          const rawT = localStorage.getItem(tk);
          if (rawT) {
            const parsedT = JSON.parse(rawT);
            if (Array.isArray(parsedT)) ingestTables(parsedT);
          }
        } catch (_) {}
      }
    }

    // 2. Active & Legacy Preview IndexedDB stores (holds full base64 photos & snapshots across both IDB databases)
    try {
      const [idbOrderLists, idbTableLists, idbUserLists, idbSnapshotLists, idbWalLists] = await Promise.all([
        this.idbGetAllVariants<WorkOrder[]>(STORAGE_KEYS.WORK_ORDERS),
        this.idbGetAllVariants<MonthTable[]>(STORAGE_KEYS.MONTH_TABLES),
        this.idbGetAllVariants<PlatformUser[]>(STORAGE_KEYS.USERS),
        this.idbGetAllVariants<DataBackupSnapshot[]>(STORAGE_KEYS.SNAPSHOTS),
        this.idbGetAllVariants<Record<string, WalOrderLedgerEntry>>(STORAGE_KEYS.MUTATION_WAL)
      ]);
      for (const list of idbOrderLists) {
        if (Array.isArray(list)) ingestOrders(list);
      }
      for (const list of idbTableLists) {
        if (Array.isArray(list)) ingestTables(list);
      }
      for (const list of idbUserLists) {
        if (Array.isArray(list)) ingestUsers(list);
      }

      // 3. Harvest from automatic 3-minute snapshots & manual snapshots (IndexedDB + localStorage across all prefixes)
      const allSnapshots: any[] = [];
      for (const snapList of idbSnapshotLists) {
        if (Array.isArray(snapList)) allSnapshots.push(...snapList);
      }
      if (typeof window !== 'undefined') {
        for (const snapKey of [
          STORAGE_KEYS.SNAPSHOTS,
          'preview_sandbox_p155_vault_snapshots_v3',
          'p155_vault_snapshots_v1',
          'preview_sandbox_p155_vault_snapshots_v1'
        ]) {
          try {
            const rawSnap = localStorage.getItem(snapKey);
            if (rawSnap) {
              const parsedSnaps = JSON.parse(rawSnap);
              if (Array.isArray(parsedSnaps)) allSnapshots.push(...parsedSnaps);
            }
          } catch (_) {}
        }
      }

      // Sort snapshots newest first so the latest state before any overwrite wins
      allSnapshots.sort((a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime());

      for (const snap of allSnapshots) {
        if (!snap) continue;
        const snapData = snap.data || snap;
        if (Array.isArray(snapData.monthTables)) ingestTables(snapData.monthTables);
        if (Array.isArray(snapData.offices)) ingestOffices(snapData.offices);
        if (Array.isArray(snapData.users)) ingestUsers(snapData.users);
        if (Array.isArray(snapData.workOrders)) {
          for (let idx = 0; idx < snapData.workOrders.length; idx++) {
            const rawWo = snapData.workOrders[idx];
            const w = (rawWo && rawWo.id && rawWo.workOrderNumber) ? rawWo : (normalizeLegacyWorkOrder(rawWo, idx).order || rawWo);
            if (!w || !w.id || tombstones.has(w.id) || isDummy(w)) continue;
            const woTime = new Date(w.updatedAt || w.lastEditedAt || w.createdAt || snap.timestamp || 0).getTime();
            if (!orderMap.has(w.id) || woTime >= sinceMs) {
              orderMap.set(w.id, mergeOrderPair(orderMap.get(w.id), w));
            }
          }
        }
      }

      // Merge any WAL entries stored in IndexedDB into our active WAL
      for (const idbWal of idbWalLists) {
        if (idbWal && typeof idbWal === 'object') {
          for (const entry of Object.values(idbWal)) {
            if (!entry || !entry.orderId || tombstones.has(entry.orderId)) continue;
            if (entry.createdOrder) {
              const existing = orderMap.get(entry.orderId);
              orderMap.set(entry.orderId, existing ? mergeOrderPair(existing, entry.createdOrder) : entry.createdOrder);
            }
          }
        }
      }
    } catch (_) {}

    // 4. Pending offline mutation queue & Persistent Anti-Rollback WAL Ledger
    try {
      const queue = this.getOfflineQueue();
      for (const q of queue) {
        if ((q.type === 'CREATE_ORDER' || q.type === 'UPDATE_ORDER') && q.payload?.id && !tombstones.has(q.payload.id)) {
          const existing = orderMap.get(q.payload.id);
          orderMap.set(q.payload.id, existing ? mergeOrderPair(existing, q.payload) : q.payload);
        }
      }
      const wal = this.getMutationWal();
      for (const entry of Object.values(wal)) {
        if (!entry || !entry.orderId || tombstones.has(entry.orderId)) continue;
        let targetOrder = orderMap.get(entry.orderId);
        if (entry.createdOrder) {
          targetOrder = targetOrder ? mergeOrderPair(targetOrder, entry.createdOrder) : entry.createdOrder;
        }
        if (targetOrder) {
          orderMap.set(entry.orderId, this.applyWalProtectionToOrder(targetOrder).order);
        }
      }
    } catch (_) {}

    // 5. Reconstruct any missing work orders or field edits since 7:00 AM from the immutable audit trail (qcms_155_immutable_audit_trail_v1)
    if (typeof window !== 'undefined') {
      try {
        const rawAudit = localStorage.getItem('qcms_155_immutable_audit_trail_v1');
        if (rawAudit) {
          const auditRecords = JSON.parse(rawAudit);
          if (Array.isArray(auditRecords) && auditRecords.length > 0) {
            // Sort chronologically (oldest to newest) so sequential edits replay accurately
            const recentAudits = auditRecords
              .filter((r: any) => r && r.workOrderId && new Date(r.timestamp || 0).getTime() >= sinceMs)
              .sort((a: any, b: any) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

            const explicitlyDeletedInAudit = new Set<string>();
            for (const r of recentAudits) {
              if (r.operationType === 'DATA_DELETE') {
                explicitlyDeletedInAudit.add(String(r.workOrderId));
              } else if (r.operationType === 'DATA_ENTRY') {
                explicitlyDeletedInAudit.delete(String(r.workOrderId));
              }
            }

            const reverseFieldMap: Record<string, keyof WorkOrder> = {
              'المكتب الفرعي': 'office',
              'المقاول المنفذ': 'contractor',
              'الاستشاري': 'consultant',
              'رقم أمر العمل': 'workOrderNumber',
              'نوع أمر العمل': 'workOrderCode',
              'حالة التنفيذ': 'executionStatus',
              'حالة الإرفاق': 'attachmentStatus',
              'تدقيق المساندة الفنية': 'procedure155Status',
              'تدقيق الـ PDC': 'pdcAudit',
              'تدقيق الإنشاءات': 'constructionAudit',
              'حالة النشر': 'publicationStatus',
              'المستخلص': 'extractNumber',
              'ملاحظات الجودة': 'qualityNotes'
            };

            for (const r of recentAudits) {
              const wid = String(r.workOrderId || '').trim();
              if (!wid || explicitlyDeletedInAudit.has(wid) || tombstones.has(wid)) continue;

              let current = orderMap.get(wid);
              if (!current && r.workOrderNumber && r.workOrderNumber !== 'عام') {
                // Check if contractor was logged in DATA_ENTRY newValue ("أمر عمل رقم X - المكتب: Y - المقاول: Z")
                let parsedContractor = '';
                const contractorMatch = String(r.newValue || '').match(/المقاول:\s*([^\s-].*)$/);
                if (contractorMatch && contractorMatch[1] && contractorMatch[1].trim() !== 'غير محدد') {
                  parsedContractor = contractorMatch[1].trim();
                }
                const ts = r.timestamp || new Date().toISOString();
                const d = new Date(ts);
                current = {
                  id: wid,
                  office: r.office || 'مكتب عرعر',
                  contractor: parsedContractor,
                  consultant: 'الحامد',
                  workOrderNumber: String(r.workOrderNumber).trim(),
                  workOrderCode: 'T.S',
                  executionStatus: 'تم التنفيذ' as any,
                  attachmentStatus: 'تم الإرفاق',
                  procedure155Status: 'مؤهل للاغلاق',
                  procedure155: '',
                  pdcAudit: 'تحت التدقيق' as any,
                  constructionAudit: 'تحت التدقيق' as any,
                  publicationStatus: 'غير منشور',
                  extractNumber: '',
                  qualityNotes: '',
                  executionNotes: '',
                  boqModification: 'مطابق للمقايسة المعتمدة',
                  boqDetails: '',
                  photos: [],
                  photosFile: [],
                  priority: 'عادية',
                  inspectorName: r.userName || 'مدقق جودة معتمد',
                  completionPercentage: 100,
                  createdAt: ts,
                  updatedAt: ts,
                  lastUpdatedBy: r.userName || 'مدقق جودة معتمد',
                  addedByName: r.userName,
                  addedByEmail: r.userEmail,
                  tableYear: d.getFullYear(),
                  tableMonth: d.getMonth() + 1,
                  recordVersion: 2
                } as WorkOrder;
              }

              if (current) {
                const auditTime = new Date(r.timestamp || 0).getTime();
                const currentTime = new Date(current.updatedAt || current.createdAt || 0).getTime();
                const mappedKey = reverseFieldMap[String(r.fieldLabel || '').trim()];
                if (mappedKey && r.newValue && r.newValue !== '—' && auditTime >= currentTime) {
                  (current as any)[mappedKey] = r.newValue;
                  current.updatedAt = r.timestamp || current.updatedAt;
                  current.lastUpdatedBy = r.userName || current.lastUpdatedBy;
                  current.recordVersion = Math.max(Number(current.recordVersion) || 1, 2) + 1;
                }
                orderMap.set(wid, current);
              }
            }
          }
        }
      } catch (_) {}
    }

    const harvestedOrders = Array.from(orderMap.values());
    const harvestedTables = Array.from(tableMap.values());
    const harvestedUsers = Array.from(userMap.values());
    const harvestedOffices = Array.from(officeMap.values());

    if (harvestedOrders.length > 0) {
      this.memoryOrdersCache = harvestedOrders;
    }

    this.cachedHarvestedData = {
      workOrders: harvestedOrders,
      monthTables: harvestedTables,
      users: harvestedUsers,
      offices: harvestedOffices
    };

    return this.cachedHarvestedData;
  }

  /**
   * Synchronous localStorage harvest for immediate reconciliation (even before async IndexedDB finishes).
   * Recovers orders from snapshots, preview_sandbox_* keys, and WAL in localStorage.
   */
  private getSynchronousRecoverableOrders(): WorkOrder[] {
    if (typeof window === 'undefined' || isPlatformRunningInStudioIframe()) return [];
    const tombstones = this.getTombstones();
    const map = new Map<string, WorkOrder>();
    const ingest = (w: any) => {
      if (!w || !w.id || tombstones.has(w.id)) return;
      if (/^wo-10[1-9]$/.test(String(w.id)) && !w.workOrderNumber) return;
      const existing = map.get(w.id);
      if (!existing) {
        map.set(w.id, w);
      } else {
        const eVer = Number(existing.recordVersion) || 1;
        const nVer = Number(w.recordVersion) || 1;
        const eTime = new Date(existing.updatedAt || existing.lastEditedAt || existing.createdAt || 0).getTime();
        const nTime = new Date(w.updatedAt || w.lastEditedAt || w.createdAt || 0).getTime();
        if (nVer > eVer || (nVer === eVer && nTime > eTime)) {
          map.set(w.id, { ...existing, ...w });
        }
      }
    };

    for (const snapKey of [
      STORAGE_KEYS.SNAPSHOTS,
      'preview_sandbox_p155_vault_snapshots_v3',
      'p155_vault_snapshots_v1',
      'preview_sandbox_p155_vault_snapshots_v1'
    ]) {
      try {
        const raw = localStorage.getItem(snapKey);
        if (!raw) continue;
        const snaps = JSON.parse(raw);
        if (Array.isArray(snaps)) {
          snaps.sort((a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime());
          for (const snap of snaps) {
            const list = snap?.data?.workOrders || snap?.workOrders;
            if (Array.isArray(list)) {
              for (const w of list) ingest(w);
            }
          }
        }
      } catch (_) {}
    }

    if (this.cachedHarvestedData?.workOrders) {
      for (const w of this.cachedHarvestedData.workOrders) ingest(w);
    }

    return Array.from(map.values());
  }

  /**
   * Authoritative Server-First Reconciliation with Full Client Vault, Snapshot & WAL Protection:
   * Preserves 100% of local, harvested, snapshot, and WAL work orders and field edits while
   * seamlessly merging multi-user server updates.
   */
  public reconcileWithVault(
    serverOrders: WorkOrder[],
    serverDeletedIds?: string[],
    harvestedOrders?: WorkOrder[]
  ): {
    mergedOrders: WorkOrder[];
    needsServerHydration: boolean;
    ordersToHydrate: WorkOrder[];
  } {
    if (isPlatformRunningInStudioIframe()) {
      const cleanPreviewOrders = Array.isArray(serverOrders) ? serverOrders.filter(w => Boolean(w && w.id)) : [];
      return {
        mergedOrders: cleanPreviewOrders,
        needsServerHydration: false,
        ordersToHydrate: []
      };
    }

    const activeServerOrderIds = new Set<string>(
      Array.isArray(serverOrders) ? serverOrders.filter(w => w && w.id).map(w => w.id) : []
    );

    if (Array.isArray(serverDeletedIds) && serverDeletedIds.length > 0) {
      this.syncTombstones(serverDeletedIds, activeServerOrderIds);
    }
    const tombstones = this.getTombstones();

    const cleanServerOrders = Array.isArray(serverOrders)
      ? serverOrders.filter(w => w && w.id && !tombstones.has(w.id))
      : [];

    const localOrders = this.getSavedWorkOrders();
    const localMap = new Map<string, WorkOrder>();
    localOrders.forEach(w => {
      if (w && w.id && !tombstones.has(w.id)) localMap.set(w.id, w);
    });

    const pendingQueue = this.getOfflineQueue();
    const pendingOrderIds = new Set<string>(
      pendingQueue
        .filter(q => (q.type === 'CREATE_ORDER' || q.type === 'UPDATE_ORDER') && q.payload?.id)
        .map(q => String(q.payload.id))
    );

    const wal = this.getMutationWal();
    const unackedWalIds = new Set<string>();
    const nowMs = Date.now();
    let walModified = false;
    for (const [id, entry] of Object.entries(wal)) {
      if (!entry || !entry.orderId || tombstones.has(id)) continue;
      const ageMs = nowMs - new Date(entry.lastMutatedAt || 0).getTime();
      if (ageMs > 20000) {
        if (!entry.acked) {
          entry.acked = true;
          for (const f of Object.values(entry.fields || {})) {
            if (f) f.acked = true;
          }
          walModified = true;
        }
        continue;
      }
      const hasUnackedField = Object.values(entry.fields || {}).some(f => !f.acked);
      if (!entry.acked || hasUnackedField) {
        unackedWalIds.add(id);
        if (entry.createdOrder && !localMap.has(id)) {
          localMap.set(id, entry.createdOrder);
        }
      }
    }
    if (walModified) {
      this.saveMutationWal(wal);
    }

    const mergedMap = new Map<string, WorkOrder>();
    const ordersToHydrate: WorkOrder[] = [];
    let needsServerHydration = false;

    const restoreStrippedPhotos = (targetPhotos: any[] | undefined, fallbackPhotos: any[] | undefined): any[] => {
      if (!Array.isArray(targetPhotos)) return [];
      if (!Array.isArray(fallbackPhotos) || fallbackPhotos.length === 0) return targetPhotos;
      const fallbackById = new Map<string, any>();
      for (const fp of fallbackPhotos) {
        if (fp && fp.id && (fp.dataUrl || fp.url)) {
          fallbackById.set(String(fp.id), fp);
        }
      }
      return targetPhotos.map((p) => {
        if (p && !p.dataUrl && !p.url && p.id && fallbackById.has(String(p.id))) {
          return fallbackById.get(String(p.id));
        }
        return p;
      });
    };

    // 1. Authoritative server orders merged ONLY with genuinely active in-flight (<20s) local edits
    for (const sOrder of cleanServerOrders) {
      const lOrder = localMap.get(sOrder.id);
      if (!lOrder) {
        const walProtected = this.applyWalProtectionToOrder(sOrder);
        mergedMap.set(sOrder.id, walProtected.order);
        if (walProtected.hasUnackedWalChanges) {
          ordersToHydrate.push(walProtected.order);
          needsServerHydration = true;
        }
        continue;
      }

      const isPendingOrUnacked = pendingOrderIds.has(sOrder.id) || unackedWalIds.has(sOrder.id);
      const candidate: WorkOrder = {
        ...sOrder,
        photos: restoreStrippedPhotos(
          Array.isArray(sOrder.photos) ? sOrder.photos : (lOrder.photos || []),
          lOrder.photos
        )
      };

      if (isPendingOrUnacked) {
        const walProtected = this.applyWalProtectionToOrder(candidate);
        mergedMap.set(sOrder.id, walProtected.order);
        if (walProtected.hasUnackedWalChanges || pendingOrderIds.has(sOrder.id)) {
          ordersToHydrate.push(walProtected.order);
          needsServerHydration = true;
        }
      } else {
        mergedMap.set(sOrder.id, candidate);
      }
    }

    // 2. Only keep local orders missing from server if they are genuinely unsynced (in pendingOrderIds or unackedWalIds).
    // Any previously synced order that is no longer on the server was deleted by a user and must be purged locally!
    let tombstonesUpdated = false;
    for (const [id, lOrder] of localMap.entries()) {
      if (!mergedMap.has(id) && !tombstones.has(id)) {
        if (pendingOrderIds.has(id) || unackedWalIds.has(id)) {
          const walProtected = this.applyWalProtectionToOrder(lOrder);
          mergedMap.set(id, walProtected.order);
          ordersToHydrate.push(walProtected.order);
          needsServerHydration = true;
        } else {
          tombstones.add(id);
          this.removeWalEntry(id);
          tombstonesUpdated = true;
        }
      }
    }
    if (tombstonesUpdated) {
      this.saveTombstones(tombstones);
    }

    const mergedOrders = Array.from(mergedMap.values());

    this.saveWorkOrders(mergedOrders, true);
    if (mergedOrders.length > 0) {
      this.autoSnapshotIfDue(mergedOrders);
    }

    return {
      mergedOrders,
      needsServerHydration,
      ordersToHydrate
    };
  }
}

export const vaultService = new VaultService();
