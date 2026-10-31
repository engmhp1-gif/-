import React from 'react';
import {
  Plus,
  FileSpreadsheet,
  FileDown,
  Printer,
  Mail,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  BarChart3,
  Building2,
  TableProperties,
  Link2,
  Search,
  SlidersHorizontal,
  Trash2,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Edit3,
  Layers,
  FileText
} from 'lucide-react';
import { WorkOrder, ColumnDefinition, PlatformUser } from '../types';

interface TableActionCardsProps {
  totalOrdersCount: number;
  filteredOrdersCount: number;
  ready155Count: number;
  selectedOrderIdsCount: number;
  crossTableMatchesCount: number;
  isTableDataFilterActive: boolean;
  isCrossTableFilterActive: boolean;
  onToggleCrossTableFilter: () => void;
  onOpenAddModal: () => void;
  onOpenImportModal?: () => void;
  onOpenCompatibleImport?: () => void;
  onOpenEditStatus?: () => void;
  onOpenEditBasicData?: () => void;
  onOpenExportModal?: (openEmail?: boolean) => void;
  onInstantPrint?: () => void;
  onOpenSmartAudit?: () => void;
  onBulkApprove155?: () => void;
  onOpenContractorComparison?: () => void;
  onOpenWeeklyReport?: () => void;
  onOpenTableDataView?: () => void;
  onOpenSearchModal?: () => void;
  onOpenColumnManager?: () => void;
  onOpenDropdownManager?: () => void;
  onDeleteSelectedOrders?: () => void;
  onOpenClearDataModal?: () => void;
  onOpenDataRecovery?: () => void;
  onManualSync?: () => void;
  isManualSyncing?: boolean;
  currentUser?: PlatformUser | null;
}

export const TableActionCards: React.FC<TableActionCardsProps> = ({
  totalOrdersCount,
  filteredOrdersCount,
  ready155Count,
  selectedOrderIdsCount,
  crossTableMatchesCount,
  isTableDataFilterActive,
  isCrossTableFilterActive,
  onToggleCrossTableFilter,
  onOpenAddModal,
  onOpenImportModal,
  onOpenCompatibleImport,
  onOpenEditStatus,
  onOpenEditBasicData,
  onOpenExportModal,
  onInstantPrint,
  onOpenSmartAudit,
  onBulkApprove155,
  onOpenContractorComparison,
  onOpenWeeklyReport,
  onOpenTableDataView,
  onOpenSearchModal,
  onOpenColumnManager,
  onOpenDropdownManager,
  onDeleteSelectedOrders,
  onOpenClearDataModal,
  onOpenDataRecovery,
  onManualSync,
  isManualSyncing,
  currentUser
}) => {
  return (
    <div className="w-full mb-3 select-none font-['Cairo',sans-serif]">
      {/* Cards Grid: 5 Special Themed Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        
        {/* CARD 1: العمليات والإدخال الميداني - Pure Blue */}
        <div className="bg-gradient-to-b from-blue-50/80 to-white rounded-2xl p-2.5 border-2 border-blue-500 shadow-xs hover:shadow-md hover:border-blue-600 transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-blue-100">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs group-hover:scale-110 group-hover:rotate-6 transition-transform">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-blue-950 tracking-tight">العمليات والإدخال</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300">
                {totalOrdersCount} أمر
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {/* إضافة أمر */}
              <button
                type="button"
                onClick={onOpenAddModal}
                className="h-8 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] flex items-center justify-center gap-1 shadow-xs cursor-pointer transition-all active:scale-95"
                title="إضافة أمر عمل جديد وتوليد صف بالجدول"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>إضافة أمر</span>
              </button>

              {/* استيراد Excel */}
              {onOpenImportModal && (
                <button
                  type="button"
                  onClick={onOpenImportModal}
                  className="h-8 px-2 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300 font-bold text-[11px] flex items-center justify-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95"
                  title="استيراد أوامر العمل من ملف إكسل معتمد"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                  <span>استيراد Excel</span>
                </button>
              )}

              {/* تعديل الحالة و 155 */}
              {onOpenEditStatus && (
                <button
                  type="button"
                  onClick={onOpenEditStatus}
                  className="h-8 px-2 rounded-xl bg-white hover:bg-blue-50 text-blue-900 font-bold text-[11px] flex items-center justify-center gap-1 border border-blue-200 cursor-pointer transition-all active:scale-95"
                  title="تعديل حالة أمر العمل وملاحظات 155"
                >
                  <Edit3 className="w-3 h-3 text-blue-600 shrink-0" />
                  <span>تعديل الحالة</span>
                </button>
              )}

              {/* تعديل البيانات الأساسية */}
              {onOpenEditBasicData && (
                <button
                  type="button"
                  onClick={onOpenEditBasicData}
                  className="h-8 px-2 rounded-xl bg-white hover:bg-blue-50 text-blue-900 font-bold text-[11px] flex items-center justify-center gap-1 border border-blue-200 cursor-pointer transition-all active:scale-95"
                  title="تعديل البيانات الأساسية لأمر العمل"
                >
                  <FileText className="w-3 h-3 text-blue-700 shrink-0" />
                  <span>تعديل الأساسية</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CARD 2: التصدير والمشاركات الرسمية - Pure Green */}
        <div className="bg-gradient-to-b from-emerald-50/80 to-white rounded-2xl p-2.5 border-2 border-emerald-500 shadow-xs hover:shadow-md hover:border-emerald-600 transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-emerald-100">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs group-hover:scale-110 group-hover:-rotate-6 transition-transform">
                  <FileDown className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-emerald-950 tracking-tight">التصدير والمشاركات</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                PDF/Excel
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {/* تصدير ومعاينة */}
              {onOpenExportModal && (
                <button
                  type="button"
                  onClick={() => onOpenExportModal(false)}
                  className="col-span-2 h-8 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] flex items-center justify-center gap-1 shadow-xs cursor-pointer transition-all active:scale-95"
                  title="معاينة وتخصيص التقرير الشامل وتصديره لكافة الصيغ (PDF, Excel, PPTX, صورة)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                  <span>تصدير ومعاينة التقرير</span>
                </button>
              )}

              {/* إرسال بالإيميل */}
              {onOpenExportModal && (
                <button
                  type="button"
                  onClick={() => onOpenExportModal(true)}
                  className="h-8 px-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 font-bold text-[11px] flex items-center justify-center gap-1 border border-emerald-200 cursor-pointer transition-all active:scale-95"
                  title="إرسال التصدير عبر البريد الإلكتروني للمستخدمين المسجلين"
                >
                  <Mail className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>إرسال إيميل</span>
                </button>
              )}

              {/* طباعة فورية */}
              <button
                type="button"
                onClick={onInstantPrint || (() => window.print())}
                className="h-8 px-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 font-bold text-[11px] flex items-center justify-center gap-1 border border-emerald-200 cursor-pointer transition-all active:scale-95"
                title="طباعة فورية للجدول"
              >
                <Printer className="w-3 h-3 text-emerald-700 shrink-0" />
                <span>طباعة</span>
              </button>
            </div>
          </div>
        </div>

        {/* CARD 3: حوكمة 155 والتدقيق - Pure Blue */}
        <div className="bg-gradient-to-b from-blue-50/80 to-white rounded-2xl p-2.5 border-2 border-blue-600 shadow-xs hover:shadow-md hover:border-blue-700 transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-blue-100">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-xl bg-blue-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs group-hover:scale-110 group-hover:rotate-6 transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-blue-950 tracking-tight">حوكمة 155 والتدقيق</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300">
                {ready155Count} مؤهل
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {/* اعتماد مؤهل 155 دفعة واحدة */}
              <button
                type="button"
                onClick={onBulkApprove155}
                disabled={selectedOrderIdsCount === 0}
                className="h-8 px-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-black text-[11px] flex items-center justify-center gap-1 shadow-xs cursor-pointer transition-all active:scale-95 disabled:opacity-40"
                title={selectedOrderIdsCount > 0 ? `اعتماد (${selectedOrderIdsCount}) أمر محدد كـ مؤهل 155` : 'حدد أوامر لاعتمادها دفعة واحدة'}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                <span>اعتماد 155 ({selectedOrderIdsCount})</span>
              </button>

              {/* مقارنة المقاولين */}
              {onOpenContractorComparison && (
                <button
                  type="button"
                  onClick={onOpenContractorComparison}
                  className="h-8 px-2 rounded-xl bg-white hover:bg-blue-50 text-blue-900 font-bold text-[11px] flex items-center justify-center gap-1 border border-blue-200 cursor-pointer transition-all active:scale-95"
                  title="تقرير مقارنة إغلاقات ونسب المقاولين"
                >
                  <BarChart3 className="w-3 h-3 text-blue-600 shrink-0" />
                  <span>مقارنة المقاولين</span>
                </button>
              )}

              {/* التقرير الأسبوعي */}
              {onOpenWeeklyReport && (
                <button
                  type="button"
                  onClick={onOpenWeeklyReport}
                  className="h-8 px-2 rounded-xl bg-white hover:bg-blue-50 text-blue-900 font-bold text-[11px] flex items-center justify-center gap-1 border border-blue-200 cursor-pointer transition-all active:scale-95"
                  title="التقرير الأسبوعي الشامل للمكاتب الفرعية"
                >
                  <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
                  <span>تقرير أسبوعي</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CARD 4: بيانات وتوافق الجداول - Pure Green */}
        <div className="bg-gradient-to-b from-emerald-50/80 to-white rounded-2xl p-2.5 border-2 border-emerald-600 shadow-xs hover:shadow-md hover:border-emerald-700 transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-emerald-100">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs group-hover:scale-110 group-hover:-rotate-6 transition-transform">
                  <Link2 className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-emerald-950 tracking-tight">بيانات وتوافق الجداول</span>
              </div>
              {crossTableMatchesCount > 0 ? (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-600 text-white animate-pulse">
                  {crossTableMatchesCount} متوافق
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  ربط وتوافق
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {/* عرض بيانات الجدول */}
              {onOpenTableDataView && (
                <button
                  type="button"
                  onClick={onOpenTableDataView}
                  className={`h-8 px-2 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95 ${
                    isTableDataFilterActive
                      ? 'bg-emerald-800 text-amber-200 ring-2 ring-emerald-400'
                      : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  }`}
                  title="عرض بيانات الجدول: الأسطر المضافة جديدة، المكررة، غير المعدلة، والمعدلة"
                >
                  <TableProperties className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                  <span>بيانات الجدول</span>
                </button>
              )}

              {/* توافق وربط الجداول */}
              <button
                type="button"
                onClick={onToggleCrossTableFilter}
                className={`h-8 px-2 rounded-xl font-black text-[11px] flex items-center justify-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95 ${
                  isCrossTableFilterActive
                    ? 'bg-emerald-900 text-white ring-2 ring-emerald-500 shadow-md'
                    : crossTableMatchesCount > 0
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-200'
                }`}
                title={`توافق الجداول بدلالة (رقم ورمز أمر العمل) • متوفر حالياً (${crossTableMatchesCount}) صف متوافق`}
              >
                <Link2 className="w-3.5 h-3.5 shrink-0" />
                <span>توافق الجداول ({crossTableMatchesCount})</span>
              </button>

              {/* البحث والفلترة */}
              {onOpenSearchModal && (
                <button
                  type="button"
                  onClick={onOpenSearchModal}
                  className="h-8 px-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 font-bold text-[11px] flex items-center justify-center gap-1 border border-emerald-200 cursor-pointer transition-all active:scale-95"
                  title="البحث والفلترة المتقدمة لجميع الحقول"
                >
                  <Search className="w-3 h-3 text-emerald-700 shrink-0" />
                  <span>بحث وفلترة</span>
                </button>
              )}

              {/* إدارة الأعمدة والقوائم */}
              <button
                type="button"
                onClick={onOpenColumnManager || onOpenDropdownManager}
                className="h-8 px-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 font-bold text-[11px] flex items-center justify-center gap-1 border border-emerald-200 cursor-pointer transition-all active:scale-95"
                title="إدارة هيكلة الأعمدة والقوائم المنسدلة"
              >
                <SlidersHorizontal className="w-3 h-3 text-emerald-700 shrink-0" />
                <span>إدارة الأعمدة</span>
              </button>
            </div>
          </div>
        </div>

        {/* CARD 5: إدارة الجدول والأمان السحابي - Pure Blue */}
        <div className="bg-gradient-to-b from-blue-50/80 to-white rounded-2xl p-2.5 border-2 border-blue-700 shadow-xs hover:shadow-md hover:border-blue-800 transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-blue-100">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-xl bg-blue-800 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs group-hover:scale-110 group-hover:rotate-6 transition-transform">
                  <Trash2 className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-blue-950 tracking-tight">إدارة الجدول والأمان</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                سحابي
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {/* حذف المحدد */}
              <button
                type="button"
                onClick={onDeleteSelectedOrders}
                disabled={selectedOrderIdsCount === 0}
                className="h-8 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 disabled:opacity-40"
                title={selectedOrderIdsCount > 0 ? `حذف أوامر العمل المحددة (${selectedOrderIdsCount})` : 'حدد أوامر لحذفها'}
              >
                <Trash2 className="w-3 h-3 text-rose-600 shrink-0" />
                <span>حذف ({selectedOrderIdsCount})</span>
              </button>

              {/* تفريغ / مسح */}
              {onOpenClearDataModal && (
                <button
                  type="button"
                  onClick={onOpenClearDataModal}
                  className="h-8 px-2 rounded-xl bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1 border border-slate-200 cursor-pointer transition-all active:scale-95"
                  title="تفريغ ومسح أوامر العمل للجدول المحدد"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>تفريغ الجدول</span>
                </button>
              )}

              {/* مركز الأمان والنسخ الاحتياطية */}
              {onOpenDataRecovery && (
                <button
                  type="button"
                  onClick={onOpenDataRecovery}
                  className="h-8 px-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow-2xs"
                  title="فتح مركز الأمان السحابي واستعادة النسخ الاحتياطية"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                  <span>مركز الأمان</span>
                </button>
              )}

              {/* مزامنة سحابية فورية */}
              {onManualSync && (
                <button
                  type="button"
                  disabled={isManualSyncing}
                  onClick={onManualSync}
                  className="h-8 px-2 rounded-xl bg-white hover:bg-blue-50 text-blue-900 font-bold text-[11px] flex items-center justify-center gap-1 border border-blue-200 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  title="مزامنة فورية لكافة الجداول والبيانات مع الخادم السحابي"
                >
                  <RefreshCw className={`w-3 h-3 text-blue-600 shrink-0 ${isManualSyncing ? 'animate-spin' : ''}`} />
                  <span>مزامنة فورية</span>
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
