import React, { useState, useMemo } from 'react';
import { 
  Search, 
  X, 
  Edit, 
  Trash2, 
  FileDown, 
  Building2, 
  Tag, 
  Hash, 
  Camera, 
  Filter, 
  CheckCircle2, 
  AlertTriangle,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import { WorkOrder } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { UnifiedSectionExportBar } from './UnifiedSectionExportBar';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrders: WorkOrder[];
  onEdit: (order: WorkOrder) => void;
  onDelete: (id: string) => void;
  onDeleteBatch?: (ids: string[]) => void;
  onExportSearchResults: (filtered: WorkOrder[], title?: string, openEmail?: boolean) => void;
  onViewPhotos: (order: WorkOrder) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  workOrders,
  onEdit,
  onDelete,
  onDeleteBatch,
  onExportSearchResults,
  onViewPhotos
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOfficeFilter, setSelectedOfficeFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [selectedProc155Filter, setSelectedProc155Filter] = useState('all');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'batch' | 'single';
    id?: string;
    title: string;
    message: string;
  } | null>(null);

  // Filter work orders based on search query and criteria
  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return workOrders.filter(wo => {
      // Query match across all fields
      const matchesSearch = !term || (
        wo.workOrderNumber.toLowerCase().includes(term) ||
        wo.workOrderCode.toLowerCase().includes(term) ||
        wo.contractor.toLowerCase().includes(term) ||
        (wo.consultant && wo.consultant.toLowerCase().includes(term)) ||
        wo.office.toLowerCase().includes(term) ||
        (wo.photoDocumentation && String(wo.photoDocumentation).toLowerCase().includes(term)) ||
        (wo.consultantForms && String(wo.consultantForms).toLowerCase().includes(term)) ||
        (wo.form190 && String(wo.form190).toLowerCase().includes(term)) ||
        (wo.form200 && String(wo.form200).toLowerCase().includes(term)) ||
        (wo.inspectionForm && String(wo.inspectionForm).toLowerCase().includes(term)) ||
        (wo.qualityNotes && wo.qualityNotes.toLowerCase().includes(term)) ||
        (wo.executionNotes && wo.executionNotes.toLowerCase().includes(term)) ||
        (wo.executionStatus && wo.executionStatus.toLowerCase().includes(term))
      );

      const matchesOffice = selectedOfficeFilter === 'all' || wo.office === selectedOfficeFilter;
      const matchesStatus = selectedStatusFilter === 'all' || wo.executionStatus === selectedStatusFilter;
      const matchesProc155 = selectedProc155Filter === 'all' || wo.procedure155Status === selectedProc155Filter;

      return matchesSearch && matchesOffice && matchesStatus && matchesProc155;
    });
  }, [workOrders, searchTerm, selectedOfficeFilter, selectedStatusFilter, selectedProc155Filter]);

  // Unique lists for quick filters
  const officesList = Array.from(new Set(workOrders.map(w => w.office)));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-6xl w-full my-6 overflow-hidden flex flex-col text-right">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                البحث المتقدم في جدول أوامر العمل
              </h2>
              <p className="text-xs text-slate-300">
                نتائج البحث تظهر مجدولة مع إمكانية التعديل، الحذف، والتصدير التكييفي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Controls */}
        <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              <input
                type="text"
                autoFocus
                placeholder="ابحث برقم أمر العمل، نوع أمر العمل، المقاول، الاستشاري، المكتب، ملاحظات التنفيذ، أو حالة إجراء 155..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute left-3 top-2.5 text-xs text-slate-400 hover:text-slate-700"
                >
                  مسح
                </button>
              )}
            </div>

            {/* Quick Filter: Office */}
            <div className="w-full md:w-48">
              <select
                value={selectedOfficeFilter}
                onChange={(e) => setSelectedOfficeFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800"
              >
                <option value="all">كافة المكاتب</option>
                {officesList.map(off => (
                  <option key={off} value={off}>{off}</option>
                ))}
              </select>
            </div>

            {/* Quick Filter: Procedure 155 */}
            <div className="w-full md:w-56">
              <select
                value={selectedProc155Filter}
                onChange={(e) => setSelectedProc155Filter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800"
              >
                <option value="all">كافة حالات إجراء 155</option>
                <option value="مؤهل للاستلام (معتمد)">مؤهل للاستلام (معتمد)</option>
                <option value="تم الاستلام وإغلاق 155">تم الاستلام وإغلاق 155</option>
                <option value="بانتظار استيفاء الملاحظات">بانتظار استيفاء الملاحظات</option>
                <option value="قيد التدقيق الفني">قيد التدقيق الفني</option>
                <option value="غير مطابق">غير مطابق</option>
              </select>
            </div>
          </div>

          {/* Results stats & Export Button for Search Results */}
          <div className="flex items-center justify-between mt-3 pt-2 text-xs text-slate-600">
            <div>
              تم العثور على <strong className="text-blue-700 font-bold">{filteredOrders.length}</strong> أمر عمل يطابق معايير البحث
            </div>

            {filteredOrders.length > 0 && (
              <div className="flex items-center gap-2">
                {onDeleteBatch && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmTarget({
                        type: 'batch',
                        title: 'مسح نتائج البحث المفلترة',
                        message: `هل أنت متأكد من مسح وحذف كافة نتائج البحث الحالية (${filteredOrders.length} أمر عمل) نهائياً من قاعدة البيانات والمنظومة؟`
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs transition-colors cursor-pointer"
                    title="مسح جذري لكافة نتائج البحث المفلترة حالياً"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>مسح نتائج البحث ({filteredOrders.length})</span>
                  </button>
                )}

                <UnifiedSectionExportBar
                  orders={filteredOrders}
                  sectionTitle="نتائج_البحث_المتقدم"
                  onOpenExportModal={(ordersToExport, title, openEmail) => {
                    onExportSearchResults(ordersToExport, title, openEmail);
                  }}
                  variant="light"
                />
              </div>
            )}
          </div>
        </div>

        {/* Tabular Search Results Card */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(78vh-160px)]">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">لا توجد نتائج تطابق بحثك</p>
              <p className="text-xs text-slate-500 mt-1">
                جرب البحث بكلمات أخرى أو اختر "كافة المكاتب"
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">المكتب</th>
                    <th className="py-3 px-3">المقاول</th>
                    <th className="py-3 px-3">الاستشاري</th>
                    <th className="py-3 px-3">رقم أمر العمل</th>
                    <th className="py-3 px-3">نوع أمر العمل</th>
                    <th className="py-3 px-3">حالة التنفيذ</th>
                    <th className="py-3 px-3 text-center">تنسيق الصور</th>
                    <th className="py-3 px-3 min-w-[200px]">ملاحظات التنفيذ</th>
                    <th className="py-3 px-3">تعديل المقايسة على النظام</th>
                    <th className="py-3 px-3">إجراء 155</th>
                    <th className="py-3 px-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-bold">
                  {filteredOrders.map((wo, index) => {
                    const notesText = (wo.executionNotes || (wo as any).qualityNotes || '').trim();
                    const isNoteCopied = copiedNoteId === wo.id;

                    return (
                      <tr key={`${wo.id || 'search'}-${index}`} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3 px-3 font-mono font-black text-slate-900">{index + 1}</td>
                        <td className="py-3 px-3 font-black text-slate-900 whitespace-nowrap">
                          {wo.office}
                        </td>
                        <td className="py-3 px-3 text-slate-900 whitespace-nowrap font-black">
                          {wo.contractor}
                        </td>
                        <td className="py-3 px-3 text-slate-900 whitespace-nowrap font-black">
                          {wo.consultant || '-'}
                        </td>
                        <td className="py-3 px-3 font-mono font-black text-blue-700 whitespace-nowrap">
                          {wo.workOrderNumber}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {wo.workOrderCode}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black ${
                            wo.executionStatus === 'جاهز للاستلام 155'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : wo.executionStatus === 'معلق لنواقص'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : wo.executionStatus === 'مرفوض'
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : 'bg-blue-100 text-blue-900 border border-blue-300'
                          }`}>
                            {wo.executionStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 justify-center flex-wrap">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-900 border border-slate-300">
                              {wo.photoCoordination || (wo.photos && wo.photos.length > 0 ? 'مرفق صورة كملاحظة' : 'لا توجد صور مطلوبة')}
                            </span>
                            {wo.photos && wo.photos.length > 0 && (
                              <button
                                onClick={() => onViewPhotos(wo)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-colors text-[10px] font-black"
                                title="مرفق صورة كملاحظة - انقر للمعاينة"
                              >
                                <Camera className="w-3 h-3" />
                                <span>ملاحظة ({wo.photos.length})</span>
                              </button>
                            )}
                          </div>
                        </td>
                        {/* Quality & Execution Notes - Red Card with Bold Red Text and Copy Button */}
                        <td className="py-2.5 px-3 min-w-[200px]">
                          {notesText ? (
                            <div className="bg-red-50/90 border border-red-200 rounded-xl p-2 text-right shadow-2xs">
                              <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-red-200/80">
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-700 bg-red-100/90 px-1.5 py-0.5 rounded border border-red-200">
                                  <AlertCircle className="w-3 h-3 text-red-600 shrink-0" />
                                  <span>ملاحظة</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (navigator.clipboard) {
                                      navigator.clipboard.writeText(notesText);
                                      setCopiedNoteId(wo.id);
                                      setTimeout(() => setCopiedNoteId(null), 2000);
                                    }
                                  }}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer shadow-2xs ${
                                    isNoteCopied
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-white hover:bg-red-100 text-red-700 border border-red-200'
                                  }`}
                                  title="نسخ نص الملاحظة إلى الحافظة"
                                >
                                  {isNoteCopied ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                                  <span>{isNoteCopied ? 'تم النسخ' : 'نسخ'}</span>
                                </button>
                              </div>
                              <p className="text-xs font-black text-red-700 leading-relaxed break-words whitespace-normal select-all">
                                {notesText}
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-bold text-xs italic">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[11px] whitespace-nowrap">
                          <span className={`inline-block px-1.5 py-0.5 rounded font-black ${
                            String(wo.boqModification || '').includes('نعم')
                              ? 'bg-indigo-100 text-indigo-900 font-black border border-indigo-200'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {wo.boqModification}
                          </span>
                          {wo.boqDetails && (
                            <div className="text-[10px] text-purple-950 font-bold mt-0.5">{wo.boqDetails}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black ${
                            wo.procedure155Status === 'مؤهل للاستلام (معتمد)' || wo.procedure155Status === 'تم الاستلام وإغلاق 155'
                              ? 'bg-emerald-500 text-white'
                              : wo.procedure155Status === 'غير مطابق'
                              ? 'bg-rose-600 text-white'
                              : 'bg-amber-500 text-white'
                          }`}>
                            {wo.procedure155Status}
                          </span>
                        </td>

                      {/* Explicit Required Actions in search result card: تعديل - حذف */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              onEdit(wo);
                            }}
                            className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white transition-colors cursor-pointer"
                            title="تحديث الحالة"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteConfirmTarget({
                                type: 'single',
                                id: wo.id,
                                title: 'حذف أمر العمل',
                                message: `هل أنت متأكد من حذف أمر العمل (${wo.workOrderNumber}) للمقاول (${wo.contractor}) نهائياً؟`
                              });
                            }}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
                            title="حذف أمر العمل"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            يتم تحديث ومزامنة النتائج لحظياً لأي تعديل أو حذف
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
          >
            إغلاق نافذة البحث
          </button>
        </div>

      </div>

      {deleteConfirmTarget && (
        <ConfirmDeleteModal
          isOpen={!!deleteConfirmTarget}
          title={deleteConfirmTarget.title}
          message={deleteConfirmTarget.message}
          confirmText="نعم، احذف نهائياً"
          cancelText="تراجع"
          onConfirm={() => {
            if (deleteConfirmTarget.type === 'batch') {
              if (onDeleteBatch) {
                onDeleteBatch(filteredOrders.map(o => o.id));
              }
            } else if (deleteConfirmTarget.type === 'single' && deleteConfirmTarget.id) {
              onDelete(deleteConfirmTarget.id);
            }
            setDeleteConfirmTarget(null);
          }}
          onClose={() => setDeleteConfirmTarget(null)}
        />
      )}
    </div>
  );
};
