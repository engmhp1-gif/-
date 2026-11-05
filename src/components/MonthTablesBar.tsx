import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  FolderPlus, 
  Layers, 
  X,
  FileSpreadsheet,
  Calendar,
  TableProperties,
  ShieldCheck,
  AlertCircle,
  Lock,
  Sparkles,
  CheckCircle2,
  Check,
  ChevronLeft
} from 'lucide-react';
import { MonthTable, WorkOrder, PlatformUser } from '../types';
import {
  ARABIC_MONTHS,
  getArabicMonthName,
  getDefaultTableId,
  isDefaultTableId,
  resolveOrderScope,
  isTableInPeriod,
  validateAndDisambiguateTableName
} from '../utils/tableScope';
import { hasUserPermission } from '../utils/security';

interface MonthTablesBarProps {
  activeYear: number;
  activeMonth: number | 'all';
  monthTables?: MonthTable[];
  selectedTableId: string; // 'all', 'default-YYYY-M', or custom table id
  onSelectTable: (tableId: string) => void;
  onSelectPeriod?: (year: number, month: number | 'all', tableId?: string) => void;
  onOpenYearMonthPicker?: () => void;
  onOpenImportForTable?: (year: number, month: number, tableId: string) => void;
  onOpenCompatibleImport?: () => void;
  onCreateTable: (name: string, description?: string, color?: string, targetYear?: number, targetMonth?: number) => Promise<any>;
  onUpdateTable: (table: MonthTable) => Promise<void>;
  onDeleteTable: (tableId: string, reassignToTableId?: string) => Promise<void>;
  onClose?: () => void;
  inlineMode?: boolean;
  orders?: WorkOrder[];
  currentUser?: PlatformUser | null;
}

const TABLE_COLORS = [
  { name: 'blue', label: 'أزرق ملكي', bg: 'bg-blue-600', ring: 'ring-blue-400', badge: 'bg-blue-100 text-blue-900 border-blue-200' },
  { name: 'emerald', label: 'أخضر زمردي', bg: 'bg-emerald-600', ring: 'ring-emerald-400', badge: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
  { name: 'indigo', label: 'نيلي رسمي', bg: 'bg-indigo-600', ring: 'ring-indigo-400', badge: 'bg-indigo-100 text-indigo-900 border-indigo-200' },
  { name: 'purple', label: 'بنفسجي ملكي', bg: 'bg-purple-600', ring: 'ring-purple-400', badge: 'bg-purple-100 text-purple-900 border-purple-200' },
  { name: 'amber', label: 'عنبري دافئ', bg: 'bg-amber-600', ring: 'ring-amber-400', badge: 'bg-amber-100 text-amber-900 border-amber-200' },
  { name: 'rose', label: 'وردي ياقوتي', bg: 'bg-rose-600', ring: 'ring-rose-400', badge: 'bg-rose-100 text-rose-900 border-rose-200' },
  { name: 'cyan', label: 'سماوي بحري', bg: 'bg-cyan-600', ring: 'ring-cyan-400', badge: 'bg-cyan-100 text-cyan-900 border-cyan-200' }
];

export const MonthTablesBar: React.FC<MonthTablesBarProps> = ({
  activeYear,
  activeMonth,
  monthTables = [],
  selectedTableId,
  onSelectTable,
  onSelectPeriod,
  onCreateTable,
  onUpdateTable,
  onDeleteTable,
  onClose,
  inlineMode = false,
  orders = [],
  currentUser
}) => {
  const safeMonthTables = useMemo(() => Array.isArray(monthTables) ? monthTables : [], [monthTables]);
  const safeOrders = useMemo(() => Array.isArray(orders) ? orders : [], [orders]);

  const defaultNumericMonth = typeof activeMonth === 'number' && activeMonth >= 1 && activeMonth <= 12
    ? activeMonth
    : (new Date().getMonth() + 1);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableDesc, setNewTableDesc] = useState('');
  const [newTableColor, setNewTableColor] = useState('blue');
  const [newTableYear, setNewTableYear] = useState<number>(activeYear);
  const [newTableMonth, setNewTableMonth] = useState<number>(defaultNumericMonth);

  const [editingTable, setEditingTable] = useState<MonthTable | null>(null);
  const [deleteConfirmTable, setDeleteConfirmTable] = useState<MonthTable | null>(null);

  useEffect(() => {
    setNewTableYear(activeYear);
    if (typeof activeMonth === 'number' && activeMonth >= 1 && activeMonth <= 12) {
      setNewTableMonth(activeMonth);
    }
  }, [activeYear, activeMonth]);

  // Available years for quick switching + counts per year
  const { availableYears, ordersCountByYear, tablesCountByYear } = useMemo(() => {
    const set = new Set<number>([2024, 2025, 2026, 2027, 2028]);
    set.add(activeYear);
    const byYrOrders: Record<number, number> = {};
    const byYrTables: Record<number, number> = {};

    safeMonthTables.forEach(t => {
      if (t && t.year >= 2000 && t.year <= 2100) {
        const y = Number(t.year);
        set.add(y);
        if (!isDefaultTableId(t.id) && !t.isDefault) {
          byYrTables[y] = (byYrTables[y] || 0) + 1;
        }
      }
    });
    safeOrders.forEach(o => {
      if (!o) return;
      const s = resolveOrderScope(o, safeMonthTables);
      if (s.year >= 2000 && s.year <= 2100) {
        set.add(s.year);
        byYrOrders[s.year] = (byYrOrders[s.year] || 0) + 1;
      }
    });

    const sorted = Array.from(set).sort((a, b) => a - b);
    return {
      availableYears: sorted,
      ordersCountByYear: byYrOrders,
      tablesCountByYear: byYrTables
    };
  }, [activeYear, safeMonthTables, safeOrders]);

  // Filter custom tables that belong strictly to the active year & month (excluding default metadata entries)
  const currentMonthTables = useMemo(() => {
    return safeMonthTables.filter(
      t => !isDefaultTableId(t.id) && !t.isDefault && isTableInPeriod(t, activeYear, activeMonth)
    );
  }, [safeMonthTables, activeYear, activeMonth]);

  // Calculate order counts per month in activeYear + order counts per table in (activeYear, activeMonth)
  const { ordersCountByMonth, ordersCountMap, totalOrdersInActivePeriod, defaultTableOrdersCount } = useMemo(() => {
    const byMonth: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) byMonth[m] = 0;

    const tblMap = new Map<string, number>();
    let totalInPeriod = 0;
    let defaultInPeriod = 0;

    safeOrders.forEach(o => {
      if (!o) return;
      const scope = resolveOrderScope(o, safeMonthTables);
      if (scope.year === activeYear) {
        byMonth[scope.month] = (byMonth[scope.month] || 0) + 1;
      }

      const matchesYear = scope.year === activeYear;
      const matchesMonth = activeMonth === 'all' ? true : scope.month === Number(activeMonth);

      if (matchesYear && matchesMonth) {
        totalInPeriod++;
        if (scope.isCustomTable) {
          tblMap.set(scope.tableId, (tblMap.get(scope.tableId) || 0) + 1);
        } else {
          defaultInPeriod++;
          tblMap.set(scope.tableId, (tblMap.get(scope.tableId) || 0) + 1);
          tblMap.set('default', (tblMap.get('default') || 0) + 1);
        }
      }
    });

    return {
      ordersCountByMonth: byMonth,
      ordersCountMap: tblMap,
      totalOrdersInActivePeriod: totalInPeriod,
      defaultTableOrdersCount: totalInPeriod
    };
  }, [safeOrders, safeMonthTables, activeYear, activeMonth]);

  // Validate new table name against existing tables in (newTableYear, newTableMonth)
  const addModalNameValidation = useMemo(() => {
    if (!newTableName.trim()) {
      return { isDuplicate: false, cleanName: '', suggestedName: '' };
    }
    return validateAndDisambiguateTableName(
      newTableName,
      newTableYear,
      newTableMonth,
      safeMonthTables
    );
  }, [newTableName, newTableYear, newTableMonth, safeMonthTables]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) return;
    const finalName = addModalNameValidation.isDuplicate
      ? addModalNameValidation.suggestedName
      : newTableName.trim();

    await onCreateTable(finalName, newTableDesc.trim(), newTableColor, newTableYear, newTableMonth);
    setNewTableName('');
    setNewTableDesc('');
    setIsAddModalOpen(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable || !editingTable.name.trim()) return;
    const targetYr = Number(editingTable.year) || activeYear;
    const targetMo = editingTable.month === 'all' ? defaultNumericMonth : Number(editingTable.month);
    const check = validateAndDisambiguateTableName(
      editingTable.name,
      targetYr,
      targetMo,
      safeMonthTables,
      editingTable.id
    );
    const updatedTbl: MonthTable = {
      ...editingTable,
      year: targetYr,
      month: targetMo,
      name: check.isDuplicate ? check.suggestedName : editingTable.name.trim()
    };
    await onUpdateTable(updatedTbl);
    setEditingTable(null);
  };

  const handleDeleteSubmit = async () => {
    if (!deleteConfirmTable) return;
    await onDeleteTable(deleteConfirmTable.id);
    setDeleteConfirmTable(null);
  };

  const scopedDefaultTableId = getDefaultTableId(activeYear, activeMonth);
  const isDefaultSelected = selectedTableId === 'default' || selectedTableId === scopedDefaultTableId || isDefaultTableId(selectedTableId);

  const monthLabel = activeMonth === 'all' 
    ? `كافة شهور ${activeYear}` 
    : `${getArabicMonthName(activeMonth)} ${activeYear}`;

  return (
    <div
      className={
        inlineMode
          ? 'w-full animate-in fade-in duration-150'
          : 'fixed inset-0 z-[9990] bg-slate-950/55 backdrop-blur-[2px] flex items-start justify-center pt-16 sm:pt-20 px-2 sm:px-4 animate-in fade-in duration-150'
      }
      onClick={() => {
        if (!inlineMode && onClose) onClose();
      }}
    >
      <div
        className={`w-full ${
          inlineMode ? 'max-w-full' : 'max-w-5xl max-h-[85vh]'
        } bg-white rounded-2xl border-2 border-[#004B8D] shadow-2xl text-right overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-3.5 py-2.5 bg-gradient-to-l from-[#002855] via-[#003B73] to-[#004B8D] text-white flex items-center justify-between gap-2 border-b-2 border-[#F58220] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F58220] text-white flex items-center justify-center shadow-xs shrink-0">
              <TableProperties className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black text-white">
                  قائمة جداول التدقيق المتزامنة (السنين ⬅ الشهور ⬅ جداول الشهر)
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-white/15 text-[#FDB813] font-mono text-[10px] font-black">
                  {monthLabel} • {currentMonthTables.length + 1} جدول
                </span>
              </div>
              <p className="text-[10px] text-blue-100 font-bold">
                اختر السنة ثم الشهر ثم الجدول المطلوب عرضه وتدقيقه فوراً وبشكل متزامن
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {hasUserPermission(currentUser, 'manageMonthTables') && (
              <button
                type="button"
                onClick={() => {
                  const targetMo = typeof activeMonth === 'number' && activeMonth >= 1 && activeMonth <= 12
                    ? activeMonth
                    : (new Date().getMonth() + 1);
                  setNewTableYear(activeYear);
                  setNewTableMonth(targetMo);
                  const existingInTarget = safeMonthTables.filter(
                    t => !isDefaultTableId(t.id) && !t.isDefault && isTableInPeriod(t, activeYear, targetMo)
                  ).length;
                  const mName = getArabicMonthName(targetMo);
                  setNewTableName(`جدول ${mName} ${activeYear} - ${existingInTarget + 2}`);
                  setNewTableDesc('');
                  setNewTableColor('blue');
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F58220] hover:bg-[#d96b12] text-white font-black text-[11px] shadow-xs transition-all cursor-pointer active:scale-95"
                title="إنشاء جدول مستقل جديد في السنة والشهر المحددين"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة جدول جديد</span>
              </button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-600 text-white border border-rose-400/40 text-[11px] font-black transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                title="إغلاق"
              >
                <X className="w-3.5 h-3.5" />
                <span>إغلاق</span>
              </button>
            )}
          </div>
        </div>

        {/* Body Content (3-Level Interactive Hierarchy: Years -> Months -> Month Tables) */}
        <div className="p-3 sm:p-4 space-y-3.5 overflow-y-auto">
          
          {/* المستوى الأول (1): أيقونات السنين (Years Strip) */}
          {onSelectPeriod && (
            <div className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-[#004B8D] text-white font-mono text-[10px] font-black flex items-center justify-center">
                    1
                  </span>
                  <Calendar className="w-3.5 h-3.5 text-[#004B8D]" />
                  <span className="text-[11px] font-black text-slate-800">
                    اختر السنة الميلادية:
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-500">
                  السنة النشطة: <strong className="text-[#004B8D] font-mono">{activeYear}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {availableYears.map((yr) => {
                  const isYrActive = activeYear === yr;
                  const yrOrders = ordersCountByYear[yr] || 0;
                  const yrCustomTables = tablesCountByYear[yr] || 0;

                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => onSelectPeriod(yr, activeMonth)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${
                        isYrActive
                          ? 'bg-[#004B8D] text-white border-[#004B8D] shadow-xs ring-2 ring-[#F58220]/40'
                          : yrOrders > 0 || yrCustomTables > 0
                          ? 'bg-white hover:bg-blue-50 text-slate-900 border-blue-200'
                          : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      <Calendar className={`w-3.5 h-3.5 ${isYrActive ? 'text-[#FDB813]' : 'text-[#004B8D]'}`} />
                      <span className="font-mono">{yr}</span>
                      {(yrOrders > 0 || isYrActive) && (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono font-black ${
                            isYrActive ? 'bg-[#F58220] text-white' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {yrOrders} أمر
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* المستوى الثاني (2): شبكة الشهور للسنة المختارة (Months Grid) */}
          {onSelectPeriod && (
            <div className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-[#004B8D] text-white font-mono text-[10px] font-black flex items-center justify-center">
                    2
                  </span>
                  <span className="text-[11px] font-black text-slate-800">
                    اختر الشهر في سنة {activeYear}:
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectPeriod(activeYear, 'all', 'all')}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all cursor-pointer flex items-center gap-1 border ${
                    activeMonth === 'all'
                      ? 'bg-[#002855] text-white border-[#002855] shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  <Layers className="w-3 h-3 text-[#F58220]" />
                  <span>عرض كافة شهور {activeYear}</span>
                </button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                {ARABIC_MONTHS.map((m) => {
                  const isMoActive = activeMonth === m.num;
                  const moOrdersCount = ordersCountByMonth[m.num] || 0;
                  const moCustomTablesCount = safeMonthTables.filter(
                    t => !isDefaultTableId(t.id) && !t.isDefault && isTableInPeriod(t, activeYear, m.num)
                  ).length;
                  const totalMoTables = moCustomTablesCount + 1;
                  const hasActivity = moOrdersCount > 0 || moCustomTablesCount > 0;

                  return (
                    <button
                      key={m.num}
                      type="button"
                      onClick={() => onSelectPeriod(activeYear, m.num)}
                      className={`p-2 rounded-lg text-right transition-all cursor-pointer flex items-center justify-between gap-1 border ${
                        isMoActive
                          ? 'bg-gradient-to-l from-[#003B73] to-[#004B8D] text-white border-[#F58220] shadow-xs ring-1 ring-[#F58220]/40'
                          : hasActivity
                          ? 'bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-950 border-emerald-300'
                          : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200/80'
                      }`}
                    >
                      <div className="min-w-0 leading-tight">
                        <div className="flex items-center gap-1">
                          <span className={`text-[9.5px] font-mono font-bold ${isMoActive ? 'text-[#FDB813]' : 'text-slate-400'}`}>
                            {m.num}.
                          </span>
                          <span className="text-[11px] font-black truncate">{m.name}</span>
                        </div>
                        <span className={`text-[9px] font-bold block mt-0.5 ${isMoActive ? 'text-blue-100' : 'text-slate-500'}`}>
                          {totalMoTables} جدول
                        </span>
                      </div>

                      <span
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-black shrink-0 ${
                          isMoActive
                            ? 'bg-[#F58220] text-white'
                            : moOrdersCount > 0
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {moOrdersCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* المستوى الثالث (3): قائمة جداول الشهر المختار للاختيار منها */}
          <div className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/80 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-[#F58220] text-white font-mono text-[10px] font-black flex items-center justify-center">
                  3
                </span>
                <TableProperties className="w-3.5 h-3.5 text-[#004B8D]" />
                <span className="text-[11px] font-black text-slate-900">
                  جداول ({monthLabel}) المتاحة للاختيار ({currentMonthTables.length + 1} جدول):
                </span>
              </div>

              {currentMonthTables.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectTable('all');
                    if (onClose) onClose();
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all cursor-pointer border ${
                    selectedTableId === 'all'
                      ? 'bg-[#002855] text-white border-[#002855] shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  <Layers className="w-3 h-3 text-[#F58220]" />
                  <span>دمج وعرض كافة جداول الشهر ({totalOrdersInActivePeriod} أمر)</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {/* 1. الجدول الأساسي للشهر */}
              {(() => {
                const defaultHasNewRows = safeOrders.some(
                  o => o.isNew && !o.isEdited && !resolveOrderScope(o, safeMonthTables).isCustomTable && resolveOrderScope(o, safeMonthTables).year === activeYear && (activeMonth === 'all' || resolveOrderScope(o, safeMonthTables).month === Number(activeMonth))
                );
                const defaultMeta = safeMonthTables.find(
                  t => t.id === scopedDefaultTableId || (isDefaultTableId(t.id) && t.year === activeYear && (activeMonth === 'all' || t.month === Number(activeMonth)))
                );
                const defaultDisplayName = defaultMeta?.name || `الجدول الأساسي التجميعي - ${monthLabel}`;
                const isActiveDefault = isDefaultSelected && selectedTableId !== 'all';

                return (
                  <div
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isActiveDefault
                        ? 'bg-gradient-to-l from-emerald-700 to-teal-700 text-white border-emerald-500 shadow-sm ring-2 ring-emerald-400/50'
                        : 'bg-white hover:bg-emerald-50/60 text-slate-900 border-emerald-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectTable(scopedDefaultTableId);
                        if (onClose) onClose();
                      }}
                      className="flex items-center gap-2 text-right flex-1 min-w-0 cursor-pointer"
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isActiveDefault ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isActiveDefault ? <Check className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          {defaultHasNewRows && <Sparkles className="w-3 h-3 text-amber-300 animate-pulse shrink-0" />}
                          <span className="text-xs font-black block truncate">{defaultDisplayName}</span>
                        </div>
                        <span className={`text-[10px] font-bold block ${isActiveDefault ? 'text-emerald-100' : 'text-slate-500'}`}>
                          {defaultTableOrdersCount} أمر عمل • الجدول التجميعي لكافة الأوامر
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0 mr-1">
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black ${
                          isActiveDefault ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {defaultTableOrdersCount}
                      </span>

                      {(hasUserPermission(currentUser, 'manageMonthTables') || hasUserPermission(currentUser, 'deleteMonthTable')) && (
                        <div className="flex items-center gap-0.5">
                          {hasUserPermission(currentUser, 'manageMonthTables') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTable({
                                  id: scopedDefaultTableId,
                                  name: defaultDisplayName,
                                  year: activeYear,
                                  month: activeMonth === 'all' ? defaultNumericMonth : activeMonth,
                                  color: 'emerald',
                                  description: 'الجدول الرئيسي للشهر',
                                  createdAt: new Date().toISOString()
                                });
                              }}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                isActiveDefault ? 'hover:bg-white/20 text-white/90' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                              }`}
                              title="تعديل اسم الجدول"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {hasUserPermission(currentUser, 'deleteMonthTable') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmTable({
                                  id: scopedDefaultTableId,
                                  name: defaultDisplayName,
                                  year: activeYear,
                                  month: activeMonth === 'all' ? defaultNumericMonth : activeMonth,
                                  color: 'emerald',
                                  createdAt: new Date().toISOString()
                                });
                              }}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                isActiveDefault ? 'hover:bg-white/20 text-white/90' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              }`}
                              title="حذف هذا الجدول"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 2. الجداول المستقلة الإضافية للشهر */}
              {currentMonthTables.map((tbl) => {
                const isSelected = selectedTableId === tbl.id;
                const count = ordersCountMap.get(tbl.id) || 0;
                const colorObj = TABLE_COLORS.find(c => c.name === tbl.color) || TABLE_COLORS[0];
                const tblHasNewRows = safeOrders.some(
                  o => o.isNew && !o.isEdited && resolveOrderScope(o, safeMonthTables).tableId === tbl.id
                );
                const isTblNew = Boolean(tbl.isNew || tblHasNewRows);

                return (
                  <div
                    key={tbl.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? `${colorObj.bg} text-white border-transparent shadow-sm ring-2 ${colorObj.ring}`
                        : 'bg-white hover:bg-blue-50/50 text-slate-900 border-slate-200 hover:border-[#004B8D]/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectTable(tbl.id);
                        if (onClose) onClose();
                      }}
                      className="flex items-center gap-2 text-right flex-1 min-w-0 cursor-pointer"
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : `${colorObj.bg} text-white`
                        }`}
                      >
                        {isSelected ? <Check className="w-4 h-4" /> : <TableProperties className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          {isTblNew && <Sparkles className="w-3 h-3 text-amber-300 animate-pulse shrink-0" />}
                          <span className="text-xs font-black block truncate">{tbl.name}</span>
                        </div>
                        <span className={`text-[10px] font-bold block truncate ${isSelected ? 'text-white/85' : 'text-slate-500'}`}>
                          {tbl.description || `${getArabicMonthName(tbl.month)} ${tbl.year}`} • {count} أمر
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0 mr-1">
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black ${
                          isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {count}
                      </span>

                      {(hasUserPermission(currentUser, 'manageMonthTables') || hasUserPermission(currentUser, 'deleteMonthTable')) && (
                        <div className="flex items-center gap-0.5">
                          {hasUserPermission(currentUser, 'manageMonthTables') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTable(tbl);
                              }}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                isSelected ? 'hover:bg-white/20 text-white/90' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                              }`}
                              title="تعديل الجدول"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {hasUserPermission(currentUser, 'deleteMonthTable') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmTable(tbl);
                              }}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                isSelected ? 'hover:bg-white/20 text-white/90' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              }`}
                              title="حذف الجدول"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Modal: Add New Independent Table with Explicit Target Year & Target Month */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 text-right">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <FolderPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900">
                      إدراج جدول مستقل جديد مع تحديد السنة والشهر
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      يتم عزل الجدول برمجياً في السنة والشهر المحددين لمنع أي لبس أو تداخل مطلقاً
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-gradient-to-l from-indigo-50 via-blue-50/60 to-emerald-50 border border-indigo-200/80 space-y-2.5">
                  <div className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>تحديد السنة والشهر المخصص لإدراج هذا الجدول:</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        السنة المستهدفة *
                      </label>
                      <select
                        value={newTableYear}
                        onChange={(e) => setNewTableYear(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs font-black bg-white border border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      >
                        {availableYears.map(y => (
                          <option key={y} value={y}>
                            سنة {y} م
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        الشهر المستهدف *
                      </label>
                      <select
                        value={newTableMonth}
                        onChange={(e) => setNewTableMonth(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs font-black bg-white border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                      >
                        {ARABIC_MONTHS.map(m => (
                          <option key={m.num} value={m.num}>
                            شهر {m.num} - {m.name} ({newTableYear})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم الجدول المستقل *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="مثال: جدول مشاريع الطوارئ، دفعة رقم 2، جدول الإنارة..."
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 font-black"
                  />
                </div>

                {addModalNameValidation.isDuplicate && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      يوجد جدول بنفس الاسم في شهر {getArabicMonthName(newTableMonth)} {newTableYear}؛ لمنع التشابه واللبس سيُحفظ باسم: <strong>{addModalNameValidation.suggestedName}</strong>
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    وصف مختصر (اختياري)
                  </label>
                  <input
                    type="text"
                    value={newTableDesc}
                    onChange={(e) => setNewTableDesc(e.target.value)}
                    placeholder="مثال: أوامر العمل المستلمة بعد تاريخ 15..."
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    تمييز لون الجدول
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {TABLE_COLORS.map(c => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setNewTableColor(c.name)}
                        className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                          newTableColor === c.name 
                            ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-400' 
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full ${c.bg} shrink-0`} />
                        <span className="truncate">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>الوجهة: شهر {getArabicMonthName(newTableMonth)} {newTableYear}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-[#004B8D] hover:bg-[#003B73] shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>إدراج الجدول الآن</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Table */}
        {editingTable && (
          <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 text-right">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <h4 className="text-base font-black text-slate-900">
                  تعديل بيانات الجدول أو تغيير سنته وشهره
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      السنة المخصصة للجدول *
                    </label>
                    <select
                      value={editingTable.year}
                      onChange={(e) => setEditingTable({ ...editingTable, year: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-xs font-black bg-white border border-slate-300 rounded-xl"
                    >
                      {availableYears.map(y => (
                        <option key={y} value={y}>
                          سنة {y} م
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      الشهر المخصص للجدول *
                    </label>
                    <select
                      value={editingTable.month === 'all' ? defaultNumericMonth : Number(editingTable.month)}
                      onChange={(e) => setEditingTable({ ...editingTable, month: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-xs font-black bg-white border border-slate-300 rounded-xl"
                    >
                      {ARABIC_MONTHS.map(m => (
                        <option key={m.num} value={m.num}>
                          شهر {m.num} - {m.name} ({editingTable.year})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم الجدول *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingTable.name}
                    onChange={(e) => setEditingTable({ ...editingTable, name: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الوصف
                  </label>
                  <input
                    type="text"
                    value={editingTable.description || ''}
                    onChange={(e) => setEditingTable({ ...editingTable, description: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    اللون
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {TABLE_COLORS.map(c => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setEditingTable({ ...editingTable, color: c.name })}
                        className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                          editingTable.color === c.name 
                            ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-400' 
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full ${c.bg} shrink-0`} />
                        <span className="truncate">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingTable(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#004B8D] hover:bg-[#003B73] shadow-sm cursor-pointer"
                  >
                    حفظ التعديلات ومزامنة الأوامر
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Delete Table Confirmation */}
        {deleteConfirmTable && (
          <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 text-right">
              <div className="flex items-center gap-3 text-rose-600 mb-3">
                <div className="p-2 bg-rose-100 rounded-xl">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h4 className="text-base font-black text-slate-900">
                  حذف الجدول ({deleteConfirmTable.name})
                </h4>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-5">
                أنت على وشك حذف هذا الجدول ({deleteConfirmTable.name}). يحتوي الجدول حالياً على{' '}
                <strong className="text-slate-900 font-mono font-black">
                  {ordersCountMap.get(deleteConfirmTable.id) || (isDefaultTableId(deleteConfirmTable.id) ? defaultTableOrdersCount : 0)}
                </strong>{' '}
                أمر عمل. سيتم حذف هذا الجدول وسجلاته بشكل مستقل وتام دون ترحيل أوامره إلى أي جدول آخر ودون التأثير على أي جداول أخرى بالمنصة.
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTable(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSubmit}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm cursor-pointer"
                >
                  تأكيد حذف الجدول
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
