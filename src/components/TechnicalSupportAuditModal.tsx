import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ShieldCheck,
  FileText,
  FileCheck2,
  FileSpreadsheet,
  Layers,
  Sparkles,
  RotateCcw,
  Save,
  CheckCheck,
  Clock,
  UserCheck,
  Award,
  Gauge,
  Pickaxe,
  Boxes,
  Zap,
  Link2
} from 'lucide-react';
import { WorkOrder } from '../types';

export type SupportChecklistValue = 'مكتمل' | 'غير مكتمل' | 'لا ينطبق';

export type SupportChecklistFieldKey =
  | 'meterPhotoDocumentation'
  | 'excavationPhotoDocumentation'
  | 'equipmentPhotoDocumentation'
  | 'overheadPhotoDocumentation'
  | 'consultantForms'
  | 'consultantClearanceForms'
  | 'form190'
  | 'form200'
  | 'inspectionForm';

export interface SupportChecklistItemMeta {
  key: SupportChecklistFieldKey;
  title: string;
  shortTitle: string;
  attachmentTitle: string;
  attachmentShortTitle: string;
  description: string;
  iconName: 'meter' | 'excavation' | 'equipment' | 'overhead' | 'fileText' | 'fileCheck' | 'spreadsheet' | 'layers' | 'shield';
}

export const TECHNICAL_SUPPORT_CHECKLIST_ITEMS: SupportChecklistItemMeta[] = [
  {
    key: 'meterPhotoDocumentation',
    title: 'توثيق صور العداد',
    shortTitle: 'توثيق صور العداد',
    attachmentTitle: 'ارفاق صور العداد',
    attachmentShortTitle: 'ارفاق صور العداد',
    description: 'التحقق من اكتمال وتوثيق صور العداد والقاطع والتأريض وميزان الاستواء',
    iconName: 'meter'
  },
  {
    key: 'excavationPhotoDocumentation',
    title: 'توثيق صور الحفريات',
    shortTitle: 'توثيق صور الحفريات',
    attachmentTitle: 'ارفاق صور الحفريات',
    attachmentShortTitle: 'ارفاق صور الحفريات',
    description: 'التحقق من اكتمال وتوثيق صور مسار الحفر وتمديد الكابلات والدمك والسفلتة',
    iconName: 'excavation'
  },
  {
    key: 'equipmentPhotoDocumentation',
    title: 'توثيق صور المعدات',
    shortTitle: 'توثيق صور المعدات',
    attachmentTitle: 'ارفاق صور المعدات',
    attachmentShortTitle: 'ارفاق صور المعدات',
    description: 'التحقق من اكتمال وتوثيق صور القواعد وتركيب المعدات والنهايات والتأريض',
    iconName: 'equipment'
  },
  {
    key: 'overheadPhotoDocumentation',
    title: 'توثيق صور الهوائي',
    shortTitle: 'توثيق صور الهوائي',
    attachmentTitle: 'ارفاق صور الهوائي',
    attachmentShortTitle: 'ارفاق صور الهوائي',
    description: 'التحقق من اكتمال وتوثيق صور الشبكات الهوائية والأعمدة والموصلات والشدادات',
    iconName: 'overhead'
  },
  {
    key: 'consultantForms',
    title: 'نماذج الاستشاري',
    shortTitle: 'نماذج الاستشاري',
    attachmentTitle: 'ارفاق نماذج الاستشاري',
    attachmentShortTitle: 'ارفاق نماذج الاستشاري',
    description: 'استيفاء ومطابقة نماذج الاستشاري الهندسي المعتمدة',
    iconName: 'fileText'
  },
  {
    key: 'consultantClearanceForms',
    title: 'نماذج إجازة الاستشاري',
    shortTitle: 'نماذج إجازة الاستشاري',
    attachmentTitle: 'ارفاق نماذج إجازة الاستشاري',
    attachmentShortTitle: 'ارفاق نماذج إجازة الاستشاري',
    description: 'اعتماد وإجازة الاستشاري لأعمال الموقع المنفذة',
    iconName: 'fileCheck'
  },
  {
    key: 'form190',
    title: 'نموذج 190',
    shortTitle: 'نموذج 190',
    attachmentTitle: 'ارفاق 190',
    attachmentShortTitle: 'ارفاق 190',
    description: 'التدقيق والمطابقة الفنية لبيانات ومرفقات نموذج 190',
    iconName: 'spreadsheet'
  },
  {
    key: 'form200',
    title: 'نموذج 200',
    shortTitle: 'نموذج 200',
    attachmentTitle: 'ارفاق 200',
    attachmentShortTitle: 'ارفاق 200',
    description: 'التدقيق والمطابقة الفنية لبيانات ومرفقات نموذج 200',
    iconName: 'layers'
  },
  {
    key: 'inspectionForm',
    title: 'نموذج الفحص',
    shortTitle: 'نموذج الفحص',
    attachmentTitle: 'ارفاق الفحص',
    attachmentShortTitle: 'ارفاق الفحص',
    description: 'استيفاء ومطابقة نموذج الفحص والاختبار الميداني النهائي',
    iconName: 'shield'
  }
];

export const SUPPORT_CHECKLIST_OPTIONS: SupportChecklistValue[] = [
  'مكتمل',
  'غير مكتمل',
  'لا ينطبق'
];

export function normalizeSupportChecklistValue(raw: any): SupportChecklistValue {
  const s = String(raw || '').trim();
  if (!s) return 'غير مكتمل';
  if (s === 'لا ينطبق' || s === 'لاينطبق' || s.includes('لا ينطبق') || s.includes('لاينطبق')) {
    return 'لا ينطبق';
  }
  if (s === 'مكتمل') {
    return 'مكتمل';
  }
  return 'غير مكتمل';
}

export function extractOrderSupportChecklistMap(
  order: WorkOrder
): Record<SupportChecklistFieldKey, SupportChecklistValue> {
  const fallbackPhotoVal = order.photoDocumentation === 'مكتمل' ? 'مكتمل' : 'غير مكتمل';
  return {
    meterPhotoDocumentation: normalizeSupportChecklistValue(order.meterPhotoDocumentation ?? fallbackPhotoVal),
    excavationPhotoDocumentation: normalizeSupportChecklistValue(order.excavationPhotoDocumentation ?? fallbackPhotoVal),
    equipmentPhotoDocumentation: normalizeSupportChecklistValue(order.equipmentPhotoDocumentation ?? fallbackPhotoVal),
    overheadPhotoDocumentation: normalizeSupportChecklistValue(order.overheadPhotoDocumentation ?? fallbackPhotoVal),
    consultantForms: normalizeSupportChecklistValue(order.consultantForms),
    consultantClearanceForms: normalizeSupportChecklistValue(order.consultantClearanceForms),
    form190: normalizeSupportChecklistValue(order.form190),
    form200: normalizeSupportChecklistValue(order.form200),
    inspectionForm: normalizeSupportChecklistValue(order.inspectionForm)
  };
}

export function getEvaluatedSupportChecklistKeys(
  order: WorkOrder,
  checklistMap?: Record<SupportChecklistFieldKey, SupportChecklistValue>
): SupportChecklistFieldKey[] {
  const map = checklistMap || extractOrderSupportChecklistMap(order);
  const explicitEvaluatedKeys = (order.technicalSupportAudit?.evaluatedKeys as SupportChecklistFieldKey[]) || [];
  if (explicitEvaluatedKeys.length > 0) {
    return TECHNICAL_SUPPORT_CHECKLIST_ITEMS
      .map(i => i.key)
      .filter(k => explicitEvaluatedKeys.includes(k));
  }
  const hasSupportAuditLog = Boolean(order.technicalSupportAudit?.lastUpdatedAt);
  if (hasSupportAuditLog) {
    return TECHNICAL_SUPPORT_CHECKLIST_ITEMS
      .filter(item => {
        const val = map[item.key];
        return val === 'مكتمل' || val === 'لا ينطبق';
      })
      .map(i => i.key);
  }
  return [];
}

export function calculateSupportChecklistStats(
  values: Record<SupportChecklistFieldKey, SupportChecklistValue>,
  evaluatedKeys?: string[]
) {
  const activeItems =
    evaluatedKeys && evaluatedKeys.length > 0
      ? TECHNICAL_SUPPORT_CHECKLIST_ITEMS.filter(item => evaluatedKeys.includes(item.key))
      : TECHNICAL_SUPPORT_CHECKLIST_ITEMS;

  const entries = activeItems.map(item => values[item.key] || 'غير مكتمل');
  const completedCount = entries.filter(v => v === 'مكتمل').length;
  const incompleteCount = entries.filter(v => v === 'غير مكتمل').length;
  const naCount = entries.filter(v => v === 'لا ينطبق').length;
  const applicableCount = entries.length - naCount;
  const compliancePercentage =
    applicableCount > 0
      ? Math.round((completedCount / applicableCount) * 100)
      : naCount > 0
      ? 100
      : 0;
  const isAllApplicableCompleted =
    evaluatedKeys !== undefined
      ? entries.length > 0 && incompleteCount === 0
      : incompleteCount === 0 && entries.length > 0;

  return {
    total: entries.length,
    totalAllItems: TECHNICAL_SUPPORT_CHECKLIST_ITEMS.length,
    evaluatedCount: evaluatedKeys ? evaluatedKeys.length : entries.length,
    completedCount,
    incompleteCount,
    naCount,
    applicableCount,
    compliancePercentage,
    isAllApplicableCompleted
  };
}

export function deriveSyncedAttachmentStatus(
  values: Record<SupportChecklistFieldKey, SupportChecklistValue>,
  evaluatedKeys?: string[]
): string {
  const stats = calculateSupportChecklistStats(values, evaluatedKeys);
  if (stats.isAllApplicableCompleted && (stats.completedCount > 0 || stats.naCount > 0)) {
    return 'جاهز للارفاق الكامل';
  }
  if (values.meterPhotoDocumentation === 'مكتمل') {
    return 'جاهز لارفاق صور العداد';
  }
  if (values.excavationPhotoDocumentation === 'مكتمل') {
    return 'جاهز لارفاق صور الخفريات';
  }
  if (values.equipmentPhotoDocumentation === 'مكتمل') {
    return 'جاهز لارفاق صور المعدات';
  }
  if (values.overheadPhotoDocumentation === 'مكتمل') {
    return 'جاهز لارفاق صور الهوائي';
  }
  return 'غير جاهز للارفاق';
}

export function deriveLegacyPhotoDocumentationStatus(
  values: Record<SupportChecklistFieldKey, SupportChecklistValue>
): SupportChecklistValue {
  const photoVals = [
    values.meterPhotoDocumentation,
    values.excavationPhotoDocumentation,
    values.equipmentPhotoDocumentation,
    values.overheadPhotoDocumentation
  ];
  if (photoVals.some(v => v === 'غير مكتمل')) return 'غير مكتمل';
  if (photoVals.some(v => v === 'مكتمل')) return 'مكتمل';
  return 'لا ينطبق';
}

export interface TechnicalSupportAuditPayload {
  meterPhotoDocumentation: SupportChecklistValue;
  excavationPhotoDocumentation: SupportChecklistValue;
  equipmentPhotoDocumentation: SupportChecklistValue;
  overheadPhotoDocumentation: SupportChecklistValue;
  photoDocumentation: SupportChecklistValue;
  consultantForms: SupportChecklistValue;
  consultantClearanceForms: SupportChecklistValue;
  form190: SupportChecklistValue;
  form200: SupportChecklistValue;
  inspectionForm: SupportChecklistValue;
  attachmentStatus: string;
  procedure155Status: string;
  evaluatedKeys?: string[];
}

interface TechnicalSupportAuditModalProps {
  isOpen: boolean;
  order: WorkOrder;
  initialFocusField?: SupportChecklistFieldKey | null;
  viewMode?: 'audit' | 'attachment_readonly';
  canEdit?: boolean;
  onClose: () => void;
  onSave: (payload: TechnicalSupportAuditPayload, shouldClose?: boolean) => Promise<void> | void;
}

export const TechnicalSupportAuditModal: React.FC<TechnicalSupportAuditModalProps> = ({
  isOpen,
  order,
  initialFocusField = null,
  viewMode = 'audit',
  canEdit = true,
  onClose,
  onSave
}) => {
  const isAttachmentReadOnly = viewMode === 'attachment_readonly';
  const effectiveCanEdit = canEdit && !isAttachmentReadOnly;

  const [checklistValues, setChecklistValues] = useState<Record<SupportChecklistFieldKey, SupportChecklistValue>>(
    () => extractOrderSupportChecklistMap(order)
  );

  const [evaluatedKeys, setEvaluatedKeys] = useState<string[]>(() => {
    return getEvaluatedSupportChecklistKeys(order);
  });

  const [mainStatus, setMainStatus] = useState<string>(() => {
    const initialMap = extractOrderSupportChecklistMap(order);
    const initialEvalKeys = getEvaluatedSupportChecklistKeys(order, initialMap);
    if (initialEvalKeys.length > 0) {
      const initialStats = calculateSupportChecklistStats(initialMap, initialEvalKeys);
      return initialStats.isAllApplicableCompleted ? 'مؤهل للاغلاق ( معتمد )' : 'غير مؤهل للأغلاق';
    }
    const raw = String(order.procedure155Status || '');
    if (raw.includes('غير')) return 'غير مؤهل للأغلاق';
    if (raw.includes('مؤهل') || raw.includes('معتمد')) return 'مؤهل للاغلاق ( معتمد )';
    return 'غير مؤهل للأغلاق';
  });

  const [highlightedKey, setHighlightedKey] = useState<SupportChecklistFieldKey | null>(initialFocusField);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const nextMap = extractOrderSupportChecklistMap(order);
    const nextEvalKeys = getEvaluatedSupportChecklistKeys(order, nextMap);
    setChecklistValues(nextMap);
    setEvaluatedKeys(nextEvalKeys);
    if (nextEvalKeys.length > 0) {
      const nextStats = calculateSupportChecklistStats(nextMap, nextEvalKeys);
      setMainStatus(nextStats.isAllApplicableCompleted ? 'مؤهل للاغلاق ( معتمد )' : 'غير مؤهل للأغلاق');
    } else {
      const raw = String(order.procedure155Status || '');
      if (raw.includes('غير')) {
        setMainStatus('غير مؤهل للأغلاق');
      } else if (raw.includes('مؤهل') || raw.includes('معتمد')) {
        setMainStatus('مؤهل للاغلاق ( معتمد )');
      } else {
        setMainStatus('غير مؤهل للأغلاق');
      }
    }
  }, [order]);

  useEffect(() => {
    setHighlightedKey(initialFocusField || null);
  }, [initialFocusField]);

  const stats = useMemo(
    () => calculateSupportChecklistStats(checklistValues, evaluatedKeys.length > 0 ? evaluatedKeys : undefined),
    [checklistValues, evaluatedKeys]
  );
  const syncedAttachmentStatus = useMemo(
    () => deriveSyncedAttachmentStatus(checklistValues, evaluatedKeys.length > 0 ? evaluatedKeys : undefined),
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

  const triggerSync = async (
    nextValues: Record<SupportChecklistFieldKey, SupportChecklistValue>,
    nextMainStatus: string,
    currentEvaluatedKeys: string[],
    shouldClose = false
  ) => {
    if (!effectiveCanEdit) return;
    setIsSaving(true);
    try {
      await onSave(
        {
          meterPhotoDocumentation: nextValues.meterPhotoDocumentation,
          excavationPhotoDocumentation: nextValues.excavationPhotoDocumentation,
          equipmentPhotoDocumentation: nextValues.equipmentPhotoDocumentation,
          overheadPhotoDocumentation: nextValues.overheadPhotoDocumentation,
          photoDocumentation: deriveLegacyPhotoDocumentationStatus(nextValues),
          consultantForms: nextValues.consultantForms,
          consultantClearanceForms: nextValues.consultantClearanceForms,
          form190: nextValues.form190,
          form200: nextValues.form200,
          inspectionForm: nextValues.inspectionForm,
          attachmentStatus: deriveSyncedAttachmentStatus(
            nextValues,
            currentEvaluatedKeys.length > 0 ? currentEvaluatedKeys : undefined
          ),
          procedure155Status: nextMainStatus,
          evaluatedKeys: currentEvaluatedKeys
        },
        shouldClose
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectOption = async (key: SupportChecklistFieldKey, val: SupportChecklistValue) => {
    if (!effectiveCanEdit) return;
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
      nextEvaluatedKeys = Array.from(new Set([...evaluatedKeys, key]));
    }

    setEvaluatedKeys(nextEvaluatedKeys);

    const nextStats = calculateSupportChecklistStats(
      nextValues,
      nextEvaluatedKeys.length > 0 ? nextEvaluatedKeys : undefined
    );
    const autoMainStatus =
      nextEvaluatedKeys.length > 0 && nextStats.isAllApplicableCompleted
        ? 'مؤهل للاغلاق ( معتمد )'
        : 'غير مؤهل للأغلاق';

    setChecklistValues(nextValues);
    setMainStatus(autoMainStatus);
    await triggerSync(nextValues, autoMainStatus, nextEvaluatedKeys, false);
  };

  const handleMainStatusToggle = async (newStatus: string) => {
    if (!effectiveCanEdit) return;
    setMainStatus(newStatus);
    await triggerSync(checklistValues, newStatus, evaluatedKeys, false);
  };

  const handleBulkSetAll = async (val: SupportChecklistValue) => {
    if (!effectiveCanEdit) return;
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
    setEvaluatedKeys(allKeys);

    const autoMainStatus = val === 'غير مكتمل' ? 'غير مؤهل للأغلاق' : 'مؤهل للاغلاق ( معتمد )';
    setChecklistValues(nextValues);
    setMainStatus(autoMainStatus);
    await triggerSync(nextValues, autoMainStatus, allKeys, false);
  };

  const handleResetAllInternal = async () => {
    if (!effectiveCanEdit) return;
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
    setEvaluatedKeys([]);
    setChecklistValues(nextValues);
    setMainStatus('غير مؤهل للأغلاق');
    await triggerSync(nextValues, 'غير مؤهل للأغلاق', [], false);
  };

  const isMainQualified = !mainStatus.includes('غير') && (mainStatus.includes('مؤهل') || mainStatus.includes('معتمد'));

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#eef2ff] rounded-2xl shadow-2xl border-2 border-slate-300 flex flex-col max-h-[92vh] overflow-hidden text-right font-sans"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Executive Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-300 bg-gradient-to-l from-slate-100 via-blue-50/80 to-indigo-50/80 text-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200 text-blue-800 shadow-2xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100/90 text-indigo-950 border border-indigo-200 px-2 py-0.5 rounded-md shadow-2xs">
                  {isAttachmentReadOnly
                    ? 'استعراض متزامن • مرتبطة بتدقيق المساندة الفنية'
                    : 'CHECK LIST • المساندة الفنية + مزامنة الإرفاق التلقائية'}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {isAttachmentReadOnly
                    ? 'بطاقة حالة الإرفاق المتزامنة تلقائياً مع تدقيق المساندة الفنية'
                    : 'بطاقة نتائج تدقيق المساندة الفنية وحالة الإرفاق المتزامنة'}
                </h3>
                <span className="text-xs font-mono font-bold bg-amber-100/90 border border-amber-300 text-amber-950 px-2.5 py-0.5 rounded-lg shadow-2xs">
                  {order.workOrderNumber}
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-1 font-bold">
                {order.office} • المقاول: {order.contractor} {order.consultant ? `• الاستشاري: ${order.consultant}` : ''} {order.workOrderCode ? `• نوع الأمر: ${order.workOrderCode}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isAttachmentReadOnly ? (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-100/90 border border-emerald-300 text-emerald-950 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                <Link2 className="w-4 h-4 text-emerald-700" />
                <span>تُحدّث وتظهر الأيقونات تلقائياً مع تدقيق المساندة الفنية</span>
              </div>
            ) : (
              /* Overall Technical Support Status Toggle */
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-slate-100 to-indigo-50/70 p-1.5 rounded-xl border border-slate-300 shadow-2xs">
                <span className="text-[11px] font-black text-slate-800 px-2">نتيجة التدقيق التلقائية:</span>
                <button
                  type="button"
                  disabled={!effectiveCanEdit}
                  onClick={() => handleMainStatusToggle('مؤهل للاغلاق ( معتمد )')}
                  className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                    isMainQualified
                      ? 'bg-emerald-700 text-white ring-2 ring-emerald-400/50'
                      : 'text-slate-800 hover:text-slate-950 hover:bg-slate-200/70'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>مؤهل للإغلاق</span>
                </button>
                <button
                  type="button"
                  disabled={!effectiveCanEdit}
                  onClick={() => handleMainStatusToggle('غير مؤهل للأغلاق')}
                  className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                    !isMainQualified
                      ? 'bg-rose-700 text-white ring-2 ring-rose-400/50'
                      : 'text-slate-800 hover:text-slate-950 hover:bg-slate-200/70'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>غير مؤهل للإغلاق</span>
                </button>
              </div>
            )}

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
                  : 'bg-rose-700 text-white border-rose-800'
              }`}
            >
              {isMainQualified ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>حالة التأهيل (حسب المدقق): {isMainQualified ? 'مؤهل للاغلاق ( معتمد )' : 'غير مؤهل للأغلاق'}</span>
            </div>

            {/* Live Synced Attachment Status Badge */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border shadow-2xs ${
                syncedAttachmentStatus === 'جاهز للارفاق الكامل'
                  ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                  : syncedAttachmentStatus.startsWith('جاهز لارفاق')
                  ? 'bg-amber-100 text-amber-950 border-amber-400'
                  : 'bg-rose-100 text-rose-950 border-rose-300'
              }`}
            >
              <Link2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>حالة الإرفاق المتزامنة: {syncedAttachmentStatus}</span>
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
          {effectiveCanEdit && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleBulkSetAll('مكتمل')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-black transition-all cursor-pointer shadow-2xs active:scale-95"
                title="تحديد جميع البنود الـ 9 كـ (مكتمل) وإظهار نظائرها في عمود حالة الإرفاق باللون الأخضر"
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

        {/* 9 Checklist Items Cards Grid */}
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
                            {isAttachmentReadOnly ? item.attachmentTitle : item.title}
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

                  {/* Synchronized Twin Indicator */}
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
                        {isAttachmentReadOnly ? `مرتبط بـ: ${item.title}` : `يظهر تلقائياً في الإرفاق: ${item.attachmentShortTitle}`}
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
                  {!isAttachmentReadOnly && (
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-300/80">
                      {/* Option 1: مكتمل */}
                      <button
                        type="button"
                        disabled={!effectiveCanEdit}
                        onClick={() => handleSelectOption(item.key, 'مكتمل')}
                        className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-black border-2 transition-all cursor-pointer active:scale-95 ${
                          isCompleted
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm ring-2 ring-emerald-400/50'
                            : 'bg-slate-50 hover:bg-emerald-50 text-emerald-900 border-emerald-300 hover:border-emerald-500'
                        } ${!effectiveCanEdit ? 'opacity-80 cursor-default' : ''}`}
                      >
                        <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isCompleted ? 'text-white' : 'text-emerald-700'}`} />
                        <span>مكتمل</span>
                      </button>

                      {/* Option 2: غير مكتمل */}
                      <button
                        type="button"
                        disabled={!effectiveCanEdit}
                        onClick={() => handleSelectOption(item.key, 'غير مكتمل')}
                        className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-black border-2 transition-all cursor-pointer active:scale-95 ${
                          isIncomplete
                            ? 'bg-rose-700 text-white border-rose-800 shadow-sm ring-2 ring-rose-400/50'
                            : 'bg-slate-50 hover:bg-rose-50 text-rose-900 border-rose-300 hover:border-rose-500'
                        } ${!effectiveCanEdit ? 'opacity-80 cursor-default' : ''}`}
                      >
                        <XCircle className={`w-3.5 h-3.5 shrink-0 ${isIncomplete ? 'text-white' : 'text-rose-700'}`} />
                        <span>غير مكتمل</span>
                      </button>

                      {/* Option 3: لا ينطبق */}
                      <button
                        type="button"
                        disabled={!effectiveCanEdit}
                        onClick={() => handleSelectOption(item.key, 'لا ينطبق')}
                        className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-black border-2 transition-all cursor-pointer active:scale-95 ${
                          isNA
                            ? 'bg-amber-600 text-white border-amber-700 shadow-sm ring-2 ring-amber-300/60'
                            : 'bg-slate-50 hover:bg-amber-50 text-amber-950 border-amber-300 hover:border-amber-500'
                        } ${!effectiveCanEdit ? 'opacity-80 cursor-default' : ''}`}
                      >
                        <MinusCircle className={`w-3.5 h-3.5 shrink-0 ${isNA ? 'text-white' : 'text-amber-700'}`} />
                        <span>لا ينطبق</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer with Sync Info & Save/Close Button */}
        <div className="px-5 py-3.5 bg-gradient-to-l from-slate-100 via-blue-50/70 to-indigo-50/70 border-t border-slate-300 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 font-bold">
            {order.statusSyncTime && (
              <span className="inline-flex items-center gap-1 bg-slate-200/80 px-2.5 py-1 rounded-lg border border-slate-300 font-mono text-[11px] text-slate-900">
                <Clock className="w-3.5 h-3.5 text-blue-700" />
                <span>آخر تدقيق: {order.statusSyncTime}</span>
              </span>
            )}
            {(order.statusSyncUser || order.statusSyncEmail) && (
              <span className="inline-flex items-center gap-1 bg-blue-100/80 px-2.5 py-1 rounded-lg border border-blue-300 text-[11px] text-blue-950">
                <UserCheck className="w-3.5 h-3.5 text-blue-800" />
                <span>المدقق: {order.statusSyncUser || order.statusSyncEmail}</span>
              </span>
            )}
            <span className="text-[11px] text-emerald-800 font-black flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isAttachmentReadOnly
                  ? 'الأيقونات المطابقة تظهر تلقائياً في عمود حالة الإرفاق فور تدقيقها في المساندة الفنية'
                  : 'أي بند يتم تدقيقه يظهر تلقائياً هنا وبنظيره المطابق في عمود حالة الإرفاق'}
              </span>
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
            {effectiveCanEdit && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => triggerSync(checklistValues, mainStatus, evaluatedKeys, true)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'جارٍ الحفظ...' : 'حفظ ومزامنة نتائج التدقيق والإرفاق'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

