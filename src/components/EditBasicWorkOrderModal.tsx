import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Building2, 
  Hash, 
  Tag, 
  Calendar,
  Edit3,
  CheckCircle2
} from 'lucide-react';
import { 
  WorkOrder, 
  SubOffice, 
  DropdownOptionsMap 
} from '../types';
import { OfficeContractorSelect } from './OfficeContractorSelect';
import { getContractorsForOffice, getConsultantsForOffice } from '../services/contractorService';
import { getSavedCurrentUser } from '../utils/security';

interface EditBasicWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: WorkOrder | null;
  onSave: (updatedOrder: WorkOrder) => void;
  offices: SubOffice[];
  dropdownOptions?: DropdownOptionsMap;
  onUpdateOfficeContractors?: (officeName: string, contractors: string[]) => void;
  onAddContractor?: (officeName: string, contractorName: string) => void;
  onDeleteContractor?: (officeName: string, contractorName: string) => void;
  onUpdateOfficeConsultants?: (officeName: string, consultants: string[]) => void;
  onAddConsultant?: (officeName: string, consultantName: string) => void;
  onDeleteConsultant?: (officeName: string, consultantName: string) => void;
}

export const EditBasicWorkOrderModal: React.FC<EditBasicWorkOrderModalProps> = ({
  isOpen,
  onClose,
  order,
  onSave,
  offices,
  dropdownOptions,
  onUpdateOfficeContractors,
  onAddContractor,
  onDeleteContractor,
  onUpdateOfficeConsultants,
  onAddConsultant,
  onDeleteConsultant
}) => {
  const [office, setOffice] = useState('');
  const [contractor, setContractor] = useState('');
  const [consultant, setConsultant] = useState('');
  const [workOrderNumber, setWorkOrderNumber] = useState('');
  const [workOrderCode, setWorkOrderCode] = useState('');
  const [receiptDate, setReceiptDate] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      const activeOff = order.office || (offices[0]?.name || 'مكتب عرعر');
      setOffice(activeOff);
      setContractor(order.contractor || '');
      const consultants = getConsultantsForOffice(activeOff, dropdownOptions?.officeConsultants, offices);
      setConsultant(order.consultant || consultants[0] || '');
      setWorkOrderNumber(order.workOrderNumber || '');
      setWorkOrderCode(order.workOrderCode || '');
      setReceiptDate(order.receiptDate || (order.createdAt ? order.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)));
      setValidationError(null);
    }
  }, [order, offices, dropdownOptions]);

  // Synchronous automatic contractor & consultant link when user changes office
  const handleOfficeChange = (newOffice: string) => {
    setOffice(newOffice);
    const contractors = getContractorsForOffice(newOffice, dropdownOptions?.officeContractors, offices);
    if (contractors.length > 0) {
      setContractor(contractors[0]);
    } else {
      setContractor('');
    }
    const consultants = getConsultantsForOffice(newOffice, dropdownOptions?.officeConsultants, offices);
    if (consultants.length > 0) {
      setConsultant(consultants[0]);
    } else {
      setConsultant('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    if (!workOrderNumber.trim()) {
      setValidationError('يرجى إدخال رقم أمر العمل');
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

    const updated: WorkOrder = {
      ...order,
      office,
      contractor,
      consultant,
      workOrderNumber: workOrderNumber.trim(),
      workOrderCode: workOrderCode.trim(),
      receiptDate: receiptDate.trim() || order.receiptDate || new Date().toISOString().slice(0, 10),
      statusSyncTime: formattedSyncTime,
      statusSyncEmail: userEmail,
      statusSyncUser: userName,
      lastUpdatedBy: userEmail || userName,
      isEdited: true,
      lastEditedAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    onSave(updated);
    onClose();
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full my-6 overflow-hidden flex flex-col text-right animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Edit3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">
                  تعديل بيانات أمر العمل
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {order.workOrderNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                تعديل البيانات الأساسية (المكتب - المقاول - الاستشاري - رقم أمر العمل - نوع أمر العمل)
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold animate-in fade-in">
              {validationError}
            </div>
          )}

          {/* 1 & 2: Office & Contractor & Consultant with direct linkage */}
          <div className="p-4 rounded-xl bg-slate-50/90 border border-slate-200 space-y-3">
            <OfficeContractorSelect
              offices={offices}
              selectedOffice={office}
              value={contractor}
              onChange={setContractor}
              selectedContractor={contractor}
              onSelectOffice={handleOfficeChange}
              onSelectContractor={setContractor}
              entityType="contractor"
              officeContractorsMap={dropdownOptions?.officeContractors}
              onUpdateOfficeContractors={onUpdateOfficeContractors}
              onAddContractor={onAddContractor}
              onDeleteContractor={onDeleteContractor}
            />
            <OfficeContractorSelect
              offices={offices}
              selectedOffice={office}
              value={consultant}
              onChange={setConsultant}
              selectedContractor={consultant}
              onSelectContractor={setConsultant}
              entityType="consultant"
              label="2ب. الاستشاري (اسم الاستشاري المشرف المعتمد) *"
              officeContractorsMap={dropdownOptions?.officeConsultants}
              onUpdateOfficeContractors={onUpdateOfficeConsultants}
              onAddContractor={onAddConsultant}
              onDeleteContractor={onDeleteConsultant}
            />
          </div>

          {/* 3. Work Order Number */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Hash className="w-4 h-4 text-blue-600" />
              <span>رقم أمر العمل *</span>
            </label>
            <input
              type="text"
              required
              value={workOrderNumber}
              onChange={(e) => {
                setWorkOrderNumber(e.target.value);
                setValidationError(null);
              }}
              placeholder="مثال: WO-2025-0914"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-sm font-bold bg-white text-slate-900"
            />
          </div>

          {/* 4. Work Order Code (نوع أمر العمل) */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Tag className="w-4 h-4 text-amber-600" />
              <span>نوع أمر العمل</span>
            </label>
            <input
              type="text"
              value={workOrderCode}
              onChange={(e) => {
                setWorkOrderCode(e.target.value);
                setValidationError(null);
              }}
              placeholder="أدخل نوع أمر العمل"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm font-bold bg-white text-slate-900"
            />
          </div>

          {/* 4b. Receipt Date */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>تاريخ الاستلام *</span>
            </label>
            <input
              type="date"
              required
              value={receiptDate}
              onChange={(e) => {
                setReceiptDate(e.target.value);
                setValidationError(null);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm font-bold bg-white text-slate-900"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>حفظ البيانات الأساسية</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
