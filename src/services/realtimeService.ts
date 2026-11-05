import { 
  WorkOrder, 
  SubOffice, 
  RealtimeEvent, 
  ColumnDefinition, 
  DropdownOptionsMap, 
  ArchivedReportSnapshot, 
  MonthTable,
  ConnectedUserInfo,
  LiveNotificationItem,
  PlatformUser
} from '../types';
import { vaultService } from './vaultService';
import { notificationService } from './notificationService';
import { getAuthHeaders, getSavedCurrentUser, getSavedSessionToken, isPlatformRunningInStudioIframe } from '../utils/security';

export type SyncStatus = 'connected' | 'connecting' | 'disconnected';

export class RealtimeService {
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private clientId: string;
  public readonly isPreviewObserver: boolean;
  private listeners: Set<(event: RealtimeEvent) => void> = new Set();
  private statusListeners: Set<(status: SyncStatus, count: number, connectedUsers: ConnectedUserInfo[], latencyMs: number) => void> = new Set();
  private status: SyncStatus = 'connecting';
  private onlineUsersCount = 1;
  private connectedUsers: ConnectedUserInfo[] = [];
  private latencyMs = 12;
  private currentVersion = 0;
  private lastServerMessageTime = Date.now();
  private isReconciling = false;
  private broadcastChannel: BroadcastChannel | null = null;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private watchdogTimer: any = null;
  private pollIntervalTimer: any = null;
  private processedEventIds = new Set<string>();
  private inFlightFetchPromise: Promise<any> | null = null;
  private lastFetchTimestamp = 0;
  private cachedFetchData: any = null;
  private lastKnownOrdersMap = new Map<string, WorkOrder>();
  private inFlightOrderFields = new Map<string, Record<string, { value: any; expiresAt: number }>>();
  private activeMutationsCount = 0;
  private lastMutationTimestamp = 0;

  constructor() {
    this.isPreviewObserver = isPlatformRunningInStudioIframe();
    // Always generate a unique per-tab/per-window clientId in memory so duplicated browser tabs never collide
    this.clientId = (this.isPreviewObserver ? 'preview-' : 'user-') + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);
    
    const channelName = this.isPreviewObserver ? 'procedure155_preview_sandbox_channel' : 'procedure155_realtime_channel';
    const storagePulseKey = this.isPreviewObserver ? 'preview_sandbox_p155_sync_pulse' : 'p155_sync_pulse';

    // BroadcastChannel for instant local browser tab-to-tab sync
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(channelName);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.senderId !== this.clientId) {
            if (event.data.version && event.data.version > this.currentVersion) {
              this.currentVersion = event.data.version;
            }
            this.notifyListeners(event.data);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel not supported or error:', err);
      }
    }

    // LocalStorage storage event fallback for cross-tab sync (works across all browsers)
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === storagePulseKey && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            if (data && data.senderId !== this.clientId && data.event) {
              if (data.version && data.version > this.currentVersion) {
                this.currentVersion = data.version;
              }
              this.notifyListeners(data.event);
            }
          } catch (_) {}
        }
      });
    }

    if (typeof window !== 'undefined') {
      if (this.isPreviewObserver) {
        this.status = 'connected';
      } else {
        this.initConnection();
        this.initLifecycleAndVisibilityListeners();
        this.initWatchdogAndBackgroundPolling();
      }
    }
  }

  private firestoreLivePulseWriter: ((event: RealtimeEvent) => void) | null = null;
  private firestoreLivePulseUnsubscribe: (() => void) | null = null;

  private initFirestoreLiveSnapshot() {
    if (this.isPreviewObserver) return;
    // Direct client-side Firestore live_pulse is disabled by default because all real-time
    // multi-user synchronization is handled authoritatively via WebSocket (/ws), SSE (/api/events),
    // HTTP Delta Polling (/api/delta), and BroadcastChannel without consuming client Firestore read quota.
    if (typeof window === 'undefined' || window.localStorage?.getItem('sec_qcms_enable_direct_client_firestore_pulse') !== 'true') {
      return;
    }
    try {
      import('../firebase').then(({ db: firestoreDb, isFirestoreQuotaError, isFirestoreQuotaExhausted, markFirestoreQuotaExhausted }) => {
        if (!firestoreDb || isFirestoreQuotaExhausted()) return;
        import('firebase/firestore').then(({ doc, onSnapshot, setDoc }) => {
          if (isFirestoreQuotaExhausted()) return;
          const SERVER_VAULT_KEY = 'sec_qcms_155_vault_c497b379_4418_4a34_9623_987a3f506df0_v1';
          const pulseDocRef = doc(firestoreDb, 'serverVaults', SERVER_VAULT_KEY, 'live_pulse', 'sync');
          let isFirstSnapshot = true;

          this.firestoreLivePulseWriter = (event: RealtimeEvent) => {
            if (isFirestoreQuotaExhausted()) return;
            if (
              !event ||
              event.type === 'USER_PRESENCE' ||
              event.type === 'HEARTBEAT' ||
              event.type === 'PING' ||
              event.type === 'PONG' ||
              event.type === 'SYNC_ALL'
            ) {
              return;
            }
            try {
              let payloadJson = JSON.stringify(event.payload || {});
              if (payloadJson.length > 800000) {
                payloadJson = JSON.stringify({
                  type: event.type,
                  id: (event.payload as any)?.id,
                  truncated: true,
                  requiresFullSync: true,
                  version: event.version || (this.currentVersion + 1)
                });
              }
              const pulseVersion = Date.now();
              setDoc(pulseDocRef, {
                vaultKey: SERVER_VAULT_KEY,
                pulseId: 'sync',
                eventType: event.type,
                eventId: event.eventId || `evt-${Date.now()}`,
                senderId: this.clientId,
                senderName: event.senderName || '',
                senderEmail: event.senderEmail || '',
                senderRole: event.senderRole || '',
                senderDevice: event.senderDevice || '',
                version: pulseVersion,
                serverVersion: Number(event.version) || this.currentVersion,
                updatedAtIso: new Date().toISOString(),
                payloadJson
              }).catch((writeErr) => {
                if (isFirestoreQuotaError(writeErr)) {
                  markFirestoreQuotaExhausted();
                  this.firestoreLivePulseWriter = null;
                }
              });
            } catch (_) {}
          };

          const unsub = onSnapshot(pulseDocRef, (snap) => {
            if (isFirstSnapshot) {
              isFirstSnapshot = false;
              if (snap.exists()) {
                const initData = snap.data();
                if (initData?.eventId) {
                  this.markEventProcessed(String(initData.eventId));
                }
              }
              return;
            }

            if (!snap.exists()) return;
            const data = snap.data();
            if (data && data.senderId !== this.clientId && data.payloadJson) {
              try {
                const payload = JSON.parse(data.payloadJson);

                if (payload?.truncated || payload?.requiresFullSync || data.eventType === 'SYNC_ALL') {
                  this.reconcileWithServer(true).catch(() => {});
                  return;
                }

                const event: RealtimeEvent = {
                  eventId: data.eventId || `pulse-${Date.now()}`,
                  type: data.eventType || 'UPDATE_ORDER',
                  payload,
                  senderId: data.senderId,
                  senderName: data.senderName,
                  senderEmail: data.senderEmail,
                  senderRole: data.senderRole,
                  senderDevice: data.senderDevice,
                  timestamp: data.updatedAtIso || new Date().toISOString()
                };
                this.notifyListeners(event);
              } catch (_) {}
            }
          }, (err) => {
            if (isFirestoreQuotaError(err)) {
              markFirestoreQuotaExhausted();
            }
            this.firestoreLivePulseWriter = null;
            if (this.firestoreLivePulseUnsubscribe) {
              try {
                this.firestoreLivePulseUnsubscribe();
              } catch (_) {}
              this.firestoreLivePulseUnsubscribe = null;
            }
          });
          this.firestoreLivePulseUnsubscribe = unsub;
        });
      });
    } catch (_) {}
  }

  private generateEventId(prefix = 'evt'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private markEventProcessed(eventId?: string): void {
    if (!eventId) return;
    this.processedEventIds.add(eventId);
    if (this.processedEventIds.size > 600) {
      const first = this.processedEventIds.values().next().value;
      if (first) this.processedEventIds.delete(first);
    }
  }

  private getHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      ...getAuthHeaders(),
      'x-realtime-client-id': this.clientId,
      ...(this.isPreviewObserver ? { 'x-studio-preview-observer': 'true' } : {}),
      ...additionalHeaders
    };
  }

  private getSenderMeta() {
    const user = getSavedCurrentUser();
    const token = getSavedSessionToken();
    const identity = notificationService.getUserIdentity();
    const device = notificationService.detectDeviceName();
    const senderName = (user?.displayName || user?.username || identity.userName || 'مستخدم معتمد').trim();
    const senderEmail = (user?.email || identity.userEmail || '').trim();
    const senderRole = (user?.roleTitle || identity.userRole || 'مستخدم المنظومة').trim();
    return {
      senderId: this.clientId,
      senderName,
      senderEmail,
      senderRole,
      senderDevice: device,
      ...(token ? { authToken: token } : {})
    };
  }

  public reconnectWithAuth(): void {
    this.initConnection();
    this.reconcileWithServer(true).catch(() => {});
  }

  public getClientId(): string {
    return this.clientId;
  }

  public getCurrentVersion(): number {
    return this.currentVersion;
  }

  public getConnectedUsers(): ConnectedUserInfo[] {
    return [...this.connectedUsers];
  }

  public getLatencyMs(): number {
    return this.latencyMs;
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  public getOnlineCount(): number {
    return this.onlineUsersCount;
  }

  public updatePresenceIdentity(): void {
    this.announceUserIdentity();
  }

  public async forceSyncNow(): Promise<void> {
    await this.reconcileWithServer(true);
  }

  public recordKnownOrders(orders: WorkOrder[]): void {
    if (!Array.isArray(orders)) return;
    for (const o of orders) {
      if (o && o.id) {
        this.lastKnownOrdersMap.set(o.id, o);
      }
    }
  }

  public hasActiveInFlightEdits(orderId?: string): boolean {
    const now = Date.now();
    if (orderId) {
      const fields = this.inFlightOrderFields.get(orderId);
      if (!fields) return false;
      for (const [k, entry] of Object.entries(fields)) {
        if (entry.expiresAt > now) return true;
        delete fields[k];
      }
      if (Object.keys(fields).length === 0) {
        this.inFlightOrderFields.delete(orderId);
      }
      return false;
    }
    if (this.activeMutationsCount > 0) return true;
    for (const [id, fields] of this.inFlightOrderFields.entries()) {
      for (const [k, entry] of Object.entries(fields)) {
        if (entry.expiresAt <= now) {
          delete fields[k];
        }
      }
      if (Object.keys(fields).length === 0) {
        this.inFlightOrderFields.delete(id);
      } else {
        return true;
      }
    }
    return false;
  }

  /**
   * Merges an incoming server/broadcast WorkOrder with any in-flight field edits
   * currently being saved by this user, guaranteeing zero rollback or UI flicker.
   * Supports field-level isolation when merging remote updates from concurrent users.
   */
  public mergeIncomingOrderWithInFlight(
    existing: WorkOrder | undefined,
    incoming: WorkOrder,
    isRemote: boolean = false
  ): WorkOrder {
    if (!existing) {
      const walChecked = vaultService.applyWalProtectionToOrder(incoming).order;
      this.lastKnownOrdersMap.set(walChecked.id, walChecked);
      return walChecked;
    }

    let changedKeys = Array.isArray((incoming as any).changedFields) && (incoming as any).changedFields.length > 0
      ? ((incoming as any).changedFields as string[])
      : null;

    if (!changedKeys && isRemote && existing) {
      const diffKeys: string[] = [];
      const ignored = new Set(['id', 'updatedAt', 'lastEditedAt', 'lastUpdatedBy', 'recordVersion', 'fieldUpdatedAt', 'auditSyncStatus']);
      const isFieldDifferentFast = (key: string, a: any, b: any): boolean => {
        if (a === b) return false;
        if (a == null || b == null) return a !== b;
        if (typeof a !== 'object' && typeof b !== 'object') return a !== b;
        if (key === 'photos' || key === 'photosFile') {
          if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return true;
            for (let i = 0; i < a.length; i++) {
              if (a[i]?.id !== b[i]?.id || a[i]?.name !== b[i]?.name || a[i]?.caption !== b[i]?.caption) return true;
            }
            return false;
          }
        }
        return JSON.stringify(a) !== JSON.stringify(b);
      };
      for (const k of Object.keys(incoming)) {
        if (!ignored.has(k) && isFieldDifferentFast(k, (incoming as any)[k], (existing as any)[k])) {
          diffKeys.push(k);
        }
      }
      if (diffKeys.length > 0) {
        changedKeys = diffKeys;
      }
    }

    const existingFieldTimes = existing.fieldUpdatedAt || {};
    const incomingFieldTimes = incoming.fieldUpdatedAt || {};
    const mergedFieldTimes: Record<string, string> = {
      ...existingFieldTimes,
      ...incomingFieldTimes
    };

    // Start with existing as baseline
    const base: WorkOrder = { ...existing };

    if (changedKeys && isRemote) {
      // Atomic field-level patch from concurrent remote user / Firestore event: apply changed fields immediately
      for (const key of changedKeys) {
        (base as any)[key] = (incoming as any)[key];
        mergedFieldTimes[key] = incomingFieldTimes[key] || incoming.updatedAt || new Date().toISOString();
      }
      base.recordVersion = Math.max(Number(existing.recordVersion) || 1, Number(incoming.recordVersion) || 1);
      base.updatedAt = incoming.updatedAt || new Date().toISOString();
      if (incoming.lastUpdatedBy) base.lastUpdatedBy = incoming.lastUpdatedBy;
    } else {
      // General authoritative merge: overlay incoming onto existing unconditionally
      Object.assign(base, incoming);
      base.recordVersion = Math.max(Number(existing.recordVersion) || 1, Number(incoming.recordVersion) || 1);
      base.updatedAt = incoming.updatedAt || new Date().toISOString();
      if (incoming.lastUpdatedBy) base.lastUpdatedBy = incoming.lastUpdatedBy;
    }

    base.fieldUpdatedAt = mergedFieldTimes;

    // Restore stripped base64 url/dataUrl for photos that still exist by ID in base.photos
    // (Never resurrect photos or photosFile that were explicitly deleted to empty array [])
    if (Array.isArray(base.photos) && base.photos.length > 0 && Array.isArray(existing.photos) && existing.photos.length > 0) {
      const existingPhotoMap = new Map(existing.photos.filter(Boolean).map(p => [p.id, p]));
      base.photos = base.photos.map(p => {
        if (!p) return p;
        const prev = existingPhotoMap.get(p.id);
        if (prev) {
          const nextPhoto: any = { ...prev, ...p };
          if (!p.url && prev.url) nextPhoto.url = prev.url;
          if (!(p as any).dataUrl && (prev as any).dataUrl) nextPhoto.dataUrl = (prev as any).dataUrl;
          return nextPhoto;
        }
        return p;
      });
    }

    // Deep merge nested objects & audit checklists per category so concurrent users auditing different categories never overwrite each other
    if (existing.customFields || incoming.customFields) {
      base.customFields = {
        ...(existing.customFields || {}),
        ...(incoming.customFields || {})
      };
    }
    if (existing.cellStyles || incoming.cellStyles) {
      base.cellStyles = {
        ...(existing.cellStyles || {}),
        ...(incoming.cellStyles || {})
      };
    }
    if (existing.technicalSupportChecklist || incoming.technicalSupportChecklist) {
      base.technicalSupportChecklist = {
        ...(existing.technicalSupportChecklist || {}),
        ...(incoming.technicalSupportChecklist || {})
      };
    }
    if (existing.auditChecklists || incoming.auditChecklists) {
      base.auditChecklists = {
        ...(existing.auditChecklists || {}),
        ...(incoming.auditChecklists || {})
      };
    }

    const mergeAuditColumnPerCategory = (exAudit: any, incAudit: any) => {
      if (!exAudit) return incAudit;
      if (!incAudit) return exAudit;
      const mergedAudit: any = { ...exAudit, ...incAudit };

      // Merge primary 9-item supportChecklist & evaluatedKeys per item using itemUpdatedAt
      if (exAudit.supportChecklist || incAudit.supportChecklist) {
        const exTimes = exAudit.itemUpdatedAt || {};
        const incTimes = incAudit.itemUpdatedAt || {};
        const mergedTimes: Record<string, string> = { ...exTimes, ...incTimes };
        const mergedSupport: Record<string, string> = {
          ...(exAudit.supportChecklist || {}),
          ...(incAudit.supportChecklist || {})
        };
        const exEvalSet = new Set<string>(Array.isArray(exAudit.evaluatedKeys) ? exAudit.evaluatedKeys : []);
        const incEvalSet = new Set<string>(Array.isArray(incAudit.evaluatedKeys) ? incAudit.evaluatedKeys : []);
        const mergedEvalSet = new Set<string>([...exEvalSet, ...incEvalSet]);

        const allItemKeys = new Set<string>([
          ...Object.keys(exAudit.supportChecklist || {}),
          ...Object.keys(incAudit.supportChecklist || {}),
          ...Object.keys(exTimes),
          ...Object.keys(incTimes)
        ]);

        for (const itemKey of allItemKeys) {
          const tEx = exTimes[itemKey] ? new Date(exTimes[itemKey]).getTime() : 0;
          const tInc = incTimes[itemKey] ? new Date(incTimes[itemKey]).getTime() : 0;
          if (tEx > tInc) {
            if (exAudit.supportChecklist && exAudit.supportChecklist[itemKey] !== undefined) {
              mergedSupport[itemKey] = exAudit.supportChecklist[itemKey];
            }
            if (exEvalSet.has(itemKey)) mergedEvalSet.add(itemKey);
            else mergedEvalSet.delete(itemKey);
            mergedTimes[itemKey] = exTimes[itemKey];
          } else if (tInc > tEx) {
            if (incAudit.supportChecklist && incAudit.supportChecklist[itemKey] !== undefined) {
              mergedSupport[itemKey] = incAudit.supportChecklist[itemKey];
            }
            if (incEvalSet.has(itemKey)) mergedEvalSet.add(itemKey);
            else mergedEvalSet.delete(itemKey);
            mergedTimes[itemKey] = incTimes[itemKey];
          }
        }

        mergedAudit.supportChecklist = mergedSupport;
        mergedAudit.evaluatedKeys = Array.from(mergedEvalSet);
        mergedAudit.itemUpdatedAt = mergedTimes;
      }

      for (const k of Object.keys({ ...exAudit, ...incAudit })) {
        if (
          k === 'mainStatus' ||
          k === 'lastUpdatedAt' ||
          k === 'lastUpdatedBy' ||
          k === 'supportChecklist' ||
          k === 'evaluatedKeys' ||
          k === 'itemUpdatedAt' ||
          k === 'compliancePercentage'
        ) {
          continue;
        }
        const exCat = exAudit[k];
        const incCat = incAudit[k];
        if (exCat && typeof exCat === 'object' && incCat && typeof incCat === 'object') {
          const exTime = exCat.evaluatedAt ? new Date(exCat.evaluatedAt).getTime() : 0;
          const incTime = incCat.evaluatedAt ? new Date(incCat.evaluatedAt).getTime() : 0;
          const exItemsCount = exCat.items ? Object.keys(exCat.items).length : 0;
          const incItemsCount = incCat.items ? Object.keys(incCat.items).length : 0;
          if (exTime > incTime || (exTime === incTime && exItemsCount > incItemsCount)) {
            mergedAudit[k] = exCat;
          } else {
            mergedAudit[k] = incCat;
          }
        } else {
          mergedAudit[k] = incCat !== undefined ? incCat : exCat;
        }
      }
      return mergedAudit;
    };

    if (existing.pdcAudit && incoming.pdcAudit && typeof existing.pdcAudit === 'object' && typeof incoming.pdcAudit === 'object') {
      base.pdcAudit = mergeAuditColumnPerCategory(existing.pdcAudit, incoming.pdcAudit);
    }
    if (existing.constructionAudit && incoming.constructionAudit && typeof existing.constructionAudit === 'object' && typeof incoming.constructionAudit === 'object') {
      base.constructionAudit = mergeAuditColumnPerCategory(existing.constructionAudit, incoming.constructionAudit);
    }
    if (existing.technicalSupportAudit && incoming.technicalSupportAudit) {
      const exTs: any = existing.technicalSupportAudit;
      const incTs: any = incoming.technicalSupportAudit;
      const exTimes = exTs.itemUpdatedAt || {};
      const incTimes = incTs.itemUpdatedAt || {};
      const mergedTimes: Record<string, string> = { ...exTimes, ...incTimes };
      const exEvalSet = new Set<string>(Array.isArray(exTs.evaluatedKeys) ? exTs.evaluatedKeys : []);
      const incEvalSet = new Set<string>(Array.isArray(incTs.evaluatedKeys) ? incTs.evaluatedKeys : []);
      const mergedEvalSet = new Set<string>([...exEvalSet, ...incEvalSet]);
      const allKeys = new Set<string>([...Object.keys(exTimes), ...Object.keys(incTimes)]);
      for (const k of allKeys) {
        const tEx = exTimes[k] ? new Date(exTimes[k]).getTime() : 0;
        const tInc = incTimes[k] ? new Date(incTimes[k]).getTime() : 0;
        if (tEx > tInc) {
          if (exEvalSet.has(k)) mergedEvalSet.add(k);
          else mergedEvalSet.delete(k);
          mergedTimes[k] = exTimes[k];
          if ((existing as any)[k] !== undefined) {
            (base as any)[k] = (existing as any)[k];
          }
        } else if (tInc > tEx) {
          if (incEvalSet.has(k)) mergedEvalSet.add(k);
          else mergedEvalSet.delete(k);
          mergedTimes[k] = incTimes[k];
          if ((incoming as any)[k] !== undefined) {
            (base as any)[k] = (incoming as any)[k];
          }
        }
      }
      base.technicalSupportAudit = {
        ...exTs,
        ...incTs,
        evaluatedKeys: Array.isArray(incTs.evaluatedKeys) && Object.keys(exTimes).length === 0 && Object.keys(incTimes).length === 0
          ? incTs.evaluatedKeys
          : Array.from(mergedEvalSet),
        itemUpdatedAt: mergedTimes
      } as any;
    }

    // Apply persistent Anti-Rollback WAL ledger protection
    const walProtected = vaultService.applyWalProtectionToOrder(base).order;

    // Re-apply any active in-flight edits on top so local typing is never reverted
    const now = Date.now();
    const inFlight = this.inFlightOrderFields.get(incoming.id);
    if (inFlight) {
      for (const [field, entry] of Object.entries(inFlight)) {
        if (entry.expiresAt > now) {
          (walProtected as any)[field] = entry.value;
        } else {
          delete inFlight[field];
        }
      }
      if (Object.keys(inFlight).length === 0) {
        this.inFlightOrderFields.delete(incoming.id);
      }
    }

    this.lastKnownOrdersMap.set(walProtected.id, walProtected);
    return walProtected;
  }

  /**
   * Broadcast updated user identity to all connected peers immediately
   */
  public announceUserIdentity(triggerReconcile = true): void {
    if (this.isPreviewObserver) return;
    const meta = this.getSenderMeta();
    const presenceEvent: RealtimeEvent = {
      type: 'USER_PRESENCE',
      payload: {
        clientId: this.clientId,
        userName: meta.senderName,
        userRole: meta.senderRole,
        device: meta.senderDevice
      },
      ...meta,
      timestamp: new Date().toISOString()
    };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(presenceEvent));
      } catch (_) {}
    }
    if (triggerReconcile) {
      this.reconcileWithServer(false);
    }
  }

  /**
   * Listen for user returning to the tab, window focusing, or coming back online.
   * Instantly re-verifies socket connection and pulls any remote delta.
   */
  private initLifecycleAndVisibilityListeners() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.ensureSocketAlive();
        this.reconcileWithServer(false);
        this.flushOfflineMutationQueue();
      }
    });

    window.addEventListener('focus', () => {
      this.ensureSocketAlive();
      this.reconcileWithServer(false);
      this.flushOfflineMutationQueue();
    });

    window.addEventListener('online', () => {
      this.ensureSocketAlive();
      this.reconcileWithServer(true);
      this.flushOfflineMutationQueue();
    });

    const flushUnackedWalOnExit = () => {
      try {
        if (this.activeMutationsCount <= 0) return;
        const unacked = vaultService.getUnacknowledgedWalOrders();
        if (unacked.length > 0) {
          const lightOrders = unacked.map(w => ({
            ...w,
            photos: Array.isArray(w.photos) ? w.photos.map(p => ({ ...p, dataUrl: '', url: p?.url?.startsWith('data:') ? '' : p?.url })) : [],
            photosFile: Array.isArray(w.photosFile)
              ? w.photosFile.map((f: any) => ({ ...f, dataUrl: '' }))
              : (w as any).photosFile && typeof (w as any).photosFile === 'object'
              ? { ...(w as any).photosFile, dataUrl: '' }
              : w.photosFile,
            photosFileData: undefined
          }));
          const bodyStr = JSON.stringify({
            workOrders: lightOrders,
            senderId: this.clientId
          });
          if (bodyStr.length < 60000) {
            fetch('/api/sync/hydrate', {
              method: 'POST',
              headers: this.getHeaders({ 'Content-Type': 'application/json' }),
              body: bodyStr,
              keepalive: true
            }).catch(() => {});
          }
        }
      } catch (_) {}
    };

    window.addEventListener('beforeunload', flushUnackedWalOnExit);
    window.addEventListener('pagehide', flushUnackedWalOnExit);
  }

  private ensureSocketAlive() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.initConnection();
    } else {
      try {
        const meta = this.getSenderMeta();
        this.ws.send(JSON.stringify({
          type: 'PING',
          ...meta,
          timestamp: new Date().toISOString()
        }));
      } catch (_) {
        this.initConnection();
      }
    }
  }

  /**
   * Flushes any mutations that were queued while offline or during connection drops.
   */
  public async flushOfflineMutationQueue() {
    if (this.isPreviewObserver) return;
    const queue = vaultService.getOfflineQueue();
    const meta = this.getSenderMeta();

    for (const item of queue) {
      try {
        if (item.type === 'CREATE_ORDER') {
          const res = await fetch('/api/work-orders', {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ ...item.payload, ...meta, eventId: item.id })
          });
          if (res.ok || res.status === 409) {
            if (res.ok && item.payload?.id) {
              vaultService.markWalMutationAcked(item.payload.id);
            }
            vaultService.removeQueuedMutation(item.id);
          }
        } else if (item.type === 'UPDATE_ORDER') {
          const res = await fetch(`/api/work-orders/${item.payload.id}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify({ ...item.payload, ...meta, eventId: item.id })
          });
          if (res.ok || res.status === 409) {
            if (res.ok && item.payload?.id) {
              vaultService.markWalMutationAcked(item.payload.id);
            }
            vaultService.removeQueuedMutation(item.id);
          }
        } else if (item.type === 'DELETE_ORDER') {
          const res = await fetch(`/api/work-orders/${item.payload.id}?senderId=${this.clientId}&eventId=${item.id}`, {
            method: 'DELETE',
            headers: this.getHeaders()
          });
          if (res.ok || res.status === 404) {
            vaultService.removeQueuedMutation(item.id);
          }
        }
      } catch (err) {
        console.warn('[Realtime] Failed flushing queued mutation:', item.id, err);
        break;
      }
    }

    // Also flush any unacknowledged WAL orders if no active mutation is currently in flight
    if (this.activeMutationsCount === 0) {
      const unackedWalOrders = vaultService.getUnacknowledgedWalOrders();
      if (unackedWalOrders.length > 0) {
        try {
          const ok = await this.hydrateServer({ workOrders: unackedWalOrders });
          if (ok) {
            for (const wo of unackedWalOrders) {
              vaultService.markWalMutationAcked(wo.id, wo.recordVersion, wo.updatedAt);
            }
          }
        } catch (_) {}
      }
    }
  }

  /**
   * Background watchdog and fast delta version-poll loop:
   * 1. Pings the server every 12s to keep WebSocket connections open across proxies.
   * 2. Polls /api/sync/version every 1.5s as an ultra-fast delta catch-up check and flushes any pending WAL entries.
   */
  private initWatchdogAndBackgroundPolling() {
    if (this.isPreviewObserver) return;
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    if (this.pollIntervalTimer) clearInterval(this.pollIntervalTimer);

    this.watchdogTimer = setInterval(() => {
      const now = Date.now();
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          const meta = this.getSenderMeta();
          this.ws.send(JSON.stringify({
            type: 'PING',
            ...meta,
            timestamp: new Date().toISOString()
          }));
        } catch (_) {}
      }

      if (now - this.lastServerMessageTime > 20000) {
        this.initConnection();
      }
      this.flushOfflineMutationQueue().catch(() => {});
    }, 6000);

    // High-speed multi-user delta poll so any change by any user is caught and broadcast immediately
    let lastPollTime = 0;
    this.pollIntervalTimer = setInterval(() => {
      if (this.activeMutationsCount > 0) return;
      const now = Date.now();
      const wsOpen = Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
      const targetInterval = wsOpen ? 4500 : 1200;
      if (now - lastPollTime >= targetInterval) {
        lastPollTime = now;
        this.reconcileWithServer(false);
      }
    }, 1200);
  }

  /**
   * Check server version, replay any missed delta events (so notifications fire!),
   * and reconcile full state when needed.
   */
  public async reconcileWithServer(force = false): Promise<void> {
    if (this.isPreviewObserver) return;
    if (this.isReconciling && !force) return;
    this.isReconciling = true;
    const startTs = performance.now();

    try {
      const meta = this.getSenderMeta();
      const params = new URLSearchParams({
        _t: String(Date.now()),
        sinceVersion: String(this.currentVersion),
        clientId: this.clientId,
        userName: meta.senderName,
        userRole: meta.senderRole,
        device: meta.senderDevice,
        ...(this.isPreviewObserver ? { isPreviewObserver: 'true' } : {})
      });

      const vRes = await fetch(`/api/sync/version?${params.toString()}`, {
        cache: 'no-store',
        headers: this.getHeaders({ 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' })
      });

      if (vRes.ok) {
        this.latencyMs = Math.max(1, Math.round(performance.now() - startTs));
        this.lastServerMessageTime = Date.now();
        if (this.status !== 'connected') {
          this.setStatus('connected');
        }

        const vData = await vRes.json();
        const serverVer = Number(vData.version) || 0;

        if (vData.onlineUsers || Array.isArray(vData.connectedUsers)) {
          this.onlineUsersCount = vData.onlineUsers || 1;
          if (Array.isArray(vData.connectedUsers)) {
            this.connectedUsers = vData.connectedUsers;
          }
          this.emitStatusChange();
        }

        // Replay any missed granular events so notifications and delta state updates fire!
        let requiresFullFetch = force || (this.currentVersion === 0 && serverVer > 0);
        if (Array.isArray(vData.missedEvents) && vData.missedEvents.length > 0) {
          for (const missedEvt of vData.missedEvents as RealtimeEvent[]) {
            if (missedEvt.payload?.requiresFullSync) {
              requiresFullFetch = true;
            }
            this.notifyListeners(missedEvt);
          }
          if (serverVer > 0) {
            this.currentVersion = serverVer;
          }
        } else if (serverVer > 0 && serverVer !== this.currentVersion) {
          // Any version divergence without missedEvents requires a full fetch so edits, tables, offices, and deletions always sync
          requiresFullFetch = true;
        }

        // Do not overwrite state with a full SYNC_ALL while a local mutation is actively in flight or within 400ms of a local save
        const isSafeToFullSync = force || (!this.hasActiveInFlightEdits() && Date.now() - this.lastMutationTimestamp > 400);
        if (requiresFullFetch && isSafeToFullSync) {
          const fullData = await this.fetchAllData(true);
          // Re-verify after network download completes so an edit made during the download is never rolled back!
          const stillSafeAfterFetch = force || (!this.hasActiveInFlightEdits() && Date.now() - this.lastMutationTimestamp > 400);
          if (stillSafeAfterFetch && fullData && !(fullData as any).networkFallback && Array.isArray(fullData.workOrders)) {
            this.currentVersion = Number((fullData as any).version) || serverVer || this.currentVersion;
            this.recordKnownOrders(fullData.workOrders);
            const syncEvent: RealtimeEvent = {
              type: 'SYNC_ALL',
              payload: fullData,
              senderId: 'server',
              timestamp: new Date().toISOString(),
              version: this.currentVersion
            };
            this.notifyListeners(syncEvent);
          }
        }
      }
    } catch (err) {
      console.warn('[Realtime] Reconcile check failed:', err);
    } finally {
      this.isReconciling = false;
    }
  }

  private initConnection() {
    if (this.isPreviewObserver) {
      this.setStatus('connected');
      return;
    }
    this.setStatus('connecting');

    try {
      if (this.ws) {
        try {
          this.ws.onclose = null;
          this.ws.onerror = null;
          this.ws.close();
        } catch (_) {}
        this.ws = null;
      }

      const meta = this.getSenderMeta();
      const token = getSavedSessionToken();
      const wsParams = new URLSearchParams({
        clientId: this.clientId,
        userName: meta.senderName,
        userRole: meta.senderRole,
        device: meta.senderDevice,
        ...(this.isPreviewObserver ? { isPreviewObserver: 'true' } : {}),
        ...(token ? { token } : {})
      });

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?${wsParams.toString()}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.lastServerMessageTime = Date.now();
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.announceUserIdentity(false);
        this.flushOfflineMutationQueue();
      };

      this.ws.onmessage = (msgEvent) => {
        this.lastServerMessageTime = Date.now();
        try {
          const event: RealtimeEvent = JSON.parse(msgEvent.data);
          
          if (event.type === 'HEARTBEAT' || event.type === 'PONG') {
            if (event.payload?.pingTimestamp) {
              const rtt = Date.now() - new Date(event.payload.pingTimestamp).getTime();
              if (rtt > 0 && rtt < 10000) this.latencyMs = rtt;
            }
            if (event.payload?.onlineUsers) {
              this.onlineUsersCount = event.payload.onlineUsers;
            }
            if (Array.isArray(event.payload?.connectedUsers)) {
              this.connectedUsers = event.payload.connectedUsers;
            }
            this.emitStatusChange();

            if (event.payload?.version && event.payload.version > this.currentVersion) {
              this.reconcileWithServer(false);
            }
            return;
          }

          if (event.type === 'PLATFORM_PUBLISHED') {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('p155:platform_published', { detail: event.payload }));
            }
          }

          if (event.payload?.deployId && typeof window !== 'undefined') {
            const deployId = String(event.payload.deployId);
            const storedDeployId = sessionStorage.getItem('p155_server_deploy_id');
            if (!storedDeployId) {
              sessionStorage.setItem('p155_server_deploy_id', deployId);
            } else if (storedDeployId !== deployId) {
              sessionStorage.setItem('p155_server_deploy_id', deployId);
              window.dispatchEvent(new CustomEvent('p155:platform_published', { detail: event.payload }));
            }
          }

          const incomingSyncVersion = event.version || (event.type === 'SYNC_ALL' ? event.payload?.version : undefined);
          if (
            event.type === 'SYNC_ALL' &&
            incomingSyncVersion &&
            incomingSyncVersion === this.currentVersion &&
            Date.now() - this.lastFetchTimestamp < 4000 &&
            !this.hasActiveInFlightEdits()
          ) {
            return;
          }

          if (typeof incomingSyncVersion === 'number' && incomingSyncVersion > 0) {
            this.currentVersion = Math.max(this.currentVersion, incomingSyncVersion);
          }

          this.notifyListeners(event);
        } catch (err) {
          console.error('Error handling WS message:', err);
        }
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.initSSEFallback();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.initSSEFallback();
      };
    } catch {
      this.initSSEFallback();
    }
  }

  private initSSEFallback() {
    if (this.sse) return;
    try {
      const meta = this.getSenderMeta();
      const token = getSavedSessionToken();
      const sseParams = new URLSearchParams({
        clientId: this.clientId,
        userName: meta.senderName,
        userRole: meta.senderRole,
        device: meta.senderDevice,
        ...(this.isPreviewObserver ? { isPreviewObserver: 'true' } : {}),
        ...(token ? { token } : {})
      });
      this.sse = new EventSource(`/api/events?${sseParams.toString()}`);
      this.sse.onopen = () => {
        this.setStatus('connected');
        this.lastServerMessageTime = Date.now();
        this.flushOfflineMutationQueue();
      };
      this.sse.onmessage = (event) => {
        this.lastServerMessageTime = Date.now();
        try {
          const data: RealtimeEvent = JSON.parse(event.data);
          if (data.type === 'PLATFORM_PUBLISHED') {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('p155:platform_published', { detail: data.payload }));
            }
          }
          if (data.payload?.deployId && typeof window !== 'undefined') {
            const deployId = String(data.payload.deployId);
            const storedDeployId = sessionStorage.getItem('p155_server_deploy_id');
            if (!storedDeployId) {
              sessionStorage.setItem('p155_server_deploy_id', deployId);
            } else if (storedDeployId !== deployId) {
              sessionStorage.setItem('p155_server_deploy_id', deployId);
              window.dispatchEvent(new CustomEvent('p155:platform_published', { detail: data.payload }));
            }
          }
          if (data.version && data.version > this.currentVersion) {
            this.currentVersion = data.version;
          }
          this.notifyListeners(data);
        } catch (err) {
          console.error('Error parsing SSE event:', err);
        }
      };
      this.sse.onerror = () => {
        // Poll loop remains active
      };
    } catch (err) {
      console.error('SSE initialization error:', err);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    const delay = Math.min(4000, 800 * Math.pow(1.4, Math.min(this.reconnectAttempts, 4))) + Math.random() * 300;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.initConnection();
    }, delay);
  }

  private setStatus(status: SyncStatus) {
    this.status = status;
    this.emitStatusChange();
  }

  private emitStatusChange() {
    this.statusListeners.forEach(listener =>
      listener(this.status, this.onlineUsersCount, this.connectedUsers, this.latencyMs)
    );
  }

  private notifyListeners(event: RealtimeEvent) {
    if ((event as any).type === 'REQUEST_CLIENT_HARVEST') {
      // Deprecated: never upload old client snapshots that could resurrect deleted work orders
      return;
    }

    if (event.type === 'USER_PRESENCE') {
      if (event.payload?.onlineUsers) {
        this.onlineUsersCount = event.payload.onlineUsers;
      }
      if (Array.isArray(event.payload?.connectedUsers)) {
        this.connectedUsers = event.payload.connectedUsers;
      }
      this.emitStatusChange();
      return;
    }

    if (event.type === 'SYNC_ALL') {
      if (event.payload?.onlineUsers) {
        this.onlineUsersCount = event.payload.onlineUsers;
      }
      if (Array.isArray(event.payload?.connectedUsers)) {
        this.connectedUsers = event.payload.connectedUsers;
      }
      if (Array.isArray(event.payload?.notificationsLog)) {
        notificationService.syncFromServerLog(event.payload.notificationsLog, this.clientId);
      }
      this.emitStatusChange();
    }

    // Deduplicate OS alerts/notifications and toast alerts when the same eventId arrives via both WS and Firestore onSnapshot
    const isAlreadyLogged = Boolean(event.eventId && this.processedEventIds.has(event.eventId));
    if (event.eventId && event.type !== 'SYNC_ALL') {
      this.processedEventIds.add(event.eventId);
      if (this.processedEventIds.size > 600) {
        const first = this.processedEventIds.values().next().value;
        if (first) this.processedEventIds.delete(first);
      }
    }

    (event as any)._isDuplicateDelivery = isAlreadyLogged;

    // Automatically log remote events to notification history and trigger OS notification if enabled
    const isRemote = event.senderId !== this.clientId;
    if (isRemote && !isAlreadyLogged && event.type !== 'SYNC_ALL') {
      notificationService.processRealtimeEvent(event, true);
    }

    // Unconditionally force-update React State subscribers on every incoming WebSocket / Firestore event!
    this.listeners.forEach(listener => listener(event));
  }

  private postLocalPulse(event: RealtimeEvent) {
    try {
      this.broadcastChannel?.postMessage(event);
      if (typeof window !== 'undefined' && window.localStorage) {
        const pulseKey = this.isPreviewObserver ? 'preview_sandbox_p155_sync_pulse' : 'p155_sync_pulse';
        window.localStorage.setItem(pulseKey, JSON.stringify({
          event,
          senderId: this.clientId,
          version: this.currentVersion,
          t: Date.now()
        }));
      }
      if (!this.isPreviewObserver && this.firestoreLivePulseWriter) {
        this.firestoreLivePulseWriter(event);
      }
    } catch (_) {}
  }

  public subscribe(callback: (event: RealtimeEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public onStatusChange(
    callback: (status: SyncStatus, onlineCount: number, connectedUsers: ConnectedUserInfo[], latencyMs: number) => void
  ): () => void {
    this.statusListeners.add(callback);
    callback(this.status, this.onlineUsersCount, this.connectedUsers, this.latencyMs);
    return () => this.statusListeners.delete(callback);
  }

  /**
   * Send an instant broadcast alert / announcement to all connected users
   */
  public async sendBroadcastAlert(options: {
    title: string;
    message: string;
    isUrgent?: boolean;
    priority?: 'normal' | 'high' | 'urgent';
    office?: string;
  }): Promise<boolean> {
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('bcast');
    const meta = this.getSenderMeta();
    const isUrgent = Boolean(options.isUrgent || options.priority === 'urgent');

    const event: RealtimeEvent = {
      eventId,
      type: 'BROADCAST_ALERT',
      payload: {
        title: options.title || 'تنبيه فوري لفريق العمل',
        message: options.message,
        isUrgent,
        priority: options.priority || (isUrgent ? 'urgent' : 'high'),
        office: options.office || 'جميع المكاتب'
      },
      ...meta,
      timestamp,
      version: this.currentVersion + 1
    };

    // Record locally in notification center
    this.markEventProcessed(eventId);
    notificationService.processRealtimeEvent(event, false);
    this.postLocalPulse(event);

    if (this.isPreviewObserver) {
      return true;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (_) {}
    }

    try {
      const res = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: this.getHeaders({ 'Cache-Control': 'no-cache' }),
        body: JSON.stringify({
          eventId,
          ...options,
          isUrgent,
          ...meta
        })
      });
      return res.ok;
    } catch (err) {
      console.warn('[Realtime] Broadcast alert error:', err);
      return false;
    }
  }

  // Send mutations with persistent WAL write-ahead logging, field-level isolation, and eventId deduplication
  public async createWorkOrder(order: Partial<WorkOrder>): Promise<WorkOrder> {
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('create');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();
    const tempId = order.id || `wo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const baseFields: WorkOrder = {
      id: tempId,
      office: order.office || 'مكتب عرعر',
      contractor: order.contractor || '',
      workOrderNumber: order.workOrderNumber || '',
      workOrderCode: order.workOrderCode || '',
      executionStatus: order.executionStatus || 'قيد التدقيق',
      photos: order.photos || [],
      executionNotes: order.executionNotes || '',
      boqModification: order.boqModification || 'مطابق للمقايسة المعتمدة',
      boqDetails: order.boqDetails || '',
      procedure155Status: order.procedure155Status || 'مؤهل للاغلاق',
      procedure155: order.procedure155 || '',
      createdAt: order.createdAt || timestamp,
      updatedAt: timestamp,
      lastUpdatedBy: meta.senderName,
      priority: order.priority || 'عادية',
      inspectorName: order.inspectorName || meta.senderName,
      completionPercentage: order.completionPercentage || 0,
      recordVersion: Math.max(1, Number(order.recordVersion) || 1),
      ...order,
      auditSyncStatus: 'saving'
    };

    const fieldUpdatedAt: Record<string, string> = { ...(baseFields.fieldUpdatedAt || {}) };
    for (const k of Object.keys(baseFields)) {
      if (k !== 'id' && k !== 'fieldUpdatedAt' && k !== 'auditSyncStatus') {
        fieldUpdatedAt[k] = timestamp;
      }
    }
    const fullOrder: WorkOrder = {
      ...baseFields,
      fieldUpdatedAt
    };

    // 1. Write-Ahead Log (WAL) & Local Vault Commit BEFORE network call (Zero-Rollback Guarantee)
    this.lastMutationTimestamp = Date.now();
    this.lastKnownOrdersMap.set(fullOrder.id, fullOrder);
    vaultService.recordWalOrderCreation(fullOrder);
    try {
      const currentVault = vaultService.getSavedWorkOrders();
      vaultService.saveWorkOrders([fullOrder, ...currentVault.filter(w => w && w.id !== fullOrder.id)]);
    } catch (_) {}

    if (this.isPreviewObserver) {
      const sandboxOrder: WorkOrder = { ...fullOrder, auditSyncStatus: 'synced' };
      this.lastKnownOrdersMap.set(sandboxOrder.id, sandboxOrder);
      return sandboxOrder;
    }

    this.activeMutationsCount++;

    try {
      const bodyStr = JSON.stringify({ ...fullOrder, ...meta, eventId });
      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: this.getHeaders({ 'Cache-Control': 'no-cache' }),
        body: bodyStr,
        keepalive: bodyStr.length < 60000
      });
      if (res.ok) {
        const serverOrder = await res.json();
        const confirmedOrder: WorkOrder = {
          ...fullOrder,
          ...serverOrder,
          fieldUpdatedAt: {
            ...fieldUpdatedAt,
            ...(serverOrder.fieldUpdatedAt || {})
          },
          auditSyncStatus: 'synced'
        };
        if (typeof (serverOrder as any)?.version === 'number') {
          this.currentVersion = Math.max(this.currentVersion, (serverOrder as any).version);
        }
        this.lastKnownOrdersMap.set(confirmedOrder.id, confirmedOrder);
        vaultService.markWalMutationAcked(confirmedOrder.id, confirmedOrder.recordVersion, confirmedOrder.updatedAt);
        vaultService.removeQueuedMutation(fullOrder.id);
        const confirmEvent: RealtimeEvent = {
          eventId,
          type: 'CREATE_ORDER',
          payload: confirmedOrder,
          ...meta,
          timestamp: new Date().toISOString(),
          version: this.currentVersion
        };
        notificationService.processRealtimeEvent(confirmEvent, false);
        this.postLocalPulse(confirmEvent);
        this.listeners.forEach(listener => listener(confirmEvent));
        return confirmedOrder;
      } else if (res.status === 409) {
        let errData: any = null;
        try {
          errData = await res.json();
        } catch (_) {}
        vaultService.removeWalEntry(fullOrder.id);
        this.lastKnownOrdersMap.delete(fullOrder.id);
        try {
          const currentVault = vaultService.getSavedWorkOrders();
          vaultService.saveWorkOrders(currentVault.filter(w => w && w.id !== fullOrder.id), true);
        } catch (_) {}
        const conflictOrder: any = {
          ...fullOrder,
          auditSyncStatus: 'conflict',
          conflictError: true,
          existingConflictOrder: errData?.existingOrder
        };
        return conflictOrder;
      } else {
        vaultService.queueMutation('CREATE_ORDER', fullOrder);
        const hydrated = await this.hydrateServer({ workOrders: [fullOrder] }).catch(() => false);
        if (hydrated) {
          vaultService.markWalMutationAcked(fullOrder.id, fullOrder.recordVersion, fullOrder.updatedAt);
        }
        const syncedOrder: WorkOrder = {
          ...fullOrder,
          auditSyncStatus: 'synced'
        };
        const fallbackEvent: RealtimeEvent = {
          eventId,
          type: 'CREATE_ORDER',
          payload: syncedOrder,
          ...meta,
          timestamp: new Date().toISOString(),
          version: this.currentVersion + 1
        };
        notificationService.processRealtimeEvent(fallbackEvent, false);
        this.postLocalPulse(fallbackEvent);
        this.listeners.forEach(listener => listener(fallbackEvent));
        return syncedOrder;
      }
    } catch (err) {
      console.warn('[Realtime] HTTP createWorkOrder failed, falling back to WS & offline queue:', err);
      vaultService.queueMutation('CREATE_ORDER', fullOrder);
      const event: RealtimeEvent = {
        eventId,
        type: 'CREATE_ORDER',
        payload: fullOrder,
        ...meta,
        timestamp,
        version: this.currentVersion + 1
      };
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify(event));
        } catch (_) {}
      }
      this.lastKnownOrdersMap.set(fullOrder.id, fullOrder);
      this.postLocalPulse(event);
      this.listeners.forEach(listener => listener(event));
      return fullOrder;
    } finally {
      this.lastMutationTimestamp = Date.now();
      this.activeMutationsCount = Math.max(0, this.activeMutationsCount - 1);
    }
  }

  public async createBatchWorkOrders(orders: Partial<WorkOrder>[]): Promise<WorkOrder[]> {
    if (!orders || orders.length === 0) return [];
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('batch');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();

    const createdOrders: WorkOrder[] = orders.map((order, idx) => {
      const baseWo: WorkOrder = {
        id: order.id || `wo-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        workOrderNumber: order.workOrderNumber || `WO-${Math.floor(1000 + Math.random() * 9000)}`,
        workOrderCode: order.workOrderCode || '',
        office: order.office || 'مكتب عرعر',
        contractor: order.contractor || 'فصول السنة',
        photoDocumentation: order.photoDocumentation || 'مكتمل',
        consultantForms: order.consultantForms || 'مكتمل',
        consultantClearanceForms: order.consultantClearanceForms || 'مكتمل',
        form190: order.form190 || 'مكتمل',
        form200: order.form200 || 'مكتمل',
        inspectionForm: order.inspectionForm || 'مكتمل',
        executionNotes: order.executionNotes || '',
        qualityNotes: order.qualityNotes || '',
        executionStatus: order.executionStatus || 'قيد التدقيق',
        boqModification: order.boqModification || 'مطابق للمقايسة المعتمدة',
        boqDetails: order.boqDetails || '',
        procedure155Status: order.procedure155Status || 'مؤهل للاغلاق',
        procedure155: order.procedure155 || '',
        createdAt: order.createdAt || timestamp,
        updatedAt: timestamp,
        lastUpdatedBy: meta.senderName,
        priority: order.priority || 'عادية',
        inspectorName: order.inspectorName || meta.senderName,
        completionPercentage: order.completionPercentage || 0,
        photos: order.photos || [],
        recordVersion: 1,
        ...order
      };
      const fMap: Record<string, string> = {};
      for (const k of Object.keys(baseWo)) {
        if (k !== 'id' && k !== 'fieldUpdatedAt' && k !== 'auditSyncStatus') {
          fMap[k] = timestamp;
        }
      }
      baseWo.fieldUpdatedAt = fMap;
      vaultService.recordWalOrderCreation(baseWo);
      return baseWo;
    });

    this.lastMutationTimestamp = Date.now();
    this.recordKnownOrders(createdOrders);
    try {
      const currentVault = vaultService.getSavedWorkOrders();
      const createdIds = new Set(createdOrders.map(w => w.id));
      vaultService.saveWorkOrders([...currentVault.filter(w => w && !createdIds.has(w.id)), ...createdOrders]);
    } catch (_) {}

    const immediateBatchEvent: RealtimeEvent = {
      eventId,
      type: 'CREATE_BATCH_ORDERS',
      payload: { orders: createdOrders },
      ...meta,
      timestamp,
      version: this.currentVersion + 1
    };
    notificationService.processRealtimeEvent(immediateBatchEvent, false);
    this.postLocalPulse(immediateBatchEvent);
    this.listeners.forEach(listener => listener(immediateBatchEvent));

    if (this.isPreviewObserver) {
      return createdOrders;
    }

    this.activeMutationsCount++;
    try {
      const bodyStr = JSON.stringify({ eventId, orders: createdOrders, ...meta });
      const res = await fetch('/api/work-orders/batch-create', {
        method: 'POST',
        headers: this.getHeaders({ 'Cache-Control': 'no-cache' }),
        body: bodyStr,
        keepalive: bodyStr.length < 60000
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.orders)) {
          if (typeof data.version === 'number') {
            this.currentVersion = Math.max(this.currentVersion, data.version);
          }
          const finalBatchOrders: WorkOrder[] = data.orders.length > 0 ? data.orders : createdOrders;
          for (const confirmedWo of finalBatchOrders) {
            if (confirmedWo && confirmedWo.id) {
              vaultService.markWalMutationAcked(confirmedWo.id, confirmedWo.recordVersion, confirmedWo.updatedAt);
            }
          }
          this.recordKnownOrders(finalBatchOrders);
          const batchEvent: RealtimeEvent = {
            eventId,
            type: 'CREATE_BATCH_ORDERS',
            payload: { orders: finalBatchOrders },
            ...meta,
            timestamp,
            version: this.currentVersion
          };
          notificationService.processRealtimeEvent(batchEvent, false);
          this.postLocalPulse(batchEvent);
          return finalBatchOrders;
        }
      }
      // Fallback if batch-create returned non-200: hydrate directly via /api/sync/hydrate
      const hydrated = await this.hydrateServer({ workOrders: createdOrders }).catch(() => false);
      if (hydrated) {
        for (const wo of createdOrders) {
          if (wo && wo.id) {
            vaultService.markWalMutationAcked(wo.id, wo.recordVersion, wo.updatedAt);
          }
        }
      }
      return createdOrders;
    } catch (err) {
      console.warn('[Realtime] Batch create HTTP error, falling back to WS:', err);
      const wsBatchEvent: RealtimeEvent = {
        eventId,
        type: 'CREATE_BATCH_ORDERS',
        payload: { orders: createdOrders },
        ...meta,
        timestamp,
        version: this.currentVersion + 1
      };
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify(wsBatchEvent));
        } catch (_) {}
      }
      notificationService.processRealtimeEvent(wsBatchEvent, false);
      this.postLocalPulse(wsBatchEvent);
      return createdOrders;
    } finally {
      this.lastMutationTimestamp = Date.now();
      this.activeMutationsCount = Math.max(0, this.activeMutationsCount - 1);
    }

    return [];
  }

  public getLastKnownOrder(id: string): WorkOrder | undefined {
    return this.lastKnownOrdersMap.get(id);
  }

  public async updateWorkOrder(order: WorkOrder, explicitChangedFields?: string[]): Promise<WorkOrder> {
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('update');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();

    // Compute exact changed fields vs lastKnownOrdersMap (or use explicitChangedFields from transactional baseline)
    // so concurrent edits by other users on other fields are never overwritten
    const previousOrder = this.lastKnownOrdersMap.get(order.id);
    const changedFields: string[] = [];
    const IGNORED_DIFF_KEYS = new Set([
      'id',
      'updatedAt',
      'lastEditedAt',
      'lastUpdatedBy',
      'recordVersion',
      'fieldUpdatedAt',
      'auditSyncStatus'
    ]);

    if (Array.isArray(explicitChangedFields) && explicitChangedFields.length > 0) {
      for (const key of explicitChangedFields) {
        if (!IGNORED_DIFF_KEYS.has(key) && !changedFields.includes(key)) {
          changedFields.push(key);
        }
      }
    } else if (previousOrder) {
      const allKeys = new Set([...Object.keys(order), ...Object.keys(previousOrder)]);
      for (const key of allKeys) {
        if (IGNORED_DIFF_KEYS.has(key)) continue;
        if (JSON.stringify((order as any)[key]) !== JSON.stringify((previousOrder as any)[key])) {
          changedFields.push(key);
        }
      }
    } else {
      for (const key of Object.keys(order)) {
        if (!IGNORED_DIFF_KEYS.has(key)) {
          changedFields.push(key);
        }
      }
    }

    // Track in-flight fields for 30 seconds while saving to prevent background polls from flickering or reverting active edits
    const expiresAt = Date.now() + 30000;
    this.lastMutationTimestamp = Date.now();
    const currentInFlight = this.inFlightOrderFields.get(order.id) || {};
    for (const field of changedFields) {
      currentInFlight[field] = { value: (order as any)[field], expiresAt };
    }
    this.inFlightOrderFields.set(order.id, currentInFlight);

    const nextRecordVersion = Math.max(
      Number(order.recordVersion) || 1,
      (Number(previousOrder?.recordVersion) || 1) + 1
    );

    const fieldUpdatedAt: Record<string, string> = {
      ...(previousOrder?.fieldUpdatedAt || {}),
      ...(order.fieldUpdatedAt || {})
    };
    for (const field of changedFields) {
      fieldUpdatedAt[field] = timestamp;
    }

    // Atomically apply ONLY changedFields onto previousOrder so concurrent edits by other users on untouched fields are preserved
    const baseMerged: Record<string, any> = previousOrder ? { ...previousOrder } : { ...order };
    if (previousOrder && changedFields.length > 0) {
      for (const field of changedFields) {
        if (field === 'customFields' && order.customFields && previousOrder.customFields) {
          baseMerged.customFields = { ...previousOrder.customFields, ...order.customFields };
        } else {
          baseMerged[field] = (order as any)[field];
        }
      }
      baseMerged.isNew = false;
      baseMerged.isEdited = order.isEdited !== undefined ? order.isEdited : true;
      baseMerged.lastEditedAt = timestamp;
    } else {
      Object.assign(baseMerged, order);
    }

    const savingOrder: WorkOrder = {
      ...(baseMerged as WorkOrder),
      id: order.id,
      fieldUpdatedAt,
      recordVersion: nextRecordVersion,
      updatedAt: timestamp,
      lastUpdatedBy: meta.senderName,
      auditSyncStatus: 'saving'
    };

    // 1. Write-Ahead Log (WAL) & Local Vault Commit BEFORE network call (Zero-Rollback Guarantee)
    this.lastKnownOrdersMap.set(order.id, savingOrder);
    vaultService.recordWalFieldMutation(order.id, changedFields, savingOrder);

    // Strip heavy base64 strings from network/pulse payloads when photos/files were NOT among changedFields
    const touchesHeavyFiles = changedFields.some(
      f => f === 'photos' || f === 'photosFile' || f === 'photosFileData' || f === 'qualityNoteItems'
    );
    const networkOrderPayload: any = touchesHeavyFiles
      ? savingOrder
      : {
          ...savingOrder,
          photos: undefined,
          photosFile: undefined,
          photosFileData: undefined
        };

    const savingEvent: RealtimeEvent = {
      eventId,
      type: 'UPDATE_ORDER',
      payload: {
        ...networkOrderPayload,
        changedFields
      } as any,
      ...meta,
      timestamp,
      version: this.currentVersion + 1
    };

    notificationService.processRealtimeEvent(savingEvent, false);
    this.postLocalPulse(savingEvent);

    if (this.isPreviewObserver) {
      this.inFlightOrderFields.delete(order.id);
      const sandboxSaved: WorkOrder = { ...savingOrder, auditSyncStatus: 'synced' };
      this.lastKnownOrdersMap.set(order.id, sandboxSaved);
      return sandboxSaved;
    }

    this.activeMutationsCount++;

    try {
      const bodyStr = JSON.stringify({
        ...networkOrderPayload,
        changedFields,
        expectedRecordVersion: typeof order.recordVersion === 'number' ? order.recordVersion : undefined,
        ...meta,
        eventId
      });
      const res = await fetch(`/api/work-orders/${order.id}`, {
        method: 'PUT',
        headers: this.getHeaders({ 'Cache-Control': 'no-cache' }),
        body: bodyStr,
        keepalive: bodyStr.length < 60000
      });

      if (res.ok) {
        const serverOrder = await res.json();
        // Immediately clear in-flight locks so server authoritative state is always applied
        this.inFlightOrderFields.delete(order.id);

        vaultService.markWalMutationAcked(order.id, serverOrder.recordVersion, serverOrder.updatedAt);

        const confirmedOrder: WorkOrder = this.mergeIncomingOrderWithInFlight(
          savingOrder,
          {
            ...savingOrder,
            ...serverOrder,
            photos: touchesHeavyFiles ? (serverOrder.photos ?? savingOrder.photos) : savingOrder.photos,
            photosFile: touchesHeavyFiles ? (serverOrder.photosFile ?? savingOrder.photosFile) : savingOrder.photosFile,
            fieldUpdatedAt: {
              ...fieldUpdatedAt,
              ...(serverOrder.fieldUpdatedAt || {})
            },
            auditSyncStatus: 'synced'
          },
          false
        );

        this.lastKnownOrdersMap.set(order.id, confirmedOrder);

        if (typeof (serverOrder as any)?.version === 'number') {
          this.currentVersion = Math.max(this.currentVersion, (serverOrder as any).version);
        }
        vaultService.removeQueuedMutation(order.id);
        return confirmedOrder;
      } else if (res.status === 409) {
        let errData: any = null;
        try {
          errData = await res.json();
        } catch (_) {}
        this.inFlightOrderFields.delete(order.id);
        if (previousOrder) {
          this.lastKnownOrdersMap.set(order.id, previousOrder);
          vaultService.recordWalOrderCreation(previousOrder);
          vaultService.markWalMutationAcked(previousOrder.id, previousOrder.recordVersion, previousOrder.updatedAt);
        }
        return {
          ...(previousOrder || order),
          auditSyncStatus: 'conflict',
          conflictError: true,
          existingConflictOrder: errData?.existingOrder
        } as any;
      } else {
        // Fallback: persist via additive hydration endpoint so no edit is ever lost or rolled back
        const hydrated = await this.hydrateServer({ workOrders: [savingOrder] }).catch(() => false);
        if (hydrated) {
          vaultService.markWalMutationAcked(savingOrder.id, savingOrder.recordVersion, savingOrder.updatedAt);
        } else {
          vaultService.queueMutation('UPDATE_ORDER', { ...savingOrder, changedFields });
        }
        const syncedOrder: WorkOrder = {
          ...savingOrder,
          auditSyncStatus: 'synced'
        };
        return syncedOrder;
      }
    } catch (err) {
      console.warn('[Realtime] Update call failed, falling back to WS & offline queue:', err);
      vaultService.queueMutation('UPDATE_ORDER', { ...savingOrder, changedFields });
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({
            ...savingEvent,
            payload: { ...savingOrder, changedFields }
          }));
        } catch (_) {}
      }
      return savingOrder;
    } finally {
      this.lastMutationTimestamp = Date.now();
      this.activeMutationsCount = Math.max(0, this.activeMutationsCount - 1);
    }
  }

  public async deleteWorkOrder(id: string, orderDetails?: Partial<WorkOrder>): Promise<void> {
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('del');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();

    const event: RealtimeEvent = {
      eventId,
      type: 'DELETE_ORDER',
      payload: {
        id,
        workOrderNumber: orderDetails?.workOrderNumber,
        office: orderDetails?.office,
        contractor: orderDetails?.contractor
      },
      ...meta,
      timestamp,
      version: this.currentVersion + 1
    };

    notificationService.processRealtimeEvent(event, false);
    this.postLocalPulse(event);
    vaultService.markAsDeleted(id);

    if (this.isPreviewObserver) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (_) {}
    }
    
    try {
      const q = new URLSearchParams({
        senderId: this.clientId,
        senderName: meta.senderName,
        senderRole: meta.senderRole,
        eventId
      });
      const res = await fetch(`/api/work-orders/${id}?${q.toString()}`, {
        method: 'DELETE',
        headers: this.getHeaders({ 'Cache-Control': 'no-cache' })
      });
      if (res.ok) {
        vaultService.removeQueuedMutation(id);
      } else {
        vaultService.queueMutation('DELETE_ORDER', { id });
      }
    } catch (err) {
      vaultService.queueMutation('DELETE_ORDER', { id });
      console.warn('[Realtime] Delete call warning:', err);
    }
  }

  public async deleteBatchWorkOrders(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('delbatch');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();

    const event: RealtimeEvent = {
      eventId,
      type: 'DELETE_BATCH_ORDERS',
      payload: { ids },
      ...meta,
      timestamp,
      version: this.currentVersion + 1
    };

    notificationService.processRealtimeEvent(event, false);
    this.postLocalPulse(event);
    vaultService.markBatchAsDeleted(ids);

    if (this.isPreviewObserver) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (_) {}
    }

    try {
      await fetch('/api/work-orders/batch-delete', {
        method: 'POST',
        headers: this.getHeaders({ 'Cache-Control': 'no-cache' }),
        body: JSON.stringify({ eventId, ids, ...meta })
      });
    } catch (err) {
      console.warn('Batch delete error:', err);
    }
  }

  public async clearWorkOrders(office?: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('clear');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();

    const event: RealtimeEvent = {
      eventId,
      type: 'CLEAR_ORDERS',
      payload: { office },
      ...meta,
      timestamp,
      version: this.currentVersion + 1
    };

    notificationService.processRealtimeEvent(event, false);
    this.postLocalPulse(event);

    if (this.isPreviewObserver) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (_) {}
    }

    try {
      await fetch('/api/work-orders/clear', {
        method: 'POST',
        headers: this.getHeaders({ 'Cache-Control': 'no-cache' }),
        body: JSON.stringify({ eventId, office, ...meta })
      });
    } catch (err) {
      console.warn('Clear orders error:', err);
    }
  }

  public async addOffice(office: Partial<SubOffice>): Promise<SubOffice> {
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('addoff');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();

    const newOffice: SubOffice = {
      id: office.id || `off-${Date.now()}`,
      name: office.name || 'مكتب فرعي جديد',
      code: office.code || `OFF-${Date.now().toString().slice(-4)}`,
      description: office.description || 'مكتب فرعي لإدارة ومتابعة أوامر العمل الميدانية',
      region: office.region || 'الحدود الشمالية',
      manager: office.manager || 'مدير المكتب الميداني',
      contactNumber: office.contactNumber || '0500000000',
      activeOrdersCount: 0,
      contractors: office.contractors
    };

    const event: RealtimeEvent = {
      eventId,
      type: 'ADD_OFFICE',
      payload: newOffice,
      ...meta,
      timestamp,
      version: this.currentVersion + 1
    };

    notificationService.processRealtimeEvent(event, false);
    this.postLocalPulse(event);
    if (this.isPreviewObserver) return newOffice;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (_) {}
    }

    try {
      const res = await fetch(`/api/offices?senderId=${this.clientId}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ ...newOffice, ...meta, eventId })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Add office error:', err);
    }

    return newOffice;
  }

  public async updateOffice(office: SubOffice, oldName?: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('updoff');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();

    const event: RealtimeEvent = {
      eventId,
      type: 'UPDATE_OFFICE',
      payload: { office, oldName: oldName || office.name },
      ...meta,
      timestamp,
      version: this.currentVersion + 1
    };

    notificationService.processRealtimeEvent(event, false);
    this.postLocalPulse(event);
    if (this.isPreviewObserver) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (_) {}
    }

    try {
      await fetch(`/api/offices/${office.id}?senderId=${this.clientId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ ...office, ...meta, eventId })
      });
    } catch (err) {
      console.warn('Update office error:', err);
    }
  }

  public async deleteOffice(officeId: string, officeName?: string, reassignTo?: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('deloff');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();

    const event: RealtimeEvent = {
      eventId,
      type: 'DELETE_OFFICE',
      payload: { id: officeId, name: officeName, reassignTo },
      ...meta,
      timestamp,
      version: this.currentVersion + 1
    };

    notificationService.processRealtimeEvent(event, false);
    this.postLocalPulse(event);
    if (this.isPreviewObserver) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (_) {}
    }

    try {
      const query = new URLSearchParams({ senderId: this.clientId, eventId });
      if (reassignTo) query.set('reassignTo', reassignTo);

      fetch(`/api/offices/${officeId}?${query.toString()}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
        body: JSON.stringify({ reassignTo, ...meta, eventId })
      }).catch(err => console.warn('Delete office error:', err));
    } catch (err) {
      console.warn('Delete office error:', err);
    }
  }

  public async updateColumns(columns: ColumnDefinition[], dropdownOptions?: DropdownOptionsMap): Promise<void> {
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('cols');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();

    const event: RealtimeEvent = {
      eventId,
      type: 'UPDATE_COLUMNS',
      payload: { columns, dropdownOptions },
      ...meta,
      timestamp,
      version: this.currentVersion + 1
    };

    notificationService.processRealtimeEvent(event, false);
    this.postLocalPulse(event);
    if (this.isPreviewObserver) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (_) {}
    }

    try {
      fetch('/api/schema/columns', {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ eventId, columns, dropdownOptions, ...meta })
      }).catch(err => console.warn('PUT columns error:', err));
    } catch (err) {
      console.warn('Columns update error:', err);
    }
  }

  public async updateDropdownOptions(dropdownOptions: DropdownOptionsMap): Promise<void> {
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('dd');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();

    const event: RealtimeEvent = {
      eventId,
      type: 'UPDATE_DROPDOWN_OPTIONS',
      payload: dropdownOptions,
      ...meta,
      timestamp,
      version: this.currentVersion + 1
    };

    notificationService.processRealtimeEvent(event, false);
    this.postLocalPulse(event);
    if (this.isPreviewObserver) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (_) {}
    }

    try {
      fetch('/api/schema/dropdown-options', {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ eventId, dropdownOptions, ...meta })
      }).catch(err => console.warn('PUT dropdownOptions error:', err));
    } catch (err) {
      console.warn('Dropdown options error:', err);
    }
  }

  public async updateOfficeContractors(officeName: string, contractors: string[]): Promise<void> {
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('cont');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();

    const event: RealtimeEvent = {
      eventId,
      type: 'UPDATE_OFFICE_CONTRACTORS',
      payload: { officeName, contractors },
      ...meta,
      timestamp,
      version: this.currentVersion + 1
    };

    notificationService.processRealtimeEvent(event, false);
    this.postLocalPulse(event);
    if (this.isPreviewObserver) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (_) {}
    }

    try {
      fetch('/api/office-contractors', {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ eventId, officeName, contractors, ...meta })
      }).catch(err => console.warn('PUT office contractors error:', err));
    } catch (err) {
      console.warn('Office contractors error:', err);
    }
  }

  public async fetchAllData(force = false): Promise<{ 
    workOrders: WorkOrder[]; 
    offices: SubOffice[];
    columns?: ColumnDefinition[];
    dropdownOptions?: DropdownOptionsMap;
    monthTables?: MonthTable[];
    archivedReports?: ArchivedReportSnapshot[];
    notificationsLog?: LiveNotificationItem[];
    onlineUsers?: number;
    connectedUsers?: ConnectedUserInfo[];
    users?: PlatformUser[];
    deletedOrderIds?: string[];
    version?: number;
  }> {
    // Reuse in-flight promise when a concurrent fetch is already running in flight
    if (this.inFlightFetchPromise) {
      return this.inFlightFetchPromise;
    }

    const fetchPromise = (async () => {
      try {
        const res = await fetch(`/api/work-orders?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: this.getHeaders({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          })
        });
        if (res.ok) {
          const data = await res.json();
          this.lastFetchTimestamp = Date.now();
          this.cachedFetchData = data;
          if (Array.isArray(data.workOrders)) {
            this.recordKnownOrders(data.workOrders);
          }
          if (typeof data.version === 'number' && data.version > 0) {
            this.currentVersion = data.version;
          }
          if (Array.isArray(data.notificationsLog)) {
            notificationService.syncFromServerLog(data.notificationsLog, this.clientId);
          }
          if (data.onlineUsers || Array.isArray(data.connectedUsers)) {
            this.onlineUsersCount = data.onlineUsers || this.onlineUsersCount;
            if (Array.isArray(data.connectedUsers)) {
              this.connectedUsers = data.connectedUsers;
            }
            this.emitStatusChange();
          }
          return data;
        }
      } catch (err) {
        console.warn('[Realtime] Could not fetch from server, using local vault:', err);
      } finally {
        if (this.inFlightFetchPromise === fetchPromise) {
          this.inFlightFetchPromise = null;
        }
      }

      return {
        workOrders: vaultService.getSavedWorkOrders(),
        offices: vaultService.getSavedOffices() || [],
        monthTables: vaultService.getSavedMonthTables() || [],
        networkFallback: true
      } as any;
    })();

    this.inFlightFetchPromise = fetchPromise;
    return fetchPromise;
  }

  public async syncNow(): Promise<void> {
    await this.reconcileWithServer(true);
    await this.flushOfflineMutationQueue();
  }

  public async saveArchivedReport(report: ArchivedReportSnapshot): Promise<ArchivedReportSnapshot> {
    if (this.isPreviewObserver) return report;
    const eventId = this.generateEventId('rep');
    const meta = this.getSenderMeta();
    try {
      const res = await fetch('/api/archived-reports', {
        method: 'POST',
        headers: this.getHeaders({ 'Cache-Control': 'no-cache' }),
        body: JSON.stringify({ ...report, ...meta, eventId })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Failed saving report:', err);
    }
    return report;
  }

  public async deleteArchivedReport(id: string): Promise<void> {
    if (this.isPreviewObserver) return;
    try {
      await fetch(`/api/archived-reports/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders({ 'Cache-Control': 'no-cache' })
      });
    } catch (err) {
      console.warn('Failed deleting report:', err);
    }
  }

  // Month Tables Management API
  public async createMonthTable(table: Partial<MonthTable>): Promise<MonthTable> {
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('addtbl');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();

    const newTable: MonthTable = {
      id: table.id || `tbl-${table.year || new Date().getFullYear()}-${table.month || 1}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      year: table.year || new Date().getFullYear(),
      month: table.month || 1,
      name: table.name || 'جدول جديد',
      description: table.description || '',
      color: table.color || 'blue',
      serialNumber: table.serialNumber,
      isDefault: table.isDefault,
      createdAt: timestamp
    };

    try {
      const existingTables = vaultService.getSavedMonthTables();
      vaultService.saveMonthTables([...existingTables.filter(t => t && t.id !== newTable.id), newTable]);
    } catch (_) {}

    const event: RealtimeEvent = {
      eventId,
      type: 'ADD_MONTH_TABLE',
      payload: newTable,
      ...meta,
      timestamp,
      version: this.currentVersion + 1
    };

    notificationService.processRealtimeEvent(event, false);
    this.postLocalPulse(event);
    if (this.isPreviewObserver) return newTable;

    try {
      const bodyStr = JSON.stringify({ ...newTable, ...meta, eventId });
      const res = await fetch('/api/month-tables', {
        method: 'POST',
        headers: this.getHeaders(),
        body: bodyStr,
        keepalive: bodyStr.length < 60000
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Add month table error:', err);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify(event));
        } catch (_) {}
      }
    }

    return newTable;
  }

  public async updateMonthTable(table: MonthTable): Promise<void> {
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('updtbl');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();

    try {
      const existingTables = vaultService.getSavedMonthTables();
      vaultService.saveMonthTables(existingTables.map(t => (t && t.id === table.id ? { ...t, ...table } : t)));
    } catch (_) {}

    const event: RealtimeEvent = {
      eventId,
      type: 'UPDATE_MONTH_TABLE',
      payload: table,
      ...meta,
      timestamp,
      version: this.currentVersion + 1
    };

    notificationService.processRealtimeEvent(event, false);
    this.postLocalPulse(event);
    if (this.isPreviewObserver) return;

    try {
      const bodyStr = JSON.stringify({ ...table, ...meta, eventId });
      await fetch(`/api/month-tables/${table.id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: bodyStr,
        keepalive: bodyStr.length < 60000
      });
    } catch (err) {
      console.warn('Update month table error:', err);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify(event));
        } catch (_) {}
      }
    }
  }

  public async deleteMonthTable(id: string, reassignToTableId?: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('deltbl');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();

    const event: RealtimeEvent = {
      eventId,
      type: 'DELETE_MONTH_TABLE',
      payload: { id, reassignToTableId },
      ...meta,
      timestamp,
      version: this.currentVersion + 1
    };

    notificationService.processRealtimeEvent(event, false);
    this.postLocalPulse(event);
    if (this.isPreviewObserver) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (_) {}
    }

    try {
      await fetch(`/api/month-tables/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
        body: JSON.stringify({ eventId, reassignToTableId, ...meta })
      });
    } catch (err) {
      console.warn('Delete month table error:', err);
    }
  }

  // Disaster Recovery & Cloud Backups Management
  public async fetchServerBackups(): Promise<any[]> {
    try {
      const res = await fetch(`/api/backups?_t=${Date.now()}`, {
        headers: this.getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data.backups) ? data.backups : [];
      }
    } catch (err) {
      console.warn('Failed fetching backups:', err);
    }
    return [];
  }

  public async restoreServerBackup(filename: string): Promise<boolean> {
    if (this.isPreviewObserver) return false;
    const meta = this.getSenderMeta();
    const eventId = this.generateEventId('restore');
    try {
      const res = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ eventId, filename, ...meta })
      });
      if (res.ok) {
        const pulseEvent: RealtimeEvent = {
          eventId,
          type: 'RESTORE_SNAPSHOT',
          payload: { requiresFullSync: true, actionType: 'restore', description: `استرجاع النسخة الاحتياطية (${filename})` },
          ...meta,
          timestamp: new Date().toISOString(),
          version: this.currentVersion + 1
        };
        this.postLocalPulse(pulseEvent);
        await this.reconcileWithServer(true);
      }
      return res.ok;
    } catch (err) {
      console.warn('Failed restoring backup:', err);
      return false;
    }
  }

  public async importFullDatabase(data: any): Promise<boolean> {
    if (this.isPreviewObserver) return false;
    const meta = this.getSenderMeta();
    const eventId = this.generateEventId('import');
    try {
      const res = await fetch('/api/backup/import-full', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ eventId, ...data, ...meta })
      });
      if (res.ok && !data?.dryRun && !data?.previewOnly && !data?.isIntermediateBatch) {
        const pulseEvent: RealtimeEvent = {
          eventId,
          type: 'RESTORE_SNAPSHOT',
          payload: { requiresFullSync: true, actionType: 'import', description: 'استيراد ودمج نسخة احتياطية كاملة' },
          ...meta,
          timestamp: new Date().toISOString(),
          version: this.currentVersion + 1
        };
        this.postLocalPulse(pulseEvent);
        await this.reconcileWithServer(true);
      }
      return res.ok;
    } catch (err) {
      console.warn('Failed importing full database:', err);
      return false;
    }
  }

  /**
   * Complete Bidirectional Server Hydration:
   * Protects user data across server restarts, container redeploys, or network drops.
   */
  public async hydrateServer(payload: {
    workOrders?: WorkOrder[];
    offices?: SubOffice[];
    columns?: ColumnDefinition[];
    dropdownOptions?: DropdownOptionsMap;
    monthTables?: MonthTable[];
    archivedReports?: ArchivedReportSnapshot[];
    users?: PlatformUser[];
  }): Promise<boolean> {
    if (this.isPreviewObserver) return false;
    const meta = this.getSenderMeta();
    try {
      const res = await fetch('/api/sync/hydrate', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          ...payload,
          ...meta
        })
      });
      return res.ok;
    } catch (err) {
      console.warn('[Realtime] Hydrate server failed:', err);
      return false;
    }
  }

  public async syncState(
    workOrders: WorkOrder[],
    actionType: 'undo' | 'redo' | 'sync' = 'sync',
    description?: string
  ): Promise<boolean> {
    if (this.isPreviewObserver) return false;
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId('syncstate');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();

    const event: RealtimeEvent = {
      eventId,
      type: 'SYNC_STATE',
      payload: { workOrders, actionType, description },
      ...meta,
      timestamp,
      version: this.currentVersion + 1
    };

    notificationService.processRealtimeEvent(event, false);
    this.postLocalPulse(event);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (_) {}
    }

    try {
      const res = await fetch('/api/work-orders/sync-state', {
        method: 'POST',
        headers: this.getHeaders({ 'Cache-Control': 'no-cache' }),
        body: JSON.stringify({
          eventId,
          workOrders,
          ...meta,
          actionType,
          description
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.version) {
          this.currentVersion = data.version;
        }
        return true;
      }
    } catch (err) {
      console.warn('[Realtime] syncState failed:', err);
    }
    return false;
  }

  public async fetchUsers(): Promise<PlatformUser[]> {
    try {
      const res = await fetch(`/api/users?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: this.getHeaders({ 'Cache-Control': 'no-cache, no-store, must-revalidate' })
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          vaultService.saveUsers(data.users);
          return data.users;
        }
      }
    } catch (err) {
      console.warn('[Realtime] Failed fetching users from server, falling back to vault:', err);
    }
    return vaultService.getSavedUsers() || [];
  }

  public async broadcastUserLogin(user: PlatformUser): Promise<void> {
    if (this.isPreviewObserver) return;
    const meta = this.getSenderMeta();
    const displayName = user.displayName || user.username || 'مستخدم معتمد';
    const roleTitle = user.roleTitle || 'مستخدم المنظومة';
    const title = 'تسجيل دخول إلى المنصة';
    const message = `قام (${displayName}) [${roleTitle}] بتسجيل الدخول إلى المنصة الآن.`;
    const eventId = this.generateEventId('login');
    this.markEventProcessed(eventId);

    const event: RealtimeEvent = {
      eventId,
      type: 'BROADCAST_ALERT',
      payload: {
        title,
        message,
        isUrgent: false,
        userName: displayName,
        userRole: roleTitle
      },
      ...meta,
      timestamp: new Date().toISOString()
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event));
      } catch (_) {}
    }

    try {
      await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          eventId: event.eventId,
          title,
          message,
          isUrgent: false,
          senderName: displayName,
          senderRole: roleTitle,
          senderId: this.clientId
        })
      });
    } catch (_) {}
  }

  public async saveUser(user: Partial<PlatformUser>): Promise<{ user?: PlatformUser; users?: PlatformUser[] }> {
    if (this.isPreviewObserver) {
      const localUsers = vaultService.getSavedUsers() || [];
      return { user: user as PlatformUser, users: localUsers };
    }
    const eventId = this.generateEventId('usr');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }),
      body: JSON.stringify({ eventId, user, ...meta })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'فشل حفظ بيانات المستخدم');
    }
    const data = await res.json();
    if (typeof data.version === 'number') {
      this.currentVersion = Math.max(this.currentVersion, data.version);
    } else {
      this.currentVersion += 1;
    }
    if (Array.isArray(data.users)) {
      vaultService.saveUsers(data.users);
    }
    const event: RealtimeEvent = {
      eventId,
      type: 'UPDATE_USERS',
      payload: { users: data.users, updatedUser: data.user },
      ...meta,
      timestamp: new Date().toISOString(),
      version: this.currentVersion
    };
    try {
      this.postLocalPulse(event);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(event));
      }
      this.notifyListeners(event);
    } catch (_) {}

    return { user: data.user, users: data.users };
  }

  public async broadcastUsers(users: PlatformUser[]): Promise<void> {
    if (this.isPreviewObserver) return;
    const meta = this.getSenderMeta();
    const eventId = this.generateEventId('usr-all');
    this.markEventProcessed(eventId);
    this.currentVersion += 1;
    const event: RealtimeEvent = {
      eventId,
      type: 'UPDATE_USERS',
      payload: { users },
      ...meta,
      timestamp: new Date().toISOString(),
      version: this.currentVersion
    };
    try {
      this.postLocalPulse(event);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(event));
      }
      this.notifyListeners(event);
    } catch (_) {}
  }

  public async deleteUser(userId: string): Promise<PlatformUser[]> {
    if (this.isPreviewObserver) {
      return (vaultService.getSavedUsers() || []).filter(u => u && u.id !== userId);
    }
    const eventId = this.generateEventId('usr-del');
    this.markEventProcessed(eventId);
    const meta = this.getSenderMeta();
    const res = await fetch(`/api/users/${userId}?senderId=${this.clientId}&eventId=${eventId}`, {
      method: 'DELETE',
      headers: this.getHeaders({ 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'فشل حذف حساب المستخدم');
    }
    const data = await res.json();
    if (typeof data.version === 'number') {
      this.currentVersion = Math.max(this.currentVersion, data.version);
    } else {
      this.currentVersion += 1;
    }
    if (Array.isArray(data.users)) {
      vaultService.saveUsers(data.users);
    }
    const event: RealtimeEvent = {
      eventId,
      type: 'UPDATE_USERS',
      payload: { users: data.users, deletedUserId: userId },
      ...meta,
      timestamp: new Date().toISOString(),
      version: this.currentVersion
    };
    try {
      this.postLocalPulse(event);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(event));
      }
      this.notifyListeners(event);
    } catch (_) {}

    return data.users || [];
  }

  public async triggerPlatformPublish(): Promise<boolean> {
    if (this.isPreviewObserver) return false;
    try {
      const res = await fetch('/api/platform/publish', {
        method: 'POST',
        headers: this.getHeaders()
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async resetData(): Promise<void> {
    if (this.isPreviewObserver) return;
    try {
      await fetch('/api/reset', {
        method: 'POST',
        headers: this.getHeaders()
      });
      await this.reconcileWithServer(true);
    } catch (err) {
      console.error('Reset error:', err);
    }
  }
}

export const realtime = new RealtimeService();
export const realtimeService = realtime;

