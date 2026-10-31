import React, { useState } from 'react';
import { 
  Trash2, 
  AlertTriangle, 
  X, 
  CheckCircle2, 
  ShieldAlert, 
  Building2, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { SubOffice } from '../types';
import { verifyAdminPin } from '../utils/security';
import { soundService } from '../services/soundService';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  offices: SubOffice[];
  selectedOffice: string;
  totalOrdersCount: number;
  onClearOfficeOrders: (officeName: string) => Promise<void>;
  onClearAllOrders: () => Promise<void>;
  onResetToInitial: () => Promise<void>;
  onDeleteOffice?: (officeId: string, officeName: string) => Promise<void>;
}

export const ClearDataModal: React.FC<ClearDataModalProps> = ({
  isOpen,
  onClose,
  offices,
  selectedOffice,
  totalOrdersCount,
  onClearOfficeOrders,
  onClearAllOrders,
  onResetToInitial,
  onDeleteOffice
}) => {
  const [targetOffice, setTargetOffice] = useState<string>(selectedOffice === 'all' ? (offices[0]?.name || '') : selectedOffice);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const verifyPin = (): boolean => {
    if (!verifyAdminPin(pin)) {
      soundService.playActionSound('auth_error');
      setPinError('الرمز السري غير صحيح! يرجى إدخال الرمز السري المصرح به.');
      return false;
    }
    soundService.playActionSound('auth_success');
    setPinError(null);
    return true;
  };

  const handleClearOffice = async () => {
    if (!targetOffice) return;
    if (!verifyPin()) return;

    setIsProcessing(true);
    try {
      await onClearOfficeOrders(targetOffice);
      soundService.playActionSound('delete');
      setStatusMessage(`تم مسح وتفريغ كافة أوامر العمل لمكتب (${targetOffice}) بنجاح وبشكل جذري.`);
      setTimeout(() => {
        setIsProcessing(false);
        setStatusMessage(null);
        setPin('');
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
    }
  };

  const handleClearAll = async () => {
    if (!verifyPin()) return;

    setIsProcessing(true);
    try {
      await onClearAllOrders();
      soundService.playActionSound('delete');
      setStatusMessage('تم مسح وتفريغ كافة أوامر العمل في المنظومة كاملة بشكل جذري ونهائي.');
      setTimeout(() => {
        setIsProcessing(false);
        setStatusMessage(null);
        setPin('');
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
    }
  };

  const handleReset = async () => {
    if (!verifyPin()) return;

    setIsProcessing(true);
    try {
      await onResetToInitial();
      soundService.playActionSound('restore');
      setStatusMessage('تمت استعادة وإعادة تعيين البيانات النموذجية بنجاح.');
      setTimeout(() => {
        setIsProcessing(false);
        setStatusMessage(null);
        setPin('');
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-lg w-full my-6 overflow-hidden flex flex-col text-right animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-rose-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-600/30 border border-rose-500/40 flex items-center justify-center text-rose-300">
              <ShieldAlert className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                إدارة عمليات المسح والتفريغ الجذري
              </h2>
              <p className="text-xs text-rose-200/80 mt-0.5">
                تفعيل إجراءات المسح الحقيقي والفوري من الخادم وقاعدة البيانات
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-rose-300 hover:text-white hover:bg-rose-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-900 text-xs font-black flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>هذا الإجراء نهائي ولا يمكن التراجع عنه بعد التنفيذ.</span>
          </div>

          {statusMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Master PIN Authorization input */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-amber-950">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>الرقم السري المصرح به لعمليات المسح (مخفي):</span>
              </span>
            </div>
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (pinError) setPinError(null);
              }}
              placeholder="••••"
              maxLength={8}
              className="w-full text-center tracking-[0.4em] font-mono text-lg py-2 px-3 bg-white border border-amber-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-slate-900"
            />
            {pinError && (
              <div className="text-xs text-rose-600 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}
          </div>

          {/* Option 1: Clear Specific Office */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>1. مسح أوامر العمل لمكتب فرعي محدد</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {targetOffice ? `مكتب ${targetOffice}` : 'اختر مكتب'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              يقوم هذا الإجراء بمسح كافة السجلات وأوامر العمل الميدانية التابعة للمكتب المختار فقط.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <select
                value={targetOffice}
                onChange={(e) => setTargetOffice(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              >
                {offices.map((off) => (
                  <option key={off.id} value={off.name}>{off.name}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={isProcessing || !targetOffice}
                onClick={handleClearOffice}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>مسح سجلات المكتب</span>
              </button>
            </div>
          </div>

          {/* Option 2: Radical Clear All Work Orders */}
          <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-900 text-xs flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>2. مسح وتفريغ كامل الجدول جذرياً (كافة المكاتب)</span>
              </span>
              <span className="text-[11px] text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded-full">
                {totalOrdersCount} أمر عمل
              </span>
            </div>
            <p className="text-[11px] text-rose-700 leading-relaxed">
              لحذف جميع أوامر العمل وتفريغ الجداول بالكامل في النظام وقاعدة البيانات، أدخل الرمز السري المصرح به واضغط الزر أدناه:
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isProcessing || !pin.trim()}
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>تنفيذ المسح الجذري لكامل الجدول</span>
              </button>
            </div>
          </div>

          {/* Option 3: Reset to sample initial data */}
          <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
            <div>
              <span className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-blue-600" />
                <span>3. استعادة البيانات النموذجية الأولية</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-200/70 text-blue-950 text-[10px] font-bold">
                  محمي بالرمز السري
                </span>
              </span>
              <p className="text-[11px] text-blue-800/80 mt-1">
                إعادة ضبط السجلات إلى أمثلة أوامر العمل المعتمدة (يتطلب إدخال الرمز السري أعلاه).
              </p>
            </div>
            <button
              type="button"
              disabled={isProcessing || !pin.trim()}
              onClick={handleReset}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة النموذجية</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            جميع عمليات المسح فورية وتنعكس مباشرة على كافة المتصلين.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
