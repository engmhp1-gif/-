import React, { useState } from 'react';
import { 
  History, 
  RotateCcw, 
  Trash2, 
  X, 
  KeyRound, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  Lock,
  FileText
} from 'lucide-react';
import { WorkOrder } from '../types';
import { verifyAdminPin } from '../utils/security';
import { soundService } from '../services/soundService';

export interface DeletedOrderEntry {
  id: string;
  order: WorkOrder;
  deletedAt: string;
  deleteType: 'single' | 'batch' | 'clear' | 'all_clear' | 'office_clear';
}

interface RestoreDeletedModalProps {
  isOpen: boolean;
  onClose: () => void;
  deletedOrders: DeletedOrderEntry[];
  onRestoreOrder: (order: WorkOrder) => Promise<void>;
  onRestoreAll: (orders: WorkOrder[]) => Promise<void>;
  onPermanentlyClearTrash: () => void;
}

export const RestoreDeletedModal: React.FC<RestoreDeletedModalProps> = ({
  isOpen,
  onClose,
  deletedOrders,
  onRestoreOrder,
  onRestoreAll,
  onPermanentlyClearTrash
}) => {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingTargetOrder, setPendingTargetOrder] = useState<WorkOrder | 'all' | null>(null);

  if (!isOpen) return null;

  const verifyPin = (): boolean => {
    if (!verifyAdminPin(pin)) {
      soundService.playActionSound('auth_error');
      setPinError('الرمز السري غير صحيح! يلزم إدخال الرمز السري المصرح به لإتمام الاستعادة.');
      return false;
    }
    soundService.playActionSound('auth_success');
    setPinError(null);
    return true;
  };

  const handleRestoreSingle = async (order: WorkOrder) => {
    if (!verifyPin()) return;

    setIsProcessing(true);
    try {
      await onRestoreOrder(order);
      soundService.playActionSound('restore');
      setStatusMessage(`تمت استعادة أمر العمل (${order.workOrderNumber}) بنجاح.`);
      setPendingTargetOrder(null);
      setTimeout(() => {
        setIsProcessing(false);
        setStatusMessage(null);
      }, 1500);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
    }
  };

  const handleRestoreAll = async () => {
    if (deletedOrders.length === 0) return;
    if (!verifyPin()) return;

    setIsProcessing(true);
    try {
      const ordersToRestore = deletedOrders.map(d => d.order);
      await onRestoreAll(ordersToRestore);
      soundService.playActionSound('restore');
      setStatusMessage(`تمت استعادة كافة أوامر العمل المحذوفة (${ordersToRestore.length}) بنجاح.`);
      setPendingTargetOrder(null);
      setTimeout(() => {
        setIsProcessing(false);
        setStatusMessage(null);
        setPin('');
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full my-6 overflow-hidden flex flex-col text-right animate-in fade-in zoom-in-95 duration-150"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-blue-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">سلة المحذوفات واستعادة البيانات</h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                  محمي برمز الأمان
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                استعراض البيانات المحذوفة وإمكانية استرجاعها حصرياً بالرمز السري المصرح به
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security PIN Authorization Strip */}
        <div className="bg-amber-50/90 border-b border-amber-200 px-5 py-3">
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 flex-1">
              <span className="font-bold">سياسة حماية البيانات: </span>
              عملية التراجع واستعادة أي بيانات محذوفة محظورة تماماً ومحمية برمز أمان. يرجى إدخال الرمز السري المصرح به أدناه لتمكين أزرار الاستعادة.
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <input
                type="password"
                maxLength={10}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (pinError) setPinError(null);
                }}
                placeholder="أدخل الرمز السري ••••"
                className={`w-full text-center tracking-[0.3em] font-mono text-sm py-2 px-3 pr-8 rounded-lg border bg-white focus:outline-hidden transition-all ${
                  pinError 
                    ? 'border-rose-400 text-rose-600 focus:ring-2 focus:ring-rose-200' 
                    : 'border-amber-300 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
                }`}
              />
              <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {deletedOrders.length > 0 && (
              <button
                type="button"
                disabled={isProcessing || !pin.trim()}
                onClick={handleRestoreAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                title="استعادة كافة البيانات المحذوفة المدرجة بالسلة"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة كافة المحذوفات ({deletedOrders.length})</span>
              </button>
            )}
          </div>

          {pinError && (
            <div className="flex items-center gap-1.5 mt-2 text-rose-600 text-xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{pinError}</span>
            </div>
          )}
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 flex items-center gap-2 text-xs font-bold text-emerald-900 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Deleted Orders List */}
        <div className="p-5 max-h-96 overflow-y-auto divide-y divide-slate-100">
          {deletedOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-600">سلة المحذوفات فارغة حالياً</p>
              <p className="text-[11px] text-slate-400">لا توجد أوامر عمل محذوفة مؤخراً في هذه الجلسة.</p>
            </div>
          ) : (
            deletedOrders.map((entry, idx) => (
              <div 
                key={entry.id || idx}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4 hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      #{entry.order.workOrderNumber || 'بدون رقم'}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {entry.order.workOrderCode || '-'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                      {entry.order.office}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span>المقاول: <strong className="text-slate-700">{entry.order.contractor || '-'}</strong></span>
                    <span>•</span>
                    <span>تاريخ الحذف: <span className="font-mono text-[10px]">{new Date(entry.deletedAt).toLocaleTimeString('ar-SA')}</span></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isProcessing || !pin.trim()}
                    onClick={() => handleRestoreSingle(entry.order)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                    title={!pin.trim() ? 'يلزم إدخال الرمز السري في الحقل أعلاه لتأكيد الاستعادة' : 'استعادة أمر العمل إلى الجدول'}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>استعادة</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="text-slate-500 text-[11px]">
            إجمالي العناصر المحذوفة: <strong className="text-slate-700 font-mono">{deletedOrders.length}</strong>
          </div>

          <div className="flex items-center gap-2">
            {deletedOrders.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onPermanentlyClearTrash();
                  soundService.playActionSound('delete');
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 font-semibold transition-colors cursor-pointer text-xs"
              >
                تفريغ السلة نهائياً
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
