import { ColumnDefinition } from '../types';

export interface SemanticMapping {
  targetField: string;
  targetTitle: string;
  sourceKey: string;
  sourceHeader: string;
  confidence: number; // 0 to 100
  matchReason: string;
  sampleValue?: any;
  enabled: boolean;
}

// Normalized dictionary of standard semantic column definitions and synonyms
const SEMANTIC_DICTIONARY: Record<string, { title: string; aliases: string[] }> = {
  workOrderNumber: {
    title: 'رقم أمر العمل',
    aliases: [
      'رقم أمر العمل', 'رقم امر العمل', 'رقم الأمر', 'رقم الامر', 'رقم الطلب', 'امر العمل',
      'أمر العمل', 'work order number', 'work order', 'wo number', 'wo#', 'wo_number',
      'workordernumber', 'order number', 'orderno', 'order_no'
    ]
  },
  workOrderCode: {
    title: 'نوع أمر العمل',
    aliases: [
      'رمز أمر العمل', 'رمز امر العمل', 'نوع أمر العمل', 'نوع امر العمل', 'كود أمر العمل',
      'كود امر العمل', 'رمز العمل', 'نوع العمل', 'كود العمل', 'كود', 'رمز', 'النوع',
      'work order code', 'work_order_code', 'workordercode', 'code', 'type', 'item code'
    ]
  },
  office: {
    title: 'المكتب',
    aliases: [
      'المكتب', 'مكتب', 'المكتب الفرعي', 'مكتب فرعي', 'الفرع', 'اسم المكتب', 'اسم الفرع',
      'sub office', 'sub_office', 'office', 'branch', 'suboffice'
    ]
  },
  contractor: {
    title: 'المقاول',
    aliases: [
      'المقاول', 'مقاول', 'اسم المقاول', 'الشركة', 'الشركة المنفذة', 'المورد', 'اسم الشركة',
      'contractor', 'vendor', 'contractor name', 'company', 'company name'
    ]
  },
  consultant: {
    title: 'الاستشاري',
    aliases: [
      'الاستشاري', 'استشاري', 'اسم الاستشاري', 'الاستشاري المشرف', 'المكتب الاستشاري', 'مكتب استشاري',
      'الشركة الاستشارية', 'الجهة الاستشارية', 'استشاري المشروع', 'المهندس الاستشاري',
      'consultant', 'consultant name', 'consultant_name', 'supervising consultant', 'engineering consultant'
    ]
  },
  executionStatus: {
    title: 'حالة التنفيذ',
    aliases: [
      'حالة التنفيذ', 'حالة العمل', 'التنفيذ', 'حالة الإنجاز', 'مرحلة التنفيذ',
      'execution status', 'execution_status', 'status', 'progress'
    ]
  },
  attachmentStatus: {
    title: 'حالة الارفاق',
    aliases: [
      'حالة الارفاق', 'حالة الإرفاق', 'حالة ارفاق', 'حالة إرفاق', 'الارفاق', 'الإرفاق', 'ارفاق الصور', 'إرفاق الصور',
      'حالة ارفاق الصور', 'حالة إرفاق الصور', 'تقييم الارفاق', 'تقييم الإرفاق', 'جاهزية الارفاق',
      'attachment status', 'attachment_status', 'attachmentstatus', 'photo attachment status'
    ]
  },
  photoDocumentation: {
    title: 'توثيق الصور',
    aliases: [
      'توثيق الصور', 'توثيق صور', 'الصور', 'صور التوثيق', 'توثيق ميداني', 'مرفقات الصور',
      'photo documentation', 'photos', 'photo_documentation', 'photos documentation'
    ]
  },
  consultantForms: {
    title: 'نماذج الاستشاري',
    aliases: [
      'نماذج الاستشاري', 'نماذج استشاري', 'نموذج الاستشاري', 'استمارة الاستشاري',
      'consultant forms', 'consultant_forms'
    ]
  },
  consultantClearanceForms: {
    title: 'نماذج إجازة الاستشاري',
    aliases: [
      'نماذج إجازة الاستشاري', 'نماذج اجازة الاستشاري', 'إجازة الاستشاري', 'اجازة الاستشاري',
      'نماذج الاجازة', 'نماذج الإجازة', 'إجازة', 'اجازة', 'clearance forms', 'consultant clearance'
    ]
  },
  form190: {
    title: 'نموذج 190',
    aliases: [
      'نموذج 190', '190', 'نموذج رقم 190', 'استمارة 190', 'f190', 'form 190', 'form190'
    ]
  },
  form200: {
    title: 'نموذج 200',
    aliases: [
      'نموذج 200', '200', 'نموذج رقم 200', 'استمارة 200', 'f200', 'form 200', 'form200'
    ]
  },
  inspectionForm: {
    title: 'نموذج الفحص',
    aliases: [
      'نموذج الفحص', 'الفحص', 'فحص الجودة', 'تقرير الفحص', 'استمارة الفحص',
      'inspection form', 'inspection', 'quality inspection'
    ]
  },
  qualityNotes: {
    title: 'ملاحظات الجودة',
    aliases: [
      'ملاحظات الجودة', 'الملاحظات', 'ملاحظات', 'ملاحظة', 'ملاحظات التدقيق', 'ملاحظات فنية',
      'quality notes', 'notes', 'quality_notes', 'comments', 'audit notes'
    ]
  },
  procedure155Status: {
    title: 'حالة أمر العمل',
    aliases: [
      'حالة أمر العمل', 'حالة امر العمل', 'حالة 155', 'أمر العمل 155', 'جاهزية 155',
      'حالة الاعتماد', 'مؤهل للاغلاق', 'procedure 155 status', 'status 155', 'p155 status'
    ]
  },
  statusSyncTime: {
    title: 'مزامنة الحالة',
    aliases: [
      'مزامنة الحالة', 'وقت مزامنة الحالة', 'تاريخ مزامنة الحالة', 'sync time', 'status sync'
    ]
  },
  procedure155: {
    title: 'اجراء 155',
    aliases: [
      'اجراء 155', 'إجراء 155', 'اعتماد 155', 'استلام 155', 'procedure 155', 'action 155'
    ]
  },
  procedureSyncTime: {
    title: 'مزامنة الاجراء',
    aliases: [
      'مزامنة الاجراء', 'مزامنة الإجراء', 'وقت مزامنة الاجراء', 'procedure sync time'
    ]
  }
};

/**
 * Normalizes text for comparison by removing accents, punctuation, prefixes, extra spaces.
 */
export function normalizeColumnText(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[أإآء]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[\-_\.\#\(\)\/\\:,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates similarity between two strings (Dice coefficient)
 */
function stringSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeColumnText(s1);
  const norm2 = normalizeColumnText(s2);
  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.85;

  const getBigrams = (str: string) => {
    const s = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      s.add(str.substring(i, i + 2));
    }
    return s;
  };

  const b1 = getBigrams(norm1);
  const b2 = getBigrams(norm2);
  let intersection = 0;
  b1.forEach(bg => {
    if (b2.has(bg)) intersection++;
  });

  return (2 * intersection) / (b1.size + b2.size || 1);
}

/**
 * Automatically maps source columns (from another table or uploaded file)
 * to target columns in the current table based on semantic recognition.
 */
export function autoMapSemanticColumns(
  sourceHeaders: { key: string; header: string; sampleValue?: any }[],
  targetColumns: ColumnDefinition[]
): SemanticMapping[] {
  const mappings: SemanticMapping[] = [];
  const assignedSourceKeys = new Set<string>();

  for (const targetCol of targetColumns) {
    let bestMatch: {
      sourceKey: string;
      sourceHeader: string;
      confidence: number;
      reason: string;
      sampleValue?: any;
    } | null = null;

    const dict = SEMANTIC_DICTIONARY[targetCol.field];
    const targetTitleNorm = normalizeColumnText(targetCol.title);
    const targetFieldNorm = normalizeColumnText(targetCol.field);

    for (const src of sourceHeaders) {
      if (assignedSourceKeys.has(src.key)) continue;

      const srcHeaderNorm = normalizeColumnText(src.header);
      const srcKeyNorm = normalizeColumnText(src.key);

      // 1. Exact field key match
      if (src.key === targetCol.field || srcKeyNorm === targetFieldNorm) {
        bestMatch = {
          sourceKey: src.key,
          sourceHeader: src.header,
          confidence: 100,
          reason: 'تطابق تام في معرّف الحقل الأساسي',
          sampleValue: src.sampleValue
        };
        break;
      }

      // 2. Exact title match
      if (srcHeaderNorm === targetTitleNorm) {
        bestMatch = {
          sourceKey: src.key,
          sourceHeader: src.header,
          confidence: 98,
          reason: 'تطابق تام في مسمى العمود',
          sampleValue: src.sampleValue
        };
        break;
      }

      // 3. Known dictionary alias match
      if (dict) {
        const matchesAlias = dict.aliases.some(alias => {
          const normAlias = normalizeColumnText(alias);
          return srcHeaderNorm === normAlias || srcHeaderNorm.includes(normAlias) || normAlias.includes(srcHeaderNorm);
        });

        if (matchesAlias) {
          const conf = srcHeaderNorm === normalizeColumnText(dict.title) ? 95 : 90;
          if (!bestMatch || conf > bestMatch.confidence) {
            bestMatch = {
              sourceKey: src.key,
              sourceHeader: src.header,
              confidence: conf,
              reason: `تطابق دلالي ذكي (${dict.title})`,
              sampleValue: src.sampleValue
            };
          }
        }
      }

      // 4. Fuzzy title similarity
      const sim = stringSimilarity(src.header, targetCol.title);
      if (sim > 0.65) {
        const conf = Math.round(sim * 100);
        if (!bestMatch || conf > bestMatch.confidence) {
          bestMatch = {
            sourceKey: src.key,
            sourceHeader: src.header,
            confidence: conf,
            reason: `تشابه دلالي تقريبي (${conf}%)`,
            sampleValue: src.sampleValue
          };
        }
      }
    }

    if (bestMatch && bestMatch.confidence >= 60) {
      assignedSourceKeys.add(bestMatch.sourceKey);
      mappings.push({
        targetField: targetCol.field,
        targetTitle: targetCol.title,
        sourceKey: bestMatch.sourceKey,
        sourceHeader: bestMatch.sourceHeader,
        confidence: bestMatch.confidence,
        matchReason: bestMatch.reason,
        sampleValue: bestMatch.sampleValue,
        enabled: true
      });
    } else {
      // Unmapped target column
      mappings.push({
        targetField: targetCol.field,
        targetTitle: targetCol.title,
        sourceKey: '',
        sourceHeader: '(غير معين)',
        confidence: 0,
        matchReason: 'لم يتم العثور على تطابق دلالي تلقائي',
        enabled: false
      });
    }
  }

  return mappings;
}
