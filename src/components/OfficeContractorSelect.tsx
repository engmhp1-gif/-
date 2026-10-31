import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Trash2, X, Check, Building2, AlertCircle } from 'lucide-react';
import { SubOffice, DropdownOptionsMap } from '../types';
import { getContractorsForOffice, getConsultantsForOffice } from '../services/contractorService';

export interface OfficeContractorSelectProps {
  selectedOffice: string;
  value?: string;
  onChange?: (contractor: string) => void;
  selectedContractor?: string;
  onSelectContractor?: (contractor: string) => void;
  onSelectOffice?: (officeName: string) => void;
  officeContractorsMap?: Record<string, string[]>;
  offices?: SubOffice[];
  dropdownOptions?: DropdownOptionsMap;
  onUpdateOfficeContractors?: (officeName: string, contractors: string[]) => void;
  onAddContractor?: (officeName: string, contractorName: string) => void;
  onDeleteContractor?: (officeName: string, contractorName: string) => void;
  required?: boolean;
  label?: string;
  helperText?: string;
  entityType?: 'contractor' | 'consultant';
}

export const OfficeContractorSelect: React.FC<OfficeContractorSelectProps> = ({
  selectedOffice,
  value,
  onChange,
  selectedContractor,
  onSelectContractor,
  onSelectOffice,
  officeContractorsMap,
  offices = [],
  dropdownOptions,
  onUpdateOfficeContractors,
  onAddContractor,
  onDeleteContractor,
  required = true,
  entityType = 'contractor',
  label,
  helperText
}) => {
  const isConsultant = entityType === 'consultant';
  const entityNoun = isConsultant ? 'الاستشاري' : 'المقاول';
  const entityPluralGenitive = isConsultant ? 'استشاريي' : 'مقاولي';
  const entityPluralNominative = isConsultant ? 'استشاريون' : 'مقاولون';
  const resolvedLabel = label || (isConsultant ? 'الاستشاري (اسم الاستشاري المشرف المعتمد) *' : '2. المقاول (اسم المقاول المنفذ لأمر العمل) *');
  const resolvedHelperText = helperText || (isConsultant
    ? 'يتم تحديث قائمة الاستشاريين المعتمدين تلقائياً وبشكل ذكي حسب المكتب المختار'
    : 'يتم تحديث قائمة المقاولين المعتمدين تلقائياً وبشكل ذكي حسب المكتب المختار');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newContractorName, setNewContractorName] = useState('');
  const [isManualInput, setIsManualInput] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const effectiveValue = value ?? selectedContractor ?? '';
  const effectiveContractorsMap = officeContractorsMap || (isConsultant ? dropdownOptions?.officeConsultants : dropdownOptions?.officeContractors);

  const triggerChange = (newVal: string) => {
    if (typeof onChange === 'function') {
      try { onChange(newVal); } catch (e) { console.warn('[OfficeContractorSelect] onChange err:', e); }
    }
    if (typeof onSelectContractor === 'function') {
      try { onSelectContractor(newVal); } catch (e) { console.warn('[OfficeContractorSelect] onSelectContractor err:', e); }
    }
  };

  // Compute available contractors/consultants for currently selected office
  const availableContractors = isConsultant
    ? getConsultantsForOffice(selectedOffice, effectiveContractorsMap, offices)
    : getContractorsForOffice(selectedOffice, effectiveContractorsMap, offices);

  // Smart automatic synchronization:
  // When selectedOffice changes, automatically check if current contractor/consultant belongs to it;
  // If not, automatically pick the first item of the selected office.
  useEffect(() => {
    if (!selectedOffice) return;

    const list = isConsultant
      ? getConsultantsForOffice(selectedOffice, effectiveContractorsMap, offices)
      : getContractorsForOffice(selectedOffice, effectiveContractorsMap, offices);

    if (list.length > 0) {
      if (!list.includes(effectiveValue)) {
        triggerChange(list[0]);
      }
    } else if (!isManualInput) {
      if (!effectiveValue) {
        triggerChange('');
      }
    }
  }, [selectedOffice, effectiveContractorsMap, isConsultant]);

  // Flash temporary success message
  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 2800);
  };

  // Add new contractor/consultant to current office
  const handleAddContractor = (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    const trimmed = newContractorName.trim();
    if (!trimmed) return;

    if (availableContractors.includes(trimmed)) {
      triggerChange(trimmed);
      setNewContractorName('');
      setShowAddForm(false);
      return;
    }

    const updatedList = [...availableContractors, trimmed];

    if (onAddContractor) {
      onAddContractor(selectedOffice, trimmed);
    } else if (onUpdateOfficeContractors) {
      onUpdateOfficeContractors(selectedOffice, updatedList);
    }

    // Automatically select the new item
    triggerChange(trimmed);
    setNewContractorName('');
    setShowAddForm(false);
    setIsManualInput(false);
    triggerToast(`تمت إضافة ${entityNoun} "${trimmed}" لقائمة ${selectedOffice} بنجاح`);
  };

  // Delete contractor/consultant from current office
  const handleDeleteContractor = (contractorToDelete: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف ${entityNoun} "${contractorToDelete}" من قائمة ${entityPluralGenitive} ${selectedOffice}؟`
    );
    if (!confirmed) return;

    const updatedList = availableContractors.filter(c => c !== contractorToDelete);

    if (onDeleteContractor) {
      onDeleteContractor(selectedOffice, contractorToDelete);
    } else if (onUpdateOfficeContractors) {
      onUpdateOfficeContractors(selectedOffice, updatedList);
    }

    // If the active selection was deleted, select next available or empty
    if (effectiveValue === contractorToDelete) {
      triggerChange(updatedList[0] || '');
    }

    triggerToast(`تم حذف ${entityNoun} "${contractorToDelete}" من ${selectedOffice}`);
  };

  return (
    <div className="space-y-3">
      {/* Optional Office Selector when onSelectOffice is passed */}
      {onSelectOffice && offices && offices.length > 0 && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1.5">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>1. المكتب الفرعي *</span>
          </label>
          <select
            value={selectedOffice}
            onChange={(e) => onSelectOffice(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
          >
            <option value="">-- اختر المكتب الفرعي --</option>
            {offices.map((off) => (
              <option key={off.id} value={off.name}>
                {off.name} {off.region ? `(${off.region})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Briefcase className="w-4 h-4 text-blue-600" />
            <span>{resolvedLabel}</span>
          </label>
          
          {/* Office Tag Badge */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Building2 className="w-3 h-3" />
            <span>{selectedOffice || 'المكتب'}</span>
            <span className="text-blue-500 font-normal">({availableContractors.length})</span>
          </span>
        </div>

        {/* Dropdown / Manual Input Section */}
        <div className="space-y-2">
          {!isManualInput ? (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={effectiveValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__ADD_NEW__') {
                      setShowAddForm(true);
                    } else if (val === '__MANUAL__') {
                      setIsManualInput(true);
                    } else {
                      triggerChange(val);
                    }
                  }}
                  required={required}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs appearance-none pr-3.5 pl-9"
                >
                  {availableContractors.length === 0 ? (
                    <option value="">-- لا يوجد {entityPluralNominative} مسجلون لهذا المكتب بعد --</option>
                  ) : (
                    availableContractors.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))
                  )}
                  <option disabled value="">──────────────</option>
                  <option value="__ADD_NEW__">+ إضافة {isConsultant ? 'استشاري' : 'مقاول'} جديد لهذا المكتب...</option>
                  <option value="__MANUAL__">✎ كتابة اسم {isConsultant ? 'استشاري' : 'مقاول'} آخر يدوياً...</option>
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Briefcase className="w-4 h-4" />
                </div>
              </div>

              {/* Quick Delete for selected contractor */}
              {effectiveValue && availableContractors.includes(effectiveValue) && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteContractor(effectiveValue, e)}
                  title={`حذف "${effectiveValue}" من قائمة ${entityPluralGenitive} ${selectedOffice}`}
                  className="p-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300 transition-colors shadow-2xs flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Quick Add Toggle Button */}
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                title={`إضافة ${isConsultant ? 'استشاري' : 'مقاول'} جديد لهذا المكتب`}
                className={`p-2.5 rounded-lg border transition-colors shadow-2xs flex-shrink-0 ${
                  showAddForm
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-700 border-slate-300 hover:bg-blue-50 hover:border-blue-300'
                }`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required={required}
                  placeholder={`أدخل اسم ${entityNoun} المعتمد...`}
                  value={effectiveValue}
                  onChange={(e) => triggerChange(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-lg border border-blue-400 bg-white text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setIsManualInput(false)}
                  className="px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  العودة للقائمة المنسدلة
                </button>
              </div>
              <span className="text-[11px] text-amber-700 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                إدخال حر: يمكنك أيضاً إضافة هذا {entityNoun} إلى قائمة المكتب ليظهر مستقبلاً في القائمة المنسدلة.
              </span>
            </div>
          )}

        {/* Success Feedback Notification */}
        {successToast && (
          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Inline Add Contractor/Consultant Container */}
        {showAddForm && (
          <div
            className="p-3 bg-white rounded-xl border border-blue-300 shadow-xs space-y-2 mt-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                إضافة {isConsultant ? 'استشاري' : 'مقاول'} جديد لمكتب: <span className="text-blue-700 font-extrabold">{selectedOffice}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                autoFocus
                placeholder={`اكتب اسم ${entityNoun} الجديد هنا...`}
                value={newContractorName}
                onChange={(e) => setNewContractorName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddContractor(e);
                  }
                }}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddContractor}
                disabled={!newContractorName.trim()}
                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-colors whitespace-nowrap shadow-2xs cursor-pointer"
              >
                + حفظ وإضافة
              </button>
            </div>
          </div>
        )}

        {/* Interactive Contractors/Consultants Badges / Chips with 1-click Delete */}
        <div className="mt-2.5 pt-2 border-t border-slate-200/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              قائمة {entityPluralGenitive} ({selectedOffice || 'المكتب'}) المعتمدين:
            </span>
            <span className="text-[10px] text-slate-400">
              اضغط للاختيار السريع أو زر (✕) للحذف
            </span>
          </div>

          {availableContractors.length === 0 ? (
            <div className="text-center py-2 px-3 bg-white/70 rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
              لا يوجد {entityPluralNominative} مسجلون لهذا المكتب. اضغط على زر (+) أعلاه لإضافة {isConsultant ? 'استشاري' : 'مقاول'}.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
              {availableContractors.map((c) => {
                const isSelected = effectiveValue === c;
                return (
                  <span
                    key={c}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border shadow-2xs select-none ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300/50'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        triggerChange(c);
                        setIsManualInput(false);
                      }}
                      className="cursor-pointer text-right hover:underline"
                      title={`اختيار ${entityNoun}: ${c}`}
                    >
                      {c}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteContractor(c, e)}
                      title={`حذف "${c}" من قائمة ${entityPluralGenitive} ${selectedOffice}`}
                      className={`p-0.5 rounded transition-colors ${
                        isSelected
                          ? 'text-blue-200 hover:text-white hover:bg-blue-700'
                          : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                      }`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <span className="text-[11px] text-slate-500 mt-2 block">
        {resolvedHelperText}
      </span>
    </div>
  </div>
);
};
