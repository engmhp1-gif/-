import React, { useState } from 'react';
import { KeyRound, Lock, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { verifyAdminPin, setSessionUnlocked } from '../utils/security';
import { soundService } from '../services/soundService';

interface PinAuthModalProps {
  isOpen: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PinAuthModal: React.FC<PinAuthModalProps> = ({
  isOpen,
  title,
  subtitle,
  onClose,
  onSuccess
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdminPin(pin)) {
      setSessionUnlocked(true);
      soundService.playActionSound('auth_success');
      setError(false);
      setPin('');
      onSuccess();
    } else {
      soundService.playActionSound('auth_error');
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden text-right"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-blue-950 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">{title}</h3>
              <p className="text-xs text-blue-200/80 mt-0.5">منطقة محمية برمز الأمان</p>
            </div>
          </div>
          <button
            onClick={() => {
              setPin('');
              setError(false);
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            {subtitle}
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              الرمز السري (مخفي برموز):
            </label>
            <div className="relative">
              <input
                type="password"
                maxLength={10}
                autoFocus
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="••••"
                className={`w-full text-center tracking-[0.4em] font-mono text-xl py-3 px-4 rounded-xl border bg-slate-50 transition-all focus:outline-hidden focus:bg-white ${
                  error 
                    ? 'border-rose-400 text-rose-600 focus:ring-2 focus:ring-rose-200' 
                    : 'border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                }`}
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            
            {error && (
              <div className="flex items-center gap-1.5 mt-2 text-rose-600 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>الرمز السري غير صحيح! يرجى إدخال الرمز السري المصرح به.</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>تأكيد والتحقق من الرمز</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPin('');
                setError(false);
                onClose();
              }}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
