/**
 * Centralized Utility for Work Order Type (نوع أمر العمل)
 * Plain text field with no default numeric values and no dropdown menus.
 */

export const WORK_ORDER_TYPE_OPTIONS: string[] = [];

/**
 * Converts Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) to standard numerals (0123456789)
 */
const toStandardDigits = (val: any): string => {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[٠-٩]/g, (d) => String(arabicNumerals.indexOf(d)));
};

/**
 * Checks whether a given field key or column title represents the Work Order Type column.
 * Handles all standard and client variations:
 * - نوع أمر العمل / نوع امر العمل
 * - رمز أمر العمل / رمز امر العمل
 * - رمز رقم أمر العمل / رمز رقم امر العمل
 * - رمز ورقم أمر العمل
 * - كود أمر العمل
 */
export const isWorkOrderTypeField = (fieldOrTitle?: string): boolean => {
  if (!fieldOrTitle) return false;
  const str = String(fieldOrTitle).trim().toLowerCase();
  const normalized = str
    .replace(/[\s\-_.:/\\#()\[\]]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي');

  const knownAliases = [
    'workordercode',
    'ordertype',
    'workordertype',
    'wocode',
    'type',
    'نوعامرالعمل',
    'رمزامرالعمل',
    'رمزرقمامرالعمل',
    'رمزرقماامرالعمل',
    'رمزورقمامرالعمل',
    'كودامرالعمل',
    'كودرقمامرالعمل',
    'فئةامرالعمل',
    'تصنيفامرالعمل',
    'رمزامر',
    'نوعامر',
    'كودامر',
    'نوعالعمل',
    'رمزالعمل',
    'كودالعمل'
  ];

  if (knownAliases.some(alias => normalized === alias || normalized.includes(alias))) {
    return true;
  }

  const hasTypeOrCode = normalized.includes('نوع') || normalized.includes('رمز') || normalized.includes('كود');
  const hasOrderOrWork = normalized.includes('عمل') || normalized.includes('امر');
  return hasTypeOrCode && hasOrderOrWork;
};

/**
 * Checks whether a column definition represents the Work Order Type column.
 */
export const isWorkOrderTypeColumn = (col?: { field?: string; title?: string; id?: string } | null): boolean => {
  if (!col) return false;
  if (isWorkOrderTypeField(col.field)) return true;
  if (isWorkOrderTypeField(col.title)) return true;
  if (isWorkOrderTypeField(col.id)) return true;
  return false;
};

/**
 * Deprecated helper kept for compatibility: returns false so random numeric cells are never auto-assigned as workOrderCode.
 */
export const hasValidWorkOrderTypeNumbers = (_rawVal: any): boolean => {
  return false;
};

/**
 * Formats a value for the Work Order Type cell as plain text without forcing default numbers.
 */
export const formatWorkOrderTypeValue = (rawVal: any): string => {
  if (rawVal === undefined || rawVal === null) return '';
  const rawStr = toStandardDigits(rawVal).trim();
  if (!rawStr || rawStr === '-' || rawStr === '.') return '';
  return rawStr;
};

