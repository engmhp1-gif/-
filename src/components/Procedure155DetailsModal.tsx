import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  FileCheck, 
  Camera, 
  FileEdit, 
  Building2, 
  Briefcase,
  AlertTriangle
} from 'lucide-react';
import { WorkOrder, Procedure155Status } from '../types';

interface Procedure155DetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: WorkOrder | null;
  onUpdateStatus: (orderId: string, status: Procedure155Status) => void;
}

export const Procedure155DetailsModal: React.FC<Procedure155DetailsModalProps> = ({
  isOpen,
  onClose,
  order,
  onUpdateStatus
}) => {
  if (!isOpen || !order) return null;

  // Criteria validation checks based on system requirements
  const check1_DataComplete = Boolean(order.workOrderNumber && order.workOrderCode && order.contractor);
  const check2_PhotosAttached = order.photos && order.photos.length >= 2;
  const check3_BoqAudited = !String(order.boqModification || '').includes('بانتظار');
  const check4_ExecutionFinished = String(order.procedure155Status || '').includes('مؤهل') && !String(order.procedure155Status || '').includes('غير');

  const allPassed = check1_DataComplete && check2_PhotosAttached && check3_BoqAudited && check4_ExecutionFinished;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full my-6 overflow-hidden flex flex-col text-right">
        
        {/* Header */}
        <div className="bg-gradient-to-l from-[#002855] via-[#003B73] to-[#004B8D] text-white px-6 py-4 flex items-center justify-between border-b-2 border-[#F58220]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F58220] flex items-center justify-center text-white shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">
                  تدقيق معايير الجودة لإجراء 155
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/15 border border-white/25 text-[#FDB813] font-bold">
                  {order.workOrderNumber}
                </span>
              </div>
              <p className="text-xs text-blue-100">
                استلام أمر العمل رسمياً من المقاول والتأكد من استيفاء جميع المتطلبات الميدانية
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-white/15 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audit Body */}
        <div className="p-6 space-y-5">
          {/* Work order summary badge */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">المكتب:</span>
              <strong className="text-slate-900">{order.office}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">المقاول:</span>
              <strong className="text-slate-900 truncate block">{order.contractor}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">رمز الأمر:</span>
              <strong className="font-mono text-blue-700">{order.workOrderCode}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">الحالة الحالية:</span>
              <strong className="text-amber-700">{order.procedure155Status}</strong>
            </div>
          </div>

          {/* Checklist of Quality Standards before 155 acceptance */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800">
              قائمة التحقق المسبق قبل تنفيذ إجراء 155 (استلام أمر العمل):
            </h3>

            {/* Check 1 */}
            <div className="p-3 rounded-lg border border-slate-200 bg-white flex items-start gap-3">
              <div className={`mt-0.5 p-1 rounded-full ${check1_DataComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {check1_DataComplete ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-900">توثيق كافة التفاصيل والبيانات المدخلة بالنظام</div>
                <div className="text-slate-500 mt-0.5">
                  رقم أمر العمل، الرمز التصنيفي، اسم المقاول، والمكتب التابع موثقة بشكل صحيح.
                </div>
              </div>
            </div>

            {/* Check 2 */}
            <div className="p-3 rounded-lg border border-slate-200 bg-white flex items-start gap-3">
              <div className={`mt-0.5 p-1 rounded-full ${check2_PhotosAttached ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {check2_PhotosAttached ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-900">توثيق الصور الميدانية الشاملة لمراحل التنفيذ</div>
                <div className="text-slate-500 mt-0.5">
                  تم إرفاق ({order.photos?.length || 0}) صور توثيقية للأعمال المنجزة واختبارات الجودة.
                </div>
              </div>
            </div>

            {/* Check 3 */}
            <div className="p-3 rounded-lg border border-slate-200 bg-white flex items-start gap-3">
              <div className={`mt-0.5 p-1 rounded-full ${check3_BoqAudited ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {check3_BoqAudited ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-900">تدقيق وتحديث المقايسة على النظام</div>
                <div className="text-slate-500 mt-0.5">
                  الحالة: {order.boqModification} {order.boqDetails ? `(${order.boqDetails})` : ''}
                </div>
              </div>
            </div>

            {/* Check 4 */}
            <div className="p-3 rounded-lg border border-slate-200 bg-white flex items-start gap-3">
              <div className={`mt-0.5 p-1 rounded-full ${check4_ExecutionFinished ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {check4_ExecutionFinished ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              </div>
              <div className="text-xs">
                <div className="font-bold text-slate-900">اكتمال مراحل التنفيذ الميدانية وخلوها من العيوب</div>
                <div className="text-slate-500 mt-0.5">
                  ملاحظات المدقق: {order.executionNotes}
                </div>
              </div>
            </div>
          </div>

          {/* Direct Actions to Sign Off or Change Status */}
          <div className="pt-3 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 mb-2">تحديث قرار إجراء 155:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => {
                  onUpdateStatus(order.id, 'مؤهل للاستلام (معتمد)');
                  onClose();
                }}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-2xs text-center"
              >
                اعتماد كـ "مؤهل للاستلام 155"
              </button>

              <button
                onClick={() => {
                  onUpdateStatus(order.id, 'تم الاستلام وإغلاق 155');
                  onClose();
                }}
                className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-2xs text-center"
              >
                تأكيد "تم الاستلام وإغلاق 155"
              </button>

              <button
                onClick={() => {
                  onUpdateStatus(order.id, 'بانتظار استيفاء الملاحظات');
                  onClose();
                }}
                className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-2xs text-center"
              >
                تعليق "بانتظار استيفاء الملاحظات"
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
