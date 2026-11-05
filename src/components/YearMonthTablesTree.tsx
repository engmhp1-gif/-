import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  ChevronDown, 
  ChevronLeft, 
  Folder, 
  FolderOpen, 
  Table2, 
  Plus, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Eye, 
  Maximize2,
  CalendarPlus,
  Search,
  Filter,
  Check
} from 'lucide-react';
import { MonthTable, WorkOrder, PlatformUser } from '../types';
import { 
  ARABIC_MONTHS, 
  getArabicMonthName, 
  getDefaultTableId, 
  isDefaultTableId,
  resolveOrderScope
} from '../utils/tableScope';

interface YearMonthTablesTreeProps {
  activeYear: number;
  activeMonth: number | 'all';
  selectedTableId: string;
  monthTables: MonthTable[];
  orders: WorkOrder[];
  onSelectTable: (year: number, month: number | 'all', tableId: string) => void;
  onOpenCreateTableModal?: (year: number, month: number) => void;
  onOpenYearMonthPicker?: () => void;
  currentUser?: PlatformUser | null;
}

export const YearMonthTablesTree: React.FC<YearMonthTablesTreeProps> = ({
  activeYear,
  activeMonth,
  selectedTableId,
  monthTables = [],
  orders = [],
  onSelectTable,
  onOpenCreateTableModal,
  onOpenYearMonthPicker,
  currentUser
}) => {
  // Available Years
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([2024, 2025, 2026, 2027]);
    const currYear = new Date().getFullYear();
    yearsSet.add(currYear);
    yearsSet.add(activeYear);
    monthTables.forEach(t => {
      if (t.year >= 2000 && t.year <= 2100) yearsSet.add(Number(t.year));
    });
    orders.forEach(o => {
      const scope = resolveOrderScope(o, monthTables);
      if (scope.year >= 2000 && scope.year <= 2100) yearsSet.add(scope.year);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [monthTables, orders, activeYear]);

  // Collapsed state for years (default activeYear is open)
  const [expandedYears, setExpandedYears] = useState<Set<number>>(() => new Set([activeYear]));

  // Collapsed state for months: string key `${year}-${month}`
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    const activeM = activeMonth === 'all' ? new Date().getMonth() + 1 : activeMonth;
    return new Set([`${activeYear}-${activeM}`]);
  });

  const [searchTerm, setSearchTerm] = useState('');

  // Toggle year collapse
  const toggleYear = (y: number) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(y)) next.delete(y);
      else next.add(y);
      return next;
    });
  };

  // Toggle month collapse
  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedYears(new Set(availableYears));
    const allMonths = new Set<string>();
    availableYears.forEach(y => {
      for (let m = 1; m <= 12; m++) {
        allMonths.add(`${y}-${m}`);
      }
    });
    setExpandedMonths(allMonths);
  };

  const collapseAll = () => {
    setExpandedYears(new Set());
    setExpandedMonths(new Set());
  };

  // Calculate order counts per table
  const tableCountsMap = useMemo(() => {
    const map = new Map<string, { total: number; ready: number }>();
    for (const order of orders) {
      const scope = resolveOrderScope(order, monthTables);
      const isReady = String(order.procedure155Status || '').includes('مؤهل') || 
                      String(order.procedure155Status || '').includes('معتمد') || 
                      String(order.procedure155Status || '').includes('تم');
      const curr = map.get(scope.tableId) || { total: 0, ready: 0 };
      curr.total += 1;
      if (isReady) curr.ready += 1;
      map.set(scope.tableId, curr);
    }
    return map;
  }, [orders, monthTables]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden mb-4 text-right font-['Cairo',sans-serif]">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-700 text-white flex items-center justify-center font-bold shadow-md ring-2 ring-indigo-400/30 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
                مستكشف الجداول الزمنية والميدانية (قوائم منسدلة للسنين والشهور)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/40">
                تنظيم منسق بقوائم منسدلة
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              اختر أي جدول لاستعراضه في بطاقة مستقلة مدمجة أو بنافذة منبثقة طافية فوق الشاشة
            </p>
          </div>
        </div>

        {/* Header Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث باسم الجدول أو الشهر..."
              className="w-48 sm:w-56 h-8 px-2.5 pr-8 rounded-xl bg-slate-800/90 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
          </div>

          <button
            type="button"
            onClick={expandAll}
            className="h-8 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
          >
            توسيع الكل
          </button>

          <button
            type="button"
            onClick={collapseAll}
            className="h-8 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
          >
            طي الكل
          </button>

          {onOpenYearMonthPicker && (
            <button
              type="button"
              onClick={onOpenYearMonthPicker}
              className="h-8 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-amber-300" />
              <span>إدراج جدول جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Accordion Tree View: Years -> Months -> Tables */}
      <div className="p-3 sm:p-5 space-y-2.5 bg-slate-50/60 max-h-[500px] overflow-y-auto">
        {availableYears.map(year => {
          const isYearExpanded = expandedYears.has(year);
          const yearOrdersCount = orders.filter(o => resolveOrderScope(o, monthTables).year === year).length;

          return (
            <div 
              key={year}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all duration-200 hover:border-slate-300"
            >
              {/* Year Accordion Header */}
              <div
                onClick={() => toggleYear(year)}
                role="button"
                tabIndex={0}
                className={`p-3 sm:px-4 flex items-center justify-between cursor-pointer transition-colors select-none ${
                  isYearExpanded ? 'bg-slate-900 text-white' : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                    isYearExpanded ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 shadow-2xs border border-slate-200'
                  }`}>
                    {isYearExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black tracking-tight">سنة {year}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isYearExpanded ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {yearOrdersCount} أمر عمل
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold ${isYearExpanded ? 'text-indigo-300' : 'text-slate-500'}`}>
                    {isYearExpanded ? 'انقر للطي' : 'انقر لإظهار الشهور والجداول'}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isYearExpanded ? 'rotate-180 text-indigo-400' : 'text-slate-500'}`} />
                </div>
              </div>

              {/* Year Collapsible Content (List of Months) */}
              {isYearExpanded && (
                <div className="p-2 sm:p-3 space-y-2 bg-slate-50 border-t border-slate-200">
                  {ARABIC_MONTHS.map(monthItem => {
                    const monthKey = `${year}-${monthItem.num}`;
                    const isMonthExpanded = expandedMonths.has(monthKey);

                    // Filter tables in this month
                    const customTables = monthTables.filter(t => t.year === year && (t.month === monthItem.num || t.month === 'all'));
                    const monthOrdersList = orders.filter(o => {
                      const scope = resolveOrderScope(o, monthTables);
                      return scope.year === year && scope.month === monthItem.num;
                    });
                    const monthTotalOrders = monthOrdersList.length;
                    const monthReady155Orders = monthOrdersList.filter(o => {
                      const s = String(o.procedure155Status || '');
                      return !s.includes('غير') && (s.includes('مؤهل') || s.includes('معتمد') || s.includes('تم'));
                    }).length;

                    // Search filter check
                    if (searchTerm) {
                      const term = searchTerm.toLowerCase();
                      const matchMonth = monthItem.name.toLowerCase().includes(term);
                      const matchTable = customTables.some(t => t.name.toLowerCase().includes(term));
                      if (!matchMonth && !matchTable) return null;
                    }

                    const isCurrentActiveMonth = activeYear === year && (activeMonth === monthItem.num || activeMonth === 'all');

                    return (
                      <div 
                        key={monthKey}
                        className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden"
                      >
                        {/* Month Accordion Trigger */}
                        <div
                          onClick={() => toggleMonth(monthKey)}
                          role="button"
                          tabIndex={0}
                          className={`p-2.5 sm:px-3 flex items-center justify-between cursor-pointer transition-colors select-none ${
                            isMonthExpanded ? 'bg-indigo-50/80 text-indigo-950 border-b border-indigo-100' : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            <span className="text-xs font-black">
                              شهر {monthItem.name} ({monthItem.shortNum})
                            </span>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {monthTotalOrders} أمر
                            </span>
                            {customTables.length > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200">
                                {customTables.length + 1} جداول
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isCurrentActiveMonth && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                الشهر المختار حالياً
                              </span>
                            )}
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isMonthExpanded ? 'rotate-180 text-indigo-600' : ''}`} />
                          </div>
                        </div>

                        {/* Month Collapsible Tables List */}
                        {isMonthExpanded && (
                          <div className="p-2 sm:p-2.5 space-y-1.5 bg-slate-50/80">
                            
                            {/* 1. Default Month Table */}
                            {(() => {
                              const defaultTableId = getDefaultTableId(year, monthItem.num);
                              const isTableSelected = activeYear === year && (activeMonth === monthItem.num || activeMonth === 'all') && (isDefaultTableId(selectedTableId) || selectedTableId === defaultTableId);
                              return (
                                <div className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                                  isTableSelected
                                    ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-400/40 shadow-xs'
                                    : 'bg-white hover:bg-slate-50 border-slate-200'
                                }`}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                      isTableSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      <Table2 className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="truncate">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-black text-slate-900 truncate">
                                          الجدول التجميعي الشامل ({monthItem.name} {year})
                                        </span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                                          تجميعي شامل
                                        </span>
                                        {isTableSelected && (
                                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-600 text-white animate-pulse">
                                            معروض حالياً
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-500 font-medium">
                                        {monthTotalOrders} أمر عمل • {monthReady155Orders} مؤهل 155 • شامل لكافة الأوامر
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => onSelectTable(year, monthItem.num, getDefaultTableId(year, monthItem.num))}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                                      isTableSelected
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700'
                                    }`}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{isTableSelected ? 'معروض' : 'فتح الجدول'}</span>
                                  </button>
                                </div>
                              );
                            })()}

                            {/* 2. Custom Tables in this Month */}
                            {customTables.map(tbl => {
                              const tblCounts = tableCountsMap.get(tbl.id) || { total: 0, ready: 0 };
                              const isTableSelected = activeYear === year && selectedTableId === tbl.id;

                              return (
                                <div 
                                  key={tbl.id}
                                  className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                                    isTableSelected
                                      ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-400/40 shadow-xs'
                                      : 'bg-white hover:bg-slate-50 border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                      <Table2 className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="truncate">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-black text-slate-900 truncate">
                                          {tbl.name}
                                        </span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800">
                                          جدول مخصص
                                        </span>
                                        {isTableSelected && (
                                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-600 text-white animate-pulse">
                                            معروض حالياً
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-500 font-medium">
                                        {tblCounts.total} أمر عمل • {tblCounts.ready} مؤهل 155
                                        {tbl.description && ` • ${tbl.description}`}
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => onSelectTable(year, monthItem.num, tbl.id)}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                                      isTableSelected
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700'
                                    }`}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{isTableSelected ? 'معروض' : 'فتح الجدول'}</span>
                                  </button>
                                </div>
                              );
                            })}

                            {/* Add table button for this specific month */}
                            {onOpenCreateTableModal && (
                              <button
                                type="button"
                                onClick={() => onOpenCreateTableModal(year, monthItem.num)}
                                className="w-full py-1.5 rounded-xl border border-dashed border-indigo-300 hover:border-indigo-500 bg-white hover:bg-indigo-50/50 text-indigo-700 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ إضافة جدول مستقل لشهر {monthItem.name} {year}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
