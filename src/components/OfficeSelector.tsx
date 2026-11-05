import React, { useState } from 'react';
import { SubOffice, WorkOrder, PlatformUser } from '../types';
import { hasUserPermission } from '../utils/security';
import { 
  Building2, 
  MapPin, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  CheckCircle2, 
  Clock, 
  FileSpreadsheet, 
  Filter,
  Pencil,
  Trash2,
  SlidersHorizontal,
  ArrowRightLeft,
  AlertTriangle,
  Info,
  BarChart3,
  Briefcase
} from 'lucide-react';

interface OfficeSelectorProps {
  offices: SubOffice[];
  selectedOffice: string; // 'all' or office name
  onSelectOffice: (officeName: string) => void;
  workOrders: WorkOrder[];
  onAddNewOffice: (office: Partial<SubOffice>) => Promise<void> | void;
  onUpdateOffice?: (office: SubOffice, oldName?: string) => Promise<void> | void;
  onDeleteOffice?: (officeId: string, officeName: string, reassignTo?: string) => Promise<void> | void;
  onOpenManageOffices?: () => void;
  onOpenOfficeComparison?: () => void;
  onOpenManageContractors?: () => void;
  defaultExpanded?: boolean;
  currentUser?: PlatformUser | null;
}

export const OfficeSelector: React.FC<OfficeSelectorProps> = ({
  offices,
  selectedOffice,
  onSelectOffice,
  workOrders,
  onAddNewOffice,
  onUpdateOffice,
  onDeleteOffice,
  onOpenManageOffices,
  onOpenOfficeComparison,
  onOpenManageContractors,
  defaultExpanded = false,
  currentUser
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  
  // Add modal state
  const [showAddOfficeModal, setShowAddOfficeModal] = useState(false);
  const [newOfficeName, setNewOfficeName] = useState('');
  const [newOfficeCode, setNewOfficeCode] = useState('');
  const [newOfficeRegion, setNewOfficeRegion] = useState('');
  const [newOfficeManager, setNewOfficeManager] = useState('');
  const [newOfficeContact, setNewOfficeContact] = useState('');
  const [newOfficeDescription, setNewOfficeDescription] = useState('');
  const [addError, setAddError] = useState('');

  // Quick Edit modal state
  const [editingOffice, setEditingOffice] = useState<SubOffice | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editRegion, setEditRegion] = useState('');
  const [editManager, setEditManager] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState('');

  // Delete state
  const [officeToDelete, setOfficeToDelete] = useState<SubOffice | null>(null);
  const [reassignTargetOffice, setReassignTargetOffice] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate statistics for currently selected view
  const currentOrders = selectedOffice === 'all' 
    ? workOrders 
    : workOrders.filter(w => w.office === selectedOffice);

  const readyFor155Count = currentOrders.filter(
    w => w.procedure155Status === 'مؤهل للاستلام (معتمد)' || w.procedure155Status === 'تم الاستلام وإغلاق 155'
  ).length;

  const pendingNotesCount = currentOrders.filter(
    w => w.procedure155Status === 'بانتظار استيفاء الملاحظات' || String(w.procedure155Status || '').includes('غير مؤهل')
  ).length;

  const boqModifiedCount = currentOrders.filter(
    w => w.boqModification.includes('نعم')
  ).length;

  const auditedRate = currentOrders.length > 0 
    ? Math.round((readyFor155Count / currentOrders.length) * 100) 
    : 0;

  const handleCreateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newOfficeName.trim();
    if (!trimmed) {
      setAddError('يرجى كتابة اسم المكتب الفرعي');
      return;
    }

    if (offices.some(o => o.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      setAddError('يوجد مكتب بهذا الاسم بالفعل');
      return;
    }

    setIsSubmitting(true);
    setAddError('');
    try {
      await onAddNewOffice({
        name: trimmed,
        code: newOfficeCode.trim() || `OFF-${Date.now().toString().slice(-4)}`,
        region: newOfficeRegion.trim() || 'المنطقة الحضرية',
        manager: newOfficeManager.trim() || 'مدير المكتب الميداني',
        contactNumber: newOfficeContact.trim() || '0500000000',
        description: newOfficeDescription.trim() || 'مكتب فرعي لإدارة ومتابعة أوامر العمل الميدانية'
      });

      setNewOfficeName('');
      setNewOfficeCode('');
      setNewOfficeRegion('');
      setNewOfficeManager('');
      setNewOfficeContact('');
      setNewOfficeDescription('');
      setShowAddOfficeModal(false);
    } catch (err: any) {
      setAddError(err?.message || 'حدث خطأ أثناء إضافة المكتب');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditOffice = (off: SubOffice) => {
    setEditingOffice(off);
    setEditName(off.name);
    setEditCode(off.code || '');
    setEditRegion(off.region || '');
    setEditManager(off.manager || '');
    setEditContact(off.contactNumber || '');
    setEditDescription(off.description || '');
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOffice || !onUpdateOffice) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError('يرجى إدخال اسم المكتب');
      return;
    }

    const duplicate = offices.some(
      o => o.id !== editingOffice.id && o.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setEditError('يوجد مكتب آخر يحمل نفس هذا الاسم مسبقاً');
      return;
    }

    setIsSubmitting(true);
    setEditError('');
    try {
      const updated: SubOffice = {
        ...editingOffice,
        name: trimmedName,
        code: editCode.trim() || editingOffice.code,
        region: editRegion.trim() || 'المنطقة الحضرية',
        manager: editManager.trim() || 'مدير المكتب الميداني',
        contactNumber: editContact.trim() || '0500000000',
        description: editDescription.trim() || 'مكتب فرعي لإدارة ومتابعة أوامر العمل الميدانية'
      };

      await onUpdateOffice(updated, editingOffice.name);
      setEditingOffice(null);
    } catch (err: any) {
      setEditError(err?.message || 'حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startDeleteOffice = (off: SubOffice) => {
    if (offices.length <= 1) {
      alert('لا يمكن حذف كافة المكاتب، يجب الإبقاء على مكتب فرعي واحد على الأقل في النظام.');
      return;
    }
    setOfficeToDelete(off);
    const other = offices.find(o => o.id !== off.id);
    setReassignTargetOffice(other ? other.name : '');
  };

  const handleConfirmDelete = async () => {
    if (!officeToDelete || !onDeleteOffice) return;
    setIsSubmitting(true);
    try {
      await onDeleteOffice(officeToDelete.id, officeToDelete.name, reassignTargetOffice);
      setOfficeToDelete(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-[#002855]/15 shadow-sm mb-5 overflow-hidden transition-all text-right font-['Cairo',sans-serif]">
      
      {/* Dynamic Corporate Collapsible Header Bar */}
      <div 
        onClick={() => setIsExpanded(prev => !prev)}
        className="p-4 sm:p-5 bg-gradient-to-l from-[#001D40] via-[#002855] to-[#004B8D] border-b-2 border-[#F58220] text-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 cursor-pointer transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F58220] text-white flex items-center justify-center shadow-md shrink-0">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-white">
                إدارة المكاتب الفرعية ومؤشرات الإنجاز الميداني
              </h3>
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-black bg-white/15 text-[#FDB813] border border-white/20">
                {offices.length} مكاتب معتمدة
              </span>
            </div>
            <p className="text-xs text-blue-100 mt-0.5">
              فلترة أوامر العمل ومتابعة مؤشرات كل مكتب فرعي على حدة مع التعديل والإضافة وتوزيع المقاولين
            </p>
          </div>
        </div>

        {/* Right side: Active office status & collapse trigger */}
        <div className="flex items-center gap-2 justify-between sm:justify-end flex-wrap">
          {onOpenOfficeComparison && hasUserPermission(currentUser, 'viewOfficeComparison') && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenOfficeComparison();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black text-slate-950 bg-[#FDB813] hover:bg-amber-400 transition-colors shadow-xs cursor-pointer"
              title="عرض بيان مقارنة أداء وتوزيع حالات المكاتب الفرعية بالرسم البياني ومعاينة للتصدير"
            >
              <BarChart3 className="w-3.5 h-3.5 text-slate-950" />
              <span>مقارنة أداء المكاتب</span>
            </button>
          )}

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-white/15 text-white border border-white/20">
            <Filter className="w-3.5 h-3.5 text-[#FDB813]" />
            <span>المكتب النشط:</span>
            <strong className="text-[#FDB813]">{selectedOffice === 'all' ? 'جميع المكاتب' : selectedOffice}</strong>
            <span className="text-[10px] text-blue-200 font-mono">({currentOrders.length})</span>
          </span>

          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
          >
            <span>{isExpanded ? 'طي البطاقة' : 'فتح وتغيير المكتب'}</span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-[#FDB813]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#FDB813]" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Body */}
      {isExpanded && (
        <div className="p-4 pt-0 border-t border-slate-100 space-y-4 bg-[#F4F6F9]/60 animate-in fade-in duration-200">
          
          {/* Sub-Offices Tabs + Manage & Add Office Buttons */}
          <div className="flex items-center justify-between gap-3 pt-3 flex-wrap">
            
            <div className="flex items-center gap-2 flex-wrap py-1 flex-1">
              {/* All offices option */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectOffice('all');
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                  selectedOffice === 'all'
                    ? 'bg-[#002855] text-white shadow-xs border border-[#F58220]'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-[#F58220]" />
                <span>جميع المكاتب</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  selectedOffice === 'all' ? 'bg-[#F58220] text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {workOrders.length}
                </span>
              </button>

              {/* Each office button with quick edit & delete controls */}
              {offices.map((off) => {
                const count = workOrders.filter(w => w.office === off.name).length;
                const isSelected = selectedOffice === off.name;
                return (
                  <div 
                    key={off.id} 
                    className={`group/tab inline-flex items-center rounded-xl text-xs font-black whitespace-nowrap transition-all border shrink-0 ${
                      isSelected
                        ? 'bg-[#004B8D] text-white border-[#F58220] shadow-xs'
                        : 'bg-white text-[#002855] border-slate-200 hover:border-[#004B8D] hover:bg-blue-50/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOffice(off.name);
                      }}
                      className="flex items-center gap-2 pl-2 pr-3.5 py-2 cursor-pointer focus:outline-hidden"
                    >
                      <Building2 className={`w-3.5 h-3.5 ${isSelected ? 'text-[#FDB813]' : 'text-[#004B8D]'}`} />
                      <span>{off.name}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        isSelected ? 'bg-[#002855] text-[#FDB813]' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {count}
                      </span>
                    </button>

                    {/* Quick action buttons for this office */}
                    {hasUserPermission(currentUser, 'manageOffices') && (
                      <div className="flex items-center gap-0.5 mr-1 pr-1.5 pl-1.5 border-r border-slate-200/40 opacity-70 group-hover/tab:opacity-100 transition-opacity">
                        {/* زر التعديل المباشر */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditOffice(off);
                          }}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${
                            isSelected 
                              ? 'text-white/80 hover:text-white hover:bg-blue-700' 
                              : 'text-slate-400 hover:text-amber-700 hover:bg-amber-50'
                          }`}
                          title={`تعديل بيانات مكتب (${off.name})`}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>

                        {/* زر الحذف المباشر */}
                        {onDeleteOffice && offices.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startDeleteOffice(off);
                            }}
                            className={`p-1 rounded-md transition-colors cursor-pointer ${
                              isSelected 
                                ? 'text-white/80 hover:text-white hover:bg-rose-700' 
                                : 'text-slate-400 hover:text-rose-700 hover:bg-rose-50'
                            }`}
                            title={`حذف مكتب (${off.name})`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Management & Add Office Buttons */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Performance Comparison Modal Button */}
              {onOpenOfficeComparison && hasUserPermission(currentUser, 'viewOfficeComparison') && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenOfficeComparison();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-colors shrink-0 cursor-pointer shadow-2xs"
                  title="عرض بيان مقارنة أداء وتوزيع حالات المكاتب الفرعية بالرسم البياني ومعاينة للتصدير"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-amber-700" />
                  <span>مقارنة أداء المكاتب</span>
                </button>
              )}

              {/* Manage Contractors Distribution Button */}
              {onOpenManageContractors && hasUserPermission(currentUser, 'manageContractors') && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenManageContractors();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors shrink-0 cursor-pointer shadow-2xs"
                  title="إدارة وتوزيع مقاولي المكاتب الفرعية المعتمدين"
                >
                  <Briefcase className="w-3.5 h-3.5 text-indigo-700" />
                  <span>توزيع المقاولين</span>
                </button>
              )}

              {/* Full Manage Offices Modal Button */}
              {onOpenManageOffices && hasUserPermission(currentUser, 'manageOffices') && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenManageOffices();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors shrink-0 cursor-pointer shadow-2xs"
                  title="فتح نافذة الإدارة الشاملة للمكاتب الفرعية"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                  <span>إدارة وتعديل المكاتب</span>
                </button>
              )}

              {/* Add New Sub-office button */}
              {hasUserPermission(currentUser, 'manageOffices') && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddError('');
                    setShowAddOfficeModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors shrink-0 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة مكتب فرعي</span>
                </button>
              )}
            </div>
          </div>

          {/* Key Progress Metrics for the active office */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-slate-800">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block mb-1">أوامر المكتب المحدد</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-slate-900">{currentOrders.length}</span>
                <span className="text-[11px] text-slate-500 font-bold">أمر عمل</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <span className="text-[11px] text-emerald-800 font-bold block mb-1">جاهز لإجراء 155</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-emerald-700">{readyFor155Count}</span>
                <span className="text-[11px] font-bold text-emerald-600">{auditedRate}%</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200">
              <span className="text-[11px] text-amber-800 font-bold block mb-1">معلق لنواقص وملاحظات</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-amber-700">{pendingNotesCount}</span>
                <span className="text-[11px] text-amber-600 font-bold">أمر معلق</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200">
              <span className="text-[11px] text-indigo-800 font-bold block mb-1">تعديلات مقايسة</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-indigo-700">{boqModifiedCount}</span>
                <span className="text-[11px] text-indigo-600 font-bold">طلب تعديل</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Modal to add a new office */}
      {showAddOfficeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-right font-['Cairo',sans-serif] animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-black text-slate-900 mb-1">
              إضافة مكتب فرعي جديد للمنطقة
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              إدراج مكتب جديد لربط أوامر العمل الميدانية ومتابعة مراحل التنفيذ به
            </p>

            {addError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateOffice} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المكتب الفرعي *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مكتب شمال الرياض / مكتب الدرعية"
                  value={newOfficeName}
                  onChange={(e) => setNewOfficeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رمز المكتب</label>
                  <input
                    type="text"
                    placeholder="مثال: OFF-DRY"
                    value={newOfficeCode}
                    onChange={(e) => setNewOfficeCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">القطاع / المنطقة</label>
                  <input
                    type="text"
                    placeholder="مثال: القطاع الغربي"
                    value={newOfficeRegion}
                    onChange={(e) => setNewOfficeRegion(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المهندس المشرف</label>
                  <input
                    type="text"
                    placeholder="اسم المشرف"
                    value={newOfficeManager}
                    onChange={(e) => setNewOfficeManager(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    placeholder="05XXXXXXXX"
                    value={newOfficeContact}
                    onChange={(e) => setNewOfficeContact(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الوصف والمهام</label>
                <input
                  type="text"
                  placeholder="مكتب لمتابعة وإدارة أوامر العمل"
                  value={newOfficeDescription}
                  onChange={(e) => setNewOfficeDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddOfficeModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm"
                >
                  {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ وإدراج المكتب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Direct Edit Office Modal */}
      {editingOffice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-right font-['Cairo',sans-serif] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-amber-600" />
                <span>تعديل بيانات المكتب ({editingOffice.name})</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingOffice(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="mb-3 p-2 rounded-lg bg-blue-50 text-blue-900 text-[11px] flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
              <span>عند تعديل اسم المكتب، سيتم تلقائياً تحديث كافة أوامر العمل ({workOrders.filter(w => w.office === editingOffice.name).length} أمر) التابعة له فورياً.</span>
            </div>

            {editError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المكتب الفرعي *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رمز المكتب</label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">القطاع / المنطقة</label>
                  <input
                    type="text"
                    value={editRegion}
                    onChange={(e) => setEditRegion(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المشرف المسؤول</label>
                  <input
                    type="text"
                    value={editManager}
                    onChange={(e) => setEditManager(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={editContact}
                    onChange={(e) => setEditContact(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الوصف والمهام</label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingOffice(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-amber-600 text-white hover:bg-amber-700 cursor-pointer shadow-sm flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Office Modal with Smart Reassignment */}
      {officeToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 text-right font-['Cairo',sans-serif] animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  حذف المكتب الفرعي
                </h3>
                <p className="text-xs text-slate-500">
                  حذف مكتب ({officeToDelete.name}) نهائياً من المنظومة
                </p>
              </div>
            </div>

            {/* Check attached orders count */}
            {(() => {
              const count = workOrders.filter(w => w.office === officeToDelete.name).length;
              const others = offices.filter(o => o.id !== officeToDelete.id);

              return (
                <div className="space-y-3 my-3">
                  {count > 0 ? (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                      <div className="font-bold flex items-center gap-1 text-amber-800 mb-1">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>يوجد ({count}) أمر عمل مسجل بهذا المكتب!</span>
                      </div>
                      <p className="text-[11px] text-amber-800/90 leading-relaxed mb-2">
                        لحماية بيانات الأوامر من الفقدان، حدد المكتب البديل لتحويل الأوامر إليه تلقائياً:
                      </p>
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4 text-amber-700 shrink-0" />
                        <select
                          value={reassignTargetOffice}
                          onChange={(e) => setReassignTargetOffice(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
                        >
                          {others.map(o => (
                            <option key={o.id} value={o.name}>
                              تحويل إلى: {o.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600">
                      هل أنت متأكد من حذف هذا المكتب الفرعي نهائياً من قاعدة البيانات وقوائم النظام؟
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOfficeToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'جارٍ الحذف...' : 'تأكيد الحذف'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
