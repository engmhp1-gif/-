# Security Specification — SEC QCMS PRO (Procedure 155)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Every path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Server Vault Capability Isolation (`/serverVaults/{vaultKey}` & `/serverVaults/{vaultKey}/chunks/{chunkId}`)**:
   - Directory listing (`allow list`) is strictly forbidden (`if false`) to prevent enumeration.
   - Root manifest deletion (`allow delete`) is strictly forbidden (`if false`) to prevent catastrophic state deletion.
   - Single-document `get`, `create`, and `update` operations require the exact cryptographic server capability key (`vaultKey == 'sec_qcms_155_vault_c497b379_4418_4a34_9623_987a3f506df0_v1'`) AND strict payload validation (`isValidServerVaultManifest` / `isValidServerVaultChunk`), including strict key allowlists (`hasAll` + `hasOnly`), string length bounds (`<= 900000`), and bounded `chunkIds` list (`size() <= 60`).
   - Every sub-collection chunk operation enforces relational parent consistency via `exists()` or `existsAfter()` on the parent `/serverVaults/{vaultKey}` document.
3. **Direct Client Work Orders (`/workOrders/{orderId}`)**:
   - Requires verified authentication (`request.auth != null && request.auth.token.email_verified == true`).
   - Enforces path ID hardening (`isValidId(orderId)`), strict field validation (`isValidWorkOrder`), immutable `ownerId` and `createdAt`, server-timestamp verification (`request.time`), and terminal state locking once `status == 'archived'` unless `isAdmin()`.
   - `allow list` enforces query-side ownership (`resource.data.ownerId == request.auth.uid`) without any `get()` or `exists()` calls inside `list`.
4. **Trusted Admin Registry (`/admins/{adminId}`)**:
   - Read-only to the owner or bootstrapped admin (`engmhp1@gmail.com` with `email_verified == true`); only the bootstrapped admin can manage admin records.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Payload 1 (Shadow Field Injection on WorkOrder)**: Includes `isVerified: true` ghost key -> Rejected by `data.keys().hasOnly(...)`.
2. **Payload 2 (Identity Spoofing on WorkOrder Create)**: Sets `ownerId` to another user's UID -> Rejected by `data.ownerId == request.auth.uid`.
3. **Payload 3 (Unverified Email Admin Spoof)**: Uses `email: 'engmhp1@gmail.com'` with `email_verified: false` -> Rejected by `request.auth.token.email_verified == true`.
4. **Payload 4 (Path Variable ID Poisoning)**: Uses a 200-char or special-char `orderId` -> Rejected by `isValidId(orderId)`.
5. **Payload 5 (Denial-of-Wallet 1MB String on `contractorName`)**: Sends a 5,000-character string -> Rejected by `data.contractorName.size() <= 500`.
6. **Payload 6 (Immortal Field Mutation on WorkOrder Update)**: Attempts to mutate `createdAt` or `ownerId` -> Rejected by `incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`.
7. **Payload 7 (Terminal State Bypass)**: Non-admin attempts to update a WorkOrder whose `existing().status == 'archived'` -> Rejected by `existing().status != 'archived'`.
8. **Payload 8 (Client Timestamp Forgery)**: Sends a forged past/future `createdAt` or `updatedAt` instead of `request.time` -> Rejected by `incoming().createdAt == request.time`.
9. **Payload 9 (Unauthorized Collection Scraping on `/workOrders`)**: Queries `/workOrders` without filtering `ownerId == request.auth.uid` -> Rejected by `allow list: if isVerifiedUser() && resource.data.ownerId == request.auth.uid`.
10. **Payload 10 (Server Vault Enumeration Attack)**: Attempts a `list` query on `/serverVaults` or `/serverVaults/{vaultKey}/chunks` -> Rejected by `allow list: if false`.
11. **Payload 11 (Server Vault Deletion Attack)**: Attempts `delete` on `/serverVaults/sec_qcms_155_vault_c497b379_4418_4a34_9623_987a3f506df0_v1` -> Rejected by `allow delete: if false`.
12. **Payload 12 (Server Vault Shadow Key / Type Poisoning)**: Sends an invalid key or `workOrderCount: "nine"` (string instead of number) to `/serverVaults/{vaultKey}` -> Rejected by `isValidServerVaultManifest(incoming())`.
