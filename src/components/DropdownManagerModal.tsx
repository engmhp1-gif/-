import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  ListOrdered, 
  Save, 
  Sparkles,
  ArrowRight,
  HelpCircle,
  Layers,
  Lock
} from 'lucide-react';
import { ColumnDefinition, DropdownOptionsMap } from '../types';

interface DropdownManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnDefinition[];
  dropdownOptions: DropdownOptionsMap;
  onSaveOptions: (updatedOptions: DropdownOptionsMap) => void;
  initialSelectedColumnKey?: string;
}

export const DropdownManagerModal: React.FC<DropdownManagerModalProps> = ({
  isOpen,
  onClose,
  columns,
  dropdownOptions,
  onSaveOptions,
  initialSelectedColumnKey
}) => {
  // Filter columns that support dropdowns
  const dropdownColumns = columns.filter(col => col.hasDropdown);
  
  const defaultKey = initialSelectedColumnKey && dropdownOptions[initialSelectedColumnKey] 
    ? initialSelectedColumnKey 
    : (dropdownColumns[0]?.dropdownKey || 'office');

  const [selectedKey, setSelectedKey] = useState<string>(defaultKey);
  const [localOptions, setLocalOptions] = useState<DropdownOptionsMap>(() => JSON.parse(JSON.stringify(dropdownOptions)));
  const [newOptionText, setNewOptionText] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Sync when prop changes or modal opens
  React.useEffect(() => {
    if (isOpen) {
      setLocalOptions(JSON.parse(JSON.stringify(dropdownOptions)));
      if (initialSelectedColumnKey && dropdownColumns.some(c => c.dropdownKey === initialSelectedColumnKey)) {
        setSelectedKey(initialSelectedColumnKey);
      } else if (!dropdownColumns.some(c => c.dropdownKey === selectedKey)) {
        setSelectedKey(dropdownColumns[0]?.dropdownKey || 'office');
      }
      setEditingIndex(null);
      setNewOptionText('');
      setSaveSuccessMsg(false);
    }
  }, [isOpen, dropdownOptions, initialSelectedColumnKey]);

  if (!isOpen) return null;

  const currentOptionsList = localOptions[selectedKey] || [];
  const selectedColumnInfo = columns.find(c => c.dropdownKey === selectedKey);

  const handleAddOption = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newOptionText.trim();
    if (!trimmed) return;
    if (currentOptionsList.includes(trimmed)) {
      alert('هذا الخيار موجود بالفعل في القائمة!');
      return;
    }

    const updatedList = [...currentOptionsList, trimmed];
    const updatedMap = {
      ...localOptions,
      [selectedKey]: updatedList
    };
    setLocalOptions(updatedMap);
    setNewOptionText('');
    onSaveOptions(updatedMap);
    showSuccessBanner();
  };

  const handleDeleteOption = (index: number) => {
    const itemToDelete = currentOptionsList[index];
    if (confirm(`هل أنت متأكد من حذف الخيار: "${itemToDelete}" من القائمة المنسدلة؟`)) {
      const updatedList = currentOptionsList.filter((_, i) => i !== index);
      const updatedMap = {
        ...localOptions,
        [selectedKey]: updatedList
      };
      setLocalOptions(updatedMap);
      if (editingIndex === index) {
        setEditingIndex(null);
      }
      onSaveOptions(updatedMap);
      showSuccessBanner();
    }
  };

  const handleStartEdit = (index: number, val: string) => {
    setEditingIndex(index);
    setEditingValue(val);
  };

  const handleSaveEdit = (index: number) => {
    const trimmed = editingValue.trim();
    if (!trimmed) return;
    const updatedList = [...currentOptionsList];
    updatedList[index] = trimmed;
    const updatedMap = {
      ...localOptions,
      [selectedKey]: updatedList
    };
    setLocalOptions(updatedMap);
    setEditingIndex(null);
    onSaveOptions(updatedMap);
    showSuccessBanner();
  };

  const showSuccessBanner = () => {
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden text-right"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">
                  إدارة وتعديل بيانات القوائم المنسدلة
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>محمي برمز الأمان</span>
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                تعديل وحذف وإضافة أسطر الخيارات لجميع خلايا أعمدة الجدول وترحيلها فوراً
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

        {/* Success Toast */}
        {saveSuccessMsg && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>تم حفظ القائمة وترحيل التحديثات فورياً لكافة المستخدمين والمستندات!</span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Column Selector Pills */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>اختر العمود لتعديل خيارات القائمة المنسدلة الخاصة به:</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {dropdownColumns.map(col => {
                const isSelected = col.dropdownKey === selectedKey;
                const count = (localOptions[col.dropdownKey] || []).length;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => {
                      setSelectedKey(col.dropdownKey);
                      setEditingIndex(null);
                      setNewOptionText('');
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>{col.title}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add Option Form */}
          <form onSubmit={handleAddOption} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">
                إضافة سطر جديد لقائمة: {selectedColumnInfo?.title || selectedKey}
              </span>
              <span className="text-[11px] text-slate-500">
                سيظهر فورياً في القائمة المنسدلة للخلايا
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newOptionText}
                onChange={(e) => setNewOptionText(e.target.value)}
                placeholder="اكتب نص الخيار الجديد هنا..."
                className="flex-1 px-3 py-2 text-xs bg-white rounded-lg border border-slate-300 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!newOptionText.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة سطر للقائمة</span>
              </button>
            </div>
          </form>

          {/* Options List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">
                الخيارات الحالية ({currentOptionsList.length} أسطر):
              </span>
              <span className="text-[11px] text-slate-400">
                يمكنك التعديل أو الحذف لأي سطر
              </span>
            </div>

            {currentOptionsList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border border-dashed border-slate-300 rounded-xl text-xs">
                لا توجد خيارات في هذه القائمة حالياً. أضف سطراً جديداً أعلاه.
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
                {currentOptionsList.map((option, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors gap-2"
                  >
                    {editingIndex === idx ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          autoFocus
                          className="flex-1 px-2.5 py-1 text-xs bg-slate-50 border border-blue-400 rounded-lg focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(idx)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold"
                          title="حفظ التعديل"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingIndex(null)}
                          className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-xs"
                          title="إلغاء التعديل"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs text-slate-800 font-medium truncate" title={option}>
                            {option}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(idx, option)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="تعديل نص الخيار"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOption(idx)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="حذف هذا الخيار من القائمة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            تطبق التعديلات فورياً في كافة خلايا الجدول وقواعد البيانات
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
