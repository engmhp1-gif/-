import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  X, 
  PlusCircle, 
  FileSpreadsheet, 
  FileDown, 
  BarChart3, 
  Building2, 
  Briefcase, 
  Bell, 
  ShieldCheck, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Trash2, 
  Calendar, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  CornerDownLeft,
  Sparkles,
  Command,
  Sliders,
  History
} from 'lucide-react';
import { WorkOrder, SubOffice, PlatformUser } from '../types';
import { hasUserPermission } from '../utils/security';

export interface CommandAction {
  id: string;
  title: string;
  category: 'إجراءات سريعة' | 'أوامر العمل' | 'تقارير وتحليلات' | 'إدارة وتخصيص' | 'أدوات النظام';
  icon: React.ReactNode;
  shortcut?: string;
  badge?: string;
  perform: () => void;
  permission?: string;
}

interface QuickCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  orders: WorkOrder[];
  offices: SubOffice[];
  onSelectOrder: (order: WorkOrder) => void;
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
  onOpenExportModal: () => void;
  onOpenWeeklyReport: () => void;
  onOpenOfficeComparison: () => void;
  onOpenManageOffices: () => void;
  onOpenManageContractors: () => void;
  onOpenNotificationSettings: () => void;
  onOpenDataRecovery: () => void;
  onOpenRestoreDeleted: () => void;
  onManualSync: () => void;
  isSoundMuted: boolean;
  onToggleSound: () => void;
  onSelectOffice: (office: string) => void;
  onSetKpiFilter: (filter: any) => void;
  onOpenCreateTableModal?: () => void;
  onOpenSmartAudit?: () => void;
  onOpenContractorComparison?: () => void;
  onOpenCompatibleImport?: () => void;
  currentUser?: PlatformUser | null;
}

export const QuickCommandPalette: React.FC<QuickCommandPaletteProps> = ({
  isOpen,
  onClose,
  orders,
  offices,
  onSelectOrder,
  onOpenAddModal,
  onOpenImportModal,
  onOpenExportModal,
  onOpenWeeklyReport,
  onOpenOfficeComparison,
  onOpenManageOffices,
  onOpenManageContractors,
  onOpenNotificationSettings,
  onOpenDataRecovery,
  onOpenRestoreDeleted,
  onManualSync,
  isSoundMuted,
  onToggleSound,
  onSelectOffice,
  onSetKpiFilter,
  onOpenSmartAudit,
  onOpenContractorComparison,
  onOpenCompatibleImport,
  currentUser
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Static Platform Commands (Filtered strictly by permissions so unauthorized commands are completely hidden)
  const baseCommands: CommandAction[] = useMemo(() => {
    const list: CommandAction[] = [
      {
        id: 'cmd-add-order',
        title: 'إضافة أمر عمل جديد',
        category: 'إجراءات سريعة',
        icon: <PlusCircle className="w-4 h-4 text-emerald-500" />,
        shortcut: 'Alt + N',
        perform: () => { onClose(); onOpenAddModal(); },
        permission: 'addWorkOrder'
      },
      {
        id: 'cmd-import-excel',
        title: 'استيراد أوامر العمل من ملف Excel',
        category: 'إجراءات سريعة',
        icon: <FileSpreadsheet className="w-4 h-4 text-teal-500" />,
        shortcut: 'Alt + I',
        badge: 'إكسل ذكي',
        perform: () => { onClose(); onOpenImportModal(); },
        permission: 'importExcel'
      },
      {
        id: 'cmd-export',
        title: 'تصدير البيانات المعتمدة (Excel / PDF / صورة)',
        category: 'إجراءات سريعة',
        icon: <FileDown className="w-4 h-4 text-purple-500" />,
        shortcut: 'Alt + E',
        perform: () => { onClose(); onOpenExportModal(); },
        permission: 'exportTable'
      },
      {
        id: 'cmd-weekly-report',
        title: 'التقرير الأسبوعي لإنجازات المكاتب والمقاولين (PDF)',
        category: 'تقارير وتحليلات',
        icon: <BarChart3 className="w-4 h-4 text-blue-500" />,
        badge: 'تقرير رسمي',
        perform: () => { onClose(); onOpenWeeklyReport(); },
        permission: 'viewWeeklyReport'
      },
      {
        id: 'cmd-office-compare',
        title: 'مقارنة وتقييم أداء المكاتب الفرعية',
        category: 'تقارير وتحليلات',
        icon: <Sparkles className="w-4 h-4 text-amber-500" />,
        perform: () => { onClose(); onOpenOfficeComparison(); },
        permission: 'viewOfficeComparison'
      },

      {
        id: 'cmd-contractor-compare',
        title: 'مقارنة المقاولين وتقارير الإغلاق الدورية',
        category: 'تقارير وتحليلات',
        icon: <Briefcase className="w-4 h-4 text-teal-400" />,
        badge: 'دوري',
        perform: () => { onClose(); onOpenContractorComparison?.(); },
        permission: 'viewContractorClosureReport'
      },
      {
        id: 'cmd-filter-ready',
        title: 'عرض أوامر العمل المؤهلة للإغلاق فقط',
        category: 'أوامر العمل',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
        perform: () => { onClose(); onSetKpiFilter('ready'); },
        permission: 'searchAndFilter'
      },
      {
        id: 'cmd-filter-not-ready',
        title: 'عرض أوامر العمل غير المؤهلة للإغلاق (النواقص)',
        category: 'أوامر العمل',
        icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,
        perform: () => { onClose(); onSetKpiFilter('not_ready'); },
        permission: 'searchAndFilter'
      },
      {
        id: 'cmd-filter-all',
        title: 'عرض كافة أوامر العمل بدون تصفية',
        category: 'أوامر العمل',
        icon: <Command className="w-4 h-4 text-slate-400" />,
        perform: () => { onClose(); onSetKpiFilter('all'); },
        permission: 'searchAndFilter'
      },
      {
        id: 'cmd-manage-offices',
        title: 'إدارة المكاتب الفرعية (إضافة / تعديل / حذف)',
        category: 'إدارة وتخصيص',
        icon: <Building2 className="w-4 h-4 text-indigo-500" />,
        perform: () => { onClose(); onOpenManageOffices(); },
        permission: 'manageOffices'
      },
      {
        id: 'cmd-manage-contractors',
        title: 'توزيع وربط مقاولي المكاتب المعتمدين',
        category: 'إدارة وتخصيص',
        icon: <Briefcase className="w-4 h-4 text-amber-500" />,
        perform: () => { onClose(); onOpenManageContractors(); },
        permission: 'manageContractors'
      },
      {
        id: 'cmd-notifications',
        title: 'مركز الإشعارات الفورية (حتى والمنصة مغلقة 24/7)',
        category: 'أدوات النظام',
        icon: <Bell className="w-4 h-4 text-amber-500" />,
        badge: 'تنبيهات حية',
        perform: () => { onClose(); onOpenNotificationSettings(); },
        permission: 'manageNotifications'
      },
      {
        id: 'cmd-data-recovery',
        title: 'مركز الأمان السحابي واستعادة النسخ الاحتياطية',
        category: 'أدوات النظام',
        icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
        perform: () => { onClose(); onOpenDataRecovery(); },
        permission: 'restoreDeleted'
      },

      {
        id: 'cmd-sync',
        title: 'المزامنة السحابية الفورية مع الخادم',
        category: 'أدوات النظام',
        icon: <RotateCw className="w-4 h-4 text-blue-500" />,
        perform: () => { onClose(); onManualSync(); }
      },
      {
        id: 'cmd-toggle-sound',
        title: isSoundMuted ? 'تفعيل التنبيهات الصوتية' : 'كتم التنبيهات الصوتية',
        category: 'أدوات النظام',
        icon: isSoundMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-blue-400" />,
        perform: () => { onToggleSound(); }
      }
    ];

    return list.filter(cmd => !cmd.permission || hasUserPermission(currentUser, cmd.permission));
  }, [
    onClose, onOpenAddModal, onOpenImportModal, onOpenExportModal,
    onOpenWeeklyReport, onOpenOfficeComparison, onOpenManageOffices,
    onOpenManageContractors, onOpenNotificationSettings, onOpenDataRecovery,
    onOpenRestoreDeleted, onManualSync, isSoundMuted, onToggleSound, onSetKpiFilter,
    currentUser
  ]);

  // Dynamic Search Across Orders and Offices
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return baseCommands;
    }

    const matchedCommands = baseCommands.filter(c => 
      c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );

    // Search inside WorkOrders
    const matchedOrders = orders.filter(o => 
      (o.workOrderNumber && o.workOrderNumber.toLowerCase().includes(q)) ||
      (o.contractor && o.contractor.toLowerCase().includes(q)) ||
      (o.office && o.office.toLowerCase().includes(q)) ||
      (o.workOrderCode && o.workOrderCode.toLowerCase().includes(q)) ||
      (o.procedure155Status && o.procedure155Status.toLowerCase().includes(q))
    ).slice(0, 12).map(o => ({
      id: `order-${o.id}`,
      title: `أمر عمل: ${o.workOrderNumber || 'بدون رقم'} (${o.office || ''} - ${o.contractor || ''})`,
      category: 'أوامر العمل' as const,
      icon: o.procedure155Status?.includes('مؤهل') ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-amber-500" />
      ),
      badge: o.procedure155Status || 'قيد المتابعة',
      perform: () => {
        onClose();
        onSelectOrder(o);
      }
    }));

    // Search inside Offices
    const matchedOffices = offices.filter(off => 
      off.name.toLowerCase().includes(q) || (off.code && off.code.toLowerCase().includes(q))
    ).map(off => ({
      id: `office-${off.id}`,
      title: `تصفية حسب: ${off.name}`,
      category: 'إدارة وتخصيص' as const,
      icon: <Building2 className="w-4 h-4 text-emerald-500" />,
      badge: `${orders.filter(w => w.office === off.name).length} أمر عمل`,
      perform: () => {
        onClose();
        onSelectOffice(off.name);
      }
    }));

    return [...matchedCommands, ...matchedOrders, ...matchedOffices];
  }, [query, baseCommands, orders, offices, onClose, onSelectOrder, onSelectOffice]);

  // Keyboard Navigation: Up, Down, Enter, Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].perform();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-3 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150 font-['Cairo',sans-serif]">
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 bg-slate-50/80">
          <Search className="w-5 h-5 text-emerald-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="ابحث عن أمر عمل، مكتب، مقاول، أو اكتب أي إجراء تريده..."
            className="flex-1 bg-transparent border-0 outline-hidden text-sm sm:text-base font-bold text-slate-800 placeholder:text-slate-400 text-right"
          />
          {query ? (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-200/80 px-2 py-0.5 rounded border border-slate-300">
              <span>ESC للإغلاق</span>
            </div>
          )}
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-slate-100"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-sm font-bold text-slate-600">لا توجد نتائج مطابقة لـ "{query}"</p>
              <p className="text-xs text-slate-400 mt-1">جرب البحث برقم أمر العمل أو اسم المكتب أو الإجراء المطلوب</p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-selected={isSelected}
                  onClick={item.perform}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all select-none ${
                    isSelected 
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md' 
                      : 'hover:bg-slate-100/80 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs sm:text-sm font-black truncate ${
                          isSelected ? 'text-white' : 'text-slate-900'
                        }`}>
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                            isSelected 
                              ? 'bg-white/25 text-white' 
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] block mt-0.5 ${
                        isSelected ? 'text-emerald-100' : 'text-slate-400'
                      }`}>
                        {item.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {'shortcut' in item && Boolean((item as any).shortcut) && (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        isSelected 
                          ? 'border-white/30 text-white bg-white/10' 
                          : 'border-slate-200 text-slate-400 bg-slate-100'
                      }`}>
                        {(item as any).shortcut}
                      </span>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-white animate-pulse" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 select-none">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">↓</kbd>
              <span>للتنقل</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">↵</kbd>
              <span>للاختيار والتنفيذ</span>
            </span>
          </div>
          <span className="font-mono text-[10px] text-emerald-700 font-bold">
            Ctrl + K / ⌘ + K
          </span>
        </div>
      </div>
    </div>
  );
};
