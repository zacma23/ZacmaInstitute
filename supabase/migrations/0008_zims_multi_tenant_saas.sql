-- =============================================================================
-- ZACMA INSTITUTE MANAGEMENT SYSTEM (ZIMS) — MULTI-TENANT SAAS SCHEMA MIGRATION
-- Version: 0008_zims_multi_tenant_saas
-- Description:
--   Upgrades ZACMA into a complete multi-tenant SaaS platform with strict
--   tenant_id isolation, public institute registration requests, platform
--   announcements, quarterly billing cycles, departments, class batches,
--   institutional document library, and PostgreSQL Row-Level Security (RLS).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Core SaaS Tenants & Subscription Catalog
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id                  TEXT PRIMARY KEY,
  code                TEXT NOT NULL CHECK (code IN ('FREE_TRIAL', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM')),
  name                TEXT NOT NULL,
  tagline             TEXT NOT NULL,
  monthly_price_etb   NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_price_etb >= 0),
  quarterly_price_etb NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (quarterly_price_etb >= 0),
  annual_price_etb    NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (annual_price_etb >= 0),
  trial_days          INTEGER NOT NULL DEFAULT 14 CHECK (trial_days >= 0),
  student_limit       INTEGER NOT NULL DEFAULT 100 CHECK (student_limit > 0),
  staff_limit         INTEGER NOT NULL DEFAULT 15 CHECK (staff_limit > 0),
  storage_limit_mb    INTEGER NOT NULL DEFAULT 2048 CHECK (storage_limit_mb > 0),
  ai_monthly_quota    INTEGER NOT NULL DEFAULT 500 CHECK (ai_monthly_quota >= 0),
  included_modules    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured         BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenants (
  id                        TEXT PRIMARY KEY,
  tenant_id                 TEXT NOT NULL UNIQUE,
  name                      TEXT NOT NULL,
  short_name                TEXT NOT NULL,
  slug                      TEXT NOT NULL UNIQUE,
  business_type             TEXT NOT NULL DEFAULT 'Training Institute',
  email                     TEXT NOT NULL,
  phone                     TEXT NOT NULL,
  country                   TEXT NOT NULL DEFAULT 'Ethiopia',
  city                      TEXT NOT NULL DEFAULT 'Addis Ababa',
  address                   TEXT NOT NULL,
  website                   TEXT,
  logo_url                  TEXT,
  primary_color             TEXT NOT NULL DEFAULT '#172DEB',
  secondary_color           TEXT NOT NULL DEFAULT '#E51B23',
  student_id_prefix         TEXT NOT NULL DEFAULT 'ZAC',
  staff_id_prefix           TEXT NOT NULL DEFAULT 'ZAC',
  receipt_prefix            TEXT NOT NULL DEFAULT 'ZAC-RCP',
  currency                  TEXT NOT NULL DEFAULT 'ETB' CHECK (currency IN ('ETB', 'USD', 'KES', 'EUR', 'GBP')),
  timezone                  TEXT NOT NULL DEFAULT 'Africa/Addis_Ababa',
  academic_year             TEXT NOT NULL DEFAULT '2025/2026',
  status                    TEXT NOT NULL DEFAULT 'TRIAL' CHECK (status IN ('ACTIVE', 'TRIAL', 'SUSPENDED', 'PENDING', 'EXPIRED')),
  plan_id                   TEXT REFERENCES public.subscription_plans(id),
  plan_code                 TEXT NOT NULL,
  plan_name                 TEXT NOT NULL,
  billing_cycle             TEXT NOT NULL DEFAULT 'TRIAL' CHECK (billing_cycle IN ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'TRIAL', 'CUSTOM')),
  monthly_price_etb         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  quarterly_price_etb       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  annual_price_etb          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  student_limit             INTEGER NOT NULL DEFAULT 100,
  staff_limit               INTEGER NOT NULL DEFAULT 15,
  storage_limit_mb          INTEGER NOT NULL DEFAULT 2048,
  ai_monthly_quota          INTEGER NOT NULL DEFAULT 500,
  enabled_modules           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  primary_admin_uid         TEXT,
  primary_admin_name        TEXT NOT NULL,
  primary_admin_email       TEXT NOT NULL,
  primary_admin_phone       TEXT NOT NULL,
  subscription_start_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  trial_ends_at             DATE,
  subscription_expires_at   DATE NOT NULL,
  suspended_reason          TEXT,
  suspended_at              TIMESTAMPTZ,
  created_by                TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. Public Institute Self-Registration Queue & Platform Announcements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.institute_registration_requests (
  id                    TEXT PRIMARY KEY,
  institute_name        TEXT NOT NULL,
  short_name            TEXT NOT NULL,
  slug                  TEXT NOT NULL,
  business_type         TEXT NOT NULL,
  email                 TEXT NOT NULL,
  phone                 TEXT NOT NULL,
  country               TEXT NOT NULL DEFAULT 'Ethiopia',
  city                  TEXT NOT NULL DEFAULT 'Addis Ababa',
  address               TEXT NOT NULL,
  website               TEXT,
  logo_url              TEXT,
  primary_color         TEXT NOT NULL DEFAULT '#172DEB',
  secondary_color       TEXT NOT NULL DEFAULT '#E51B23',
  currency              TEXT NOT NULL DEFAULT 'ETB',
  selected_plan_id      TEXT NOT NULL,
  selected_plan_code    TEXT NOT NULL,
  selected_plan_name    TEXT NOT NULL,
  billing_cycle         TEXT NOT NULL CHECK (billing_cycle IN ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'TRIAL', 'CUSTOM')),
  admin_full_name       TEXT NOT NULL,
  admin_email           TEXT NOT NULL,
  admin_phone           TEXT NOT NULL,
  admin_position        TEXT NOT NULL DEFAULT 'Institute Administrator',
  applicant_uid         TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  provisioned_tenant_id TEXT REFERENCES public.tenants(tenant_id),
  rejection_reason      TEXT,
  reviewed_by           TEXT,
  reviewed_by_name      TEXT,
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inst_reg_req_status
  ON public.institute_registration_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  message          TEXT NOT NULL,
  severity         TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'SUCCESS', 'CRITICAL')),
  target_audience  TEXT NOT NULL DEFAULT 'ALL_INSTITUTES' CHECK (target_audience IN ('ALL_INSTITUTES', 'TRIAL_INSTITUTES', 'ACTIVE_INSTITUTES', 'SPECIFIC_TENANT')),
  target_tenant_id TEXT REFERENCES public.tenants(tenant_id),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at       DATE,
  created_by       TEXT NOT NULL,
  created_by_name  TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3. Tenant-Isolated Academic Structure: Departments, Classes/Batches, Documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  head_name   TEXT,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_departments_tenant
  ON public.departments (tenant_id, is_active);

CREATE TABLE IF NOT EXISTS public.class_batches (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  batch_code      TEXT NOT NULL,
  name            TEXT NOT NULL,
  course_id       TEXT NOT NULL,
  course_name     TEXT NOT NULL,
  department_id   TEXT REFERENCES public.departments(id) ON DELETE SET NULL,
  department_name TEXT,
  instructor_id   TEXT,
  instructor_name TEXT,
  room            TEXT,
  schedule        TEXT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  capacity        INTEGER NOT NULL DEFAULT 30 CHECK (capacity > 0),
  status          TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED')),
  created_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, batch_code)
);

CREATE INDEX IF NOT EXISTS idx_class_batches_tenant
  ON public.class_batches (tenant_id, status, start_date DESC);

CREATE TABLE IF NOT EXISTS public.institute_documents (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('SYLLABUS', 'POLICY', 'HANDBOOK', 'CERTIFICATE_TEMPLATE', 'FEE_SCHEDULE', 'FORM', 'OTHER')),
  description      TEXT,
  file_name        TEXT NOT NULL,
  file_mime_type   TEXT NOT NULL,
  file_size_bytes  INTEGER NOT NULL CHECK (file_size_bytes > 0),
  file_storage_uri TEXT NOT NULL,
  visibility       TEXT NOT NULL DEFAULT 'ALL_STAFF' CHECK (visibility IN ('ALL_STAFF', 'ADMIN_ONLY', 'STUDENTS_AND_STAFF')),
  department_name  TEXT,
  course_name      TEXT,
  uploaded_by      TEXT NOT NULL,
  uploaded_by_name TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_institute_documents_tenant
  ON public.institute_documents (tenant_id, category, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Row-Level Security (RLS) Enforcement — Strict Tenant Isolation
-- ---------------------------------------------------------------------------
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institute_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS departments_tenant_isolation ON public.departments;
CREATE POLICY departments_tenant_isolation ON public.departments
  USING (
    current_setting('app.platform_role', true) IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

DROP POLICY IF EXISTS class_batches_tenant_isolation ON public.class_batches;
CREATE POLICY class_batches_tenant_isolation ON public.class_batches
  USING (
    current_setting('app.platform_role', true) IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

DROP POLICY IF EXISTS institute_documents_tenant_isolation ON public.institute_documents;
CREATE POLICY institute_documents_tenant_isolation ON public.institute_documents
  USING (
    current_setting('app.platform_role', true) IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

COMMIT;
