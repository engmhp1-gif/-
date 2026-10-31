import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ShieldCheck,
  Gauge,
  Pickaxe,
  Boxes,
  RotateCcw,
  Save,
  FileCheck2,
  Search,
  CheckCheck,
  Building2,
  Zap,
  Cpu,
  Layers,
  Anchor,
  Cable,
  PlugZap,
  GitCommitHorizontal,
  Shield,
  RadioTower,
  SlidersHorizontal
} from 'lucide-react';
import {
  WorkOrder,
  WorkOrderAuditColumnData,
  AuditItemOption,
  AuditSectionCategoryData
} from '../types';
import {
  AUDIT_CATEGORIES_META,
  AuditCategoryKey,
  calculateCategoryAuditStatus,
  calculateOverallAuditColumnSummary,
  createEmptyAuditColumnData
} from '../data/auditChecklistData';

interface AuditChecklistModalProps {
  order: WorkOrder;
  columnField: 'pdcAudit' | 'constructionAudit';
  columnTitle: string;
  initialCategoryKey?: AuditCategoryKey | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: WorkOrderAuditColumnData, shouldClose?: boolean) => Promise<void> | void;
  canEdit?: boolean;
}

export function renderAuditCategoryIcon(iconType: string, className = 'w-4 h-4 shrink-0') {
  switch (iconType) {
    case 'stationRoom':
      return <Building2 className={className} />;
    case 'hvSwitchgear':
      return <Zap className={className} />;
    case 'transformerSubstation':
      return <Cpu className={className} />;
    case 'lvPanel':
      return <SlidersHorizontal className={className} />;
    case 'subDistributionPanel':
      return <Layers className={className} />;
    case 'stationFoundations':
      return <Boxes className={className} />;
    case 'enclosures':
      return <Shield className={className} />;
    case 'protectionBollards':
      return <ShieldCheck className={className} />;
    case 'stationEarthing':
      return <Anchor className={className} />;
    case 'boxesAndMeters':
      return <Gauge className={className} />;
    case 'overheadPoles':
      return <RadioTower className={className} />;
    case 'conductors':
      return <Cable className={className} />;
    case 'stayWire':
      return <GitCommitHorizontal className={className} />;
    case 'riserCables':
      return <PlugZap className={className} />;
    case 'overheadEquipment':
      return <Zap className={className} />;
    case 'excavations':
      return <Pickaxe className={className} />;
    case 'joints':
      return <GitCommitHorizontal className={className} />;
    case 'terminations':
    default:
      return <PlugZap className={className} />;
  }
}

export const AuditChecklistModal: React.FC<AuditChecklistModalProps> = ({
  order,
  columnField,
  columnTitle,
  initialCategoryKey,
  isOpen,
  onClose,
  onSave,
  canEdit = true
}) => {
  // Initialize column data safely with all 18 official categories
  const initialAuditData: WorkOrderAuditColumnData = useMemo(() => {
    const raw = order[columnField] as WorkOrderAuditColumnData | string | undefined;
    const base = createEmptyAuditColumnData();
    if (!raw) return base;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      return {
        ...base,
        mainStatus: trimmed === 'مؤهل' || trimmed === 'غير مؤهل' ? trimmed : 'غير محدد'
      };
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) return base;

    const cleanedRaw: WorkOrderAuditColumnData = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!/^\d+$/.test(k)) {
        cleanedRaw[k] = v;
      }
    }

    const merged: WorkOrderAuditColumnData = {
      ...base,
      ...cleanedRaw,
      mainStatus: cleanedRaw.mainStatus || 'غير محدد'
    };

    for (const cat of AUDIT_CATEGORIES_META) {
      const catRaw = cleanedRaw[cat.key] as AuditSectionCategoryData | undefined;
      const calc = calculateCategoryAuditStatus(catRaw, cat.items.length);
      merged[cat.key] = {
        items: { ...(catRaw?.items || {}) },
        notes: catRaw?.notes || '',
        evaluatedAt: catRaw?.evaluatedAt,
        evaluatedBy: catRaw?.evaluatedBy,
        status: calc.status,
        compliancePercentage: calc.compliancePercentage
      };
    }

    return merged;
  }, [order, columnField]);

  const [activeCategory, setActiveCategory] = useState<AuditCategoryKey>(
    initialCategoryKey || AUDIT_CATEGORIES_META[0].key
  );
  const [columnData, setColumnData] = useState<WorkOrderAuditColumnData>(initialAuditData);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const sessionKeyRef = React.useRef<string | null>(null);

  useEffect(() => {
    const currentKey = `${order.id}:${columnField}`;
    if (sessionKeyRef.current !== currentKey) {
      sessionKeyRef.current = currentKey;
      setColumnData(initialAuditData);
      return;
    }

    // Concurrent remote update on the same work order & audit column: merge per category using evaluatedAt
    setColumnData((prev) => {
      const next: WorkOrderAuditColumnData = {
        ...prev,
        ...initialAuditData
      };
      for (const cat of AUDIT_CATEGORIES_META) {
        const prevCat = prev[cat.key] as AuditSectionCategoryData | undefined;
        const incCat = initialAuditData[cat.key] as AuditSectionCategoryData | undefined;
        const prevTime = prevCat?.evaluatedAt ? new Date(prevCat.evaluatedAt).getTime() : 0;
        const incTime = incCat?.evaluatedAt ? new Date(incCat.evaluatedAt).getTime() : 0;
        const prevCount = prevCat?.items ? Object.keys(prevCat.items).length : 0;
        const incCount = incCat?.items ? Object.keys(incCat.items).length : 0;

        if (prevTime > incTime || (prevTime === incTime && prevCount > incCount)) {
          next[cat.key] = prevCat!;
        } else if (incCat) {
          next[cat.key] = incCat;
        }
      }
      const overall = calculateOverallAuditColumnSummary(next);
      const evaluatedCategoriesCount =
        overall.compliantCategories + overall.nonCompliantCategories + overall.naCategories;
      next.mainStatus = evaluatedCategoriesCount > 0 ? overall.derivedMainStatus : (initialAuditData.mainStatus || prev.mainStatus || 'غير محدد');
      return next;
    });
  }, [order.id, columnField, initialAuditData]);

  useEffect(() => {
    if (initialCategoryKey) {
      setActiveCategory(initialCategoryKey);
    }
  }, [initialCategoryKey]);

  const currentCategoryMeta =
    AUDIT_CATEGORIES_META.find(c => c.key === activeCategory) || AUDIT_CATEGORIES_META[0];

  // Finalize and auto-sync helper
  const buildFinalizedAuditData = (draft: WorkOrderAuditColumnData, explicitMainStatus?: 'مؤهل' | 'غير مؤهل' | 'غير محدد'): WorkOrderAuditColumnData => {
    const updated: WorkOrderAuditColumnData = {
      ...draft,
      lastUpdatedAt: new Date().toISOString()
    };

    for (const cat of AUDIT_CATEGORIES_META) {
      const catData = draft[cat.key] as AuditSectionCategoryData | undefined;
      const calc = calculateCategoryAuditStatus(catData, cat.itemCount);
      updated[cat.key] = {
        ...(catData || { items: {} }),
        items: { ...(catData?.items || {}) },
        status: calc.status,
        compliancePercentage: calc.compliancePercentage
      };
    }

    const overall = calculateOverallAuditColumnSummary(updated);
    const evaluatedCategoriesCount =
      overall.compliantCategories + overall.nonCompliantCategories + overall.naCategories;

    if (explicitMainStatus !== undefined) {
      updated.mainStatus = explicitMainStatus;
    } else if (evaluatedCategoriesCount > 0) {
      updated.mainStatus = overall.derivedMainStatus;
    } else {
      updated.mainStatus = 'غير محدد';
    }

    return updated;
  };

  const triggerLiveSync = (nextData: WorkOrderAuditColumnData) => {
    setColumnData(nextData);
    try {
      onSave(nextData, false);
    } catch (_) {}
  };

  // Toggle single item in active category with instant live sync
  const handleItemOptionChange = (itemIndex: number, option: AuditItemOption) => {
    if (!canEdit) return;

    const currentCat = (columnData[activeCategory] as AuditSectionCategoryData) || { items: {} };
    const currentItems = { ...(currentCat.items || {}) };

    if (currentItems[itemIndex] === option) {
      delete currentItems[itemIndex];
    } else {
      currentItems[itemIndex] = option;
    }

    const calc = calculateCategoryAuditStatus({ items: currentItems }, currentCategoryMeta.items.length);

    const draft: WorkOrderAuditColumnData = {
      ...columnData,
      [activeCategory]: {
        ...currentCat,
        items: currentItems,
        status: calc.status,
        compliancePercentage: calc.compliancePercentage,
        evaluatedAt: new Date().toISOString()
      }
    };

    const finalized = buildFinalizedAuditData(draft);
    triggerLiveSync(finalized);
  };

  // Bulk action: Set all items in the ACTIVE category with instant live sync
  const handleBulkSetOptionForActiveCategory = (option: AuditItemOption) => {
    if (!canEdit) return;

    const currentCat = (columnData[activeCategory] as AuditSectionCategoryData) || { items: {} };
    const newItems: Record<number, AuditItemOption> = {};
    currentCategoryMeta.items.forEach((_, idx) => {
      newItems[idx] = option;
    });

    const calc = calculateCategoryAuditStatus({ items: newItems }, currentCategoryMeta.items.length);

    const draft: WorkOrderAuditColumnData = {
      ...columnData,
      [activeCategory]: {
        ...currentCat,
        items: newItems,
        status: calc.status,
        compliancePercentage: calc.compliancePercentage,
        evaluatedAt: new Date().toISOString()
      }
    };

    const finalized = buildFinalizedAuditData(draft);
    triggerLiveSync(finalized);
  };

  // Global Bulk Action: Set all items across ALL 18 categories at once with instant live sync
  const handleBulkSetOptionAllCategories = (option: AuditItemOption) => {
    if (!canEdit) return;

    const draft: WorkOrderAuditColumnData = {
      ...columnData
    };

    for (const cat of AUDIT_CATEGORIES_META) {
      const currentCat = (columnData[cat.key] as AuditSectionCategoryData) || { items: {} };
      const newItems: Record<number, AuditItemOption> = {};
      cat.items.forEach((_, idx) => {
        newItems[idx] = option;
      });
      const calc = calculateCategoryAuditStatus({ items: newItems }, cat.itemCount);
      draft[cat.key] = {
        ...currentCat,
        items: newItems,
        status: calc.status,
        compliancePercentage: calc.compliancePercentage,
        evaluatedAt: new Date().toISOString()
      };
    }

    const explicitMain: 'مؤهل' | 'غير مؤهل' | 'غير محدد' =
      option === 'ممتثل' ? 'مؤهل' : option === 'غير ممتثل' ? 'غير مؤهل' : 'مؤهل';
    const finalized = buildFinalizedAuditData(draft, explicitMain);
    triggerLiveSync(finalized);
  };

  // Reset current category
  const handleResetCategory = () => {
    if (!canEdit) return;

    const draft: WorkOrderAuditColumnData = {
      ...columnData,
      [activeCategory]: {
        items: {},
        status: 'قيد التدقيق',
        compliancePercentage: 0,
        notes: ''
      }
    };

    const finalized = buildFinalizedAuditData(draft);
    triggerLiveSync(finalized);
  };

  // Update Category Notes
  const handleNotesChange = (text: string) => {
    if (!canEdit) return;
    setColumnData(prev => ({
      ...prev,
      [activeCategory]: {
        ...((prev[activeCategory] as AuditSectionCategoryData) || { items: {} }),
        notes: text
      }
    }));
  };

  // Handle Main Status update (مؤهل / غير مؤهل) with instant live sync
  const handleMainStatusChange = (status: 'مؤهل' | 'غير مؤهل') => {
    if (!canEdit) return;
    const nextMain = columnData.mainStatus === status ? 'غير محدد' : status;
    const finalized = buildFinalizedAuditData(columnData, nextMain);
    triggerLiveSync(finalized);
  };

  // Save & Close handler
  const handleSaveAndClose = async () => {
    setIsSaving(true);
    try {
      const finalData = buildFinalizedAuditData(columnData);
      await onSave(finalData, true);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const currentCatData = (columnData[activeCategory] as AuditSectionCategoryData) || { items: {} };
  const currentSummary = calculateCategoryAuditStatus(currentCatData, currentCategoryMeta.items.length);
  const overallSummary = calculateOverallAuditColumnSummary(columnData);
  const evaluatedTotalCount =
    overallSummary.compliantCategories + overallSummary.nonCompliantCategories + overallSummary.naCategories;
  const effectiveMainStatus =
    evaluatedTotalCount > 0
      ? overallSummary.derivedMainStatus
      : columnData.mainStatus && columnData.mainStatus !== 'غير محدد'
      ? columnData.mainStatus
      : overallSummary.derivedMainStatus;

  const filteredItems = useMemo(() => {
    return currentCategoryMeta.items
      .map((item, index) => ({ text: item, index }))
      .filter(({ text, index }) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return text.toLowerCase().includes(q) || (index + 1).toString().includes(q);
      });
  }, [currentCategoryMeta, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#eef2ff] rounded-2xl shadow-2xl border border-slate-300 flex flex-col max-h-[94vh] overflow-hidden text-right font-sans"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-300 bg-gradient-to-l from-slate-100 via-blue-50/80 to-indigo-50/80 text-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200 text-blue-800 shadow-2xs">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100/90 text-indigo-950 border border-indigo-200 px-2 py-0.5 rounded-md">
                  18 قائمة تدقيق معتمدة • {AUDIT_CATEGORIES_META.reduce((sum, c) => sum + c.items.length, 0)} بند فحص
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  بطاقة تحقق ومطابقة: {columnTitle}
                </h3>
                <span className="text-[11px] font-mono font-bold bg-amber-100/90 text-amber-950 border border-amber-300 px-2 py-0.5 rounded-md shadow-2xs">
                  {order.workOrderNumber}
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-0.5 font-bold">
                {order.office} • المقاول: {order.contractor} {order.consultant ? `• الاستشاري: ${order.consultant}` : ''} {order.workOrderCode ? `• نوع: ${order.workOrderCode}` : ''}
              </p>
            </div>
          </div>

          {/* Main Status Toggle & Global Bulk Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Global Bulk Actions for ALL 18 Categories */}
            {canEdit && (
              <div className="flex items-center gap-1 bg-gradient-to-r from-slate-100 to-blue-50/70 p-1 rounded-xl border border-slate-300 shadow-2xs">
                <span className="text-[10px] font-black text-slate-800 px-1.5">كل القوائم (18):</span>
                <button
                  type="button"
                  onClick={() => handleBulkSetOptionAllCategories('ممتثل')}
                  className="px-2 py-1 text-[10px] font-black rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer transition-all shadow-2xs"
                  title="تحديد ممتثل الكل في جميع القوائم الـ 18 دفعة واحدة"
                >
                  ممتثل الكل
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkSetOptionAllCategories('غير ممتثل')}
                  className="px-2 py-1 text-[10px] font-black rounded-lg bg-rose-700 hover:bg-rose-800 text-white cursor-pointer transition-all shadow-2xs"
                  title="تحديد غير ممتثل الكل في جميع القوائم الـ 18 دفعة واحدة"
                >
                  غير ممتثل الكل
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkSetOptionAllCategories('لا ينطبق')}
                  className="px-2 py-1 text-[10px] font-black rounded-lg bg-amber-600 hover:bg-amber-700 text-white cursor-pointer transition-all shadow-2xs"
                  title="تحديد لا ينطبق الكل في جميع القوائم الـ 18 دفعة واحدة"
                >
                  لا ينطبق الكل
                </button>
              </div>
            )}

            {/* Automatic & Interactive Main Status */}
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-slate-100 to-indigo-50/70 p-1 rounded-xl border border-slate-300 shadow-2xs">
              <span className="text-[11px] font-black text-slate-800 px-2">نتيجة التدقيق التلقائية:</span>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => handleMainStatusChange('مؤهل')}
                className={`px-3 py-1 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  effectiveMainStatus === 'مؤهل'
                    ? 'bg-emerald-700 text-white shadow-2xs ring-2 ring-emerald-400/50'
                    : 'text-slate-800 hover:text-slate-950 hover:bg-slate-200/70'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>مؤهل</span>
              </button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => handleMainStatusChange('غير مؤهل')}
                className={`px-3 py-1 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  effectiveMainStatus === 'غير مؤهل'
                    ? 'bg-rose-700 text-white shadow-2xs ring-2 ring-rose-400/50'
                    : 'text-slate-800 hover:text-slate-950 hover:bg-slate-200/70'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>غير مؤهل</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-200/80 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 18 Official Icons Grid Strip */}
        <div className="p-3 bg-gradient-to-b from-slate-100/90 to-slate-200/60 border-b border-slate-300 shrink-0 max-h-[215px] overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
            <span className="text-xs font-black text-slate-900">
              أيقونات قوائم الفحص والتدقيق المعتمدة (18 أيقونة تفاعلية تُحدّث حالة التأهيل تلقائياً):
            </span>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                ممتثل: {overallSummary.compliantCategories}
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300">
                غير ممتثل: {overallSummary.nonCompliantCategories}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                لا ينطبق: {overallSummary.naCategories}
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-950 border border-blue-300 font-mono">
                الامتثال حسب ما تم تدقيقه: {overallSummary.averageCompliance}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
            {AUDIT_CATEGORIES_META.map((cat, idx) => {
              const isActive = activeCategory === cat.key;
              const d = columnData[cat.key] as AuditSectionCategoryData | undefined;
              const calc = calculateCategoryAuditStatus(d, cat.itemCount);
              const tabStatus = calc.status;
              const tabPercentage = calc.compliancePercentage;

              const isCompliant = tabStatus === 'ممتثل';
              const isNonCompliant = tabStatus === 'غير ممتثل';
              const isNA = tabStatus === 'لا ينطبق';

              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.key);
                    setSearchQuery('');
                  }}
                  className={`flex flex-col items-center justify-between p-2 rounded-xl border transition-all cursor-pointer text-center ${
                    isActive
                      ? 'bg-[#003366] text-white border-[#003366] shadow-md ring-2 ring-orange-500 scale-[1.02]'
                      : isCompliant
                      ? 'bg-gradient-to-br from-emerald-50 to-teal-50/80 border-emerald-300 hover:from-emerald-100 hover:to-teal-100/80 text-emerald-950'
                      : isNonCompliant
                      ? 'bg-gradient-to-br from-rose-50 to-red-50/80 border-rose-300 hover:from-rose-100 hover:to-red-100/80 text-rose-950'
                      : isNA
                      ? 'bg-gradient-to-br from-amber-50 to-orange-50/80 border-amber-300 hover:from-amber-100 hover:to-orange-100/80 text-amber-950'
                      : 'bg-gradient-to-br from-slate-50 to-blue-50/40 border-slate-300 hover:from-slate-100 hover:to-blue-50/70 text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 w-full mb-1">
                    <span className={`text-[10px] font-mono font-black px-1 rounded ${
                      isActive ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {idx + 1}
                    </span>
                    {renderAuditCategoryIcon(cat.icon, `w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-300' : 'text-[#003366]'}`)}
                    <span className={`text-[11px] font-black truncate ${isActive ? 'text-white' : 'text-slate-900'}`}>
                      {cat.title}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1 w-full text-[10px]">
                    <span className={`font-mono font-bold ${isActive ? 'text-amber-300' : 'text-slate-700'}`}>
                      {calc.totalAnswered}/{cat.itemCount} ({tabPercentage}%)
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-black ${
                      isCompliant
                        ? 'bg-emerald-700 text-white'
                        : isNonCompliant
                        ? 'bg-rose-700 text-white'
                        : isNA
                        ? 'bg-amber-600 text-white'
                        : isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-800'
                    }`}>
                      {tabStatus}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Checklist Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-gradient-to-b from-slate-100/70 via-blue-50/25 to-indigo-50/30">
          {/* Category Summary Toolbar & Bulk Buttons for Active Category */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 rounded-xl bg-gradient-to-l from-slate-100 via-blue-50/60 to-indigo-50/60 border border-slate-300 shadow-2xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#003366]">
                {renderAuditCategoryIcon(currentCategoryMeta.icon, 'w-5 h-5 text-orange-600')}
                <span>قائمة تدقيق: {currentCategoryMeta.title}</span>
                <span className="text-xs text-slate-700 font-bold">
                  ({currentCategoryMeta.itemCount} بند فحص)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-800">نسبة الامتثال:</span>
                <span className={`font-mono text-xs font-black px-2.5 py-0.5 rounded-md border ${
                  currentSummary.compliancePercentage >= 90
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : currentSummary.compliancePercentage >= 60
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-rose-100 text-rose-900 border-rose-300'
                }`}>
                  {currentSummary.compliancePercentage}%
                </span>
                <span className="text-xs font-bold text-slate-700">
                  ({currentSummary.compliantCount} ممتثل • {currentSummary.nonCompliantCount} غير ممتثل • {currentSummary.naCount} لا ينطبق)
                </span>
              </div>
            </div>

            {/* Bulk Actions for Active Category: ممتثل الكل / غير ممتثل الكل / لا ينطبق الكل */}
            {canEdit && (
              <div className="flex flex-wrap items-center gap-1.5 self-end lg:self-auto" role="group">
                <button
                  type="button"
                  data-testid="bulk-all-compliant-btn"
                  onClick={() => handleBulkSetOptionForActiveCategory('ممتثل')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900 shadow-2xs cursor-pointer transition-all"
                  title="تحديد ممتثل الكل لبنود هذه القائمة"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>ممتثل الكل</span>
                </button>
                <button
                  type="button"
                  data-testid="bulk-all-non-compliant-btn"
                  onClick={() => handleBulkSetOptionForActiveCategory('غير ممتثل')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-lg bg-rose-700 text-white hover:bg-rose-800 active:bg-rose-900 shadow-2xs cursor-pointer transition-all"
                  title="تحديد غير ممتثل الكل لبنود هذه القائمة"
                >
                  <XCircle className="w-4 h-4" />
                  <span>غير ممتثل الكل</span>
                </button>
                <button
                  type="button"
                  data-testid="bulk-all-na-btn"
                  onClick={() => handleBulkSetOptionForActiveCategory('لا ينطبق')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-lg bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800 shadow-2xs cursor-pointer transition-all"
                  title="تحديد لا ينطبق الكل لبنود هذه القائمة"
                >
                  <MinusCircle className="w-4 h-4" />
                  <span>لا ينطبق الكل</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetCategory}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg text-slate-700 hover:text-slate-950 bg-slate-200/70 hover:bg-slate-300/70 border border-slate-300 cursor-pointer transition-colors"
                  title="إعادة ضبط القائمة الحالية"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إعادة ضبط</span>
                </button>
              </div>
            )}
          </div>

          {/* Search Filter Inside Category */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`بحث سريع في بنود (${currentCategoryMeta.title})...`}
              className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50/90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003366] focus:border-transparent text-slate-900 font-bold"
            />
          </div>

          {/* Items List */}
          <div className="space-y-2">
            {filteredItems.map(({ text, index }) => {
              const itemsMap = currentCatData?.items || {};
              const currentVal = itemsMap[index];

              return (
                <div
                  key={index}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all shadow-2xs ${
                    currentVal === 'ممتثل'
                      ? 'bg-gradient-to-l from-emerald-50/90 to-teal-50/60 border-emerald-300'
                      : currentVal === 'غير ممتثل'
                      ? 'bg-gradient-to-l from-rose-50/90 to-red-50/60 border-rose-300'
                      : currentVal === 'لا ينطبق'
                      ? 'bg-gradient-to-l from-amber-50/90 to-orange-50/60 border-amber-300'
                      : 'bg-gradient-to-l from-slate-50/95 to-blue-50/30 border-slate-300/90 hover:border-slate-400'
                  }`}
                >
                  {/* Item Label & Number with Bold Enterprise Hierarchy */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-slate-800 text-amber-300 font-mono text-xs font-black flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      {index + 1}
                    </span>
                    <p className="text-xs sm:text-sm text-slate-900 font-black leading-relaxed select-text">
                      {text}
                    </p>
                  </div>

                  {/* 3-State Segmented Control: ممتثل / غير ممتثل / لا ينطبق with Bold High-Contrast Text */}
                  <div className="flex items-center gap-1.5 bg-slate-200/75 p-1.5 rounded-xl shrink-0 self-end sm:self-auto border border-slate-300">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleItemOptionChange(index, 'ممتثل')}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                        currentVal === 'ممتثل'
                          ? 'bg-emerald-700 text-white shadow-xs ring-1 ring-emerald-500'
                          : 'text-slate-800 hover:text-emerald-950 hover:bg-emerald-100/70'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>ممتثل</span>
                    </button>

                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleItemOptionChange(index, 'غير ممتثل')}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                        currentVal === 'غير ممتثل'
                          ? 'bg-rose-700 text-white shadow-xs ring-1 ring-rose-500'
                          : 'text-slate-800 hover:text-rose-950 hover:bg-rose-100/70'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>غير ممتثل</span>
                    </button>

                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleItemOptionChange(index, 'لا ينطبق')}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                        currentVal === 'لا ينطبق'
                          ? 'bg-amber-600 text-white shadow-xs ring-1 ring-amber-400'
                          : 'text-slate-800 hover:text-amber-950 hover:bg-amber-100/70'
                      }`}
                    >
                      <MinusCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>لا ينطبق</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Category Notes */}
          <div className="pt-2">
            <label className="block text-xs font-black text-slate-800 mb-1">
              ملاحظات وتوصيات الفحص لقائمة ({currentCategoryMeta.title}):
            </label>
            <textarea
              rows={2}
              value={currentCatData?.notes || ''}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="أدخل أي ملاحظات فنية أو تفاصيل إضافية..."
              className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-slate-50/90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003366] text-slate-900 font-semibold"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-slate-300 bg-gradient-to-l from-slate-100 via-blue-50/70 to-indigo-50/70 shrink-0">
          <div className="text-xs text-slate-700 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>مزامنة تلقائية ذكية لحالة التأهيل والبنود</span>
            </span>
            {columnData.auditorEmail && (
              <>
                <span>•</span>
                <span className="font-bold text-[#003366]">المدقق: {columnData.auditorEmail}</span>
                <span className="font-mono text-slate-800 font-bold">{columnData.auditDateRiyadh} {columnData.auditTimeRiyadh}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-black text-slate-800 bg-slate-200/75 hover:bg-slate-300/80 border border-slate-300 rounded-xl cursor-pointer transition-colors"
            >
              إغلاق
            </button>
            {canEdit && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveAndClose}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-extrabold text-white bg-[#003366] hover:bg-[#002244] active:bg-slate-950 rounded-xl cursor-pointer transition-all shadow-xs disabled:opacity-50 border-b-2 border-orange-500"
              >
                <Save className="w-4 h-4 text-orange-400" />
                <span>{isSaving ? 'جارٍ الحفظ والمزامنة...' : 'حفظ وإغلاق البطاقة'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
