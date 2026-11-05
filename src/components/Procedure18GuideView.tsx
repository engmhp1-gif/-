import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Search,
  BookOpen,
  Sparkles,
  Check,
  HelpCircle,
  Zap,
  ChevronLeft,
  ChevronRight,
  Copy,
  RotateCcw,
  Layers,
  ListChecks,
  Filter,
  Eye
} from 'lucide-react';
import { WorkOrder, SubOffice, PlatformUser } from '../types';
import { AUDIT_CATEGORIES_META } from '../data/auditChecklistData';
import { renderAuditCategoryIcon } from './TechnicalSupportAuditModal';

interface Procedure18GuideViewProps {
  workOrders: WorkOrder[];
  offices: SubOffice[];
  currentUser?: PlatformUser | null;
  onOpenAuditModal?: (order: WorkOrder) => void;
}

export const Procedure18GuideView: React.FC<Procedure18GuideViewProps> = ({
  workOrders = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<'all' | 'pdcAudit' | 'constructionAudit' | 'procedure155Status'>('all');
  const [activeTabId, setActiveTabId] = useState<string>('cat-1');
  const [itemFilterQuery, setItemFilterQuery] = useState<string>('');
  const [checkedSimulatorItems, setCheckedSimulatorItems] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeQuickSubmenuId, setActiveQuickSubmenuId] = useState<string | null>(null);

  // The 18 Verification Categories/Stages (القوائم الإرشادية الـ 18 المعتمدة)
  const verificationCategories = useMemo(
    () =>
      AUDIT_CATEGORIES_META.map((cat, idx) => {
        const auditColumn: 'pdcAudit' | 'constructionAudit' | 'procedure155Status' =
          idx < 8 ? 'pdcAudit' : idx < 15 ? 'constructionAudit' : 'procedure155Status';
        const auditColumnLabel =
          auditColumn === 'pdcAudit'
            ? 'تدقيق PDC (محطات ومعدات التوزيع)'
            : auditColumn === 'constructionAudit'
            ? 'تدقيق الإنشاءات (الشبكات والعدادات)'
            : 'تدقيق المساندة الفنية (الحفريات والكابلات)';

        return {
          id: cat.id,
          key: cat.key,
          icon: cat.icon,
          index: idx,
          number: String(idx + 1).padStart(2, '0'),
          title: cat.title,
          description: cat.description,
          auditColumn,
          auditColumnLabel,
          items: cat.items
        };
      }),
    []
  );

  const totalChecklistItemsCount = useMemo(
    () => verificationCategories.reduce((acc, c) => acc + c.items.length, 0),
    [verificationCategories]
  );

  // Filtered vertical tabs
  const filteredCategories = useMemo(() => {
    return verificationCategories.filter((cat) => {
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        q === '' ||
        cat.title.toLowerCase().includes(q) ||
        cat.description.toLowerCase().includes(q) ||
        cat.items.some((item) => item.toLowerCase().includes(q));

      const matchGroup = selectedGroup === 'all' || cat.auditColumn === selectedGroup;
      return matchSearch && matchGroup;
    });
  }, [verificationCategories, searchTerm, selectedGroup]);

  // Ensure activeTabId is always valid within filteredCategories
  const activeCategory = useMemo(() => {
    const foundInFiltered = filteredCategories.find((c) => c.id === activeTabId);
    if (foundInFiltered) return foundInFiltered;
    if (filteredCategories.length > 0) return filteredCategories[0];
    return verificationCategories[0];
  }, [filteredCategories, activeTabId, verificationCategories]);

  // Filtered items inside the adjacent flyout panel
  const visibleActiveItems = useMemo(() => {
    if (!activeCategory) return [];
    const q = (itemFilterQuery || searchTerm).trim().toLowerCase();
    return activeCategory.items
      .map((text, idx) => ({ text, idx }))
      .filter((entry) => q === '' || entry.text.toLowerCase().includes(q));
  }, [activeCategory, itemFilterQuery, searchTerm]);

  // Count how many items are checked in the interactive simulation for the active category
  const activeCategoryCheckedCount = useMemo(() => {
    if (!activeCategory) return 0;
    return activeCategory.items.reduce((count, _, idx) => {
      return count + (checkedSimulatorItems[`${activeCategory.id}-${idx}`] ? 1 : 0);
    }, 0);
  }, [activeCategory, checkedSimulatorItems]);

  const handleToggleItemCheck = (catId: string, itemIdx: number) => {
    const key = `${catId}-${itemIdx}`;
    setCheckedSimulatorItems((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleCheckAllInActive = () => {
    if (!activeCategory) return;
    const allChecked = activeCategoryCheckedCount === activeCategory.items.length;
    setCheckedSimulatorItems((prev) => {
      const next = { ...prev };
      activeCategory.items.forEach((_, idx) => {
        next[`${activeCategory.id}-${idx}`] = !allChecked;
      });
      return next;
    });
  };

  const handleCopyCategoryItems = (cat: typeof activeCategory) => {
    if (!cat) return;
    const formatted = `${cat.number}. ${cat.title}\n` + cat.items.map((it, i) => `${i + 1}- ${it}`).join('\n');
    try {
      navigator.clipboard.writeText(formatted);
      setCopiedId(cat.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) {}
  };

  const handleNavigateAdjacentTab = (direction: 'prev' | 'next') => {
    if (filteredCategories.length === 0 || !activeCategory) return;
    const currentIdx = filteredCategories.findIndex((c) => c.id === activeCategory.id);
    if (currentIdx === -1) return;
    if (direction === 'prev' && currentIdx > 0) {
      setActiveTabId(filteredCategories[currentIdx - 1].id);
    } else if (direction === 'next' && currentIdx < filteredCategories.length - 1) {
      setActiveTabId(filteredCategories[currentIdx + 1].id);
    }
  };

  // Real platform statistics linked to the active checklist's audit column
  const relatedColumnStats = useMemo(() => {
    if (!activeCategory) return { total: 0, qualified: 0, disqualified: 0, pending: 0 };
    const total = workOrders.length;
    let qualified = 0;
    let disqualified = 0;
    workOrders.forEach((w) => {
      const val = String((w as any)[activeCategory.auditColumn] || '');
      if (val.includes('غير')) {
        disqualified++;
      } else if (val.includes('مؤهل') || val.includes('معتمد') || val.includes('تم') || val.includes('مكتمل')) {
        qualified++;
      }
    });
    const pending = Math.max(0, total - qualified - disqualified);
    return { total, qualified, disqualified, pending };
  }, [workOrders, activeCategory]);

  return (
    <div className="space-y-4 text-right font-['Cairo',sans-serif] animate-in fade-in duration-200" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-[#002855] via-[#003B73] to-[#004B8D] rounded-2xl p-4 sm:p-5 text-white shadow-lg border-b-4 border-[#F58220] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#F58220] text-white flex items-center justify-center shadow-md shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-lg bg-[#FDB813] text-slate-950 font-black text-xs">
                الدليل الإرشادي التفاعلي المعتمد
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/25 border border-emerald-400 text-emerald-200 font-mono text-xs font-black">
                18 تبويباً عمودياً • {totalChecklistItemsCount} بند فحص
              </span>
            </div>
            <h2 className="text-base sm:text-xl font-black text-white mt-1">
              دليل قوائم وبنود التدقيق الفني ومراحل التحقق — إجراء 155
            </h2>
            <p className="text-xs text-blue-100/90 mt-0.5">
              استعرض التبويبات العمودية على اليمين لتظهر القائمة المنبثقة التفاعلية المفصلة بجوارها مباشرة داخل نفس الصفحة
            </p>
          </div>
        </div>

        {/* Group Filter Pills (Highlighting the 3 Audit Columns in Dark Red #7F1D1D) */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white/10 p-1.5 rounded-xl border border-white/15 w-full lg:w-auto">
          <button
            type="button"
            onClick={() => setSelectedGroup('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              selectedGroup === 'all'
                ? 'bg-[#F58220] text-white shadow-xs'
                : 'text-blue-100 hover:bg-white/10'
            }`}
          >
            كافة القوائم (18)
          </button>
          <button
            type="button"
            onClick={() => setSelectedGroup('pdcAudit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border ${
              selectedGroup === 'pdcAudit'
                ? 'bg-[#7F1D1D] text-white border-[#FDB813] shadow-xs'
                : 'bg-[#7F1D1D]/70 text-white border-red-400/40 hover:bg-[#7F1D1D]'
            }`}
          >
            9. تدقيق PDC (8)
          </button>
          <button
            type="button"
            onClick={() => setSelectedGroup('constructionAudit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border ${
              selectedGroup === 'constructionAudit'
                ? 'bg-[#7F1D1D] text-white border-[#FDB813] shadow-xs'
                : 'bg-[#7F1D1D]/70 text-white border-red-400/40 hover:bg-[#7F1D1D]'
            }`}
          >
            10. تدقيق الإنشاءات (7)
          </button>
          <button
            type="button"
            onClick={() => setSelectedGroup('procedure155Status')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border ${
              selectedGroup === 'procedure155Status'
                ? 'bg-[#7F1D1D] text-white border-[#FDB813] shadow-xs'
                : 'bg-[#7F1D1D]/70 text-white border-red-400/40 hover:bg-[#7F1D1D]'
            }`}
          >
            11. تدقيق المساندة الفنية (3)
          </button>
        </div>
      </div>

      {/* Main Coordinated Vertical Tabs + Adjacent Interactive Flyout/Popup Workspace */}
      {filteredCategories.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-500">
          <HelpCircle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <div className="font-bold text-sm text-slate-700">لا توجد قوائم مطابقة لبحثك</div>
          <p className="text-xs text-slate-400 mt-1">جرب مسح البحث أو اختيار تصنيف آخر</p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedGroup('all');
            }}
            className="mt-3 px-4 py-2 rounded-xl bg-[#004B8D] text-white text-xs font-black cursor-pointer"
          >
            إعادة عرض كافة القوائم الـ 18
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          {/* ========================================================================= */}
          {/* RIGHT COLUMN (4 cols): Coordinated Vertical Tabs Rail + Instant Flyout Preview */}
          {/* ========================================================================= */}
          <div className="lg:col-span-4 bg-white rounded-2xl border-2 border-[#002855]/15 shadow-md overflow-visible flex flex-col">
            {/* Search & Counter Header inside Vertical Rail */}
            <div className="p-3.5 bg-gradient-to-l from-[#002855] to-[#003B73] text-white rounded-t-2xl border-b-2 border-[#F58220] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#FDB813]" />
                  <span className="text-xs sm:text-sm font-black">فهرس التبويبات العمودية</span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-white/15 text-[#FDB813] font-mono text-[11px] font-black">
                  {filteredCategories.length} قائمة
                </span>
              </div>

              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ابحث في القوائم أو البنود..."
                  className="w-full pr-9 pl-7 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F58220]"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 text-xs font-black cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Vertical Tabs List */}
            <div className="p-2 space-y-1.5 max-h-[680px] overflow-y-auto divide-y divide-slate-100">
              {filteredCategories.map((cat) => {
                const isSelected = activeCategory?.id === cat.id;
                const catCheckedCount = cat.items.reduce(
                  (c, _, idx) => c + (checkedSimulatorItems[`${cat.id}-${idx}`] ? 1 : 0),
                  0
                );
                const isQuickFlyoutOpen = activeQuickSubmenuId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className="relative group pt-1.5 first:pt-0"
                    onMouseLeave={() => {
                      if (activeQuickSubmenuId === cat.id) setActiveQuickSubmenuId(null);
                    }}
                  >
                    <div
                      onClick={() => {
                        setActiveTabId(cat.id);
                        setItemFilterQuery('');
                      }}
                      className={`w-full p-2.5 sm:p-3 rounded-xl text-right transition-all duration-150 cursor-pointer flex items-center justify-between gap-2.5 border ${
                        isSelected
                          ? 'bg-gradient-to-l from-[#002855] via-[#003B73] to-[#004B8D] text-white border-[#F58220] shadow-md ring-2 ring-[#F58220]/30'
                          : 'bg-slate-50/70 hover:bg-blue-50/70 text-slate-800 border-slate-200/80 hover:border-[#004B8D]/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-[#F58220] text-white shadow-xs'
                              : 'bg-white text-[#002855] border border-slate-200 group-hover:border-[#004B8D]'
                          }`}
                        >
                          {renderAuditCategoryIcon(cat.icon, 'w-4.5 h-4.5')}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.2 rounded font-mono text-[10px] font-black ${
                                isSelected
                                  ? 'bg-[#FDB813] text-slate-950'
                                  : 'bg-[#002855]/10 text-[#002855]'
                              }`}
                            >
                              #{cat.number}
                            </span>
                            <h4
                              className={`text-xs sm:text-[13px] font-black truncate ${
                                isSelected ? 'text-white' : 'text-[#002855]'
                              }`}
                            >
                              {cat.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className={`text-[10px] font-bold ${
                                isSelected ? 'text-blue-100' : 'text-slate-500'
                              }`}
                            >
                              {cat.items.length} بند تحقق
                            </span>
                            {catCheckedCount > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-white font-mono text-[9.5px] font-black">
                                ✓ {catCheckedCount}/{cat.items.length}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Quick Popover Preview Trigger Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTabId(cat.id);
                            setActiveQuickSubmenuId(isQuickFlyoutOpen ? null : cat.id);
                          }}
                          title="معاينة القائمة المنبثقة السريعة بجوار التبويب"
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-white/15 hover:bg-white/25 text-[#FDB813]'
                              : 'bg-white hover:bg-blue-100 text-slate-500 hover:text-[#002855] border border-slate-200'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <ChevronLeft
                          className={`w-4 h-4 transition-transform ${
                            isSelected ? 'text-[#FDB813] -translate-x-0.5' : 'text-slate-400'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Floating Quick Flyout Submenu next to the vertical tab when toggled */}
                    {isQuickFlyoutOpen && (
                      <div
                        className="mt-1.5 p-3 rounded-xl bg-[#002855] text-white border-2 border-[#F58220] shadow-xl space-y-2 animate-in fade-in zoom-in-95 duration-150 z-30"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between border-b border-white/15 pb-1.5">
                          <span className="text-[11px] font-black text-[#FDB813]">
                            قائمة منبثقة سريعة: {cat.title} ({cat.items.length} بنود)
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveQuickSubmenuId(null)}
                            className="text-xs text-blue-200 hover:text-white cursor-pointer font-black"
                          >
                            ✕
                          </button>
                        </div>
                        <ul className="space-y-1 max-h-44 overflow-y-auto pr-1 text-[11px]">
                          {cat.items.map((it, i) => (
                            <li
                              key={i}
                              onClick={() => {
                                setActiveTabId(cat.id);
                                handleToggleItemCheck(cat.id, i);
                              }}
                              className="flex items-start gap-1.5 p-1 rounded hover:bg-white/10 cursor-pointer"
                            >
                              <span className="text-[#F58220] font-mono font-black shrink-0">
                                {i + 1}.
                              </span>
                              <span className="text-blue-50 font-semibold leading-snug">{it}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* LEFT COLUMN (8 cols): Adjacent Dynamic Interactive Flyout/Popup List Panel */}
          {/* ========================================================================= */}
          {activeCategory && (
            <div
              key={activeCategory.id}
              className="lg:col-span-8 bg-white rounded-2xl border-2 border-[#004B8D] shadow-xl overflow-hidden animate-in fade-in slide-in-from-right-2 duration-200 relative"
            >
              {/* Active Flyout Top Header */}
              <div className="bg-gradient-to-l from-[#002855] via-[#003B73] to-[#004B8D] text-white p-4 sm:p-5 border-b-4 border-[#F58220]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-13 h-13 rounded-2xl bg-[#F58220] text-white flex items-center justify-center shadow-lg border-2 border-[#FDB813] shrink-0">
                      {renderAuditCategoryIcon(activeCategory.icon, 'w-6 h-6')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#FDB813] text-slate-950 font-mono text-xs font-black">
                          القائمة المنبثقة #{activeCategory.number} من 18
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-white/15 border border-white/25 text-blue-100 text-[11px] font-black">
                          {activeCategory.auditColumnLabel}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 font-mono text-xs font-black">
                          {activeCategory.items.length} بند معتمد
                        </span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-black text-white mt-1.5">
                        {activeCategory.title}
                      </h3>
                      <p className="text-xs text-blue-100/90 mt-0.5">
                        {activeCategory.description}
                      </p>
                    </div>
                  </div>

                  {/* Prev / Next Checklist Navigation & Copy */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleNavigateAdjacentTab('prev')}
                      disabled={filteredCategories.findIndex((c) => c.id === activeCategory.id) <= 0}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white border border-white/20 cursor-pointer disabled:cursor-not-allowed transition-colors"
                      title="القائمة السابقة"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigateAdjacentTab('next')}
                      disabled={
                        filteredCategories.findIndex((c) => c.id === activeCategory.id) >=
                        filteredCategories.length - 1
                      }
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white border border-white/20 cursor-pointer disabled:cursor-not-allowed transition-colors"
                      title="القائمة التالية"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyCategoryItems(activeCategory)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F58220] hover:bg-[#d96b12] text-white text-xs font-black transition-all cursor-pointer shadow-xs"
                      title="نسخ بنود هذه القائمة الإرشادية"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedId === activeCategory.id ? 'تم النسخ ✓' : 'نسخ القائمة'}</span>
                    </button>
                  </div>
                </div>

                {/* Live Synchronization Strip with Platform Work Orders */}
                <div className="mt-4 pt-3 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-white/10 rounded-xl px-3 py-2 border border-white/15 flex items-center justify-between">
                    <span className="text-blue-100 font-bold">إجمالي الأوامر بالمنصة:</span>
                    <span className="font-mono font-black text-white">{relatedColumnStats.total}</span>
                  </div>
                  <div className="bg-emerald-500/20 rounded-xl px-3 py-2 border border-emerald-400/30 flex items-center justify-between">
                    <span className="text-emerald-100 font-bold">مؤهل في هذه المرحلة:</span>
                    <span className="font-mono font-black text-emerald-300">{relatedColumnStats.qualified}</span>
                  </div>
                  <div className="bg-rose-500/20 rounded-xl px-3 py-2 border border-rose-400/30 flex items-center justify-between">
                    <span className="text-rose-100 font-bold">غير مؤهل / ملاحظات:</span>
                    <span className="font-mono font-black text-rose-300">{relatedColumnStats.disqualified}</span>
                  </div>
                  <div className="bg-amber-500/20 rounded-xl px-3 py-2 border border-amber-400/30 flex items-center justify-between">
                    <span className="text-amber-100 font-bold">محاكاة الفحص النشطة:</span>
                    <span className="font-mono font-black text-[#FDB813]">
                      {activeCategoryCheckedCount}/{activeCategory.items.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Interactive Controls Sub-Bar inside Flyout Panel */}
              <div className="px-4 py-3 bg-[#F4F6F9] border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                  <div className="relative flex-1 max-w-sm">
                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={itemFilterQuery}
                      onChange={(e) => setItemFilterQuery(e.target.value)}
                      placeholder={`تصفية سريعة داخل بنود (${activeCategory.title})...`}
                      className="w-full pr-8 pl-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#004B8D]"
                    />
                  </div>
                  <span className="text-[11px] font-black text-[#002855] bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                    المعروض: {visibleActiveItems.length} من {activeCategory.items.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCheckAllInActive}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#004B8D] hover:bg-[#003B73] text-white text-xs font-black transition-colors cursor-pointer shadow-2xs"
                  >
                    <ListChecks className="w-3.5 h-3.5 text-[#FDB813]" />
                    <span>
                      {activeCategoryCheckedCount === activeCategory.items.length
                        ? 'إلغاء تحديد البنود'
                        : 'تحديد كافة البنود كمطابقة'}
                    </span>
                  </button>

                  {Object.keys(checkedSimulatorItems).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCheckedSimulatorItems({})}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black transition-colors cursor-pointer"
                      title="إعادة ضبط المحاكاة"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>تصفير</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Interactive Checklist Items Grid inside the Adjacent Flyout Panel */}
              <div className="p-4 sm:p-5 space-y-2.5 max-h-[540px] overflow-y-auto bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-black text-[#002855] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#F58220]" />
                    <span>
                      القائمة المنبثقة لبنود التحقق ({activeCategory.title}) — اضغط على أي بند لتأشير المطابقة التفاعلية:
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {visibleActiveItems.map(({ text, idx }) => {
                    const isChecked = Boolean(checkedSimulatorItems[`${activeCategory.id}-${idx}`]);
                    return (
                      <div
                        key={idx}
                        onClick={() => handleToggleItemCheck(activeCategory.id, idx)}
                        className={`p-3.5 rounded-xl border-2 transition-all duration-150 cursor-pointer flex items-start justify-between gap-3 select-none ${
                          isChecked
                            ? 'bg-emerald-50/80 border-emerald-500 shadow-xs'
                            : 'bg-slate-50/60 hover:bg-blue-50/50 border-slate-200 hover:border-[#004B8D]/50'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-lg font-mono text-xs font-black flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                              isChecked
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-[#002855] text-[#FDB813]'
                            }`}
                          >
                            {isChecked ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                          </span>
                          <span
                            className={`text-xs sm:text-sm font-black leading-relaxed ${
                              isChecked ? 'text-emerald-950' : 'text-slate-800'
                            }`}
                          >
                            {text}
                          </span>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black shrink-0 border ${
                            isChecked
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          {isChecked ? 'مطابق ✓' : 'فحص البند'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Bar of Adjacent Flyout Panel */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-600 font-bold">
                  <ShieldCheck className="w-4 h-4 text-[#004B8D]" />
                  <span>
                    مرتبط مباشرة بعمود: <strong className="text-[#002855]">{activeCategory.auditColumnLabel}</strong> في جدول أوامر العمل
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700 font-black">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>معتمد في منظومة حوكمة إجراء 155</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
