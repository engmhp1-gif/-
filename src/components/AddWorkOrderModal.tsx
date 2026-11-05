import React, { useState, useEffect, useRef } from 'react';
import {
  WorkOrder,
  SubOffice,
  DropdownOptionsMap,
  MonthTable
} from '../types';
import {
  ARABIC_MONTHS,
  getDefaultTableId,
  findExistingWorkOrderConflicts,
  DuplicateWorkOrderConflict
} from '../utils/tableScope';
import {
  PlusCircle,
  X,
  Building2,
  Hash,
  FileCode2,
  Briefcase,
  Check,
  Award,
  ChevronDown,
  Plus,
  Search,
  AlertTriangle,
  ExternalLink,
  Calendar,
  FolderOpen
} from 'lucide-react';
import { getSavedCurrentUser } from '../utils/security';

interface AddWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (order: Partial<WorkOrder>) => boolean | void | Promise<boolean | void>;
  offices: SubOffice[];
  defaultOffice: string;
  dropdownOptions?: DropdownOptionsMap;
  onUpdateOfficeContractors?: (officeName: string, updatedContractors: string[]) => void;
  onAddContractor?: (officeName: string, newContractor: string) => void;
  onDeleteContractor?: (officeName: string, contractorToRemove: string) => void;
  onUpdateOfficeConsultants?: (officeName: string, updatedConsultants: string[]) => void;
  onAddConsultant?: (officeName: string, newConsultant: string) => void;
  onDeleteConsultant?: (officeName: string, consultantToRemove: string) => void;
  activeYear?: number;
  activeMonth?: number | 'all';
  selectedTableId?: string;
  monthTables?: MonthTable[];
  existingOrders?: WorkOrder[];
  onNavigateToExistingOrder?: (conflict: DuplicateWorkOrderConflict) => void;
}

type ActiveDropdownKey = null | 'office' | 'contractor' | 'consultant';

export const AddWorkOrderModal: React.FC<AddWorkOrderModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  offices,
  defaultOffice,
  dropdownOptions,
  onAddContractor,
  onAddConsultant,
  activeYear = new Date().getFullYear(),
  activeMonth = 1,
  selectedTableId = '',
  monthTables = [],
  existingOrders = [],
  onNavigateToExistingOrder
}) => {
  const initialOffice =
    defaultOffice === 'all' ? offices[0]?.name || 'عرعر' : defaultOffice;

  const [office, setOffice] = useState(initialOffice);
  const [contractor, setContractor] = useState('');
  const [consultant, setConsultant] = useState('الحامد');
  const [workOrderNumber, setWorkOrderNumber] = useState('');
  const [workOrderCode, setWorkOrderCode] = useState('');

  // Hidden dropdown state (opens only when clicked, closes on selection)
  const [openDropdown, setOpenDropdown] = useState<ActiveDropdownKey>(null);
  const [contractorSearch, setContractorSearch] = useState('');
  const [newContractorInput, setNewContractorInput] = useState('');
  const [newConsultantInput, setNewConsultantInput] = useState('');

  const workOrderInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = (key: Exclude<ActiveDropdownKey, null>) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  const standardConsultants = ['الحامد', 'المحايد', 'الصخرة المشرفة', 'سعود كونسلت'];

  useEffect(() => {
    if (isOpen) {
      const targetOff =
        defaultOffice === 'all' ? offices[0]?.name || 'عرعر' : defaultOffice;
      setOffice(targetOff);

      const foundOffice = offices.find((o) => o.name === targetOff);
      const officeList =
        foundOffice &&
        Array.isArray(foundOffice.contractors) &&
        foundOffice.contractors.length > 0
          ? foundOffice.contractors
          : dropdownOptions?.contractor || [];

      setContractor(officeList[0] || '');

      const rawConsultantList =
        foundOffice &&
        Array.isArray(foundOffice.consultants) &&
        foundOffice.consultants.length > 0
          ? foundOffice.consultants
          : dropdownOptions?.consultant || standardConsultants;
      const consultantList = Array.from(new Set([...standardConsultants, ...rawConsultantList]));

      setConsultant(consultantList[0] || 'الحامد');
      setWorkOrderNumber('');
      setWorkOrderCode('');
      setOpenDropdown(null);
      setContractorSearch('');
      setNewContractorInput('');
      setNewConsultantInput('');
    }
  }, [isOpen, defaultOffice, offices, dropdownOptions]);

  useEffect(() => {
    const foundOffice = offices.find((o) => o.name === office);
    const officeList =
      foundOffice &&
      Array.isArray(foundOffice.contractors) &&
      foundOffice.contractors.length > 0
        ? foundOffice.contractors
        : dropdownOptions?.contractor || [];

    if (officeList.length > 0 && !officeList.includes(contractor)) {
      setContractor(officeList[0]);
    }

    const rawConsultantList =
      foundOffice &&
      Array.isArray(foundOffice.consultants) &&
      foundOffice.consultants.length > 0
        ? foundOffice.consultants
        : dropdownOptions?.consultant || standardConsultants;
    const consultantList = Array.from(new Set([...standardConsultants, ...rawConsultantList]));

    if (consultantList.length > 0 && !consultantList.includes(consultant)) {
      setConsultant(consultantList[0]);
    }
  }, [office, offices, dropdownOptions, contractor, consultant]);

  const currentOfficeObj = offices.find((o) => o.name === office);
  const availableContractors =
    currentOfficeObj &&
    Array.isArray(currentOfficeObj.contractors) &&
    currentOfficeObj.contractors.length > 0
      ? currentOfficeObj.contractors
      : dropdownOptions?.contractor || [];

  const filteredContractors = contractorSearch.trim()
    ? availableContractors.filter((c) =>
        c.toLowerCase().includes(contractorSearch.trim().toLowerCase())
      )
    : availableContractors;

  const rawOfficeConsultants =
    currentOfficeObj &&
    Array.isArray(currentOfficeObj.consultants) &&
    currentOfficeObj.consultants.length > 0
      ? currentOfficeObj.consultants
      : dropdownOptions?.consultant || standardConsultants;
  const availableConsultants = Array.from(
    new Set([...standardConsultants, ...rawOfficeConsultants])
  );

  const currentActualMonth = new Date().getMonth() + 1;
  const resolvedDefaultMonth = typeof activeMonth === 'number' ? activeMonth : currentActualMonth;
  const defaultPeriodTableId = getDefaultTableId(activeYear, resolvedDefaultMonth);
  const resolvedTableId =
    selectedTableId && selectedTableId !== 'all'
      ? selectedTableId
      : defaultPeriodTableId;
  const targetMonthName =
    ARABIC_MONTHS.find((m) => m.num === resolvedDefaultMonth)?.name ||
    `شهر ${resolvedDefaultMonth}`;
  const selectedTableObj = monthTables.find((t) => t.id === resolvedTableId);
  const resolvedTableName = selectedTableObj
    ? selectedTableObj.name
    : `الجدول الأساسي - ${targetMonthName} ${activeYear}`;

  const loggedUser = getSavedCurrentUser();
  const creatorEmail = (
    loggedUser?.email ||
    loggedUser?.username ||
    '2502331172@se.com.sa'
  ).trim();
  const creatorName = (
    loggedUser?.displayName ||
    loggedUser?.username ||
    'مستخدم معتمد'
  ).trim();

  const handleQuickAddContractor = () => {
    const trimmed = newContractorInput.trim();
    if (!trimmed) return;
    if (onAddContractor) {
      onAddContractor(office, trimmed);
    }
    setContractor(trimmed);
    setNewContractorInput('');
    setOpenDropdown(null);
  };

  const handleQuickAddConsultant = () => {
    const trimmed = newConsultantInput.trim();
    if (!trimmed) return;
    if (onAddConsultant) {
      onAddConsultant(office, trimmed);
    }
    setConsultant(trimmed);
    setNewConsultantInput('');
    setOpenDropdown(null);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  }, [isOpen]);

  const numericWorkOrderNumberPreview = workOrderNumber.replace(/\D+/g, '');
  const numericWorkOrderTypePreview = workOrderCode.replace(/\D+/g, '');

  const liveDuplicateConflict: DuplicateWorkOrderConflict | null = React.useMemo(() => {
    if (isSubmitting || submittingRef.current) return null;
    if (!numericWorkOrderNumberPreview) return null;
    const { conflicts } = findExistingWorkOrderConflicts(
      [
        {
          workOrderNumber: numericWorkOrderNumberPreview,
          workOrderCode: numericWorkOrderTypePreview
        }
      ],
      existingOrders,
      monthTables
    );
    return conflicts.length > 0 ? conflicts[0] : null;
  }, [isSubmitting, numericWorkOrderNumberPreview, numericWorkOrderTypePreview, existingOrders, monthTables]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;
    const numericWorkOrderNumber = workOrderNumber.replace(/\D+/g, '');
    const numericWorkOrderType = workOrderCode.replace(/\D+/g, '');
    if (!numericWorkOrderNumber) return;

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await onAdd({
        office,
        contractor: contractor.trim() || 'غير محدد',
        consultant: consultant.trim() || 'الحامد',
        addedByEmail: creatorEmail,
        createdByEmail: creatorEmail,
        addedByName: creatorName,
        workOrderNumber: numericWorkOrderNumber,
        workOrderCode: numericWorkOrderType,
        AttachmentStatus: '',
        attachmentStatus: '',
        photoDocumentation: '',
        consultantForms: '',
        consultantLeaveForms: '',
        form190: '',
        form200: '',
        inspectionForm: '',
        technicalSupportChecklist: undefined,
        procedure155: '',
        procedure155Status: '',
        pdcAudit: undefined,
        constructionAudit: undefined,
        statusSyncTime: '',
        procedureSyncTime: '',
        publicationStatus: '',
        extractNumber: '',
        qualityNotes: '',
        photos: [],
        tableId: resolvedTableId,
        tableYear: activeYear,
        tableMonth: resolvedDefaultMonth,
        tableName: resolvedTableName
      } as any);

      if (result === false) {
        submittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      setWorkOrderNumber('');
      setWorkOrderCode('');
      setOpenDropdown(null);
      submittingRef.current = false;
      setIsSubmitting(false);
      onClose();
    } catch (_) {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 font-['Cairo',sans-serif]"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        className="bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#eef2ff] rounded-2xl shadow-2xl border border-slate-300 max-w-md w-full overflow-hidden flex flex-col text-right animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Distinguished Executive Header */}
        <div className="bg-gradient-to-l from-slate-800 via-slate-900 to-indigo-950 text-white px-4 py-3.5 flex items-center justify-between border-b border-slate-700 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/25 border border-indigo-400/40 text-amber-300 shadow-2xs">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white leading-tight">
                إضافة أمر عمل جديد
              </h3>
              <p className="text-[11px] text-slate-300 font-bold mt-0.5">
                إدخال مباشر وسلس مرتبط بالجدول النشط
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Streamlined 5-Field Body in Exact Order */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3">
          {/* 1. المكتب بقوائم منسدلة مخفية */}
          <div className="rounded-xl border border-slate-300/90 bg-gradient-to-l from-slate-100/90 via-blue-50/50 to-indigo-50/40 overflow-hidden shadow-2xs transition-all">
            <button
              type="button"
              onClick={() => toggleDropdown('office')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-right hover:bg-blue-100/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-800 border border-blue-200 shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-black text-slate-600">
                    1. المكتب
                  </span>
                  <span className="block text-xs sm:text-sm font-black text-slate-900 truncate">
                    مكتب خدمات الكهرباء - {office}
                  </span>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-600 transition-transform duration-200 shrink-0 ${
                  openDropdown === 'office' ? 'rotate-180 text-blue-700' : ''
                }`}
              />
            </button>

            {openDropdown === 'office' && (
              <div className="p-2.5 bg-gradient-to-b from-slate-50 to-blue-50/40 border-t border-slate-300/80 grid grid-cols-2 gap-1.5 animate-in slide-in-from-top-1 duration-150">
                {offices.map((o) => {
                  const isSelected = o.name === office;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setOffice(o.name);
                        setOpenDropdown(null);
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-black flex items-center justify-between transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-gradient-to-l from-blue-700 to-indigo-800 text-white border-blue-800 shadow-xs'
                          : 'bg-slate-100/90 text-slate-800 border-slate-300 hover:bg-blue-100/60 hover:border-blue-300'
                      }`}
                    >
                      <span className="truncate">{o.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. المقاول بقوائم منسدلة مخفية */}
          <div className="rounded-xl border border-slate-300/90 bg-gradient-to-l from-slate-100/90 via-teal-50/40 to-emerald-50/40 overflow-hidden shadow-2xs transition-all">
            <button
              type="button"
              onClick={() => toggleDropdown('contractor')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-right hover:bg-teal-100/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-teal-100 to-emerald-100 text-teal-900 border border-teal-200 shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-black text-slate-600">
                    2. المقاول
                  </span>
                  <span className="block text-xs sm:text-sm font-black text-slate-900 truncate">
                    {contractor || 'اختر المقاول...'}
                  </span>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-600 transition-transform duration-200 shrink-0 ${
                  openDropdown === 'contractor' ? 'rotate-180 text-teal-800' : ''
                }`}
              />
            </button>

            {openDropdown === 'contractor' && (
              <div className="p-2.5 bg-gradient-to-b from-slate-50 to-teal-50/40 border-t border-slate-300/80 space-y-2 animate-in slide-in-from-top-1 duration-150">
                {availableContractors.length > 5 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={contractorSearch}
                      onChange={(e) => setContractorSearch(e.target.value)}
                      placeholder="بحث سريع في المقاولين..."
                      className="w-full pr-8 pl-2.5 py-1.5 text-xs font-bold bg-slate-100/90 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 text-slate-900"
                    />
                  </div>
                )}

                <div className="max-h-40 overflow-y-auto grid grid-cols-1 gap-1 pr-0.5">
                  {filteredContractors.map((c) => {
                    const isSelected = c === contractor;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setContractor(c);
                          setOpenDropdown(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center justify-between text-right transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-gradient-to-l from-teal-700 to-emerald-800 text-white border-teal-800 shadow-xs'
                            : 'bg-slate-100/90 text-slate-800 border-slate-300 hover:bg-teal-100/60 hover:border-teal-300'
                        }`}
                      >
                        <span className="truncate">{c}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-300/70">
                  <input
                    type="text"
                    value={newContractorInput}
                    onChange={(e) => setNewContractorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleQuickAddContractor();
                      }
                    }}
                    placeholder="إضافة مقاول جديد..."
                    className="flex-1 px-2.5 py-1.5 text-xs font-bold bg-slate-100/90 border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddContractor}
                    className="px-2.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. الاستشاري بقوائم منسدلة مخفية */}
          <div className="rounded-xl border border-slate-300/90 bg-gradient-to-l from-slate-100/90 via-indigo-50/40 to-purple-50/35 overflow-hidden shadow-2xs transition-all">
            <button
              type="button"
              onClick={() => toggleDropdown('consultant')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-right hover:bg-indigo-100/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-900 border border-indigo-200 shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-black text-slate-600">
                    3. الاستشاري
                  </span>
                  <span className="block text-xs sm:text-sm font-black text-slate-900 truncate">
                    {consultant || 'المحايد'}
                  </span>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-600 transition-transform duration-200 shrink-0 ${
                  openDropdown === 'consultant' ? 'rotate-180 text-indigo-800' : ''
                }`}
              />
            </button>

            {openDropdown === 'consultant' && (
              <div className="p-2.5 bg-gradient-to-b from-slate-50 to-indigo-50/40 border-t border-slate-300/80 space-y-2 animate-in slide-in-from-top-1 duration-150">
                <div className="max-h-36 overflow-y-auto grid grid-cols-2 gap-1.5">
                  {availableConsultants.map((cons) => {
                    const isSelected = cons === consultant;
                    return (
                      <button
                        key={cons}
                        type="button"
                        onClick={() => {
                          setConsultant(cons);
                          setOpenDropdown(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center justify-between transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-gradient-to-l from-indigo-700 to-purple-800 text-white border-indigo-800 shadow-xs'
                            : 'bg-slate-100/90 text-slate-800 border-slate-300 hover:bg-indigo-100/60 hover:border-indigo-300'
                        }`}
                      >
                        <span className="truncate">{cons}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-300/70">
                  <input
                    type="text"
                    value={newConsultantInput}
                    onChange={(e) => setNewConsultantInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleQuickAddConsultant();
                      }
                    }}
                    placeholder="إضافة استشاري جديد..."
                    className="flex-1 px-2.5 py-1.5 text-xs font-bold bg-slate-100/90 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600 text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleQuickAddConsultant}
                    className="px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. رقم امر العمل بدون قائمة منسدلة (رقمية فقط) */}
          <div className="rounded-xl border border-slate-300/90 bg-gradient-to-l from-slate-100/90 via-amber-50/35 to-orange-50/30 p-3 shadow-2xs">
            <label className="flex items-center justify-between text-xs font-black text-slate-800 mb-1.5">
              <span className="flex items-center gap-1.5">
                <span className="p-1 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                  <Hash className="w-3.5 h-3.5" />
                </span>
                <span>4. رقم أمر العمل</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100/80 text-amber-950 border border-amber-300">
                أرقام فقط *
              </span>
            </label>
            <input
              ref={workOrderInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              value={workOrderNumber}
              onChange={(e) => setWorkOrderNumber(e.target.value.replace(/\D+/g, ''))}
              placeholder="أدخل رقم أمر العمل (أرقام فقط)..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl bg-slate-50/95 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-sm font-black font-mono text-slate-900 placeholder:text-slate-500 placeholder:font-sans transition-all"
            />
          </div>

          {/* 5. نوع امر العمل بدون قائمة منسدلة (رقمية فقط) */}
          <div className="rounded-xl border border-slate-300/90 bg-gradient-to-l from-slate-100/90 via-blue-50/40 to-sky-50/40 p-3 shadow-2xs">
            <label className="flex items-center justify-between text-xs font-black text-slate-800 mb-1.5">
              <span className="flex items-center gap-1.5">
                <span className="p-1 rounded-md bg-sky-100 text-sky-900 border border-sky-300">
                  <FileCode2 className="w-3.5 h-3.5" />
                </span>
                <span>5. نوع أمر العمل</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-100/80 text-sky-950 border border-sky-300">
                أرقام فقط
              </span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={workOrderCode}
              onChange={(e) => setWorkOrderCode(e.target.value.replace(/\D+/g, ''))}
              placeholder="أدخل كود / نوع أمر العمل (أرقام فقط)..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl bg-slate-50/95 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700 text-sm font-black font-mono text-slate-900 placeholder:text-slate-500 placeholder:font-sans transition-all"
            />
          </div>

          {/* تنبيه فوري عند وجود أمر العمل مسبقاً في المنصة */}
          {liveDuplicateConflict && (
            <div className="rounded-xl border-2 border-rose-300 bg-rose-50/95 p-3 space-y-2 shadow-sm animate-in fade-in duration-150">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="text-xs font-black">
                    أمر العمل ({liveDuplicateConflict.workOrderNumber}
                    {liveDuplicateConflict.workOrderCode ? ` / ${liveDuplicateConflict.workOrderCode}` : ''}) مسجل مسبقاً في المنصة!
                  </span>
                </div>
                {onNavigateToExistingOrder && (
                  <button
                    type="button"
                    onClick={() => onNavigateToExistingOrder(liveDuplicateConflict)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black shadow-xs transition-all cursor-pointer shrink-0"
                    title="انتقل فوراً للجدول الموجود به أمر العمل وافتحه"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
                    <span>الانتقال لأمر العمل</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-bold text-slate-800 bg-white/90 p-2 rounded-lg border border-rose-200">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>السنة: <strong className="font-black">{liveDuplicateConflict.year} م</strong></span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>الشهر: <strong className="font-black">{liveDuplicateConflict.monthName}</strong></span>
                </div>
                <div className="col-span-2 flex items-center gap-1">
                  <FolderOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">القسم والجدول: <strong className="font-black">{liveDuplicateConflict.sectionName} ({liveDuplicateConflict.tableName})</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* مزامنة اسم وإيميل مدخل البيانات */}
          <div className="rounded-xl border border-indigo-200/90 bg-gradient-to-l from-indigo-50/80 via-slate-50 to-blue-50/70 px-3 py-2 flex items-center justify-between gap-2 text-[11px] shadow-2xs">
            <span className="font-black text-indigo-950 shrink-0">مدخل البيانات المعتمد:</span>
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="font-black text-slate-900 truncate">{creatorName}</span>
              <span className="text-slate-400">•</span>
              <span className="font-mono font-bold text-indigo-800 truncate" dir="ltr">{creatorEmail}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-300/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-black text-slate-800 bg-slate-200/80 hover:bg-slate-300/80 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-5 rounded-xl bg-gradient-to-l from-slate-800 via-blue-900 to-indigo-950 hover:from-slate-900 hover:to-indigo-900 text-white text-xs sm:text-sm font-black shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.99]"
            >
              <Check className="w-4 h-4 text-amber-300" />
              <span>حفظ وإضافة أمر العمل</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
