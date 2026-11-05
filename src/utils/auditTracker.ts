import { WorkOrder, WorkOrderAuditColumnData } from '../types';
import {
  extractColumnSupportChecklistMap,
  getEvaluatedColumnSupportChecklistKeys,
  extractOrderSupportChecklistMap,
  getEvaluatedSupportChecklistKeys,
  calculateSupportChecklistStats
} from '../components/TechnicalSupportAuditModal';
import { isSameWorkOrderIdentity } from './tableScope';

export type DepartmentAuditTrackStatus = 'تم التدقيق' | 'قيد التدقيق';
export type DepartmentQualificationStatus = 'مؤهل' | 'غير مؤهل' | 'قيد التدقيق';

export interface OrderAuditTrackerInfo {
  order: WorkOrder;
  workOrderNumber: string;
  workOrderCode: string;
  pdcAudited: boolean;
  constructionAudited: boolean;
  technicalSupportAudited: boolean;
  pdcStatus: DepartmentAuditTrackStatus;
  constructionStatus: DepartmentAuditTrackStatus;
  technicalSupportStatus: DepartmentAuditTrackStatus;
  pdcQualification: DepartmentQualificationStatus;
  constructionQualification: DepartmentQualificationStatus;
  technicalSupportQualification: DepartmentQualificationStatus;
  hasAuditStarted: boolean;
  isFullyAuditedByAllThree: boolean;
  isArchived155: boolean;
  hasAnyDisqualifiedDepartment: boolean;
  completedDepartmentsCount: number;
  lastAuditTimestamp: string;
}

/**
 * Returns the exact qualification status for a single department audit:
 * - 'قيد التدقيق' if not yet audited
 * - 'مؤهل' if audited and 100% compliant
 * - 'غير مؤهل' if audited and has any non-compliance/deficiencies
 */
export function getDepartmentQualification(
  order: WorkOrder,
  department: 'pdcAudit' | 'constructionAudit' | 'technicalSupportAudit'
): DepartmentQualificationStatus {
  if (!order) return 'قيد التدقيق';
  const isAudited = isDepartmentColumnAudited(order, department);
  if (!isAudited) return 'قيد التدقيق';
  const isQualified = isDepartmentQualified100(order, department);
  return isQualified ? 'مؤهل' : 'غير مؤهل';
}

/**
 * Evaluates whether a single audit column (PDC, Construction, or Technical Support)
 * has been actually audited on a given WorkOrder.
 * By default, all audit columns remain 'قيد التدقيق' until actual auditing occurs.
 */
export function isDepartmentColumnAudited(
  order: WorkOrder,
  department: 'pdcAudit' | 'constructionAudit' | 'technicalSupportAudit'
): boolean {
  if (!order) return false;

  if (department === 'pdcAudit' || department === 'constructionAudit') {
    const checklistMap = extractColumnSupportChecklistMap(order, department);
    const evaluatedKeys = getEvaluatedColumnSupportChecklistKeys(order, department, checklistMap);
    return evaluatedKeys.length > 0;
  }

  // Technical Support Audit (تدقيق المساندة الفنية) - افتراضياً قيد التدقيق لحين التدقيق الفعلي
  const checklistMap = extractOrderSupportChecklistMap(order);
  const evaluatedKeys = getEvaluatedSupportChecklistKeys(order, checklistMap);
  return evaluatedKeys.length > 0;
}

/**
 * Checks whether a single audit column (pdcAudit, constructionAudit, or technicalSupportAudit)
 * has been actually audited AND achieved 100% qualification (مؤهل 100%).
 */
export function isDepartmentQualified100(
  order: WorkOrder,
  department: 'pdcAudit' | 'constructionAudit' | 'technicalSupportAudit'
): boolean {
  if (!order) return false;

  if (department === 'pdcAudit' || department === 'constructionAudit') {
    const checklistMap = extractColumnSupportChecklistMap(order, department);
    const evaluatedKeys = getEvaluatedColumnSupportChecklistKeys(order, department, checklistMap);
    if (evaluatedKeys.length === 0) {
      return false;
    }
    const stats = calculateSupportChecklistStats(checklistMap, evaluatedKeys);
    const rawData = order[department];
    const mainStatus = rawData && typeof rawData === 'object' ? (rawData as any).mainStatus : undefined;
    if (mainStatus === 'غير مؤهل') return false;
    return stats.isAllApplicableCompleted && stats.compliancePercentage === 100;
  }

  // technicalSupportAudit
  const checklistMap = extractOrderSupportChecklistMap(order);
  const evaluatedKeys = getEvaluatedSupportChecklistKeys(order, checklistMap);
  if (evaluatedKeys.length === 0) {
    return false;
  }
  const stats = calculateSupportChecklistStats(checklistMap, evaluatedKeys);
  const rawMain = String(order.procedure155Status || '').trim();
  const isExplicitlyDisqualified = rawMain.includes('غير مؤهل');
  return !isExplicitlyDisqualified && stats.isAllApplicableCompleted && stats.compliancePercentage === 100;
}

/**
 * Checks whether all three audit columns (PDC, Construction, and Technical Support)
 * are 100% qualified (مؤهل 100%).
 */
export function isOrderQualified100InAllThreeAudits(order: WorkOrder): boolean {
  if (!order) return false;
  return (
    isDepartmentQualified100(order, 'pdcAudit') &&
    isDepartmentQualified100(order, 'constructionAudit') &&
    isDepartmentQualified100(order, 'technicalSupportAudit')
  );
}

/**
 * Checks whether a work order in the fully audited list has received 'تم الاجراء' (or 'تم الإجراء')
 * in the 'إجراء 155' (procedure155) column, meaning it must be archived immediately into 'ارشيف 155'.
 */
export function isOrderArchivedIn155(order: WorkOrder): boolean {
  if (!order) return false;
  if (!isOrderQualified100InAllThreeAudits(order)) return false;
  const rawProc = String(order.procedure155 || '').trim();
  return (
    rawProc === 'تم الاجراء' ||
    rawProc === 'تم الإجراء' ||
    rawProc === 'تم الاستلام وإغلاق 155' ||
    rawProc.includes('تم الاجراء') ||
    rawProc.includes('تم الإجراء')
  );
}

/**
 * Computes the effective value for the 'حالة إجراء 155' (procedure155) column:
 * - Automatically returns 'مؤهل لإجراء 155' when all 3 audit columns are 100% qualified,
 *   unless a user has manually edited or cleared the field.
 * - Editable by anyone on the procedure status.
 * - Otherwise returns '' (empty).
 */
export function getEffectiveProcedure155Status(order: WorkOrder): string {
  if (!order) return '';
  if (order.procedureSyncUser === 'MANUAL_EMPTY') {
    return '';
  }
  const rawVal = String(order.procedure155 || '').trim();
  const hasManualOverride = Boolean(
    order.procedureSyncTime || order.procedureSyncEmail || order.procedureSyncUser
  );
  if ((hasManualOverride && rawVal && rawVal !== '-') || rawVal === 'تم الاجراء' || rawVal === 'تم الإجراء') {
    return rawVal;
  }
  if (isOrderQualified100InAllThreeAudits(order)) {
    return 'مؤهل لإجراء 155';
  }
  return '';
}

/**
 * Computes the complete audit tracking status for a WorkOrder across all 3 entities:
 * 1. تدقيق PDC
 * 2. تدقيق الانشاءات
 * 3. تدقيق المساندة الفنية
 */
export function getOrderAuditTrackerInfo(order: WorkOrder): OrderAuditTrackerInfo {
  const pdcAudited = isDepartmentColumnAudited(order, 'pdcAudit');
  const constructionAudited = isDepartmentColumnAudited(order, 'constructionAudit');
  const technicalSupportAudited = isDepartmentColumnAudited(order, 'technicalSupportAudit');

  const pdcQualification = getDepartmentQualification(order, 'pdcAudit');
  const constructionQualification = getDepartmentQualification(order, 'constructionAudit');
  const technicalSupportQualification = getDepartmentQualification(order, 'technicalSupportAudit');

  const hasAuditStarted = pdcAudited || constructionAudited || technicalSupportAudited;
  const isFullyAuditedByAllThree = isOrderQualified100InAllThreeAudits(order);
  const isArchived155 = isOrderArchivedIn155(order);
  const completedDepartmentsCount =
    (pdcAudited ? 1 : 0) + (constructionAudited ? 1 : 0) + (technicalSupportAudited ? 1 : 0);

  const hasAnyDisqualifiedDepartment =
    (pdcAudited && pdcQualification === 'غير مؤهل') ||
    (constructionAudited && constructionQualification === 'غير مؤهل') ||
    (technicalSupportAudited && technicalSupportQualification === 'غير مؤهل');

  const pdcTime = order.pdcAudit?.lastUpdatedAt || order.pdcAudit?.auditDateRiyadh || '';
  const constTime = order.constructionAudit?.lastUpdatedAt || order.constructionAudit?.auditDateRiyadh || '';
  const tsTime = order.technicalSupportAudit?.lastUpdatedAt || order.technicalSupportAudit?.auditDateRiyadh || order.statusSyncTime || '';
  const lastAuditTimestamp = tsTime || constTime || pdcTime || order.updatedAt || '';

  return {
    order,
    workOrderNumber: String(order.workOrderNumber || '').trim(),
    workOrderCode: String(order.workOrderCode || '').trim(),
    pdcAudited,
    constructionAudited,
    technicalSupportAudited,
    pdcStatus: pdcAudited ? 'تم التدقيق' : 'قيد التدقيق',
    constructionStatus: constructionAudited ? 'تم التدقيق' : 'قيد التدقيق',
    technicalSupportStatus: technicalSupportAudited ? 'تم التدقيق' : 'قيد التدقيق',
    pdcQualification,
    constructionQualification,
    technicalSupportQualification,
    hasAuditStarted,
    isFullyAuditedByAllThree,
    isArchived155,
    hasAnyDisqualifiedDepartment,
    completedDepartmentsCount,
    lastAuditTimestamp
  };
}

/**
 * Finds a work order strictly by (workOrderNumber + workOrderCode) identity,
 * with fallback to orderId if provided.
 */
export function findWorkOrderByNumberAndType(
  orders: WorkOrder[],
  workOrderNumber: string,
  workOrderCode: string,
  fallbackOrderId?: string
): WorkOrder | undefined {
  if (fallbackOrderId) {
    const exactByIdAndIdentity = orders.find(
      (o) =>
        o.id === fallbackOrderId &&
        isSameWorkOrderIdentity(o.workOrderNumber, o.workOrderCode, workOrderNumber, workOrderCode)
    );
    if (exactByIdAndIdentity) return exactByIdAndIdentity;
  }

  const byIdentity = orders.find((o) =>
    isSameWorkOrderIdentity(o.workOrderNumber, o.workOrderCode, workOrderNumber, workOrderCode)
  );
  if (byIdentity) return byIdentity;

  if (fallbackOrderId) {
    return orders.find((o) => o.id === fallbackOrderId);
  }

  return undefined;
}

