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
  Zap,
  Check,
  KeyRound,
  Mail,
  ArrowRight,
  CheckCircle2,
  RefreshCw
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

type AuthMode = 'login' | 'forgot_request' | 'forgot_reset';

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  users = [],
  syncStatus = 'connected',
  onlineCount = 1,
  isConnected
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  
  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Forgot password & backup code state
  const [resetUsernameOrEmail, setResetUsernameOrEmail] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [infoCodeMsg, setInfoCodeMsg] = useState<string | null>(null);
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
    setSuccessMsg(null);

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

  // Standard Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanUser = normalizeDigitsAndTrim(username);
    const cleanPass = normalizeDigitsAndTrim(password);

    if (!cleanUser) {
      setErrorMsg('يرجى إدخال اسم المستخدم أو البريد الإلكتروني');
      return;
    }
    if (!cleanPass) {
      setErrorMsg('يرجى إدخال كلمة المرور');
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

      setErrorMsg('اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التأكد من البيانات أو استخدام خيار "نسيت كلمة المرور؟".');
    } catch {
      setErrorMsg('تعذر الاتصال بخادم المصادقة المعتمد. يرجى التحقق من الاتصال بالشبكة والمحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Request Backup Code to User Email
  const handleRequestBackupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setInfoCodeMsg(null);

    const cleanInput = normalizeDigitsAndTrim(resetUsernameOrEmail);
    if (!cleanInput) {
      setErrorMsg('يرجى إدخال اسم المستخدم أو البريد الإلكتروني المسجل');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/request-backup-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: cleanInput })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || 'تم إرسال كلمة السر الاحتياطية بنجاح إلى البريد الإلكتروني المسجل.');
        if (data.backupCode) {
          setInfoCodeMsg(`رمز كلمة السر الاحتياطية المرسل: ${data.backupCode}`);
          setBackupCode(data.backupCode);
        }
        setAuthMode('forgot_reset');
      } else {
        setErrorMsg(data.error || 'فشل إرسال كلمة السر الاحتياطية. يرجى التأكد من بيانات الحساب.');
      }
    } catch {
      setErrorMsg('تعذر الاتصال بالخادم لإرسال كلمة السر الاحتياطية.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Activate New Password using Backup Code
  const handleResetWithBackupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanInputUser = normalizeDigitsAndTrim(resetUsernameOrEmail);
    const cleanCode = normalizeDigitsAndTrim(backupCode);
    const cleanPass = normalizeDigitsAndTrim(newPassword);

    if (!cleanInputUser) {
      setErrorMsg('يرجى إدخال اسم المستخدم أو البريد الإلكتروني');
      return;
    }
    if (!cleanCode) {
      setErrorMsg('يرجى إدخال كلمة السر الاحتياطية (الرمز المرسل على الإيميل)');
      return;
    }
    if (!cleanPass || cleanPass.length < 4) {
      setErrorMsg('كلمة المرور الجديدة يجب أن تتكون من 4 خانات على الأقل');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-with-backup-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrEmail: cleanInputUser,
          backupCode: cleanCode,
          newPassword: cleanPass
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.user) {
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
      } else {
        setErrorMsg(data.error || 'تعذر تفعيل كلمة المرور الجديدة. يرجى التأكد من كلمة السر الاحتياطية.');
      }
    } catch {
      setErrorMsg('حدث خطأ أثناء الاتصال بالخادم لتفعيل كلمة المرور الجديدة.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-3 sm:p-6 font-['Cairo',sans-serif]"
      dir="rtl"
    >
      {/* Container matching mockup's 2-column split card */}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col md:flex-row min-h-[580px]">
        
        {/* Left Column (Desktop): Transmission Tower Hero Banner with Blue & Orange Swooshes */}
        <div className="w-full md:w-1/2 bg-gradient-to-br from-[#003B73] via-[#004B8D] to-[#0A192F] text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          
          {/* Subtle Grid and Tower Illustration */}
          <div className="absolute inset-0 pointer-events-none opacity-25 flex items-center justify-center">
            <svg viewBox="0 0 400 500" className="w-full h-full text-white" fill="none" stroke="currentColor">
              <line x1="200" y1="30" x2="140" y2="460" strokeWidth="3" />
              <line x1="200" y1="30" x2="260" y2="460" strokeWidth="3" />
              <line x1="170" y1="120" x2="230" y2="120" strokeWidth="3.5" />
              <line x1="140" y1="200" x2="260" y2="200" strokeWidth="3.5" />
              <line x1="120" y1="300" x2="280" y2="300" strokeWidth="3.5" />
              {/* Lattice braces */}
              <line x1="170" y1="120" x2="260" y2="200" strokeWidth="1.8" />
              <line x1="230" y1="120" x2="140" y2="200" strokeWidth="1.8" />
              <line x1="140" y1="200" x2="280" y2="300" strokeWidth="1.8" />
              <line x1="260" y1="200" x2="120" y2="300" strokeWidth="1.8" />
              {/* Power lines */}
              <path d="M 0 120 Q 200 160 400 120" strokeWidth="1.5" strokeDasharray="6 3" />
              <path d="M 0 200 Q 200 240 400 200" strokeWidth="1.5" strokeDasharray="6 3" />
            </svg>
          </div>

          {/* Top Brand Tag */}
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 border border-white/20 text-[#FDB813] text-xs font-black shadow-xs">
              <Zap className="w-4 h-4 fill-[#FDB813]" />
              <span>منظومة الحوكمة والجودة الشاملة — إجراء 155</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight pt-2">
              منصة حوكمة جودة أعمال الإنشاءات <br />
              <span className="text-[#F58220]">— إجراء 155 —</span>
            </h2>

            <p className="text-xs sm:text-sm text-blue-100 font-medium leading-relaxed">
              إدارة كهرباء الحدود الشمالية • المساندة الفنية
            </p>
          </div>

          {/* Bottom Slogan (as in image: "الجودة .. مسؤوليتنا جميعاً") */}
          <div className="relative z-10 pt-8 border-t border-white/20 mt-6">
            <div className="text-sm sm:text-base font-black text-white tracking-wide flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F58220]" />
              <span>الجودة .. مسؤوليتنا جميعاً</span>
            </div>
            <p className="text-[11px] text-blue-200 mt-1 font-medium">
              نظام موحد لإدارة ومطابقة أوامر العمل والربط الفني المباشر
            </p>
          </div>

        </div>

        {/* Right Column: Clean White Authentication Form Card */}
        <div className="w-full md:w-1/2 p-7 sm:p-10 flex flex-col justify-between bg-white">
          
          {/* Header Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#004B8D]">
                  {authMode === 'login' ? (
                    <ShieldCheck className="w-5 h-5 text-[#004B8D]" />
                  ) : (
                    <KeyRound className="w-5 h-5 text-[#F58220]" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500">منظومة الحوكمة الإلكترونية</div>
                  <h3 className="text-lg font-black text-slate-900">
                    {authMode === 'login' && 'تسجيل الدخول'}
                    {authMode === 'forgot_request' && 'طلب كلمة سر احتياطية'}
                    {authMode === 'forgot_reset' && 'تفعيل كلمة المرور الجديدة'}
                  </h3>
                </div>
              </div>

              {/* Live sync pill */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600 font-mono">
                <Radio className={`w-3 h-3 ${effectiveSyncStatus === 'connected' ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
                <span>{onlineCount} متصل</span>
              </div>
            </div>
          </div>

          {/* Feedback Messages */}
          <div className="space-y-2 my-2">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-start gap-2.5 shadow-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-start gap-2.5 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {infoCodeMsg && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[#004B8D] text-xs font-mono font-bold flex items-center justify-between">
                <span>{infoCodeMsg}</span>
                <span className="text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-sans">رمز مؤقت</span>
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* MODE 1: STANDARD LOGIN FORM                                  */}
          {/* ------------------------------------------------------------- */}
          {authMode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 my-4">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700">
                  اسم المستخدم
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="أدخل اسم المستخدم أو البريد الإلكتروني"
                    autoFocus
                    dir="ltr"
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-[#004B8D] focus:ring-2 focus:ring-[#004B8D]/20 text-slate-900 font-bold text-sm text-right placeholder:text-slate-400 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700">
                  كلمة المرور
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4 text-slate-500" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="أدخل كلمة المرور"
                    autoComplete="current-password"
                    dir="ltr"
                    className="w-full pr-10 pl-11 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-[#004B8D] focus:ring-2 focus:ring-[#004B8D]/20 text-slate-900 font-bold text-sm text-right placeholder:text-slate-400 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Options: Remember me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-1.5 text-slate-600 font-bold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-[#004B8D] focus:ring-[#004B8D] cursor-pointer"
                  />
                  <span>تذكرني</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setResetUsernameOrEmail(username);
                    setAuthMode('forgot_request');
                  }}
                  className="text-slate-500 hover:text-[#004B8D] font-bold transition-colors cursor-pointer"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              {/* Submit Button (Solid Deep Blue matching mockup) */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-[#004B8D] hover:bg-[#00386b] text-white font-black text-sm shadow-md border border-blue-900 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-50 mt-4"
              >
                <LogIn className="w-4 h-4 text-[#F58220]" />
                <span>{isLoading ? 'جاري التحقق والدخول...' : 'دخول'}</span>
              </button>
            </form>
          )}

          {/* ------------------------------------------------------------- */}
          {/* MODE 2: STEP 1 - REQUEST BACKUP CODE VIA EMAIL                 */}
          {/* ------------------------------------------------------------- */}
          {authMode === 'forgot_request' && (
            <form onSubmit={handleRequestBackupCode} className="space-y-4 my-4">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium leading-relaxed">
                أدخل اسم المستخدم أو البريد الإلكتروني المسجل. سيصلك رمز/كلمة سر احتياطية على إيميلك لاستخدامها في تفعيل كلمة المرور الجديدة.
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700">
                  اسم المستخدم أو البريد الإلكتروني
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    value={resetUsernameOrEmail}
                    onChange={(e) => {
                      setResetUsernameOrEmail(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="مثال: user@sec.gov.sa أو اسم المستخدم"
                    autoFocus
                    dir="ltr"
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:border-[#004B8D] focus:ring-2 focus:ring-[#004B8D]/20 text-slate-900 font-bold text-sm text-right placeholder:text-slate-400 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setAuthMode('login');
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>رجوع للدخول</span>
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#004B8D] hover:bg-[#00386b] text-white font-black text-xs shadow-md border border-blue-900 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  <Mail className="w-4 h-4 text-[#F58220]" />
                  <span>{isLoading ? 'جاري الإرسال...' : 'إرسال كلمة السر الاحتياطية'}</span>
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setAuthMode('forgot_reset');
                  }}
                  className="text-xs text-[#004B8D] hover:underline font-bold"
                >
                  وصلتك كلمة السر الاحتياطية بالفعل؟ اضغط هنا للتفعيل
                </button>
              </div>
            </form>
          )}

          {/* ------------------------------------------------------------- */}
          {/* MODE 3: STEP 2 - ACTIVATE NEW PASSWORD WITH BACKUP CODE        */}
          {/* ------------------------------------------------------------- */}
          {authMode === 'forgot_reset' && (
            <form onSubmit={handleResetWithBackupCode} className="space-y-3.5 my-3">
              {/* Username / Email */}
              <div className="space-y-1">
                <label className="block text-xs font-black text-slate-700">
                  اسم المستخدم أو البريد الإلكتروني
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    value={resetUsernameOrEmail}
                    onChange={(e) => {
                      setResetUsernameOrEmail(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="اسم المستخدم أو البريد"
                    dir="ltr"
                    className="w-full pr-9 pl-3 py-2 rounded-lg bg-slate-50 border border-slate-300 focus:border-[#004B8D] text-slate-900 font-bold text-xs text-right outline-none transition-all"
                  />
                </div>
              </div>

              {/* Backup Password / Code */}
              <div className="space-y-1">
                <label className="block text-xs font-black text-slate-700 flex items-center justify-between">
                  <span>كلمة السر الاحتياطية (الرمز المرسل بالإيميل)</span>
                  <button
                    type="button"
                    onClick={() => setAuthMode('forgot_request')}
                    className="text-[10px] text-[#004B8D] hover:underline font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>طلب رمز جديد</span>
                  </button>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-3.5 h-3.5 text-[#F58220]" />
                  </div>
                  <input
                    type="text"
                    value={backupCode}
                    onChange={(e) => {
                      setBackupCode(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="أدخل الرمز المكون من 6 أرقام"
                    autoFocus
                    dir="ltr"
                    className="w-full pr-9 pl-3 py-2 rounded-lg bg-amber-50/50 border border-amber-300 focus:border-[#004B8D] text-slate-900 font-mono font-black text-sm text-center tracking-widest outline-none transition-all placeholder:font-sans placeholder:tracking-normal placeholder:text-xs"
                  />
                </div>
              </div>

              {/* New Password Input */}
              <div className="space-y-1">
                <label className="block text-xs font-black text-slate-700">
                  كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="أدخل كلمة المرور الجديدة"
                    dir="ltr"
                    className="w-full pr-9 pl-9 py-2 rounded-lg bg-slate-50 border border-slate-300 focus:border-[#004B8D] text-slate-900 font-bold text-xs text-right outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setAuthMode('login');
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>إلغاء</span>
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#004B8D] hover:bg-[#00386b] text-white font-black text-xs shadow-md border border-blue-900 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  <Check className="w-4 h-4 text-[#F58220]" />
                  <span>{isLoading ? 'جاري التفعيل...' : 'تفعيل الدخول'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Form Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>إدارة كهرباء الحدود الشمالية</span>
            <span className="font-mono">QCMS 155</span>
          </div>

        </div>

      </div>
    </div>
  );
};
