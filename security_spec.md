# ZACMA Portal — Security Specification & Dirty Dozen Invariants

## Core Data Invariants
1. **Strict RBAC**: Only verified authenticated staff with an active profile in `/profiles/{uid}` (or the bootstrapped admin email `zekimuluken@gmail.com` with `email_verified == true`) may access institutional data.
2. **Instructor Financial Isolation**: Instructors are strictly forbidden from reading or writing `/payments`, `/payment_refs`, `/payment_plans`, `/payment_installments`, `/receipts`, `/expenses`, `/expense_categories`, and `/audit_logs`.
3. **Maker-Checker Payment Integrity**: Accountants may only submit new payments with `status == 'PENDING'` and `recordedBy == request.auth.uid`. Accountants can NEVER approve or reject payments, modify approved payments, alter course fees, or modify user roles.
4. **Registration Approval Gate**: Accountants may only register students with `registrationStatus == 'PENDING'` and `registeredBy == request.auth.uid`. Only Admins may transition students to `APPROVED` or `REJECTED`.
5. **Duplicate Transaction Reference Prevention**: Every payment submission claims an immutable lock document in `/payment_refs/{sanitizedRef}` that cannot be overwritten or deleted by non-admins.
6. **Immutable Official Receipts & Audit Trail**: `/receipts` can only be created by Admins for approved payments and can never be updated or deleted. `/audit_logs` are strictly append-only (`update` and `delete` denied for all roles including Admin).

## Dirty Dozen Adversarial Payloads (Must All Be Denied)
1. **Self-Privilege Escalation**: Unprivileged user creates or updates `/profiles/{uid}` with `role: 'ADMIN'`.
2. **Accountant Self-Approval**: Accountant updates `/payments/{id}` changing `status` from `'PENDING'` to `'APPROVED'`.
3. **Accountant Approved-Payment Tampering**: Accountant edits `amountEtb` on an already `'APPROVED'` payment.
4. **Accountant Direct Approved Submission**: Accountant creates `/payments/{id}` directly with `status: 'APPROVED'`.
5. **Accountant Course Fee Manipulation**: Accountant updates `/courses/{id}` changing `feeEtb`.
6. **Instructor Financial Snooping**: Instructor attempts `get` or `list` on `/payments`, `/receipts`, or `/expenses`.
7. **Audit Trail Tampering**: Admin or Accountant attempts `update` or `delete` on `/audit_logs/{id}`.
8. **Receipt Forgery**: Accountant attempts `create` on `/receipts/{id}` for a pending payment.
9. **Spoofed Recorder Identity**: Accountant creates `/payments/{id}` with `recordedBy: 'someone-else'`.
10. **Shadow Field Injection**: User injects unauthorized field `isSuperAdmin: true` on `/students/{id}` or `/payments/{id}`.
11. **Unverified Email Spoofing**: Request with matching admin email but `email_verified == false`.
12. **Oversized ID / String Poisoning**: Document creation with 200-char invalid document ID or 200KB string payload.
