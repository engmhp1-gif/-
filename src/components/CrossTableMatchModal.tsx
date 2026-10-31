import React, { useState } from 'react';
import { 
  X, 
  Link2, 
  Sparkles, 
  Check, 
  Camera, 
  Calendar, 
  Building2, 
  HardHat, 
  ShieldCheck, 
  FileText, 
  CheckCircle2, 
  ArrowLeftRight, 
  Download, 
  Eye, 
  RotateCcw,
  Layers,
  Clock,
  ChevronDown
} from 'lucide-react';
import { WorkOrder } from '../types';
import { MatchedTableOrder, pullDataFromSourceOrder } from '../utils/tableScope';

interface CrossTableMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentOrder: WorkOrder;
  currentTableName?: string;
  matchedOrders: MatchedTableOrder[];
  onApplyPull?: (updatedOrder: WorkOrder, sourceTableName: string) => void;
  onApplyData?: (updatedOrder: any) => void;
  currentUser?: any;
}

export const CrossTableMatchModal: React.FC<CrossTableMatchModalProps> = ({
  isOpen,
  onClose,
  currentOrder,
  currentTableName = '',
  matchedOrders,
  onApplyPull,
  onApplyData
}) => {
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
  const [copyPhotos, setCopyPhotos] = useState(true);
  const [copyNotes, setCopyNotes] = useState(true);
  const [copyExecutionStatus, setCopyExecutionStatus] = useState(true);
  const [copyProcedure155, setCopyProcedure155] = useState(true);
  const [copyForms, setCopyForms] = useState(true);
  const [copyContractor, setCopyContractor] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  if (!isOpen || !currentOrder || matchedOrders.length === 0) return null;

  const activeMatch = matchedOrders[selectedMatchIndex] || matchedOrders[0];
  const sourceOrder = activeMatch.order;
  const sourcePhotos = Array.isArray(sourceOrder.photos) ? sourceOrder.photos : [];
  const currentPhotos = Array.isArray(currentOrder.photos) ? currentOrder.photos : [];

  const handleExecutePull = () => {
    setIsApplying(true);
    try {
      const updated = pullDataFromSourceOrder(currentOrder, sourceOrder, {
        copyPhotos,
        copyNotes,
        copyExecutionStatus,
        copyProcedure155,
        copyForms,
        copyContractor
      });
      if (onApplyPull) {
        onApplyPull(updated, activeMatch.tableName);
      } else if (onApplyData) {
        onApplyData(updated);
      }
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border-2 border-orange-500 overflow-hidden flex flex-col max-h-[92vh] text-right font-['Cairo',sans-serif]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-orange-950 via-amber-950 to-orange-900 text-white flex items-center justify-between border-b border-orange-600/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center font-bold shadow-lg ring-2 ring-orange-400/50 shrink-0">
              <Link2 className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                  <span>ربط وتوافق الجداول • استقطاب ومزامنة البيانات</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-500 text-white shadow-xs">
                  توافق رقم ورمز أمر العمل
                </span>
              </div>
              <p className="text-xs text-orange-200 mt-0.5">
                تطابق تام في: رقم أمر العمل ({currentOrder.workOrderNumber}) • رمز أمر العمل ({currentOrder.workOrderCode})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-match tabs if matched with more than one table */}
        {matchedOrders.length > 1 && (
          <div className="px-4 py-2 bg-orange-50/80 border-b border-orange-200 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-xs font-black text-orange-950 shrink-0">متوافق مع {matchedOrders.length} جداول:</span>
            {matchedOrders.map((m, idx) => (
              <button
                key={m.tableId + idx}
                type="button"
                onClick={() => setSelectedMatchIndex(idx)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedMatchIndex === idx
                    ? 'bg-orange-600 text-white shadow-sm ring-1 ring-orange-500'
                    : 'bg-white text-orange-900 border border-orange-200 hover:bg-orange-100'
                }`}
              >
                📋 {m.tableName} ({m.year}/{m.month})
              </button>
            ))}
          </div>
        )}

        {/* Content Body: Side-by-Side Comparison */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* Comparison Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Target Order (This Table) */}
            <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-200 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span className="text-xs font-black text-slate-900">الجدول الحالي: {currentTableName}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                  الهدف (المستقبِل)
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-bold">المكتب:</span>
                  <span className="font-black text-slate-800">{currentOrder.office || '-'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-bold">المقاول:</span>
                  <span className="font-black text-slate-800">{currentOrder.contractor || '-'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-bold">حالة التنفيذ:</span>
                  <span className="font-black text-slate-800">{currentOrder.executionStatus || '-'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-bold">حالة إجراء 155:</span>
                  <span className="font-black text-slate-800">{currentOrder.procedure155Status || '-'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-bold">توثيق الصور:</span>
                  <span className="font-black text-slate-800">{currentOrder.photoDocumentation || '-'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-bold">عدد الصور المرفقة:</span>
                  <span className="font-black text-blue-700">{currentPhotos.length} صورة</span>
                </div>
                <div className="py-1">
                  <span className="text-slate-500 font-bold block mb-1">ملاحظات الجودة:</span>
                  <p className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-[11px] leading-relaxed">
                    {currentOrder.qualityNotes || <span className="italic text-slate-400">لا توجد ملاحظات</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Source Order (The Matched Other Table) */}
            <div className="bg-orange-50/70 rounded-2xl p-4 border-2 border-orange-400 flex flex-col gap-3 relative shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-orange-200">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-600 animate-ping" />
                  <span className="text-xs font-black text-orange-950">الجدول المتوافق: {activeMatch.tableName}</span>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-orange-600 text-white shadow-xs">
                  المصدر (المستقطَب منه)
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-orange-200/60">
                  <span className="text-orange-800 font-bold">المكتب:</span>
                  <span className="font-black text-slate-900">{sourceOrder.office || '-'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-orange-200/60">
                  <span className="text-orange-800 font-bold">المقاول:</span>
                  <span className="font-black text-slate-900">{sourceOrder.contractor || '-'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-orange-200/60">
                  <span className="text-orange-800 font-bold">حالة التنفيذ:</span>
                  <span className="font-black text-emerald-700">{sourceOrder.executionStatus || '-'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-orange-200/60">
                  <span className="text-orange-800 font-bold">حالة إجراء 155:</span>
                  <span className="font-black text-emerald-700">{sourceOrder.procedure155Status || '-'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-orange-200/60">
                  <span className="text-orange-800 font-bold">توثيق الصور:</span>
                  <span className="font-black text-slate-900">{sourceOrder.photoDocumentation || '-'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-orange-200/60">
                  <span className="text-orange-800 font-bold">عدد الصور المرفقة:</span>
                  <span className="font-black text-orange-700 font-mono text-sm">
                    {sourcePhotos.length} صورة متوفرة
                  </span>
                </div>
                <div className="py-1">
                  <span className="text-orange-800 font-bold block mb-1">ملاحظات الجودة بالجدول الآخر:</span>
                  <p className="p-2 rounded-xl bg-white border border-orange-200 text-slate-800 text-[11px] leading-relaxed font-semibold">
                    {sourceOrder.qualityNotes || <span className="italic text-slate-400">لا توجد ملاحظات</span>}
                  </p>
                </div>
              </div>

              {/* Photos Gallery from the other table */}
              {sourcePhotos.length > 0 && (
                <div className="mt-2 pt-2 border-t border-orange-200">
                  <div className="text-[11px] font-black text-orange-950 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-orange-600" />
                      صور الجدول الآخر الجاهزة للاستقطاب:
                    </span>
                    <span className="text-[10px] text-orange-700 font-mono font-bold">({sourcePhotos.length})</span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto p-1 bg-white/80 rounded-xl border border-orange-200">
                    {sourcePhotos.map((p, pIdx) => (
                      <div 
                        key={p.id || pIdx} 
                        className="relative group shrink-0 cursor-pointer"
                        onClick={() => setPreviewPhoto(p.url || (p as any).dataUrl || null)}
                      >
                        <img 
                          src={p.url || (p as any).dataUrl} 
                          alt={p.caption || 'صورة استقطاب'} 
                          className="w-16 h-16 rounded-lg object-cover border border-orange-300 group-hover:scale-105 transition-transform shadow-xs"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity text-white">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selective Ingestion Settings Card */}
          <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-200">
            <h4 className="text-xs font-black text-orange-950 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-orange-600" />
              <span>خيارات استقطاب وربط البيانات:</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-orange-200 cursor-pointer hover:border-orange-400 transition-colors">
                <input
                  type="checkbox"
                  checked={copyPhotos}
                  onChange={(e) => setCopyPhotos(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                />
                <span className="font-bold text-slate-800">الصور والتوثيق الفوتوغرافي</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-orange-200 cursor-pointer hover:border-orange-400 transition-colors">
                <input
                  type="checkbox"
                  checked={copyNotes}
                  onChange={(e) => setCopyNotes(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                />
                <span className="font-bold text-slate-800">ملاحظات الجودة وبنود الفحص</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-orange-200 cursor-pointer hover:border-orange-400 transition-colors">
                <input
                  type="checkbox"
                  checked={copyProcedure155}
                  onChange={(e) => setCopyProcedure155(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                />
                <span className="font-bold text-slate-800">حالة إجراء 155 والمزامنة</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-orange-200 cursor-pointer hover:border-orange-400 transition-colors">
                <input
                  type="checkbox"
                  checked={copyExecutionStatus}
                  onChange={(e) => setCopyExecutionStatus(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                />
                <span className="font-bold text-slate-800">حالة التنفيذ الميداني ونسبة الإنجاز</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-orange-200 cursor-pointer hover:border-orange-400 transition-colors">
                <input
                  type="checkbox"
                  checked={copyForms}
                  onChange={(e) => setCopyForms(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                />
                <span className="font-bold text-slate-800">نماذج الاستشاري و 190 و 200</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-orange-200 cursor-pointer hover:border-orange-400 transition-colors">
                <input
                  type="checkbox"
                  checked={copyContractor}
                  onChange={(e) => setCopyContractor(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                />
                <span className="font-bold text-slate-800">اسم المقاول المنفذ</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-300 font-medium">
            سيتم استقطاب البيانات وحفظها في هذا الجدول فوراً مع مزامنة كافة المستخدمين سحابياً.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              disabled={isApplying}
              onClick={handleExecutePull}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 hover:from-orange-500 hover:to-amber-500 text-white font-black text-xs shadow-lg ring-2 ring-orange-400 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isApplying ? 'جارٍ الاستقطاب والمزامنة...' : 'استقطاب ومزامنة البيانات شاملة الصور الآن'}</span>
            </button>
          </div>
        </div>

        {/* Full Image Preview Modal */}
        {previewPhoto && (
          <div 
            className="fixed inset-0 z-[110] bg-black/90 flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setPreviewPhoto(null)}
          >
            <div className="relative max-w-3xl max-h-[90vh]">
              <img 
                src={previewPhoto} 
                alt="معاينة الصورة" 
                className="max-w-full max-h-[85vh] rounded-2xl object-contain border-2 border-white/20"
                referrerPolicy="no-referrer"
              />
              <button 
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="absolute top-3 left-3 p-2 rounded-full bg-black/70 text-white hover:bg-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
