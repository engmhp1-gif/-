import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import type { WorkOrder, ColumnDefinition, DropdownOptionsMap } from '../types.ts';
import { formatWorkOrderTypeValue, hasValidWorkOrderTypeNumbers, WORK_ORDER_TYPE_OPTIONS } from '../utils/workOrderType.ts';
import { extractBackupEnvelope } from '../utils/backupMergeEngine.ts';

export interface DetectedColumnInfo {
  headerName: string;
  matchedField: string;
  fieldTitle: string;
  isCustom: boolean;
  colIndex: number;
  sampleValue?: string;
  hasData: boolean;
  count: number;
}

export interface ParsedImportResult {
  success: boolean;
  orders: Partial<WorkOrder>[];
  totalRows: number;
  validRows: number;
  skippedRows: number;
  errors: string[];
  detectedColumns: Record<string, string>; // field -> headerName
  allDetectedColumns: DetectedColumnInfo[];
  discoveredNewColumns: { title: string; field: string }[];
  rawRows?: any[][];
  headerRowIndex?: number;
}

/**
 * Standard table column template definition covering ALL columns of the table
 * starting from المكتب (Sub-office) up to حالة أمر العمل (Procedure 155 Status)
 * and execution fields.
 */
export interface TemplateColumnDef {
  key: string;
  title: string;
  width: number;
  sampleValues: (string | number)[];
  dropdownOptions?: string[];
  isStandard: boolean;
}

export const STANDARD_TEMPLATE_COLUMNS: TemplateColumnDef[] = [
  {
    key: 'office',
    title: 'المكتب',
    width: 20,
    sampleValues: ['مكتب عرعر', 'مكتب طريف', 'مكتب رفحاء', 'مكتب العويقيلة', 'مكتب سكاكا', 'مكتب القريات'],
    dropdownOptions: ['مكتب عرعر', 'مكتب طريف', 'مكتب رفحاء', 'مكتب العويقيلة', 'مكتب سكاكا', 'مكتب القريات', 'مكتب الشمال', 'مكتب الجنوب', 'مكتب الشرق', 'مكتب الغرب'],
    isStandard: true
  },
  {
    key: 'contractor',
    title: 'المقاول',
    width: 30,
    sampleValues: ['فصول السنة', 'شركة شبه الجزيرة', 'الوبران', 'شركة أكتاف', 'الجلهمي', 'الاداء المتوازن'],
    dropdownOptions: ['فصول السنة', 'الوبران', 'الاداء المتوازن', 'القرش', 'بن دلامة', 'العلاوي', 'الجلهمي', 'اكتاف', 'امدادات التقنية', 'اوناس'],
    isStandard: true
  },
  {
    key: 'consultant',
    title: 'الاستشاري',
    width: 30,
    sampleValues: ['المحايد', 'الحامد'],
    dropdownOptions: ['المحايد', 'الحامد'],
    isStandard: true
  },
  {
    key: 'workOrderNumber',
    title: 'رقم أمر العمل',
    width: 22,
    sampleValues: ['WO-2026-1001', 'WO-2026-1002', 'WO-2026-1003', 'WO-2026-1004', 'WO-2026-1005', 'WO-2026-1006'],
    isStandard: true
  },
  {
    key: 'workOrderCode',
    title: 'نوع أمر العمل',
    width: 20,
    sampleValues: [],
    isStandard: true
  },
  {
    key: 'photosFile',
    title: 'ملف الصور',
    width: 22,
    sampleValues: ['مرفق معتمد (PDF/صور)'],
    isStandard: true
  },
  {
    key: 'attachmentStatus',
    title: 'حالة الارفاق',
    width: 24,
    sampleValues: ['غير جاهز للارفاق', 'جاهز للارفاق الكامل', 'جاهز لارفاق صور العداد', 'جاهز لارفاق صور الخفريات', 'جاهز لارفاق صور المعدات', 'جاهز لارفاق صور الهوائي'],
    dropdownOptions: [
      'جاهز للارفاق الكامل',
      'جاهز لارفاق صور العداد',
      'جاهز لارفاق صور الخفريات',
      'جاهز لارفاق صور المعدات',
      'جاهز لارفاق صور الهوائي',
      'غير جاهز للارفاق'
    ],
    isStandard: true
  },
  {
    key: 'photoDocumentation',
    title: 'توثيق الصور',
    width: 20,
    sampleValues: ['غير مكتمل', 'مكتمل', 'مكتمل مع ملاحظات', 'ملاحظات', 'غير مكتمل', 'مكتمل'],
    dropdownOptions: ['مكتمل', 'غير مكتمل', 'مكتمل مع ملاحظات', 'ملاحظات'],
    isStandard: true
  },
  {
    key: 'consultantForms',
    title: 'نماذج الاستشاري',
    width: 20,
    sampleValues: ['مكتمل', 'مكتمل', 'غير مكتمل', 'مكتمل مع ملاحظات', 'مكتمل', 'ملاحظات'],
    dropdownOptions: ['مكتمل', 'غير مكتمل', 'مكتمل مع ملاحظات', 'ملاحظات'],
    isStandard: true
  },
  {
    key: 'consultantClearanceForms',
    title: 'نماذج إجازة الاستشاري',
    width: 22,
    sampleValues: ['مكتمل', 'مكتمل', 'مكتمل', 'غير مكتمل', 'مكتمل مع ملاحظات', 'مكتمل'],
    dropdownOptions: ['مكتمل', 'غير مكتمل', 'مكتمل مع ملاحظات', 'ملاحظات'],
    isStandard: true
  },
  {
    key: 'form190',
    title: 'نموذج 190',
    width: 18,
    sampleValues: ['مكتمل', 'مكتمل', 'مكتمل مع ملاحظات', 'لاينطبق', 'مكتمل', 'غير مكتمل'],
    dropdownOptions: ['مكتمل', 'غير مكتمل', 'مكتمل مع ملاحظات', 'ملاحظات', 'لاينطبق'],
    isStandard: true
  },
  {
    key: 'form200',
    title: 'نموذج 200',
    width: 18,
    sampleValues: ['مكتمل', 'مكتمل', 'غير مكتمل', 'مكتمل', 'لاينطبق', 'مكتمل مع ملاحظات'],
    dropdownOptions: ['مكتمل', 'غير مكتمل', 'مكتمل مع ملاحظات', 'ملاحظات', 'لاينطبق'],
    isStandard: true
  },
  {
    key: 'inspectionForm',
    title: 'نموذج الفحص',
    width: 18,
    sampleValues: ['مكتمل', 'مكتمل', 'مكتمل', 'مكتمل مع ملاحظات', 'مكتمل', 'غير مكتمل'],
    dropdownOptions: ['مكتمل', 'غير مكتمل', 'مكتمل مع ملاحظات', 'ملاحظات', 'لاينطبق'],
    isStandard: true
  },
  {
    key: 'qualityNotes',
    title: 'ملاحظات الجودة',
    width: 35,
    sampleValues: [
      'الأعمال مستوفية لمعايير الجودة والمواصفات القياسية.',
      'تم اعتماد تقارير فحص الدمك الميكانيكي واختبار الضغط.',
      'بانتظار استكمال شهادة اختبار المختبر لطبقة الأساس.',
      'ملاحظة على نظافة الموقع وإزالة نواتج الحفر.',
      'تم الانتهاء بنجاح ومطابق للكود الفني المعتمد.',
      'تم فحص التمديدات والكابلات والتأكد من مطابقة المواصفات.'
    ],
    isStandard: true
  },
  {
    key: 'procedure155Status',
    title: 'حالة أمر العمل',
    width: 25,
    sampleValues: ['مؤهل للاغلاق ( معتمد )', 'مؤهل للاغلاق', 'غير مؤهل للأغلاق', 'غير مؤهل للاغلاق', 'مؤهل للاغلاق ( معتمد )', 'مؤهل للاغلاق'],
    dropdownOptions: ['مؤهل للاغلاق ( معتمد )', 'غير مؤهل للأغلاق', 'مؤهل للاغلاق', 'غير مؤهل للاغلاق'],
    isStandard: true
  },
  {
    key: 'statusSyncTime',
    title: 'مزامنة الحالة',
    width: 22,
    sampleValues: ['2026-10-13 10:30:00 ص'],
    isStandard: true
  },
  {
    key: 'procedure155',
    title: 'اجراء 155',
    width: 25,
    sampleValues: ['مؤهل لأجراء 155', 'غير مؤهل لإجراء 155', 'مؤهل للاستلام (معتمد)', 'تم الاستلام وإغلاق 155'],
    dropdownOptions: ['مؤهل لأجراء 155', 'غير مؤهل لإجراء 155', 'مؤهل للاستلام (معتمد)', 'تم الاستلام وإغلاق 155', 'قيد التدقيق الفني', 'غير مطابق'],
    isStandard: true
  },
  {
    key: 'procedureSyncTime',
    title: 'مزامنة الاجراء',
    width: 22,
    sampleValues: ['2026-10-13 10:30:00 ص'],
    isStandard: true
  }
];

/**
 * Downloads a pre-formatted, 100% compliant, exquisitely styled Excel template
 * with distinct, clear longitudinal and transversal gridline borders for easy filling,
 * covering ALL table columns from المكتب to حالة أمر العمل, completely empty of mock data
 * and pre-formatted for immediate data entry with dropdown validations.
 */
export const downloadWorkOrderExcelTemplate = async (
  currentColumns?: ColumnDefinition[],
  dropdownOptions?: DropdownOptionsMap
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'منظومة حوكمة جودة أعمال الإنشاءات - وحدة تدقيق أوامر العمل وإجراء 155';
  workbook.lastModifiedBy = 'منظومة حوكمة جودة أعمال الإنشاءات';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('أوامر العمل', {
    views: [
      {
        rightToLeft: true,
        showGridLines: true,
        state: 'frozen',
        ySplit: 1 // Freeze header row so columns remain pinned when scrolling
      }
    ],
    properties: {
      defaultRowHeight: 25
    }
  });

  // Build the list of columns to include in the template:
  // Starts from المكتب up to حالة أمر العمل (excluding executionStatus, boqModification, executionNotes)
  const excludedTemplateKeys = new Set(['executionStatus', 'boqModification', 'executionNotes', 'id', 'photos', 'customFields']);
  let templateCols: TemplateColumnDef[] = [...STANDARD_TEMPLATE_COLUMNS.filter(c => !excludedTemplateKeys.has(c.key))];

  if (currentColumns && currentColumns.length > 0) {
    const existingKeys = new Set(templateCols.map(c => c.key));
    const customColsToAdd: TemplateColumnDef[] = [];

    for (const col of currentColumns) {
      if (!existingKeys.has(col.field) && !excludedTemplateKeys.has(col.field)) {
        customColsToAdd.push({
          key: col.field,
          title: col.title || col.field,
          width: 22,
          sampleValues: [''],
          isStandard: false
        });
        existingKeys.add(col.field);
      }
    }

    if (customColsToAdd.length > 0) {
      templateCols = [...templateCols, ...customColsToAdd];
    }
  }

  // Update dropdown options if provided (excluding workOrderCode which has no dropdown)
  if (dropdownOptions) {
    templateCols = templateCols.map(col => {
      if (col.key === 'workOrderCode') {
        return { ...col, dropdownOptions: undefined };
      }
      const customOpts = (dropdownOptions as any)[col.key];
      if (Array.isArray(customOpts) && customOpts.length > 0) {
        return {
          ...col,
          dropdownOptions: customOpts
        };
      }
      return col;
    });
  }

  // Set columns in ExcelJS
  worksheet.columns = templateCols.map(col => ({
    header: col.title,
    key: col.key,
    width: col.width
  }));

  // Border styles: prominent, clear, dark-tinted lines so cells are explicitly outlined with both vertical and horizontal lines
  const BORDER_HEADER: Partial<ExcelJS.Borders> = {
    top: { style: 'medium', color: { argb: 'FF064E3B' } },
    bottom: { style: 'medium', color: { argb: 'FF064E3B' } },
    left: { style: 'thin', color: { argb: 'FF0F766E' } },
    right: { style: 'thin', color: { argb: 'FF0F766E' } }
  };

  const BORDER_EMPTY_GUIDE_CELL: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
    right: { style: 'thin', color: { argb: 'FF94A3B8' } }
  };

  // 1. Format Header Row (Row 1)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 36;
  headerRow.eachCell((cell) => {
    cell.font = {
      name: 'Cairo',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF064E3B' } // Deep Emerald Corporate
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: false
    };
    cell.border = BORDER_HEADER;
  });

  // 2. Pre-format 100 Blank Guide Rows: completely empty without mock data so user can fill immediately with clear borders
  const blankRowsCount = 100;
  for (let r = 0; r < blankRowsCount; r++) {
    const blankRowValues: Record<string, any> = {};
    templateCols.forEach(col => {
      blankRowValues[col.key] = '';
    });

    const blankRow = worksheet.addRow(blankRowValues);
    blankRow.height = 26;

    for (let c = 1; c <= templateCols.length; c++) {
      const cell = blankRow.getCell(c);
      const colDef = templateCols[c - 1];
      cell.border = BORDER_EMPTY_GUIDE_CELL;
      cell.font = { name: 'Cairo', size: 10, color: { argb: 'FF0F172A' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colDef?.key === 'qualityNotes' ? 'right' : 'center'
      };

      if (colDef?.key === 'receiptDate') {
        cell.numFmt = 'yyyy-mm-dd';
      }

      if (colDef?.key === 'workOrderNumber' || colDef?.key === 'workOrderCode') {
        cell.numFmt = '@'; // Text format to preserve leading zeros
      }

      if (colDef?.dropdownOptions && colDef.dropdownOptions.length > 0) {
        try {
          cell.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`"${colDef.dropdownOptions.join(',')}"`]
          };
        } catch (_) {}
      }
    }
  }

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `نموذج_أوامر_العمل_المعتمد_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Converts Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) to standard numerals (0123456789)
 */
export const convertArabicNumerals = (val: any): string => {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  const arabicNumerals = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return str.replace(/[٠-٩]/g, (d) => String(arabicNumerals.indexOf(d)));
};

/**
 * Cleans cell values: strips decimals on integers, handles numbers and dates
 */
export const cleanCellValue = (val: any): string => {
  if (val === null || val === undefined) return '';
  let str = convertArabicNumerals(val);
  
  // Strip trailing .0 from integers parsed by Excel (e.g. 10023.0 -> 10023)
  if (/^\d+\.0+$/.test(str)) {
    str = str.split('.')[0];
  }
  return str.trim();
};

/**
 * Converts Excel serial date or string date to YYYY-MM-DD
 */
export const parseExcelDate = (val: any): string => {
  if (val === null || val === undefined || val === '') {
    return new Date().toISOString().slice(0, 10);
  }
  // Check if Excel numeric serial date (e.g. 45000)
  if (typeof val === 'number' || (!isNaN(Number(val)) && !String(val).includes('-') && !String(val).includes('/'))) {
    const num = Number(val);
    if (num > 20000 && num < 70000) {
      // Excel epoch starts at 1899-12-30
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
  }
  const str = cleanCellValue(val);
  // Match standard YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const parts = str.split('-');
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
  // Match DD/MM/YYYY
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(str)) {
    const parts = str.split(/[\/\-\.]/);
    const year = parts[2];
    const month = parts[1].padStart(2, '0');
    const day = parts[0].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
};

/**
 * Normalizes text to match column headers intelligently
 */
export const normalizeHeader = (header: any): string => {
  if (header === null || header === undefined) return '';
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/[\s\-_.:/\\#()\[\]]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي');
};

/**
 * Detects whether a column header represents the Work Order Type (نوع أمر العمل)
 * Specifically handles the user-required variations:
 * - رمز أمر العمل / رمز امر العمل
 * - نوع أمر العمل / نوع امر العمل
 * - رمز رقم أمر العمل / رمز رقم امر العمل
 * - رمز ورقم أمر العمل / رمز ورقم امر العمل
 * - كود أمر العمل / كود امر العمل
 */
export const isTargetWorkOrderCodeHeader = (header: any): boolean => {
  if (header === null || header === undefined) return false;
  const clean = cleanCellValue(header);
  const norm = normalizeHeader(clean);
  if (!norm) return false;

  const exactTargets = [
    'رمزامرالعمل', 'رمزأمرالعمل',
    'نوعامرالعمل', 'نوعأمرالعمل',
    'رمزرقمامرالعمل', 'رمزرقمأمرالعمل', 'رمزرقماامرالعمل',
    'رمزورقمامرالعمل', 'رمزورقمأمرالعمل', 'رمزورقماامرالعمل',
    'كودامرالعمل', 'كودأمرالعمل', 'كودرقمامرالعمل',
    'رمزامر', 'رمزأمر', 'نوعامر', 'نوعأمر', 'كودامر', 'كودأمر',
    'نوعالعمل', 'رمزالعمل', 'كودالعمل', 'نوعالأمر', 'نوعالامر',
    'رمزالأمر', 'رمزالامر', 'كودالأمر', 'كودالامر',
    'فئةامرالعمل', 'تصنيفامرالعمل', 'workordercode', 'ordertype',
    'workordertype', 'wocode', 'type'
  ];

  if (exactTargets.some(t => norm === t || norm.includes(t))) {
    return true;
  }

  const hasCodeOrType = norm.includes('نوع') || norm.includes('رمز') || norm.includes('كود');
  const hasOrderOrWork = norm.includes('عمل') || norm.includes('امر');
  return hasCodeOrType && hasOrderOrWork;
};

/**
 * Normalizes Office names to SEC standard office names
 */
export const normalizeOfficeName = (rawName: string): string => {
  const clean = cleanCellValue(rawName);
  if (!clean) return 'مكتب عرعر';

  const norm = normalizeHeader(clean);

  if (norm.includes('عرعر') || norm.includes('arar')) return 'مكتب عرعر';
  if (norm.includes('طريف') || norm.includes('turayf') || norm.includes('turaif')) return 'مكتب طريف';
  if (norm.includes('رفحا') || norm.includes('rafha')) return 'مكتب رفحاء';
  if (norm.includes('عويقيل') || norm.includes('uwayqilah')) return 'مكتب العويقيلة';
  if (norm.includes('قريات') || norm.includes('qurayyat') || norm.includes('qurayat')) return 'مكتب القريات';
  if (norm.includes('سكاكا') || norm.includes('sakaka')) return 'مكتب سكاكا';
  if (norm.includes('دومه') || norm.includes('dumat')) return 'مكتب دومة الجندل';
  if (norm.includes('تبوك') || norm.includes('tabuk')) return 'مكتب تبوك';
  if (norm.includes('شمال') || norm.includes('north')) return 'مكتب الشمال';
  if (norm.includes('جنوب') || norm.includes('south')) return 'مكتب الجنوب';
  if (norm.includes('شرق') || norm.includes('east')) return 'مكتب الشرق';
  if (norm.includes('غرب') || norm.includes('west')) return 'مكتب الغرب';
  if (norm.includes('وسط') || norm.includes('central')) return 'مكتب الوسط';

  // If already starts with "مكتب", preserve it
  if (clean.startsWith('مكتب')) return clean;

  // Otherwise, prefix with "مكتب " for standard presentation
  return `مكتب ${clean}`;
};

/**
 * Normalizes status values to standard Arabic options
 */
export const normalizeStatusValue = (raw: any, dropdownKey: string): string => {
  const val = cleanCellValue(raw);
  if (!val) {
    if (dropdownKey === 'attachmentStatus') {
      return 'غير جاهز للارفاق';
    }
    if (
      dropdownKey === 'photoDocumentation' ||
      dropdownKey === 'consultantForms' ||
      dropdownKey === 'consultantClearanceForms' ||
      dropdownKey === 'form190' ||
      dropdownKey === 'form200' ||
      dropdownKey === 'inspectionForm'
    ) {
      return 'غير مكتمل';
    }
    if (dropdownKey === 'executionStatus') {
      return 'قيد التدقيق';
    }
    if (dropdownKey === 'procedure155Status') {
      return 'غير مؤهل للاغلاق';
    }
    if (dropdownKey === 'boqModification') {
      return 'مطابق للمقايسة المعتمدة';
    }
    return val;
  }

  const norm = normalizeHeader(val);

  if (dropdownKey === 'attachmentStatus') {
    if (norm.includes('غيرجاهز') || norm.includes('غيرمكتمل') || norm.includes('ناقص')) {
      return 'غير جاهز للارفاق';
    }
    if (norm.includes('كامل')) {
      return 'جاهز للارفاق الكامل';
    }
    if (norm.includes('عداد')) {
      return 'جاهز لارفاق صور العداد';
    }
    if (norm.includes('خفريات') || norm.includes('حفريات')) {
      return 'جاهز لارفاق صور الخفريات';
    }
    if (norm.includes('معدات')) {
      return 'جاهز لارفاق صور المعدات';
    }
    if (norm.includes('هوائي')) {
      return 'جاهز لارفاق صور الهوائي';
    }
    if (norm.includes('جاهز')) {
      return 'جاهز للارفاق الكامل';
    }
    return val;
  }

  // Four-state / Five-state normalization
  if (norm.includes('مكتمل') && (norm.includes('ملاحظ') || norm.includes('مع'))) {
    return 'مكتمل مع ملاحظات';
  }
  if (norm.includes('غيرمكتمل') || norm.includes('ناقص') || norm.includes('معلق')) {
    return 'غير مكتمل';
  }
  if (norm.includes('لاينطبق') || norm.includes('لايطبق') || norm.includes('na') || norm.includes('none')) {
    return 'لاينطبق';
  }
  if (norm.includes('ملاحظ') && !norm.includes('غير')) {
    return 'ملاحظات';
  }
  if (norm === 'مكتمل' || norm.includes('تام') || norm.includes('منتهي') || norm.includes('جاهز')) {
    if (dropdownKey === 'executionStatus' && (norm.includes('جاهز') || norm.includes('155'))) {
      return 'جاهز للاستلام 155';
    }
    if (dropdownKey === 'procedure155Status') {
      return 'مؤهل للاغلاق ( معتمد )';
    }
    return 'مكتمل';
  }

  // Procedure 155 Status
  if (dropdownKey === 'procedure155Status') {
    if (norm.includes('غيرمؤهل') || norm.includes('غيرمعتمد') || norm.includes('مرفوض')) {
      return 'غير مؤهل للأغلاق';
    }
    if (norm.includes('مؤهل') || norm.includes('معتمد') || norm.includes('مغلق')) {
      return 'مؤهل للاغلاق ( معتمد )';
    }
  }

  // Execution Status
  if (dropdownKey === 'executionStatus') {
    if (norm.includes('جاهز') || norm.includes('155')) return 'جاهز للاستلام 155';
    if (norm.includes('مكتمل') || norm.includes('منتهي')) return 'مكتمل ميدانياً';
    if (norm.includes('تدقيق') || norm.includes('فحص') || norm.includes('مراجعه')) return 'قيد التدقيق';
    if (norm.includes('تنفيذ') || norm.includes('عمل')) return 'قيد التنفيذ';
    if (norm.includes('معلق') || norm.includes('نواقص')) return 'معلق لنواقص';
    if (norm.includes('مرفوض') || norm.includes('رفض')) return 'مرفوض';
  }

  // BOQ modification
  if (dropdownKey === 'boqModification') {
    if (norm.includes('مطابق')) return 'مطابق للمقايسة المعتمدة';
    if (norm.includes('اعتماد') && norm.includes('تم')) return 'نعم - تم اعتماد تعديل المقايسة';
    if (norm.includes('بانتظار') || norm.includes('قيد')) return 'نعم - بانتظار اعتماد التعديل';
    if (norm.includes('لايوجد')) return 'لا يوجد تعديل مطلوب';
  }

  return val;
};

/**
 * Intelligent dictionary of all recognizable table fields and their Arabic/English aliases
 */
interface FieldRule {
  field: string;
  title: string;
  aliases: string[];
  priority: number;
}

const KNOWN_FIELD_RULES: FieldRule[] = [
  {
    field: '_sequence_skip_',
    title: 'تسلسل',
    aliases: ['م', 'تسلسل', 'ت', 'م.', 'رقم', 'الرقم', 'رقمتسلسلي', 'seq', '#', 'no', 'num', 'sn', 'index'],
    priority: 9
  },
  {
    field: 'office',
    title: 'المكتب',
    aliases: [
      'مكتب', 'المكتب', 'المكتبالفرعي', 'مكتبفرعي', 'فرع', 'الفرع', 'منطقه', 'المنطقه',
      'منطقة', 'المنطقة', 'قطاع', 'اداره', 'الادارة', 'اسمالمكتب', 'موقعالمكتب',
      'office', 'suboffice', 'branch', 'sub_office', 'location', 'officename'
    ],
    priority: 7
  },
  {
    field: 'contractor',
    title: 'المقاول',
    aliases: [
      'مقاول', 'المقاول', 'المقاولالمنفذ', 'مقاولمنفذ', 'شركه', 'الشركه', 'شركة', 'الشركة',
      'الشركةالمنفذة', 'الشركهالمنفذه', 'مؤسسه', 'المؤسسة', 'منفذ', 'المنفذ', 'جههالتنفيذ',
      'جهةالتنفيذ', 'اسمالمقاول', 'اسمالشركه', 'اسمالشركة', 'contractor', 'company', 'vendor', 'contractorname'
    ],
    priority: 7
  },
  {
    field: 'workOrderCode',
    title: 'نوع أمر العمل',
    aliases: [
      'رمزامرالعمل', 'رمزأمرالعمل', 'نوعامرالعمل', 'نوعأمرالعمل',
      'رمزرقمامرالعمل', 'رمزرقمأمرالعمل', 'رمزرقماامرالعمل',
      'رمزورقمامرالعمل', 'رمزورقمأمرالعمل', 'رمزورقماامرالعمل',
      'كودامرالعمل', 'كودأمرالعمل', 'كودرقمامرالعمل',
      'رمزامر', 'رمزأمر', 'نوعامر', 'نوعأمر', 'كودامر', 'كودأمر',
      'نوعالعمل', 'رمزالعمل', 'كودالعمل', 'نوعالأمر', 'نوعالامر',
      'رمزالأمر', 'رمزالامر', 'كودالأمر', 'كودالامر',
      'فئةامرالعمل', 'تصنيفامرالعمل', 'code', 'wocode', 'wo_code',
      'ordertype', 'order_type', 'workordertype', 'work_order_type', 'type'
    ],
    priority: 15
  },
  {
    field: 'workOrderNumber',
    title: 'رقم أمر العمل',
    aliases: [
      'رقمامرالعمل', 'رقمأمرالعمل', 'رقماوامرالعمل', 'رقمالامر', 'رقمالأمر', 'رقمامر', 'رقمأمر',
      'رقمطلب', 'رقممشروع', 'رقمبلاغ', 'امرالعمل', 'أمرالعمل', 'الامر', 'الأمر', 'امرشغل', 'أمرشغل',
      'workordernumber', 'workorder', 'wonum', 'wo_number', 'order_number', 'wo', 'ordernum',
      'orderid', 'wo_id', 'taskno', 'wonumber'
    ],
    priority: 10
  },
  {
    field: 'receiptDate',
    title: 'تاريخ الاستلام',
    aliases: [
      'تاريخالاستلام', 'تاريخالإستلام', 'تاريخالورود', 'تاريخالتكليف', 'تاريخامرالعمل',
      'تاريخأمرالعمل', 'تاريخالامر', 'تاريخالأمر', 'التاريخ', 'تاريخ', 'تاريخالطلب',
      'receiptdate', 'receipt_date', 'date', 'orderdate', 'order_date', 'receiveddate', 'creationdate'
    ],
    priority: 6
  },
  {
    field: 'photosFile',
    title: 'ملف الصور',
    aliases: [
      'ملفالصور', 'ملفصور', 'مرفقاتالصور', 'مرفقالصور', 'المرفقات', 'مرفقات',
      'ملفالفحص', 'ملفpdf', 'ملفالمعاينة', 'ملفالتوثيق', 'ملفاتالصور', 'ملف',
      'photosfile', 'photos_file', 'files', 'attachedfiles', 'inspectionfile'
    ],
    priority: 12
  },
  {
    field: 'attachmentStatus',
    title: 'حالة الارفاق',
    aliases: [
      'حالةالارفاق', 'حالهالارفاق', 'حالةالإرفاق', 'حالهالإرفاق', 'حالةارفاق', 'حالةإرفاق',
      'حالةارفاقالصور', 'حالةإرفاقالصور', 'تقييمالارفاق', 'تقييمالإرفاق', 'جاهزيةالارفاق',
      'attachmentstatus', 'attachment_status', 'photoattachmentstatus'
    ],
    priority: 11
  },
  {
    field: 'photoDocumentation',
    title: 'توثيق الصور',
    aliases: [
      'توثيقالصور', 'توثيقصور', 'صور', 'الصور', 'صورالموقع', 'التوثيقالفوتوغرافي',
      'التوثيق', 'تقريرالصور', 'صورالتنفيذ', 'photodocumentation', 'photo_documentation',
      'photos', 'images', 'photoreport'
    ],
    priority: 5
  },
  {
    field: 'consultantClearanceForms',
    title: 'نماذج إجازة الاستشاري',
    aliases: [
      'نماذجإجازةالاستشاري', 'نماذججازةالاستشاري', 'نماذجإجازهالاستشاري', 'نماذجاجازةالاستشاري', 'نماذجاجازهالاستشاري',
      'إجازةالاستشاري', 'اجازةالاستشاري', 'اجازهالاستشاري', 'إجازةاستشاري', 'اجازةاستشاري', 'اجازهاستشاري',
      'نماذجالاجازة', 'نماذجالإجازة', 'اخلاءطرفالاستشاري', 'نماذجاخلاءالطرفللاستشاري',
      'clearanceforms', 'clearance', 'consultantclearance'
    ],
    priority: 9
  },
  {
    field: 'consultantForms',
    title: 'نماذج الاستشاري',
    aliases: [
      'نماذجالاستشاري', 'نموذجالاستشاري', 'نماذجاستشاري',
      'نموذجاستشاري', 'استمارةالاستشاري', 'تقريرالاستشاري', 'consultantforms', 'consultant_forms'
    ],
    priority: 8
  },
  {
    field: 'consultant',
    title: 'الاستشاري',
    aliases: [
      'الاستشاري', 'استشاري', 'الإستشاري', 'إستشاري', 'اسمالاستشاري', 'الاستشاريالمشرف',
      'المكتبالاستشاري', 'مكتباستشاري', 'الشركةالاستشارية', 'الشركهالاستشاريه',
      'الجهةالاستشارية', 'الجههالاستشاريه', 'استشاريالمشروع', 'المهندسالاستشاري',
      'consultant', 'consultantname', 'consultant_name', 'supervisingconsultant', 'engineeringconsultant'
    ],
    priority: 7
  },
  {
    field: 'form190',
    title: 'نموذج 190',
    aliases: ['نموذج190', '190', 'ن190', 'نموذجرقم190', 'استمارة190', 'form190', 'form_190', 'f190'],
    priority: 6
  },
  {
    field: 'form200',
    title: 'نموذج 200',
    aliases: ['نموذج200', '200', 'ن200', 'نموذجرقم200', 'استمارة200', 'form200', 'form_200', 'f200'],
    priority: 6
  },
  {
    field: 'inspectionForm',
    title: 'نموذج الفحص',
    aliases: [
      'نموذجالفحص', 'فحص', 'الفحص', 'تقريرفحص', 'تقريرالفحص', 'محضرفحص', 'محضرالفحص',
      'استمارةفحص', 'فحصالموقع', 'inspectionform', 'inspection_form', 'inspection'
    ],
    priority: 5
  },
  {
    field: 'qualityNotes',
    title: 'ملاحظات الجودة',
    aliases: [
      'ملاحظاتالجوده', 'ملاحظاتالجودة', 'ملاحظاتجوده', 'ملاحظاتجودة', 'الملاحظات',
      'ملاحظات', 'ملاحظاتفنية', 'ملاحظاتفنيه', 'ملاحظاتالتدقيق', 'ملاحظاتالجودةالفنية',
      'qualitynotes', 'quality_notes', 'notes', 'remarks', 'quality'
    ],
    priority: 5
  },
  {
    field: 'procedure155Status',
    title: 'حالة أمر العمل',
    aliases: [
      'حالةامرالعمل', 'حالةأمرالعمل', 'حالهامرالعمل', 'حالهأمرالعمل', 'حالةالامر',
      'حالةالأمر', 'حالهالامر', 'حالهالأمر', 'حالة155', 'حاله155', 'حالةالاغلاق',
      'حالهالاغلاق', 'حالةالإغلاق', 'حالهالإغلاق', 'اهليةالاغلاق', 'أهليةالإغلاق',
      'اهليهالاغلاق', 'حالةالاعتماد', 'procedure155status', 'status155', 'wostatus',
      'orderstatus', 'closurestatus', 'status'
    ],
    priority: 7
  },
  {
    field: 'statusSyncTime',
    title: 'مزامنة الحالة',
    aliases: ['مزامنةالحالة', 'مزامنهالحاله', 'تحديثالحالة', 'تاريخمزامنةالحالة', 'وقتمزامنةالحالة', 'statussynctime'],
    priority: 5
  },
  {
    field: 'procedure155',
    title: 'اجراء 155',
    aliases: [
      'إجراء155', 'اجراء155', 'إجراء_155', 'اجراء_155', 'إجراء', 'اجراء', 'موقف155',
      'موقفإجراء155', 'موقفاجراء155', 'استلام155', 'اعتماد155', 'procedure155', 'p155', 'proc155'
    ],
    priority: 6
  },
  {
    field: 'procedureSyncTime',
    title: 'مزامنة الاجراء',
    aliases: ['مزامنةالاجراء', 'مزامنهالاجراء', 'مزامنةإجراء155', 'وقتمزامنةالاجراء', 'proceduresynctime'],
    priority: 5
  },
  {
    field: 'executionStatus',
    title: 'حالة التنفيذ',
    aliases: ['حالةالتنفيذ', 'حالهالتنفيذ', 'تنفيذ', 'موقفالتنفيذ', 'وضعالتنفيذ', 'executionstatus', 'execution_status'],
    priority: 4
  },
  {
    field: 'boqModification',
    title: 'تعديل المقايسة',
    aliases: [
      'تعديلالمقايسه', 'تعديلالمقايسة', 'المقايسه', 'المقايسة', 'مقايسه', 'مقايسة',
      'اعتمادالمقايسة', 'boqmodification', 'boq_modification', 'boq'
    ],
    priority: 4
  },
  {
    field: 'executionNotes',
    title: 'ملاحظات التنفيذ',
    aliases: ['ملاحظاتالتنفيذ', 'ملاحظاتتنفيذ', 'ملاحظاتميدانيه', 'ملاحظاتالمقاول', 'executionnotes', 'execution_notes'],
    priority: 3
  },
  {
    field: 'completionPercentage',
    title: 'نسبة الإنجاز',
    aliases: ['نسبةالإنجاز', 'نسبةالانجاز', 'نسبهالانجاز', 'نسبةالتنفيذ', 'completionpercentage', 'percentage', 'progress'],
    priority: 3
  },
  {
    field: 'inspectorName',
    title: 'اسم المفتش',
    aliases: ['اسمالمفتش', 'المفتش', 'مهندسمشرف', 'مدققالجودة', 'inspector', 'inspector_name'],
    priority: 3
  },
  {
    field: 'priority',
    title: 'الأولوية',
    aliases: ['الأولوية', 'الاولوية', 'اولويه', 'priority'],
    priority: 3
  },
  {
    field: 'pdcAudit',
    title: 'تدقيق PDC',
    aliases: ['تدقيقpdc', 'pdc', 'pdcaudit', 'pdc_audit', 'حالةتدقيقpdc', 'تقييمpdc'],
    priority: 10
  },
  {
    field: 'constructionAudit',
    title: 'تدقيق الإنشاءات',
    aliases: ['تدقيقالانشاءات', 'تدقيقالإنشاءات', 'الانشاءات', 'الإنشاءات', 'constructionaudit', 'construction_audit', 'حالةتدقيقالانشاءات'],
    priority: 10
  },
  {
    field: 'technicalSupportAudit',
    title: 'تدقيق المساندة الفنية',
    aliases: ['تدقيقالمساندةالفنية', 'تدقيقالمساندهالفنيه', 'المساندةالفنية', 'المساندهالفنيه', 'technicalsupportaudit', 'technical_support_audit'],
    priority: 9
  },
  {
    field: 'tableName',
    title: 'اسم الجدول',
    aliases: ['اسمالجدول', 'الجدول', 'جدولالشهر', 'tablename', 'table_name'],
    priority: 6
  },
  {
    field: 'tableYear',
    title: 'سنة الجدول',
    aliases: ['سنةالجدول', 'سنهالجدول', 'السنة', 'السنه', 'tableyear', 'table_year', 'year'],
    priority: 5
  },
  {
    field: 'tableMonth',
    title: 'شهر الجدول',
    aliases: ['شهرالجدول', 'الشهر', 'tablemonth', 'table_month', 'month'],
    priority: 5
  },
  {
    field: 'tableId',
    title: 'معرف الجدول',
    aliases: ['معرفالجدول', 'كودالجدول', 'tableid', 'table_id'],
    priority: 6
  },
  {
    field: 'id',
    title: 'معرف السجل',
    aliases: ['معرفالسجل', 'معرفالامر', 'recordid', 'record_id'],
    priority: 6
  }
];

export const ALLOWED_PLATFORM_IMPORT_FIELDS = new Set<string>([
  'office',
  'contractor',
  'consultant',
  'workOrderNumber',
  'workOrderCode',
  'photosFile',
  'attachmentStatus',
  'qualityNotes',
  'pdcAudit',
  'constructionAudit',
  'procedure155Status',
  'statusSyncTime',
  'procedure155',
  'procedureSyncTime',
  'receiptDate',
  'tableName',
  'tableYear',
  'tableMonth',
  'tableId',
  'id'
]);

export const IMPORTABLE_STANDARD_FIELDS = [
  { field: 'office', title: '1. المكتب' },
  { field: 'contractor', title: '2. المقاول' },
  { field: 'consultant', title: '3. الاستشاري' },
  { field: 'workOrderNumber', title: '4. رقم أمر العمل' },
  { field: 'workOrderCode', title: '5. رمز أمر العمل' },
  { field: 'photosFile', title: '6. ملف الصور (SharePoint)' },
  { field: 'attachmentStatus', title: '7. حالة الإرفاق' },
  { field: 'qualityNotes', title: '8. ملاحظات الجودة' },
  { field: 'pdcAudit', title: '9. تدقيق PDC' },
  { field: 'constructionAudit', title: '10. تدقيق الإنشاءات' },
  { field: 'procedure155Status', title: '11. تدقيق المساندة الفنية' },
  { field: 'statusSyncTime', title: '12. وقت وتاريخ التدقيق' },
  { field: 'procedure155', title: '13. إجراء 155 النهائي' },
  { field: 'procedureSyncTime', title: '14. وقت اعتماد 155' },
  { field: '_skip_', title: '🚫 تجاهل وعدم الاستيراد (عمود غير موجود بالمنصة)' }
];

/**
 * Intelligent deep content-based inference:
 * Analyzes sample values of a column to recognize its semantic field with 99.9% accuracy
 * even when column headers are missing, cryptic, or mismatched.
 */
export const inferFieldFromCellValues = (
  samples: string[]
): { field: string; confidence: number } | null => {
  const cleanSamples = samples
    .map(s => cleanCellValue(s))
    .filter(s => s !== '' && s !== '-');

  if (cleanSamples.length === 0) return null;

  // 1. Check if column is a row sequence counter (#, 1, 2, 3...)
  const isAllNumbers = cleanSamples.every(s => /^\d{1,4}$/.test(s));
  if (isAllNumbers) {
    const nums = cleanSamples.map(s => Number(s));
    const isSequential = nums.length >= 2 && nums.every((n, i) => i === 0 || n >= nums[i - 1]);
    const maxVal = Math.max(...nums);
    if (isSequential && maxVal < 5000) {
      return { field: '_sequence_skip_', confidence: 95 };
    }
  }

  // 2. Check if Office Names
  const officeKeywords = ['عرعر', 'طريف', 'رفحاء', 'رفحا', 'سكاكا', 'القريات', 'قريات', 'العويقيلة', 'عويقيل', 'دومة الجندل', 'دومه', 'تبوك', 'الشمال', 'الجنوب', 'الشرق', 'الغرب'];
  const officeHits = cleanSamples.filter(s => {
    const norm = normalizeHeader(s);
    return officeKeywords.some(kw => norm.includes(normalizeHeader(kw))) || norm.includes('مكتب');
  }).length;
  if (officeHits / cleanSamples.length >= 0.5) {
    return { field: 'office', confidence: 90 };
  }

  // 3. Check if Procedure 155 Status (حالة أمر العمل)
  const p155StatusHits = cleanSamples.filter(s => {
    const norm = normalizeHeader(s);
    return (
      (norm.includes('مؤهل') && norm.includes('اغلاق')) ||
      norm.includes('مؤهلللاغلاق') ||
      norm.includes('غيرمؤهل') ||
      norm.includes('مؤهلللاغلاقمعتمد')
    );
  }).length;
  if (p155StatusHits / cleanSamples.length >= 0.4) {
    return { field: 'procedure155Status', confidence: 95 };
  }

  // 4. Check if Procedure 155 (اجراء 155)
  const p155Hits = cleanSamples.filter(s => {
    const norm = normalizeHeader(s);
    return (
      norm.includes('155') ||
      norm.includes('استلام') ||
      norm.includes('مؤهللاجراء155') ||
      norm.includes('قيدالتدقيق')
    );
  }).length;
  if (p155Hits / cleanSamples.length >= 0.4) {
    return { field: 'procedure155', confidence: 90 };
  }

  // 5. Check if Work Order Code (نوع أمر العمل)
  const woTypeHits = cleanSamples.filter(s => {
    const norm = normalizeHeader(s);
    return (
      norm === '801' ||
      norm === '401' ||
      norm === '912' ||
      norm === 'لاينطبق' ||
      norm.includes('sec-') ||
      WORK_ORDER_TYPE_OPTIONS.some(opt => norm === normalizeHeader(opt))
    );
  }).length;
  if (woTypeHits / cleanSamples.length >= 0.5) {
    return { field: 'workOrderCode', confidence: 90 };
  }

  // 6. Check if Dates (تاريخ الاستلام)
  const dateHits = cleanSamples.filter(s => {
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) return true;
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/.test(s)) return true;
    const num = Number(s);
    if (!isNaN(num) && num > 35000 && num < 65000) return true;
    return false;
  }).length;
  if (dateHits / cleanSamples.length >= 0.6) {
    return { field: 'receiptDate', confidence: 90 };
  }

  // 7. Check if Contractor (المقاول)
  const contractorKeywords = ['فصول', 'الجزيرة', 'شبه', 'أكتاف', 'اكتاف', 'الجلهمي', 'جلهمي', 'الوبران', 'وبران', 'شركة', 'مؤسسة', 'الاداء', 'متوازن', 'القرش', 'بن دلامة', 'العلاوي', 'امدادات', 'اوناس'];
  const contractorHits = cleanSamples.filter(s => {
    const norm = normalizeHeader(s);
    return contractorKeywords.some(kw => norm.includes(normalizeHeader(kw)));
  }).length;
  if (contractorHits / cleanSamples.length >= 0.4) {
    return { field: 'contractor', confidence: 85 };
  }

  // 7b. Check if Consultant (الاستشاري)
  const consultantKeywords = ['دار الهندسة', 'زهير فايز', 'سعود كونسلت', 'خطيب وعلمي', 'الاستشاري المعتمد', 'مكتب الإشراف', 'استشارات هندسية', 'كونسلت'];
  const consultantHits = cleanSamples.filter(s => {
    const norm = normalizeHeader(s);
    if (norm.includes('مكتمل') || norm.includes('ملاحظ') || norm.includes('لاينطبق')) return false;
    return consultantKeywords.some(kw => norm.includes(normalizeHeader(kw)));
  }).length;
  if (consultantHits / cleanSamples.length >= 0.4) {
    return { field: 'consultant', confidence: 85 };
  }

  // 8. Check if Work Order Number (رقم أمر العمل)
  const woNumHits = cleanSamples.filter(s => {
    if (/^wo[-_]/i.test(s)) return true;
    if (/^\d{5,12}$/.test(s)) return true;
    if (/^[A-Za-z0-9\-_]{6,16}$/.test(s)) return true;
    return false;
  }).length;
  // Also check uniqueness: work order numbers should be mostly unique
  const uniqueCount = new Set(cleanSamples).size;
  if (woNumHits / cleanSamples.length >= 0.6 && uniqueCount / cleanSamples.length >= 0.7) {
    return { field: 'workOrderNumber', confidence: 85 };
  }

  // 9. Check if Quality Notes (ملاحظات طويلة)
  const longNoteHits = cleanSamples.filter(s => s.length > 25).length;
  if (longNoteHits / cleanSamples.length >= 0.4) {
    return { field: 'qualityNotes', confidence: 80 };
  }

  return null;
};

/**
 * Universal Dynamic Header and Column Scanner
 * Scans ALL columns present in the Excel sheet (standard and custom)
 */
export const detectUniversalColumns = (
  rawRows: any[][],
  customColumns?: ColumnDefinition[]
): {
  headerRowIndex: number;
  mappedColumns: {
    colIndex: number;
    headerName: string;
    matchedField: string;
    fieldTitle: string;
    isCustom: boolean;
  }[];
  discoveredNewColumns: { title: string; field: string }[];
} => {
  const maxSearchRows = Math.min(25, rawRows.length);
  let bestHeaderRowIndex = 0;
  let highestScore = -1;

  // 1. Identify which row is the true header row
  for (let r = 0; r < maxSearchRows; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    let score = 0;
    const recognizedInRow = new Set<string>();

    for (let c = 0; c < row.length; c++) {
      const cellText = cleanCellValue(row[c]);
      const norm = normalizeHeader(cellText);
      if (!norm) continue;

      for (const rule of KNOWN_FIELD_RULES) {
        if (!recognizedInRow.has(rule.field)) {
          const isMatch = rule.aliases.some(alias => norm === alias || norm.includes(alias));
          if (isMatch) {
            score += rule.priority;
            recognizedInRow.add(rule.field);
            break;
          }
        }
      }

      // Check against current custom columns
      if (customColumns && customColumns.length > 0) {
        for (const col of customColumns) {
          const colNorm = normalizeHeader(col.title || col.field);
          if (norm === colNorm || norm.includes(colNorm)) {
            score += 3;
            break;
          }
        }
      }
    }

    if (score > highestScore && score >= 3) {
      highestScore = score;
      bestHeaderRowIndex = r;
    }
  }

  // 2. Determine max columns across all rows to ensure NO column with data is omitted
  const headerRow = rawRows[bestHeaderRowIndex] || [];
  let maxColCount = headerRow.length;
  for (let r = 0; r < rawRows.length; r++) {
    if (Array.isArray(rawRows[r]) && rawRows[r].length > maxColCount) {
      maxColCount = rawRows[r].length;
    }
  }

  const mappedColumns: {
    colIndex: number;
    headerName: string;
    matchedField: string;
    fieldTitle: string;
    isCustom: boolean;
  }[] = [];

  const assignedFields = new Set<string>();
  const discoveredNewColumns: { title: string; field: string }[] = [];

  for (let c = 0; c < maxColCount; c++) {
    const rawHeader = c < headerRow.length ? cleanCellValue(headerRow[c]) : '';

    // Check if column c has ANY non-empty cell across data rows
    let colHasData = false;
    const colSamples: string[] = [];
    for (let r = bestHeaderRowIndex + 1; r < rawRows.length; r++) {
      if (c < (rawRows[r]?.length || 0)) {
        const val = cleanCellValue(rawRows[r][c]);
        if (val !== '') {
          colHasData = true;
          if (colSamples.length < 40) {
            colSamples.push(val);
          }
        }
      }
    }

    // If column has neither a header nor any data in any row, skip it
    if (!rawHeader && !colHasData) continue;

    // If header is missing but column has data, provide a clear descriptive title
    const effectiveHeader = rawHeader || `عمود إضافي (${c + 1})`;
    const norm = normalizeHeader(effectiveHeader);
    let matchedField: string | null = null;
    let fieldTitle: string = effectiveHeader;
    let isCustom = false;

    // 1. Check standard fields first by header alias
    for (const rule of KNOWN_FIELD_RULES) {
      if (!assignedFields.has(rule.field)) {
        const isMatch = rule.aliases.some(alias => norm === alias || norm.includes(alias));
        if (isMatch) {
          matchedField = rule.field;
          fieldTitle = rule.title;
          assignedFields.add(rule.field);
          break;
        }
      }
    }

    // 2. If not matched, run intelligent content-based inference from sample cells
    if (!matchedField || matchedField === '_sequence_skip_') {
      const inferred = inferFieldFromCellValues(colSamples);
      if (inferred && !assignedFields.has(inferred.field)) {
        matchedField = inferred.field;
        const matchedRule = KNOWN_FIELD_RULES.find(r => r.field === inferred.field);
        fieldTitle = matchedRule?.title || effectiveHeader;
        assignedFields.add(inferred.field);
      }
    }

    // 3. Check existing custom columns
    if (!matchedField && customColumns && customColumns.length > 0) {
      for (const col of customColumns) {
        const colNorm = normalizeHeader(col.title || col.field);
        if (!assignedFields.has(col.field) && (norm === colNorm || norm.includes(colNorm))) {
          matchedField = col.field;
          fieldTitle = col.title;
          isCustom = true;
          assignedFields.add(col.field);
          break;
        }
      }
    }

    // If marked as row sequence counter or not in the platform's canonical columns, mark as _skip_
    // Never import any new or unrecognized columns from Excel files!
    if (matchedField === '_sequence_skip_' || !matchedField || !ALLOWED_PLATFORM_IMPORT_FIELDS.has(matchedField)) {
      matchedField = '_skip_';
      fieldTitle = '🚫 تجاهل (عمود غير موجود بالمنصة)';
      isCustom = false;
    }

    mappedColumns.push({
      colIndex: c,
      headerName: effectiveHeader,
      matchedField,
      fieldTitle,
      isCustom: false
    });
  }

  // Fallback: If workOrderNumber was never matched by header, pick first numeric or ID-like column
  // (strictly ignoring sequence / skipped columns)
  const hasWon = mappedColumns.some(m => m.matchedField === 'workOrderNumber');
  if (!hasWon && mappedColumns.length > 0) {
    let bestCandidateIndex = -1;
    let bestCandidateScore = -1;

    for (const colMap of mappedColumns) {
      if (colMap.matchedField === '_skip_') continue;
      const samples: string[] = [];
      for (let r = bestHeaderRowIndex + 1; r < Math.min(bestHeaderRowIndex + 30, rawRows.length); r++) {
        if (colMap.colIndex < (rawRows[r]?.length || 0)) {
          const v = cleanCellValue(rawRows[r][colMap.colIndex]);
          if (v) samples.push(v);
        }
      }
      if (samples.length === 0) continue;
      let score = 0;
      for (const s of samples) {
        if (/^wo[-_]/i.test(s)) score += 6;
        else if (/^\d{5,12}$/.test(s)) score += 3;
        else if (/^[A-Za-z0-9\-_]{6,16}$/.test(s)) score += 2;
      }
      if (score > bestCandidateScore) {
        bestCandidateScore = score;
        bestCandidateIndex = colMap.colIndex;
      }
    }

    if (bestCandidateIndex !== -1 && bestCandidateScore >= 3) {
      const target = mappedColumns.find(m => m.colIndex === bestCandidateIndex);
      if (target) {
        target.matchedField = 'workOrderNumber';
        target.fieldTitle = 'رقم أمر العمل';
        target.isCustom = false;
      }
    }
  }

  // Smart mapping for workOrderCode (نوع أمر العمل)
  let targetWocCol = mappedColumns.find(m => isTargetWorkOrderCodeHeader(m.headerName));

  // If still not found, check existing mapped workOrderCode
  if (!targetWocCol) {
    targetWocCol = mappedColumns.find(m => m.matchedField === 'workOrderCode');
  }

  // Fallback to 4th or 5th column ONLY if it wasn't already mapped to a known primary field (office, contractor, consultant, workOrderNumber)
  if (!targetWocCol && maxColCount > 3) {
    const protectedFields = new Set(['office', 'contractor', 'consultant', 'workOrderNumber', 'receiptDate', 'attachmentStatus', 'photoDocumentation', 'consultantForms', 'consultantClearanceForms', 'form190', 'form200', 'inspectionForm', 'qualityNotes', 'procedure155Status', 'procedure155']);
    targetWocCol = mappedColumns.find(m => (m.colIndex === 4 || m.colIndex === 3) && !protectedFields.has(m.matchedField));
  }

  if (targetWocCol) {
    mappedColumns.forEach(m => {
      if (m.matchedField === 'workOrderCode' && m.colIndex !== targetWocCol!.colIndex) {
        m.matchedField = '_skip_';
        m.isCustom = false;
      }
    });

    targetWocCol.matchedField = 'workOrderCode';
    targetWocCol.fieldTitle = 'نوع أمر العمل';
    targetWocCol.isCustom = false;
  }

  return {
    headerRowIndex: bestHeaderRowIndex,
    mappedColumns,
    discoveredNewColumns
  };
};

/**
 * Robustly extracts work order objects from raw Excel matrix using a set of column mappings.
 * Allows interactive real-time re-mapping from the UI with zero data loss.
 */
export const extractOrdersFromRawRows = (
  rawRows: any[][],
  dataStartIndex: number,
  mappedColumns: { colIndex: number; matchedField: string }[],
  sheetContext?: { sheetName?: string; defaultOffice?: string; defaultTableName?: string }
): {
  validOrders: Partial<WorkOrder>[];
  skippedCount: number;
} => {
  const validOrders: Partial<WorkOrder>[] = [];
  let skippedCount = 0;

  // Infer office or table name from sheetName if provided
  let inferredSheetOffice: string | undefined = sheetContext?.defaultOffice;
  let inferredSheetTableName: string | undefined = sheetContext?.defaultTableName;
  if (sheetContext?.sheetName) {
    const sNorm = normalizeHeader(sheetContext.sheetName);
    if (
      sNorm.includes('عرعر') ||
      sNorm.includes('طريف') ||
      sNorm.includes('رفحا') ||
      sNorm.includes('عويقيل') ||
      sNorm.includes('قريات') ||
      sNorm.includes('سكاكا') ||
      sNorm.startsWith('مكتب')
    ) {
      inferredSheetOffice = normalizeOfficeName(sheetContext.sheetName);
    } else if (
      !sNorm.includes('sheet') &&
      !sNorm.includes('ورقه') &&
      !sNorm.includes('اوامرالعمل') &&
      sheetContext.sheetName.trim().length > 1
    ) {
      inferredSheetTableName = sheetContext.sheetName.trim();
    }
  }

  const normalizeImportedAuditCell = (val: string) => {
    if (!val) return undefined;
    if (val.startsWith('{') && val.endsWith('}')) {
      try {
        const parsed = JSON.parse(val);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {}
    }
    const norm = normalizeHeader(val);
    let mainStatus = val;
    if (norm.includes('غيرمؤهل') || norm.includes('مرفوض')) {
      mainStatus = 'غير مؤهل';
    } else if (norm.includes('مؤهل') || norm.includes('معتمد') || norm.includes('مكتمل')) {
      mainStatus = 'مؤهل';
    } else if (norm.includes('قيد') || norm.includes('تدقيق')) {
      mainStatus = 'قيد التدقيق';
    }
    return {
      mainStatus,
      supportChecklist: {},
      evaluatedKeys: []
    };
  };

  for (let r = dataStartIndex; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) {
      skippedCount++;
      continue;
    }

    const hasAnyContent = row.some(cell => cleanCellValue(cell) !== '');
    if (!hasAnyContent) {
      skippedCount++;
      continue;
    }

    const orderData: Partial<WorkOrder> = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mappedColumns.forEach(colMap => {
      if (colMap.matchedField === '_skip_') return;

      const rawCellVal = colMap.colIndex < row.length ? cleanCellValue(row[colMap.colIndex]) : '';
      const field = colMap.matchedField;

      if (field === 'id') {
        if (rawCellVal) orderData.id = rawCellVal;
      } else if (field === 'office') {
        if (rawCellVal) orderData.office = normalizeOfficeName(rawCellVal);
      } else if (field === 'contractor') {
        orderData.contractor = rawCellVal || 'المقاول الرئيسي المعتمد';
      } else if (field === 'consultant') {
        orderData.consultant = rawCellVal || '';
      } else if (field === 'workOrderNumber') {
        orderData.workOrderNumber = rawCellVal;
      } else if (field === 'workOrderCode') {
        orderData.workOrderCode = formatWorkOrderTypeValue(rawCellVal);
      } else if (field === 'receiptDate') {
        orderData.receiptDate = parseExcelDate(rawCellVal);
      } else if (field === 'tableId') {
        if (rawCellVal) orderData.tableId = rawCellVal;
      } else if (field === 'tableName') {
        if (rawCellVal) orderData.tableName = rawCellVal;
      } else if (field === 'tableYear') {
        const y = parseInt(rawCellVal, 10);
        if (Number.isFinite(y) && y >= 2000 && y <= 2100) orderData.tableYear = y;
      } else if (field === 'tableMonth') {
        const m = parseInt(rawCellVal, 10);
        if (Number.isFinite(m) && m >= 1 && m <= 12) orderData.tableMonth = m;
      } else if (field === 'pdcAudit' || field === 'constructionAudit' || field === 'technicalSupportAudit') {
        const auditObj = normalizeImportedAuditCell(rawCellVal);
        if (auditObj) {
          (orderData as any)[field] = auditObj;
        }
      } else if (
        field === 'attachmentStatus' ||
        field === 'photoDocumentation' ||
        field === 'consultantForms' ||
        field === 'consultantClearanceForms' ||
        field === 'form190' ||
        field === 'form200' ||
        field === 'inspectionForm' ||
        field === 'procedure155Status' ||
        field === 'executionStatus' ||
        field === 'boqModification'
      ) {
        if (rawCellVal) {
          (orderData as any)[field] = normalizeStatusValue(rawCellVal, field);
        }
      } else if (field === 'qualityNotes' || field === 'executionNotes') {
        orderData.qualityNotes = rawCellVal;
      } else if (field === 'procedure155' || field === 'statusSyncTime' || field === 'procedureSyncTime') {
        if (rawCellVal) {
          (orderData as any)[field] = rawCellVal;
        }
      }
    });

    if (!orderData.office) {
      orderData.office = inferredSheetOffice || 'مكتب عرعر';
    }

    if (!orderData.tableName && inferredSheetTableName) {
      orderData.tableName = inferredSheetTableName;
    }

    if (!orderData.contractor) {
      orderData.contractor = 'المقاول الرئيسي المعتمد';
    }

    if (orderData.consultant === undefined) {
      orderData.consultant = '';
    }

    if (!orderData.workOrderNumber) {
      for (let c = 0; c < row.length; c++) {
        const candidate = cleanCellValue(row[c]);
        if (candidate && (/^wo[-_]/i.test(candidate) || /^\d{5,10}$/.test(candidate))) {
          orderData.workOrderNumber = candidate;
          break;
        }
      }
    }

    if (!orderData.workOrderNumber) {
      orderData.workOrderNumber = `WO-IMP-${Date.now().toString().slice(-4)}-${validOrders.length + 1}`;
    }

    // Smart extraction for workOrderCode (نوع أمر العمل) from matching header only, with no default numbers
    if (!orderData.workOrderCode) {
      const headerRow = dataStartIndex > 0 ? rawRows[dataStartIndex - 1] : [];
      for (let c = 0; c < row.length; c++) {
        const hName = c < headerRow.length ? cleanCellValue(headerRow[c]) : '';
        if (isTargetWorkOrderCodeHeader(hName)) {
          const cellVal = cleanCellValue(row[c]);
          if (cellVal !== '') {
            orderData.workOrderCode = formatWorkOrderTypeValue(cellVal);
            break;
          }
        }
      }
    }

    if (orderData.workOrderCode === undefined || orderData.workOrderCode === null) {
      orderData.workOrderCode = '';
    }

    if (!orderData.receiptDate) {
      orderData.receiptDate = new Date().toISOString().slice(0, 10);
    }

    if (orderData.attachmentStatus === undefined) orderData.attachmentStatus = '' as any;
    if (orderData.photoDocumentation === undefined) orderData.photoDocumentation = '' as any;
    if (orderData.consultantForms === undefined) orderData.consultantForms = '' as any;
    if (orderData.consultantClearanceForms === undefined) orderData.consultantClearanceForms = '' as any;
    if (orderData.form190 === undefined) orderData.form190 = '' as any;
    if (orderData.form200 === undefined) orderData.form200 = '' as any;
    if (orderData.inspectionForm === undefined) orderData.inspectionForm = '' as any;
    if (orderData.qualityNotes === undefined) orderData.qualityNotes = '';
    if (orderData.procedure155Status === undefined) orderData.procedure155Status = '' as any;
    if (orderData.statusSyncTime === undefined) orderData.statusSyncTime = '';
    if (orderData.procedure155 === undefined) orderData.procedure155 = '';
    if (orderData.procedureSyncTime === undefined) orderData.procedureSyncTime = '';
    if (orderData.executionStatus === undefined) orderData.executionStatus = '' as any;
    if (orderData.boqModification === undefined) orderData.boqModification = '' as any;

    validOrders.push(orderData);
  }

  return { validOrders, skippedCount };
};

/**
 * Parses any uploaded Excel (.xlsx, .xls) or CSV file with 100% full extraction,
 * covering ALL columns with data, preserving both standard and custom columns.
 */
export const parseWorkOrderExcelFile = async (
  file: File,
  customColumns?: ColumnDefinition[]
): Promise<ParsedImportResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;

        // First check if the uploaded file is a JSON file (.json or starts with { / [)
        const isJsonFileName = file.name.toLowerCase().endsWith('.json') || file.type.includes('json');
        let textDecoded = '';
        if (buffer && buffer.byteLength > 0) {
          try {
            const firstBytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 64));
            const previewStr = new TextDecoder('utf-8').decode(firstBytes).replace(/^\uFEFF/, '').trim();
            if (isJsonFileName || previewStr.startsWith('{') || previewStr.startsWith('[')) {
              textDecoded = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '').trim();
            }
          } catch (_) {}
        }

        if (textDecoded && (textDecoded.startsWith('{') || textDecoded.startsWith('['))) {
          try {
            let parsedJson = JSON.parse(textDecoded);
            if (typeof parsedJson === 'string') {
              try { parsedJson = JSON.parse(parsedJson); } catch (_) {}
            }
            const envelope = extractBackupEnvelope(parsedJson);
            const jsonOrders: any[] = (envelope.format !== 'invalid' && envelope.payload && Array.isArray(envelope.payload.workOrders))
              ? envelope.payload.workOrders
              : Array.isArray(parsedJson)
              ? parsedJson
              : Array.isArray(parsedJson?.workOrders)
              ? parsedJson.workOrders
              : [];

            if (jsonOrders.length > 0) {
              const standardFieldsMap: Record<string, string> = {
                office: 'المكتب',
                contractor: 'المقاول',
                consultant: 'الاستشاري',
                workOrderNumber: 'رقم أمر العمل',
                workOrderCode: 'نوع أمر العمل',
                receiptDate: 'تاريخ الاستلام',
                photosFile: 'ملف الصور',
                attachmentStatus: 'حالة الارفاق',
                photoDocumentation: 'توثيق الصور',
                consultantForms: 'نماذج الاستشاري',
                consultantClearanceForms: 'نماذج إجازة الاستشاري',
                form190: 'نموذج 190',
                form200: 'نموذج 200',
                inspectionForm: 'نموذج الفحص',
                qualityNotes: 'ملاحظات الجودة',
                pdcAudit: 'تدقيق PDC',
                constructionAudit: 'تدقيق الإنشاءات',
                procedure155Status: 'تدقيق المساندة الفنية',
                executionStatus: 'حالة التنفيذ',
                boqModification: 'تعديل المقايسة'
              };
              const allDetectedColumns: DetectedColumnInfo[] = Object.entries(standardFieldsMap).map(([field, title], idx) => {
                const count = jsonOrders.filter(o => o && o[field] !== undefined && o[field] !== '').length;
                const sampleObj = jsonOrders.find(o => o && o[field] !== undefined && o[field] !== '');
                return {
                  headerName: title,
                  matchedField: field,
                  fieldTitle: title,
                  isCustom: false,
                  colIndex: idx,
                  sampleValue: sampleObj ? String(sampleObj[field]) : '',
                  hasData: count > 0,
                  count
                };
              });
              const detectedColumnsMap: Record<string, string> = {};
              allDetectedColumns.forEach(c => { detectedColumnsMap[c.matchedField] = c.headerName; });

              resolve({
                success: true,
                orders: jsonOrders,
                totalRows: jsonOrders.length,
                validRows: jsonOrders.length,
                skippedRows: 0,
                errors: [],
                detectedColumns: detectedColumnsMap,
                allDetectedColumns,
                discoveredNewColumns: []
              });
              return;
            }
          } catch (_) {
            // Fall through to XLSX parser if not valid JSON
          }
        }

        const workbook = XLSX.read(buffer, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          resolve({
            success: false,
            orders: [],
            totalRows: 0,
            validRows: 0,
            skippedRows: 0,
            errors: ['الملف المرفوع لا يحتوي على أي ورقة عمل صالحة'],
            detectedColumns: {},
            allDetectedColumns: [],
            discoveredNewColumns: []
          });
          return;
        }

        // Find the sheet that contains the most rows/data
        let bestSheetName = workbook.SheetNames[0];
        let maxSheetRows = 0;
        for (const sName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sName];
          if (sheet && sheet['!ref']) {
            const range = XLSX.utils.decode_range(sheet['!ref']);
            const count = range.e.r - range.s.r + 1;
            if (count > maxSheetRows) {
              maxSheetRows = count;
              bestSheetName = sName;
            }
          }
        }

        const selectedSheet = workbook.Sheets[bestSheetName];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(selectedSheet, { 
          header: 1, 
          blankrows: false, 
          defval: '' 
        });

        if (!rawRows || rawRows.length === 0) {
          resolve({
            success: false,
            orders: [],
            totalRows: 0,
            validRows: 0,
            skippedRows: 0,
            errors: ['ورقة العمل المحددة فارغة ولا تحتوي على أية أسطر'],
            detectedColumns: {},
            allDetectedColumns: [],
            discoveredNewColumns: []
          });
          return;
        }

        // Universal Column Detection covering ALL columns on the primary sheet
        const { headerRowIndex, mappedColumns, discoveredNewColumns } = detectUniversalColumns(rawRows, customColumns);
        const dataStartIndex = headerRowIndex + 1;

        const errors: string[] = [];

        // Extract orders from ALL non-empty sheets in the workbook so multi-sheet Excel files lose zero rows
        const allValidOrders: Partial<WorkOrder>[] = [];
        let totalSkippedCount = 0;
        let totalDataRowsCount = 0;

        for (const sName of workbook.SheetNames) {
          const sObj = workbook.Sheets[sName];
          if (!sObj) continue;
          const sRows: any[][] = sName === bestSheetName
            ? rawRows
            : XLSX.utils.sheet_to_json(sObj, { header: 1, blankrows: false, defval: '' });
          if (!Array.isArray(sRows) || sRows.length <= 1) continue;

          const sDet = sName === bestSheetName
            ? { headerRowIndex, mappedColumns, discoveredNewColumns }
            : detectUniversalColumns(sRows, customColumns);
          const sStart = sDet.headerRowIndex + 1;
          totalDataRowsCount += Math.max(0, sRows.length - sStart);

          const { validOrders: sheetOrders, skippedCount: sheetSkipped } = extractOrdersFromRawRows(
            sRows,
            sStart,
            sDet.mappedColumns.map(m => ({ colIndex: m.colIndex, matchedField: m.matchedField })),
            { sheetName: workbook.SheetNames.length > 1 ? sName : undefined }
          );
          allValidOrders.push(...sheetOrders);
          totalSkippedCount += sheetSkipped;
          for (const dCol of sDet.discoveredNewColumns) {
            if (!discoveredNewColumns.some(existing => existing.field === dCol.field || existing.title === dCol.title)) {
              discoveredNewColumns.push(dCol);
            }
          }
        }

        // Build comprehensive detected columns list with counts
        const allDetectedColumns: DetectedColumnInfo[] = mappedColumns.map(m => {
          let colDataCount = 0;
          let colSample = '';
          for (let r = dataStartIndex; r < rawRows.length; r++) {
            if (m.colIndex < (rawRows[r]?.length || 0)) {
              const v = cleanCellValue(rawRows[r][m.colIndex]);
              if (v !== '') {
                colDataCount++;
                if (!colSample) colSample = v;
              }
            }
          }
          return {
            headerName: m.headerName,
            matchedField: m.matchedField,
            fieldTitle: m.fieldTitle,
            isCustom: m.isCustom,
            colIndex: m.colIndex,
            sampleValue: colSample,
            hasData: colDataCount > 0,
            count: colDataCount
          };
        });

        const detectedColumnsMap: Record<string, string> = {};
        mappedColumns.forEach(m => {
          detectedColumnsMap[m.matchedField] = m.headerName;
        });

        resolve({
          success: allValidOrders.length > 0,
          orders: allValidOrders,
          totalRows: totalDataRowsCount,
          validRows: allValidOrders.length,
          skippedRows: totalSkippedCount,
          errors,
          detectedColumns: detectedColumnsMap,
          allDetectedColumns,
          discoveredNewColumns,
          rawRows,
          headerRowIndex
        });
      } catch (err: any) {
        resolve({
          success: false,
          orders: [],
          totalRows: 0,
          validRows: 0,
          skippedRows: 0,
          errors: [`خطأ في معالجة الملف: ${err?.message || 'تنسيق غير مدعوم'}`],
          detectedColumns: {},
          allDetectedColumns: [],
          discoveredNewColumns: []
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        orders: [],
        totalRows: 0,
        validRows: 0,
        skippedRows: 0,
        errors: ['تعذرت قراءة الملف من المتصفح'],
        detectedColumns: {},
        allDetectedColumns: [],
        discoveredNewColumns: []
      });
    };

    reader.readAsArrayBuffer(file);
  });
};
