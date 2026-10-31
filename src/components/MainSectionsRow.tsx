import React from 'react';
import {
  BarChart3,
  FolderTree,
  TableProperties,
  Building2,
  Table2,
  ChevronDown,
  X,
  Layers,
  Award,
  FileText
} from 'lucide-react';
import { MonthTable, PlatformUser } from '../types';

export type ActiveSectionCardId = 'kpis' | 'tree' | 'month_tables' | 'office' | 'hub' | null;

interface MainSectionsRowProps {
  activeSectionCard: ActiveSectionCardId;
  onToggleSectionCard: (cardId: ActiveSectionCardId) => void;
  // Stats & Period
  totalOrdersCount: number;
  ready155Count: number;
  readyRate: number;
  activeYear: number;
  activeMonth: number | 'all';
  activeTableName?: string;
  selectedOffice: string;
  offices: Array<{ id: string; name: string }>;
  monthTables: MonthTable[];
  isTableCardOpen: boolean;
  tablePresentationMode: 'docked' | 'overlay';
  onToggleTableCard: () => void;
  onChangeTablePresentationMode: (mode: 'docked' | 'overlay') => void;
  onSelectOffice: (office: string) => void;
  // Quick Actions
  onOpenSmartAudit?: () => void;
  onOpenContractorComparison?: () => void;
  onOpenWeeklyReport?: () => void;
  onOpenOfficeComparison?: () => void;
  onOpenComprehensiveReports?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenAddOrder?: () => void;
  onOpenImportExcel?: () => void;
  onOpenCompatibleImport?: () => void;
  onOpenNotesReport?: (mode?: 'all' | 'recurring_all' | 'recurring_contractor', contractor?: string) => void;
  contractorsList?: string[];
  currentUser?: PlatformUser | null;
}

export const MainSectionsRow: React.FC<MainSectionsRowProps> = ({
  activeSectionCard,
  onToggleSectionCard,
  readyRate,
  activeYear,
  activeMonth,
  selectedOffice,
  offices,
  monthTables,
  isTableCardOpen,
  onToggleTableCard,
  onSelectOffice,
  onOpenContractorComparison,
  onOpenWeeklyReport,
  onOpenOfficeComparison,
  onOpenComprehensiveReports,
  onOpenNotesReport,
}) => {
  const customMonthTablesCount = monthTables.filter(
    t => !t.id.startsWith('default-') && !t.isDefault && t.year === activeYear && (activeMonth === 'all' || t.month === activeMonth)
  ).length;
  const currentMonthTablesCount = customMonthTablesCount + 1;

  return (
    <div className="w-full mb-3 select-none font-['Cairo',sans-serif]">
      <div className="w-full bg-gradient-to-l from-slate-100 via-blue-50/75 to-indigo-50/75 backdrop-blur-md rounded-2xl p-1.5 sm:p-2 border border-slate-300/90 shadow-xs flex items-center justify-between gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap">
          <button
            type="button"
            onClick={() => onToggleSectionCard(activeSectionCard === 'kpis' ? null : 'kpis')}
            className={`h-10 px-2.5 sm:px-3 rounded-xl flex items-center gap-2 transition-all cursor-pointer border whitespace-nowrap active:scale-95 group ${
              activeSectionCard === 'kpis'
                ? 'bg-gradient-to-l from-blue-700 to-indigo-800 text-white border-blue-800 shadow-sm ring-2 ring-blue-400/50'
                : 'bg-gradient-to-l from-slate-50 to-blue-100/60 hover:from-blue-100/80 hover:to-indigo-100/70 text-slate-900 border-blue-300'
            }`}
            title="لوحة مؤشرات الأداء والقياس (KPI Dashboard)"
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
              activeSectionCard === 'kpis' ? 'bg-white/20 text-white' : 'bg-blue-200/80 text-blue-900'
            }`}>
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
            <div className="text-right flex items-center gap-1.5">
              <span className="text-xs font-black">مؤشرات الأداء</span>
              <span className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-md ${
                activeSectionCard === 'kpis' ? 'bg-black/25 text-amber-200' : 'bg-blue-200/80 text-blue-950 border border-blue-300'
              }`}>
                {readyRate}%
              </span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${
              activeSectionCard === 'kpis' ? 'rotate-180 text-white' : 'text-blue-800'
            }`} />
          </button>

          <button
            type="button"
            onClick={() => onToggleSectionCard(activeSectionCard === 'month_tables' ? null : 'month_tables')}
            className={`h-10 px-2.5 sm:px-3 rounded-xl flex items-center gap-2 transition-all cursor-pointer border whitespace-nowrap active:scale-95 group ${
              activeSectionCard === 'month_tables'
                ? 'bg-gradient-to-l from-emerald-700 to-teal-800 text-white border-emerald-800 shadow-sm ring-2 ring-emerald-400/50'
                : 'bg-gradient-to-l from-slate-50 to-emerald-100/60 hover:from-emerald-100/80 hover:to-teal-100/70 text-slate-900 border-emerald-300'
            }`}
            title="قائمة جداول أوامر العمل الميدانية (عرض مبسط ومتزامن في سطرين)"
          >
            <div className={`relative w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
              activeSectionCard === 'month_tables' ? 'bg-white/20 text-white' : 'bg-emerald-600 text-white shadow-2xs'
            }`}>
              <TableProperties className="w-3.5 h-3.5" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-1 ring-white" />
            </div>
            <div className="text-right flex items-center gap-1.5">
              <span className="text-xs font-black">جداول أوامر العمل</span>
              <span className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-md ${
                activeSectionCard === 'month_tables' ? 'bg-black/25 text-emerald-100' : 'bg-emerald-200/80 text-emerald-950 border border-emerald-300'
              }`}>
                {currentMonthTablesCount} جدول
              </span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${
              activeSectionCard === 'month_tables' ? 'rotate-180 text-white' : 'text-emerald-800'
            }`} />
          </button>

          <button
            type="button"
            onClick={() => onToggleSectionCard(activeSectionCard === 'office' ? null : 'office')}
            className={`h-10 px-2.5 sm:px-3 rounded-xl flex items-center gap-2 transition-all cursor-pointer border whitespace-nowrap active:scale-95 group ${
              activeSectionCard === 'office'
                ? 'bg-gradient-to-l from-sky-700 to-blue-800 text-white border-sky-800 shadow-sm ring-2 ring-sky-400/50'
                : 'bg-gradient-to-l from-slate-50 to-sky-100/60 hover:from-sky-100/80 hover:to-blue-100/70 text-slate-900 border-sky-300'
            }`}
            title="تحديد نطاق المكتب الفرعي لتصفية أوامر العمل"
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
              activeSectionCard === 'office' ? 'bg-white/20 text-white' : 'bg-sky-200/80 text-sky-900'
            }`}>
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <div className="text-right flex items-center gap-1.5">
              <span className="text-xs font-black">
                {selectedOffice === 'all' ? 'كافة المكاتب' : selectedOffice}
              </span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${
              activeSectionCard === 'office' ? 'rotate-180 text-white' : 'text-sky-800'
            }`} />
          </button>

          <button
            type="button"
            onClick={() => onToggleSectionCard(activeSectionCard === 'hub' ? null : 'hub')}
            className={`h-10 px-2.5 sm:px-3 rounded-xl flex items-center gap-2 transition-all cursor-pointer border whitespace-nowrap active:scale-95 group ${
              activeSectionCard === 'hub'
                ? 'bg-gradient-to-l from-teal-700 to-emerald-800 text-white border-teal-800 shadow-sm ring-2 ring-teal-400/50'
                : 'bg-gradient-to-l from-slate-50 to-teal-100/60 hover:from-teal-100/80 hover:to-emerald-100/70 text-slate-900 border-teal-300'
            }`}
            title="التقارير الأسبوعية ومقارنة المقاولين والمكاتب"
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
              activeSectionCard === 'hub' ? 'bg-white/20 text-white' : 'bg-teal-200/80 text-teal-900'
            }`}>
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
            <div className="text-right flex items-center gap-1.5">
              <span className="text-xs font-black">الحوكمة والتقارير</span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${
              activeSectionCard === 'hub' ? 'rotate-180 text-white' : 'text-teal-800'
            }`} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleTableCard}
            className={`h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs font-black border transition-all cursor-pointer active:scale-95 ${
              isTableCardOpen
                ? 'bg-gradient-to-l from-emerald-700 to-teal-800 text-white border-emerald-800 shadow-sm ring-2 ring-emerald-400/50'
                : 'bg-gradient-to-l from-slate-50 to-emerald-100/70 hover:from-emerald-100 hover:to-teal-100 text-slate-900 border-emerald-300'
            }`}
            title={isTableCardOpen ? 'طي وإخفاء بطاقة الجدول' : 'عرض وإظهار بطاقة الجدول'}
          >
            <Table2 className={`w-4 h-4 ${isTableCardOpen ? 'text-amber-300' : 'text-emerald-800'}`} />
            <span>{isTableCardOpen ? 'طي الجدول' : 'عرض الجدول'}</span>
          </button>
        </div>
      </div>

      {activeSectionCard === 'office' && (
        <div className="mt-2.5 p-4 bg-white rounded-2xl shadow-xl border border-slate-200/90 animate-in fade-in zoom-in-95 duration-150 text-right">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900">تحديد نطاق المكتب الفرعي</h4>
                <p className="text-[11px] text-slate-500">اختر المكتب الفرعي لتصفية الجدول وعرض الإحصائيات والمؤشرات الخاصة به</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onToggleSectionCard(null)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            <button
              type="button"
              onClick={() => {
                onSelectOffice('all');
                onToggleSectionCard(null);
              }}
              className={`p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                selectedOffice === 'all'
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-400 shadow-md'
                  : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>كافة المكاتب الفرعية</span>
            </button>

            {offices.map((off) => (
              <button
                key={off.id}
                type="button"
                onClick={() => {
                  onSelectOffice(off.name);
                  onToggleSectionCard(null);
                }}
                className={`p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  selectedOffice === off.name
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-400 shadow-md'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
                }`}
              >
                <span className="truncate w-full text-center">{off.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeSectionCard === 'hub' && (
        <div className="mt-2.5 p-4 bg-white rounded-2xl shadow-xl border border-slate-200/90 animate-in fade-in zoom-in-95 duration-150 text-right">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900">مركز الحوكمة والتقارير الرسمية</h4>
                <p className="text-[11px] text-slate-500">المقارنات والتقارير التنفيذية المعتمدة للتحليل والإغلاقات</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onToggleSectionCard(null)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {onOpenComprehensiveReports && (
              <button
                type="button"
                onClick={() => {
                  onToggleSectionCard(null);
                  onOpenComprehensiveReports();
                }}
                className="p-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-500 hover:to-blue-600 border border-indigo-400/50 text-white font-black text-xs flex items-center gap-2.5 cursor-pointer transition-all shadow-sm"
              >
                <BarChart3 className="w-4 h-4 text-amber-300 shrink-0" />
                <div className="font-black text-xs text-white text-right">مركز التقارير الشامل</div>
              </button>
            )}

            {onOpenWeeklyReport && (
              <button
                type="button"
                onClick={() => {
                  onToggleSectionCard(null);
                  onOpenWeeklyReport();
                }}
                className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-900 font-black text-xs flex items-center gap-2.5 cursor-pointer transition-all"
              >
                <Award className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="font-black text-xs text-slate-900 text-right">التقرير الأسبوعي</div>
              </button>
            )}

            {onOpenContractorComparison && (
              <button
                type="button"
                onClick={() => {
                  onToggleSectionCard(null);
                  onOpenContractorComparison();
                }}
                className="p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-900 font-black text-xs flex items-center gap-2.5 cursor-pointer transition-all"
              >
                <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                <div className="font-black text-xs text-slate-900 text-right">مقارنة المقاولين</div>
              </button>
            )}

            {onOpenOfficeComparison && (
              <button
                type="button"
                onClick={() => {
                  onToggleSectionCard(null);
                  onOpenOfficeComparison();
                }}
                className="p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-900 font-black text-xs flex items-center gap-2.5 cursor-pointer transition-all"
              >
                <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="font-black text-xs text-slate-900 text-right">مقارنة المكاتب</div>
              </button>
            )}

            {onOpenNotesReport && (
              <button
                type="button"
                onClick={() => {
                  onToggleSectionCard(null);
                  onOpenNotesReport('all');
                }}
                className="p-3 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-900 font-black text-xs flex items-center gap-2.5 cursor-pointer transition-all"
              >
                <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                <div className="font-black text-xs text-slate-900 text-right">تقرير الملاحظات الشامل</div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
