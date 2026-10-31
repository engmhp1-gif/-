import crypto from 'crypto';
import type { PlatformUser, UserPermissions } from '../types.ts';
import {
  ensureDefaultSuperAdmins,
  isUserSuperAdmin,
  hasUserPermission,
  canUserEditColumn,
  PRIMARY_SUPER_ADMIN_USERNAME,
  PRIMARY_SUPER_ADMIN_EMAIL,
  PRIMARY_MASTER_USER,
  FULL_PERMISSIONS,
  EMPTY_PERMISSIONS,
  normalizeMahmoudRoleTitle
} from './security.ts';

const SCRYPT_PREFIX = 'scrypt$';
const SCRYPT_KEYLEN = 64;
const SERVER_DEFAULT_SUPER_ADMIN_PASSWORD =
  (typeof process !== 'undefined' && process?.env?.SUPER_ADMIN_DEFAULT_PASSWORD) || '321';

/**
 * Hashes a plaintext password using Node's native cryptographic scrypt KDF
 * with a random 16-byte salt. Format: scrypt$<saltHex>$<derivedKeyHex>
 */
export function hashPasswordScrypt(plainPassword: string): string {
  const clean = String(plainPassword || '').trim();
  if (!clean) {
    throw new Error('Password cannot be empty');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(clean, salt, SCRYPT_KEYLEN).toString('hex');
  return `${SCRYPT_PREFIX}${salt}$${derived}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash in constant time.
 */
export function verifyPasswordScrypt(plainPassword: string, storedHash: string): boolean {
  try {
    if (!storedHash || !storedHash.startsWith(SCRYPT_PREFIX)) return false;
    const parts = storedHash.slice(SCRYPT_PREFIX.length).split('$');
    if (parts.length !== 2) return false;
    const [saltHex, keyHex] = parts;
    if (!saltHex || !keyHex) return false;

    const clean = String(plainPassword || '').trim();
    const expectedBuf = Buffer.from(keyHex, 'hex');
    const actualBuf = crypto.scryptSync(clean, saltHex, expectedBuf.length);
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

/**
 * Constant-time string comparison for legacy plaintext passwords so legacy
 * accounts are supported seamlessly without timing leaks or account lockouts.
 */
function constantTimeStringEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a || ''), 'utf-8');
  const bufB = Buffer.from(String(b || ''), 'utf-8');
  if (bufA.length !== bufB.length) {
    // Compare against itself to keep constant work before returning false
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Normalizes Eastern Arabic / Persian numerals (٠-٩, ۰-۹) to standard ASCII digits (0-9)
 * and strips invisible directional marks so login works seamlessly across all keyboards.
 */
export function normalizeAuthInputString(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .trim();
}

/**
 * Verifies a user's password supporting migrated scrypt hashes (`passwordHash`),
 * legacy plaintext (`password`), and automatic credential recovery/binding for
 * registered accounts whose password hashes were stripped during sanitization.
 */
export function verifyUserPasswordServer(
  inputPassword: string,
  user: PlatformUser
): { valid: boolean; needsMigration: boolean; recoveredPlainPassword?: string } {
  const cleanInput = String(inputPassword || '').trim();
  const normalizedInput = normalizeAuthInputString(cleanInput);
  if (!cleanInput || !user) {
    return { valid: false, needsMigration: false };
  }

  // 1. Check scrypt passwordHash if present
  if (user.passwordHash && user.passwordHash.startsWith(SCRYPT_PREFIX)) {
    const valid =
      verifyPasswordScrypt(cleanInput, user.passwordHash) ||
      (normalizedInput !== cleanInput && verifyPasswordScrypt(normalizedInput, user.passwordHash));
    return {
      valid,
      needsMigration: valid && Boolean(user.password)
    };
  }

  // 2. Fallback to legacy plaintext password if present
  if (user.password !== undefined && user.password !== null && String(user.password).trim() !== '') {
    const storedTrimmed = String(user.password).trim();
    const storedNormalized = normalizeAuthInputString(storedTrimmed);
    const valid =
      constantTimeStringEquals(cleanInput, storedTrimmed) ||
      (normalizedInput.length > 0 && constantTimeStringEquals(normalizedInput, storedNormalized));
    return {
      valid,
      needsMigration: valid,
      recoveredPlainPassword: valid ? normalizedInput || cleanInput : undefined
    };
  }

  // 3. Fallback for unmigrated default Super Admin accounts on the server
  if (isUserSuperAdmin(user) && !user.passwordHash && !user.password) {
    const valid =
      constantTimeStringEquals(cleanInput, SERVER_DEFAULT_SUPER_ADMIN_PASSWORD) ||
      constantTimeStringEquals(normalizedInput, SERVER_DEFAULT_SUPER_ADMIN_PASSWORD);
    return {
      valid,
      needsMigration: valid,
      recoveredPlainPassword: valid ? SERVER_DEFAULT_SUPER_ADMIN_PASSWORD : undefined
    };
  }

  // 4. Registered non-superadmin user whose passwordHash & password were stripped by sync/backup sanitization:
  // Accept their entered non-empty password and immediately bind & hash it into scrypt on the server.
  if (!isUserSuperAdmin(user) && !user.passwordHash && (!user.password || String(user.password).trim() === '')) {
    const effectivePass = normalizedInput || cleanInput;
    if (effectivePass.length >= 1) {
      return {
        valid: true,
        needsMigration: true,
        recoveredPlainPassword: effectivePass
      };
    }
  }

  return { valid: false, needsMigration: false };
}

/**
 * Migrates a single user record from plaintext `password` to `passwordHash` (scrypt)
 * and removes the plaintext `password` field.
 */
export function migrateSingleUserPassword(user: PlatformUser): { user: PlatformUser; migrated: boolean } {
  if (!user) return { user, migrated: false };
  const clone: PlatformUser = { ...user };

  if (clone.passwordHash && clone.passwordHash.startsWith(SCRYPT_PREFIX)) {
    if (clone.password !== undefined) {
      delete clone.password;
      clone.hasPassword = true;
      return { user: clone, migrated: true };
    }
    clone.hasPassword = true;
    return { user: clone, migrated: false };
  }

  const rawPass = String(
    clone.password || (isUserSuperAdmin(clone) ? SERVER_DEFAULT_SUPER_ADMIN_PASSWORD : '')
  ).trim();
  if (rawPass) {
    clone.passwordHash = hashPasswordScrypt(rawPass);
    delete clone.password;
    clone.hasPassword = true;
    return { user: clone, migrated: true };
  }

  return { user: clone, migrated: false };
}

/**
 * Batch-migrates a list of users to scrypt `passwordHash`, removing plaintext `password`.
 */
export function migrateUsersListPasswords(users: PlatformUser[]): {
  users: PlatformUser[];
  migratedCount: number;
} {
  let migratedCount = 0;
  const migratedList = (Array.isArray(users) ? users : []).map((u) => {
    const res = migrateSingleUserPassword(u);
    if (res.migrated) migratedCount++;
    return res.user;
  });
  return { users: migratedList, migratedCount };
}

/**
 * Strictly strips `password` and `passwordHash` from a user object before sending
 * to any browser client over HTTP, WebSocket, or SSE.
 */
export function sanitizeUserForClient(user: PlatformUser): PlatformUser {
  if (!user) return user;
  const sanitized: PlatformUser = {
    ...user,
    roleTitle: normalizeMahmoudRoleTitle(user) || user.roleTitle,
    hasPassword: Boolean(user.passwordHash || user.password || user.hasPassword)
  };
  delete (sanitized as any).password;
  delete (sanitized as any).passwordHash;
  return sanitized;
}

/**
 * Strictly strips `password` and `passwordHash` from an array of users before sending to client.
 */
export function sanitizeUsersListForClient(users: PlatformUser[] = []): PlatformUser[] {
  if (!Array.isArray(users)) return [];
  return users.map((u) => sanitizeUserForClient(u));
}

/**
 * Server-side credential authentication supporting both hashed and legacy accounts,
 * flexible username/email/prefix matching, and automatic credential hash persistence.
 */
export function authenticateUserServer(
  inputUserOrEmail: string,
  inputPassword: string,
  usersList: PlatformUser[] = [],
  options?: { autoMigrateInPlace?: boolean }
): {
  success: boolean;
  user?: PlatformUser;
  sanitizedUser?: PlatformUser;
  migratedInPlace?: boolean;
  error?: string;
} {
  const cleanUser = normalizeAuthInputString(String(inputUserOrEmail || ''));
  const cleanPass = String(inputPassword || '').trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, error: 'يرجى إدخال اسم المستخدم (User) وكلمة المرور (Password)' };
  }

  const allUsers = ensureDefaultSuperAdmins(usersList);
  const cleanUserLower = cleanUser.toLowerCase();
  const cleanUserPrefix = cleanUserLower.includes('@') ? cleanUserLower.split('@')[0] : cleanUserLower;

  // Find candidate user(s) matching username, email, email prefix, or displayName
  const candidates = allUsers.filter((u) => {
    if (!u) return false;
    const uName = normalizeAuthInputString(u.username || '').toLowerCase();
    const uEmail = normalizeAuthInputString(u.email || '').toLowerCase();
    const uEmailPrefix = uEmail.includes('@') ? uEmail.split('@')[0] : uEmail;
    const uDisplay = normalizeAuthInputString(u.displayName || '').toLowerCase();

    return (
      uName === cleanUserLower ||
      uEmail === cleanUserLower ||
      (cleanUserPrefix.length >= 3 && uEmailPrefix === cleanUserPrefix) ||
      (cleanUserPrefix.length >= 3 && uName === cleanUserPrefix) ||
      (uDisplay.length >= 3 && uDisplay === cleanUserLower)
    );
  });

  // Also check primary super admin if not already matched
  if (
    candidates.length === 0 &&
    (cleanUserLower === PRIMARY_SUPER_ADMIN_USERNAME.toLowerCase() ||
      cleanUserLower === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase())
  ) {
    candidates.push({ ...PRIMARY_MASTER_USER });
  }

  let matchedUser: PlatformUser | undefined;
  let needsMigration = false;
  let recoveredPlainPassword: string | undefined;

  for (const cand of candidates) {
    const check = verifyUserPasswordServer(cleanPass, cand);
    if (check.valid) {
      matchedUser = cand;
      needsMigration = check.needsMigration;
      recoveredPlainPassword = check.recoveredPlainPassword;
      break;
    }
  }

  if (!matchedUser) {
    return {
      success: false,
      error: 'اسم المستخدم أو كلمة المرور غير صحيحة. تأكد من البيانات أو راجع مسؤول الصلاحيات.'
    };
  }

  if (matchedUser.isActive === false && !isUserSuperAdmin(matchedUser)) {
    return {
      success: false,
      error: 'هذا الحساب موقوف حالياً. يرجى التواصل مع مسؤول الصلاحيات لتفعيله.'
    };
  }

  let migratedInPlace = false;
  const shouldMigrate = Boolean(
    needsMigration && (options?.autoMigrateInPlace !== false)
  );
  if (shouldMigrate) {
    const userToMigrate: PlatformUser = {
      ...matchedUser,
      ...(recoveredPlainPassword && !matchedUser.passwordHash && !matchedUser.password
        ? { password: recoveredPlainPassword }
        : {})
    };
    const mig = migrateSingleUserPassword(userToMigrate);
    matchedUser = mig.user;
    migratedInPlace = mig.migrated;
    // Update inside usersList if present
    const targetIdx = usersList.findIndex(
      (u) =>
        u &&
        (u.id === matchedUser!.id ||
          (u.username && matchedUser!.username && u.username.toLowerCase() === matchedUser!.username.toLowerCase()))
    );
    if (targetIdx !== -1) {
      usersList[targetIdx] = { ...matchedUser };
    }
  }

  const isPrimaryAdmin =
    matchedUser.id === PRIMARY_MASTER_USER.id ||
    String(matchedUser.username || '').trim().toLowerCase() === PRIMARY_SUPER_ADMIN_USERNAME.toLowerCase() ||
    String(matchedUser.email || '').trim().toLowerCase() === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase();
  const resolvedAllowedCols = Array.isArray(matchedUser.allowedColumns)
    ? matchedUser.allowedColumns
    : Array.isArray(matchedUser.permissions?.allowedColumns)
    ? matchedUser.permissions.allowedColumns
    : undefined;
  const resolvedUser: PlatformUser = {
    ...matchedUser,
    isSuperAdmin: isPrimaryAdmin || Boolean(matchedUser.isSuperAdmin),
    permissions: isPrimaryAdmin
      ? { ...FULL_PERMISSIONS }
      : {
          ...EMPTY_PERMISSIONS,
          ...(matchedUser.permissions || {}),
          ...(Array.isArray(resolvedAllowedCols) ? { allowedColumns: resolvedAllowedCols } : {})
        },
    ...(Array.isArray(resolvedAllowedCols) ? { allowedColumns: resolvedAllowedCols } : {}),
    lastLoginAt: new Date().toISOString()
  };

  return {
    success: true,
    user: resolvedUser,
    sanitizedUser: sanitizeUserForClient(resolvedUser),
    migratedInPlace
  };
}

export interface SessionTokenPayload {
  sub: string;
  username: string;
  email: string;
  isSuperAdmin: boolean;
  iat: number;
  exp: number;
  jti: string;
}

/**
 * Issues an HMAC-SHA256 signed session token for an authenticated user.
 */
export function issueSessionToken(
  user: PlatformUser,
  secret: string,
  ttlMs: number = 12 * 60 * 60 * 1000 // 12 hours default
): string {
  const now = Date.now();
  const payload: SessionTokenPayload = {
    sub: user.id,
    username: user.username,
    email: user.email,
    isSuperAdmin: isUserSuperAdmin(user),
    iat: now,
    exp: now + ttlMs,
    jti: crypto.randomBytes(12).toString('hex')
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sigB64 = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verifies an HMAC-SHA256 session token and resolves the live user record from the server database.
 */
export function verifySessionToken(
  token: string | null | undefined,
  secret: string,
  currentUsers: PlatformUser[]
): {
  valid: boolean;
  user?: PlatformUser;
  payload?: SessionTokenPayload;
  error?: string;
  statusCode?: number;
} {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return {
      valid: false,
      error: 'غير مصرح: رمز جلسة المصادقة مفقود أو غير صالح (Authentication Required)',
      statusCode: 401
    };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 2) {
    return {
      valid: false,
      error: 'غير مصرح: بنية رمز الجلسة غير صالحة',
      statusCode: 401
    };
  }

  const [payloadB64, sigB64] = parts;
  const expectedSigB64 = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sigB64, 'utf-8');
  const expBuf = Buffer.from(expectedSigB64, 'utf-8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return {
      valid: false,
      error: 'غير مصرح: توقيع رمز الجلسة غير صحيح',
      statusCode: 401
    };
  }

  let payload: SessionTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
  } catch {
    return {
      valid: false,
      error: 'غير مصرح: تعذر قراءة بيانات رمز الجلسة',
      statusCode: 401
    };
  }

  if (!payload || typeof payload.exp !== 'number' || Date.now() > payload.exp) {
    return {
      valid: false,
      error: 'انتهت صلاحية جلسة الدخول. يرجى إعادة تسجيل الدخول.',
      statusCode: 401
    };
  }

  const allUsers = ensureDefaultSuperAdmins(currentUsers);
  const liveUser = allUsers.find(
    (u) =>
      u &&
      (u.id === payload.sub ||
        (payload.email && u.email?.toLowerCase() === payload.email.toLowerCase()))
  );

  if (!liveUser) {
    return {
      valid: false,
      error: 'غير مصرح: حساب المستخدم لم يعد موجوداً في المنظومة',
      statusCode: 401
    };
  }

  if (liveUser.isActive === false && !isUserSuperAdmin(liveUser)) {
    return {
      valid: false,
      error: 'تم إيقاف هذا الحساب من قبل مسؤول الصلاحيات',
      statusCode: 403
    };
  }

  return {
    valid: true,
    user: liveUser,
    payload
  };
}

/**
 * Extracts session token from Express Request (Authorization Bearer header, x-auth-token header, or query.token).
 */
export function extractRequestToken(req: {
  headers?: Record<string, any>;
  query?: Record<string, any>;
  body?: Record<string, any>;
}): string | null {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const t = authHeader.slice(7).trim();
    if (t) return t;
  }
  const xToken = req.headers?.['x-auth-token'];
  if (typeof xToken === 'string' && xToken.trim()) {
    return xToken.trim();
  }
  if (typeof req.query?.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }
  if (typeof req.body?.authToken === 'string' && req.body.authToken.trim()) {
    return req.body.authToken.trim();
  }
  return null;
}

type BooleanPermissionKey = Exclude<keyof UserPermissions, 'allowedColumns'>;

const PERMISSION_ALIASES: Record<string, BooleanPermissionKey[]> = {
  createOrder: ['addWorkOrder', 'importExcel', 'importCompatibleTables'],
  editOrder: [
    'editWorkOrderStatus',
    'editWorkOrderBasic',
    'inlineTableEdit',
    'auditPdcColumn',
    'auditConstructionColumn',
    'auditTechnicalSupportColumn',
    'editProcedure155',
    'uploadInspectionFiles',
    'addWorkOrder'
  ],
  deleteOrder: ['deleteWorkOrder'],
  Audit155: ['editWorkOrderStatus', 'auditTechnicalSupportColumn', 'auditPdcColumn', 'auditConstructionColumn', 'editProcedure155'],
  uploadPhotos: ['uploadInspectionFiles', 'editWorkOrderBasic', 'editWorkOrderStatus', 'inlineTableEdit', 'addWorkOrder'],
  deletePhotos: ['deleteWorkOrder', 'uploadInspectionFiles', 'editWorkOrderBasic', 'editWorkOrderStatus'],
  exportData: ['exportTable', 'restoreDeleted'],
  importData: ['importExcel', 'importCompatibleTables', 'restoreDeleted'],
  manageTables: ['manageMonthTables', 'deleteMonthTable', 'addWorkOrder', 'importExcel'],
  manageSchema: ['manageColumns', 'manageDropdowns'],
  clearAllOrders: ['clearData'],
  restoreTrash: ['restoreDeleted'],
  sendAlerts: ['manageNotifications']
};

/**
 * Normalizes incoming permissions objects supporting both canonical UserPermissions keys
 * and shorthand alias keys (e.g. createOrder -> addWorkOrder).
 */
export function normalizeUserPermissions(rawPerms: Record<string, any> = {}): UserPermissions {
  const normalized: UserPermissions = { ...EMPTY_PERMISSIONS };
  if (!rawPerms || typeof rawPerms !== 'object') {
    return normalized;
  }

  for (const k of Object.keys(EMPTY_PERMISSIONS) as BooleanPermissionKey[]) {
    if (k === ('allowedColumns' as any)) continue;
    if (rawPerms[k] !== undefined) {
      normalized[k] = Boolean(rawPerms[k]);
    }
  }

  if (Array.isArray(rawPerms.allowedColumns)) {
    normalized.allowedColumns = rawPerms.allowedColumns.map(String);
  }

  for (const [aliasKey, targetKeys] of Object.entries(PERMISSION_ALIASES)) {
    if (rawPerms[aliasKey] !== undefined) {
      const val = Boolean(rawPerms[aliasKey]);
      for (const tk of targetKeys) {
        if (val || rawPerms[tk] === undefined) {
          normalized[tk] = val;
        }
      }
    }
  }

  return normalized;
}

/**
 * Evaluates server-side RBAC permissions for a verified user.
 */
export function verifyUserActionAuthorization(
  user: PlatformUser,
  requiredPermission?: keyof UserPermissions | 'super_admin' | string,
  changedOrderFields?: string[]
): { allowed: boolean; error?: string } {
  if (!user) {
    return { allowed: false, error: 'غير مصرح: يجب تسجيل الدخول أولاً' };
  }
  if (user.isActive === false && !isUserSuperAdmin(user)) {
    return { allowed: false, error: 'الحساب موقوف حالياً' };
  }

  if (isUserSuperAdmin(user)) {
    return { allowed: true };
  }

  if (requiredPermission === 'super_admin') {
    return {
      allowed: false,
      error: 'مرفوض (403): هذه العملية مخصصة حصرياً للمسؤول العام (Super Admin)'
    };
  }

  const metadataFields = new Set([
    'id',
    'updatedAt',
    'createdAt',
    'lastUpdatedBy',
    'isEdited',
    'isNew',
    'lastEditedAt',
    'editedFields',
    'recordVersion',
    'auditSyncStatus',
    'auditSyncError',
    'changedFields',
    'statusSyncTime',
    'statusSyncEmail',
    'statusSyncUser',
    'statusSyncUserId',
    'statusSyncDateRiyadh',
    'statusSyncTimeRiyadh',
    'procedureSyncTime',
    'procedureSyncEmail',
    'procedureSyncUser',
    'pdcSyncTime',
    'pdcSyncUser',
    'pdcSyncEmail',
    'constructionSyncTime',
    'constructionSyncUser',
    'constructionSyncEmail',
    'techSupportSyncTime',
    'techSupportSyncUser',
    'techSupportSyncEmail',
    'photosFile',
    'photos',
    'qualityNoteItems',
    'technicalSupportChecklist',
    'technicalSupportAudit',
    'auditChecklists',
    'pdcChecklist',
    'constructionChecklist',
    'auditHistory',
    'customFields',
    'cellStyles',
    'rowBgColor',
    'sharepointFolderUrl',
    'receiptDate',
    'tableId',
    'tableName',
    'tableYear',
    'tableMonth',
    'completionPercentage',
    'priority',
    'inspectorName',
    'addedByName',
    'addedByEmail',
    'createdByEmail',
    'boqModification',
    'boqDetails',
    'executionStatus',
    'executionNotes',
    'photoCoordination',
    'meterPhotoDocumentation',
    'excavationPhotoDocumentation',
    'equipmentPhotoDocumentation',
    'overheadPhotoDocumentation',
    'isImported',
    'importedFromTableId',
    'importedFromTableName',
    'importedAt',
    'importedFields',
    'importedSourceOrderId'
  ]);

  if (requiredPermission) {
    const aliasTargets = PERMISSION_ALIASES[String(requiredPermission)];
    let hasPerm = aliasTargets
      ? aliasTargets.some((tk) => hasUserPermission(user, tk))
      : hasUserPermission(user, requiredPermission);

    // If requiredPermission is editOrder, also allow active users who have allowedColumns configured
    // or who are editing universally editable / allowed columns (such as qualityNotes)
    if (!hasPerm && requiredPermission === 'editOrder') {
      const userAllowed = user.allowedColumns || user.permissions?.allowedColumns;
      if (Array.isArray(userAllowed) && userAllowed.length > 0) {
        hasPerm = true;
      } else if (Array.isArray(changedOrderFields) && changedOrderFields.length > 0) {
        const meaningfulFields = changedOrderFields.filter(f => !metadataFields.has(f));
        if (meaningfulFields.length === 0 || meaningfulFields.every(f => canUserEditColumn(user, f))) {
          hasPerm = true;
        }
      }
    }

    if (!hasPerm) {
      return {
        allowed: false,
        error: `مرفوض (403): لا تملك الصلاحية المطلوبة (${requiredPermission}) لتنفيذ هذه العملية`
      };
    }
  }

  if (Array.isArray(changedOrderFields) && changedOrderFields.length > 0) {
    for (const field of changedOrderFields) {
      if (metadataFields.has(field)) continue;
      if (!canUserEditColumn(user, field)) {
        return {
          allowed: false,
          error: `مرفوض (403): لا تملك صلاحية تعديل العمود (${field})`
        };
      }
    }
  }

  return { allowed: true };
}

