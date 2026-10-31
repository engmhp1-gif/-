/**
 * Notification Service for Procedure 155 Platform
 * Handles Web Push, Service Worker registration, OS background alerts,
 * user identity for multi-user attribution, live notification feed history,
 * and permissions management across all connected users.
 */

import { LiveNotificationItem, RealtimeEvent } from '../types';

export interface NotificationPreferences {
  enabled: boolean;
  createOrder: boolean;
  updateOrder: boolean;
  deleteOrder: boolean;
  importOrders: boolean;
  officeAndSystemChanges: boolean;
  broadcastAlerts: boolean;
  desktopOsNotifications: boolean;
  soundEnabled: boolean;
}

export interface UserIdentityProfile {
  userName: string;
  userRole: string;
  userEmail?: string;
}

export type UserNotificationIdentity = UserIdentityProfile;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  createOrder: true,
  updateOrder: true,
  deleteOrder: true,
  importOrders: true,
  officeAndSystemChanges: true,
  broadcastAlerts: true,
  desktopOsNotifications: true,
  soundEnabled: true
};

const PREFS_KEY = 'procedure155_notification_preferences';
const IDENTITY_KEY = 'procedure155_user_identity';
const HISTORY_KEY = 'procedure155_notifications_history';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

class NotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private currentSubscription: PushSubscription | null = null;
  private permission: NotificationPermission = 'default';
  private preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES;
  private userIdentity: UserIdentityProfile = {
    userName: 'م. محمود الشحات',
    userRole: 'مهندس الجودة والمساندة الفنية'
  };
  private history: LiveNotificationItem[] = [];
  private listeners: Set<(items: LiveNotificationItem[], unreadCount: number) => void> = new Set();
  private processedEventIds: Set<string> = new Set();
  private isInitialized = false;

  constructor() {
    this.loadPreferences();
    this.loadUserIdentity();
    this.loadHistory();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  private loadPreferences() {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) {
        this.preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch {
      this.preferences = DEFAULT_NOTIFICATION_PREFERENCES;
    }
  }

  private normalizeRoleText(name: string, role: string): string {
    const cleanName = String(name || '').trim();
    const cleanRole = String(role || '').trim();
    if (
      cleanName.includes('محمود الشحات') ||
      cleanRole.includes('محمود الشحات') ||
      cleanRole.includes('مدير المنظومة الرئيسي') ||
      cleanRole.includes('مدير عام المنظومة الرئيسي')
    ) {
      return 'مهندس الجودة والمساندة الفنية';
    }
    return cleanRole || 'مستخدم المنظومة';
  }

  private loadUserIdentity() {
    try {
      const stored = localStorage.getItem(IDENTITY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.userName || parsed.userEmail)) {
          const userName = String(parsed.userName || '').trim();
          const userRole = this.normalizeRoleText(userName, String(parsed.userRole || ''));
          this.userIdentity = {
            userName,
            userRole,
            userEmail: parsed.userEmail ? String(parsed.userEmail).trim() : undefined
          };
          return;
        }
      }
    } catch {}
    // Default empty identity if no user logged in yet; NEVER contaminate with another user's email!
    this.userIdentity = {
      userName: '',
      userRole: 'مستخدم المنظومة',
      userEmail: ''
    };
  }

  public getUserIdentity(): UserIdentityProfile {
    return { ...this.userIdentity };
  }

  public saveUserIdentity(identity: Partial<UserIdentityProfile>): UserIdentityProfile {
    const nextName = (identity.userName ?? this.userIdentity.userName).trim();
    const rawRole = (identity.userRole ?? this.userIdentity.userRole).trim();
    this.userIdentity = {
      userName: nextName,
      userRole: this.normalizeRoleText(nextName, rawRole),
      userEmail: identity.userEmail !== undefined ? (identity.userEmail || '').trim() : this.userIdentity.userEmail
    };
    try {
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(this.userIdentity));
    } catch (e) {
      console.warn('Failed to save user identity:', e);
    }
    return this.getUserIdentity();
  }

  private loadHistory() {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.history = parsed.slice(0, 120).map((item: LiveNotificationItem) => {
            const fixedRole = this.normalizeRoleText(item.senderName || '', item.senderRole || '');
            const fixedMsg = String(item.message || '')
              .replace(/مدير عام المنظومة الرئيسي\s*-?\s*م\.\s*محمود الشحات/g, 'مهندس الجودة والمساندة الفنية')
              .replace(/مدير عام المنظومة الرئيسي/g, 'مهندس الجودة والمساندة الفنية')
              .replace(/مدير المنظومة الرئيسي/g, 'مهندس الجودة والمساندة الفنية');
            return {
              ...item,
              senderRole: fixedRole,
              message: fixedMsg
            };
          });
          this.history.forEach(item => {
            if (item.eventId) this.processedEventIds.add(item.eventId);
          });
        }
      }
    } catch {
      this.history = [];
    }
  }

  private saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history.slice(0, 120)));
    } catch {}
    this.notifyHistoryListeners();
  }

  private notifyHistoryListeners() {
    const unread = this.getUnreadCount();
    const snapshot = [...this.history];
    this.listeners.forEach(cb => cb(snapshot, unread));
  }

  public subscribeToNotifications(cb: (items: LiveNotificationItem[], unreadCount: number) => void): () => void {
    this.listeners.add(cb);
    cb([...this.history], this.getUnreadCount());
    return () => this.listeners.delete(cb);
  }

  public subscribeHistory(cb: (items: LiveNotificationItem[], unreadCount: number) => void): () => void {
    return this.subscribeToNotifications(cb);
  }

  public getNotificationsHistory(): LiveNotificationItem[] {
    return [...this.history];
  }

  public getHistory(): LiveNotificationItem[] {
    return this.getNotificationsHistory();
  }

  public getUnreadCount(): number {
    return this.history.filter(item => !item.read).length;
  }

  public markAllAsRead(): void {
    let changed = false;
    this.history = this.history.map(item => {
      if (!item.read) {
        changed = true;
        return { ...item, read: true };
      }
      return item;
    });
    if (changed) {
      this.saveHistory();
    }
  }

  public markAsRead(id: string): void {
    let changed = false;
    this.history = this.history.map(item => {
      if (item.id === id && !item.read) {
        changed = true;
        return { ...item, read: true };
      }
      return item;
    });
    if (changed) {
      this.saveHistory();
    }
  }

  public async clearNotificationsHistory(): Promise<void> {
    this.history = [];
    this.saveHistory();
    try {
      const token = typeof window !== 'undefined'
        ? (sessionStorage.getItem('p155_session_jwt_token_v1') || localStorage.getItem('p155_session_jwt_token_v1'))
        : null;
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}`, 'x-auth-token': token } : {}
      });
    } catch {}
  }

  public async clearHistory(): Promise<void> {
    return this.clearNotificationsHistory();
  }

  public async fetchServerNotificationsLog(): Promise<void> {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.notificationsLog)) {
          this.syncFromServerLog(data.notificationsLog);
        } else if (Array.isArray(data)) {
          this.syncFromServerLog(data);
        }
      }
    } catch {}
  }

  public syncFromServerLog(serverLog?: LiveNotificationItem[], myClientId?: string): void {
    if (!Array.isArray(serverLog) || serverLog.length === 0) return;
    const existingIds = new Set(this.history.map(h => h.eventId || h.id));
    let added = false;

    for (const item of serverLog) {
      const key = item.eventId || item.id;
      if (key && !existingIds.has(key)) {
        existingIds.add(key);
        if (item.eventId) this.processedEventIds.add(item.eventId);
        this.history.push({
          ...item,
          read: item.senderId === myClientId ? true : Boolean(item.read)
        });
        added = true;
      }
    }

    if (added) {
      this.history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      this.history = this.history.slice(0, 120);
      this.saveHistory();
    }
  }

  /**
   * Processes any incoming RealtimeEvent, builds a structured Arabic notification item,
   * logs it in the notification center, and if remote, triggers a native OS notification.
   */
  public processRealtimeEvent(event: RealtimeEvent, isRemote: boolean): LiveNotificationItem | null {
    if (!event) return null;
    if (
      event.type === 'USER_PRESENCE' ||
      event.type === 'HEARTBEAT' ||
      event.type === 'PING' ||
      event.type === 'PONG'
    ) {
      return null;
    }

    if (event.eventId && this.processedEventIds.has(event.eventId)) {
      return null;
    }

    const { type, payload, senderName, senderRole, senderDevice } = event;
    const actorName = senderName || (isRemote ? 'مستخدم آخر بالمنظومة' : this.userIdentity.userName);
    const byActor = isRemote ? ` • بواسطة: ${actorName}` : '';

    let title = '';
    let message = '';
    let notifCategory: LiveNotificationItem['type'] = 'update';
    let officeName: string | undefined = undefined;
    let workOrderNumber: string | undefined = undefined;
    let orderId: string | undefined = undefined;
    let isUrgent = false;

    switch (type) {
      case 'BROADCAST_ALERT':
        isUrgent = Boolean(payload?.isUrgent);
        title = isUrgent ? `🚨 تعميم عاجل: ${payload?.title || 'تنبيه فوري'}` : `📢 تنبيه فوري: ${payload?.title || 'رسالة للفريق'}`;
        message = `${payload?.message || ''}${byActor}`;
        notifCategory = 'broadcast';
        officeName = payload?.office;
        break;

      case 'CREATE_ORDER':
        title = `📋 أمر عمل جديد (${payload?.workOrderNumber || ''})`;
        message = `تم إدراج أمر عمل جديد لمكتب ${payload?.office || ''} - المقاول: ${payload?.contractor || ''}${byActor}`;
        notifCategory = 'create';
        officeName = payload?.office;
        workOrderNumber = payload?.workOrderNumber;
        orderId = payload?.id;
        break;

      case 'CREATE_BATCH_ORDERS': {
        const count = Array.isArray(payload)
          ? payload.length
          : (Array.isArray(payload?.orders) ? payload.orders.length : 'مجموعة');
        title = `📥 استيراد دفعة أوامر عمل (${count})`;
        message = `تم استيراد وإدراج (${count}) أمر عمل جديد في المنظومة بنجاح${byActor}`;
        notifCategory = 'import';
        break;
      }

      case 'UPDATE_ORDER': {
        const statusStr = String(payload?.procedure155Status || '');
        const isQualified = statusStr.includes('مؤهل') && !statusStr.includes('غير');
        const isNotQualified = statusStr.includes('غير');

        if (isQualified) {
          title = `✅ تأهيل أمر عمل للإغلاق (${payload?.workOrderNumber || ''})`;
        } else if (isNotQualified) {
          title = `⚠️ أمر عمل غير مؤهل للإغلاق (${payload?.workOrderNumber || ''})`;
        } else {
          title = `✏️ تحديث أمر العمل (${payload?.workOrderNumber || ''})`;
        }

        const st = statusStr ? ` [الحالة: ${statusStr}]` : '';
        message = `تم تحديث أمر العمل لمكتب ${payload?.office || ''} - المقاول: ${payload?.contractor || ''}${st}${byActor}`;
        notifCategory = 'update';
        officeName = payload?.office;
        workOrderNumber = payload?.workOrderNumber;
        orderId = payload?.id;
        break;
      }

      case 'DELETE_ORDER':
        title = `🗑️ حذف أمر عمل ${payload?.workOrderNumber ? `(${payload.workOrderNumber})` : ''}`;
        message = `تم حذف أمر العمل ${payload?.workOrderNumber ? `رقم (${payload.workOrderNumber})` : ''} ${payload?.office ? `لمكتب ${payload.office}` : ''} من السجلات${byActor}`;
        notifCategory = 'delete';
        officeName = payload?.office;
        workOrderNumber = payload?.workOrderNumber;
        orderId = payload?.id;
        break;

      case 'DELETE_BATCH_ORDERS': {
        const count = payload?.ids?.length || payload?.orderIds?.length || 'مجموعة';
        title = `🗑️ حذف دفعة أوامر عمل (${count})`;
        message = `تم حذف (${count}) أوامر عمل محددة من النظام${byActor}`;
        notifCategory = 'delete';
        break;
      }

      case 'CLEAR_ORDERS': {
        const isAll = !payload?.office || payload.office === 'all' || payload.office === 'جميع المكاتب الفرعية';
        title = '⚠️ تفريغ سجلات الجدول';
        message = `${isAll ? 'تم مسح وتفريغ كافة السجلات بالكامل' : `تم مسح وتفريغ سجلات مكتب (${payload.office})`}${byActor}`;
        notifCategory = 'delete';
        officeName = payload?.office;
        break;
      }

      case 'ADD_MONTH_TABLE':
        title = `📑 جدول شهري جديد (${payload?.name || ''})`;
        message = `تم إنشاء الجدول المستقل (${payload?.name || ''}) لشهر ${payload?.month || ''}/${payload?.year || ''}${byActor}`;
        notifCategory = 'create';
        break;

      case 'UPDATE_MONTH_TABLE':
        title = `📑 تحديث جدول شهري (${payload?.name || ''})`;
        message = `تم تحديث بيانات الجدول (${payload?.name || ''})${byActor}`;
        notifCategory = 'update';
        break;

      case 'DELETE_MONTH_TABLE':
        title = `📑 حذف جدول شهري ${payload?.name ? `(${payload.name})` : ''}`;
        message = `تم حذف الجدول المحدد ومزامنة السجلات بنجاح${byActor}`;
        notifCategory = 'delete';
        break;

      case 'ADD_OFFICE': {
        const offName = payload?.office?.name || payload?.name || '';
        title = `🏢 إضافة مكتب فرعي (${offName})`;
        message = `تمت إضافة وتفعيل المكتب الفرعي (${offName}) في المنظومة${byActor}`;
        notifCategory = 'create';
        officeName = offName;
        break;
      }

      case 'UPDATE_OFFICE': {
        const offName = payload?.office?.name || payload?.name || '';
        title = `🏢 تحديث مكتب فرعي (${offName})`;
        message = `تم تحديث بيانات المكتب الفرعي (${offName}) ومزامنة أوامره${byActor}`;
        notifCategory = 'update';
        officeName = offName;
        break;
      }

      case 'DELETE_OFFICE': {
        const offName = payload?.name || '';
        title = `🏢 حذف مكتب فرعي (${offName})`;
        message = `تم حذف المكتب الفرعي (${offName}) ${payload?.reassignTo ? `وتحويل أوامره إلى (${payload.reassignTo})` : ''}${byActor}`;
        notifCategory = 'delete';
        officeName = offName;
        break;
      }

      case 'UPDATE_OFFICE_CONTRACTORS':
        title = `👷‍♂️ تحديث مقاولي (${payload?.officeName || ''})`;
        message = `تم تحديث قائمة المقاولين المعتمدين لمكتب (${payload?.officeName || ''})${byActor}`;
        notifCategory = 'update';
        officeName = payload?.officeName;
        break;

      case 'UPDATE_COLUMNS':
        title = '⚙️ تحديث هيكلة أعمدة الجدول';
        message = `تم حفظ وتحديث مسميات وهيكلة أعمدة الجدول${byActor}`;
        notifCategory = 'update';
        break;

      case 'UPDATE_DROPDOWN_OPTIONS':
        title = '📋 تحديث القوائم المنسدلة';
        message = `تم تحديث خيارات القوائم المنسدلة المعتمدة في المنظومة${byActor}`;
        notifCategory = 'update';
        break;

      case 'RESTORE_SNAPSHOT':
      case 'SYNC_ALL':
        if (payload?.description || payload?.actionType === 'undo' || payload?.actionType === 'redo' || payload?.actionType === 'restore') {
          title = payload?.actionType === 'undo'
            ? '↩️ تراجع ومزامنة سحابية'
            : payload?.actionType === 'redo'
            ? '↪️ إعادة إجراء ومزامنة سحابية'
            : '🛡️ استعادة ومزامنة البيانات السحابية';
          message = `${payload?.description || 'تمت مزامنة حالة السجلات لكافة المستخدمين'}${byActor}`;
          notifCategory = 'restore';
        } else {
          return null;
        }
        break;

      default:
        return null;
    }

    if (event.eventId) {
      this.processedEventIds.add(event.eventId);
    }

    const item: LiveNotificationItem = {
      id: event.eventId || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      eventId: event.eventId,
      title,
      message,
      type: notifCategory,
      senderId: event.senderId || 'server',
      senderName: actorName,
      senderRole: senderRole || 'منظومة إجراء 155',
      senderDevice,
      office: officeName,
      workOrderNumber,
      orderId,
      timestamp: event.timestamp || new Date().toISOString(),
      read: !isRemote,
      isUrgent
    };

    this.history = [item, ...this.history.filter(h => h.id !== item.id && (!item.eventId || h.eventId !== item.eventId))].slice(0, 120);
    this.saveHistory();

    // Trigger Native Browser / OS Notification if remote and allowed by user preferences
    if (isRemote && this.shouldTriggerNotificationForCategory(notifCategory)) {
      if (this.preferences.enabled && this.preferences.desktopOsNotifications !== false) {
        this.showLocalNotification(title, {
          body: message,
          tag: event.eventId || item.id
        });
      }
    }

    return item;
  }

  public shouldTriggerNotificationForCategory(category: LiveNotificationItem['type']): boolean {
    if (!this.preferences.enabled) return false;
    switch (category) {
      case 'create':
        return this.preferences.createOrder !== false;
      case 'update':
        return this.preferences.updateOrder !== false;
      case 'delete':
        return this.preferences.deleteOrder !== false;
      case 'import':
        return this.preferences.importOrders !== false;
      case 'broadcast':
        return this.preferences.broadcastAlerts !== false;
      case 'restore':
      case 'sync':
        return this.preferences.officeAndSystemChanges !== false;
      default:
        return true;
    }
  }

  public savePreferences(newPrefs: Partial<NotificationPreferences>) {
    this.preferences = { ...this.preferences, ...newPrefs };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.preferences));
    } catch (e) {
      console.warn('Failed to save notification preferences to localStorage:', e);
    }

    if (this.currentSubscription) {
      this.syncSubscriptionWithServer(this.currentSubscription);
    }
  }

  public getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  public getPermissionStatus(): NotificationPermission {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'denied';
  }

  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window
    );
  }

  public isPushSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }

  public async init(): Promise<void> {
    if (this.isInitialized || typeof window === 'undefined') return;

    if ('Notification' in window) {
      this.permission = Notification.permission;
    }

    if (!('serviceWorker' in navigator)) {
      this.isInitialized = true;
      return;
    }

    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.swRegistration = reg;
      this.isInitialized = true;

      if ('PushManager' in window) {
        let sub = await reg.pushManager.getSubscription();
        if (!sub && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            const keyRes = await fetch('/api/push/public-key');
            if (keyRes.ok) {
              const { publicKey } = await keyRes.json();
              if (publicKey) {
                const applicationServerKey = urlBase64ToUint8Array(publicKey);
                sub = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey
                });
              }
            }
          } catch (autoErr) {
            console.warn('[NotificationService] Auto re-subscription notice:', autoErr);
          }
        }

        this.currentSubscription = sub;
        if (sub) {
          await this.syncSubscriptionWithServer(sub);
        }
      }
    } catch (err) {
      console.warn('[NotificationService] Service worker init warning:', err);
    }
  }

  /**
   * Request system permission and subscribe device to background Web Push
   */
  public async requestPermissionAndSubscribe(): Promise<{ success: boolean; permission: NotificationPermission; error?: string }> {
    if (!this.isSupported()) {
      return { success: false, permission: 'denied', error: 'المتصفح لا يدعم تقنية الإشعارات المنبثقة' };
    }

    try {
      const perm = await Notification.requestPermission();
      this.permission = perm;

      if (perm !== 'granted') {
        return { success: false, permission: perm, error: 'تم رفض الإذن بالإشعارات من المتصفح' };
      }

      if ('serviceWorker' in navigator) {
        if (!this.swRegistration) {
          await this.init();
        }
        try {
          const reg = await navigator.serviceWorker.ready;
          this.swRegistration = reg;

          if ('PushManager' in window) {
            const keyRes = await fetch('/api/push/public-key');
            if (keyRes.ok) {
              const { publicKey } = await keyRes.json();
              if (publicKey) {
                const applicationServerKey = urlBase64ToUint8Array(publicKey);
                let subscription = await reg.pushManager.getSubscription();
                if (!subscription) {
                  subscription = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey
                  });
                }
                this.currentSubscription = subscription;
                await this.syncSubscriptionWithServer(subscription);
              }
            }
          }
        } catch (pushErr) {
          console.warn('[NotificationService] PushManager fallback to local notifications:', pushErr);
        }
      }

      this.savePreferences({ enabled: true });

      this.showLocalNotification('🔔 تم تفعيل الإشعارات الفورية بنجاح', {
        body: 'ستصلك الآن تنبيهات فورية بكل إجراء وأمر عمل يتم بين جميع المستخدمين!',
        tag: 'welcome-notification'
      });

      return { success: true, permission: perm };
    } catch (err: any) {
      console.error('[NotificationService] Subscribe error:', err);
      return { success: false, permission: this.permission, error: err.message || 'حدث خطأ أثناء تفعيل الإشعارات' };
    }
  }

  private async syncSubscriptionWithServer(subscription: PushSubscription): Promise<void> {
    try {
      const device = this.detectDeviceName();
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription,
          device,
          userAgent: navigator.userAgent,
          preferences: this.preferences
        })
      });
    } catch (err) {
      console.warn('[NotificationService] Failed to sync subscription with server:', err);
    }
  }

  public async unsubscribe(): Promise<boolean> {
    try {
      if (this.currentSubscription) {
        const endpoint = this.currentSubscription.endpoint;
        await this.currentSubscription.unsubscribe();
        this.currentSubscription = null;

        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint })
        });
      }
      this.savePreferences({ enabled: false });
      return true;
    } catch (err) {
      console.error('[NotificationService] Unsubscribe error:', err);
      return false;
    }
  }

  public async sendTestNotification(): Promise<{ success: boolean; error?: string }> {
    const testTag = `test-notification-${Date.now()}`;
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '⚡ تنبيه تجريبي مباشر - منصة إجراء 155',
          body: `يعمل نظام الإشعارات والمزامنة الفورية بنجاح! (${this.userIdentity.userName})`
        })
      });

      this.showLocalNotification('⚡ تنبيه تجريبي مباشر - منصة إجراء 155', {
        body: 'يعمل نظام الإشعارات الفورية بنجاح! ستصلك التنبيهات من جميع المستخدمين لحظة بلحظة.',
        tag: testTag
      });

      return { success: res.ok };
    } catch {
      this.showLocalNotification('⚡ تنبيه تجريبي مباشر - منصة إجراء 155', {
        body: 'يعمل نظام الإشعارات بنجاح!',
        tag: testTag
      });
      return { success: true };
    }
  }

  /**
   * Display a local Notification using the native Notification API or Service Worker
   */
  public showLocalNotification(title: string, options?: NotificationOptions): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const finalOptions: any = {
      icon: '/icon.svg',
      badge: '/icon.svg',
      vibrate: [250, 100, 250],
      dir: 'rtl',
      lang: 'ar',
      ...options
    };

    try {
      if (this.swRegistration && 'showNotification' in this.swRegistration) {
        this.swRegistration.showNotification(title, finalOptions).catch(() => {
          try { new Notification(title, finalOptions); } catch {}
        });
      } else {
        new Notification(title, finalOptions);
      }
    } catch {}
  }

  public detectDeviceName(): string {
    if (typeof navigator === 'undefined') return 'جهاز متصل';
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'هاتف أندرويد';
    if (/iphone|ipad|ipod/i.test(ua)) return 'جهاز آبل (iOS)';
    if (/windows/i.test(ua)) return 'حاسوب ويندوز (Windows)';
    if (/macintosh|mac os x/i.test(ua)) return 'حاسوب ماك (macOS)';
    if (/linux/i.test(ua)) return 'جهاز لينكس (Linux)';
    return 'متصفح ويب';
  }
}

export const notificationService = new NotificationService();
