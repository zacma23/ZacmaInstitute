# ZACMA Portal — Security Specification & Dirty Dozen Invariants

## Core Data Invariants
1. **Strict RBAC**: Only verified authenticated staff with an active profile in `/profiles/{uid}` (or the bootstrapped admin email `zekimuluken@gmail.com` with `email_verified == true`) may access institutional data.
2. **Instructor Financial Isolation**: Instructors are strictly forbidden from reading or writing `/payments`, `/payment_refs`, `/payment_plans`, `/payment_installments`, `/receipts`, `/expenses`, `/expense_categories`, and `/audit_logs`.
3. **Maker-Checker Payment Integrity**: Accountants may only submit new payments with `status == 'PENDING'` and `recordedBy == request.auth.uid`. Accountants can NEVER approve or reject payments, modify approved payments, alter course fees, or modify user roles.
4. **Registration Approval Gate**: Accountants may only register students with `registrationStatus == 'PENDING'` and `registeredBy == request.auth.uid`. Only Admins may transition students to `APPROVED` or `REJECTED`.
5. **Duplicate Transaction Reference Prevention**: Every payment submission claims an immutable lock document in `/payment_refs/{sanitizedRef}` that cannot be overwritten or deleted by non-admins.
7. **Identity Document Isolation**: Raw encrypted ID document scans in `/identity_documents/{docId}` are strictly restricted to Admins (and uploader-only `get` during pending review); Students, Instructors, and General Staff have zero read or write access.
8. **Staff Salary Isolation**: `/staff_compensation/{staffId}` is strictly Admin-only (`read` and `write`). Non-admin staff can never view or modify salaries.
9. **Atomic ID & Duplicate Guard**: `/id_counters/{counterId}` only permits monotonic increments (`incoming().currentValue == existing().currentValue + 1`) by finance staff or Admin. `/id_number_locks/{hashId}` prevents duplicate identification numbers and cannot be overwritten or deleted by non-admins.
10. **Human Verification Gate**: OCR scans never auto-approve identities; Accountants may only create `PENDING` student/staff registrations and `PENDING_REVIEW` identity documents. Only Admins can transition to `APPROVED`, `VERIFIED`, `FLAGGED`, or `REJECTED`.

## Dirty Dozen Adversarial Payloads (Must All Be Denied)
1. **Self-Privilege Escalation**: Unprivileged user creates or updates `/profiles/{uid}` with `role: 'ADMIN'`.
2. **Accountant Self-Approval**: Accountant updates `/payments/{id}` or `/students/{id}` or `/staff_records/{id}` changing status to `'APPROVED'`.
3. **Accountant Salary Snooping**: Accountant attempts `get` or `list` on `/staff_compensation/{staffId}`.
4. **Student/Instructor ID Vault Breach**: Student or Instructor attempts `get` or `list` on `/identity_documents/{docId}`.
5. **Accountant ID Auto-Verification**: Accountant creates `/identity_documents/{docId}` with `verificationStatus: 'VERIFIED'` or updates an existing document's `verificationStatus`.
6. **Counter Rollback Attack**: Accountant decrements `/id_counters/student_seq` `currentValue` to reuse an existing ID code.
7. **Duplicate ID Lock Deletion**: Accountant attempts `delete` or `update` on `/id_number_locks/{hashId}` to bypass duplicate detection.
8. **Receipt Forgery**: Accountant attempts `create` on `/receipts/{id}` for a pending payment.
9. **Spoofed Uploader Identity**: Accountant creates `/identity_documents/{docId}` with `uploadedBy: 'other-user-uid'`.
10. **Shadow Field Injection**: User injects unauthorized field `isSuperAdmin: true` on `/staff_records/{id}` or `/identity_documents/{docId}`.
11. **Unverified Email Spoofing**: Request with matching admin email but `email_verified == false`.
12. **Oversized ID / String Poisoning**: Document creation with 200-char invalid document ID or payload exceeding schema bounds.
