# ZACMA Technology & Training Institute — Student Fee Management & Accounting Portal

Production-ready Student Fee Management, Payment Approval, Official Receipting, Accounting, Attendance, Automated Payment Reminders, Isolated Student Portal, and Role-Aware AI Assistant for **ZACMA Technology & Training Institute**.

---

## Key Capabilities

- **Official ZACMA Branding**: Professional ZACMA Blue (`#1D4ED8`), ZACMA Red (`#DC2626`), clean white surfaces, and dark navy (`#0F172A`) navigation across all dashboards, printable receipts, and mobile layouts.
- **5 Strict Role-Based Workspaces**:
  - `ADMIN`: Full institutional oversight, maker-checker approvals, courses, fee structures, expenses, financial reports, attendance, staff roles, audit logs, and System Setup Wizard.
  - `ACCOUNTANT`: Student registration (`ZAC-YYYY-NNNN`), payment plan assignment, fee recording (always `PENDING` until Admin approves), balance tracking, payment reminders, and printable approved receipts.
  - `INSTRUCTOR`: Assigned classes, enrolled students, and daily attendance with zero financial access.
  - `GENERAL_STAFF`: Campus course schedules, student directory overview, and attendance summary with zero financial access.
  - `STUDENT`: Completely separate, self-service portal restricted strictly to the student's own balance, installment deadlines, reminders, payment history, and printable official receipts.
- **Maker-Checker Financial Integrity**:
  - Only **Admin-approved** payments count toward official collected revenue, reduce student balances, issue official QR-verified receipts (`RCP-YYYY-NNNN`), or clear overdue installments.
  - Duplicate transaction references are blocked atomically.
- **Automated Student Payment Reminders**:
  - Calculates upcoming, due-today, and overdue installments from each student's actual enrollment date and payment schedule (Full, Monthly, Two-Month, Three-Month, Six-Month, Custom).
  - Deduplicates notifications using deterministic keys and stops overdue reminders immediately once approved payments cover the installment.
  - Includes per-user notification preferences and extensible Email/SMS/WhatsApp adapter readiness checks.
- **ZACMA AI ASSISTANT**:
  - Floating, read-only, role-aware assistant powered by server-side Gemini API (`/api/ai/chat`) grounded in the ZACMA Knowledge Base (`src/lib/knowledgeBase.ts`).
  - Strictly enforces role isolation (never exposes other students' records or financial data to non-finance roles; never modifies database records).
- **Database Integration & Setup Wizard**:
  - Admin-only diagnostics inspecting server environment variables, database connectivity, required collections, and safe, confirmed, idempotent schema migrations (`0001`–`0004`).

---

## Local Development

```bash
npm install
cp .env.example .env
# Add your GEMINI_API_KEY in .env
npm run dev
```

The Express + Vite server starts on `http://localhost:3000`.

### Verify Build & Types

```bash
npm run lint
npm run build
```

---

## Deploying to GitHub, Vercel & Supabase

### 1. Push to GitHub

Ensure `.env` is ignored (already listed in `.gitignore`), then push the repository:

```bash
git init
git add .
git commit -m "ZACMA Student Fee Management & Accounting Portal"
git branch -M main
git remote add origin https://github.com/<your-org>/zacma-fee-portal.git
git push -u origin main
```

### 2. Provision Supabase & Apply SQL Migrations

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Apply the four idempotent, version-controlled SQL migrations in order via the Supabase SQL Editor or Supabase CLI (`supabase db push`):
   - `supabase/migrations/0001_initial_zacma_schema.sql`
   - `supabase/migrations/0002_reminders_and_notifications.sql`
   - `supabase/migrations/0003_student_portal_and_general_staff.sql`
   - `supabase/migrations/0004_ai_audit_and_migration_tracking.sql`
3. *(Optional)* Enable `pg_cron` in Supabase Extensions and schedule daily reminders:
   ```sql
   SELECT cron.schedule(
     'zacma-daily-payment-reminders',
     '0 6 * * *',
     $$SELECT public.process_zacma_payment_reminders(7, 3);$$
   );
   ```

### 3. Deploy to Vercel

1. Import your GitHub repository in [vercel.com](https://vercel.com).
2. Configure Environment Variables in **Vercel Project Settings -> Environment Variables**:
   - `GEMINI_API_KEY` (Server-side only — powers ZACMA AI Assistant via `/api/ai/chat`)
   - `GEMINI_MODEL` (default: `gemini-4-hydrogen`)
   - `CRON_SECRET` (random token used to authenticate Vercel Cron requests to `/api/cron/reminders`)
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (when connecting to Supabase; `/api/cron/reminders` automatically calls `public.process_zacma_payment_reminders()` server-side without requiring an open browser tab)
   - Optional external channels: `SMTP_*`, `TWILIO_*`, `WHATSAPP_*`
3. Vercel automatically deploys the Vite frontend (`dist`), the serverless API routes under `/api/` (`/api/health`, `/api/ai/chat`, `/api/setup/status`, `/api/cron/reminders`, `/api/reminders/dispatch-external`, `/api/reminders/record-run`), and the daily 06:00 UTC Cron schedule defined in `vercel.json`.

---

## Troubleshooting

- **AI Assistant shows "Unavailable"**: Verify `GEMINI_API_KEY` is set in your server environment (`.env` locally or Vercel Environment Variables in production). The rest of the ZACMA portal operates normally even without an AI key.
- **External Email/SMS/WhatsApp not sending**: External channels require valid provider credentials (`SMTP_*`, `TWILIO_*`, `WHATSAPP_*`) and a live provider SDK call; the portal never reports fake delivery success when unconfigured.
- **Student cannot see their balance**: Confirm the user's profile role is set to `STUDENT` and linked to their ZACMA Student ID in **Staff & Roles**.
- **Security Rules Review**: Before broad production rollout, review `firestore.rules` and `supabase/migrations/0003_student_portal_and_general_staff.sql` with your institute's security administrator to confirm role bindings and domain access policies match your campus requirements.
