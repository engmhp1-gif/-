import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  RefreshCw, 
  Calendar, 
  Clock, 
  Zap, 
  ChevronsRight, 
  ChevronsLeft, 
  Maximize, 
  Minimize, 
  UserCheck, 
  Bell, 
  LogOut, 
  ShieldCheck,
  Wifi,
  WifiOff
} from 'lucide-react';
import { SyncStatus } from '../services/realtimeService';
import { PlatformUser, ConnectedUserInfo } from '../types';
import { hasUserPermission } from '../utils/security';

interface NavbarProps {
  syncStatus: SyncStatus;
  onlineCount: number;
  connectedUsers?: ConnectedUserInfo[];
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onResetData: () => void;
  onManualSync?: () => void;
  isManualSyncing?: boolean;
  totalOrdersCount: number;
  ready155Count: number;
  isSoundMuted?: boolean;
  onToggleSound?: () => void;
  onOpenWeeklyReport?: () => void;
  onOpenOfficeComparison?: () => void;
  onOpenContractorComparison?: () => void;
  onOpenComprehensiveReports?: () => void;
  onOpenExportModal?: (openEmail?: boolean) => void;
  onOpenDataRecovery?: () => void;
  onOpenNotificationSettings?: () => void;
  unreadNotificationsCount?: number;
  onOpenCommandPalette?: () => void;
  activeYear?: number;
  activeMonth?: number | 'all';
  onOpenYearMonthPicker?: () => void;
  isSessionUnlockedState?: boolean;
  onOpenPinModal?: () => void;
  onLockSession?: () => void;
  currentUser?: PlatformUser | null;
  onOpenPermissionsManager?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  syncStatus,
  onlineCount,
  connectedUsers = [],
  onToggleSidebar,
  isSidebarOpen,
  onOpenNotificationSettings,
  unreadNotificationsCount = 0,
  currentUser,
  onOpenPermissionsManager,
  onLogout
}) => {
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSyncMenuOpen, setIsSyncMenuOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

  const syncMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Real-time clock tick every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (syncMenuRef.current && !syncMenuRef.current.contains(target)) {
        setIsSyncMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  };

  // Format 12-hour Time with seconds & AM/PM
  const formattedTime = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(currentDateTime);

  // Gregorian Date in Arabic
  const formattedDate = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(currentDateTime);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-l from-slate-800 via-[#1e293b] to-indigo-950 text-white border-b border-slate-700/90 shadow-md font-['Cairo',sans-serif] select-none">
      <div className="w-full max-w-full px-2 sm:px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            id="btn-nav-sidebar-arrow-toggle"
            className="p-1.5 sm:p-2 rounded-xl border border-slate-600/80 bg-slate-700/70 hover:bg-slate-600/80 text-amber-300 transition-all cursor-pointer shadow-2xs"
            title={isSidebarOpen ? 'إخفاء القائمة الجانبية' : 'إظهار القائمة الجانبية'}
            aria-label="تبديل القائمة الجانبية"
          >
            {isSidebarOpen ? (
              <ChevronsRight className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 stroke-[2.2]" />
            ) : (
              <ChevronsLeft className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 stroke-[2.2]" />
            )}
          </button>

          <div className="flex items-center gap-2.5 shrink-0 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400/25 to-orange-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-2xs shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="text-right flex flex-col justify-center leading-tight min-w-0 max-w-[150px] xs:max-w-[210px] sm:max-w-[320px] md:max-w-none overflow-hidden">
              <div className="whitespace-nowrap animate-ticker-rtl md:animate-none">
                <h1 className="text-xs sm:text-sm font-black tracking-wide text-white">
                  حوكمة جودة اعمال الانشاءات
                </h1>
                <h2 className="text-[10px] sm:text-[11px] font-bold text-slate-300">
                  ادارة كهرباء الحدود الشمالية - المساندة الفنية
                </h2>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 1. اسم المستخدم */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-700/75 hover:bg-slate-600/85 text-white border border-slate-600/80 transition-all cursor-pointer text-xs font-bold shadow-2xs"
              title="بيانات المستخدم الحالي"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-300" />
              <span className="truncate max-w-[110px] sm:max-w-[140px]">
                {currentUser?.displayName || currentUser?.username || 'المستخدم'}
              </span>
            </button>

            {isUserMenuOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#eef2ff] rounded-2xl shadow-xl border border-slate-300 text-slate-900 p-3 z-50 animate-in fade-in zoom-in-95 text-right font-['Cairo',sans-serif]">
                <div className="pb-2.5 mb-2 border-b border-slate-300/80">
                  <div className="font-black text-xs text-slate-900">
                    {currentUser?.displayName || currentUser?.username}
                  </div>
                  <div className="text-[11px] text-slate-700 font-bold mt-0.5">
                    {currentUser?.roleTitle || 'عضو المنظومة'}
                  </div>
                  {currentUser?.email && (
                    <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                      {currentUser.email}
                    </div>
                  )}
                </div>

                {onOpenPermissionsManager && hasUserPermission(currentUser, 'manageUsers') && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenPermissionsManager();
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-black text-slate-800 hover:bg-blue-100/70 hover:text-blue-950 transition-colors cursor-pointer text-right"
                  >
                    <ShieldCheck className="w-4 h-4 text-blue-700" />
                    <span>إدارة المستخدمين والصلاحيات</span>
                  </button>
                )}

                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-black text-rose-800 hover:bg-rose-100/80 transition-colors cursor-pointer mt-1 text-right"
                  >
                    <LogOut className="w-4 h-4 text-rose-700" />
                    <span>تسجيل الخروج</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 2. التاريخ */}
          <div 
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-600/80 text-xs font-bold text-slate-100 shadow-2xs"
            title="التاريخ الحالي"
          >
            <Calendar className="w-3.5 h-3.5 text-sky-300" />
            <span className="font-mono text-[11px] whitespace-nowrap">{formattedDate}</span>
          </div>

          {/* 3. الوقت */}
          <div 
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-600/80 text-xs font-bold text-slate-100 shadow-2xs"
            title="الوقت الحالي"
          >
            <Clock className="w-3.5 h-3.5 text-amber-300" />
            <span className="font-mono text-[11px] whitespace-nowrap">{formattedTime}</span>
          </div>

          {/* 4. التنبيهات */}
          <button
            type="button"
            onClick={onOpenNotificationSettings}
            className="relative p-2 rounded-xl bg-slate-700/75 hover:bg-slate-600/85 text-amber-300 border border-slate-600/80 transition-all cursor-pointer shadow-2xs"
            title="التنبيهات"
            aria-label="التنبيهات"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center px-1 border border-white">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* 5. زر المتصلون بالمنصة */}
          <div className="relative" ref={syncMenuRef}>
            <button
              type="button"
              onClick={() => setIsSyncMenuOpen(!isSyncMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-700/75 hover:bg-slate-600/85 text-white border border-slate-600/80 transition-all cursor-pointer text-xs font-bold shadow-2xs"
              title="المتصلون بالمنصة الآن والمزامنة التلقائية"
            >
              <Users className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-[11px]">المتصلون</span>
              <span className="px-1.5 py-0.2 rounded-md bg-emerald-400/20 text-emerald-200 text-[10px] font-mono font-bold flex items-center gap-1 border border-emerald-400/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>{onlineCount}</span>
              </span>
            </button>

            {isSyncMenuOpen && (
              <div className="absolute left-0 mt-2 w-80 bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#eef2ff] rounded-2xl shadow-xl border border-slate-300 text-slate-900 p-3.5 z-50 animate-in fade-in zoom-in-95 text-right font-['Cairo',sans-serif]">
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-300/80">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-black text-slate-900">المتصلون بالمنصة الآن</span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{onlineCount} متصل</span>
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200 text-[11px] font-semibold text-emerald-900 mb-3 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>المزامنة التلقائية الفورية مفعّلة ولحظية بين الجميع دون الحاجة لأي زر</span>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                  {connectedUsers && connectedUsers.length > 0 ? (
                    connectedUsers.map((u, idx) => (
                      <div
                        key={u.clientId || idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-200">
                            {(u.userName || 'م')[0]}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {u.userName || 'مستخدم متصل'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium truncate">
                              {u.userRole || 'عضو المنظومة'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>متصل</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-200">
                          {(currentUser?.displayName || currentUser?.username || 'م')[0]}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {currentUser?.displayName || currentUser?.username || 'حسابك الحاضر'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium truncate">
                            {currentUser?.roleTitle || 'عضو المنظومة'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>نشط الآن</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 6. العرض */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="p-2 rounded-xl bg-slate-700/75 hover:bg-slate-600/85 text-sky-300 border border-slate-600/80 transition-all cursor-pointer shadow-2xs"
            title={isFullscreen ? 'تصغير الشاشة' : 'العرض في كامل الشاشة'}
            aria-label="العرض"
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4 text-sky-300" />
            ) : (
              <Maximize className="w-4 h-4 text-sky-300" />
            )}
          </button>

          {/* 7. خروج */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-400/40 transition-all cursor-pointer text-xs font-black shadow-2xs"
              title="تسجيل الخروج من المنصة"
              aria-label="تسجيل الخروج"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
