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
  Link2,
  BookOpen,
  Search,
  Building2,
  Cpu,
  Anchor,
  Cable,
  PlugZap,
  GitCommitHorizontal,
  Shield,
  RadioTower,
  SlidersHorizontal,
  Eye
} from 'lucide-react';
import { WorkOrder, WorkOrderAuditColumnData, AuditSectionCategoryData } from '../types';
import {
  AUDIT_CATEGORIES_META,
  AuditCategoryKey,
  calculateCategoryAuditStatus
} from '../data/auditChecklistData';

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
  abbrTitle: string;
  attachmentTitle: string;
  attachmentShortTitle: string;
  attachmentAbbrTitle: string;
  description: string;
  iconName: 'meter' | 'excavation' | 'equipment' | 'overhead' | 'fileText' | 'fileCheck' | 'spreadsheet' | 'layers' | 'shield';
}

export const TECHNICAL_SUPPORT_CHECKLIST_ITEMS: SupportChecklistItemMeta[] = [
  {
    key: 'meterPhotoDocumentation',
    title: 'توثيق صور العداد',
    shortTitle: 'صور العداد',
    abbrTitle: 'عداد',
    attachmentTitle: 'ارفاق صور العداد',
    attachmentShortTitle: 'صور العداد',
    attachmentAbbrTitle: 'م.عداد',
    description: 'التحقق من اكتمال وتوثيق صور العداد والقاطع والتأريض وميزان الاستواء',
    iconName: 'meter'
  },
  {
    key: 'excavationPhotoDocumentation',
    title: 'توثيق صور الحفريات',
    shortTitle: 'صور الحفريات',
    abbrTitle: 'حفر',
    attachmentTitle: 'ارفاق صور الحفريات',
    attachmentShortTitle: 'صور الحفريات',
    attachmentAbbrTitle: 'م.حفر',
    description: 'التحقق من اكتمال وتوثيق صور مسار الحفر وتمديد الكابلات والدمك والسفلتة',
    iconName: 'excavation'
  },
  {
    key: 'equipmentPhotoDocumentation',
    title: 'توثيق صور المعدات',
    shortTitle: 'صور المعدات',
    abbrTitle: 'معدات',
    attachmentTitle: 'ارفاق صور المعدات',
    attachmentShortTitle: 'صور المعدات',
    attachmentAbbrTitle: 'م.معدات',
    description: 'التحقق من اكتمال وتوثيق صور القواعد وتركيب المعدات والنهايات والتأريض',
    iconName: 'equipment'
  },
  {
    key: 'overheadPhotoDocumentation',
    title: 'توثيق صور الهوائي',
    shortTitle: 'صور الهوائي',
    abbrTitle: 'هوائي',
    attachmentTitle: 'ارفاق صور الهوائي',
    attachmentShortTitle: 'صور الهوائي',
    attachmentAbbrTitle: 'م.هوائي',
    description: 'التحقق من اكتمال وتوثيق صور الشبكات الهوائية والأعمدة والموصلات والشدادات',
    iconName: 'overhead'
  },
  {
    key: 'consultantForms',
    title: 'نماذج الاستشاري',
    shortTitle: 'نماذج الاستشاري',
    abbrTitle: 'استشاري',
    attachmentTitle: 'ارفاق نماذج الاستشاري',
    attachmentShortTitle: 'نماذج الاستشاري',
    attachmentAbbrTitle: 'م.استشاري',
    description: 'استيفاء ومطابقة نماذج الاستشاري الهندسي المعتمدة',
    iconName: 'fileText'
  },
  {
    key: 'consultantClearanceForms',
    title: 'نماذج إجازة الاستشاري',
    shortTitle: 'إجازة الاستشاري',
    abbrTitle: 'إجازة',
    attachmentTitle: 'ارفاق نماذج إجازة الاستشاري',
    attachmentShortTitle: 'إجازة الاستشاري',
    attachmentAbbrTitle: 'م.إجازة',
    description: 'اعتماد وإجازة الاستشاري لأعمال الموقع المنفذة',
    iconName: 'fileCheck'
  },
  {
    key: 'form190',
    title: 'نموذج 190',
    shortTitle: 'نموذج 190',
    abbrTitle: '190',
    attachmentTitle: 'ارفاق 190',
    attachmentShortTitle: 'ارفاق 190',
    attachmentAbbrTitle: 'م.190',
    description: 'التدقيق والمطابقة الفنية لبيانات ومرفقات نموذج 190',
    iconName: 'spreadsheet'
  },
  {
    key: 'form200',
    title: 'نموذج 200',
    shortTitle: 'نموذج 200',
    abbrTitle: '200',
    attachmentTitle: 'ارفاق 200',
    attachmentShortTitle: 'ارفاق 200',
    attachmentAbbrTitle: 'م.200',
    description: 'التدقيق والمطابقة الفنية لبيانات ومرفقات نموذج 200',
    iconName: 'layers'
  },
  {
    key: 'inspectionForm',
    title: 'نموذج الفحص',
    shortTitle: 'نموذج الفحص',
    abbrTitle: 'فحص',
    attachmentTitle: 'ارفاق الفحص',
    attachmentShortTitle: 'ارفاق الفحص',
    attachmentAbbrTitle: 'م.فحص',
    description: 'استيفاء ومطابقة نموذج الفحص والاختبار الميداني النهائي',
    iconName: 'shield'
  }
];

export const SUPPORT_CHECKLIST_OPTIONS: SupportChecklistValue[] = [
  'مكتمل',
  'غير مكتمل',
  'لا ينطبق'
];

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

export function normalizeSupportChecklistValue(raw: any): SupportChecklistValue {
  const s = String(raw || '').trim();
  if (!s) return 'غير مكتمل';
  if (s === 'لا ينطبق' || s === 'لاينطبق' || s.includes('لا ينطبق') || s.includes('لاينطبق')) {
    return 'لا ينطبق';
  }
  if (s === 'مكتمل' || s === 'ممتثل') {
    return 'مكتمل';
  }
  return 'غير مكتمل';
}

export function extractOrderSupportChecklistMap(
  order: WorkOrder
): Record<SupportChecklistFieldKey, SupportChecklistValue> {
  const tsChecklist = (order.technicalSupportAudit as any)?.supportChecklist;
  if (tsChecklist && typeof tsChecklist === 'object') {
    return {
      meterPhotoDocumentation: normalizeSupportChecklistValue(tsChecklist.meterPhotoDocumentation ?? order.meterPhotoDocumentation),
      excavationPhotoDocumentation: normalizeSupportChecklistValue(tsChecklist.excavationPhotoDocumentation ?? order.excavationPhotoDocumentation),
      equipmentPhotoDocumentation: normalizeSupportChecklistValue(tsChecklist.equipmentPhotoDocumentation ?? order.equipmentPhotoDocumentation),
      overheadPhotoDocumentation: normalizeSupportChecklistValue(tsChecklist.overheadPhotoDocumentation ?? order.overheadPhotoDocumentation),
      consultantForms: normalizeSupportChecklistValue(tsChecklist.consultantForms ?? order.consultantForms),
      consultantClearanceForms: normalizeSupportChecklistValue(tsChecklist.consultantClearanceForms ?? order.consultantClearanceForms),
      form190: normalizeSupportChecklistValue(tsChecklist.form190 ?? order.form190),
      form200: normalizeSupportChecklistValue(tsChecklist.form200 ?? order.form200),
      inspectionForm: normalizeSupportChecklistValue(tsChecklist.inspectionForm ?? order.inspectionForm)
    };
  }
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
  if (Array.isArray(order.technicalSupportAudit?.evaluatedKeys)) {
    const explicitEvaluatedKeys = order.technicalSupportAudit.evaluatedKeys as SupportChecklistFieldKey[];
    return TECHNICAL_SUPPORT_CHECKLIST_ITEMS
      .map(i => i.key)
      .filter(k => explicitEvaluatedKeys.includes(k));
  }
  const map = checklistMap || extractOrderSupportChecklistMap(order);
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

/**
 * Extracts the 9-item primary checklist map for PDC Audit, Construction Audit, or Technical Support Audit.
 */
export function extractColumnSupportChecklistMap(
  order: WorkOrder,
  columnField: 'pdcAudit' | 'constructionAudit' | 'procedure155Status' = 'procedure155Status'
): Record<SupportChecklistFieldKey, SupportChecklistValue> {
  if (columnField === 'procedure155Status') {
    return extractOrderSupportChecklistMap(order);
  }

  const colData = order[columnField] as WorkOrderAuditColumnData | undefined;
  if (colData && colData.supportChecklist && typeof colData.supportChecklist === 'object') {
    const sc = colData.supportChecklist;
    return {
      meterPhotoDocumentation: normalizeSupportChecklistValue(sc.meterPhotoDocumentation),
      excavationPhotoDocumentation: normalizeSupportChecklistValue(sc.excavationPhotoDocumentation),
      equipmentPhotoDocumentation: normalizeSupportChecklistValue(sc.equipmentPhotoDocumentation),
      overheadPhotoDocumentation: normalizeSupportChecklistValue(sc.overheadPhotoDocumentation),
      consultantForms: normalizeSupportChecklistValue(sc.consultantForms),
      consultantClearanceForms: normalizeSupportChecklistValue(sc.consultantClearanceForms),
      form190: normalizeSupportChecklistValue(sc.form190),
      form200: normalizeSupportChecklistValue(sc.form200),
      inspectionForm: normalizeSupportChecklistValue(sc.inspectionForm)
    };
  }

  // Fallback for legacy 18-category data if present
  if (colData && typeof colData === 'object') {
    const deriveFromCat = (catKey: AuditCategoryKey): SupportChecklistValue => {
      const catMeta = AUDIT_CATEGORIES_META.find(c => c.key === catKey);
      const calc = calculateCategoryAuditStatus(
        colData[catKey] as AuditSectionCategoryData | undefined,
        catMeta?.itemCount || 5
      );
      if (calc.status === 'ممتثل') return 'مكتمل';
      if (calc.status === 'لا ينطبق') return 'لا ينطبق';
      return 'غير مكتمل';
    };

    const hasAnyLegacyEvaluated = AUDIT_CATEGORIES_META.some(cat => {
      const calc = calculateCategoryAuditStatus(
        colData[cat.key] as AuditSectionCategoryData | undefined,
        cat.itemCount
      );
      return calc.status !== 'قيد التدقيق';
    });

    if (hasAnyLegacyEvaluated) {
      return {
        meterPhotoDocumentation: deriveFromCat('boxesAndMeters'),
        excavationPhotoDocumentation: deriveFromCat('excavations'),
        equipmentPhotoDocumentation: deriveFromCat('stationRoom'),
        overheadPhotoDocumentation: deriveFromCat('overheadPoles'),
        consultantForms: deriveFromCat('joints'),
        consultantClearanceForms: deriveFromCat('joints'),
        form190: deriveFromCat('terminations'),
        form200: deriveFromCat('terminations'),
        inspectionForm: deriveFromCat('terminations')
      };
    }
  }

  return {
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
}

/**
 * Returns the evaluated keys of the 9-item primary checklist for PDC Audit, Construction Audit, or Technical Support Audit.
 */
export function getEvaluatedColumnSupportChecklistKeys(
  order: WorkOrder,
  columnField: 'pdcAudit' | 'constructionAudit' | 'procedure155Status' = 'procedure155Status',
  checklistMap?: Record<SupportChecklistFieldKey, SupportChecklistValue>
): SupportChecklistFieldKey[] {
  if (columnField === 'procedure155Status') {
    return getEvaluatedSupportChecklistKeys(order, checklistMap);
  }

  const colData = order[columnField] as WorkOrderAuditColumnData | undefined;
  if (!colData || typeof colData !== 'object') return [];

  if (Array.isArray(colData.evaluatedKeys)) {
    return TECHNICAL_SUPPORT_CHECKLIST_ITEMS
      .map(i => i.key)
      .filter(k => colData.evaluatedKeys!.includes(k));
  }

  // Fallback for legacy 18-category data if evaluatedKeys was not yet saved
  const legacyEvaluated: SupportChecklistFieldKey[] = [];
  const checkCat = (catKey: AuditCategoryKey, targetKey: SupportChecklistFieldKey) => {
    const catMeta = AUDIT_CATEGORIES_META.find(c => c.key === catKey);
    const calc = calculateCategoryAuditStatus(
      colData[catKey] as AuditSectionCategoryData | undefined,
      catMeta?.itemCount || 5
    );
    if (calc.status !== 'قيد التدقيق' && !legacyEvaluated.includes(targetKey)) {
      legacyEvaluated.push(targetKey);
    }
  };

  checkCat('boxesAndMeters', 'meterPhotoDocumentation');
  checkCat('excavations', 'excavationPhotoDocumentation');
  checkCat('stationRoom', 'equipmentPhotoDocumentation');
  checkCat('overheadPoles', 'overheadPhotoDocumentation');
  checkCat('joints', 'consultantForms');
  checkCat('terminations', 'inspectionForm');

  return legacyEvaluated;
}

export function calculateSupportChecklistStats(
  values: Record<SupportChecklistFieldKey, SupportChecklistValue>,
  evaluatedKeys?: string[]
) {
  const hasExplicitEvaluated = Array.isArray(evaluatedKeys);
  const activeItems = hasExplicitEvaluated
    ? TECHNICAL_SUPPORT_CHECKLIST_ITEMS.filter(item => evaluatedKeys!.includes(item.key))
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
  const isAllApplicableCompleted = entries.length > 0 && incompleteCount === 0;

  return {
    total: entries.length,
    totalAllItems: TECHNICAL_SUPPORT_CHECKLIST_ITEMS.length,
    evaluatedCount: hasExplicitEvaluated ? evaluatedKeys!.length : entries.length,
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
  const hasExplicitEval = Array.isArray(evaluatedKeys);
  if (hasExplicitEval && evaluatedKeys!.length === 0) {
    return '';
  }
  const isKeyEvaluated = (k: SupportChecklistFieldKey) =>
    !hasExplicitEval || evaluatedKeys!.includes(k);

  const readyItems = TECHNICAL_SUPPORT_CHECKLIST_ITEMS.filter(
    (item) => isKeyEvaluated(item.key) && values[item.key] === 'مكتمل'
  );

  const stats = calculateSupportChecklistStats(values, evaluatedKeys);
  if (stats.isAllApplicableCompleted && (stats.completedCount > 0 || stats.naCount > 0)) {
    return 'جاهز للارفاق الكامل';
  }
  if (readyItems.length > 0) {
    return `جاهز لارفاق ( ${readyItems.map((i) => i.abbrTitle).join(' + ')} )`;
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

/**
 * نافذة "مراحل التدقيق" المنبثقة فوق بطاقة التدقيق للاطلاع فقط (ليست Check List):
 * تعرض القوائم الأساسية الـ 18 في عمود جانبي، وعند الضغط على أي أيقونة منها تظهر البنود الخاصة بها
 * في قائمة بجوار العمود بشكل مرتب ومنسق للاطلاع فقط.
 */
export type StageItemSemanticMark = 'ممتثل' | 'غير ممتثل' | 'لا ينطبق';

export interface AuditStagesReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: WorkOrder;
  columnTitle?: string;
  initialCategoryKey?: AuditCategoryKey | null;
}

export const AuditStagesReferenceModal: React.FC<AuditStagesReferenceModalProps> = ({
  isOpen,
  onClose,
  order,
  columnTitle = 'تدقيق الإنشاءات والـ PDC',
  initialCategoryKey = null
}) => {
  const [activeCategory, setActiveCategory] = useState<AuditCategoryKey>(
    initialCategoryKey || AUDIT_CATEGORIES_META[0].key
  );
  const [searchQuery, setSearchQuery] = useState('');

  const storageKey = useMemo(
    () => `p155_stages_semantic_marks_v1_${order.id || order.workOrderNumber}_${columnTitle}`,
    [order.id, order.workOrderNumber, columnTitle]
  );

  const [semanticMarks, setSemanticMarks] = useState<Record<string, StageItemSemanticMark>>(() => {
    try {
      const saved = localStorage.getItem(`p155_stages_semantic_marks_v1_${order.id || order.workOrderNumber}_${columnTitle}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return {};
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setSemanticMarks(parsed);
          return;
        }
      }
    } catch {}
    setSemanticMarks({});
  }, [storageKey]);

  const handleToggleItemMark = (catKey: AuditCategoryKey, itemIndex: number, mark: StageItemSemanticMark) => {
    const key = `${catKey}:${itemIndex}`;
    setSemanticMarks((prev) => {
      const next = { ...prev };
      if (next[key] === mark) {
        delete next[key];
      } else {
        next[key] = mark;
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (initialCategoryKey) {
      setActiveCategory(initialCategoryKey);
    }
  }, [initialCategoryKey]);

  const currentCategoryMeta = useMemo(
    () => AUDIT_CATEGORIES_META.find(c => c.key === activeCategory) || AUDIT_CATEGORIES_META[0],
    [activeCategory]
  );

  const activeCategoryIndex = useMemo(
    () => AUDIT_CATEGORIES_META.findIndex(c => c.key === activeCategory) + 1,
    [activeCategory]
  );

  const totalItemsCount = useMemo(
    () => AUDIT_CATEGORIES_META.reduce((sum, c) => sum + c.items.length, 0),
    []
  );

  const currentCategoryStats = useMemo(() => {
    let compliant = 0;
    let nonCompliant = 0;
    let na = 0;
    const total = currentCategoryMeta.items.length;
    for (let i = 1; i <= total; i++) {
      const m = semanticMarks[`${currentCategoryMeta.key}:${i}`];
      if (m === 'ممتثل') compliant++;
      else if (m === 'غير ممتثل') nonCompliant++;
      else if (m === 'لا ينطبق') na++;
    }
    const marked = compliant + nonCompliant + na;
    return { compliant, nonCompliant, na, marked, remaining: total - marked, total };
  }, [currentCategoryMeta, semanticMarks]);

  const filteredItems = useMemo(() => {
    return currentCategoryMeta.items
      .map((text, idx) => ({ text, index: idx + 1 }))
      .filter(({ text, index }) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return text.toLowerCase().includes(q) || index.toString().includes(q);
      });
  }, [currentCategoryMeta, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100020] flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border-2 border-[#003366] flex flex-col h-[88vh] max-h-[88vh] overflow-hidden text-right font-sans"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-gradient-to-l from-[#003366] via-[#0f2942] to-slate-900 text-white border-b-2 border-orange-500 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/20 border border-orange-400/50 text-amber-300 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10.5px] font-black bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-md shadow-2xs flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  <span>مراحل التدقيق • تلوين دلالي لمساعدة المدقق</span>
                </span>
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  القوائم الأساسية وبنود مراحل التدقيق ({columnTitle})
                </h3>
                <span className="text-xs font-mono font-bold bg-white/15 border border-white/25 text-amber-300 px-2.5 py-0.5 rounded-lg">
                  {order.workOrderNumber}
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-1 font-bold">
                {AUDIT_CATEGORIES_META.length} قائمة أساسية في العمود الجانبي • إجمالي {totalItemsCount} بند تفصيلي مزود بألوان دلالية (أخضر: ممتثل • أحمر: غير ممتثل • أصفر: لا ينطبق) لمنع نسيان أي بند
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`بحث في بنود (${currentCategoryMeta.title})...`}
                className="w-full pr-8 pl-3 py-1.5 text-xs rounded-xl bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-slate-900 placeholder:text-slate-300 focus:placeholder:text-slate-400 border border-white/25 focus:border-amber-400 focus:outline-none font-bold transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all cursor-pointer shadow-xs"
              title="إغلاق نافذة مراحل التدقيق"
            >
              <X className="w-4 h-4" />
              <span>إغلاق</span>
            </button>
          </div>
        </div>

        {/* Main Body: Right Sidebar Column (18 Main Lists) + Left Content Panel (Items with Semantic Color Buttons) */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden bg-slate-50">
          {/* العمود الجانبي للقوائم الأساسية (18 قائمة) */}
          <div className="w-full md:w-72 lg:w-80 shrink-0 border-b md:border-b-0 md:border-l border-slate-300 bg-gradient-to-b from-slate-100 via-slate-100 to-blue-50/40 flex flex-col max-h-[38vh] md:max-h-none overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-200/90 border-b border-slate-300 flex items-center justify-between shrink-0">
              <span className="text-xs font-black text-[#003366] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-orange-600" />
                <span>القوائم الأساسية ({AUDIT_CATEGORIES_META.length})</span>
              </span>
              <span className="text-[10px] font-bold bg-[#003366] text-white px-2 py-0.5 rounded-md">
                اختر القائمة
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
              {AUDIT_CATEGORIES_META.map((cat, idx) => {
                const isSelected = activeCategory === cat.key;
                let catMarkedCount = 0;
                for (let i = 1; i <= cat.items.length; i++) {
                  if (semanticMarks[`${cat.key}:${i}`]) catMarkedCount++;
                }
                const isCatAllMarked = catMarkedCount === cat.items.length && cat.items.length > 0;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      setActiveCategory(cat.key);
                      setSearchQuery('');
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#003366] text-white border-[#003366] shadow-md ring-2 ring-orange-500/80'
                        : isCatAllMarked
                        ? 'bg-emerald-50 hover:bg-emerald-100/80 text-slate-900 border-emerald-400'
                        : 'bg-white hover:bg-blue-50/80 text-slate-900 border-slate-300 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-lg font-mono text-[11px] font-black flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-orange-500 text-white'
                            : isCatAllMarked
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div
                        className={`p-1.5 rounded-lg shrink-0 ${
                          isSelected
                            ? 'bg-white/15 text-amber-300'
                            : 'bg-blue-50 text-[#003366]'
                        }`}
                      >
                        {renderAuditCategoryIcon(cat.icon, 'w-4 h-4')}
                      </div>
                      <span
                        className={`text-xs font-black truncate ${
                          isSelected ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {cat.title}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-amber-200 border border-white/20'
                          : catMarkedCount > 0
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {catMarkedCount > 0 ? `${catMarkedCount}/${cat.items.length}` : `${cat.items.length} بند`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* القائمة الجانبية المقابلة لعرض البنود التفصيلية مع الأيقونات الدلالية الثلاث */}
          <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-white via-slate-50/60 to-blue-50/20">
            {/* Selected Category Banner */}
            <div className="px-5 py-3 bg-gradient-to-l from-blue-50/90 via-indigo-50/60 to-slate-100 border-b border-slate-300 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#003366] text-amber-300 flex items-center justify-center shadow-xs shrink-0">
                  {renderAuditCategoryIcon(currentCategoryMeta.icon, 'w-5 h-5')}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded bg-orange-500 text-white">
                      القائمة #{activeCategoryIndex} من {AUDIT_CATEGORIES_META.length}
                    </span>
                    <h4 className="text-sm sm:text-base font-black text-[#003366]">
                      بنود مرحلة: {currentCategoryMeta.title}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-700 font-bold mt-0.5">
                    {currentCategoryMeta.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-black">
                <span className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white shadow-2xs">
                  ممتثل: {currentCategoryStats.compliant}
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-rose-600 text-white shadow-2xs">
                  غير ممتثل: {currentCategoryStats.nonCompliant}
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 border border-amber-500 shadow-2xs">
                  لا ينطبق: {currentCategoryStats.na}
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-slate-200 text-slate-900 border border-slate-300">
                  متبقي بدون تأشير: {currentCategoryStats.remaining}
                </span>
              </div>
            </div>

            {/* Ordered & Formatted Items List with 3 Semantic Color Icons per Item */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-600 font-bold text-xs">
                  لا توجد بنود مطابقة لنص البحث "{searchQuery}" في قائمة ({currentCategoryMeta.title})
                </div>
              ) : (
                filteredItems.map(({ text, index }) => {
                  const currentMark = semanticMarks[`${currentCategoryMeta.key}:${index}`];
                  const isCompliant = currentMark === 'ممتثل';
                  const isNonCompliant = currentMark === 'غير ممتثل';
                  const isNA = currentMark === 'لا ينطبق';

                  const rowColorClasses = isCompliant
                    ? 'bg-emerald-600 border-emerald-700 text-white shadow-md ring-2 ring-emerald-400/50'
                    : isNonCompliant
                    ? 'bg-rose-600 border-rose-700 text-white shadow-md ring-2 ring-rose-400/50'
                    : isNA
                    ? 'bg-amber-400 border-amber-500 text-slate-950 shadow-md ring-2 ring-amber-300/60'
                    : 'bg-white hover:bg-blue-50/40 border-slate-200 hover:border-blue-300 text-slate-900 shadow-2xs';

                  const indexBadgeClasses = isCompliant
                    ? 'bg-white text-emerald-800'
                    : isNonCompliant
                    ? 'bg-white text-rose-800'
                    : isNA
                    ? 'bg-slate-900 text-amber-300'
                    : 'bg-[#003366] text-amber-300';

                  const textClasses = isCompliant || isNonCompliant
                    ? 'text-white'
                    : isNA
                    ? 'text-slate-950'
                    : 'text-slate-900';

                  return (
                    <div
                      key={index}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border-2 transition-all duration-150 ${rowColorClasses}`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg font-mono text-xs font-black flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${indexBadgeClasses}`}
                        >
                          {index}
                        </span>
                        <p className={`text-xs sm:text-sm font-black leading-relaxed select-text ${textClasses}`}>
                          {text}
                        </p>
                      </div>

                      {/* 3 Semantic Status Icons: ممتثل (أخضر) • غير ممتثل (أحمر) • لا ينطبق (أصفر) */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleToggleItemMark(currentCategoryMeta.key, index, 'ممتثل')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black border transition-all cursor-pointer active:scale-95 ${
                            isCompliant
                              ? 'bg-white text-emerald-800 border-white ring-2 ring-white/60 shadow-xs'
                              : isNonCompliant || isNA
                              ? 'bg-black/20 hover:bg-emerald-600 text-white border-white/30'
                              : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-900 hover:text-white border-emerald-300'
                          }`}
                          title="ممتثل — تلوين البند كاملاً باللون الأخضر"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>ممتثل</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleItemMark(currentCategoryMeta.key, index, 'غير ممتثل')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black border transition-all cursor-pointer active:scale-95 ${
                            isNonCompliant
                              ? 'bg-white text-rose-800 border-white ring-2 ring-white/60 shadow-xs'
                              : isCompliant || isNA
                              ? 'bg-black/20 hover:bg-rose-600 text-white border-white/30'
                              : 'bg-rose-50 hover:bg-rose-600 text-rose-900 hover:text-white border-rose-300'
                          }`}
                          title="غير ممتثل — تلوين البند كاملاً باللون الأحمر"
                        >
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>غير ممتثل</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleItemMark(currentCategoryMeta.key, index, 'لا ينطبق')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black border transition-all cursor-pointer active:scale-95 ${
                            isNA
                              ? 'bg-slate-900 text-amber-300 border-slate-950 ring-2 ring-slate-900/40 shadow-xs'
                              : isCompliant || isNonCompliant
                              ? 'bg-black/20 hover:bg-amber-400 text-white hover:text-slate-950 border-white/30'
                              : 'bg-amber-50 hover:bg-amber-400 text-amber-950 border-amber-300'
                          }`}
                          title="لا ينطبق — تلوين البند كاملاً باللون الأصفر"
                        >
                          <MinusCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>لا ينطبق</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-300 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <BookOpen className="w-4 h-4 text-[#003366]" />
            <span>
              دليل مراحل التدقيق ({AUDIT_CATEGORIES_META.length} قائمة • {totalItemsCount} بند) — الألوان الدلالية (أخضر: ممتثل، أحمر: غير ممتثل، أصفر: لا ينطبق) لمساعدة المدقق على التدقيق الصحيح وعدم نسيان أي بند
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl bg-[#003366] hover:bg-[#002244] text-white text-xs font-black transition-colors cursor-pointer shadow-xs"
          >
            إغلاق نافذة مراحل التدقيق
          </button>
        </div>
      </div>
    </div>
  );
};

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
  supportChecklist?: Record<string, any>;
  itemUpdatedAt?: Record<string, string>;
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

  const [itemUpdatedAt, setItemUpdatedAt] = useState<Record<string, string>>(() => {
    return { ...((order.technicalSupportAudit as any)?.itemUpdatedAt || {}) };
  });

  const [mainStatus, setMainStatus] = useState<string>(() => {
    const initialMap = extractOrderSupportChecklistMap(order);
    const initialEvalKeys = getEvaluatedSupportChecklistKeys(order, initialMap);
    if (initialEvalKeys.length > 0) {
      const initialStats = calculateSupportChecklistStats(initialMap, initialEvalKeys);
      return initialStats.isAllApplicableCompleted ? 'مؤهل للاغلاق ( معتمد )' : 'غير مؤهل للأغلاق';
    }
    return '';
  });

  const [highlightedKey, setHighlightedKey] = useState<SupportChecklistFieldKey | null>(initialFocusField);
  const [isSaving, setIsSaving] = useState(false);
  const [isStagesModalOpen, setIsStagesModalOpen] = useState(false);
  const sessionKeyRef = React.useRef<string | null>(null);
  const localValuesRef = React.useRef(checklistValues);
  const localEvalRef = React.useRef(evaluatedKeys);
  const localTimesRef = React.useRef(itemUpdatedAt);
  localValuesRef.current = checklistValues;
  localEvalRef.current = evaluatedKeys;
  localTimesRef.current = itemUpdatedAt;

  useEffect(() => {
    const currentSessionKey = `${order.id}:${viewMode}`;
    const nextMap = extractOrderSupportChecklistMap(order);
    const nextEvalKeys = getEvaluatedSupportChecklistKeys(order, nextMap);
    const incTimes: Record<string, string> = (order.technicalSupportAudit as any)?.itemUpdatedAt || {};

    if (sessionKeyRef.current !== currentSessionKey) {
      sessionKeyRef.current = currentSessionKey;
      setChecklistValues(nextMap);
      setEvaluatedKeys(nextEvalKeys);
      setItemUpdatedAt(incTimes);
      if (nextEvalKeys.length > 0) {
        const nextStats = calculateSupportChecklistStats(nextMap, nextEvalKeys);
        setMainStatus(nextStats.isAllApplicableCompleted ? 'مؤهل للاغلاق ( معتمد )' : 'غير مؤهل للأغلاق');
      } else {
        setMainStatus('');
      }
      return;
    }

    // Smart concurrent merge per item so rapid local clicks are never reverted by in-flight prop echoes
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
        mergedValues[k] = nextMap[k];
        mergedTimes[k] = incTimes[k];
        if (nextEvalKeys.includes(k)) mergedEvalSet.add(k);
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
        const nextStats = calculateSupportChecklistStats(mergedValues, nextEvalArr);
        setMainStatus(nextStats.isAllApplicableCompleted ? 'مؤهل للاغلاق ( معتمد )' : 'غير مؤهل للأغلاق');
      } else {
        setMainStatus('');
      }
    }
  }, [order, viewMode]);

  useEffect(() => {
    setHighlightedKey(initialFocusField || null);
  }, [initialFocusField]);

  const stats = useMemo(
    () => calculateSupportChecklistStats(checklistValues, evaluatedKeys),
    [checklistValues, evaluatedKeys]
  );
  const syncedAttachmentStatus = useMemo(
    () => deriveSyncedAttachmentStatus(checklistValues, evaluatedKeys),
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

  const triggerSync = (
    nextValues: Record<SupportChecklistFieldKey, SupportChecklistValue>,
    nextMainStatus: string,
    currentEvaluatedKeys: string[],
    nextItemTimes: Record<string, string> = itemUpdatedAt,
    shouldClose = false
  ) => {
    if (!effectiveCanEdit) return;
    const isEmptyEval = currentEvaluatedKeys.length === 0;
    const payload: TechnicalSupportAuditPayload = {
      meterPhotoDocumentation: isEmptyEval ? ('' as any) : nextValues.meterPhotoDocumentation,
      excavationPhotoDocumentation: isEmptyEval ? ('' as any) : nextValues.excavationPhotoDocumentation,
      equipmentPhotoDocumentation: isEmptyEval ? ('' as any) : nextValues.equipmentPhotoDocumentation,
      overheadPhotoDocumentation: isEmptyEval ? ('' as any) : nextValues.overheadPhotoDocumentation,
      photoDocumentation: isEmptyEval ? ('' as any) : deriveLegacyPhotoDocumentationStatus(nextValues),
      consultantForms: isEmptyEval ? ('' as any) : nextValues.consultantForms,
      consultantClearanceForms: isEmptyEval ? ('' as any) : nextValues.consultantClearanceForms,
      form190: isEmptyEval ? ('' as any) : nextValues.form190,
      form200: isEmptyEval ? ('' as any) : nextValues.form200,
      inspectionForm: isEmptyEval ? ('' as any) : nextValues.inspectionForm,
      attachmentStatus: deriveSyncedAttachmentStatus(nextValues, currentEvaluatedKeys),
      procedure155Status: nextMainStatus,
      evaluatedKeys: currentEvaluatedKeys,
      supportChecklist: isEmptyEval ? {} : nextValues,
      itemUpdatedAt: nextItemTimes
    };

    if (shouldClose) {
      setIsSaving(true);
      Promise.resolve(onSave(payload, true)).finally(() => {
        setIsSaving(false);
      });
    } else {
      // Non-blocking instant sync for in-modal clicks (<1ms UI response)
      Promise.resolve(onSave(payload, false)).catch(() => {});
    }
  };

  const handleSelectOption = (key: SupportChecklistFieldKey, val: SupportChecklistValue) => {
    if (!effectiveCanEdit) return;
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
    const autoMainStatus =
      nextEvaluatedKeys.length === 0
        ? ''
        : nextStats.isAllApplicableCompleted
        ? 'مؤهل للاغلاق ( معتمد )'
        : 'غير مؤهل للأغلاق';

    setEvaluatedKeys(nextEvaluatedKeys);
    setItemUpdatedAt(nextItemTimes);
    setChecklistValues(nextValues);
    setMainStatus(autoMainStatus);
    triggerSync(nextValues, autoMainStatus, nextEvaluatedKeys, nextItemTimes, false);
  };

  const handleMainStatusToggle = (newStatus: string) => {
    if (!effectiveCanEdit) return;
    setMainStatus(newStatus);
    triggerSync(checklistValues, newStatus, evaluatedKeys, itemUpdatedAt, false);
  };

  const handleBulkSetAll = (val: SupportChecklistValue) => {
    if (!effectiveCanEdit) return;
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

    const autoMainStatus = val === 'غير مكتمل' ? 'غير مؤهل للأغلاق' : 'مؤهل للاغلاق ( معتمد )';
    setEvaluatedKeys(allKeys);
    setItemUpdatedAt(nextItemTimes);
    setChecklistValues(nextValues);
    setMainStatus(autoMainStatus);
    triggerSync(nextValues, autoMainStatus, allKeys, nextItemTimes, false);
  };

  const handleResetAllInternal = () => {
    if (!effectiveCanEdit) return;
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

    setEvaluatedKeys([]);
    setItemUpdatedAt(nextItemTimes);
    setChecklistValues(nextValues);
    setMainStatus('');
    triggerSync(nextValues, '', [], nextItemTimes, false);
  };

  const isPendingAudit = evaluatedKeys.length === 0 && (!mainStatus || mainStatus === 'قيد التدقيق');
  const isMainQualified = !isPendingAudit && !mainStatus.includes('غير') && (mainStatus.includes('مؤهل') || mainStatus.includes('معتمد'));

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
        {/* Top Executive Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b-2 border-[#F58220] bg-gradient-to-l from-[#001D40] via-[#002855] to-[#004B8D] text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#7F1D1D] border border-red-400/50 text-white shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-[#7F1D1D] border border-red-300/40 text-white px-2.5 py-0.5 rounded-md shadow-2xs">
                  {isAttachmentReadOnly
                    ? 'استعراض متزامن • مرتبطة بتدقيق المساندة الفنية'
                    : 'CHECK LIST • 11. تدقيق المساندة الفنية + مزامنة الإرفاق'}
                </span>
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  {isAttachmentReadOnly
                    ? 'بطاقة حالة الإرفاق المتزامنة تلقائياً مع تدقيق المساندة الفنية'
                    : 'بطاقة نتائج تدقيق المساندة الفنية وحالة الإرفاق المتزامنة'}
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

          <div className="flex flex-wrap items-center gap-2">
            {/* أيقونة مراحل التدقيق في الركن العلوي للاطلاع فقط */}
            <button
              type="button"
              onClick={() => setIsStagesModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#003366] hover:bg-[#002244] text-white border-b-2 border-orange-500 text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95"
              title="فتح نافذة مراحل التدقيق (القوائم الأساسية الـ 18 وبنودها للاطلاع فقط)"
            >
              <BookOpen className="w-4 h-4 text-amber-300 shrink-0" />
              <span>مراحل التدقيق</span>
              <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.2 rounded font-bold">
                للاطلاع
              </span>
            </button>

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
                isPendingAudit
                  ? 'bg-amber-500 text-slate-950 border-amber-600'
                  : isMainQualified
                  ? 'bg-emerald-700 text-white border-emerald-800'
                  : 'bg-rose-700 text-white border-rose-800'
              }`}
            >
              {isPendingAudit ? (
                <MinusCircle className="w-4 h-4" />
              ) : isMainQualified ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <span>
                حالة التدقيق: {isPendingAudit ? 'قيد التدقيق (بانتظار التدقيق الفعلي)' : isMainQualified ? 'مؤهل للاغلاق ( معتمد )' : 'غير مؤهل للأغلاق'}
              </span>
            </div>

            {/* Live Synced Attachment Status Badge */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border shadow-2xs ${
                !syncedAttachmentStatus
                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                  : syncedAttachmentStatus === 'جاهز للارفاق الكامل'
                  ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                  : syncedAttachmentStatus.startsWith('جاهز لارفاق')
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-rose-100 text-rose-950 border-rose-300'
              }`}
            >
              <Link2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>حالة الإرفاق المتزامنة: {syncedAttachmentStatus || 'بانتظار التدقيق الفعلي'}</span>
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
                onClick={() => triggerSync(checklistValues, mainStatus, evaluatedKeys, itemUpdatedAt, true)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'جارٍ الحفظ...' : 'حفظ ومزامنة نتائج التدقيق والإرفاق'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* نافذة مراحل التدقيق المنبثقة للاطلاع فقط */}
      <AuditStagesReferenceModal
        isOpen={isStagesModalOpen}
        onClose={() => setIsStagesModalOpen(false)}
        order={order}
        columnTitle="تدقيق المساندة الفنية"
      />
    </div>
  );
};
