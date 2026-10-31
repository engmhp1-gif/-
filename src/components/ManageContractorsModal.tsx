import React, { useState } from 'react';
import { 
  Briefcase, 
  Building2, 
  Plus, 
  Trash2, 
  X, 
  Check, 
  Sparkles, 
  CheckCircle2
} from 'lucide-react';
import { SubOffice, DropdownOptionsMap } from '../types';
import { getContractorsForOffice, getConsultantsForOffice } from '../services/contractorService';

interface ManageContractorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  offices: SubOffice[];
  dropdownOptions?: DropdownOptionsMap;
  onUpdateOfficeContractors: (officeName: string, contractors: string[]) => Promise<void> | void;
  onUpdateOfficeConsultants?: (officeName: string, consultants: string[]) => Promise<void> | void;
  selectedOfficeDefault?: string;
}

export const ManageContractorsModal: React.FC<ManageContractorsModalProps> = ({
  isOpen,
  onClose,
  offices,
  dropdownOptions,
  onUpdateOfficeContractors,
  onUpdateOfficeConsultants,
  selectedOfficeDefault
}) => {
  const [activeOffice, setActiveOffice] = useState<string>(() => {
    if (selectedOfficeDefault && selectedOfficeDefault !== 'all') {
      return selectedOfficeDefault;
    }
    return offices[0]?.name || 'مكتب عرعر';
  });
  const [activeEntityTab, setActiveEntityTab] = useState<'contractor' | 'consultant'>('contractor');

  const [newItemName, setNewItemName] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      if (selectedOfficeDefault && selectedOfficeDefault !== 'all') {
        setActiveOffice(selectedOfficeDefault);
      } else if (!offices.some(o => o.name === activeOffice)) {
        setActiveOffice(offices[0]?.name || 'مكتب عرعر');
      }
      setNewItemName('');
    }
  }, [isOpen, selectedOfficeDefault, offices]);

  if (!isOpen) return null;

  const isConsultant = activeEntityTab === 'consultant';
  const entityNoun = isConsultant ? 'الاستشاري' : 'المقاول';
  const entityPlural = isConsultant ? 'الاستشاريون' : 'المقاولون';

  const currentItems = isConsultant
    ? getConsultantsForOffice(activeOffice, dropdownOptions?.officeConsultants, offices)
    : getContractorsForOffice(activeOffice, dropdownOptions?.officeContractors, offices);

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 2500);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newItemName.trim();
    if (!trimmed) return;

    if (currentItems.includes(trimmed)) {
      triggerToast(`${entityNoun} "${trimmed}" مسجل بالفعل في مكتب ${activeOffice}`);
      return;
    }

    const updated = [...currentItems, trimmed];
    if (isConsultant && onUpdateOfficeConsultants) {
      await onUpdateOfficeConsultants(activeOffice, updated);
    } else if (!isConsultant) {
      await onUpdateOfficeContractors(activeOffice, updated);
    }
    setNewItemName('');
    triggerToast(`تمت إضافة ${entityNoun} "${trimmed}" لمكتب ${activeOffice} بنجاح`);
  };

  const handleDeleteItem = async (itemName: string) => {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف ${entityNoun} "${itemName}" من قائمة ${activeOffice}؟`
    );
    if (!confirmed) return;

    const updated = currentItems.filter(c => c !== itemName);
    if (isConsultant && onUpdateOfficeConsultants) {
      await onUpdateOfficeConsultants(activeOffice, updated);
    } else if (!isConsultant) {
      await onUpdateOfficeContractors(activeOffice, updated);
    }
    triggerToast(`تم حذف ${entityNoun} "${itemName}" من مكتب ${activeOffice}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden text-right"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-5 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">
                  إدارة وتوزيع مقاولي واستشاريي المكاتب الفرعية
                </h3>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  ربط تلقائي وذكي
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                تخصيص قوائم المقاولين والاستشاريين لكل مكتب عند إضافة أو تعديل صف بالجدول
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

        {/* Entity Switcher Tabs (المقاولون / الاستشاريون) */}
        <div className="bg-slate-100 px-5 pt-3 border-b border-slate-200 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveEntityTab('contractor')}
            className={`px-4 py-2 rounded-t-xl text-xs font-black transition-all cursor-pointer border-b-2 ${
              activeEntityTab === 'contractor'
                ? 'bg-white text-blue-700 border-blue-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            إدارة المقاولين (عمود المقاول)
          </button>
          <button
            type="button"
            onClick={() => setActiveEntityTab('consultant')}
            className={`px-4 py-2 rounded-t-xl text-xs font-black transition-all cursor-pointer border-b-2 ${
              activeEntityTab === 'consultant'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            إدارة الاستشاريين (عمود الاستشاري)
          </button>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Office Selection Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>اختر المكتب الفرعي لعرض وتعديل قائمة {isConsultant ? 'استشارييه' : 'مقاوليه'} المعتمدين:</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {offices.map(off => {
                const isSelected = off.name === activeOffice;
                const itemsList = isConsultant
                  ? getConsultantsForOffice(off.name, dropdownOptions?.officeConsultants, offices)
                  : getContractorsForOffice(off.name, dropdownOptions?.officeContractors, offices);
                return (
                  <button
                    key={off.id}
                    type="button"
                    onClick={() => setActiveOffice(off.name)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-300/40'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{off.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {itemsList.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add Contractor/Consultant Form for Active Office */}
          <form onSubmit={handleAddItem} className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                إضافة {isConsultant ? 'استشاري' : 'مقاول'} جديد إلى: <span className="text-blue-700 font-extrabold">{activeOffice}</span>
              </span>
              <span className="text-[11px] text-blue-600">
                سيتزامن فورياً بالقائمة المنسدلة وكافة الأقسام
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={`اكتب اسم ${entityNoun} المراد إلحاقه بـ ${activeOffice}...`}
                className="flex-1 px-3.5 py-2.5 text-xs font-bold bg-white rounded-lg border border-blue-300 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs"
              />
              <button
                type="submit"
                disabled={!newItemName.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ إضافة {entityNoun}</span>
              </button>
            </div>
          </form>

          {/* Current Office Items Cards/Badges */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-blue-600" />
                {entityPlural} المعتمدون في {activeOffice} ({currentItems.length}):
              </span>
              <span className="text-[11px] text-slate-400">
                اضغط على زر (حذف) لإزالة أي عنصر
              </span>
            </div>

            {currentItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border border-dashed border-slate-300 rounded-xl text-xs bg-slate-50/50">
                لا يوجد {entityPlural} مسجلون لمكتب {activeOffice} حالياً. أضف من الحقل أعلاه.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-1">
                {currentItems.map((c, idx) => (
                  <div
                    key={c}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 border border-blue-100">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-900 truncate" title={c}>
                        {c}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteItem(c)}
                      title={`حذف "${c}" من مكتب ${activeOffice}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Summary of all offices */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>حالة التزامن التلقائي والذكي:</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              عند اختيار أي مكتب داخل نافذة إضافة أو تعديل أمر عمل، يتم جلب قائمتي المقاولين والاستشاريين الخاصة به تلقائياً بدون تدخل يدوي.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            كافة التعديلات ترحل وتتزامن سحابياً وفورياً لجميع المستخدمين
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition-colors shadow-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
