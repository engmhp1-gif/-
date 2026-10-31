import React, { useState } from 'react';
import { 
  Trash2, 
  ShieldAlert, 
  X, 
  KeyRound, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  FileSpreadsheet, 
  Eye, 
  EyeOff,
  AlertTriangle
} from 'lucide-react';
import { SubOffice } from '../types';
import { verifyAdminPin } from '../utils/security';

interface DeleteTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  officeTitle: string;
  currentOrdersCount: number;
  totalOrdersCount: number;
  onClearOfficeOrders: (officeName: string) => Promise<void>;
  onClearAllOrders: () => Promise<void>;
}

export const DeleteTableModal: React.FC<DeleteTableModalProps> = ({
  isOpen,
  onClose,
  officeTitle,
  currentOrdersCount,
  totalOrdersCount,
  onClearOfficeOrders,
  onClearAllOrders
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState(false);
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirmDelete = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Verify Secret PIN strictly
    if (!verifyAdminPin(pin)) {
      setError(true);
      return;
    }

    setError(false);
    setIsProcessing(true);

    try {
      if (scope === 'current' && officeTitle !== 'جميع المكاتب الفرعية') {
        await onClearOfficeOrders(officeTitle);
        setSuccessMessage(`تم مسح وتفريغ أوامر العمل لمكتب (${officeTitle}) بنجاح وبشكل جذري`);
      } else {
        await onClearAllOrders();
        setSuccessMessage('تم مسح وتفريغ كامل بيانات الجدول جذرياً ونهائياً لكافة المكاتب');
      }

      setTimeout(() => {
        setIsProcessing(false);
        setSuccessMessage(null);
        setPin('');
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to clear table:', err);
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setPin('');
    setError(false);
    setSuccessMessage(null);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      dir="rtl"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-rose-400/80 max-w-md w-full overflow-hidden text-right animate-in zoom-in-95 duration-150 font-['Cairo',sans-serif]">
        
        {/* Header with High-Impact Red/Rose Aesthetics */}
        <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-rose-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600/30 border border-rose-400/40 flex items-center justify-center text-rose-300 shadow-inner">
              <Trash2 className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>حذف ومسح بيانات الجدول</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/30 text-rose-200 border border-rose-400/30">
                  إجراء جذري
                </span>
              </h3>
              <p className="text-xs text-rose-200/80 mt-0.5">
                عملية مسح حقيقية وفورية مؤمنة برمز الأمان
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-rose-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="إلغاء وإغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleConfirmDelete} className="p-5 space-y-4">
          
          {/* Success Banner */}
          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Warning Card */}
          <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-900 leading-relaxed">
              <strong className="block font-bold mb-0.5">تحذير أمني هام:</strong>
              سيؤدي هذا الإجراء إلى حذف وتفريغ السجلات من الخادم وقاعدة البيانات مباشرة والمزامنة مع كافة المتصلين فوراً.
            </div>
          </div>

          {/* Scope Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              حدد نطاق الحذف والمسح:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              
              {/* Scope Option 1: Current Office */}
              <button
                type="button"
                onClick={() => setScope('current')}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                  scope === 'current'
                    ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-400 text-rose-950 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>المكتب الحالي</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white border border-slate-200">
                    {currentOrdersCount} أمر
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-normal truncate">
                  {officeTitle}
                </p>
              </button>

              {/* Scope Option 2: Full System Wipe */}
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                  scope === 'all'
                    ? 'bg-rose-50 border-rose-600 ring-2 ring-rose-400 text-rose-950 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 font-bold text-rose-800">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-rose-600" />
                    <span>كامل الجدول (الكل)</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                    {totalOrdersCount} أمر
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-normal">
                  مسح كافة المكاتب بالكامل
                </p>
              </button>

            </div>
          </div>

          {/* Hidden PIN Input (رقم سري مصرح به) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-rose-600" />
                <span>الرقم السري المصرح به لتأكيد الحذف (مخفي):</span>
              </label>
            </div>

            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(false);
                }}
                maxLength={8}
                autoFocus
                placeholder="••••"
                className={`w-full text-center text-xl font-mono tracking-[0.4em] py-2.5 px-10 rounded-xl border bg-slate-50 transition-all focus:outline-hidden focus:bg-white ${
                  error 
                    ? 'border-rose-500 text-rose-600 ring-2 ring-rose-200 bg-rose-50/50' 
                    : 'border-slate-300 text-slate-900 focus:border-rose-600 focus:ring-2 focus:ring-rose-100'
                }`}
              />

              {/* Toggle visibility */}
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showPin ? 'إخفاء الرمز' : 'إظهار الرمز'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 mt-1 text-rose-600 text-xs font-bold animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>الرمز السري غير صحيح! يرجى إدخال الرمز السري المصرح به لتنفيذ المسح.</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              إلغاء الأمر
            </button>

            <button
              type="submit"
              disabled={isProcessing || !pin.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isProcessing ? 'جارٍ المسح الجذري...' : 'تأكيد المسح النهائي والحقيقي'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
