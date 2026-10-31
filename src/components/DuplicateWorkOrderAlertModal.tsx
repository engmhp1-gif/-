import React from 'react';
import { X, AlertTriangle, ExternalLink, Calendar, FolderOpen, Table as TableIcon, FileText, Hash, Layers, Building2, ArrowLeft } from 'lucide-react';
import { DuplicateWorkOrderConflict } from '../utils/tableScope';

interface DuplicateWorkOrderAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: DuplicateWorkOrderConflict[];
  sourceLabel?: string;
  acceptedCount?: number;
  onNavigateAndOpenOrder: (conflict: DuplicateWorkOrderConflict) => void;
}

export const DuplicateWorkOrderAlertModal: React.FC<DuplicateWorkOrderAlertModalProps> = ({
  isOpen,
  onClose,
  conflicts,
  sourceLabel = 'إضافة / استيراد أوامر عمل',
  acceptedCount = 0,
  onNavigateAndOpenOrder,
}) => {
  if (!isOpen || conflicts.length === 0) return null;

  const isSingle = conflicts.length === 1;

  return (
    <div
      className="fixed inset-0 bg-slate-900/75 backdrop-blur-md flex items-center justify-center z-[12000] p-4 animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border-2 border-rose-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-l from-rose-700 via-red-600 to-rose-600 text-white shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-white/15 rounded-2xl border border-white/25 shadow-inner">
              <AlertTriangle className="w-7 h-7 text-amber-200 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight">
                  تم رفض الإضافة — أمر العمل مسجل مسبقاً في المنصة
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-white/20 border border-white/30">
                  {conflicts.length} {isSingle ? 'أمر عمل مكرر' : 'أوامر عمل مكررة'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-rose-100 font-medium mt-1">
                {sourceLabel} • يمنع النظام تكرار نفس (رقم أمر العمل + نوع أمر العمل) في أي سنة أو شهر أو قسم أو جدول
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-colors"
            title="إغلاق"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Summary Banner */}
        <div className="px-6 py-3.5 bg-rose-50 border-b border-rose-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-rose-900 text-xs sm:text-sm font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0" />
            <span>
              {isSingle
                ? 'تم إيقاف إضافة أمر العمل الموضح أدناه لأنه موجود بالفعل في المنصة.'
                : `تم رفض إضافة (${conflicts.length}) أمر عمل لوجودها مسبقاً في المنصة.`}
              {acceptedCount > 0 && (
                <span className="text-emerald-700 font-black mr-2">
                  (تم حفظ {acceptedCount} أمر عمل جديد غير مكرر بنجاح)
                </span>
              )}
            </span>
          </div>
          <span className="text-[11px] font-black text-rose-700 bg-white px-3 py-1 rounded-lg border border-rose-200 shadow-2xs">
            اضغط على أيقونة الانتقال لفتح الجدول وأمر العمل مباشرة
          </span>
        </div>

        {/* Conflicts List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/60">
          {conflicts.map((conflict, idx) => (
            <div
              key={`${conflict.existingOrder.id}-${idx}`}
              className="bg-white rounded-2xl border-2 border-rose-200/90 hover:border-rose-400 shadow-sm hover:shadow-md transition-all overflow-hidden"
            >
              {/* Top Bar of Card: Work Order Number & Code + Direct Jump Action Button */}
              <div className="px-5 py-3.5 bg-gradient-to-l from-rose-50/90 via-white to-amber-50/50 border-b border-rose-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-rose-600 text-white text-xs font-black shadow-xs">
                    {idx + 1}
                  </span>
                  <div className="flex items-center gap-1.5 bg-rose-100/80 text-rose-950 px-3 py-1.5 rounded-xl border border-rose-200">
                    <Hash className="w-4 h-4 text-rose-600" />
                    <span className="text-xs font-bold text-rose-700">رقم أمر العمل:</span>
                    <span className="text-sm font-black font-mono tracking-wide">{conflict.workOrderNumber}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-950 px-3 py-1.5 rounded-xl border border-indigo-200">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-indigo-700">نوع أمر العمل:</span>
                    <span className="text-sm font-black font-mono">{conflict.workOrderCode}</span>
                  </div>
                </div>

                {/* Direct Jump & Open Work Order Icon Button */}
                <button
                  type="button"
                  onClick={() => onNavigateAndOpenOrder(conflict)}
                  className="group inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs sm:text-sm font-black rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
                  title="انتقل فوراً إلى الجدول الموجود به أمر العمل وافتح بطاقة أمر العمل للاطلاع عليه"
                >
                  <ExternalLink className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform" />
                  <span>الانتقال للجدول وفتح أمر العمل</span>
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Location Details Grid: Year, Month, Section/Department, Table Name */}
              <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Year */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700 shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-500">السنة المسجل بها</div>
                    <div className="text-sm font-black text-slate-900 mt-0.5">{conflict.year} م</div>
                  </div>
                </div>

                {/* Month */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-500">الشهر المسجل به</div>
                    <div className="text-sm font-black text-slate-900 mt-0.5">
                      شهر {conflict.month} ({conflict.monthName})
                    </div>
                  </div>
                </div>

                {/* Section / Office Name */}
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5 sm:col-span-2">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-amber-800">اسم القسم المضاف له الجدول والمكتب</div>
                    <div className="text-sm font-black text-slate-900 mt-0.5 break-words">
                      {conflict.sectionName}
                    </div>
                  </div>
                </div>

                {/* Table Name & Extra Info */}
                <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200/80 flex items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                      <TableIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-indigo-700">الجدول الموجود به أمر العمل حالياً</div>
                      <div className="text-sm font-black text-slate-900 truncate">
                        {conflict.tableName}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {conflict.officeName && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        المكتب: {conflict.officeName}
                      </span>
                    )}
                    {conflict.contractorName && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        المقاول: {conflict.contractorName}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigateAndOpenOrder(conflict)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
                      title="عرض أمر العمل في الجدول"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>معاينة أمر العمل</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            يمكنك الضغط على زر <strong className="text-indigo-700">«الانتقال للجدول وفتح أمر العمل»</strong> بجانب أي أمر عمل للانتقال الفوري لمكانه وفتحه.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-black rounded-xl transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
