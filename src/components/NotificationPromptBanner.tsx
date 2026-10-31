import React, { useState } from 'react';
import { BellRing, Sparkles, CheckCircle2, X, Loader2 } from 'lucide-react';
import { notificationService } from '../services/notificationService';
import { soundService } from '../services/soundService';

interface NotificationPromptBannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribed: () => void;
  onShowToast: (message: string, type?: 'create' | 'update' | 'delete' | 'sync') => void;
}

export const NotificationPromptBanner: React.FC<NotificationPromptBannerProps> = ({
  isOpen,
  onClose,
  onSubscribed,
  onShowToast
}) => {
  const [isSubscribing, setIsSubscribing] = useState(false);

  if (!isOpen) return null;

  const handleActivate = async () => {
    setIsSubscribing(true);
    try {
      const res = await notificationService.requestPermissionAndSubscribe();
      if (res.success) {
        soundService.playActionSound('create');
        onShowToast('تم تفعيل خدمة الإشعارات الخارجية بنجاح! ستصلك التنبيهات حتى أثناء إغلاق المنصة 🔔', 'create');
        onSubscribed();
        onClose();
      } else if (res.permission === 'denied') {
        onShowToast('تم حظر الإشعارات في المتصفح. يمكنك تفعيلها من إعدادات المتصفح', 'delete');
        onClose();
      }
    } catch (err: any) {
      console.warn('Subscription failed:', err);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDismiss = () => {
    try {
      sessionStorage.setItem('p155_notification_banner_dismissed', 'true');
    } catch (_) {}
    onClose();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-[calc(100vw-3rem)] font-['Cairo',sans-serif] animate-in fade-in slide-in-from-bottom-6 duration-300">
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white p-4 sm:p-5 rounded-2xl shadow-2xl border-2 border-emerald-500/40 relative overflow-hidden backdrop-blur-md">
        
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start gap-3.5 relative z-10">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0 shadow-inner">
            <BellRing className="w-5 h-5 animate-pulse" />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-black text-white">
                تفعيل الإشعارات الفورية الذكية
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                والمنصة مغلقة 24/7
              </span>
            </div>

            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              هل ترغب باستلام تنبيهات فورية بكل إجراء وتعديل لأوامر العمل على سطح مكتبك أو شاشة هاتفك حتى لو كان المتصفح أو الرابط مغلقاً؟
            </p>

            <div className="mt-3.5 flex items-center gap-2.5">
              <button
                type="button"
                disabled={isSubscribing}
                onClick={handleActivate}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md border border-emerald-400/40 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isSubscribing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري التفعيل...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>تفعيل الإشعارات الآن ⚡</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
              >
                لاحقاً
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
