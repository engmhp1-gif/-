import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ShieldCheck,
  Search,
  History,
  User,
  Clock,
  Monitor,
  FileText,
  Lock,
  ArrowLeft,
  Filter,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import {
  auditTrailService,
  AuditTrailRecord,
  AuditOperationType
} from '../services/auditTrailService';
import { WorkOrder, PlatformUser } from '../types';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrders: WorkOrder[];
  currentUser?: PlatformUser | null;
  initialWorkOrderFilter?: string;
}

const OPERATION_BADGE_CONFIG: Record<
  AuditOperationType,
  { label: string; bg: string; text: string; border: string }
> = {
  DATA_ENTRY: {
    label: 'إدخال بيانات',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200'
  },
  DATA_EDIT: {
    label: 'تعديل بيانات',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200'
  },
  DATA_DELETE: {
    label: 'حذف بيانات',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200'
  },
  AUDIT_OPERATION: {
    label: 'عملية تدقيق',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200'
  },
  ITEM_STATUS_CHANGE: {
    label: 'تغيير حالة بند',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200'
  },
  ORDER_STATUS_CHANGE: {
    label: 'تغيير حالة أمر عمل',
    bg: 'bg-cyan-50',
    text: 'text-cyan-800',
    border: 'border-cyan-200'
  },
  ATTACHMENT_UPLOAD: {
    label: 'رفع مرفق',
    bg: 'bg-teal-50',
    text: 'text-teal-800',
    border: 'border-teal-200'
  },
  ATTACHMENT_DELETE: {
    label: 'حذف مرفق',
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200'
  },
  AUDIT_APPROVAL: {
    label: 'اعتماد تدقيق',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200'
  },
  APPROVAL_REVOKE: {
    label: 'إلغاء اعتماد',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200'
  },
  CHECKLIST_UPDATE: {
    label: 'تحديث قائمة تحقق',
    bg: 'bg-violet-50',
    text: 'text-violet-800',
    border: 'border-violet-200'
  },
  BULK_EDIT: {
    label: 'تعديل جماعي',
    bg: 'bg-fuchsia-50',
    text: 'text-fuchsia-800',
    border: 'border-fuchsia-200'
  }
};

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
  workOrders,
  initialWorkOrderFilter = ''
}) => {
  const [records, setRecords] = useState<AuditTrailRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>(initialWorkOrderFilter);
  const [selectedType, setSelectedType] = useState<string>('ALL');

  useEffect(() => {
    if (isOpen) {
      setRecords(auditTrailService.getAllRecords());
      if (initialWorkOrderFilter) {
        setSearchQuery(initialWorkOrderFilter);
      }
    }
    const unsub = auditTrailService.subscribe((updated) => {
      setRecords(updated);
    });
    return () => unsub();
  }, [isOpen, initialWorkOrderFilter]);

  // Combine persisted AuditTrailRecords with historical editHistory from workOrders so no legacy action is missed
  const combinedRecords = useMemo(() => {
    const map = new Map<string, AuditTrailRecord>();
    records.forEach((r) => map.set(r.id, r));

    workOrders.forEach((order) => {
      if (Array.isArray(order.editHistory)) {
        order.editHistory.forEach((h) => {
          if (!map.has(h.id)) {
            map.set(h.id, {
              id: h.id,
              userName: h.userName || 'مستخدم المنصة',
              userEmail: h.userEmail || 'engmhp1@gmail.com',
              userRole: h.userRole || 'مهندس معتمد',
              timestamp: h.timestamp,
              riyadhTime: h.riyadhTime || h.timestamp,
              operationType:
                h.actionType === 'create'
                  ? 'DATA_ENTRY'
                  : h.actionType === 'delete'
                  ? 'DATA_DELETE'
                  : h.actionType === 'audit'
                  ? 'AUDIT_OPERATION'
                  : 'DATA_EDIT',
              operationLabel: h.summary || 'عملية موثقة على أمر العمل',
              fieldLabel: h.changes?.[0]?.fieldLabel || 'بيانات أمر العمل',
              previousValue: h.changes?.[0]?.oldValue || '—',
              newValue: h.changes?.[0]?.newValue || h.summary || '—',
              deviceSession: 'جلسة سحابية موثقة',
              workOrderNumber: order.workOrderNumber || 'بدون رقم',
              workOrderId: order.id,
              office: order.office,
              isFinalAction: true
            });
          }
        });
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [records, workOrders]);

  const filteredRecords = useMemo(() => {
    return combinedRecords.filter((rec) => {
      if (selectedType !== 'ALL' && rec.operationType !== selectedType) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        rec.workOrderNumber.toLowerCase().includes(q) ||
        rec.userName.toLowerCase().includes(q) ||
        rec.userEmail.toLowerCase().includes(q) ||
        rec.operationLabel.toLowerCase().includes(q) ||
        rec.fieldLabel.toLowerCase().includes(q) ||
        rec.previousValue.toLowerCase().includes(q) ||
        rec.newValue.toLowerCase().includes(q) ||
        (rec.office || '').toLowerCase().includes(q)
      );
    });
  }, [combinedRecords, selectedType, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 font-['Cairo',sans-serif]"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white px-5 py-4 flex items-center justify-between border-b border-emerald-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-white">
                  سجل التدقيق التاريخي الشامل (Immutable Audit Trail)
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-400/40 text-rose-200 text-[10px] font-black flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>للاستعراض فقط • سياسة منع التراجع النهائية (No Undo Policy)</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                جميع الإجراءات المنفذة داخل المنصة نهائية (Final Action) وموثقة تلقائياً بالوقت والمستخدم والجهاز ولا يمكن التراجع عنها أو استرجاع حالتها السابقة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Governance Policy Notice Banner */}
        <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950 shrink-0">
          <div className="flex items-center gap-2 font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              مبدأ السجل غير القابل للتراجع: تعتبر كل عملية محفوظة إجراءً نهائياً (Final Action)، وأي تعديل لاحق يُسجل كإجراء جديد مستقل مع الاحتفاظ الكامل بالسجل التاريخي.
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white font-mono text-[11px] font-bold">
            إجمالي العمليات الموثقة: {filteredRecords.length}
          </span>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم أمر العمل، اسم المستخدم، نوع العملية، القيمة السابقة أو الجديدة..."
              className="w-full pr-9 pl-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="ALL">جميع أنواع العمليات ({combinedRecords.length})</option>
              {Object.entries(OPERATION_BADGE_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>

            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
              >
                مسح البحث
              </button>
            )}
          </div>
        </div>

        {/* Immutable Audit Trail Table */}
        <div className="flex-1 overflow-auto p-3 sm:p-4 bg-slate-100/60">
          {filteredRecords.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
              <History className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="text-sm font-black text-slate-700">
                لا توجد عمليات مطابقة لمعايير البحث الحالية
              </div>
              <p className="text-xs text-slate-500">
                يتم تسجيل جميع العمليات (إدخال، تعديل، حذف، تدقيق، قوائم تحقق، مرفقات، اعتمادات) تلقائياً فور حدوثها.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-black text-[11px] border-b border-slate-800">
                      <th className="py-3 px-3 whitespace-nowrap">#</th>
                      <th className="py-3 px-3 whitespace-nowrap">رقم أمر العمل المرتبط</th>
                      <th className="py-3 px-3 whitespace-nowrap">نوع العملية</th>
                      <th className="py-3 px-3 whitespace-nowrap">البند / الحقل</th>
                      <th className="py-3 px-3 whitespace-nowrap">القيمة السابقة</th>
                      <th className="py-3 px-3 whitespace-nowrap">القيمة الجديدة</th>
                      <th className="py-3 px-3 whitespace-nowrap">اسم المستخدم</th>
                      <th className="py-3 px-3 whitespace-nowrap">التاريخ والوقت</th>
                      <th className="py-3 px-3 whitespace-nowrap">الجهاز / الجلسة</th>
                      <th className="py-3 px-3 whitespace-nowrap text-center">حالة الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    {filteredRecords.map((rec, index) => {
                      const badge = OPERATION_BADGE_CONFIG[rec.operationType] || {
                        label: rec.operationLabel,
                        bg: 'bg-slate-100',
                        text: 'text-slate-800',
                        border: 'border-slate-300'
                      };
                      return (
                        <tr
                          key={rec.id}
                          className="hover:bg-slate-50/90 transition-colors"
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-500">
                            {index + 1}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono font-black text-xs">
                              {rec.workOrderNumber}
                            </span>
                            {rec.office && (
                              <span className="block text-[10px] text-slate-500 font-bold mt-0.5">
                                {rec.office}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-lg border font-black text-[11px] ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800 max-w-[180px] truncate" title={rec.fieldLabel}>
                            {rec.fieldLabel}
                          </td>
                          <td className="py-2.5 px-3 max-w-[200px]">
                            <div
                              className="px-2 py-1 rounded bg-rose-50/70 border border-rose-200/70 text-rose-900 text-[11px] font-semibold truncate"
                              title={rec.previousValue}
                            >
                              {rec.previousValue}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 max-w-[220px]">
                            <div
                              className="px-2 py-1 rounded bg-emerald-50/80 border border-emerald-200/80 text-emerald-950 text-[11px] font-bold truncate flex items-center gap-1"
                              title={rec.newValue}
                            >
                              <ArrowLeft className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">{rec.newValue}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{rec.userName}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono" dir="ltr">
                              {rec.userEmail}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-700">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                              <span>{rec.riyadhTime}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-[10px] text-slate-600 font-mono">
                            <div className="flex items-center gap-1">
                              <Monitor className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{rec.deviceSession}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 text-amber-300 text-[10px] font-black">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>نهائي (Final)</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              هذا السجل محمي ومخصص للاستعراض والتدقيق فقط حسب الصلاحيات، ولا يحتوي على أي وظيفة للتراجع أو استرجاع الحالات السابقة.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-colors cursor-pointer"
          >
            إغلاق سجل التدقيق
          </button>
        </div>
      </div>
    </div>
  );
};
