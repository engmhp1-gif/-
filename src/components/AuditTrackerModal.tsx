import React, { useState, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  Navigation,
  Search,
  ListChecks,
  Archive,
  Building2,
  Sparkles,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { WorkOrder } from '../types';
import {
  getOrderAuditTrackerInfo,
  OrderAuditTrackerInfo,
  DepartmentAuditTrackStatus,
  DepartmentQualificationStatus
} from '../utils/auditTracker';

interface AuditTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrders: WorkOrder[];
  onNavigateToOrder: (
    workOrderNumber: string,
    workOrderCode: string,
    orderId: string,
    isFullyAuditedByAllThree: boolean
  ) => void;
  onOpenArchivedAuditedSection: () => void;
}

export const AuditTrackerModal: React.FC<AuditTrackerModalProps> = ({
  isOpen,
  onClose,
  workOrders,
  onNavigateToOrder,
  onOpenArchivedAuditedSection
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_pdc' | 'needs_construction' | 'needs_tech_support' | 'disqualified'>('all');

  // اي امر عمل في ايقونة تنبيه عاجل عندما يُتم مراحل التدقيق الثلاثة مؤهل 100٪ يتم ترحيله فورا الي الارشيف ويختفي من ايقونة تنبيه عاجل
  // اذا اتفقنا ان اي امر عمل مدقق بشكل جزئي يظهر في ايقونة تنبيه عاجل
  // واي امر عمل مدقق بشكل كامل يظهر في ايقونة اوامر عمل تم التدقيق عليها حيث تتم الارشفه به
  const trackedItems = useMemo<OrderAuditTrackerInfo[]>(() => {
    const list: OrderAuditTrackerInfo[] = [];
    for (const order of workOrders) {
      if (!order || !order.workOrderNumber) continue;
      const info = getOrderAuditTrackerInfo(order);
      if (info.hasAuditStarted && !info.isFullyAuditedByAllThree) {
        list.push(info);
      }
    }
    return list;
  }, [workOrders]);

  const fullyAuditedOrdersCount = useMemo(() => {
    let count = 0;
    for (const order of workOrders) {
      if (!order || !order.workOrderNumber) continue;
      const info = getOrderAuditTrackerInfo(order);
      if (info.isFullyAuditedByAllThree) {
        count++;
      }
    }
    return count;
  }, [workOrders]);

  const counts = useMemo(() => {
    let needsPdc = 0;
    let needsConstruction = 0;
    let needsTechSupport = 0;
    let disqualifiedCount = 0;
    for (const item of trackedItems) {
      if (!item.pdcAudited || item.pdcQualification === 'غير مؤهل') needsPdc++;
      if (!item.constructionAudited || item.constructionQualification === 'غير مؤهل') needsConstruction++;
      if (!item.technicalSupportAudited || item.technicalSupportQualification === 'غير مؤهل') needsTechSupport++;
      if (item.hasAnyDisqualifiedDepartment) {
        disqualifiedCount++;
      }
    }
    return {
      total: trackedItems.length,
      needsPdc,
      needsConstruction,
      needsTechSupport,
      disqualifiedCount,
      completedAll3: fullyAuditedOrdersCount
    };
  }, [trackedItems, fullyAuditedOrdersCount]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return trackedItems.filter((item) => {
      if (statusFilter === 'needs_pdc' && item.pdcAudited && item.pdcQualification !== 'غير مؤهل') return false;
      if (statusFilter === 'needs_construction' && item.constructionAudited && item.constructionQualification !== 'غير مؤهل') return false;
      if (statusFilter === 'needs_tech_support' && item.technicalSupportAudited && item.technicalSupportQualification !== 'غير مؤهل') return false;
      if (statusFilter === 'disqualified' && !item.hasAnyDisqualifiedDepartment) return false;
      if (!q) return true;
      return (
        item.workOrderNumber.toLowerCase().includes(q) ||
        item.workOrderCode.toLowerCase().includes(q) ||
        String(item.order.office || '').toLowerCase().includes(q) ||
        String(item.order.contractor || '').toLowerCase().includes(q)
      );
    });
  }, [trackedItems, statusFilter, searchQuery]);

  if (!isOpen) return null;

  const renderDepartmentBadge = (
    status: DepartmentAuditTrackStatus,
    qualification?: DepartmentQualificationStatus
  ) => {
    if (status !== 'تم التدقيق') {
      return (
        <span
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border shadow-2xs whitespace-nowrap bg-amber-100 text-amber-950 border-amber-400"
          title="هذا البند قيد التدقيق (غير محسوب في أي تقييمات لحين استيفائه والتدقيق الفعلي عليه)"
        >
          <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>قيد التدقيق</span>
        </span>
      );
    }

    const isQualified = qualification === 'مؤهل';
    return (
      <span
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border shadow-2xs whitespace-nowrap transition-all ${
          isQualified
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 shadow-emerald-700/20'
            : 'bg-red-600 hover:bg-red-700 text-white border-red-500 shadow-red-700/20'
        }`}
        title={isQualified ? 'تم التدقيق ومستوفٍ بنسبة 100% (مؤهل)' : 'تم التدقيق وتوجد ملاحظات أو نواقص (غير مؤهل)'}
      >
        {isQualified ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
        ) : (
          <AlertCircle className="w-3.5 h-3.5 text-white shrink-0" />
        )}
        <span>{isQualified ? 'تم التدقيق (مؤهل)' : 'تم التدقيق (غير مؤهل)'}</span>
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-150 font-['Cairo',sans-serif]"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border-2 border-slate-300 flex flex-col max-h-[92vh] overflow-hidden text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-l from-[#7F1D1D] via-[#991B1B] to-slate-900 text-white border-b border-[#7F1D1D] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/30 text-white flex items-center justify-center shrink-0 shadow-sm">
              <ListChecks className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-lg bg-white text-[#7F1D1D] font-black text-xs shadow-2xs">
                  تنبيه عاجل
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">
                  جدول متابعة وترحيل أوامر العمل تحت التدقيق (PDC • الإنشاءات • المساندة الفنية)
                </h3>
                <span className="px-2.5 py-0.5 rounded-lg bg-white/20 border border-white/40 text-white font-mono text-xs font-black">
                  {counts.total} أمر عمل
                </span>
              </div>
              <p className="text-xs text-red-100 mt-0.5 font-bold">
                يتم ترحيل أي أمر عمل يبدأ التدقيق عليه من أي جهة فوراً إلى هذا الجدول، وعند اكتمال التدقيق من الـ 3 جهات يتم أرشفته تلقائياً في قسم (أوامر عمل تم التدقيق عليها)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenArchivedAuditedSection();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white border border-emerald-400/50 text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95"
              title="الانتقال إلى قسم (أوامر عمل تم التدقيق عليها) لعرض الأوامر المؤرشفة بعد اكتمال التدقيق من الـ 3 جهات"
            >
              <Archive className="w-4 h-4 text-amber-300 shrink-0" />
              <span>قسم: أوامر عمل تم التدقيق عليها</span>
              <span className="px-1.5 py-0.2 rounded-md bg-black/25 text-amber-200 font-mono text-[11px] font-black">
                {counts.completedAll3}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary Filter Bar & Search */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <span>الكل بانتظار التدقيق</span>
              <span className="px-1.5 py-0.2 rounded bg-white/20 font-mono text-[11px]">{counts.total}</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('disqualified')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'disqualified'
                  ? 'bg-red-600 text-white border-red-700 shadow-xs ring-2 ring-red-400/50'
                  : 'bg-red-50 text-red-950 border-red-300 hover:bg-red-100'
              }`}
              title="أوامر العمل التي تم التدقيق عليها وتوجد بها ملاحظات أو نواقص وتحتاج إعادة تدقيق واستيفاء"
            >
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              <span>بانتظار استكمال النواقص (غير مؤهل)</span>
              <span className="px-1.5 py-0.2 rounded bg-red-200 text-red-950 font-mono text-[11px]">{counts.disqualifiedCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('needs_pdc')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'needs_pdc'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                  : 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>بانتظار تدقيق PDC</span>
              <span className="px-1.5 py-0.2 rounded bg-black/15 font-mono text-[11px]">{counts.needsPdc}</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('needs_construction')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'needs_construction'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                  : 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>بانتظار تدقيق الإنشاءات</span>
              <span className="px-1.5 py-0.2 rounded bg-black/15 font-mono text-[11px]">{counts.needsConstruction}</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('needs_tech_support')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'needs_tech_support'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                  : 'bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>بانتظار تدقيق المساندة الفنية</span>
              <span className="px-1.5 py-0.2 rounded bg-black/15 font-mono text-[11px]">{counts.needsTechSupport}</span>
            </button>
          </div>

          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم أمر العمل أو نوع أمر العمل..."
              className="w-full pr-9 pl-8 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 6-Column Table Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-5 bg-slate-100/60">
          {filteredItems.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200">
                <ListChecks className="w-7 h-7" />
              </div>
              <h4 className="text-sm sm:text-base font-black text-slate-800">
                {trackedItems.length === 0
                  ? 'لا توجد أوامر عمل تم البدء بالتدقيق عليها حتى الآن'
                  : 'لا توجد أوامر عمل مطابقة للفلتر أو البحث الحالي'}
              </h4>
              <p className="text-xs text-slate-500 max-w-md font-semibold">
                فور البدء بالتدقيق على أي أمر عمل من أي جهة تدقيق (PDC أو الإنشاءات أو المساندة الفنية) سيتم ترحيل وإدراج بياناته تلقائياً في هذا الجدول.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-right">
                  <thead>
                    <tr className="bg-gradient-to-l from-slate-900 via-slate-800 to-indigo-950 text-white text-xs font-black border-b border-slate-700">
                      <th className="py-3 px-3 text-center w-12 border-l border-slate-700/80">#</th>
                      <th className="py-3 px-4 text-center border-l border-slate-700/80">
                        رقم امر العمل
                      </th>
                      <th className="py-3 px-4 text-center border-l border-slate-700/80">
                        نوع امر العمل
                      </th>
                      <th className="py-3 px-4 text-center border-l border-slate-700/80">
                        تدقيق PDC
                      </th>
                      <th className="py-3 px-4 text-center border-l border-slate-700/80">
                        تدقيق الانشاءات
                      </th>
                      <th className="py-3 px-4 text-center border-l border-slate-700/80">
                        تدقيق المساندة الفنية
                      </th>
                      <th className="py-3 px-4 text-center">
                        توجيه
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs font-bold">
                    {filteredItems.map((item, idx) => {
                      const isArchived = item.isFullyAuditedByAllThree;
                      return (
                        <tr
                          key={item.order.id}
                          className={`transition-colors ${
                            isArchived
                              ? 'bg-emerald-50/45 hover:bg-emerald-100/60'
                              : 'bg-white hover:bg-blue-50/50'
                          }`}
                        >
                          {/* # */}
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600 border-l border-slate-200">
                            {idx + 1}
                          </td>

                          {/* العمود الأول: رقم امر العمل */}
                          <td className="py-2.5 px-4 text-center border-l border-slate-200">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-mono text-sm font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-300">
                                {item.workOrderNumber}
                              </span>
                              {item.order.office && (
                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                  <Building2 className="w-2.5 h-2.5 text-slate-400" />
                                  <span>{item.order.office}</span>
                                  {item.order.contractor ? ` • ${item.order.contractor}` : ''}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* العمود الثاني: نوع امر العمل */}
                          <td className="py-2.5 px-4 text-center border-l border-slate-200">
                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-indigo-50 text-indigo-950 border border-indigo-300 font-mono text-xs font-black">
                              {item.workOrderCode || 'غير محدد'}
                            </span>
                          </td>

                          {/* العمود الثالث: تدقيق PDC */}
                          <td className="py-2.5 px-4 text-center border-l border-slate-200">
                            {renderDepartmentBadge(item.pdcStatus, item.pdcQualification)}
                          </td>

                          {/* العمود الرابع: تدقيق الانشاءات */}
                          <td className="py-2.5 px-4 text-center border-l border-slate-200">
                            {renderDepartmentBadge(item.constructionStatus, item.constructionQualification)}
                          </td>

                          {/* العمود الخامس: تدقيق المساندة الفنية */}
                          <td className="py-2.5 px-4 text-center border-l border-slate-200">
                            {renderDepartmentBadge(item.technicalSupportStatus, item.technicalSupportQualification)}
                          </td>

                          {/* العمود السادس: توجيه */}
                          <td className="py-2.5 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onNavigateToOrder(
                                    item.workOrderNumber,
                                    item.workOrderCode,
                                    item.order.id,
                                    item.isFullyAuditedByAllThree
                                  );
                                }}
                                className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black border shadow-xs transition-all cursor-pointer active:scale-95 ${
                                  isArchived
                                    ? 'bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white border-emerald-500'
                                    : 'bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-600 hover:to-indigo-700 text-white border-blue-500'
                                }`}
                                title={`التوجيه المباشر إلى صف أمر العمل (${item.workOrderNumber}) ونوع أمر العمل (${item.workOrderCode || 'عام'}) في ${
                                  isArchived ? 'قسم (أوامر عمل تم التدقيق عليها)' : 'الجدول الرئيسي'
                                }`}
                              >
                                <Navigation className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                                <span>توجيه للصف</span>
                                <ExternalLink className="w-3 h-3 opacity-80 shrink-0" />
                              </button>
                              <span
                                className={`text-[9.5px] font-black ${
                                  isArchived ? 'text-emerald-800' : 'text-blue-800'
                                }`}
                              >
                                {isArchived ? 'مؤرشف (تم من الـ 3 جهات)' : 'في الجدول الرئيسي'}
                              </span>
                            </div>
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

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs font-bold text-slate-700">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              التوجيه المباشر يطابق بدقة <strong className="text-slate-950">(رقم أمر العمل + نوع أمر العمل)</strong> وينتقل تلقائياً إلى الصف سواء في الجدول الرئيسي أو في قسم <strong className="text-emerald-800">(أوامر عمل تم التدقيق عليها)</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-900 font-black text-xs transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
