import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Building2, 
  Briefcase, 
  Hash, 
  Tag, 
  Activity, 
  Camera, 
  FileText, 
  CheckCircle2, 
  Trash2,
  ClipboardList,
  FileCheck2,
  FileSpreadsheet,
  Calendar,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { 
  WorkOrder, 
  SubOffice, 
  DropdownOptionsMap,
  FourStateStatus,
  FiveStateStatus,
  QualityNoteItem,
  Procedure155Status
} from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { getContractorsForOffice, getConsultantsForOffice } from '../services/contractorService';
import { QualityNotesEditor, parseNotesStringToItems } from './QualityNotesEditor';
import { getSavedCurrentUser } from '../utils/security';

interface EditWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: WorkOrder | null;
  onSave: (updatedOrder: WorkOrder) => void;
  offices: SubOffice[];
  onDelete?: (id: string) => void;
  dropdownOptions?: DropdownOptionsMap;
  onUpdateOfficeContractors?: (officeName: string, contractors: string[]) => void;
  onAddContractor?: (officeName: string, contractorName: string) => void;
  onDeleteContractor?: (officeName: string, contractorName: string) => void;
  onUpdateOfficeConsultants?: (officeName: string, consultants: string[]) => void;
  onAddConsultant?: (officeName: string, consultantName: string) => void;
  onDeleteConsultant?: (officeName: string, consultantName: string) => void;
}

const FOUR_STATE_OPTIONS: FourStateStatus[] = [
  'مكتمل',
  'غير مكتمل',
  'لا ينطبق'
];

const FIVE_STATE_OPTIONS: FiveStateStatus[] = [
  'مكتمل',
  'غير مكتمل',
  'لا ينطبق'
];

const ATTACHMENT_STATUS_OPTIONS: string[] = [
  'جاهز للارفاق الكامل',
  'جاهز لارفاق صور العداد',
  'جاهز لارفاق صور الخفريات',
  'جاهز لارفاق صور المعدات',
  'جاهز لارفاق صور الهوائي',
  'غير جاهز للارفاق'
];

export const EditWorkOrderModal: React.FC<EditWorkOrderModalProps> = ({
  isOpen,
  onClose,
  order,
  onSave,
  offices,
  onDelete,
  dropdownOptions
}) => {
  // Tab view: 'all' | 'basic' | 'status'
  const [activeTab, setActiveTab] = useState<'all' | 'basic' | 'status'>('all');

  // Basic fields
  const [office, setOffice] = useState<string>('مكتب عرعر');
  const [contractor, setContractor] = useState<string>('');
  const [consultant, setConsultant] = useState<string>('');
  const [workOrderNumber, setWorkOrderNumber] = useState<string>('');
  const [workOrderCode, setWorkOrderCode] = useState<string>('');
  const [receiptDate, setReceiptDate] = useState<string>('');

  // Status & Forms fields
  const [attachmentStatus, setAttachmentStatus] = useState<string>('غير جاهز للارفاق');
  const [photoDocumentation, setPhotoDocumentation] = useState<string>('غير مكتمل');
  const [consultantForms, setConsultantForms] = useState<string>('غير مكتمل');
  const [consultantClearanceForms, setConsultantClearanceForms] = useState<string>('غير مكتمل');
  const [form190, setForm190] = useState<string>('غير مكتمل');
  const [form200, setForm200] = useState<string>('غير مكتمل');
  const [inspectionForm, setInspectionForm] = useState<string>('غير مكتمل');
  const [qualityNotes, setQualityNotes] = useState<string>('');
  const [qualityNoteItems, setQualityNoteItems] = useState<QualityNoteItem[]>([]);
  const [procedure155Status, setProcedure155Status] = useState<string>('مؤهل للاغلاق');
  const [procedure155, setProcedure155] = useState<string>('');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const initializedOrderIdRef = React.useRef<string | null>(null);
  const initialSnapshotRef = React.useRef<WorkOrder | null>(null);

  useEffect(() => {
    if (!isOpen || !order) {
      initializedOrderIdRef.current = null;
      initialSnapshotRef.current = null;
      return;
    }

    const isSameOrderSession = initializedOrderIdRef.current === order.id && initialSnapshotRef.current !== null;
    const prevSnap = initialSnapshotRef.current;

    const activeOff = order.office || (offices[0]?.name || 'مكتب عرعر');
    const consultants = getConsultantsForOffice(activeOff, dropdownOptions?.officeConsultants, offices);
    const nextReceiptDate = order.receiptDate || (order.createdAt ? order.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
    const rawNotes = order.qualityNotes !== undefined ? order.qualityNotes : (order.executionNotes || '');
    const parsedItems = order.qualityNoteItems && order.qualityNoteItems.length > 0
      ? order.qualityNoteItems
      : parseNotesStringToItems(rawNotes);
    const nextProc155 = order.procedure155 ? String(order.procedure155).trim() : '';
    const raw155 = String(order.procedure155Status || '');
    const nextProc155Status = (raw155.includes('غير') || raw155.includes('مرفوض') || raw155.includes('نواقص'))
      ? 'غير مؤهل للاغلاق'
      : 'مؤهل للاغلاق';

    if (!isSameOrderSession) {
      initializedOrderIdRef.current = order.id;
      initialSnapshotRef.current = { ...order };
      setOffice(activeOff);
      setContractor(order.contractor || '');
      setConsultant(order.consultant || consultants[0] || '');
      setWorkOrderNumber(order.workOrderNumber || '');
      setWorkOrderCode(order.workOrderCode || '');
      setReceiptDate(nextReceiptDate);
      setAttachmentStatus(order.attachmentStatus || 'غير جاهز للارفاق');
      setPhotoDocumentation(order.photoDocumentation || 'غير مكتمل');
      setConsultantForms(order.consultantForms || 'غير مكتمل');
      setConsultantClearanceForms(order.consultantClearanceForms || 'غير مكتمل');
      setForm190(order.form190 || 'غير مكتمل');
      setForm200(order.form200 || 'غير مكتمل');
      setInspectionForm(order.inspectionForm || 'غير مكتمل');
      setQualityNotes(rawNotes);
      setQualityNoteItems(parsedItems);
      setProcedure155(nextProc155);
      setProcedure155Status(nextProc155Status);
      setValidationError(null);
    } else if (prevSnap) {
      // Concurrent remote update arrived while modal is open: update only fields that the local user hasn't modified from prevSnap
      if (office === (prevSnap.office || (offices[0]?.name || 'مكتب عرعر')) && order.office !== prevSnap.office) {
        setOffice(activeOff);
      }
      if (contractor === (prevSnap.contractor || '') && order.contractor !== prevSnap.contractor) {
        setContractor(order.contractor || '');
      }
      if (consultant === (prevSnap.consultant || consultants[0] || '') && order.consultant !== prevSnap.consultant) {
        setConsultant(order.consultant || consultants[0] || '');
      }
      if (workOrderNumber === (prevSnap.workOrderNumber || '') && order.workOrderNumber !== prevSnap.workOrderNumber) {
        setWorkOrderNumber(order.workOrderNumber || '');
      }
      if (workOrderCode === (prevSnap.workOrderCode || '') && order.workOrderCode !== prevSnap.workOrderCode) {
        setWorkOrderCode(order.workOrderCode || '');
      }
      if (attachmentStatus === (prevSnap.attachmentStatus || 'غير جاهز للارفاق') && order.attachmentStatus !== prevSnap.attachmentStatus) {
        setAttachmentStatus(order.attachmentStatus || 'غير جاهز للارفاق');
      }
      if (photoDocumentation === (prevSnap.photoDocumentation || 'غير مكتمل') && order.photoDocumentation !== prevSnap.photoDocumentation) {
        setPhotoDocumentation(order.photoDocumentation || 'غير مكتمل');
      }
      if (consultantForms === (prevSnap.consultantForms || 'غير مكتمل') && order.consultantForms !== prevSnap.consultantForms) {
        setConsultantForms(order.consultantForms || 'غير مكتمل');
      }
      if (consultantClearanceForms === (prevSnap.consultantClearanceForms || 'غير مكتمل') && order.consultantClearanceForms !== prevSnap.consultantClearanceForms) {
        setConsultantClearanceForms(order.consultantClearanceForms || 'غير مكتمل');
      }
      if (form190 === (prevSnap.form190 || 'غير مكتمل') && order.form190 !== prevSnap.form190) {
        setForm190(order.form190 || 'غير مكتمل');
      }
      if (form200 === (prevSnap.form200 || 'غير مكتمل') && order.form200 !== prevSnap.form200) {
        setForm200(order.form200 || 'غير مكتمل');
      }
      if (inspectionForm === (prevSnap.inspectionForm || 'غير مكتمل') && order.inspectionForm !== prevSnap.inspectionForm) {
        setInspectionForm(order.inspectionForm || 'غير مكتمل');
      }
      const prevRawNotes = prevSnap.qualityNotes !== undefined ? prevSnap.qualityNotes : (prevSnap.executionNotes || '');
      if (qualityNotes === prevRawNotes && rawNotes !== prevRawNotes) {
        setQualityNotes(rawNotes);
        setQualityNoteItems(parsedItems);
      }
      const prevProc155 = prevSnap.procedure155 ? String(prevSnap.procedure155).trim() : '';
      if (procedure155 === prevProc155 && nextProc155 !== prevProc155) {
        setProcedure155(nextProc155);
      }
      if (order.procedure155Status !== prevSnap.procedure155Status) {
        setProcedure155Status(nextProc155Status);
      }
      initialSnapshotRef.current = { ...order };
    }
  }, [isOpen, order, offices, dropdownOptions]);

  // Office contractors & consultants options
  const currentOfficeContractors = React.useMemo(() => {
    if (!office) return [];
    return getContractorsForOffice(office, dropdownOptions?.officeContractors, offices);
  }, [office, dropdownOptions, offices]);

  const currentOfficeConsultants = React.useMemo(() => {
    if (!office) return [];
    return getConsultantsForOffice(office, dropdownOptions?.officeConsultants, offices);
  }, [office, dropdownOptions, offices]);

  const handleOfficeChange = (newOffice: string) => {
    setOffice(newOffice);
    const available = getContractorsForOffice(newOffice, dropdownOptions?.officeContractors, offices);
    if (available.length > 0 && !available.includes(contractor)) {
      setContractor(available[0]);
    }
    const availableConsultants = getConsultantsForOffice(newOffice, dropdownOptions?.officeConsultants, offices);
    if (availableConsultants.length > 0 && !availableConsultants.includes(consultant)) {
      setConsultant(availableConsultants[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    if (!workOrderNumber.trim()) {
      setValidationError('يرجى إدخال رقم أمر العمل بشكل صحيح');
      return;
    }

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12 || 12;
    const formattedSyncTime = `${yyyy}/${mm}/${dd} ${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;

    const user = getSavedCurrentUser();
    const userEmail = (user?.email || user?.username || '').trim();
    const userName = (user?.displayName || user?.username || 'مستخدم معتمد').trim();

    const baseSnap = initialSnapshotRef.current || order;
    const userTouchedFields: string[] = [];
    if (office !== baseSnap.office) userTouchedFields.push('office');
    if (contractor !== baseSnap.contractor) userTouchedFields.push('contractor');
    if (consultant !== baseSnap.consultant) userTouchedFields.push('consultant');
    if (workOrderNumber.trim() !== (baseSnap.workOrderNumber || '').trim()) userTouchedFields.push('workOrderNumber');
    if (workOrderCode.trim() !== (baseSnap.workOrderCode || '').trim()) userTouchedFields.push('workOrderCode');
    const cleanReceipt = receiptDate.trim() || order.receiptDate || new Date().toISOString().slice(0, 10);
    if (cleanReceipt !== baseSnap.receiptDate) userTouchedFields.push('receiptDate');
    if (attachmentStatus !== baseSnap.attachmentStatus) userTouchedFields.push('attachmentStatus');
    if (photoDocumentation !== baseSnap.photoDocumentation) {
      userTouchedFields.push('photoDocumentation', 'photoCoordination');
    }
    if (consultantForms !== baseSnap.consultantForms) userTouchedFields.push('consultantForms');
    if (consultantClearanceForms !== baseSnap.consultantClearanceForms) userTouchedFields.push('consultantClearanceForms');
    if (form190 !== baseSnap.form190) userTouchedFields.push('form190');
    if (form200 !== baseSnap.form200) userTouchedFields.push('form200');
    if (inspectionForm !== baseSnap.inspectionForm) userTouchedFields.push('inspectionForm');
    const filteredNoteItems = qualityNoteItems.filter(it => (it.text && it.text.trim()) || (it.photos && it.photos.length > 0));
    if (
      qualityNotes.trim() !== (baseSnap.qualityNotes || '').trim() ||
      JSON.stringify(filteredNoteItems) !== JSON.stringify(baseSnap.qualityNoteItems || [])
    ) {
      userTouchedFields.push('qualityNotes', 'qualityNoteItems', 'executionNotes');
    }
    if (procedure155Status !== baseSnap.procedure155Status) userTouchedFields.push('procedure155Status');
    if (procedure155 !== (baseSnap.procedure155 || '')) userTouchedFields.push('procedure155');

    // Check if any status columns preceding statusSyncTime changed
    const statusChanged = 
      office !== order.office ||
      contractor !== order.contractor ||
      consultant !== order.consultant ||
      workOrderNumber.trim() !== order.workOrderNumber ||
      workOrderCode.trim() !== order.workOrderCode ||
      attachmentStatus !== order.attachmentStatus ||
      photoDocumentation !== order.photoDocumentation ||
      consultantForms !== order.consultantForms ||
      consultantClearanceForms !== order.consultantClearanceForms ||
      form190 !== order.form190 ||
      form200 !== order.form200 ||
      inspectionForm !== order.inspectionForm ||
      qualityNotes.trim() !== (order.qualityNotes || '').trim() ||
      procedure155Status !== order.procedure155Status;

    if (statusChanged) {
      userTouchedFields.push('statusSyncTime', 'statusSyncEmail', 'statusSyncUser');
    }

    // Check if procedure155 changed
    const procedure155Changed = procedure155 !== order.procedure155;
    if (procedure155Changed) {
      userTouchedFields.push('procedureSyncTime', 'procedureSyncEmail', 'procedureSyncUser');
    }

    const updatedOrder: WorkOrder = {
      ...order,
      office,
      contractor,
      consultant,
      workOrderNumber: workOrderNumber.trim(),
      workOrderCode: workOrderCode.trim(),
      receiptDate: cleanReceipt,
      attachmentStatus,
      photoDocumentation: photoDocumentation as FourStateStatus,
      consultantForms: consultantForms as FourStateStatus,
      consultantClearanceForms: consultantClearanceForms as FourStateStatus,
      form190: form190 as FiveStateStatus,
      form200: form200 as FiveStateStatus,
      inspectionForm: inspectionForm as FiveStateStatus,
      qualityNotes: qualityNotes.trim(),
      qualityNoteItems: filteredNoteItems,
      procedure155Status: procedure155Status as Procedure155Status,
      procedure155: procedure155,
      statusSyncTime: statusChanged ? formattedSyncTime : (order.statusSyncTime || formattedSyncTime),
      statusSyncEmail: statusChanged ? userEmail : (order.statusSyncEmail || userEmail),
      statusSyncUser: statusChanged ? userName : (order.statusSyncUser || userName),
      procedureSyncTime: procedure155Changed ? formattedSyncTime : (order.procedureSyncTime || (procedure155 ? formattedSyncTime : undefined)),
      procedureSyncEmail: procedure155Changed ? userEmail : (order.procedureSyncEmail || (procedure155 ? userEmail : undefined)),
      procedureSyncUser: procedure155Changed ? userName : (order.procedureSyncUser || (procedure155 ? userName : undefined)),
      lastUpdatedBy: userEmail || userName,
      // Synchronize legacy fields
      executionNotes: qualityNotes.trim() || order.executionNotes,
      photoCoordination: photoDocumentation,
      // Mark as Edited for prominent Dark Red highlighting
      isEdited: true,
      lastEditedAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    (updatedOrder as any)._userTouchedFields = Array.from(new Set(userTouchedFields));
    onSave(updatedOrder);
    onClose();
  };

  if (!isOpen || !order) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full my-6 overflow-hidden flex flex-col text-right animate-in fade-in zoom-in-95 duration-150">
          
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-slate-900 via-red-950 to-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-red-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-700 text-white flex items-center justify-center shadow-xs">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span>تعديل أمر العمل الشامل</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-red-900 text-red-200 border border-red-700">
                    {order.workOrderNumber}
                  </span>
                  {order.isEdited && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black">
                      مُعدّل سابقاً
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-300">
                  تعديل البيانات الأساسية، التوثيق، النماذج المعتمدة (190، 200، الفحص)، وملاحظات الجودة لإجراء 155
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Validation Error Banner */}
          {validationError && (
            <div className="bg-rose-50 border-b border-rose-200 p-3 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all cursor-pointer border-b-2 ${
                activeTab === 'all'
                  ? 'bg-white text-red-800 border-red-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 border-transparent'
              }`}
            >
              كافة البيانات والنماذج
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all cursor-pointer border-b-2 ${
                activeTab === 'basic'
                  ? 'bg-white text-red-800 border-red-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 border-transparent'
              }`}
            >
              بيانات أمر العمل الأساسية
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('status')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all cursor-pointer border-b-2 ${
                activeTab === 'status'
                  ? 'bg-white text-red-800 border-red-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 border-transparent'
              }`}
            >
              حالة النماذج والامتثال 155
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(85vh-160px)] space-y-5">
            
            {/* SECTION 1: Basic Information */}
            {(activeTab === 'all' || activeTab === 'basic') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-black text-slate-800">بيانات أمر العمل الأساسية</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* المكتب الفرعي */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      1. المكتب الفرعي *
                    </label>
                    <select
                      value={office}
                      onChange={(e) => handleOfficeChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                    >
                      {offices.map((off) => (
                        <option key={off.id} value={off.name}>
                          {off.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* المقاول */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      2. المقاول المنفذ *
                    </label>
                    <select
                      value={contractor}
                      onChange={(e) => setContractor(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                    >
                      {currentOfficeContractors.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* الاستشاري */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      3. الاستشاري *
                    </label>
                    <select
                      value={consultant}
                      onChange={(e) => setConsultant(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                    >
                      {currentOfficeConsultants.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* رقم أمر العمل */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      4. رقم أمر العمل *
                    </label>
                    <input
                      type="text"
                      value={workOrderNumber}
                      onChange={(e) => setWorkOrderNumber(e.target.value)}
                      placeholder="مثال: 36433355"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* نوع أمر العمل */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      5. نوع أمر العمل
                    </label>
                    <input
                      type="text"
                      value={workOrderCode}
                      onChange={(e) => setWorkOrderCode(e.target.value)}
                      placeholder="أدخل نوع أمر العمل"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* تاريخ الاستلام */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      6. تاريخ الاستلام
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={receiptDate}
                        onChange={(e) => setReceiptDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: Checklist Forms & Quality Audit */}
            {(activeTab === 'all' || activeTab === 'status') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                  <ClipboardList className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-black text-slate-800">حالة النماذج والامتثال الفني (إجراء 155)</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* حالة الارفاق */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1.5">
                      <Camera className="w-3.5 h-3.5 text-indigo-600" />
                      <span>حالة الارفاق *</span>
                    </label>
                    <select
                      value={attachmentStatus}
                      onChange={(e) => setAttachmentStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                    >
                      {(dropdownOptions?.attachmentStatus?.length ? dropdownOptions.attachmentStatus : ATTACHMENT_STATUS_OPTIONS).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* توثيق الصور */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1.5">
                      <Camera className="w-3.5 h-3.5 text-blue-600" />
                      <span>توثيق الصور *</span>
                    </label>
                    <select
                      value={photoDocumentation}
                      onChange={(e) => setPhotoDocumentation(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                    >
                      {FOUR_STATE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* نماذج الاستشاري */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1.5">
                      <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>نماذج الاستشاري *</span>
                    </label>
                    <select
                      value={consultantForms}
                      onChange={(e) => setConsultantForms(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                    >
                      {FOUR_STATE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* نماذج إجازة الاستشاري */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1.5">
                      <FileCheck2 className="w-3.5 h-3.5 text-teal-600" />
                      <span>نماذج إجازة الاستشاري *</span>
                    </label>
                    <select
                      value={consultantClearanceForms}
                      onChange={(e) => setConsultantClearanceForms(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                    >
                      {FOUR_STATE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* نموذج 190 */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                      <span>نموذج 190 *</span>
                    </label>
                    <select
                      value={form190}
                      onChange={(e) => setForm190(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                    >
                      {FIVE_STATE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* نموذج 200 */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
                      <span>نموذج 200 *</span>
                    </label>
                    <select
                      value={form200}
                      onChange={(e) => setForm200(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                    >
                      {FIVE_STATE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* نموذج الفحص */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1.5">
                      <ClipboardList className="w-3.5 h-3.5 text-teal-600" />
                      <span>نموذج الفحص *</span>
                    </label>
                    <select
                      value={inspectionForm}
                      onChange={(e) => setInspectionForm(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                    >
                      {FIVE_STATE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* ملاحظات الجودة مع عنصرة الملاحظات والصور التوضيحية */}
                  <div className="p-3.5 rounded-2xl bg-white border-2 border-red-200 sm:col-span-2 space-y-2">
                    <label className="flex items-center justify-between text-xs font-black text-slate-900 mb-1">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-red-600" />
                        <span>ملاحظات الجودة والتدقيق (عنصرة الملاحظات مع الصور التوضيحية)</span>
                      </div>
                      <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                        يمكن إضافة صورة أو أكثر لكل ملاحظة
                      </span>
                    </label>
                    <QualityNotesEditor
                      order={order}
                      initialItems={qualityNoteItems}
                      initialNotes={qualityNotes}
                      onChange={(items, textSummary) => {
                        setQualityNoteItems(items);
                        setQualityNotes(textSummary);
                      }}
                    />
                  </div>

                  {/* حالة أمر العمل */}
                  <div className="p-3.5 rounded-xl bg-red-50/50 border border-red-200">
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                        <CheckCircle2 className="w-4 h-4 text-red-700" />
                        <span>حالة أمر العمل لإجراء 155 *</span>
                      </label>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        String(procedure155Status || '').includes('مؤهل') && !String(procedure155Status || '').includes('غير')
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}>
                        {procedure155Status}
                      </span>
                    </div>
                    <select
                      value={procedure155Status}
                      onChange={(e) => setProcedure155Status(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-red-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                    >
                      <option value="مؤهل للاغلاق">مؤهل للاغلاق</option>
                      <option value="غير مؤهل للاغلاق">غير مؤهل للاغلاق</option>
                      <option value="مؤهل للاغلاق ( معتمد )">مؤهل للاغلاق ( معتمد )</option>
                      <option value="غير مؤهل للأغلاق">غير مؤهل للأغلاق</option>
                    </select>
                  </div>

                  {/* حالة اجراء 155 */}
                  <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                        <CheckCircle2 className="w-4 h-4 text-blue-700" />
                        <span>حالة اجراء 155</span>
                      </label>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        !procedure155
                          ? 'bg-slate-100 text-slate-500 border-slate-300'
                          : procedure155.includes('غير')
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}>
                        {procedure155 || 'فارغ (بانتظار التدقيق)'}
                      </span>
                    </div>
                    <select
                      value={procedure155}
                      onChange={(e) => setProcedure155(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-blue-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— فارغ (بانتظار التدقيق) —</option>
                      <option value="تم اجراء 155">تم اجراء 155</option>
                      <option value="غير مؤهل لاجراء 155">غير مؤهل لاجراء 155</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Note about Dark Red styling upon saving */}
            <div className="p-3 rounded-xl bg-red-950 text-white flex items-center gap-2.5 text-xs shadow-inner">
              <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span>
                <strong>تنبيه تمييز التعديل:</strong> بمجرد الحفظ، سيأخذ هذا السطر في الجدول <strong>لوناً أحمر غامقاً فورياً</strong> مع علامة (مُعدّل) لمنع الخلط بينه وبين بقية الأوامر أثناء العمل.
              </span>
            </div>

            {/* Modal Actions Footer */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold text-xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف أمر العمل</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 active:bg-red-900 text-white font-bold text-xs shadow-md shadow-red-700/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ التعديلات واعتماد السطر المعدل</span>
                </button>
              </div>
            </div>

          </form>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isConfirmDeleteOpen && onDelete && (
        <ConfirmDeleteModal
          isOpen={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          onConfirm={() => {
            setIsConfirmDeleteOpen(false);
            onDelete(order.id);
            onClose();
          }}
          title="تأكيد حذف أمر العمل"
          message={`هل أنت متأكد من رغبتك في حذف أمر العمل (${order.workOrderNumber}) للمقاول (${order.contractor}) نهائياً؟`}
          confirmText="حذف نهائي"
        />
      )}
    </>
  );
};
