import { SubOffice } from '../types';

/**
 * Default contractor mappings per office as specified by Procedure 155 compliance requirements:
 * - مكتب عرعر : فصول السنة - الوبران - الاداء المتوازن - القرش - بن دلامة
 * - مكتب رفحاء : فصول السنة - الاداء المتوازن - العلاوي
 * - مكتب طريف : الجلهمي - اكتاف - امدادات التقنية - اوناس
 * - مكتب العويقيلة : اكتاف
 */
export const DEFAULT_OFFICE_CONTRACTORS: Record<string, string[]> = {
  'مكتب عرعر': ['فصول السنة', 'الوبران', 'الاداء المتوازن', 'القرش', 'بن دلامة'],
  'عرعر': ['فصول السنة', 'الوبران', 'الاداء المتوازن', 'القرش', 'بن دلامة'],
  'مكتب رفحاء': ['فصول السنة', 'الاداء المتوازن', 'العلاوي'],
  'رفحاء': ['فصول السنة', 'الاداء المتوازن', 'العلاوي'],
  'مكتب طريف': ['الجلهمي', 'اكتاف', 'امدادات التقنية', 'اوناس'],
  'طريف': ['الجلهمي', 'اكتاف', 'امدادات التقنية', 'اوناس'],
  'مكتب العويقيلة': ['اكتاف'],
  'العويقيلة': ['اكتاف']
};

export const DEFAULT_CONSULTANTS: string[] = ['الحامد', 'المحايد', 'الصخرة المشرفة', 'سعود كونسلت'];

const LEGACY_PLACEHOLDER_CONSULTANTS = new Set([
  'دار الهندسة',
  'زهير فايز ومشاركوه',
  'خطيب وعلمي',
  'الاستشاري المعتمد',
  'مكتب الإشراف الهندسي',
  'مكتب الاستشارات الهندسية المعتمد',
  'دار الهندسة للاستشارات الفنية',
  'المكتب العربي للاستشارات الهندسية',
  'شركة اتحاد المستشارين للهندسة',
  'مكتب الإشراف الهندسي المتقدم'
]);

export function sanitizeConsultantsList(list?: string[]): string[] {
  if (!Array.isArray(list) || list.length === 0) {
    return [...DEFAULT_CONSULTANTS];
  }
  const cleaned = list
    .map(c => (typeof c === 'string' ? c.trim() : ''))
    .filter(c => Boolean(c) && !LEGACY_PLACEHOLDER_CONSULTANTS.has(c));
  if (cleaned.length === 0) {
    return [...DEFAULT_CONSULTANTS];
  }
  return Array.from(new Set([...DEFAULT_CONSULTANTS, ...cleaned]));
}

export const DEFAULT_OFFICE_CONSULTANTS: Record<string, string[]> = {
  'مكتب عرعر': ['الحامد', 'المحايد', 'الصخرة المشرفة', 'سعود كونسلت'],
  'عرعر': ['الحامد', 'المحايد', 'الصخرة المشرفة', 'سعود كونسلت'],
  'مكتب رفحاء': ['الحامد', 'المحايد', 'الصخرة المشرفة', 'سعود كونسلت'],
  'رفحاء': ['الحامد', 'المحايد', 'الصخرة المشرفة', 'سعود كونسلت'],
  'مكتب طريف': ['الحامد', 'المحايد', 'الصخرة المشرفة', 'سعود كونسلت'],
  'طريف': ['الحامد', 'المحايد', 'الصخرة المشرفة', 'سعود كونسلت'],
  'مكتب العويقيلة': ['الحامد', 'المحايد', 'الصخرة المشرفة', 'سعود كونسلت'],
  'العويقيلة': ['الحامد', 'المحايد', 'الصخرة المشرفة', 'سعود كونسلت']
};

/**
 * Normalizes office name for robust matching (e.g. "مكتب عرعر" -> "عرعر")
 */
export function normalizeOfficeName(name: string): string {
  if (!name) return '';
  return name.trim().replace(/^مكتب\s+/, '').trim();
}

/**
 * Resolves the list of contractors linked to an office smartly:
 * 1. Checks dropdownOptions.officeContractors (if custom dynamic list exists)
 * 2. Checks office object's contractors array
 * 3. Falls back to default specified mapping
 */
export function getContractorsForOffice(
  officeName: string,
  officeContractorsMap?: Record<string, string[]>,
  offices?: SubOffice[]
): string[] {
  if (!officeName) return [];

  const raw = officeName.trim();
  const normalized = normalizeOfficeName(raw);

  // 1. Check officeContractorsMap direct key
  if (officeContractorsMap && Array.isArray(officeContractorsMap[raw]) && officeContractorsMap[raw].length > 0) {
    return officeContractorsMap[raw];
  }

  // 2. Check officeContractorsMap normalized key
  if (officeContractorsMap) {
    for (const [key, list] of Object.entries(officeContractorsMap)) {
      if (normalizeOfficeName(key) === normalized && Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  }

  // 3. Check SubOffice list
  if (offices && offices.length > 0) {
    const match = offices.find(o => o.name === raw || normalizeOfficeName(o.name) === normalized);
    if (match && Array.isArray(match.contractors) && match.contractors.length > 0) {
      return match.contractors;
    }
  }

  // 4. Default predefined mapping
  if (DEFAULT_OFFICE_CONTRACTORS[raw]) {
    return [...DEFAULT_OFFICE_CONTRACTORS[raw]];
  }

  for (const [key, list] of Object.entries(DEFAULT_OFFICE_CONTRACTORS)) {
    if (normalizeOfficeName(key) === normalized) {
      return [...list];
    }
  }

  return [];
}

/**
 * Returns all unique contractor names across all offices
 */
export function getAllUniqueContractors(
  officeContractorsMap?: Record<string, string[]>,
  offices?: SubOffice[]
): string[] {
  const set = new Set<string>();

  // Add defaults
  Object.values(DEFAULT_OFFICE_CONTRACTORS).forEach(list => {
    list.forEach(c => set.add(c));
  });

  // Add from map
  if (officeContractorsMap) {
    Object.values(officeContractorsMap).forEach(list => {
      if (Array.isArray(list)) list.forEach(c => set.add(c));
    });
  }

  // Add from offices
  if (offices) {
    offices.forEach(o => {
      if (Array.isArray(o.contractors)) {
        o.contractors.forEach(c => set.add(c));
      }
    });
  }

  return Array.from(set);
}

/**
 * Resolves the list of consultants linked to an office smartly:
 * 1. Checks dropdownOptions.officeConsultants (if custom dynamic list exists)
 * 2. Checks office object's consultants array
 * 3. Falls back to default specified mapping (['المحايد', 'الحامد'])
 */
export function getConsultantsForOffice(
  officeName: string,
  officeConsultantsMap?: Record<string, string[]>,
  offices?: SubOffice[],
  globalConsultants?: string[]
): string[] {
  if (!officeName) {
    return globalConsultants && globalConsultants.length > 0
      ? sanitizeConsultantsList(globalConsultants)
      : getAllUniqueConsultants(officeConsultantsMap, offices, globalConsultants);
  }

  const raw = officeName.trim();
  const normalized = normalizeOfficeName(raw);

  // 1. Check officeConsultantsMap direct key
  if (officeConsultantsMap && Array.isArray(officeConsultantsMap[raw]) && officeConsultantsMap[raw].length > 0) {
    return sanitizeConsultantsList(officeConsultantsMap[raw]);
  }

  // 2. Check officeConsultantsMap normalized key
  if (officeConsultantsMap) {
    for (const [key, list] of Object.entries(officeConsultantsMap)) {
      if (normalizeOfficeName(key) === normalized && Array.isArray(list) && list.length > 0) {
        return sanitizeConsultantsList(list);
      }
    }
  }

  // 3. Check SubOffice list
  if (offices && offices.length > 0) {
    const match = offices.find(o => o.name === raw || normalizeOfficeName(o.name) === normalized);
    if (match && Array.isArray(match.consultants) && match.consultants.length > 0) {
      return sanitizeConsultantsList(match.consultants);
    }
  }

  // 4. Default predefined mapping
  if (DEFAULT_OFFICE_CONSULTANTS[raw]) {
    return [...DEFAULT_OFFICE_CONSULTANTS[raw]];
  }

  for (const [key, list] of Object.entries(DEFAULT_OFFICE_CONSULTANTS)) {
    if (normalizeOfficeName(key) === normalized) {
      return [...list];
    }
  }

  if (globalConsultants && globalConsultants.length > 0) {
    return sanitizeConsultantsList(globalConsultants);
  }

  return getAllUniqueConsultants(officeConsultantsMap, offices, globalConsultants);
}

/**
 * Returns all unique consultant names across all offices
 */
export function getAllUniqueConsultants(
  officeConsultantsMap?: Record<string, string[]>,
  offices?: SubOffice[],
  globalConsultants?: string[]
): string[] {
  const set = new Set<string>(DEFAULT_CONSULTANTS);

  // Add defaults
  Object.values(DEFAULT_OFFICE_CONSULTANTS).forEach(list => {
    sanitizeConsultantsList(list).forEach(c => set.add(c));
  });

  if (Array.isArray(globalConsultants)) {
    sanitizeConsultantsList(globalConsultants).forEach(c => {
      if (c) set.add(c);
    });
  }

  // Add from map
  if (officeConsultantsMap) {
    Object.values(officeConsultantsMap).forEach(list => {
      if (Array.isArray(list)) sanitizeConsultantsList(list).forEach(c => set.add(c));
    });
  }

  // Add from offices
  if (offices) {
    offices.forEach(o => {
      if (Array.isArray(o.consultants)) {
        sanitizeConsultantsList(o.consultants).forEach(c => set.add(c));
      }
    });
  }

  return Array.from(set);
}

