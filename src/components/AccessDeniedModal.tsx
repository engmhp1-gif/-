import React from 'react';
import { ShieldAlert, Lock, X, UserCheck, AlertTriangle } from 'lucide-react';
import { PlatformUser } from '../types';

interface AccessDeniedModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionTitle: string;
  currentUser: PlatformUser | null;
}

export const AccessDeniedModal: React.FC<AccessDeniedModalProps> = ({
  isOpen,
  onClose,
  actionTitle,
  currentUser
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150 font-['Cairo',sans-serif]"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl border-2 border-rose-200 shadow-2xl w-full max-w-md overflow-hidden">
        {/* Top Banner */}
        <div className="bg-gradient-to-l from-rose-900 via-rose-800 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/25 border border-rose-400/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 text-rose-200" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">لا توجد صلاحية</h3>
              <p className="text-[11px] text-rose-200 font-semibold">
                حوكمة جودة اعمال الانشاءات • ضبط الصلاحيات
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-black">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>لا توجد صلاحية لفتح هذه الأداة أو التقرير</span>
            </div>
            <h4 className="text-sm sm:text-base font-black text-slate-900 pt-1">
              «{actionTitle || 'هذا الإجراء'}»
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              عفواً، لم يتم منح حسابك الحالي الصلاحية اللازمة للوصول إلى هذه الأداة أو الاطلاع على هذا التقرير. يرجى مراجعة مسؤول الصلاحيات في المنصة لتفعيل الصلاحية لحسابك.
            </p>
          </div>

          {currentUser && (
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-right flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-slate-500" />
                <div>
                  <div className="font-black text-slate-800">
                    المستخدم الحالي: {currentUser.displayName || currentUser.username}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    User: {currentUser.username} {currentUser.email ? `• ${currentUser.email}` : ''}
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                صلاحيات محددة
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-colors cursor-pointer shadow-md"
          >
            حسناً، فهمت
          </button>
        </div>
      </div>
    </div>
  );
};
