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
  CheckCircle2
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

  // Available years for quick switching
  const availableYears = useMemo(() => {
    const set = new Set<number>([2024, 2025, 2026, 2027, 2028]);
    set.add(activeYear);
    safeMonthTables.forEach(t => {
      if (t && t.year >= 2000 && t.year <= 2100) set.add(Number(t.year));
    });
    safeOrders.forEach(o => {
      if (!o) return;
      const s = resolveOrderScope(o, safeMonthTables);
      if (s.year >= 2000 && s.year <= 2100) set.add(s.year);
    });
    return Array.from(set).sort((a, b) => a - b);
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
      defaultTableOrdersCount: defaultInPeriod
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
    <div className="bg-white rounded-2xl border border-slate-200/95 p-2.5 sm:p-3 shadow-md text-right space-y-2 animate-in fade-in zoom-in-95 duration-150">
      
      {/* السطر الأول (Line 1): أيقونة مميزة ومختصرة + اختيار السنة والشهور + زر إنشاء جدول جديد + إغلاق */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Distinctive Concise Synchronized Icon Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-l from-emerald-700 to-teal-700 text-white shadow-2xs shrink-0"
            title="قائمة جداول أوامر العمل الميدانية المتزامنة"
          >
            <div className="relative flex items-center justify-center">
              <TableProperties className="w-3.5 h-3.5 text-amber-300" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
            </div>
            <span className="text-[11px] font-black tracking-tight">الجداول</span>
            <span className="px-1.5 py-0.2 rounded-md bg-black/25 text-amber-200 font-mono text-[10px] font-black">
              {currentMonthTables.length + 1}
            </span>
          </div>

          {/* Compact Year Selector */}
          {onSelectPeriod && (
            <div className="flex items-center gap-1 bg-indigo-50/90 border border-indigo-200/90 rounded-xl px-2 py-1 shrink-0">
              <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
              <select
                value={activeYear}
                onChange={(e) => {
                  const yr = Number(e.target.value);
                  onSelectPeriod(yr, activeMonth);
                }}
                className="bg-transparent text-indigo-950 font-mono font-black text-[11px] cursor-pointer focus:outline-hidden"
                title="تغيير السنة"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Compact 12-Month Strip in the same Line 1 */}
        {onSelectPeriod && (
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1">
            {ARABIC_MONTHS.map(m => {
              const isMoActive = activeMonth === m.num;
              const moOrdersCount = ordersCountByMonth[m.num] || 0;
              const moCustomTablesCount = safeMonthTables.filter(
                t => !isDefaultTableId(t.id) && !t.isDefault && isTableInPeriod(t, activeYear, m.num)
              ).length;
              const hasActivity = moOrdersCount > 0 || moCustomTablesCount > 0;

              return (
                <button
                  key={m.num}
                  type="button"
                  onClick={() => {
                    onSelectPeriod(activeYear, m.num);
                  }}
                  className={`px-2 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 border ${
                    isMoActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-black'
                      : hasActivity
                      ? 'bg-emerald-50/90 hover:bg-emerald-100 text-emerald-950 border-emerald-300 font-black'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/80'
                  }`}
                  title={`شهر ${m.num} (${m.name} ${activeYear}) • ${moOrdersCount} أمر عمل • ${moCustomTablesCount + 1} جدول`}
                >
                  <span>{m.name}</span>
                  {(moOrdersCount > 0 || isMoActive) && (
                    <span className={`px-1 rounded text-[9px] font-mono font-black ${
                      isMoActive ? 'bg-white/25 text-white' : 'bg-emerald-600 text-white'
                    }`}>
                      {moOrdersCount}
                    </span>
                  )}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => onSelectPeriod(activeYear, 'all', 'all')}
              className={`px-2 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 border ${
                activeMonth === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
              title={`عرض كافة شهور ${activeYear}`}
            >
              <span>الكل</span>
            </button>
          </div>
        )}

        {/* Compact Add Table Button & Close Button */}
        <div className="flex items-center gap-1 shrink-0">
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
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] shadow-2xs transition-all cursor-pointer shrink-0 active:scale-95"
              title="إنشاء جدول مستقل جديد"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>جدول جديد</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="إغلاق القائمة"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* السطر الثاني (Line 2): بطاقات الجداول المتزامنة للشهر النشط بأيقونة مميزة ومختصرة */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-0.5">
        {/* Tab 1: Scoped Main Default Table */}
        {(() => {
          const defaultHasNewRows = safeOrders.some(
            o => o.isNew && !o.isEdited && !resolveOrderScope(o, safeMonthTables).isCustomTable && resolveOrderScope(o, safeMonthTables).year === activeYear && (activeMonth === 'all' || resolveOrderScope(o, safeMonthTables).month === Number(activeMonth))
          );
          const defaultMeta = safeMonthTables.find(
            t => t.id === scopedDefaultTableId || (isDefaultTableId(t.id) && t.year === activeYear && (activeMonth === 'all' || t.month === Number(activeMonth)))
          );
          const defaultDisplayName = defaultMeta?.name || `الجدول الأساسي - ${monthLabel}`;

          return (
            <div
              className={`flex items-center rounded-xl border transition-all shrink-0 ${
                isDefaultSelected && selectedTableId !== 'all'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs ring-2 ring-emerald-300/70'
                  : 'bg-slate-50/90 hover:bg-emerald-50/70 text-emerald-950 border-emerald-300'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectTable(scopedDefaultTableId)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-black cursor-pointer"
                title={`${defaultDisplayName} (${monthLabel})`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                {defaultHasNewRows && (
                  <Sparkles className="w-3 h-3 text-amber-300 animate-pulse shrink-0" />
                )}
                <span className="truncate max-w-[170px]">{defaultDisplayName}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-mono font-black ${
                  isDefaultSelected && selectedTableId !== 'all' ? 'bg-white/25 text-white' : 'bg-emerald-200/80 text-emerald-950'
                }`}>
                  {totalOrdersInActivePeriod}
                </span>
              </button>

              {(hasUserPermission(currentUser, 'manageMonthTables') || hasUserPermission(currentUser, 'deleteMonthTable')) && (
                <div className="flex items-center pl-1 gap-0.5 border-r border-emerald-300/40 pr-1">
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
                      className={`p-0.5 rounded transition-colors cursor-pointer ${
                        isDefaultSelected && selectedTableId !== 'all' ? 'hover:bg-white/20 text-white/90' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/60'
                      }`}
                      title="تعديل اسم الجدول"
                    >
                      <Edit3 className="w-3 h-3" />
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
                      className={`p-0.5 rounded transition-colors cursor-pointer ${
                        isDefaultSelected && selectedTableId !== 'all' ? 'hover:bg-white/20 text-white/90' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                      }`}
                      title="حذف هذا الجدول"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Dynamic Independent Month Tables */}
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
              className={`flex items-center rounded-xl border transition-all shrink-0 ${
                isSelected
                  ? `${colorObj.bg} text-white border-transparent shadow-2xs ring-2 ${colorObj.ring}`
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectTable(tbl.id)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-black cursor-pointer"
                title={`${tbl.name} (${getArabicMonthName(tbl.month)} ${tbl.year})`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-amber-300' : colorObj.bg}`} />
                {isTblNew && (
                  <Sparkles className="w-3 h-3 text-emerald-500 animate-pulse shrink-0" />
                )}
                <span className="truncate max-w-[150px]">{tbl.name}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-mono font-black ${
                  isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-800'
                }`}>
                  {count}
                </span>
              </button>

              {(hasUserPermission(currentUser, 'manageMonthTables') || hasUserPermission(currentUser, 'deleteMonthTable')) && (
                <div className="flex items-center pl-1 gap-0.5 border-r border-slate-200/50 pr-1">
                  {hasUserPermission(currentUser, 'manageMonthTables') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTable(tbl);
                      }}
                      className={`p-0.5 rounded transition-colors cursor-pointer ${
                        isSelected ? 'hover:bg-white/20 text-white/90' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                      title="تعديل الجدول"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  )}
                  {hasUserPermission(currentUser, 'deleteMonthTable') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmTable(tbl);
                      }}
                      className={`p-0.5 rounded transition-colors cursor-pointer ${
                        isSelected ? 'hover:bg-white/20 text-white/90' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                      }`}
                      title="حذف الجدول"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Compact Combined View Pill */}
        {currentMonthTables.length > 0 && (
          <button
            type="button"
            onClick={() => onSelectTable('all')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer shrink-0 border mr-auto ${
              selectedTableId === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title="عرض تجميعي لكافة جداول هذا الشهر"
          >
            <Layers className="w-3 h-3 text-amber-500 shrink-0" />
            <span>دمج الكل</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] font-mono font-black ${
              selectedTableId === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
            }`}>
              {totalOrdersInActivePeriod}
            </span>
          </button>
        )}
      </div>

      {/* Modal: Add New Independent Table with Explicit Target Year & Target Month */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
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
              {/* Target Year & Month Selection Box */}
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
                    className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm cursor-pointer flex items-center gap-1.5"
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

      {/* Modal: Edit Table (including moving to another Year/Month safely) */}
      {editingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
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
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
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
  );
};
