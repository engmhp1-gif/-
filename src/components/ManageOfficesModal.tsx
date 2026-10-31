import React, { useState } from 'react';
import { SubOffice, WorkOrder } from '../types';
import { 
  Building2, 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  Search, 
  MapPin, 
  User, 
  Phone, 
  ClipboardList, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRightLeft,
  Sparkles,
  Info
} from 'lucide-react';

interface ManageOfficesModalProps {
  isOpen: boolean;
  onClose: () => void;
  offices: SubOffice[];
  workOrders: WorkOrder[];
  onAddNewOffice: (office: Partial<SubOffice>) => Promise<void> | void;
  onUpdateOffice: (office: SubOffice, oldName?: string) => Promise<void> | void;
  onDeleteOffice: (officeId: string, officeName: string, reassignTo?: string) => Promise<void> | void;
  initialOfficeToEdit?: SubOffice | null;
}

export const ManageOfficesModal: React.FC<ManageOfficesModalProps> = ({
  isOpen,
  onClose,
  offices,
  workOrders,
  onAddNewOffice,
  onUpdateOffice,
  onDeleteOffice,
  initialOfficeToEdit = null
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'edit'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit State
  const [editingOffice, setEditingOffice] = useState<SubOffice | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editRegion, setEditRegion] = useState('');
  const [editManager, setEditManager] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add State
  const [addName, setAddName] = useState('');
  const [addCode, setAddCode] = useState('');
  const [addRegion, setAddRegion] = useState('');
  const [addManager, setAddManager] = useState('');
  const [addContact, setAddContact] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addError, setAddError] = useState('');

  // Delete State with Reassignment
  const [officeToDelete, setOfficeToDelete] = useState<SubOffice | null>(null);
  const [reassignTargetOffice, setReassignTargetOffice] = useState<string>('');

  // Initialize edit when initialOfficeToEdit is provided
  React.useEffect(() => {
    if (initialOfficeToEdit) {
      startEditOffice(initialOfficeToEdit);
    } else {
      setActiveTab('list');
      setEditingOffice(null);
    }
  }, [initialOfficeToEdit, isOpen]);

  if (!isOpen) return null;

  const startEditOffice = (office: SubOffice) => {
    setEditingOffice(office);
    setEditName(office.name);
    setEditCode(office.code || '');
    setEditRegion(office.region || '');
    setEditManager(office.manager || '');
    setEditContact(office.contactNumber || '');
    setEditDescription(office.description || '');
    setEditError('');
    setActiveTab('edit');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOffice) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError('يرجى إدخال اسم المكتب');
      return;
    }

    // Check duplicate name on another office
    const duplicate = offices.some(
      o => o.id !== editingOffice.id && o.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setEditError('يوجد مكتب آخر يحمل نفس هذا الاسم مسبقاً، يرجى اختيار اسم مختلف');
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
      setActiveTab('list');
    } catch (err: any) {
      setEditError(err?.message || 'حدث خطأ أثناء حفظ تعديل المكتب');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = addName.trim();
    if (!trimmedName) {
      setAddError('يرجى إدخال اسم المكتب');
      return;
    }

    // Check duplicate
    if (offices.some(o => o.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
      setAddError('يوجد مكتب بهذا الاسم بالفعل');
      return;
    }

    setIsSubmitting(true);
    setAddError('');
    try {
      await onAddNewOffice({
        name: trimmedName,
        code: addCode.trim() || `OFF-${Date.now().toString().slice(-4)}`,
        region: addRegion.trim() || 'المنطقة الحضرية',
        manager: addManager.trim() || 'مدير المكتب الميداني',
        contactNumber: addContact.trim() || '0500000000',
        description: addDescription.trim() || 'مكتب فرعي لإدارة ومتابعة أوامر العمل الميدانية'
      });

      // Reset
      setAddName('');
      setAddCode('');
      setAddRegion('');
      setAddManager('');
      setAddContact('');
      setAddDescription('');
      setActiveTab('list');
    } catch (err: any) {
      setAddError(err?.message || 'حدث خطأ أثناء إضافة المكتب');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startDeleteOffice = (office: SubOffice) => {
    if (offices.length <= 1) {
      alert('لا يمكن حذف كافة المكاتب، يجب الإبقاء على مكتب فرعي واحد على الأقل في النظام.');
      return;
    }
    setOfficeToDelete(office);
    // Find default reassign target (first other office)
    const otherOffice = offices.find(o => o.id !== office.id);
    setReassignTargetOffice(otherOffice ? otherOffice.name : '');
  };

  const handleConfirmDelete = async () => {
    if (!officeToDelete) return;
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

  // Filtered offices
  const filteredOffices = offices.filter(o => 
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (o.code && o.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (o.manager && o.manager.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (o.region && o.region.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden text-right font-['Cairo',sans-serif] my-auto flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  إدارة المكاتب الفرعية وتوزيع الصلاحيات
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 font-mono">
                  {offices.length} مكاتب
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                تعديل، إضافة، وحذف المكاتب مع المزامنة الفورية لكافة أوامر العمل والقوائم المنسدلة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 pt-3 pb-2 bg-slate-50 border-b border-slate-200 shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('list');
                setEditingOffice(null);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>المكاتب المسجلة ({offices.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('add');
                setEditingOffice(null);
                setAddError('');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'add'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مكتب جديد</span>
            </button>

            {activeTab === 'edit' && editingOffice && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-white shadow-xs">
                <Pencil className="w-3.5 h-3.5" />
                <span>تعديل: {editingOffice.name}</span>
              </span>
            )}
          </div>

          {activeTab === 'list' && (
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="بحث في المكاتب..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-8 pl-3 py-1 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
              />
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          
          {/* TAB 1: LIST OF OFFICES */}
          {activeTab === 'list' && (
            <div className="space-y-3.5">
              {filteredOffices.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">لا توجد مكاتب مطابقة للبحث</p>
                  <p className="text-xs text-slate-400 mt-1">يمكنك إضافة مكتب جديد بالضغط على زر "إضافة مكتب جديد" بالأعلى</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredOffices.map((office) => {
                    const assignedOrders = workOrders.filter(w => w.office === office.name);
                    const readyCount = assignedOrders.filter(
                      w => w.procedure155Status === 'مؤهل للاستلام (معتمد)' || w.procedure155Status === 'تم الاستلام وإغلاق 155'
                    ).length;
                    const completionRate = assignedOrders.length > 0
                      ? Math.round((readyCount / assignedOrders.length) * 100)
                      : 0;

                    return (
                      <div 
                        key={office.id}
                        className="bg-white rounded-xl border border-slate-200/90 hover:border-blue-300 p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                      >
                        <div>
                          {/* Office Header */}
                          <div className="flex items-start justify-between gap-2 mb-2.5">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-black text-slate-900">
                                  {office.name}
                                </h3>
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  {office.code || 'بدون رمز'}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                <span>{office.region || 'المنطقة الحضرية'}</span>
                              </span>
                            </div>

                            {/* Orders count badge */}
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
                              <span>{assignedOrders.length} أمر عمل</span>
                            </span>
                          </div>

                          {/* Details Details Grid */}
                          <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded-lg bg-slate-50/80 text-xs text-slate-700 border border-slate-100">
                            <div className="flex items-center gap-1.5 truncate">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{office.manager || 'المشرف الميداني'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 truncate">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-mono text-[11px]" dir="ltr">{office.contactNumber || '0500000000'}</span>
                            </div>
                            <div className="col-span-2 flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                              <span>نسبة الجاهزية لإجراء 155:</span>
                              <span className="font-bold text-emerald-700 font-mono">
                                {completionRate}% ({readyCount} جاهز)
                              </span>
                            </div>
                          </div>

                          {office.description && (
                            <p className="text-[11px] text-slate-500 mb-3 line-clamp-2">
                              {office.description}
                            </p>
                          )}
                        </div>

                        {/* Actions Bottom Bar */}
                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                          <span className="text-[10px] text-slate-400 font-mono">
                            ID: {office.id.slice(-6)}
                          </span>

                          <div className="flex items-center gap-2">
                            {/* زر التعديل */}
                            <button
                              type="button"
                              onClick={() => startEditOffice(office)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                              title="تعديل بيانات المكتب واسمه"
                            >
                              <Pencil className="w-3.5 h-3.5 text-amber-600" />
                              <span>تعديل</span>
                            </button>

                            {/* زر الحذف */}
                            <button
                              type="button"
                              onClick={() => startDeleteOffice(office)}
                              disabled={offices.length <= 1}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                offices.length <= 1
                                  ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                                  : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                              }`}
                              title={offices.length <= 1 ? "لا يمكن حذف المكتب الوحيد المتبقي" : "حذف هذا المكتب"}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADD NEW OFFICE */}
          {activeTab === 'add' && (
            <div className="max-w-2xl mx-auto bg-slate-50/70 p-5 rounded-2xl border border-slate-200">
              <div className="mb-4">
                <h3 className="text-base font-black text-slate-900">
                  إضافة وتفعيل مكتب فرعي جديد
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  سيتم تسجيل المكتب في المنظومة وإتاحته فورياً في كافة القوائم المنسدلة وجدول أوامر العمل
                </p>
              </div>

              {addError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <form onSubmit={handleSaveAdd} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      اسم المكتب الفرعي *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: مكتب الدرعية / مكتب شمال الرياض"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      رمز المكتب الفرعي (كود)
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: OFF-DRY (يُولّد تلقائياً إن تُرِك فارغاً)"
                      value={addCode}
                      onChange={(e) => setAddCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      القطاع / المنطقة الجغرافية
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: القطاع الغربي"
                      value={addRegion}
                      onChange={(e) => setAddRegion(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      المهندس المشرف / المدير المسؤول
                    </label>
                    <input
                      type="text"
                      placeholder="اسم المشرف أو مدير المكتب"
                      value={addManager}
                      onChange={(e) => setAddManager(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      رقم الهاتف / الاتصال الميداني
                    </label>
                    <input
                      type="text"
                      placeholder="05XXXXXXXX"
                      value={addContact}
                      onChange={(e) => setAddContact(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium bg-white font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      الوصف والمهام
                    </label>
                    <input
                      type="text"
                      placeholder="مكتب لمتابعة أوامر العمل الميدانية بالقطاع"
                      value={addDescription}
                      onChange={(e) => setAddDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 cursor-pointer"
                  >
                    إلغاء والعودة
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isSubmitting ? 'جارٍ الحفظ...' : 'تأكيد وإضافة المكتب'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: EDIT EXISTING OFFICE */}
          {activeTab === 'edit' && editingOffice && (
            <div className="max-w-2xl mx-auto bg-slate-50/70 p-5 rounded-2xl border border-slate-200">
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-amber-600" />
                    <span>تعديل بيانات المكتب الفرعي ({editingOffice.name})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className="text-xs text-blue-600 hover:underline font-bold"
                  >
                    العودة للقائمة
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  قم بتعديل بيانات المكتب، وتأكد من صحة الاسم للربط مع أوامر العمل
                </p>
              </div>

              {/* Informative Auto-Sync Banner */}
              <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>ميزة التحديث والمزامنة الشاملة:</strong> في حال قمت بتعديل اسم المكتب من 
                  <span className="font-bold underline mx-1">({editingOffice.name})</span> إلى اسم جديد، 
                  سيقوم النظام تلقائياً بتحديث كافة أوامر العمل 
                  <strong> ({workOrders.filter(w => w.office === editingOffice.name).length} أمر عمل)</strong> 
                  المسجلة على هذا المكتب فورياً وحفظها سحابياً دون أي تدخل يدوي!
                </div>
              </div>

              {editError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      اسم المكتب الفرعي *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="اسم المكتب"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-bold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      رمز المكتب الفرعي (كود)
                    </label>
                    <input
                      type="text"
                      placeholder="كود المكتب"
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      القطاع / المنطقة الجغرافية
                    </label>
                    <input
                      type="text"
                      placeholder="القطاع أو المنطقة"
                      value={editRegion}
                      onChange={(e) => setEditRegion(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      المهندس المشرف / المدير المسؤول
                    </label>
                    <input
                      type="text"
                      placeholder="اسم المشرف"
                      value={editManager}
                      onChange={(e) => setEditManager(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      رقم الهاتف / الاتصال الميداني
                    </label>
                    <input
                      type="text"
                      placeholder="05XXXXXXXX"
                      value={editContact}
                      onChange={(e) => setEditContact(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium bg-white font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      الوصف والمهام
                    </label>
                    <input
                      type="text"
                      placeholder="الوصف والمهام"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 cursor-pointer"
                  >
                    إلغاء التعديل
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSubmitting ? 'جارٍ الحفظ والمزامنة...' : 'حفظ التعديلات وتحديث الأوامر'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>

        {/* Delete Confirmation Modal with Reassignment */}
        {officeToDelete && (
          <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 text-right font-['Cairo',sans-serif] animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    تأكيد حذف المكتب الفرعي
                  </h3>
                  <p className="text-xs text-slate-500">
                    حذف مكتب ({officeToDelete.name}) من النظام
                  </p>
                </div>
              </div>

              {/* Work orders attached warning */}
              {(() => {
                const attachedOrdersCount = workOrders.filter(w => w.office === officeToDelete.name).length;
                const otherOffices = offices.filter(o => o.id !== officeToDelete.id);

                return (
                  <div className="space-y-3 my-4">
                    {attachedOrdersCount > 0 ? (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                        <div className="font-bold flex items-center gap-1.5 mb-1.5 text-amber-800">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>تنبيه: يوجد ({attachedOrdersCount}) أمر عمل مسجل بهذا المكتب!</span>
                        </div>
                        <p className="text-[11px] text-amber-800/90 leading-relaxed mb-2.5">
                          لحماية سجلات أوامر العمل وتفادي فقدان البيانات، يرجى اختيار المكتب الفرعي البديل لنقل هذه الأوامر إليه تلقائياً:
                        </p>

                        <div className="flex items-center gap-2">
                          <ArrowRightLeft className="w-4 h-4 text-amber-700 shrink-0" />
                          <select
                            value={reassignTargetOffice}
                            onChange={(e) => setReassignTargetOffice(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
                          >
                            {otherOffices.map((o) => (
                              <option key={o.id} value={o.name}>
                                تحويل إلى: {o.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600">
                        هل أنت متأكد من حذف هذا المكتب الفرعي نهائياً؟ هذا الإجراء سيقوم بإزالته من القوائم المنسدلة ومؤشرات الأداء.
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
                  إلغاء التراجع
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'جارٍ الحذف...' : 'تأكيد الحذف النهائي'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
