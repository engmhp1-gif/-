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
  FileText,
  FileSpreadsheet,
  Layers,
  CheckCheck,
  Zap,
  Award,
  Clock,
  UserCheck,
  Sparkles,
  BookOpen,
  Link2
} from 'lucide-react';
import {
  WorkOrder,
  WorkOrderAuditColumnData
} from '../types';
import {
  AuditCategoryKey,
  createEmptyAuditColumnData,
  sync18CategoriesFromPrimarySupportChecklist
} from '../data/auditChecklistData';
import {
  TECHNICAL_SUPPORT_CHECKLIST_ITEMS,
  SupportChecklistFieldKey,
  SupportChecklistValue,
  SupportChecklistItemMeta,
  extractColumnSupportChecklistMap,
  getEvaluatedColumnSupportChecklistKeys,
  calculateSupportChecklistStats,
  AuditStagesReferenceModal,
  renderAuditCategoryIcon
} from './TechnicalSupportAuditModal';

export { renderAuditCategoryIcon, AuditStagesReferenceModal };

interface AuditChecklistModalProps {
  order: WorkOrder;
  columnField: 'pdcAudit' | 'constructionAudit';
  columnTitle: string;
  initialCategoryKey?: AuditCategoryKey | null;
  initialFocusField?: SupportChecklistFieldKey | null;
  initialOpenStages?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: WorkOrderAuditColumnData, shouldClose?: boolean) => Promise<void> | void;
  canEdit?: boolean;
}

export const AuditChecklistModal: React.FC<AuditChecklistModalProps> = ({
  order,
  columnField,
  columnTitle,
  initialCategoryKey = null,
  initialFocusField = null,
  initialOpenStages = false,
  isOpen,
  onClose,
  onSave,
  canEdit = true
}) => {
  const [checklistValues, setChecklistValues] = useState<Record<SupportChecklistFieldKey, SupportChecklistValue>>(
    () => extractColumnSupportChecklistMap(order, columnField)
  );

  const [evaluatedKeys, setEvaluatedKeys] = useState<string[]>(() => {
    const initMap = extractColumnSupportChecklistMap(order, columnField);
    return getEvaluatedColumnSupportChecklistKeys(order, columnField, initMap);
  });

  const [itemUpdatedAt, setItemUpdatedAt] = useState<Record<string, string>>(() => {
    const colData = order[columnField] as WorkOrderAuditColumnData | undefined;
    return { ...(colData?.itemUpdatedAt || {}) };
  });

  const [mainStatus, setMainStatus] = useState<'مؤهل' | 'غير مؤهل' | 'قيد التدقيق' | 'غير محدد' | ''>(() => {
    const initMap = extractColumnSupportChecklistMap(order, columnField);
    const initEval = getEvaluatedColumnSupportChecklistKeys(order, columnField, initMap);
    if (initEval.length > 0) {
      const initStats = calculateSupportChecklistStats(initMap, initEval);
      return initStats.isAllApplicableCompleted ? 'مؤهل' : 'غير مؤهل';
    }
    return '';
  });

  const [highlightedKey, setHighlightedKey] = useState<SupportChecklistFieldKey | null>(initialFocusField);
  const [isSaving, setIsSaving] = useState(false);
  const [isStagesModalOpen, setIsStagesModalOpen] = useState<boolean>(
    Boolean(initialOpenStages || initialCategoryKey)
  );
  const sessionKeyRef = React.useRef<string | null>(null);
  const localValuesRef = React.useRef(checklistValues);
  const localEvalRef = React.useRef(evaluatedKeys);
  const localTimesRef = React.useRef(itemUpdatedAt);
  localValuesRef.current = checklistValues;
  localEvalRef.current = evaluatedKeys;
  localTimesRef.current = itemUpdatedAt;

  useEffect(() => {
    const currentSessionKey = `${order.id}:${columnField}`;
    const incMap = extractColumnSupportChecklistMap(order, columnField);
    const incEval = getEvaluatedColumnSupportChecklistKeys(order, columnField, incMap);
    const rawCol = order[columnField];
    const colData = rawCol && typeof rawCol === 'object' ? (rawCol as WorkOrderAuditColumnData) : undefined;
    const incTimes = colData?.itemUpdatedAt || {};

    if (sessionKeyRef.current !== currentSessionKey) {
      sessionKeyRef.current = currentSessionKey;
      setChecklistValues(incMap);
      setEvaluatedKeys(incEval);
      setItemUpdatedAt(incTimes);
      if (incEval.length > 0) {
        const st = calculateSupportChecklistStats(incMap, incEval);
        setMainStatus(st.isAllApplicableCompleted ? 'مؤهل' : 'غير مؤهل');
      } else {
        setMainStatus('');
      }
      return;
    }

    // Smart concurrent merge per item using itemUpdatedAt without side effects inside setState updaters
    let anyRemoteNewer = false;
    const mergedValues = { ...localValuesRef.current };
    const mergedEvalSet = new Set<string>(localEvalRef.current);
    const mergedTimes = { ...localTimesRef.current };

    for (const item of TECHNICAL_SUPPORT_CHECKLIST_ITEMS) {
      const k = item.key;
      const prevT = mergedTimes[k] ? new Date(mergedTimes[k]).getTime() : 0;
      const incT = incTimes[k] ? new Date(incTimes[k]).getTime() : 0;
      if (incT > prevT) {
        anyRemoteNewer = true;
        mergedValues[k] = incMap[k];
        mergedTimes[k] = incTimes[k];
        if (incEval.includes(k)) mergedEvalSet.add(k);
        else mergedEvalSet.delete(k);
      }
    }

    if (anyRemoteNewer) {
      const nextEvalArr = TECHNICAL_SUPPORT_CHECKLIST_ITEMS
        .map(i => i.key)
        .filter(k => mergedEvalSet.has(k));

      setChecklistValues(mergedValues);
      setEvaluatedKeys(nextEvalArr);
      setItemUpdatedAt(mergedTimes);

      if (nextEvalArr.length > 0) {
        const st = calculateSupportChecklistStats(mergedValues, nextEvalArr);
        setMainStatus(st.isAllApplicableCompleted ? 'مؤهل' : 'غير مؤهل');
      } else if (colData?.mainStatus === 'مؤهل' || colData?.mainStatus === 'غير مؤهل') {
        setMainStatus(colData.mainStatus);
      } else {
        setMainStatus('غير محدد');
      }
    }
  }, [order, columnField]);

  useEffect(() => {
    setHighlightedKey(initialFocusField || null);
  }, [initialFocusField]);

  useEffect(() => {
    if (initialOpenStages || initialCategoryKey) {
      setIsStagesModalOpen(true);
    }
  }, [initialOpenStages, initialCategoryKey]);

  const stats = useMemo(
    () => calculateSupportChecklistStats(checklistValues, evaluatedKeys),
    [checklistValues, evaluatedKeys]
  );

  if (!isOpen) return null;

  const renderItemIcon = (iconName: SupportChecklistItemMeta['iconName'], className = 'w-5 h-5') => {
    switch (iconName) {
      case 'meter':
        return <Gauge className={className} />;
      case 'excavation':
        return <Pickaxe className={className} />;
      case 'equipment':
        return <Boxes className={className} />;
      case 'overhead':
        return <Zap className={className} />;
      case 'fileText':
        return <FileText className={className} />;
      case 'fileCheck':
        return <FileCheck2 className={className} />;
      case 'spreadsheet':
        return <FileSpreadsheet className={className} />;
      case 'layers':
        return <Layers className={className} />;
      case 'shield':
      default:
        return <ShieldCheck className={className} />;
    }
  };

  const buildUpdatedAuditColumnData = (
    nextValues: Record<SupportChecklistFieldKey, SupportChecklistValue>,
    nextMainStatus: 'مؤهل' | 'غير مؤهل' | 'قيد التدقيق' | 'غير محدد' | '',
    nextEvaluatedKeys: string[],
    nextItemTimes: Record<string, string>
  ): WorkOrderAuditColumnData => {
    const nowIso = new Date().toISOString();
    const rawCol = order[columnField];
    const existingColData: WorkOrderAuditColumnData =
      rawCol && typeof rawCol === 'object'
        ? (rawCol as WorkOrderAuditColumnData)
        : createEmptyAuditColumnData();
    const nextStats = calculateSupportChecklistStats(nextValues, nextEvaluatedKeys);

    const synced18 = sync18CategoriesFromPrimarySupportChecklist(
      existingColData,
      nextValues,
      nextEvaluatedKeys,
      nowIso
    );

    const isEmptyEval = nextEvaluatedKeys.length === 0 && nextMainStatus !== 'مؤهل' && nextMainStatus !== 'غير مؤهل';

    return {
      ...synced18,
      supportChecklist: isEmptyEval ? {} : { ...nextValues },
      evaluatedKeys: [...nextEvaluatedKeys],
      itemUpdatedAt: { ...nextItemTimes },
      compliancePercentage:
        nextEvaluatedKeys.length > 0
          ? nextStats.compliancePercentage
          : nextMainStatus === 'مؤهل'
          ? 100
          : 0,
      mainStatus: isEmptyEval ? ('' as any) : (nextMainStatus as any),
      lastUpdatedAt: isEmptyEval ? '' : nowIso
    };
  };

  const triggerSync = (
    nextValues: Record<SupportChecklistFieldKey, SupportChecklistValue>,
    nextMainStatus: 'مؤهل' | 'غير مؤهل' | 'قيد التدقيق' | 'غير محدد' | '',
    nextEvaluatedKeys: string[],
    nextItemTimes: Record<string, string>,
    shouldClose = false
  ) => {
    if (!canEdit) return;
    const updatedData = buildUpdatedAuditColumnData(
      nextValues,
      nextMainStatus,
      nextEvaluatedKeys,
      nextItemTimes
    );
    if (shouldClose) {
      setIsSaving(true);
      Promise.resolve(onSave(updatedData, true)).finally(() => {
        setIsSaving(false);
        onClose();
      });
    } else {
      // Non-blocking instant sync for in-modal option clicks (<1ms UI response)
      Promise.resolve(onSave(updatedData, false)).catch(() => {});
    }
  };

  const handleSelectOption = (key: SupportChecklistFieldKey, val: SupportChecklistValue) => {
    if (!canEdit) return;
    const nowIso = new Date().toISOString();
    const isAlreadyEvaluatedWithSameVal = evaluatedKeys.includes(key) && checklistValues[key] === val;

    let nextValues: Record<SupportChecklistFieldKey, SupportChecklistValue>;
    let nextEvaluatedKeys: string[];

    if (isAlreadyEvaluatedWithSameVal) {
      nextValues = {
        ...checklistValues,
        [key]: 'غير مكتمل'
      };
      nextEvaluatedKeys = evaluatedKeys.filter(k => k !== key);
    } else {
      nextValues = {
        ...checklistValues,
        [key]: val
      };
      nextEvaluatedKeys = TECHNICAL_SUPPORT_CHECKLIST_ITEMS
        .map(i => i.key)
        .filter(k => k === key || evaluatedKeys.includes(k));
    }

    const nextItemTimes = {
      ...itemUpdatedAt,
      [key]: nowIso
    };

    const nextStats = calculateSupportChecklistStats(nextValues, nextEvaluatedKeys);
    const autoMainStatus: 'مؤهل' | 'غير مؤهل' | 'قيد التدقيق' | 'غير محدد' | '' =
      nextEvaluatedKeys.length === 0
        ? ''
        : nextStats.isAllApplicableCompleted
        ? 'مؤهل'
        : 'غير مؤهل';

    setChecklistValues(nextValues);
    setEvaluatedKeys(nextEvaluatedKeys);
    setItemUpdatedAt(nextItemTimes);
    setMainStatus(autoMainStatus);

    triggerSync(nextValues, autoMainStatus, nextEvaluatedKeys, nextItemTimes, false);
  };

  const handleMainStatusToggle = (targetStatus: 'مؤهل' | 'غير مؤهل') => {
    if (!canEdit) return;
    const nextMain: 'مؤهل' | 'غير مؤهل' | 'قيد التدقيق' | 'غير محدد' | '' =
      mainStatus === targetStatus && evaluatedKeys.length === 0 ? '' : targetStatus;
    setMainStatus(nextMain);
    triggerSync(checklistValues, nextMain, evaluatedKeys, itemUpdatedAt, false);
  };

  const handleBulkSetAll = (val: SupportChecklistValue) => {
    if (!canEdit) return;
    const nowIso = new Date().toISOString();
    const nextValues: Record<SupportChecklistFieldKey, SupportChecklistValue> = {
      meterPhotoDocumentation: val,
      excavationPhotoDocumentation: val,
      equipmentPhotoDocumentation: val,
      overheadPhotoDocumentation: val,
      consultantForms: val,
      consultantClearanceForms: val,
      form190: val,
      form200: val,
      inspectionForm: val
    };
    const allKeys = TECHNICAL_SUPPORT_CHECKLIST_ITEMS.map(i => i.key);
    const nextItemTimes: Record<string, string> = { ...itemUpdatedAt };
    for (const k of allKeys) {
      nextItemTimes[k] = nowIso;
    }

    const autoMainStatus: 'مؤهل' | 'غير مؤهل' = val === 'غير مكتمل' ? 'غير مؤهل' : 'مؤهل';
    setChecklistValues(nextValues);
    setEvaluatedKeys(allKeys);
    setItemUpdatedAt(nextItemTimes);
    setMainStatus(autoMainStatus);

    triggerSync(nextValues, autoMainStatus, allKeys, nextItemTimes, false);
  };

  const handleResetAllInternal = () => {
    if (!canEdit) return;
    const nowIso = new Date().toISOString();
    const nextValues: Record<SupportChecklistFieldKey, SupportChecklistValue> = {
      meterPhotoDocumentation: 'غير مكتمل',
      excavationPhotoDocumentation: 'غير مكتمل',
      equipmentPhotoDocumentation: 'غير مكتمل',
      overheadPhotoDocumentation: 'غير مكتمل',
      consultantForms: 'غير مكتمل',
      consultantClearanceForms: 'غير مكتمل',
      form190: 'غير مكتمل',
      form200: 'غير مكتمل',
      inspectionForm: 'غير مكتمل'
    };
    const nextItemTimes: Record<string, string> = { ...itemUpdatedAt };
    for (const item of TECHNICAL_SUPPORT_CHECKLIST_ITEMS) {
      nextItemTimes[item.key] = nowIso;
    }

    setChecklistValues(nextValues);
    setEvaluatedKeys([]);
    setItemUpdatedAt(nextItemTimes);
    setMainStatus('');

    triggerSync(nextValues, '', [], nextItemTimes, false);
  };

  const rawColData = order[columnField];
  const colData: WorkOrderAuditColumnData =
    rawColData && typeof rawColData === 'object' ? (rawColData as WorkOrderAuditColumnData) : {};
  const isMainQualified = mainStatus === 'مؤهل';
  const isMainNotQualified = mainStatus === 'غير مؤهل';

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#eef2ff] rounded-2xl shadow-2xl border-2 border-[#002855] flex flex-col max-h-[92vh] overflow-hidden text-right font-sans"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Executive Header with مراحل التدقيق in the Top Corner */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b-2 border-[#F58220] bg-gradient-to-l from-[#001D40] via-[#002855] to-[#004B8D] text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#7F1D1D] border border-red-400/50 text-white shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-[#7F1D1D] border border-red-300/40 text-white px-2.5 py-0.5 rounded-md shadow-2xs">
                  CHECK LIST • عمود التدقيق المعتمد ({columnTitle})
                </span>
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  بطاقة نتائج تدقيق: {columnTitle}
                </h3>
                <span className="text-xs font-mono font-bold bg-white/15 border border-white/25 text-[#FDB813] px-2.5 py-0.5 rounded-lg shadow-2xs">
                  {order.workOrderNumber}
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-1 font-bold">
                {order.office} • المقاول: {order.contractor} {order.consultant ? `• الاستشاري: ${order.consultant}` : ''} {order.workOrderCode ? `• نوع الأمر: ${order.workOrderCode}` : ''}
              </p>
            </div>
          </div>

          {/* الركن العلوي: أيقونة مراحل التدقيق للاطلاع + نتيجة التدقيق التلقائية */}
          <div className="flex flex-wrap items-center gap-2">
            {/* أيقونة مراحل التدقيق في الركن العلوي للاطلاع فقط */}
            <button
              type="button"
              onClick={() => setIsStagesModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#003366] hover:bg-[#002244] text-white border-b-2 border-orange-500 text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95"
              title="فتح نافذة مراحل التدقيق (القوائم الأساسية الـ 18 في عمود جانبي وبنودها للاطلاع فقط)"
            >
              <BookOpen className="w-4 h-4 text-amber-300 shrink-0" />
              <span>مراحل التدقيق</span>
              <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.2 rounded font-bold">
                للاطلاع
              </span>
            </button>

            {/* Overall Audit Status Toggle */}
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-slate-100 to-indigo-50/70 p-1.5 rounded-xl border border-slate-300 shadow-2xs">
              <span className="text-[11px] font-black text-slate-800 px-2">نتيجة التدقيق التلقائية:</span>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => handleMainStatusToggle('مؤهل')}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                  isMainQualified
                    ? 'bg-emerald-700 text-white ring-2 ring-emerald-400/50'
                    : 'text-slate-800 hover:text-slate-950 hover:bg-slate-200/70'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>مؤهل</span>
              </button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => handleMainStatusToggle('غير مؤهل')}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                  isMainNotQualified
                    ? 'bg-rose-700 text-white ring-2 ring-rose-400/50'
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
              className="p-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-200/80 transition-colors cursor-pointer"
              title="إغلاق البطاقة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Audit Summary & KPI Strip */}
        <div className="px-5 py-3 bg-gradient-to-l from-slate-100/90 via-blue-50/50 to-indigo-50/50 border-b border-slate-300 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Overall Decision Badge */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border shadow-2xs ${
                isMainQualified
                  ? 'bg-emerald-700 text-white border-emerald-800'
                  : isMainNotQualified
                  ? 'bg-rose-700 text-white border-rose-800'
                  : 'bg-slate-700 text-white border-slate-800'
              }`}
            >
              {isMainQualified ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : isMainNotQualified ? (
                <XCircle className="w-4 h-4" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              <span>
                حالة التأهيل ({columnTitle}):{' '}
                {isMainQualified ? 'مؤهل' : isMainNotQualified ? 'غير مؤهل' : 'قيد التدقيق'}
              </span>
            </div>

            {/* Audited Items Count */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-100/90 border border-indigo-300 text-indigo-950 text-xs font-black">
              <span>ما تم تدقيقه: {evaluatedKeys.length} من 9</span>
            </div>

            {/* Completed Count */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100/90 border border-emerald-300 text-emerald-950 text-xs font-black">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-700" />
              <span>مكتمل متطابق: {stats.completedCount}</span>
            </div>

            {/* Incomplete Count */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100/90 border border-rose-300 text-rose-950 text-xs font-black">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-700" />
              <span>غير مكتمل: {stats.incompleteCount}</span>
            </div>

            {/* N/A Count */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100/90 border border-amber-300 text-amber-950 text-xs font-black">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
              <span>لا ينطبق: {stats.naCount}</span>
            </div>

            {/* Percentage Progress */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-100/90 border border-blue-300 text-blue-950 text-xs font-black">
              <span>نسبة الاستيفاء:</span>
              <span className="font-mono text-sm text-blue-800">{stats.compliancePercentage}%</span>
            </div>
          </div>

          {/* Quick Bulk Actions for Authorized Auditors */}
          {canEdit && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleBulkSetAll('مكتمل')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-black transition-all cursor-pointer shadow-2xs active:scale-95"
                title="تحديد جميع البنود الـ 9 كـ (مكتمل)"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>تحديد الكل مكتمل</span>
              </button>
              <button
                type="button"
                onClick={() => handleBulkSetAll('لا ينطبق')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black transition-all cursor-pointer shadow-2xs active:scale-95"
                title="تحديد جميع البنود كـ (لا ينطبق)"
              >
                <MinusCircle className="w-3.5 h-3.5" />
                <span>الكل لا ينطبق</span>
              </button>
              <button
                type="button"
                onClick={() => handleBulkSetAll('غير مكتمل')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-black transition-all cursor-pointer shadow-2xs active:scale-95"
                title="تحديد جميع البنود كـ (غير مكتمل)"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>الكل غير مكتمل</span>
              </button>
              <button
                type="button"
                onClick={handleResetAllInternal}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300 text-[11px] font-black transition-all cursor-pointer shadow-2xs active:scale-95"
                title="إعادة البنود كداخلية غير مدقق عليها"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إخفاء/إعادة ضبط</span>
              </button>
            </div>
          )}
        </div>

        {/* 9 Primary Checklist Items Cards Grid (قائمة تدقيق المساندة الفنية كقائمة أساسية) */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-gradient-to-b from-slate-100/80 via-blue-50/25 to-indigo-50/35">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {TECHNICAL_SUPPORT_CHECKLIST_ITEMS.map((item, idx) => {
              const isAudited = evaluatedKeys.includes(item.key);
              const currentVal = checklistValues[item.key] || 'غير مكتمل';
              const isCompleted = isAudited && currentVal === 'مكتمل';
              const isIncomplete = isAudited && currentVal === 'غير مكتمل';
              const isNA = isAudited && currentVal === 'لا ينطبق';
              const isHighlighted = highlightedKey === item.key;

              return (
                <div
                  key={item.key}
                  className={`rounded-2xl p-3.5 border-2 transition-all shadow-xs flex flex-col justify-between gap-3 ${
                    isCompleted
                      ? 'bg-gradient-to-br from-emerald-50 via-teal-50/50 to-emerald-100/50 border-emerald-400 shadow-emerald-100'
                      : isIncomplete
                      ? 'bg-gradient-to-br from-rose-50 via-red-50/40 to-rose-100/50 border-rose-300 shadow-rose-100'
                      : isNA
                      ? 'bg-gradient-to-br from-amber-50 via-orange-50/40 to-amber-100/50 border-amber-300'
                      : 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 border-slate-300'
                  } ${isHighlighted ? 'ring-4 ring-blue-500/40 scale-[1.01]' : ''}`}
                >
                  {/* Item Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                          isCompleted
                            ? 'bg-emerald-700 text-white ring-2 ring-emerald-200'
                            : isIncomplete
                            ? 'bg-rose-700 text-white ring-2 ring-rose-200'
                            : isNA
                            ? 'bg-amber-600 text-white ring-2 ring-amber-200'
                            : 'bg-slate-700 text-amber-300 ring-2 ring-slate-200'
                        }`}
                      >
                        {renderItemIcon(item.iconName, 'w-5 h-5')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                            بند {idx + 1}
                          </span>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                            {item.title}
                          </h4>
                        </div>
                        <p className="text-[10.5px] text-slate-700 font-bold mt-0.5 leading-snug line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Current Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10.5px] font-black shrink-0 border shadow-2xs ${
                        isCompleted
                          ? 'bg-emerald-700 text-white border-emerald-800'
                          : isIncomplete
                          ? 'bg-rose-700 text-white border-rose-800'
                          : isNA
                          ? 'bg-amber-600 text-white border-amber-700'
                          : 'bg-slate-200 text-slate-800 border-slate-300'
                      }`}
                    >
                      {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                      {isIncomplete && <XCircle className="w-3 h-3" />}
                      {isNA && <MinusCircle className="w-3 h-3" />}
                      <span>{!isAudited ? 'داخلي (لم يُدقق)' : isCompleted ? 'متطابق ✓' : currentVal}</span>
                    </span>
                  </div>

                  {/* Synchronized Cell Display Indicator */}
                  <div
                    className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10.5px] font-black transition-all ${
                      isCompleted
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs'
                        : isNA
                        ? 'bg-amber-100 text-amber-950 border-amber-300'
                        : isIncomplete
                        ? 'bg-rose-100 text-rose-950 border-rose-300'
                        : 'bg-slate-200/75 text-slate-800 border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Link2 className={`w-3.5 h-3.5 shrink-0 ${isCompleted ? 'text-white' : 'text-blue-700'}`} />
                      <span className="truncate">
                        يظهر تلقائياً في خلية ({columnTitle}): {item.shortTitle}
                      </span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-black shrink-0 ${
                        isCompleted
                          ? 'bg-white text-emerald-900'
                          : isNA
                          ? 'bg-amber-600 text-white'
                          : isIncomplete
                          ? 'bg-rose-700 text-white'
                          : 'bg-slate-300 text-slate-800'
                      }`}
                    >
                      {!isAudited ? 'مخفي داخلياً' : isCompleted ? '✓ يظهر بالأخضر' : isNA ? 'يظهر لا ينطبق' : 'يظهر غير مكتمل'}
                    </span>
                  </div>

                  {/* Interactive Checklist Options */}
                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-300/80">
                    {/* Option 1: مكتمل */}
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleSelectOption(item.key, 'مكتمل')}
                      className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-black border-2 transition-all cursor-pointer active:scale-95 ${
                        isCompleted
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm ring-2 ring-emerald-400/50'
                          : 'bg-slate-50 hover:bg-emerald-50 text-emerald-900 border-emerald-300 hover:border-emerald-500'
                      } ${!canEdit ? 'opacity-80 cursor-default' : ''}`}
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isCompleted ? 'text-white' : 'text-emerald-700'}`} />
                      <span>مكتمل</span>
                    </button>

                    {/* Option 2: غير مكتمل */}
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleSelectOption(item.key, 'غير مكتمل')}
                      className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-black border-2 transition-all cursor-pointer active:scale-95 ${
                        isIncomplete
                          ? 'bg-rose-700 text-white border-rose-800 shadow-sm ring-2 ring-rose-400/50'
                          : 'bg-slate-50 hover:bg-rose-50 text-rose-900 border-rose-300 hover:border-rose-500'
                      } ${!canEdit ? 'opacity-80 cursor-default' : ''}`}
                    >
                      <XCircle className={`w-3.5 h-3.5 shrink-0 ${isIncomplete ? 'text-white' : 'text-rose-700'}`} />
                      <span>غير مكتمل</span>
                    </button>

                    {/* Option 3: لا ينطبق */}
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleSelectOption(item.key, 'لا ينطبق')}
                      className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-black border-2 transition-all cursor-pointer active:scale-95 ${
                        isNA
                          ? 'bg-amber-600 text-white border-amber-700 shadow-sm ring-2 ring-amber-300/60'
                          : 'bg-slate-50 hover:bg-amber-50 text-amber-950 border-amber-300 hover:border-amber-500'
                      } ${!canEdit ? 'opacity-80 cursor-default' : ''}`}
                    >
                      <MinusCircle className={`w-3.5 h-3.5 shrink-0 ${isNA ? 'text-white' : 'text-amber-700'}`} />
                      <span>لا ينطبق</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-gradient-to-l from-slate-100 via-blue-50/70 to-indigo-50/70 border-t border-slate-300 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 font-bold">
            {(colData.auditDateRiyadh || colData.lastUpdatedAt) && (
              <span className="inline-flex items-center gap-1 bg-slate-200/80 px-2.5 py-1 rounded-lg border border-slate-300 font-mono text-[11px] text-slate-900">
                <Clock className="w-3.5 h-3.5 text-blue-700" />
                <span>آخر تدقيق: {colData.auditDateRiyadh ? `${colData.auditDateRiyadh} ${colData.auditTimeRiyadh || ''}` : colData.lastUpdatedAt}</span>
              </span>
            )}
            {(colData.auditorEmail || colData.auditorName) && (
              <span className="inline-flex items-center gap-1 bg-blue-100/80 px-2.5 py-1 rounded-lg border border-blue-300 text-[11px] text-blue-950">
                <UserCheck className="w-3.5 h-3.5 text-blue-800" />
                <span>المدقق: {colData.auditorEmail || colData.auditorName}</span>
              </span>
            )}
            <span className="text-[11px] text-emerald-800 font-black flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>مزامنة فورية ذكية مع حفظ البنود واستعراض (مراحل التدقيق) من الركن العلوي</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-slate-200/80 hover:bg-slate-300 text-slate-900 text-xs font-black transition-colors cursor-pointer"
            >
              إغلاق البطاقة
            </button>
            {canEdit && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => triggerSync(checklistValues, mainStatus, evaluatedKeys, itemUpdatedAt, true)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'جارٍ الحفظ...' : `حفظ ومزامنة نتائج (${columnTitle})`}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* نافذة مراحل التدقيق المنبثقة فوق البطاقة للاطلاع فقط */}
      <AuditStagesReferenceModal
        isOpen={isStagesModalOpen}
        onClose={() => setIsStagesModalOpen(false)}
        order={order}
        columnTitle={columnTitle}
        initialCategoryKey={initialCategoryKey}
      />
    </div>
  );
};
