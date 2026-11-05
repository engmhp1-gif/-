// High-Capacity Native Cloud Vault Mode (SEC_CLOUD_VAULT_V3 + IndexedDB)
// Firebase Firestore network calls are permanently disabled to prevent daily read/write quota exhaustion and UI lag.
export const db = null as any;
export const auth = {
  currentUser: null
} as any;

let firestoreQuotaExhausted = true;

export function isFirestoreQuotaExhausted(): boolean {
  return firestoreQuotaExhausted;
}

export function isFirestoreQuotaError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
  const code = String((error as any)?.code || '').toLowerCase();
  return (
    code.includes('resource-exhausted') ||
    msg.includes('quota limit exceeded') ||
    msg.includes('quota exceeded') ||
    msg.includes('free daily read units') ||
    msg.includes('resource_exhausted')
  );
}

export function markFirestoreQuotaExhausted(_cooldownMs = 60 * 60 * 1000): void {
  firestoreQuotaExhausted = true;
}


export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

export type OperationType = (typeof OperationType)[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: boolean | string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const isQuota = isFirestoreQuotaError(error);
  if (isQuota) {
    markFirestoreQuotaExhausted();
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider: any) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  if (!isQuota) {
    console.warn('Firestore Notice: ', JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}


