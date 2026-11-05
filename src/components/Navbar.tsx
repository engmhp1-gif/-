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
  WifiOff,
  FileDown
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
  onPublishPlatform?: () => void;
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
  onPublishPlatform,
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
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#004B8D] text-white border-b border-blue-900/60 shadow-lg font-['Cairo',sans-serif] select-none">
      <div className="w-full max-w-full px-2 sm:px-4 lg:px-6 flex items-center justify-between h-14">
        {/* Right side (RTL Start): Sidebar Arrow Toggle + Platform Governance Logo */}
        <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            id="btn-nav-sidebar-arrow-toggle"
            className="p-1.5 sm:p-2 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 text-[#F58220] hover:text-amber-300 transition-all cursor-pointer shadow-xs active:scale-95"
            title={isSidebarOpen ? 'إخفاء القائمة الجانبية' : 'إظهار القائمة الجانبية'}
            aria-label="تبديل القائمة الجانبية"
          >
            {isSidebarOpen ? (
              <ChevronsRight className="w-4 h-4 sm:w-5 sm:h-5 text-[#F58220] stroke-[2.4]" />
            ) : (
              <ChevronsLeft className="w-4 h-4 sm:w-5 sm:h-5 text-[#F58220] stroke-[2.4]" />
            )}
          </button>

          <div className="flex items-center gap-2.5 shrink-0 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#002855] to-[#001D40] border border-amber-400/40 flex items-center justify-center text-[#F58220] shadow-sm shrink-0">
              <Zap className="w-4.5 h-4.5 sm:w-5 sm:h-5 fill-[#F58220]" />
            </div>
            <div className="text-right flex flex-col justify-center leading-snug min-w-0">
              {/* السطر الأول: اسم المنصة بحجم متناسق ومتوازن مع الشريط العلوي */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm sm:text-[15.5px] lg:text-[16.5px] font-black tracking-tight text-white drop-shadow-xs leading-tight">
                  منصة حوكمة جودة أعمال الإنشاءات
                </span>
                <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-[#F58220] to-[#FDB813] text-slate-950 text-[10.5px] font-black font-mono shadow-2xs leading-none">
                  إجراء 155
                </span>
              </div>
              {/* السطر الثاني: الإدارة والاسم الإنجليزي بتنسيق مدمج ومتناسق */}
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-blue-100/95 truncate mt-0.5">
                <span className="truncate">إدارة كهرباء الحدود الشمالية - المساندة الفنية</span>
                <span className="hidden xl:inline text-amber-300/80">•</span>
                <span className="hidden xl:inline font-extrabold tracking-wide uppercase font-sans text-amber-300 text-[10px]">
                  Construction Quality Governance Platform
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Left side (RTL End): Profile Card, Date, Time, Notification Bell, Online Users, Fullscreen, Logout */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 1. User Profile Card */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer shadow-xs active:scale-95"
              title="بيانات وحساب المستخدم الحالي"
            >
              {/* Circular Avatar */}
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#F58220] to-amber-300 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 border border-white/40 shadow-xs">
                {(currentUser?.displayName || currentUser?.username || 'م').charAt(0).toUpperCase()}
              </div>

              {/* Text Info */}
              <div className="text-right min-w-0 max-w-[120px] sm:max-w-[150px] leading-tight">
                <div className="text-xs font-black text-white truncate">
                  {currentUser?.displayName || currentUser?.username || 'المستخدم'}
                </div>
                <div className="text-[10px] text-blue-200 font-bold truncate">
                  {currentUser?.roleTitle || 'مدير الجودة والمشاريع'}
                </div>
              </div>

              {/* Caret */}
              <ChevronsRight className="w-3.5 h-3.5 text-blue-200 rotate-90 shrink-0" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 text-slate-900 p-3 z-50 animate-in fade-in zoom-in-95 text-right font-['Cairo',sans-serif]">
                <div className="pb-2.5 mb-2 border-b border-slate-100">
                  <div className="font-black text-xs text-slate-900">
                    {currentUser?.displayName || currentUser?.username}
                  </div>
                  <div className="text-[11px] text-blue-700 font-bold mt-0.5">
                    {currentUser?.roleTitle || 'عضو المنظومة'}
                  </div>
                  {currentUser?.email && (
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
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
                    className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-black text-slate-800 hover:bg-blue-50 hover:text-blue-900 transition-colors cursor-pointer text-right"
                  >
                    <ShieldCheck className="w-4 h-4 text-blue-700" />
                    <span>إدارة المستخدمين والصلاحيات</span>
                  </button>
                )}

                {onPublishPlatform && (hasUserPermission(currentUser, 'manageUsers') || currentUser?.isSuperAdmin) && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onPublishPlatform();
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-black text-emerald-900 bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-300 transition-colors cursor-pointer mt-1 text-right"
                    title="تحديث البرنامج للجميع دون التأثير على أي بيانات أو جداول أو صلاحيات"
                  >
                    <Zap className="w-4 h-4 text-emerald-700" />
                    <span>تحديث البرنامج للجميع (Publish آمن)</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 2. التاريخ */}
          <div 
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/15 text-xs font-bold text-white shadow-xs"
            title="التاريخ الحالي"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-200" />
            <span className="font-mono text-[11px] whitespace-nowrap">{formattedDate}</span>
          </div>

          {/* 3. الوقت */}
          <div 
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/15 text-xs font-bold text-white shadow-xs"
            title="الوقت الحالي"
          >
            <Clock className="w-3.5 h-3.5 text-[#F58220]" />
            <span className="font-mono text-[11px] whitespace-nowrap">{formattedTime}</span>
          </div>

          {/* 4. التنبيهات */}
          <button
            type="button"
            onClick={onOpenNotificationSettings}
            className="relative p-2 rounded-lg bg-white/10 hover:bg-white/20 text-[#F58220] border border-white/20 transition-all cursor-pointer shadow-xs active:scale-95"
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer text-xs font-bold shadow-xs active:scale-95"
              title="المتصلون بالمنصة الآن والمزامنة التلقائية"
            >
              <Users className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-[11px] hidden sm:inline">المتصلون</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-400/25 text-emerald-100 text-[10px] font-mono font-bold flex items-center gap-1 border border-emerald-400/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>{onlineCount}</span>
              </span>
            </button>

            {isSyncMenuOpen && (
              <div className="absolute left-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 text-slate-900 p-3.5 z-50 animate-in fade-in zoom-in-95 text-right font-['Cairo',sans-serif]">
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-700" />
                    <span className="text-xs font-black text-slate-900">المتصلون بالمنصة الآن</span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{onlineCount} متصل</span>
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-900 mb-3 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>المزامنة التلقائية الفورية مفعّلة ولحظية بين الجميع دون الحاجة لأي زر</span>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                  {connectedUsers && connectedUsers.length > 0 ? (
                    connectedUsers.map((u, idx) => (
                      <div
                        key={u.clientId || idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded bg-blue-100 text-blue-900 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
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

                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>متصل</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded bg-blue-100 text-blue-900 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
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

                      <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
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
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-blue-100 border border-white/20 transition-all cursor-pointer shadow-xs active:scale-95"
            title={isFullscreen ? 'تصغير الشاشة' : 'العرض في كامل الشاشة'}
            aria-label="العرض"
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4 text-blue-100" />
            ) : (
              <Maximize className="w-4 h-4 text-blue-100" />
            )}
          </button>

          {/* 6.1 تحميل المشروع لـ VS Code (ZIP) */}
          <a
            href="/api/download-project-zip"
            download="procedure-155-qcms-platform.zip"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F58220] hover:bg-[#d96b12] text-white border border-[#FDB813] transition-all cursor-pointer text-xs font-black shadow-xs active:scale-95"
            title="تحميل ملفات المشروع كاملة مضغوطة (ZIP) لفتحها والتعديل عليها في VS Code"
          >
            <FileDown className="w-3.5 h-3.5 text-white" />
            <span className="hidden xl:inline">تحميل لـ VS Code (ZIP)</span>
          </a>

          {/* 7. خروج */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-100 border border-rose-300/30 transition-all cursor-pointer text-xs font-black shadow-xs active:scale-95"
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
