import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Bell, 
  BellRing, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Send, 
  Smartphone, 
  Monitor, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  FileSpreadsheet, 
  ShieldCheck, 
  RefreshCw,
  Loader2,
  Users,
  Radio,
  UserCheck,
  CheckCheck,
  Clock,
  Megaphone,
  Wifi,
  Activity,
  Building2,
  FileText,
  Filter
} from 'lucide-react';
import { notificationService, NotificationPreferences, UserNotificationIdentity } from '../services/notificationService';
import { realtime, SyncStatus } from '../services/realtimeService';
import { soundService } from '../services/soundService';
import { ConnectedUserInfo, LiveNotificationItem } from '../types';

export interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowAppNotification?: (message: string, type?: 'create' | 'update' | 'delete' | 'sync') => void;
  initialTab?: 'feed' | 'broadcast' | 'users' | 'settings';
  officesList?: string[];
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  onShowAppNotification,
  initialTab = 'feed',
  officesList = []
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'broadcast' | 'users' | 'settings'>(initialTab);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => notificationService.getPreferences());
  const [isSupported, setIsSupported] = useState(true);

  // User Identity State
  const [identity, setIdentity] = useState<UserNotificationIdentity>(() => notificationService.getUserIdentity());
  const [userNameInput, setUserNameInput] = useState(identity.userName);
  const [userRoleInput, setUserRoleInput] = useState(identity.userRole);
  const [identitySaved, setIdentitySaved] = useState(false);

  // Live Notification History State
  const [notifications, setNotifications] = useState<LiveNotificationItem[]>(() => notificationService.getHistory());
  const [unreadCount, setUnreadCount] = useState<number>(() => notificationService.getUnreadCount());
  const [feedFilter, setFeedFilter] = useState<'all' | 'unread' | 'create' | 'update' | 'delete' | 'broadcast'>('all');

  // Connected Users & Realtime Status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => realtime.getStatus());
  const [onlineCount, setOnlineCount] = useState<number>(() => realtime.getOnlineCount());
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUserInfo[]>(() => realtime.getConnectedUsers());
  const [latencyMs, setLatencyMs] = useState<number>(() => realtime.getLatencyMs());
  const [isSyncingNow, setIsSyncingNow] = useState(false);

  // Broadcast Alert Form State
  const [broadcastTitle, setBroadcastTitle] = useState('تنبيه فوري لفريق تدقيق إجراء 155');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState<'normal' | 'high' | 'urgent'>('high');
  const [broadcastOffice, setBroadcastOffice] = useState<string>('all');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSupported(notificationService.isSupported());
      setPermission(notificationService.getPermissionStatus());
      setPrefs(notificationService.getPreferences());
      const currentId = notificationService.getUserIdentity();
      setIdentity(currentId);
      setUserNameInput(currentId.userName);
      setUserRoleInput(currentId.userRole);
      setNotifications(notificationService.getHistory());
      setUnreadCount(notificationService.getUnreadCount());
      setConnectedUsers(realtime.getConnectedUsers());
      setOnlineCount(realtime.getOnlineCount());
      setLatencyMs(realtime.getLatencyMs());
      setTestResult(null);

      // Sync latest server notifications log
      notificationService.fetchServerNotificationsLog().catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    const unsubHistory = notificationService.subscribeHistory((items, unread) => {
      setNotifications(items);
      setUnreadCount(unread);
    });

    const unsubStatus = realtime.onStatusChange((status, count, users) => {
      setSyncStatus(status);
      setOnlineCount(count);
      if (users) setConnectedUsers(users);
      setLatencyMs(realtime.getLatencyMs());
    });

    return () => {
      unsubHistory();
      unsubStatus();
    };
  }, []);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (feedFilter === 'unread') return !item.read;
      if (feedFilter === 'create') return item.type === 'create' || item.type === 'import';
      if (feedFilter === 'update') return item.type === 'update' || item.type === 'office' || item.type === 'restore';
      if (feedFilter === 'delete') return item.type === 'delete';
      if (feedFilter === 'broadcast') return item.type === 'broadcast' || item.type === 'sync';
      return true;
    });
  }, [notifications, feedFilter]);

  if (!isOpen) return null;

  const handleSaveIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = notificationService.saveUserIdentity({
      userName: userNameInput.trim() || 'مهندس تدقيق 155',
      userRole: userRoleInput.trim() || 'مدقق جودة ومطابقة فنية'
    });
    setIdentity(updated);
    realtime.updatePresenceIdentity();
    setIdentitySaved(true);
    soundService.playActionSound('update');
    if (onShowAppNotification) {
      onShowAppNotification(`تم اعتماد اسم المعرف الفوري (${updated.userName}) لكافة المستخدمين المتصلين`, 'update');
    }
    setTimeout(() => setIdentitySaved(false), 3000);
  };

  const handleRequestPermission = async () => {
    setIsSubscribing(true);
    setTestResult(null);

    try {
      const result = await notificationService.requestPermissionAndSubscribe();
      setPermission(result.permission);

      if (result.success) {
        soundService.playActionSound('create');
        if (onShowAppNotification) {
          onShowAppNotification('تم تفعيل خدمة الإشعارات الفورية بالخلفية بنجاح!', 'create');
        }
      } else if (result.error) {
        if (onShowAppNotification) {
          onShowAppNotification(result.error, 'delete');
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSendTestNotification = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      soundService.playActionSound('notification');
      const res = await notificationService.sendTestNotification();
      if (res.success) {
        setTestResult('تم إرسال التنبيه التجريبي بنجاح لجميع الأجهزة المشتركة ومركز الإشعارات!');
        if (onShowAppNotification) {
          onShowAppNotification('تم إرسال إشعار تجريبي فوري إلى جهازك الآن', 'update');
        }
      } else {
        setTestResult('تعذر إرسال الإشعار الخارجي. تأكد من منح الإذن للإشعارات في المتصفح.');
      }
    } catch (err: any) {
      setTestResult('حدث خطأ أثناء إرسال التنبيه التجريبي.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    setIsSendingBroadcast(true);
    try {
      const ok = await realtime.sendBroadcastAlert({
        title: broadcastTitle.trim() || 'تنبيه فوري - منصة إجراء 155',
        message: broadcastMessage.trim(),
        priority: broadcastPriority,
        office: broadcastOffice === 'all' ? undefined : broadcastOffice
      });

      if (ok) {
        soundService.playActionSound('notification');
        setBroadcastMessage('');
        setActiveTab('feed');
        if (onShowAppNotification) {
          onShowAppNotification('تم بث الإشعار الفوري لكافة المستخدمين المتصلين بنجاح!', 'create');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleManualForceSync = async () => {
    setIsSyncingNow(true);
    try {
      await realtime.forceSyncNow();
      await notificationService.fetchServerNotificationsLog();
      soundService.playActionSound('sync');
      if (onShowAppNotification) {
        onShowAppNotification('تمت المزامنة الفورية وتحديث قائمة المتصلين والإشعارات بنجاح', 'sync');
      }
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleTogglePreference = (key: keyof NotificationPreferences) => {
    const updated = {
      ...prefs,
      [key]: !prefs[key]
    };
    setPrefs(updated);
    notificationService.savePreferences(updated);
  };

  const formatTimeAgo = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSec < 10) return 'الآن';
      if (diffSec < 60) return `منذ ${diffSec} ثانية`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `منذ ${diffHr} ساعة`;
      return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return '';
    }
  };

  const getNotificationBadgeStyle = (type: LiveNotificationItem['type'], priority?: string) => {
    if (priority === 'urgent') {
      return 'bg-rose-100 text-rose-800 border-rose-300';
    }
    switch (type) {
      case 'create':
      case 'import':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'delete':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'broadcast':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'sync':
      case 'restore':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 text-right font-['Cairo',sans-serif]">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full my-4 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shadow-inner shrink-0">
              <BellRing className="w-6 h-6 animate-pulse" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] font-black flex items-center justify-center border-2 border-slate-950 shadow-md">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-xl font-black text-white">
                  مركز المزامنة الفورية والإشعارات المباشرة
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>{onlineCount} متصل الآن</span>
                </span>
                {latencyMs > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    {latencyMs}ms
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1">
                مزامنة لحظية ثلاثية القنوات (WebSocket + SSE + Web Push) وتنبيهات فورية بين جميع المستخدمين
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-900 px-3 sm:px-5 py-2 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => {
              setActiveTab('feed');
              notificationService.markAllAsRead();
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'feed'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>سجل الإشعارات الحية</span>
            {notifications.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'feed' ? 'bg-black/25 text-white' : 'bg-slate-800 text-emerald-400'
              }`}>
                {notifications.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('broadcast')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'broadcast'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>إرسال تنبيه عاجل للجميع</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>المتصلون الآن وهويتك</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              {onlineCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>إعدادات الإشعارات والـ Push</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[72vh] overflow-y-auto bg-slate-50/60">

          {/* TAB 1: LIVE NOTIFICATION FEED */}
          {activeTab === 'feed' && (
            <div className="space-y-4">
              {/* Feed Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
                  {[
                    { key: 'all', label: 'الكل' },
                    { key: 'create', label: 'إضافات واستيراد' },
                    { key: 'update', label: 'تعديلات وحالات' },
                    { key: 'delete', label: 'حذف' },
                    { key: 'broadcast', label: 'تنبيهات عامة' }
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFeedFilter(f.key as any)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        feedFilter === f.key
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => notificationService.markAllAsRead()}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                    title="تحديد جميع الإشعارات كمقروءة"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>قراءة الكل</span>
                  </button>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => notificationService.clearHistory()}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                      title="مسح سجل الإشعارات"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>مسح السجل</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Feed Items List */}
              {filteredNotifications.length === 0 ? (
                <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Bell className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">لا توجد إشعارات مسجلة في هذا التصنيف بعد</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    بمجرد قيام أي مستخدم بإضافة أو تعديل أو حذف أمر عمل أو إرسال تنبيه عاجل، سيظهر هنا فوراً مع إشعار صوتي وتنبيه على سطح المكتب.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredNotifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => notificationService.markAsRead(item.id)}
                      className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                        !item.read
                          ? 'bg-emerald-50/40 border-emerald-300 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`px-2.5 py-1 rounded-xl border text-[11px] font-black shrink-0 mt-0.5 ${getNotificationBadgeStyle(item.type, item.priority)}`}>
                          {item.type === 'create' && 'إضافة'}
                          {item.type === 'import' && 'استيراد'}
                          {item.type === 'update' && 'تحديث'}
                          {item.type === 'delete' && 'حذف'}
                          {item.type === 'broadcast' && 'تنبيه فوري'}
                          {item.type === 'sync' && 'مزامنة'}
                          {item.type === 'office' && 'مكاتب'}
                          {item.type === 'restore' && 'استعادة'}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="text-xs sm:text-sm font-black text-slate-900">
                              {item.title}
                            </h5>
                            {!item.read && (
                              <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-black">
                                جديد
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed break-words">
                            {item.message}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px] text-slate-500 font-bold">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                              <UserCheck className="w-3 h-3 text-emerald-600" />
                              <span>{item.senderName}</span>
                              {item.senderRole && (
                                <span className="text-slate-400 font-normal">({item.senderRole})</span>
                              )}
                            </span>

                            {item.office && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                                <Building2 className="w-3 h-3 text-blue-600" />
                                <span>{item.office}</span>
                              </span>
                            )}

                            {item.workOrderNumber && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-mono">
                                <FileText className="w-3 h-3 text-amber-600" />
                                <span>#{item.workOrderNumber}</span>
                              </span>
                            )}

                            <span className="inline-flex items-center gap-1 text-slate-400 mr-auto">
                              <Clock className="w-3 h-3" />
                              <span>{formatTimeAgo(item.timestamp)}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BROADCAST INSTANT ALERT TO ALL USERS */}
          {activeTab === 'broadcast' && (
            <form onSubmit={handleSendBroadcast} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">بث إشعار فوري لكافة المستخدمين المتصلين</h4>
                    <p className="text-xs text-slate-500">
                      يصل هذا الإشعار لحظياً لجميع المتصلين بالمنصة وكذلك عبر إشعارات سطح المكتب والهاتف (Web Push)
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    عنوان التنبيه الفوري
                  </label>
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="مثال: تنبيه هام بخصوص تدقيق أوامر شهر أكتوبر"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      درجة الأهمية
                    </label>
                    <select
                      value={broadcastPriority}
                      onChange={(e) => setBroadcastPriority(e.target.value as any)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="normal">عادي</option>
                      <option value="high">هام</option>
                      <option value="urgent">عاجل جداً 🚨</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      المكتب المستهدف
                    </label>
                    <select
                      value={broadcastOffice}
                      onChange={(e) => setBroadcastOffice(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="all">جميع المكاتب الفرعية</option>
                      {officesList.map((off) => (
                        <option key={off} value={off}>{off}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  نص الرسالة والتوجيه الفوري
                </label>
                <textarea
                  rows={3}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="اكتب نص الإشعار الذي سيظهر فوراً على شاشات جميع المستخدمين المتصلين..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-slate-500 font-bold">
                  سيتم الإرسال باسم: <span className="text-slate-900 font-black">{identity.userName} ({identity.userRole})</span>
                </div>

                <button
                  type="submit"
                  disabled={isSendingBroadcast || !broadcastMessage.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSendingBroadcast ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري البث لجميع الأجهزة...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>بث الإشعار الفوري للجميع الآن ⚡</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: CONNECTED USERS & USER IDENTITY */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* User Identity Configuration Card */}
              <form onSubmit={handleSaveIdentity} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-emerald-600" />
                    <h4 className="text-sm font-black text-slate-900">هويتك التعريفية في المزامنة الفورية والإشعارات</h4>
                  </div>
                  <span className="text-[11px] text-slate-500 font-bold">يظهر اسمك لبقية المستخدمين عند إجراء أي تعديل</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">اسم المستخدم / المهندس</label>
                    <input
                      type="text"
                      value={userNameInput}
                      onChange={(e) => setUserNameInput(e.target.value)}
                      placeholder="مثال: مهندس تدقيق معتمد"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">المسمى الوظيفي / الصفة</label>
                    <input
                      type="text"
                      value={userRoleInput}
                      onChange={(e) => setUserRoleInput(e.target.value)}
                      placeholder="مثال: مدقق جودة ومطابقة فنية"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-colors cursor-pointer shadow-xs"
                    >
                      {identitySaved ? '✓ تم حفظ الهوية وتحديثها' : 'حفظ وتحديث الهوية الفورية'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Connected Users Live List */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-5 h-5 text-blue-600 animate-pulse" />
                    <div>
                      <h4 className="text-sm font-black text-slate-900">
                        المستخدمون المتصلون بالمنظومة الآن ({onlineCount})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        قنوات الاتصال النشطة: WebSocket المباشر + تدفق SSE الفوري + المصالحة الدورية الذكية
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleManualForceSync}
                    disabled={isSyncingNow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin text-blue-600' : ''}`} />
                    <span>تحديث المتصلين</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  {connectedUsers.length === 0 ? (
                    <div className="col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                        <span className="font-black text-slate-900">{identity.userName} (أنت)</span>
                        <span className="text-slate-500">• {identity.userRole}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                        متصل نشط
                      </span>
                    </div>
                  ) : (
                    connectedUsers.map((u) => {
                      const isMe = u.clientId === realtime.getClientId();
                      return (
                        <div
                          key={u.clientId}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                            isMe
                              ? 'bg-emerald-50/60 border-emerald-300'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                              isMe ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                            }`}>
                              {u.userName.slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-slate-900 truncate">
                                  {u.userName}
                                </span>
                                {isMe && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[9px] font-black">
                                    أنت
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {u.userRole} • {u.device}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end shrink-0">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                              {u.transport.toUpperCase()}
                            </span>
                            <span className="text-[9px] text-slate-400 mt-0.5">
                              {formatTimeAgo(u.lastSeen)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PUSH SETTINGS & TRIGGER PREFERENCES */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              {/* 1. Status Banner */}
              {permission === 'granted' ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/60 border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-emerald-950 text-sm sm:text-base flex items-center gap-1.5">
                        <span>الإشعارات الفورية الخارجية مفعلة ونشطة بنجاح</span>
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      </h4>
                      <p className="text-xs text-emerald-800/90 mt-1 leading-relaxed">
                        جهازك متصل بخدمة التنبيهات السحابية. ستصلك إشعارات فورية على سطح المكتب أو شاشة القفل حتى لو قمت بإغلاق نافذة المتصفح تماماً.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isTesting}
                    onClick={handleSendTestNotification}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black shadow-md border border-emerald-500/40 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري الإرسال...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>إرسال إشعار تجريبي ⚡</span>
                      </>
                    )}
                  </button>
                </div>
              ) : permission === 'denied' ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 border border-rose-300 flex items-start gap-3 text-rose-950 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm sm:text-base">
                      تم حظر الإشعارات الخارجية في إعدادات المتصفح
                    </h4>
                    <p className="text-xs text-rose-800/90 mt-1 leading-relaxed">
                      ملاحظة: الإشعارات الفورية داخل المنصة تعمل بشكل طبيعي، ولتفعيل إشعارات سطح المكتب أثناء إغلاق الموقع يرجى السماح بالإشعارات من أيقونة القفل بجانب الرابط.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100/60 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <Bell className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-amber-950 text-sm sm:text-base">
                        تفعيل إشعارات النظام الخلفية (Web Push)
                      </h4>
                      <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                        فعّل الإشعارات بضغطة زر واحدة لتصلك التنبيهات الفورية على شاشة جهازك فور اتخاذ أي إجراء داخل المنصة.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isSubscribing || !isSupported}
                    onClick={handleRequestPermission}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-black shadow-lg border border-emerald-400/40 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {isSubscribing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري التفعيل...</span>
                      </>
                    ) : (
                      <>
                        <BellRing className="w-4 h-4" />
                        <span>تفعيل الإشعارات الآن 🔔</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {testResult && (
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{testResult}</span>
                </div>
              )}

              {/* 2. Custom Trigger Preferences */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>تخصيص أنواع الإجراءات التي يتم إشعارك بها فوراً:</span>
                  </div>
                  <span className="text-[11px] text-slate-500">تحكم كامل</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <label 
                    onClick={() => handleTogglePreference('createOrder')}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                      prefs.createOrder ? 'bg-emerald-50/40 border-emerald-400' : 'bg-slate-100/70 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <PlusCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 block">إضافة أمر عمل جديد</span>
                        <span className="text-[10px] text-slate-500 block">عند تسجيل أي أمر عمل بالمنظومة</span>
                      </div>
                    </div>
                    <input type="checkbox" checked={prefs.createOrder} readOnly className="w-4 h-4 accent-emerald-600 pointer-events-none" />
                  </label>

                  <label 
                    onClick={() => handleTogglePreference('updateOrder')}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                      prefs.updateOrder ? 'bg-blue-50/40 border-blue-400' : 'bg-slate-100/70 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <Edit3 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 block">تعديل أوامر العمل والحالات</span>
                        <span className="text-[10px] text-slate-500 block">تغيير حالة 155، النماذج، الملاحظات</span>
                      </div>
                    </div>
                    <input type="checkbox" checked={prefs.updateOrder} readOnly className="w-4 h-4 accent-blue-600 pointer-events-none" />
                  </label>

                  <label 
                    onClick={() => handleTogglePreference('deleteOrder')}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                      prefs.deleteOrder ? 'bg-rose-50/40 border-rose-400' : 'bg-slate-100/70 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 block">حذف أوامر العمل</span>
                        <span className="text-[10px] text-slate-500 block">عند حذف أمر عمل أو تفريغ جدول</span>
                      </div>
                    </div>
                    <input type="checkbox" checked={prefs.deleteOrder} readOnly className="w-4 h-4 accent-rose-600 pointer-events-none" />
                  </label>

                  <label 
                    onClick={() => handleTogglePreference('importOrders')}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                      prefs.importOrders ? 'bg-teal-50/40 border-teal-400' : 'bg-slate-100/70 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 block">استيراد دفعات إكسل</span>
                        <span className="text-[10px] text-slate-500 block">عند استيراد أوامر جديدة أو دمجها</span>
                      </div>
                    </div>
                    <input type="checkbox" checked={prefs.importOrders} readOnly className="w-4 h-4 accent-teal-600 pointer-events-none" />
                  </label>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between gap-3 bg-white">
          <div className="text-xs text-slate-600 font-bold flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800">
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              <span>حالة المزامنة: {syncStatus === 'connected' ? 'متصل لحظياً' : 'إعادة اتصال تلقائي'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span>المعرف النشط: {identity.userName}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualForceSync}
              disabled={isSyncingNow}
              className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-100 text-emerald-900 hover:bg-emerald-200 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
              <span>مزامنة الآن</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer shadow-md"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
