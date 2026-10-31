import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Radio,
  KeyRound
} from 'lucide-react';
import { PlatformUser } from '../types';
import {
  ensureDefaultSuperAdmins,
  saveSessionToken
} from '../utils/security';
import { SyncStatus, realtime } from '../services/realtimeService';
import { vaultService } from '../services/vaultService';

interface LoginScreenProps {
  onLoginSuccess: (user: PlatformUser, allUsers?: PlatformUser[]) => void;
  users?: PlatformUser[];
  syncStatus?: SyncStatus;
  onlineCount?: number;
  isConnected?: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  users = [],
  syncStatus = 'connected',
  onlineCount = 1,
  isConnected
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [, setLatestUsers] = useState<PlatformUser[]>(() => {
    const vaultUsers = vaultService.getSavedUsers();
    if (Array.isArray(vaultUsers) && vaultUsers.length > 0) {
      return ensureDefaultSuperAdmins(vaultUsers);
    }
    return ensureDefaultSuperAdmins(users);
  });

  useEffect(() => {
    setUsername('');
    setPassword('');
    setErrorMsg(null);

    // Fetch latest registered users from server on login screen mount
    realtime.fetchUsers().then((fetched) => {
      if (Array.isArray(fetched) && fetched.length > 0) {
        setLatestUsers(ensureDefaultSuperAdmins(fetched));
      }
    }).catch(() => {});

    // Subscribe to real-time user updates while on the login screen
    const unsubscribe = realtime.subscribe((evt) => {
      if (evt.type === 'UPDATE_USERS' && Array.isArray(evt.payload?.users)) {
        const updated = ensureDefaultSuperAdmins(evt.payload.users);
        vaultService.saveUsers(updated);
        setLatestUsers(updated);
      } else if (evt.type === 'SYNC_ALL' && Array.isArray(evt.payload?.users)) {
        const updated = ensureDefaultSuperAdmins(evt.payload.users);
        vaultService.saveUsers(updated);
        setLatestUsers(updated);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (Array.isArray(users) && users.length > 0) {
      setLatestUsers(ensureDefaultSuperAdmins(users));
    }
  }, [users]);

  const effectiveSyncStatus: SyncStatus = (syncStatus || (isConnected ? 'connected' : 'connecting')) as SyncStatus;

  const normalizeDigitsAndTrim = (val: string): string =>
    String(val || '')
      .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
      .trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUser = normalizeDigitsAndTrim(username);
    const cleanPass = normalizeDigitsAndTrim(password);

    if (!cleanUser) {
      setErrorMsg('يرجى إدخال اسم المستخدم أو البريد الإلكتروني (User / Email)');
      return;
    }
    if (!cleanPass) {
      setErrorMsg('يرجى إدخال كلمة المرور (Password)');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          password: cleanPass
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          const receivedToken = data.sessionToken || data.token;
          if (receivedToken) {
            saveSessionToken(receivedToken);
          }
          if (Array.isArray(data.users)) {
            vaultService.saveUsers(data.users);
          }
          realtime.reconnectWithAuth();
          onLoginSuccess(data.user, data.users);
          return;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (errJson?.error) {
          setErrorMsg(errJson.error);
          return;
        }
      }

      setErrorMsg('اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التأكد من البيانات أو مراجعة مسؤول الصلاحيات.');
    } catch {
      setErrorMsg('تعذر الاتصال بخادم المصادقة المعتمد. يرجى التحقق من الاتصال بالشبكة والمحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-slate-950 text-white flex flex-col justify-between relative overflow-hidden font-['Cairo',sans-serif]"
      dir="rtl"
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-emerald-600/15 blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl" />
      </div>

      <header className="relative z-10 w-full border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 border border-emerald-400/40 flex items-center justify-center shadow-md">
            <ShieldCheck className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-white tracking-wide">
                حوكمة جودة اعمال الانشاءات
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black">
                إجراء 155
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              بوابة الدخول الموحدة ونظام إدارة الصلاحيات والمزامنة الفورية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs">
            <Radio
              className={`w-3.5 h-3.5 ${
                effectiveSyncStatus === 'connected' ? 'text-emerald-400 animate-pulse' : 'text-amber-400'
              }`}
            />
            <span className="text-slate-300 font-bold text-[11px]">
              {effectiveSyncStatus === 'connected' ? 'المزامنة الفورية متصلة' : 'جاري الاتصال بالسحابة...'}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[10px] font-bold">
              {onlineCount} متصل
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl">
          <div className="bg-gradient-to-l from-emerald-950 via-slate-900 to-indigo-950 p-6 sm:p-7 border-b border-slate-800 text-center relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 border-2 border-emerald-300/40 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-950/60">
              <KeyRound className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white">
              تسجيل الدخول إلى المنصة
            </h2>
            <p className="text-xs text-slate-300 font-medium mt-1">
              أدخل اسم المستخدم وكلمة المرور للمتابعة
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-200">
                اسم المستخدم أو البريد الإلكتروني (User / Email)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4 text-emerald-400" />
                </div>
                <input
                  type="text"
                  name="user_login_credential_id"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="أدخل اسم المستخدم أو البريد الإلكتروني"
                  autoFocus
                  autoComplete="off"
                  data-lpignore="true"
                  dir="ltr"
                  className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white font-bold text-sm text-right placeholder:text-slate-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-200">
                كلمة المرور (Password)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4 text-amber-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="user_password_credential_secret"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="أدخل كلمة المرور"
                  autoComplete="new-password"
                  data-lpignore="true"
                  dir="ltr"
                  className="w-full pr-10 pl-11 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white font-bold text-sm text-right placeholder:text-slate-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-950/60 border border-emerald-400/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-50 mt-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoading ? 'جاري التحقق والدخول...' : 'تسجيل الدخول للمنصة'}</span>
            </button>
          </form>
        </div>
      </main>

      <footer className="relative z-10 w-full border-t border-slate-800/80 bg-slate-950/80 py-3 px-6 text-center text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>إدارة كهرباء الحدود الشمالية • المساندة الفنية</span>
        <span className="font-mono text-slate-500">حوكمة جودة أعمال الإنشاءات • إجراء 155</span>
      </footer>
    </div>
  );
};
