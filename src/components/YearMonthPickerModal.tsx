import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  CalendarPlus,
  Layers,
  Plus,
  Check,
  X,
  FolderPlus,
  FileSpreadsheet,
  ShieldCheck,
  Sparkles,
  ArrowUpLeft,
  AlertCircle,
  Lock,
  CheckCircle2,
  Table2
} from 'lucide-react';
import { MonthTable, WorkOrder } from '../types';
import {
  ARABIC_MONTHS,
  getArabicMonthName,
  getDefaultTableId,
  resolveOrderScope,
  isTableInPeriod,
  validateAndDisambiguateTableName
} from '../utils/tableScope';

interface YearMonthPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeYear: number;
  activeMonth: number | 'all';
  selectedTableId: string;
  monthTables?: MonthTable[];
  workOrders?: WorkOrder[];
  orders?: WorkOrder[];
  onSelectYearMonthTable: (year: number, month: number | 'all', tableId?: string) => void;
  onCreateTableInPeriod?: (
    name: string,
    description: string,
    color: string,
    year: number,
    month: number
  ) => Promise<MonthTable | void>;
  onCreateTableInYearMonth?: (
    year: number,
    month: number,
    name: string,
    description?: string,
    color?: string
  ) => Promise<MonthTable | void>;
  onOpenImportForPeriod?: (year: number, month: number, tableId?: string) => void;
  onOpenImportForYearMonth?: (year: number, month: number, tableId?: string) => void;
  onOpenAddOrderForYearMonth?: (year: number, month: number, tableId?: string) => void;
}

const TABLE_COLORS = [
  { name: 'blue', label: 'أزرق ملكي', bg: 'bg-blue-600', ring: 'ring-blue-400', badge: 'bg-blue-50 text-blue-800 border-blue-200' },
  { name: 'emerald', label: 'أخضر زمردي', bg: 'bg-emerald-600', ring: 'ring-emerald-400', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { name: 'indigo', label: 'نيلي رسمي', bg: 'bg-indigo-600', ring: 'ring-indigo-400', badge: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  { name: 'purple', label: 'بنفسجي ملكي', bg: 'bg-purple-600', ring: 'ring-purple-400', badge: 'bg-purple-50 text-purple-800 border-purple-200' },
  { name: 'amber', label: 'عنبري دافئ', bg: 'bg-amber-600', ring: 'ring-amber-400', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  { name: 'rose', label: 'وردي ياقوتي', bg: 'bg-rose-600', ring: 'ring-rose-400', badge: 'bg-rose-50 text-rose-800 border-rose-200' },
  { name: 'cyan', label: 'سماوي بحري', bg: 'bg-cyan-600', ring: 'ring-cyan-400', badge: 'bg-cyan-50 text-cyan-800 border-cyan-200' }
];

export const YearMonthPickerModal: React.FC<YearMonthPickerModalProps> = ({
  isOpen,
  onClose,
  activeYear,
  activeMonth,
  selectedTableId,
  monthTables = [],
  workOrders,
  orders,
  onSelectYearMonthTable,
  onCreateTableInPeriod,
  onCreateTableInYearMonth,
  onOpenImportForPeriod,
  onOpenImportForYearMonth
}) => {
  const safeWorkOrders = useMemo<WorkOrder[]>(() => {
    if (Array.isArray(workOrders)) return workOrders;
    if (Array.isArray(orders)) return orders;
    return [];
  }, [workOrders, orders]);

  const safeMonthTables = useMemo<MonthTable[]>(() => {
    return Array.isArray(monthTables) ? monthTables : [];
  }, [monthTables]);

  const handleOpenImport = onOpenImportForPeriod || onOpenImportForYearMonth;

  const defaultNumericMonth = typeof activeMonth === 'number' && activeMonth >= 1 && activeMonth <= 12
    ? activeMonth
    : (new Date().getMonth() + 1);

  const [browsingYear, setBrowsingYear] = useState<number>(activeYear);
  const [targetMonthForNewTable, setTargetMonthForNewTable] = useState<number>(defaultNumericMonth);
  const [customYears, setCustomYears] = useState<number[]>([]);
  const [newYearInput, setNewYearInput] = useState<string>('');
  const [isAddingCustomYear, setIsAddingCustomYear] = useState<boolean>(false);

  // New Table Creator Form inside Modal
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState<boolean>(false);
  const [newTableName, setNewTableName] = useState<string>('');
  const [newTableDesc, setNewTableDesc] = useState<string>('');
  const [newTableColor, setNewTableColor] = useState<string>('emerald');
  const [isSubmittingTable, setIsSubmittingTable] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setBrowsingYear(activeYear);
      const m = typeof activeMonth === 'number' && activeMonth >= 1 && activeMonth <= 12
        ? activeMonth
        : (new Date().getMonth() + 1);
      setTargetMonthForNewTable(m);
    }
  }, [isOpen, activeYear, activeMonth]);

  // Compute all available years (standard range + data years + custom added years)
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>([2024, 2025, 2026, 2027, 2028, 2029, 2030]);
    yearSet.add(activeYear);
    yearSet.add(browsingYear);
    customYears.forEach(y => yearSet.add(y));

    safeMonthTables.forEach(t => {
      if (t && t.year && t.year >= 2000 && t.year <= 2100) {
        yearSet.add(Number(t.year));
      }
    });

    safeWorkOrders.forEach(w => {
      if (!w) return;
      const scope = resolveOrderScope(w, safeMonthTables);
      if (scope.year >= 2000 && scope.year <= 2100) {
        yearSet.add(scope.year);
      }
    });

    return Array.from(yearSet).sort((a, b) => a - b);
  }, [activeYear, browsingYear, customYears, safeMonthTables, safeWorkOrders]);

  // Compute statistics per Year and per Month + Table with strict isolation
  const periodMatrix = useMemo(() => {
    const yearStats: Record<number, { ordersCount: number; tablesCount: number }> = {};
    const monthStats: Record<string, {
      ordersCount: number;
      defaultTableCount: number;
      customTables: { table: MonthTable; count: number }[];
    }> = {};

    availableYears.forEach(y => {
      yearStats[y] = { ordersCount: 0, tablesCount: 0 };
      for (let m = 1; m <= 12; m++) {
        const key = `${y}-${m}`;
        const customInMonth = safeMonthTables
          .filter(t => isTableInPeriod(t, y, m))
          .map(t => ({ table: t, count: 0 }));

        monthStats[key] = {
          ordersCount: 0,
          defaultTableCount: 0,
          customTables: customInMonth
        };
        yearStats[y].tablesCount += customInMonth.length;
      }
    });

    // Count work orders strictly by their resolved scope
    safeWorkOrders.forEach(w => {
      if (!w) return;
      const scope = resolveOrderScope(w, safeMonthTables);
      const key = `${scope.year}-${scope.month}`;
      if (!yearStats[scope.year]) {
        yearStats[scope.year] = { ordersCount: 0, tablesCount: 0 };
      }
      yearStats[scope.year].ordersCount++;

      if (!monthStats[key]) {
        monthStats[key] = {
          ordersCount: 0,
          defaultTableCount: 0,
          customTables: []
        };
      }
      monthStats[key].ordersCount++;

      if (scope.isCustomTable) {
        const found = monthStats[key].customTables.find(ct => ct.table.id === scope.tableId);
        if (found) {
          found.count++;
        } else {
          // Custom table might not be in list yet
          monthStats[key].defaultTableCount++;
        }
      } else {
        monthStats[key].defaultTableCount++;
      }
    });

    // Also count any month where defaultTableCount > 0 as +1 active table for that year
    Object.entries(monthStats).forEach(([key, ms]) => {
      const y = parseInt(key.split('-')[0], 10);
      if (ms.defaultTableCount > 0 && yearStats[y]) {
        yearStats[y].tablesCount += 1;
      }
    });

    return { yearStats, monthStats };
  }, [availableYears, safeMonthTables, safeWorkOrders]);

  // Check duplicate table name in the target (browsingYear, targetMonthForNewTable)
  const nameValidation = useMemo(() => {
    if (!newTableName.trim()) {
      return { isDuplicate: false, cleanName: '', suggestedName: '' };
    }
    return validateAndDisambiguateTableName(
      newTableName,
      browsingYear,
      targetMonthForNewTable,
      safeMonthTables
    );
  }, [newTableName, browsingYear, targetMonthForNewTable, safeMonthTables]);

  if (!isOpen) return null;

  const handleAddCustomYear = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(newYearInput.trim(), 10);
    if (!isNaN(parsed) && parsed >= 2000 && parsed <= 2100) {
      setCustomYears(prev => (prev.includes(parsed) ? prev : [...prev, parsed]));
      setBrowsingYear(parsed);
      setNewYearInput('');
      setIsAddingCustomYear(false);
    }
  };

  const handleOpenCreateForMonth = (monthNum: number) => {
    setTargetMonthForNewTable(monthNum);
    const existingCustomCount = safeMonthTables.filter(t => isTableInPeriod(t, browsingYear, monthNum)).length;
    const mName = getArabicMonthName(monthNum);
    setNewTableName(`جدول ${mName} ${browsingYear} - دفعة ${existingCustomCount + 2}`);
    setNewTableDesc(`جدول مستقل مخصص لشهر ${mName} ${browsingYear}`);
    setIsCreatePanelOpen(true);
  };

  const handleCreateNewTableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) return;
    setIsSubmittingTable(true);
    try {
      const finalName = nameValidation.isDuplicate ? nameValidation.suggestedName : newTableName.trim();
      if (onCreateTableInPeriod) {
        await onCreateTableInPeriod(
          finalName,
          newTableDesc.trim(),
          newTableColor,
          browsingYear,
          targetMonthForNewTable
        );
      } else if (onCreateTableInYearMonth) {
        await onCreateTableInYearMonth(
          browsingYear,
          targetMonthForNewTable,
          finalName,
          newTableDesc.trim(),
          newTableColor
        );
      }
      setNewTableName('');
      setNewTableDesc('');
      setIsCreatePanelOpen(false);
      onClose();
    } finally {
      setIsSubmittingTable(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 text-right font-['Cairo',sans-serif] animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-l from-slate-950 via-indigo-950 to-slate-900 text-white border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-600 to-emerald-500 flex items-center justify-center text-white shadow-lg ring-2 ring-indigo-400/40 shrink-0">
              <CalendarPlus className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-black text-white tracking-tight">
                  مركز تحديد السنة والشهر لإدراج وعرض الجداول المستقلة
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>منع اللبس والتداخل 100%</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                اختر السنة والشهر المحددين لفتح جداولها أو إدراج جداول جديدة بداخلها مع عزل جذري تام بين جداول نفس الشهر والشهور الأخرى
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => {
                const existingCustomCount = safeMonthTables.filter(t => isTableInPeriod(t, browsingYear, targetMonthForNewTable)).length;
                const mName = getArabicMonthName(targetMonthForNewTable);
                if (!newTableName) {
                  setNewTableName(`جدول ${mName} ${browsingYear} - دفعة ${existingCustomCount + 2}`);
                }
                setIsCreatePanelOpen(prev => !prev);
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ إدراج جدول مستقل جديد</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/60">
          
          {/* 1. Active Isolation Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-emerald-950 text-white border border-indigo-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <div className="font-black text-white flex items-center gap-2 flex-wrap">
                  <span>النطاق النشط حالياً:</span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/30 border border-indigo-400/50 text-indigo-200 font-mono">
                    السنة: {activeYear}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/30 border border-emerald-400/50 text-emerald-200">
                    الشهر: {getArabicMonthName(activeMonth)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  كل جدول له معرف فريد مرتبط بالسنة والشهر المحددين بحيث لا يمكن أن تتداخل بيانات جدولين أبداً سواء في نفس الشهر أو في شهور وسنوات مختلفة.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onSelectYearMonthTable(browsingYear, 'all', 'all');
                  onClose();
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeYear === browsingYear && activeMonth === 'all'
                    ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-xs'
                    : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/15'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>عرض شامل لكافة شهور {browsingYear}</span>
              </button>
            </div>
          </div>

          {/* 2. Collapsible/Expandable Direct Table Creation Panel */}
          {isCreatePanelOpen && (
            <div className="p-5 rounded-3xl bg-white border-2 border-indigo-500 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-3 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <FolderPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                      إدراج جدول مستقل جديد مع تحديد السنة والشهر بدقة
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      سيتم إنشاء هذا الجدول وعزله برمجياً داخل السنة والشهر اللذين تحددهما أدناه دون أي تداخل مع الجداول الأخرى
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatePanelOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateNewTableSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Target Year */}
                  <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200">
                    <label className="block text-xs font-black text-indigo-950 mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>1. تحديد السنة المستهدفة *</span>
                    </label>
                    <select
                      value={browsingYear}
                      onChange={(e) => setBrowsingYear(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-indigo-300 text-xs font-black text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    >
                      {availableYears.map(y => (
                        <option key={y} value={y}>
                          سنة {y} م
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Target Month */}
                  <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                    <label className="block text-xs font-black text-emerald-950 mb-1.5 flex items-center gap-1.5">
                      <CalendarPlus className="w-3.5 h-3.5 text-emerald-600" />
                      <span>2. تحديد الشهر المستهدف *</span>
                    </label>
                    <select
                      value={targetMonthForNewTable}
                      onChange={(e) => setTargetMonthForNewTable(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-300 text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    >
                      {ARABIC_MONTHS.map(m => (
                        <option key={m.num} value={m.num}>
                          شهر {m.num} - {m.name} ({browsingYear})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Table Name */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <label className="block text-xs font-black text-slate-900 mb-1.5 flex items-center gap-1.5">
                      <Table2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>3. اسم الجدول المستقل *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      placeholder="مثال: جدول دفعة 2، جدول الطوارئ..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-black text-slate-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Duplicate Name Protection Alert */}
                {nameValidation.isDuplicate && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        يوجد جدول بنفس الاسم داخل <strong>شهر {getArabicMonthName(targetMonthForNewTable)} {browsingYear}</strong>. لمنع اللبس سيتم حفظه باسم مميز تلقائياً: <strong className="underline">{nameValidation.suggestedName}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewTableName(nameValidation.suggestedName)}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                    >
                      اعتماد الاسم المميز
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      وصف أو ملاحظة تعريفية للجدول (اختياري)
                    </label>
                    <input
                      type="text"
                      value={newTableDesc}
                      onChange={(e) => setNewTableDesc(e.target.value)}
                      placeholder="مثال: أوامر العمل المستلمة للنصف الثاني من الشهر..."
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      لون تمييز الجدول:
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {TABLE_COLORS.map(c => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setNewTableColor(c.name)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-all ${
                            newTableColor === c.name
                              ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-400 text-indigo-950'
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className={`w-3 h-3 rounded-full ${c.bg}`} />
                          <span>{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>
                      سيتم إدراج الجدول في: <strong>شهر {getArabicMonthName(targetMonthForNewTable)} ({targetMonthForNewTable}) • سنة {browsingYear}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatePanelOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingTable || !newTableName.trim()}
                      className="px-6 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-500 hover:to-blue-600 shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        إدراج الجدول في {getArabicMonthName(targetMonthForNewTable)} {browsingYear} وفتحه الآن
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* 3. Year Selector Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span>اختر السنة:</span>
                </span>

                {availableYears.map(year => {
                  const yStat = periodMatrix.yearStats[year] || { ordersCount: 0, tablesCount: 0 };
                  const isSelectedYear = browsingYear === year;
                  const isCurrentActiveYear = activeYear === year;

                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => setBrowsingYear(year)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border ${
                        isSelectedYear
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300 scale-[1.03]'
                          : isCurrentActiveYear
                          ? 'bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-mono text-sm">{year}</span>
                      {yStat.ordersCount > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                          isSelectedYear ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {yStat.ordersCount} أمر
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Add Custom Year Button / Input */}
                {!isAddingCustomYear ? (
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomYear(true)}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-dashed border-slate-300 flex items-center gap-1 cursor-pointer"
                    title="إضافة سنة مالية أو تنفيذية جديدة"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>سنة أخرى</span>
                  </button>
                ) : (
                  <form onSubmit={handleAddCustomYear} className="flex items-center gap-1">
                    <input
                      type="number"
                      min={2000}
                      max={2100}
                      value={newYearInput}
                      onChange={(e) => setNewYearInput(e.target.value)}
                      placeholder="2031"
                      className="w-20 px-2.5 py-1.5 rounded-xl border border-indigo-400 text-xs font-mono font-bold text-center focus:outline-hidden"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="p-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomYear(false)}
                      className="p-1.5 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}
              </div>

              <div className="text-xs text-slate-500 font-bold">
                انقر على أي شهر لعرض جداوله المستقلة أو إدراج جدول جديد بداخله:
              </div>
            </div>
          </div>

          {/* 4. 12-Month Interactive Grid for the Browsing Year */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {ARABIC_MONTHS.map(m => {
              const key = `${browsingYear}-${m.num}`;
              const mStat = periodMatrix.monthStats[key] || {
                ordersCount: 0,
                defaultTableCount: 0,
                customTables: []
              };
              const isCurrentActiveMonth = activeYear === browsingYear && activeMonth === m.num;
              const defaultTblId = getDefaultTableId(browsingYear, m.num);
              const totalTablesInMonth = 1 + mStat.customTables.length;

              return (
                <div
                  key={m.num}
                  className={`rounded-2xl border-2 p-3.5 flex flex-col justify-between transition-all ${
                    isCurrentActiveMonth
                      ? 'bg-indigo-50/40 border-indigo-600 shadow-md ring-2 ring-indigo-500/20'
                      : mStat.ordersCount > 0 || mStat.customTables.length > 0
                      ? 'bg-white border-emerald-300/90 hover:border-indigo-400 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Top Header of Month Card */}
                  <div>
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-xl font-mono text-xs font-black flex items-center justify-center ${
                          isCurrentActiveMonth
                            ? 'bg-indigo-600 text-white'
                            : mStat.ordersCount > 0
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {m.shortNum}
                        </span>
                        <div>
                          <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                            <span>شهر {m.name}</span>
                            <span className="text-[11px] font-mono text-slate-500">{browsingYear}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-bold">
                            {totalTablesInMonth} جدول مستقل بالشهر
                          </div>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-black ${
                        mStat.ordersCount > 0
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {mStat.ordersCount} أمر
                      </span>
                    </div>

                    {/* Independent Tables List inside this Month */}
                    <div className="my-2.5 space-y-1.5 max-h-32 overflow-y-auto pr-0.5">
                      {/* 1. Scoped Default Table of this Month */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectYearMonthTable(browsingYear, m.num, defaultTblId);
                          onClose();
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-between transition-all cursor-pointer border ${
                          isCurrentActiveMonth && (selectedTableId === defaultTblId || selectedTableId === 'default')
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-slate-50 hover:bg-indigo-50 text-slate-800 border-slate-200'
                        }`}
                        title={`فتح الجدول الرئيسي لشهر ${m.name} ${browsingYear}`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 opacity-80" />
                          <span className="truncate">الجدول الرئيسي ({m.name})</span>
                        </div>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                          isCurrentActiveMonth && (selectedTableId === defaultTblId || selectedTableId === 'default')
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          {mStat.defaultTableCount}
                        </span>
                      </button>

                      {/* 2. Custom Independent Tables in this Month */}
                      {mStat.customTables.map((ct, idx) => {
                        const isTblSelected = isCurrentActiveMonth && selectedTableId === ct.table.id;
                        const colorObj = TABLE_COLORS.find(c => c.name === ct.table.color) || TABLE_COLORS[0];
                        return (
                          <button
                            key={ct.table.id}
                            type="button"
                            onClick={() => {
                              onSelectYearMonthTable(browsingYear, m.num, ct.table.id);
                              onClose();
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-between transition-all cursor-pointer border ${
                              isTblSelected
                                ? `${colorObj.bg} text-white border-transparent shadow-2xs`
                                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                            }`}
                            title={`فتح الجدول المستقل: ${ct.table.name} (${m.name} ${browsingYear})`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${isTblSelected ? 'bg-white' : colorObj.bg}`} />
                              <span className="text-[10px] font-mono opacity-75">#{idx + 2}</span>
                              <span className="truncate">{ct.table.name}</span>
                            </div>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                              isTblSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {ct.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bottom Actions on Month Card */}
                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        // Select the table that has data or default table of this month
                        const firstPopulatedCustom = mStat.customTables.find(ct => ct.count > 0);
                        const targetTbl = mStat.defaultTableCount > 0 || !firstPopulatedCustom
                          ? defaultTblId
                          : firstPopulatedCustom.table.id;
                        onSelectYearMonthTable(browsingYear, m.num, targetTbl);
                        onClose();
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        isCurrentActiveMonth
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-900 hover:bg-indigo-600 text-white'
                      }`}
                    >
                      <ArrowUpLeft className="w-3.5 h-3.5" />
                      <span>فتح الشهر</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenCreateForMonth(m.num)}
                      className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title={`إدراج جدول مستقل جديد في شهر ${m.name} ${browsingYear}`}
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-600" />
                      <span>جدول جديد</span>
                    </button>

                    {handleOpenImport && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          handleOpenImport(browsingYear, m.num, defaultTblId);
                        }}
                        className="col-span-2 px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 border border-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3 h-3" />
                        <span>استيراد ملف إكسل مباشرة لشهر {m.name} {browsingYear}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-bold">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              تكييف ذكي عالمي: كل جدول داخل كل شهر يعمل كحاوية مستقلة معزولة تماماً عن بقية الجداول والشهور.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
};
