import React, { useMemo, useState } from 'react';
import {
  X,
  Search,
  ArrowUpRight,
  FileSpreadsheet,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  TableProperties,
  Archive,
  ShieldCheck
} from 'lucide-react';
import { WorkOrder, MonthTable } from '../types';
import {
  getOrderAuditTrackerInfo,
  getEffectiveProcedure155Status
} from '../utils/auditTracker';
import { getArabicMonthName, resolveOrderScope } from '../utils/tableScope';

export interface KPIContentPopupData {
  title: string;
  subtitle?: string;
  badgeColor?: 'navy' | 'emerald' | 'amber' | 'rose' | 'indigo';
  orders: WorkOrder[];
  filterType?: 'all' | 'ready155' | 'notReady155' | 'inProgress' | 'urgent';
  targetOffice?: string;
}

interface KPIContentPopupModalProps {
  popupData: KPIContentPopupData | null;
  onClose: () => void;
  monthTables?: MonthTable[];
  activeYear?: number;
  activeMonth?: number | 'all';
  selectedOffice?: string;
  onNavigateToOrderInTable?: (order: WorkOrder) => void;
  onNavigateToTableWithFilter?: (
    filterType?: 'all' | 'ready155' | 'notReady155' | 'inProgress' | 'urgent',
    office?: string
  ) => void;
}

export const KPIContentPopupModal: React.FC<KPIContentPopupModalProps> = ({
  popupData,
  onClose,
  monthTables = [],
  activeYear,
  activeMonth,
  selectedOffice = 'all',
  onNavigateToOrderInTable,
  onNavigateToTableWithFilter
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOrders = useMemo(() => {
    if (!popupData) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return popupData.orders;
    return popupData.orders.filter((w) => {
      const num = String(w.workOrderNumber || '').toLowerCase();
      const code = String(w.workOrderCode || '').toLowerCase();
      const off = String(w.office || '').toLowerCase();
      const cont = String(w.contractor || '').toLowerCase();
      const cons = String(w.consultant || '').toLowerCase();
      const tbl = String(w.tableName || '').toLowerCase();
      const notes = String(w.qualityNotes || '').toLowerCase();
      return (
        num.includes(q) ||
        code.includes(q) ||
        off.includes(q) ||
        cont.includes(q) ||
        cons.includes(q) ||
        tbl.includes(q) ||
        notes.includes(q)
      );
    });
  }, [popupData, searchQuery]);

  if (!popupData) return null;

  const resolveTableBadgeLabel = (order: WorkOrder) => {
    const scope = resolveOrderScope(order, monthTables);
    const tbl = monthTables.find((t) => t.id === order.tableId);
    const tblName = tbl?.name || order.tableName || 'الجدول الأساسي';
    const mName = getArabicMonthName(scope.month);
    return `${tblName} (${mName} ${scope.year})`;
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 font-['Cairo',sans-serif]"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-6xl max-h-[90vh] rounded-2xl border-2 border-[#002855] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-l from-[#001D40] via-[#002855] to-[#004B8D] text-white px-4 py-3.5 border-b-2 border-[#F58220] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#F58220] text-white flex items-center justify-center shadow-md shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  {popupData.title}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-[#FDB813] text-slate-950 font-mono text-xs font-black">
                  {popupData.orders.length} أمر عمل
                </span>
              </div>
              <p className="text-[11px] text-blue-100 font-bold mt-0.5 truncate">
                {popupData.subtitle ||
                  `قائمة مستقلة متزامنة لحظياً مع الجداول • السنة: ${activeYear || 'الكل'} • الشهر: ${
                    activeMonth === 'all' || !activeMonth ? 'كافة الشهور' : getArabicMonthName(activeMonth)
                  } • المكتب: ${
                    popupData.targetOffice && popupData.targetOffice !== 'all'
                      ? popupData.targetOffice
                      : selectedOffice === 'all'
                      ? 'جميع المكاتب'
                      : selectedOffice
                  }`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToTableWithFilter && (
              <button
                type="button"
                onClick={() => {
                  onNavigateToTableWithFilter(
                    popupData.filterType || 'all',
                    popupData.targetOffice || selectedOffice
                  );
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F58220] hover:bg-[#d96b12] text-white text-xs font-black transition-all cursor-pointer shadow-md active:scale-95"
                title="فتح الجدول الرئيسي مع عرض وتصفية هذا المحتوى مباشرة"
              >
                <TableProperties className="w-4 h-4 text-white" />
                <span>التوجه إلى المحتوى في الجدول مباشرة</span>
                <ArrowUpRight className="w-4 h-4 text-[#FDB813]" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-600 text-white border border-white/20 transition-colors cursor-pointer"
              title="إغلاق القائمة المستقلة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Quick Stats Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم أمر العمل، الرمز، المقاول، الاستشاري، المكتب أو الجدول..."
              className="w-full pr-9 pl-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#004B8D]"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
            <span>
              المعروض: <strong className="font-mono text-[#002855]">{filteredOrders.length}</strong> من{' '}
              <strong className="font-mono text-slate-900">{popupData.orders.length}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-[#004B8D] font-black">
              انقر على زر «التوجه للجدول» أمام أي أمر عمل للانتقال لصفه الفعلي فوراً
            </span>
          </div>
        </div>

        {/* Orders Table Body */}
        <div className="flex-1 overflow-auto p-3 bg-[#F4F6F9]">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
              <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-sm font-black text-slate-700">
                لا توجد أوامر عمل مطابقة في هذا المؤشر حالياً
              </div>
              <div className="text-xs text-slate-500 font-bold">
                يمكنك تغيير السنة أو الشهر أو الجدول من الشريط العلوي لعرض بيانات فترة أخرى
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-x-auto">
              <table className="w-full text-right text-xs border-separate border-spacing-0 tabular-nums">
                <thead className="bg-[#002855] text-white font-black sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5 border-b-2 border-[#F58220] border-l border-blue-800/60 text-center w-11 text-[#FDB813] font-mono">
                      #
                    </th>
                    <th className="p-2.5 border-b-2 border-[#F58220] border-l border-blue-800/60">
                      رقم أمر العمل
                    </th>
                    <th className="p-2.5 border-b-2 border-[#F58220] border-l border-blue-800/60 text-center">
                      الرمز
                    </th>
                    <th className="p-2.5 border-b-2 border-[#F58220] border-l border-blue-800/60">
                      المكتب
                    </th>
                    <th className="p-2.5 border-b-2 border-[#F58220] border-l border-blue-800/60">
                      المقاول / الاستشاري
                    </th>
                    <th className="p-2.5 border-b-2 border-[#F58220] border-l border-blue-800/60">
                      الجدول الموجود به
                    </th>
                    <th className="p-2.5 border-b-2 border-[#F58220] border-l border-blue-800/60 text-center">
                      حالة التدقيق الثلاثي
                    </th>
                    <th className="p-2.5 border-b-2 border-[#F58220] border-l border-blue-800/60 text-center">
                      إجراء 155 النهائي
                    </th>
                    <th className="p-2.5 border-b-2 border-[#F58220] bg-[#001D40] text-center w-36">
                      التوجه للجدول
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredOrders.map((ord, idx) => {
                    const info = getOrderAuditTrackerInfo(ord);
                    const eff155 = getEffectiveProcedure155Status(ord);
                    const locationBadge = info.isArchived155
                      ? 'ارشيف 155'
                      : info.isFullyAuditedByAllThree
                      ? 'تم التدقيق عليه'
                      : resolveTableBadgeLabel(ord);

                    return (
                      <tr
                        key={ord.id}
                        className={`${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'
                        } hover:bg-blue-50/70 transition-colors`}
                      >
                        <td className="p-2.5 border-b border-l border-slate-200 text-center font-mono font-black text-slate-600 bg-slate-100/70">
                          {idx + 1}
                        </td>
                        <td className="p-2.5 border-b border-l border-slate-200 font-mono font-black text-[#002855] text-xs">
                          {ord.workOrderNumber}
                        </td>
                        <td className="p-2.5 border-b border-l border-slate-200 text-center font-mono font-black text-slate-700">
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300">
                            {ord.workOrderCode || '-'}
                          </span>
                        </td>
                        <td className="p-2.5 border-b border-l border-slate-200 font-black text-[#004B8D]">
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{ord.office}</span>
                          </span>
                        </td>
                        <td className="p-2.5 border-b border-l border-slate-200">
                          <div className="font-black text-slate-800 truncate max-w-[180px]" title={ord.contractor}>
                            {ord.contractor || '-'}
                          </div>
                          {ord.consultant && (
                            <div className="text-[10.5px] font-bold text-slate-500 truncate max-w-[180px]">
                              الاستشاري: {ord.consultant}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 border-b border-l border-slate-200">
                          {info.isArchived155 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-100 text-purple-900 border border-purple-300 text-[10.5px] font-black">
                              <Archive className="w-3 h-3" />
                              <span>قائمة (ارشيف 155)</span>
                            </span>
                          ) : info.isFullyAuditedByAllThree ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10.5px] font-black">
                              <ShieldCheck className="w-3 h-3" />
                              <span>قائمة (تم التدقيق عليه)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-[#002855] border border-blue-200 text-[10.5px] font-bold">
                              <TableProperties className="w-3 h-3 text-[#004B8D]" />
                              <span className="truncate max-w-[190px]">{locationBadge}</span>
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 border-b border-l border-slate-200 text-center">
                          <div className="inline-flex items-center gap-1 flex-wrap justify-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black border ${
                                info.pdcQualification === 'مؤهل'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : info.pdcQualification === 'غير مؤهل'
                                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                                  : 'bg-slate-100 text-slate-600 border-slate-300'
                              }`}
                            >
                              PDC: {info.pdcQualification}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black border ${
                                info.constructionQualification === 'مؤهل'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : info.constructionQualification === 'غير مؤهل'
                                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                                  : 'bg-slate-100 text-slate-600 border-slate-300'
                              }`}
                            >
                              الإنشاءات: {info.constructionQualification}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black border ${
                                info.technicalSupportQualification === 'مؤهل'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : info.technicalSupportQualification === 'غير مؤهل'
                                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                                  : 'bg-slate-100 text-slate-600 border-slate-300'
                              }`}
                            >
                              المساندة: {info.technicalSupportQualification}
                            </span>
                          </div>
                        </td>
                        <td className="p-2.5 border-b border-l border-slate-200 text-center">
                          {eff155 ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-black border ${
                                eff155.includes('تم الاجراء') || eff155.includes('تم الإجراء')
                                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                                  : eff155.includes('غير')
                                  ? 'bg-rose-100 text-rose-900 border-rose-300'
                                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              }`}
                            >
                              {eff155.includes('غير') ? (
                                <AlertCircle className="w-3 h-3" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3" />
                              )}
                              <span>{eff155}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10.5px] font-bold">
                              <Clock className="w-3 h-3" />
                              <span>قيد التدقيق</span>
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 border-b border-slate-200 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (onNavigateToOrderInTable) {
                                onNavigateToOrderInTable(ord);
                              }
                              onClose();
                            }}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#004B8D] hover:bg-[#002855] text-white text-[11px] font-black transition-all cursor-pointer shadow-2xs active:scale-95 w-full"
                            title="التوجه المباشر لصف أمر العمل داخل الجدول الموجود به"
                          >
                            <span>التوجه للجدول</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-[#FDB813]" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between gap-2 text-xs shrink-0">
          <span className="font-bold text-slate-500">
            مزامنة حية ومباشرة 100% بين مؤشرات الصفحة الرئيسية والجداول المعتمدة
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-black cursor-pointer transition-colors"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
