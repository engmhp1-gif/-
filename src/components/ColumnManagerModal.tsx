import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  Columns3, 
  Save, 
  Sliders, 
  ListFilter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Lock
} from 'lucide-react';
import { ColumnDefinition, DropdownOptionsMap } from '../types';

interface ColumnManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnDefinition[];
  dropdownOptions: DropdownOptionsMap;
  onSaveColumns: (updatedColumns: ColumnDefinition[], updatedDropdownOptions?: DropdownOptionsMap) => void;
  onOpenDropdownEditorForColumn?: (dropdownKey: string) => void;
}

export const ColumnManagerModal: React.FC<ColumnManagerModalProps> = ({
  isOpen,
  onClose,
  columns,
  dropdownOptions,
  onSaveColumns,
  onOpenDropdownEditorForColumn
}) => {
  const [localColumns, setLocalColumns] = useState<ColumnDefinition[]>(() => JSON.parse(JSON.stringify(columns)));
  const [localDropdowns, setLocalDropdowns] = useState<DropdownOptionsMap>(() => JSON.parse(JSON.stringify(dropdownOptions)));
  
  // New column state
  const [newColTitle, setNewColTitle] = useState('');
  const [newColHasDropdown, setNewColHasDropdown] = useState(true);
  const [newColInitialOptions, setNewColInitialOptions] = useState('');
  const [expandedColDropdown, setExpandedColDropdown] = useState<string | null>(null);

  // New option under expanded column
  const [newOptionTextForCol, setNewOptionTextForCol] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setLocalColumns(JSON.parse(JSON.stringify(columns)));
      setLocalDropdowns(JSON.parse(JSON.stringify(dropdownOptions)));
      setNewColTitle('');
      setNewColInitialOptions('');
      setSaveSuccessMsg(false);
      setExpandedColDropdown(null);
    }
  }, [isOpen, columns, dropdownOptions]);

  if (!isOpen) return null;

  const handleTitleChange = (id: string, newTitle: string) => {
    setLocalColumns(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
  };

  const handleToggleDropdown = (id: string) => {
    setLocalColumns(prev => prev.map(c => {
      if (c.id === id) {
        const nextHas = !c.hasDropdown;
        // ensure key exists in dropdowns
        if (nextHas && !localDropdowns[c.dropdownKey]) {
          setLocalDropdowns(d => ({ ...d, [c.dropdownKey]: ['خيار 1', 'خيار 2'] }));
        }
        return { ...c, hasDropdown: nextHas };
      }
      return c;
    }));
  };

  const handleDeleteColumn = (col: ColumnDefinition) => {
    if (!col.isRemovable) {
      alert(`العمود الأساسي "${col.title}" مطلوب للتدقيق على إجراء 155، ولكن يمكنك تعديل مسماه وخيارات قائمته المنسدلة بحرية.`);
      return;
    }

    if (confirm(`هل أنت متأكد من حذف العمود "${col.title}" نهائياً من الجدول؟`)) {
      const updated = localColumns.filter(c => c.id !== col.id);
      setLocalColumns(updated);
      onSaveColumns(updated, localDropdowns);
      showSuccessBanner();
    }
  };

  const handleAddNewColumn = (e: React.FormEvent) => {
    e.preventDefault();
    const titleTrimmed = newColTitle.trim();
    if (!titleTrimmed) return;

    const newId = `col_${Date.now()}`;
    const dropdownKey = `drop_${newId}`;

    let initialOptionsArray: string[] = [];
    if (newColHasDropdown) {
      if (newColInitialOptions.trim()) {
        initialOptionsArray = newColInitialOptions
          .split(/[,،\n]/)
          .map(s => s.trim())
          .filter(Boolean);
      }
      if (initialOptionsArray.length === 0) {
        initialOptionsArray = ['خيار 1', 'خيار 2', 'خيار 3'];
      }
    }

    const newCol: ColumnDefinition = {
      id: newId,
      title: titleTrimmed,
      field: newId,
      isRemovable: true,
      hasDropdown: newColHasDropdown,
      dropdownKey: dropdownKey,
      order: localColumns.length + 1,
      width: '150px',
      type: newColHasDropdown ? 'select' : 'text'
    };

    const updatedColumns = [...localColumns, newCol];
    const updatedDropdowns = {
      ...localDropdowns,
      [dropdownKey]: initialOptionsArray
    };

    setLocalColumns(updatedColumns);
    setLocalDropdowns(updatedDropdowns);
    setNewColTitle('');
    setNewColInitialOptions('');

    onSaveColumns(updatedColumns, updatedDropdowns);
    showSuccessBanner();
  };

  const handleSaveAll = () => {
    onSaveColumns(localColumns, localDropdowns);
    showSuccessBanner();
  };

  const showSuccessBanner = () => {
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2500);
  };

  // Add option to expanded column
  const handleAddOptionToCol = (dropdownKey: string) => {
    const trimmed = newOptionTextForCol.trim();
    if (!trimmed) return;
    const currentList = localDropdowns[dropdownKey] || [];
    if (currentList.includes(trimmed)) {
      alert('هذا الخيار موجود بالفعل!');
      return;
    }
    const nextList = [...currentList, trimmed];
    const nextMap = { ...localDropdowns, [dropdownKey]: nextList };
    setLocalDropdowns(nextMap);
    setNewOptionTextForCol('');
    onSaveColumns(localColumns, nextMap);
    showSuccessBanner();
  };

  const handleDeleteOptionFromCol = (dropdownKey: string, optIdx: number) => {
    const currentList = localDropdowns[dropdownKey] || [];
    const nextList = currentList.filter((_, i) => i !== optIdx);
    const nextMap = { ...localDropdowns, [dropdownKey]: nextList };
    setLocalDropdowns(nextMap);
    onSaveColumns(localColumns, nextMap);
    showSuccessBanner();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden text-right"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Columns3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">
                  إدارة وهيكلة أعمدة الجدول وقوائمها المنسدلة
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Sliders className="w-2.5 h-2.5 text-emerald-400" />
                  <span>متاح ومصرح به للمستخدمين المعتمدين</span>
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                تعديل مسميات الأعمدة، إضافة وحذف أعمدة، وتعديل القوائم المنسدلة لخلايا كل عمود
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Banner */}
        {saveSuccessMsg && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>تم حفظ هيكلة الأعمدة وتحديثات القوائم المنسدلة وترحيلها لجميع المتصلين فوراً!</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Add New Column Form */}
          <form onSubmit={handleAddNewColumn} className="bg-gradient-to-br from-blue-50/60 to-indigo-50/60 border border-blue-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-700 font-bold" />
              <h4 className="text-xs font-bold text-blue-900">إضافة عمود جديد إلى الجدول</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  مسمى العمود الجديد:
                </label>
                <input
                  type="text"
                  value={newColTitle}
                  onChange={(e) => setNewColTitle(e.target.value)}
                  placeholder="مثال: المهندس المشرف، موقع العمل، رقم البلاغ..."
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-300 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  نوع خلايا العمود:
                </label>
                <div className="flex items-center gap-4 mt-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="colDropdownType"
                      checked={newColHasDropdown}
                      onChange={() => setNewColHasDropdown(true)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>قائمة منسدلة للاختيار</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="colDropdownType"
                      checked={!newColHasDropdown}
                      onChange={() => setNewColHasDropdown(false)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>بيانات نصية</span>
                  </label>
                </div>
              </div>
            </div>

            {newColHasDropdown && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  خيارات القائمة المنسدلة الأولية (مفصولة بفواصل أو أسطر):
                </label>
                <input
                  type="text"
                  value={newColInitialOptions}
                  onChange={(e) => setNewColInitialOptions(e.target.value)}
                  placeholder="مثال: مكتمل، جاري الفحص، مؤجل، غير مطابق"
                  className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-300 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newColTitle.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إدراج العمود في الجدول</span>
              </button>
            </div>
          </form>

          {/* Existing Columns List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-slate-700" />
                <h4 className="text-xs font-bold text-slate-900">
                  قائمة أعمدة الجدول الحالية ({localColumns.length} أعمدة):
                </h4>
              </div>
              <button
                type="button"
                onClick={handleSaveAll}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ التعديلات وتطبيقها</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-0.5">
              {localColumns.map((col, idx) => {
                const isExpanded = expandedColDropdown === col.id;
                const optionsForThisCol = localDropdowns[col.dropdownKey] || [];

                return (
                  <div 
                    key={col.id}
                    className="border border-slate-200 rounded-xl bg-white hover:border-slate-300 transition-all overflow-hidden"
                  >
                    <div className="p-3 flex items-center gap-3 justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>

                        {/* Editable Title */}
                        <div className="flex-1 max-w-sm">
                          <input
                            type="text"
                            value={col.title}
                            onChange={(e) => handleTitleChange(col.id, e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 focus:outline-hidden"
                            title="انقر لتعديل مسمى هذا العمود"
                          />
                        </div>

                        {/* Column badges */}
                        <div className="hidden sm:flex items-center gap-1.5">
                          {col.hasDropdown ? (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                              <ListFilter className="w-3 h-3" />
                              <span>قائمة منسدلة ({optionsForThisCol.length})</span>
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-md">
                              نص
                            </span>
                          )}
                          {!col.isRemovable && (
                            <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium px-2 py-0.5 rounded-md">
                              عمود رئيسي
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Manage dropdown options accordion toggle */}
                        {col.hasDropdown && (
                          <button
                            type="button"
                            onClick={() => setExpandedColDropdown(isExpanded ? null : col.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-colors ${
                              isExpanded 
                                ? 'bg-indigo-600 text-white border-indigo-600' 
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                            }`}
                            title="تعديل خيارات القائمة المنسدلة لهذا العمود"
                          >
                            <span>خيارات القائمة</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}

                        {/* Delete Column Button */}
                        {col.isRemovable ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteColumn(col)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="حذف هذا العمود من الجدول"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="p-1.5 text-slate-300 cursor-not-allowed"
                            title="الأعمدة الأساسية لإجراء 155 لا يمكن حذفها (يمكن تعديل مسماها وخياراتها)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded Dropdown Options Manager for this specific column */}
                    {isExpanded && col.hasDropdown && (
                      <div className="bg-slate-50 border-t border-slate-200 p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <ListFilter className="w-3.5 h-3.5 text-indigo-600" />
                            <span>تعديل خيارات القائمة المنسدلة لعمود ({col.title}):</span>
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {optionsForThisCol.length} خيارات متاحة
                          </span>
                        </div>

                        {/* Add option to this column */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newOptionTextForCol}
                            onChange={(e) => setNewOptionTextForCol(e.target.value)}
                            placeholder="اكتب خياراً جديداً لإضافته لقائمة هذا العمود..."
                            className="flex-1 px-3 py-1.5 text-xs bg-white rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddOptionToCol(col.dropdownKey)}
                            disabled={!newOptionTextForCol.trim()}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors"
                          >
                            إضافة سطر
                          </button>
                        </div>

                        {/* List of options */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {optionsForThisCol.map((opt, optIdx) => (
                            <span 
                              key={optIdx}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs shadow-2xs"
                            >
                              <span>{opt}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteOptionFromCol(col.dropdownKey, optIdx)}
                                className="text-slate-400 hover:text-rose-600 transition-colors"
                                title="حذف هذا الخيار"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            يتم تحديث الجدول وترحيل الأعمدة وقوائمها فورياً لكافة المستخدمين المتصلين
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>تأكيد وحفظ</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
