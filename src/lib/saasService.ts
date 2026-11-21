import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  addDaysIso,
  AuditLog,
  BillingCycle,
  ClassBatch,
  ClassBatchStatus,
  Department,
  InstituteDocument,
  InstituteDocumentCategory,
  InstituteRegistrationRequest,
  NavSection,
  PaymentMethod,
  PlatformAnnouncement,
  PlatformGlobalSettings,
  PlatformInvoice,
  PlatformPayment,
  PlatformRole,
  PlatformSubscription,
  RoleCode,
  SaasModuleCode,
  StaffProfile,
  StaffRecord,
  Student,
  SubscriptionPlan,
  SupportAccessSession,
  SupportTicket,
  TenantInvitation,
  TenantRecord,
  TenantStatus,
  todayIsoDate,
} from '../types/zacma';

export const DEFAULT_ZACMA_TENANT_ID = 'zacma_default';

export interface SaasModuleDefinition {
  code: SaasModuleCode;
  label: string;
  category: 'Core Academic' | 'Finance & Billing' | 'AI & Automation' | 'Operations';
  description: string;
  navSections: NavSection[];
}

export const ALL_SAAS_MODULES: SaasModuleDefinition[] = [
  {
    code: 'STUDENT_MANAGEMENT',
    label: 'Student Management',
    category: 'Core Academic',
    description: 'Student registration, enrollment records, profiles, and portal access.',
    navSections: ['students', 'registrations'],
  },
  {
    code: 'STAFF_MANAGEMENT',
    label: 'Staff Management',
    category: 'Operations',
    description: 'Staff profiles, role permissions, HR records, and portal onboarding.',
    navSections: ['staff', 'registrations'],
  },
  {
    code: 'COURSE_MANAGEMENT',
    label: 'Course Management',
    category: 'Core Academic',
    description: 'Training courses catalog, fee schedules, and instructor assignment.',
    navSections: ['courses'],
  },
  {
    code: 'FEE_MANAGEMENT',
    label: 'Fee & Online Payments',
    category: 'Finance & Billing',
    description: 'Tuition collection, Chapa online payments, installment schedules, and receipts.',
    navSections: ['payments', 'chapa', 'reminders', 'approvals', 'receipts'],
  },
  {
    code: 'ACCOUNTING',
    label: 'Accounting & Expenses',
    category: 'Finance & Billing',
    description: 'General ledger, institutional expenses, cash flow, and net income tracking.',
    navSections: ['accounting'],
  },
  {
    code: 'ATTENDANCE',
    label: 'Attendance Tracking',
    category: 'Core Academic',
    description: 'Daily student roll-call, tardiness/absence alerts, and instructor registers.',
    navSections: ['attendance'],
  },
  {
    code: 'AI_ASSISTANT',
    label: 'AI Portal Assistant',
    category: 'AI & Automation',
    description: 'Tenant-isolated role-based ZACMA AI Assistant across all authorized modules.',
    navSections: ['ai_hub'],
  },
  {
    code: 'AI_ID_SCANNING',
    label: 'AI ID OCR & QR Scanning',
    category: 'AI & Automation',
    description: 'Automated Fayda/National ID, Passport, Driving Licence OCR & QR intake.',
    navSections: ['registrations'],
  },
  {
    code: 'NOTIFICATIONS',
    label: 'SMS & Internal Messaging',
    category: 'Operations',
    description: 'SMS gateway integration, automated reminders, and internal campus messaging.',
    navSections: ['messages', 'communications'],
  },
  {
    code: 'REPORTS',
    label: 'Executive Reports & Excel',
    category: 'Finance & Billing',
    description: 'Comprehensive downloadable .xlsx financial and academic workbooks.',
    navSections: ['reports'],
  },
  {
    code: 'HR_MANAGEMENT',
    label: 'HR & Compensation Vault',
    category: 'Operations',
    description: 'Staff compensation records, employment history, and HR compliance.',
    navSections: ['staff'],
  },
  {
    code: 'INVENTORY',
    label: 'Campus Inventory & Assets',
    category: 'Operations',
    description: 'Training lab hardware, equipment tracking, and campus supplies.',
    navSections: [],
  },
  {
    code: 'CERTIFICATES',
    label: 'Training Certificates',
    category: 'Core Academic',
    description: 'Verifiable course completion certificates and graduate registry.',
    navSections: [],
  },
];

export const ALL_SAAS_MODULE_CODES: SaasModuleCode[] = ALL_SAAS_MODULES.map((m) => m.code);

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  SUPER_ADMIN: 'Super Admin (Owner)',
  PLATFORM_ADMIN: 'Platform Admin',
  PLATFORM_SUPPORT: 'Platform Support',
  PLATFORM_FINANCE: 'Platform Finance',
};

export const INSTITUTE_ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: 'Institute Admin',
  MANAGER: 'Institute Manager',
  ACCOUNTANT: 'Accountant',
  INSTRUCTOR: 'Instructor',
  RECEPTIONIST: 'Receptionist',
  HR_OFFICER: 'HR Officer',
  GENERAL_STAFF: 'General Staff',
  STUDENT: 'Student',
};

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_free_trial',
    code: 'FREE_TRIAL',
    name: 'Free Trial (14 Days)',
    tagline: 'Evaluate the full ZACMA ZIMS training institute portal with zero commitment.',
    monthlyPriceEtb: 0,
    quarterlyPriceEtb: 0,
    annualPriceEtb: 0,
    trialDays: 14,
    studentLimit: 50,
    staffLimit: 10,
    storageLimitMb: 512,
    aiMonthlyQuota: 100,
    includedModules: [
      'STUDENT_MANAGEMENT',
      'STAFF_MANAGEMENT',
      'COURSE_MANAGEMENT',
      'FEE_MANAGEMENT',
      'ATTENDANCE',
      'AI_ASSISTANT',
      'AI_ID_SCANNING',
      'NOTIFICATIONS',
    ],
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'plan_basic',
    code: 'BASIC',
    name: 'Basic Institute',
    tagline: 'Essential student management, departments, courses, and fee receipts.',
    monthlyPriceEtb: 4500,
    quarterlyPriceEtb: 12000,
    annualPriceEtb: 45000,
    trialDays: 14,
    studentLimit: 250,
    staffLimit: 25,
    storageLimitMb: 2048,
    aiMonthlyQuota: 300,
    includedModules: [
      'STUDENT_MANAGEMENT',
      'STAFF_MANAGEMENT',
      'COURSE_MANAGEMENT',
      'FEE_MANAGEMENT',
      'ATTENDANCE',
      'NOTIFICATIONS',
      'REPORTS',
    ],
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'plan_professional',
    code: 'PROFESSIONAL',
    name: 'Professional Institute',
    tagline: 'Full accounting, Chapa online fees, AI ID OCR scanning, and SMS alerts.',
    monthlyPriceEtb: 9500,
    quarterlyPriceEtb: 25500,
    annualPriceEtb: 95000,
    trialDays: 14,
    studentLimit: 1000,
    staffLimit: 80,
    storageLimitMb: 10240,
    aiMonthlyQuota: 2000,
    includedModules: [
      'STUDENT_MANAGEMENT',
      'STAFF_MANAGEMENT',
      'COURSE_MANAGEMENT',
      'FEE_MANAGEMENT',
      'ACCOUNTING',
      'ATTENDANCE',
      'AI_ASSISTANT',
      'AI_ID_SCANNING',
      'NOTIFICATIONS',
      'REPORTS',
      'HR_MANAGEMENT',
      'CERTIFICATES',
    ],
    isActive: true,
    isFeatured: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'plan_enterprise',
    code: 'ENTERPRISE',
    name: 'Enterprise Campus',
    tagline: 'Unlimited scale, custom branding, full AI suite, HR, and priority SLA.',
    monthlyPriceEtb: 18500,
    quarterlyPriceEtb: 49500,
    annualPriceEtb: 185000,
    trialDays: 30,
    studentLimit: 10000,
    staffLimit: 500,
    storageLimitMb: 51200,
    aiMonthlyQuota: 20000,
    includedModules: ALL_SAAS_MODULE_CODES,
    isActive: true,
    updatedAt: new Date().toISOString(),
  },
];

export const DEFAULT_PLATFORM_SETTINGS: PlatformGlobalSettings = {
  id: 'default',
  platformName: 'ZACMA Institute Management System (ZIMS)',
  supportEmail: 'support@zacmatech.com',
  supportPhone: '+251 911 000 000',
  defaultCurrency: 'ETB',
  defaultLanguage: 'English (Ethiopia)',
  defaultTrialDays: 14,
  gracePeriodDays: 7,
  autoSuspendExpiredDays: 14,
  allowSelfSignupInstitutes: true,
  autoApproveInstituteRegistrations: false,
  enforceSupportSessionReason: true,
  maxSupportSessionMinutes: 60,
  defaultAiModel: 'gemini-4-hydrogen',
  aiMonthlyTokenLimit: 2000000,
  aiDocScanLimit: 500,
  updatedAt: new Date().toISOString(),
};

/**
 * Returns whether a given institute navigation section is enabled for a tenant's
 * active module list. Core system views (`dashboard`, `branding`, `audit`, `setup`)
 * are always available to authorized roles.
 */
export function isNavSectionAllowedByModules(
  section: NavSection,
  enabledModules: SaasModuleCode[] | undefined
): boolean {
  if (!enabledModules || enabledModules.length === 0) return true;
  const set = new Set<SaasModuleCode>(enabledModules);
  switch (section) {
    case 'dashboard':
    case 'branding':
    case 'audit':
    case 'setup':
      return true;
    case 'ai_hub':
      return set.has('AI_ASSISTANT');
    case 'students':
      return set.has('STUDENT_MANAGEMENT');
    case 'registrations':
      return (
        set.has('AI_ID_SCANNING') ||
        set.has('STUDENT_MANAGEMENT') ||
        set.has('STAFF_MANAGEMENT')
      );
    case 'courses':
    case 'documents':
      return set.has('COURSE_MANAGEMENT') || set.has('STUDENT_MANAGEMENT');
    case 'payments':
    case 'chapa':
    case 'reminders':
    case 'approvals':
    case 'receipts':
      return set.has('FEE_MANAGEMENT');
    case 'accounting':
      return set.has('ACCOUNTING');
    case 'reports':
      return set.has('REPORTS');
    case 'attendance':
      return set.has('ATTENDANCE');
    case 'messages':
    case 'communications':
      return set.has('NOTIFICATIONS');
    case 'staff':
      return set.has('STAFF_MANAGEMENT') || set.has('HR_MANAGEMENT');
    default:
      return true;
  }
}

export function requiredModuleForNavSection(section: NavSection): SaasModuleCode | null {
  switch (section) {
    case 'ai_hub':
      return 'AI_ASSISTANT';
    case 'students':
      return 'STUDENT_MANAGEMENT';
    case 'registrations':
      return 'AI_ID_SCANNING';
    case 'courses':
      return 'COURSE_MANAGEMENT';
    case 'payments':
    case 'chapa':
    case 'reminders':
    case 'approvals':
    case 'receipts':
      return 'FEE_MANAGEMENT';
    case 'accounting':
      return 'ACCOUNTING';
    case 'reports':
      return 'REPORTS';
    case 'attendance':
      return 'ATTENDANCE';
    case 'messages':
    case 'communications':
      return 'NOTIFICATIONS';
    case 'staff':
      return 'STAFF_MANAGEMENT';
    default:
      return null;
  }
}

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

function makeSlug(name: string): string {
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);
  return clean || 'institute';
}

function makeInviteToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function cleanObject<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '') {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Guarantees a prefix strictly matching Firestore rules: `^[A-Z0-9]{2,10}$`.
 */
export function sanitizeCodePrefix(raw: string | undefined, fallback = 'INS'): string {
  const cleaned = (raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
  if (cleaned.length >= 2) return cleaned;
  const cleanFallback = fallback
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
  if (cleaned.length === 1) {
    return `${cleaned}${cleanFallback.slice(0, 3) || 'IN'}`.slice(0, 10);
  }
  return cleanFallback.length >= 2 ? cleanFallback : 'INS';
}

function sanitizeRequiredString(raw: string | undefined, fallback: string, maxLen: number): string {
  const cleaned = (raw || '').trim();
  return (cleaned || fallback).slice(0, maxLen);
}

function sanitizePhone(raw: string | undefined, fallback = '+251 000 000 000'): string {
  const cleaned = (raw || '').trim();
  return (cleaned || fallback).slice(0, 30);
}

function sanitizeIsoDate(raw: string | undefined, fallback: string): string {
  const cleaned = (raw || '').trim();
  return (cleaned || fallback).slice(0, 20);
}

function sanitizeNonNegNumber(raw: unknown, fallback = 0): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function sanitizePositiveInt(raw: unknown, fallback: number, min = 1): number {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= min ? n : fallback;
}

export interface PlatformActor {
  uid: string;
  fullName: string;
  role: RoleCode;
  platformRole?: PlatformRole;
}

/**
 * Verifies the authenticated user's Firebase ID token and database-backed Super Admin /
 * Platform Admin role on the backend BEFORE executing privileged institute provisioning writes.
 */
async function verifySuperAdminBeforeProvisioning(actor: PlatformActor): Promise<PlatformActor> {
  if (actor.platformRole !== 'SUPER_ADMIN' && actor.platformRole !== 'PLATFORM_ADMIN') {
    throw new Error('Only Platform Administrators can register and provision new training institutes.');
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Your authentication session has expired. Please sign in again.');
  }
  if (currentUser.uid !== actor.uid) {
    throw new Error('Authenticated user identity mismatch. Please refresh and sign in again.');
  }

  // Ensure the Super Admin's database-backed profile exists with platformRole persisted
  let idToken: string | null = null;
  try {
    idToken = await currentUser.getIdToken();
  } catch {
    idToken = null;
  }

  if (idToken && typeof fetch === 'function') {
    try {
      const res = await fetch('/api/saas/verify-super-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (res.status === 401 || res.status === 403) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          errBody.error ||
            'Backend Super Admin authorization rejected: your account does not hold an active SUPER_ADMIN or PLATFORM_ADMIN role.'
        );
      }
      if (res.ok) {
        const verified = (await res.json()) as {
          authorized?: boolean;
          uid?: string;
          fullName?: string;
          role?: RoleCode;
          platformRole?: PlatformRole;
        };
        if (verified.authorized && verified.uid === currentUser.uid) {
          return {
            uid: verified.uid,
            fullName: sanitizeRequiredString(verified.fullName || actor.fullName, 'ZACMA Super Admin', 120),
            role: verified.role || actor.role,
            platformRole: verified.platformRole || actor.platformRole,
          };
        }
      }
    } catch (err) {
      // Propagate explicit 401/403 authorization rejections immediately
      if (
        err instanceof Error &&
        (err.message.includes('authorization') ||
          err.message.includes('Access denied') ||
          err.message.includes('SUPER_ADMIN') ||
          err.message.includes('expired') ||
          err.message.includes('deactivated'))
      ) {
        throw err;
      }
      // If local API is transiently unreachable, Firestore security rules still enforce DB-backed RBAC
      console.warn('Backend Super Admin pre-check skipped due to network error; Firestore rules remain enforced:', err);
    }
  }

  return {
    ...actor,
    fullName: sanitizeRequiredString(actor.fullName, 'ZACMA Super Admin', 120),
  };
}

/**
 * Idempotently bootstraps default ZACMA SaaS platform metadata:
 * - tenants/zacma_default (preserving all legacy ZACMA records seamlessly)
 * - subscription_plans/{free_trial, basic, professional, enterprise}
 * - platform_settings/default
 * - platform_subscriptions/sub_zacma_default
 */
export async function ensurePlatformBootstrapped(actor: PlatformActor): Promise<void> {
  if (!actor.platformRole) return;
  const now = new Date().toISOString();
  const today = todayIsoDate();

  try {
    const [defaultTenantSnap, settingsSnap, plansSnap, defaultSubSnap] = await Promise.all([
      getDoc(doc(db, 'tenants', DEFAULT_ZACMA_TENANT_ID)),
      getDoc(doc(db, 'platform_settings', 'default')),
      getDocs(collection(db, 'subscription_plans')),
      getDoc(doc(db, 'platform_subscriptions', 'sub_zacma_default')),
    ]);

    const batch = writeBatch(db);
    let ops = 0;

    if (!defaultTenantSnap.exists()) {
      const zacmaTenant: Omit<TenantRecord, 'id'> = {
        tenantId: DEFAULT_ZACMA_TENANT_ID,
        name: 'ZACMA Technology Training Institute',
        shortName: 'ZACMA Tech',
        slug: 'zacma-technology',
        businessType: 'Technology & Engineering Training Institute',
        email: 'admin@zacmatech.com',
        phone: '+251 911 000 000',
        country: 'Ethiopia',
        city: 'Addis Ababa',
        address: 'Bole Sub-City, Addis Ababa, Ethiopia',
        website: 'https://zacmatech.com',
        primaryColor: '#172DEB',
        secondaryColor: '#E51B23',
        studentIdPrefix: 'ZAC',
        staffIdPrefix: 'ZAC',
        receiptPrefix: 'ZAC-RCP',
        currency: 'ETB',
        timezone: 'Africa/Addis_Ababa',
        academicYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
        paymentMethods: ['Cash', 'CBE Birr', 'Telebirr', 'Bank Transfer', 'Check', 'Chapa'],
        defaultLanguage: 'English (Ethiopia)',
        dateFormat: 'GREGORIAN_AND_ETHIOPIAN',
        invoiceFooterNote: 'Official ZACMA Technology Training Institute Financial Document.',
        notificationEmailEnabled: true,
        notificationSmsEnabled: true,
        notificationWhatsappEnabled: false,
        emailGatewayStatus: 'CONFIGURED',
        smsGatewayStatus: 'CONFIGURED',
        whatsappGatewayStatus: 'UNCONFIGURED',
        smsSenderLabel: 'ZACMA',
        status: 'ACTIVE',
        planId: 'plan_enterprise',
        planCode: 'ENTERPRISE',
        planName: 'Enterprise Campus',
        billingCycle: 'ANNUAL',
        monthlyPriceEtb: 0,
        annualPriceEtb: 0,
        studentLimit: 10000,
        staffLimit: 500,
        storageLimitMb: 51200,
        storageUsedMb: 120,
        aiMonthlyQuota: 20000,
        aiRequestsUsed: 0,
        enabledModules: ALL_SAAS_MODULE_CODES,
        primaryAdminUid: actor.uid,
        primaryAdminName: actor.fullName,
        primaryAdminEmail: 'zekimuluken@gmail.com',
        primaryAdminPhone: '+251 911 000 000',
        primaryAdminPosition: 'Platform Founder & Director',
        subscriptionStartDate: today,
        subscriptionExpiresAt: addDaysIso(today, 3650),
        isDefaultPlatformTenant: true,
        createdBy: actor.uid,
        createdByName: actor.fullName,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(doc(db, 'tenants', DEFAULT_ZACMA_TENANT_ID), cleanObject(zacmaTenant));
      ops++;
    }

    if (!settingsSnap.exists()) {
      const { id: _id, ...settingsBody } = DEFAULT_PLATFORM_SETTINGS;
      batch.set(
        doc(db, 'platform_settings', 'default'),
        cleanObject({
          ...settingsBody,
          updatedBy: actor.uid,
          updatedByName: actor.fullName,
          updatedAt: now,
        })
      );
      ops++;
    }

    if (plansSnap.empty) {
      for (const plan of DEFAULT_SUBSCRIPTION_PLANS) {
        const { id, ...planBody } = plan;
        batch.set(
          doc(db, 'subscription_plans', id),
          cleanObject({ ...planBody, updatedAt: now })
        );
        ops++;
      }
    }

    if (!defaultSubSnap.exists()) {
      batch.set(
        doc(db, 'platform_subscriptions', 'sub_zacma_default'),
        cleanObject({
          tenantId: DEFAULT_ZACMA_TENANT_ID,
          tenantName: 'ZACMA Technology Training Institute',
          planId: 'plan_enterprise',
          planCode: 'ENTERPRISE',
          planName: 'Enterprise Campus (Platform Owner)',
          billingCycle: 'ANNUAL',
          priceEtb: 0,
          currency: 'ETB',
          status: 'ACTIVE',
          startDate: today,
          expiresAt: addDaysIso(today, 3650),
          autoRenew: true,
          notes: 'Flagship ZACMA Technology Training Institute tenant.',
          updatedBy: actor.uid,
          createdAt: now,
          updatedAt: now,
        })
      );
      ops++;
    }

    if (ops > 0) {
      await batch.commit();
    }
  } catch (error) {
    // Non-blocking bootstrap failure should not break existing portal login
    console.warn('Platform bootstrap skipped or deferred:', error);
  }
}

export interface ProvisionInstituteInput {
  // Institute Information
  name: string;
  shortName: string;
  businessType: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  website?: string;
  logoUrl?: string;
  // Admin Contact
  primaryAdminName: string;
  primaryAdminEmail: string;
  primaryAdminPhone: string;
  primaryAdminPosition: string;
  // Configuration
  studentIdPrefix: string;
  staffIdPrefix: string;
  receiptPrefix: string;
  currency: 'ETB' | 'USD' | 'KES' | 'EUR' | 'GBP';
  timezone: string;
  academicYear: string;
  paymentMethods: PaymentMethod[];
  defaultLanguage: string;
  dateFormat: 'GREGORIAN_AND_ETHIOPIAN' | 'GREGORIAN_ONLY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  primaryColor: string;
  secondaryColor: string;
  invoiceFooterNote?: string;
  notificationEmailEnabled: boolean;
  notificationSmsEnabled: boolean;
  notificationWhatsappEnabled: boolean;
  // Subscription
  planId: string;
  planCode: string;
  planName: string;
  billingCycle: BillingCycle;
  monthlyPriceEtb: number;
  quarterlyPriceEtb?: number;
  annualPriceEtb: number;
  subscriptionStartDate: string;
  trialDays: number;
  subscriptionExpiresAt: string;
  studentLimit: number;
  staffLimit: number;
  storageLimitMb: number;
  aiMonthlyQuota: number;
  enabledModules: SaasModuleCode[];
  markInitialInvoicePaid?: boolean;
  initialPaymentMethod?: 'Bank Transfer' | 'Chapa' | 'Telebirr' | 'CBE Birr' | 'Cash' | 'Check';
  initialPaymentRef?: string;
  primaryAdminUid?: string;
}

export interface ProvisionInstituteResult {
  tenantId: string;
  slug: string;
  invitationId: string;
  inviteToken: string;
  inviteUrl: string;
  invoiceNumber?: string;
}

/**
 * Atomically provisions a brand-new, isolated Training Institute tenant:
 * 1. Unique tenantId + tenants/{tenantId}
 * 2. Active/Trial platform_subscriptions/{subId}
 * 3. Initial platform_invoices/{invId} (+ platform_payments/{payId} if paid upfront)
 * 4. Tenant-scoped default payment_plans & expense_categories
 * 5. Secure tenant_invitations/{inviteId} with one-time claimable invite link
 * 6. Welcome notification & immutable audit_logs entry
 */
export async function provisionTrainingInstitute(
  input: ProvisionInstituteInput,
  actor: PlatformActor
): Promise<ProvisionInstituteResult> {
  // 1. Verify authenticated UID + database-backed Super Admin role on backend before writing
  const verifiedActor = await verifySuperAdminBeforeProvisioning(actor);

  const now = new Date().toISOString();
  const today = todayIsoDate();
  const safeName = sanitizeRequiredString(input.name, 'Training Institute', 140);
  const safeShortName = sanitizeRequiredString(input.shortName, safeName.slice(0, 28), 40);
  const slug = makeSlug(safeShortName || safeName);
  const rand4 = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  const tenantId = `inst_${slug.replace(/-/g, '_')}_${rand4}`.slice(0, 72);
  const subId = `sub_${tenantId}`;
  const inviteId = makeId('inv');
  const inviteToken = makeInviteToken();

  const safeStartDate = sanitizeIsoDate(input.subscriptionStartDate, today);
  const isTrial = input.billingCycle === 'TRIAL' || input.planCode === 'FREE_TRIAL';
  const tenantStatus: TenantStatus = isTrial ? 'TRIAL' : 'ACTIVE';
  const safeTrialDays = sanitizePositiveInt(input.trialDays, 14, 1);
  const trialEndsAt = isTrial ? addDaysIso(safeStartDate, safeTrialDays) : undefined;
  const defaultExpiry = isTrial
    ? trialEndsAt || addDaysIso(safeStartDate, 14)
    : input.billingCycle === 'ANNUAL'
    ? addDaysIso(safeStartDate, 365)
    : input.billingCycle === 'QUARTERLY'
    ? addDaysIso(safeStartDate, 90)
    : addDaysIso(safeStartDate, 30);
  const safeExpiresAt = sanitizeIsoDate(input.subscriptionExpiresAt, defaultExpiry);

  const safeMonthlyPrice = sanitizeNonNegNumber(input.monthlyPriceEtb, 0);
  const safeQuarterlyPrice = sanitizeNonNegNumber(
    input.quarterlyPriceEtb ?? Math.round(safeMonthlyPrice * 2.7),
    0
  );
  const safeAnnualPrice = sanitizeNonNegNumber(input.annualPriceEtb, 0);
  const effectivePrice = isTrial
    ? 0
    : input.billingCycle === 'ANNUAL'
    ? safeAnnualPrice
    : input.billingCycle === 'QUARTERLY'
    ? safeQuarterlyPrice
    : safeMonthlyPrice;

  const slugFallbackPrefix = slug.replace(/[^a-z0-9]/g, '').slice(0, 4).toUpperCase() || 'INS';
  const cleanStuPrefix = sanitizeCodePrefix(input.studentIdPrefix, slugFallbackPrefix);
  const cleanStfPrefix = sanitizeCodePrefix(input.staffIdPrefix, cleanStuPrefix);
  const cleanRcpPrefix = (
    (input.receiptPrefix || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 14) || `${cleanStuPrefix}-RCP`
  ).slice(0, 16);

  const safeCountry = sanitizeRequiredString(input.country, 'Ethiopia', 80);
  const safeCity = sanitizeRequiredString(input.city, 'Addis Ababa', 80);
  const safeAddress = sanitizeRequiredString(input.address, `${safeCity}, ${safeCountry}`, 240);
  const safeEmail = sanitizeRequiredString(input.email?.toLowerCase(), 'info@institute.edu.et', 160);
  const safePhone = sanitizePhone(input.phone);
  const safeAdminName = sanitizeRequiredString(input.primaryAdminName, 'Institute Administrator', 120);
  const safeAdminEmailRaw = sanitizeRequiredString(input.primaryAdminEmail, safeEmail, 160);
  const safeAdminEmailLower = safeAdminEmailRaw.toLowerCase().slice(0, 160);
  const safeAdminPhone = sanitizePhone(input.primaryAdminPhone, safePhone);
  const safeAdminPosition = sanitizeRequiredString(input.primaryAdminPosition, 'Institute Administrator', 80);
  const safePlanId = sanitizeRequiredString(input.planId, 'plan_custom', 80);
  const safePlanCode = sanitizeRequiredString(input.planCode, 'CUSTOM', 40);
  const safePlanName = sanitizeRequiredString(input.planName, 'Custom Plan', 80);
  const safeCurrency = (['ETB', 'USD', 'KES', 'EUR', 'GBP'] as const).includes(input.currency)
    ? input.currency
    : 'ETB';
  const safePaymentMethods: PaymentMethod[] =
    Array.isArray(input.paymentMethods) && input.paymentMethods.length > 0
      ? input.paymentMethods.slice(0, 10)
      : ['Cash', 'Bank Transfer', 'Telebirr', 'Chapa'];
  const safeEnabledModules: SaasModuleCode[] = Array.isArray(input.enabledModules)
    ? input.enabledModules.slice(0, 20)
    : ALL_SAAS_MODULE_CODES.slice(0, 20);

  // 2. Build Tenant Master Document (strictly matching isValidTenant in firestore.rules)
  const tenantDoc: Omit<TenantRecord, 'id'> = {
    tenantId,
    name: safeName,
    shortName: safeShortName,
    slug: slug.slice(0, 80),
    businessType: sanitizeRequiredString(input.businessType, 'Training Institute', 80),
    email: safeEmail,
    phone: safePhone,
    country: safeCountry,
    city: safeCity,
    address: safeAddress,
    website: input.website?.trim().slice(0, 200),
    logoUrl: input.logoUrl?.slice(0, 90000),
    primaryColor: sanitizeRequiredString(input.primaryColor, '#0B2545', 20),
    secondaryColor: sanitizeRequiredString(input.secondaryColor, '#D97706', 20),
    studentIdPrefix: cleanStuPrefix,
    staffIdPrefix: cleanStfPrefix,
    receiptPrefix: cleanRcpPrefix,
    currency: safeCurrency,
    timezone: sanitizeRequiredString(input.timezone, 'Africa/Addis_Ababa', 60),
    academicYear: sanitizeRequiredString(
      input.academicYear,
      `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
      30
    ),
    paymentMethods: safePaymentMethods,
    defaultLanguage: sanitizeRequiredString(input.defaultLanguage, 'English (Ethiopia)', 40),
    dateFormat: input.dateFormat || 'GREGORIAN_AND_ETHIOPIAN',
    invoiceFooterNote: sanitizeRequiredString(
      input.invoiceFooterNote,
      `Official financial document issued by ${safeName}.`,
      300
    ),
    notificationEmailEnabled: Boolean(input.notificationEmailEnabled),
    notificationSmsEnabled: Boolean(input.notificationSmsEnabled),
    notificationWhatsappEnabled: Boolean(input.notificationWhatsappEnabled),
    emailGatewayStatus: input.notificationEmailEnabled ? 'CONFIGURED' : 'UNCONFIGURED',
    smsGatewayStatus: input.notificationSmsEnabled ? 'CONFIGURED' : 'UNCONFIGURED',
    whatsappGatewayStatus: input.notificationWhatsappEnabled ? 'CONFIGURED' : 'UNCONFIGURED',
    smsSenderLabel: cleanStuPrefix.slice(0, 30),
    status: tenantStatus,
    planId: safePlanId,
    planCode: safePlanCode,
    planName: safePlanName,
    billingCycle: input.billingCycle,
    monthlyPriceEtb: safeMonthlyPrice,
    quarterlyPriceEtb: safeQuarterlyPrice,
    annualPriceEtb: safeAnnualPrice,
    studentLimit: sanitizePositiveInt(input.studentLimit, 100, 1),
    staffLimit: sanitizePositiveInt(input.staffLimit, 20, 1),
    storageLimitMb: sanitizePositiveInt(input.storageLimitMb, 2048, 128),
    storageUsedMb: 0,
    aiMonthlyQuota: sanitizeNonNegNumber(input.aiMonthlyQuota, 0),
    aiRequestsUsed: 0,
    enabledModules: safeEnabledModules,
    primaryAdminUid: input.primaryAdminUid?.trim().slice(0, 128),
    primaryAdminName: safeAdminName,
    primaryAdminEmail: safeAdminEmailLower,
    primaryAdminPhone: safeAdminPhone,
    primaryAdminPosition: safeAdminPosition,
    subscriptionStartDate: safeStartDate,
    trialEndsAt,
    subscriptionExpiresAt: safeExpiresAt,
    isDefaultPlatformTenant: false,
    createdBy: verifiedActor.uid,
    createdByName: verifiedActor.fullName.slice(0, 120),
    createdAt: now,
    updatedAt: now,
  };

  let invoiceNumber: string | undefined;

  // Phase 1: Atomic Core Provisioning Batch (Tenant + Subscription + Billing + Admin Invitation)
  // Keeping core provisioning in a dedicated small batch avoids hitting Firestore's 20 get()/exists()
  // security-rule budget per batch and ensures exact failure diagnostics.
  try {
    const coreBatch = writeBatch(db);
    coreBatch.set(doc(db, 'tenants', tenantId), cleanObject(tenantDoc));

    coreBatch.set(
      doc(db, 'platform_subscriptions', subId),
      cleanObject({
        tenantId,
        tenantName: safeName,
        planId: safePlanId,
        planCode: safePlanCode,
        planName: safePlanName,
        billingCycle: input.billingCycle,
        priceEtb: effectivePrice,
        currency: safeCurrency,
        status: isTrial ? 'TRIAL' : 'ACTIVE',
        startDate: safeStartDate,
        trialEndsAt,
        expiresAt: safeExpiresAt,
        autoRenew: true,
        updatedBy: verifiedActor.uid,
        createdAt: now,
        updatedAt: now,
      })
    );

    if (effectivePrice > 0) {
      const invId = makeId('pinv');
      invoiceNumber = `ZAC-INV-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`.slice(
        0,
        40
      );
      const isPaidNow = Boolean(input.markInitialInvoicePaid);
      const payRef = sanitizeRequiredString(
        input.initialPaymentRef,
        `ZAC-SUB-${Date.now().toString().slice(-6)}`,
        80
      );

      coreBatch.set(
        doc(db, 'platform_invoices', invId),
        cleanObject({
          invoiceNumber,
          tenantId,
          tenantName: safeName,
          subscriptionId: subId,
          planName: safePlanName,
          billingCycle: input.billingCycle,
          amountEtb: effectivePrice,
          currency: safeCurrency,
          dueDate: addDaysIso(safeStartDate, 7),
          status: isPaidNow ? 'PAID' : 'PENDING',
          paidAt: isPaidNow ? now : undefined,
          paymentRef: isPaidNow ? payRef : undefined,
          notes: `Initial ${input.billingCycle.toLowerCase()} SaaS subscription invoice for ${safeName}.`.slice(
            0,
            400
          ),
          issuedBy: verifiedActor.uid,
          issuedByName: verifiedActor.fullName.slice(0, 120),
          createdAt: now,
          updatedAt: now,
        })
      );

      if (isPaidNow) {
        const payId = makeId('ppay');
        coreBatch.set(
          doc(db, 'platform_payments', payId),
          cleanObject({
            paymentRef: payRef,
            invoiceId: invId,
            invoiceNumber,
            tenantId,
            tenantName: safeName,
            planName: safePlanName,
            amountEtb: effectivePrice,
            currency: safeCurrency,
            paymentDate: today,
            paymentMethod: input.initialPaymentMethod || 'Bank Transfer',
            status: 'COMPLETED',
            recordedBy: verifiedActor.uid,
            recordedByName: verifiedActor.fullName.slice(0, 120),
            notes: 'Collected at institute provisioning.',
            createdAt: now,
          })
        );
      }
    }

    coreBatch.set(
      doc(db, 'tenant_invitations', inviteId),
      cleanObject({
        token: inviteToken,
        tenantId,
        tenantName: safeName,
        email: safeAdminEmailRaw,
        emailLower: safeAdminEmailLower,
        fullName: safeAdminName,
        phone: safeAdminPhone,
        position: safeAdminPosition,
        role: 'ADMIN',
        status: 'PENDING',
        expiresAt: addDaysIso(today, 30),
        createdBy: verifiedActor.uid,
        createdByName: verifiedActor.fullName.slice(0, 120),
        createdAt: now,
        updatedAt: now,
      })
    );

    await coreBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `tenants/${tenantId}`);
  }

  // Phase 2: Tenant Workspace Defaults Batch (Payment Plans + Expense Categories + Departments + Welcome Notification + Audit Log)
  try {
    const workspaceBatch = writeBatch(db);

    const defaultPlans = [
      { code: 'FULL', name: 'Full Payment (Upfront)', installmentCount: 1, intervalDays: 0, description: 'Single 100% payment upon enrollment.' },
      { code: 'MONTHLY', name: 'Monthly Installment (3x)', installmentCount: 3, intervalDays: 30, description: 'Three equal monthly installments.' },
      { code: 'TWO_MONTH', name: 'Bi-Monthly Plan (2x)', installmentCount: 2, intervalDays: 60, description: 'Two equal payments every 60 days.' },
      { code: 'CUSTOM', name: 'Custom Installment Schedule', installmentCount: 2, intervalDays: 30, description: 'Flexible custom installment count and interval.' },
    ];
    for (const p of defaultPlans) {
      workspaceBatch.set(doc(db, 'payment_plans', `${tenantId}_plan_${p.code.toLowerCase()}`), {
        tenantId,
        ...p,
        isActive: true,
      });
    }

    const defaultCategories = [
      { key: 'salaries', name: 'Instructor & Staff Salaries', description: 'Monthly payroll and trainer stipends.' },
      { key: 'rent', name: 'Campus Rent & Facilities', description: 'Classrooms, labs, and administrative offices.' },
      { key: 'utilities', name: 'Utilities & Internet', description: 'Electricity, water, fiber internet, and telecom.' },
      { key: 'equipment', name: 'Lab Equipment & Supplies', description: 'Training computers, tools, and consumables.' },
      { key: 'marketing', name: 'Marketing & Admissions', description: 'Digital campaigns and enrollment outreach.' },
    ];
    for (const c of defaultCategories) {
      workspaceBatch.set(doc(db, 'expense_categories', `${tenantId}_cat_${c.key}`), {
        tenantId,
        name: c.name,
        description: c.description,
        isActive: true,
      });
    }

    const defaultDepartments = [
      { code: 'TECH', name: 'Technology & Computing', description: 'Software, IT, and digital skills programs.' },
      { code: 'BUS', name: 'Business & Management', description: 'Accounting, entrepreneurship, and leadership tracks.' },
      { code: 'VOC', name: 'Vocational & Technical Trades', description: 'Hands-on engineering and practical certifications.' },
    ];
    for (const dept of defaultDepartments) {
      workspaceBatch.set(doc(db, 'departments', `${tenantId}_dept_${dept.code.toLowerCase()}`), {
        tenantId,
        code: dept.code,
        name: dept.name,
        description: dept.description,
        isActive: true,
        createdBy: verifiedActor.uid,
        createdAt: now,
        updatedAt: now,
      });
    }

    workspaceBatch.set(
      doc(db, 'notifications', makeId('not_welcome')),
      cleanObject({
        tenantId,
        type: 'INSTITUTE_PROVISIONED',
        title: `Welcome to ${safeName} Portal`.slice(0, 140),
        message: `Your independent training institute portal (${tenantId}) has been provisioned on the ${safePlanName} plan. Configure your courses, staff, and branding to begin.`.slice(
          0,
          420
        ),
        targetRole: 'ADMIN',
        entityType: 'tenant',
        entityId: tenantId,
        isRead: false,
        createdAt: now,
      })
    );

    workspaceBatch.set(
      doc(db, 'audit_logs', makeId('aud_prov')),
      cleanObject({
        tenantId,
        actorId: verifiedActor.uid,
        actorName: verifiedActor.fullName.slice(0, 120),
        actorRole: verifiedActor.role,
        actorPlatformRole: verifiedActor.platformRole,
        action: 'INSTITUTE_PROVISIONED',
        entityType: 'tenant',
        entityId: tenantId,
        summary: `Provisioned training institute "${safeName}" (${tenantId}) on ${safePlanName} (${tenantStatus}). Admin invite issued for ${safeAdminEmailLower}.`.slice(
          0,
          400
        ),
        result: 'SUCCESS',
        createdAt: now,
      })
    );

    await workspaceBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `workspace_init/${tenantId}`);
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const inviteUrl = `${origin}/?invite=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(safeAdminEmailLower)}&tenant=${encodeURIComponent(safeName)}`;

  return {
    tenantId,
    slug,
    invitationId: inviteId,
    inviteToken,
    inviteUrl,
    invoiceNumber,
  };
}

export async function updateTenantBySuperAdmin(
  tenantId: string,
  updates: Partial<TenantRecord>,
  actor: PlatformActor,
  auditSummary?: string
): Promise<void> {
  const now = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    const { id: _id, tenantId: _tid, ...safeUpdates } = updates as Record<string, unknown>;
    batch.update(doc(db, 'tenants', tenantId), {
      ...safeUpdates,
      updatedAt: now,
    });
    batch.set(doc(db, 'audit_logs', makeId('aud_ten_upd')), {
      tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'TENANT_UPDATED',
      entityType: 'tenant',
      entityId: tenantId,
      summary: auditSummary || `Updated configuration for institute ${tenantId}.`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tenants/${tenantId}`);
  }
}

export async function suspendTenant(
  tenant: TenantRecord,
  reason: string,
  actor: PlatformActor
): Promise<void> {
  if (tenant.tenantId === DEFAULT_ZACMA_TENANT_ID) {
    throw new Error('The primary ZACMA Platform Owner tenant cannot be suspended.');
  }
  const cleanReason = reason.trim().slice(0, 260) || 'Administrative suspension by ZACMA Platform Owner.';
  const now = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'tenants', tenant.id), {
      status: 'SUSPENDED',
      suspendedReason: cleanReason,
      suspendedAt: now,
      updatedAt: now,
    });
    batch.set(doc(db, 'audit_logs', makeId('aud_susp')), {
      tenantId: tenant.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'TENANT_SUSPENDED',
      entityType: 'tenant',
      entityId: tenant.tenantId,
      summary: `Suspended institute "${tenant.name}" (${tenant.tenantId}): ${cleanReason}`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tenants/${tenant.id}`);
  }
}

export async function reactivateTenant(
  tenant: TenantRecord,
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'tenants', tenant.id), {
      status: 'ACTIVE',
      suspendedReason: '',
      suspendedAt: '',
      updatedAt: now,
    });
    batch.set(doc(db, 'audit_logs', makeId('aud_react')), {
      tenantId: tenant.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'TENANT_REACTIVATED',
      entityType: 'tenant',
      entityId: tenant.tenantId,
      summary: `Reactivated institute "${tenant.name}" (${tenant.tenantId}).`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tenants/${tenant.id}`);
  }
}

export async function updateTenantModules(
  tenant: TenantRecord,
  enabledModules: SaasModuleCode[],
  actor: PlatformActor
): Promise<void> {
  await updateTenantBySuperAdmin(
    tenant.id,
    { enabledModules },
    actor,
    `Updated enabled SaaS modules for ${tenant.name} (${enabledModules.length}/${ALL_SAAS_MODULE_CODES.length} active).`
  );
}

export async function updateTenantLimits(
  tenant: TenantRecord,
  limits: {
    studentLimit: number;
    staffLimit: number;
    storageLimitMb: number;
    aiMonthlyQuota: number;
  },
  actor: PlatformActor
): Promise<void> {
  await updateTenantBySuperAdmin(
    tenant.id,
    limits,
    actor,
    `Updated usage quotas for ${tenant.name}: Students=${limits.studentLimit}, Staff=${limits.staffLimit}, Storage=${limits.storageLimitMb}MB, AI=${limits.aiMonthlyQuota}/mo.`
  );
}

export async function upgradeOrExtendSubscription(
  tenant: TenantRecord,
  existingSub: PlatformSubscription | undefined,
  input: {
    plan: SubscriptionPlan;
    billingCycle: BillingCycle;
    newExpiresAt: string;
    applyPlanModulesAndLimits: boolean;
    generateInvoice: boolean;
    notes?: string;
  },
  actor: PlatformActor
): Promise<{ invoiceNumber?: string }> {
  const now = new Date().toISOString();
  const subId = existingSub?.id || `sub_${tenant.tenantId}`;
  const isTrial = input.billingCycle === 'TRIAL' || input.plan.code === 'FREE_TRIAL';
  const priceEtb = isTrial
    ? 0
    : input.billingCycle === 'ANNUAL'
    ? input.plan.annualPriceEtb
    : input.billingCycle === 'QUARTERLY'
    ? input.plan.quarterlyPriceEtb ?? Math.round(input.plan.monthlyPriceEtb * 2.7)
    : input.plan.monthlyPriceEtb;

  try {
    const batch = writeBatch(db);

    const tenantPatch: Record<string, unknown> = {
      status: isTrial ? 'TRIAL' : 'ACTIVE',
      planId: input.plan.id,
      planCode: input.plan.code,
      planName: input.plan.name,
      billingCycle: input.billingCycle,
      monthlyPriceEtb: input.plan.monthlyPriceEtb,
      quarterlyPriceEtb: input.plan.quarterlyPriceEtb ?? Math.round(input.plan.monthlyPriceEtb * 2.7),
      annualPriceEtb: input.plan.annualPriceEtb,
      subscriptionExpiresAt: input.newExpiresAt,
      updatedAt: now,
    };

    if (input.applyPlanModulesAndLimits) {
      tenantPatch.studentLimit = input.plan.studentLimit;
      tenantPatch.staffLimit = input.plan.staffLimit;
      tenantPatch.storageLimitMb = input.plan.storageLimitMb;
      tenantPatch.aiMonthlyQuota = input.plan.aiMonthlyQuota;
      tenantPatch.enabledModules = input.plan.includedModules;
    }

    batch.update(doc(db, 'tenants', tenant.id), tenantPatch);

    batch.set(
      doc(db, 'platform_subscriptions', subId),
      cleanObject({
        tenantId: tenant.tenantId,
        tenantName: tenant.name,
        planId: input.plan.id,
        planCode: input.plan.code,
        planName: input.plan.name,
        billingCycle: input.billingCycle,
        priceEtb,
        currency: tenant.currency || 'ETB',
        status: isTrial ? 'TRIAL' : 'ACTIVE',
        startDate: existingSub?.startDate || todayIsoDate(),
        expiresAt: input.newExpiresAt,
        autoRenew: existingSub?.autoRenew ?? true,
        notes: input.notes?.trim().slice(0, 300),
        updatedBy: actor.uid,
        createdAt: existingSub?.createdAt || now,
        updatedAt: now,
      })
    );

    let invoiceNumber: string | undefined;
    if (input.generateInvoice && priceEtb > 0) {
      const invId = makeId('pinv');
      invoiceNumber = `ZAC-INV-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
      batch.set(
        doc(db, 'platform_invoices', invId),
        cleanObject({
          invoiceNumber,
          tenantId: tenant.tenantId,
          tenantName: tenant.name,
          subscriptionId: subId,
          planName: input.plan.name,
          billingCycle: input.billingCycle,
          amountEtb: priceEtb,
          currency: tenant.currency || 'ETB',
          dueDate: addDaysIso(todayIsoDate(), 7),
          status: 'PENDING',
          notes: input.notes?.trim().slice(0, 300) || `Subscription renewal/upgrade to ${input.plan.name}.`,
          issuedBy: actor.uid,
          issuedByName: actor.fullName.slice(0, 120),
          createdAt: now,
          updatedAt: now,
        })
      );
    }

    batch.set(doc(db, 'audit_logs', makeId('aud_sub_upd')), {
      tenantId: tenant.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'SUBSCRIPTION_UPDATED',
      entityType: 'platform_subscription',
      entityId: subId,
      summary: `Updated subscription for ${tenant.name} to ${input.plan.name} (${input.billingCycle}) valid until ${input.newExpiresAt}.`,
      result: 'SUCCESS',
      createdAt: now,
    });

    await batch.commit();
    return { invoiceNumber };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `platform_subscriptions/${subId}`);
  }
}

export async function saveSubscriptionPlan(
  plan: Omit<SubscriptionPlan, 'updatedAt'>,
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  const planId = plan.id || makeId('plan');
  try {
    const batch = writeBatch(db);
    const { id: _id, ...body } = plan;
    batch.set(doc(db, 'subscription_plans', planId), {
      ...body,
      updatedAt: now,
    });
    batch.set(doc(db, 'audit_logs', makeId('aud_plan')), {
      tenantId: DEFAULT_ZACMA_TENANT_ID,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'SUBSCRIPTION_PLAN_SAVED',
      entityType: 'subscription_plan',
      entityId: planId,
      summary: `Saved SaaS plan "${plan.name}" (${plan.code}) — Monthly ETB ${plan.monthlyPriceEtb.toLocaleString()}, Annual ETB ${plan.annualPriceEtb.toLocaleString()}.`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `subscription_plans/${planId}`);
  }
}

export async function createPlatformInvoice(
  input: {
    tenant: TenantRecord;
    subscriptionId?: string;
    planName: string;
    billingCycle: BillingCycle;
    amountEtb: number;
    dueDate: string;
    notes?: string;
  },
  actor: PlatformActor
): Promise<string> {
  const now = new Date().toISOString();
  const invId = makeId('pinv');
  const invoiceNumber = `ZAC-INV-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'platform_invoices', invId),
      cleanObject({
        invoiceNumber,
        tenantId: input.tenant.tenantId,
        tenantName: input.tenant.name,
        subscriptionId: input.subscriptionId || `sub_${input.tenant.tenantId}`,
        planName: input.planName,
        billingCycle: input.billingCycle,
        amountEtb: Number(input.amountEtb),
        currency: input.tenant.currency || 'ETB',
        dueDate: input.dueDate,
        status: 'PENDING',
        notes: input.notes?.trim().slice(0, 300),
        issuedBy: actor.uid,
        issuedByName: actor.fullName.slice(0, 120),
        createdAt: now,
        updatedAt: now,
      })
    );
    batch.set(doc(db, 'audit_logs', makeId('aud_pinv')), {
      tenantId: input.tenant.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'PLATFORM_INVOICE_ISSUED',
      entityType: 'platform_invoice',
      entityId: invId,
      summary: `Issued platform invoice ${invoiceNumber} for ${input.tenant.name} — ETB ${input.amountEtb.toLocaleString()}.`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
    return invoiceNumber;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'platform_invoices');
  }
}

export async function recordPlatformPayment(
  input: {
    tenant: TenantRecord;
    invoice?: PlatformInvoice;
    planName: string;
    amountEtb: number;
    paymentDate: string;
    paymentMethod: 'Bank Transfer' | 'Chapa' | 'Telebirr' | 'CBE Birr' | 'Cash' | 'Check';
    paymentRef: string;
    notes?: string;
  },
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  const payId = makeId('ppay');
  const cleanRef = input.paymentRef.trim() || `ZAC-SUB-${Date.now().toString().slice(-6)}`;
  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'platform_payments', payId),
      cleanObject({
        paymentRef: cleanRef,
        invoiceId: input.invoice?.id,
        invoiceNumber: input.invoice?.invoiceNumber,
        tenantId: input.tenant.tenantId,
        tenantName: input.tenant.name,
        planName: input.planName,
        amountEtb: Number(input.amountEtb),
        currency: input.tenant.currency || 'ETB',
        paymentDate: input.paymentDate,
        paymentMethod: input.paymentMethod,
        status: 'COMPLETED',
        recordedBy: actor.uid,
        recordedByName: actor.fullName.slice(0, 120),
        notes: input.notes?.trim().slice(0, 300),
        createdAt: now,
      })
    );

    if (input.invoice) {
      batch.update(doc(db, 'platform_invoices', input.invoice.id), {
        status: 'PAID',
        paidAt: now,
        paymentRef: cleanRef,
        updatedAt: now,
      });
    }

    batch.set(doc(db, 'audit_logs', makeId('aud_ppay')), {
      tenantId: input.tenant.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'PLATFORM_PAYMENT_RECORDED',
      entityType: 'platform_payment',
      entityId: payId,
      summary: `Recorded platform subscription payment ${cleanRef} from ${input.tenant.name} — ETB ${input.amountEtb.toLocaleString()} (${input.paymentMethod}).`,
      result: 'SUCCESS',
      createdAt: now,
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'platform_payments');
  }
}

export async function sendSubscriptionExpiryReminder(
  tenant: TenantRecord,
  subscription: PlatformSubscription | undefined,
  message: string,
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'notifications', makeId('not_sub_exp')), {
      tenantId: tenant.tenantId,
      type: 'SUBSCRIPTION_EXPIRING',
      title: `Subscription Renewal Notice — ${tenant.planName}`,
      message: message.trim().slice(0, 480),
      targetRole: 'ADMIN',
      entityType: 'platform_subscription',
      entityId: subscription?.id || `sub_${tenant.tenantId}`,
      isRead: false,
      createdAt: now,
    });
    if (subscription) {
      batch.update(doc(db, 'platform_subscriptions', subscription.id), {
        lastReminderSentAt: now,
        updatedAt: now,
      });
    }
    batch.set(doc(db, 'audit_logs', makeId('aud_rem')), {
      tenantId: tenant.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'SUBSCRIPTION_REMINDER_SENT',
      entityType: 'tenant',
      entityId: tenant.tenantId,
      summary: `Sent subscription renewal reminder to ${tenant.name} (expires ${tenant.subscriptionExpiresAt}).`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'notifications');
  }
}

export async function createTenantInvitation(
  input: {
    tenant: TenantRecord;
    email: string;
    fullName: string;
    phone?: string;
    position?: string;
    role: RoleCode;
  },
  actor: PlatformActor
): Promise<{ inviteId: string; inviteUrl: string }> {
  const now = new Date().toISOString();
  const inviteId = makeId('inv');
  const token = makeInviteToken();
  const emailLower = input.email.trim().toLowerCase();

  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'tenant_invitations', inviteId),
      cleanObject({
        token,
        tenantId: input.tenant.tenantId,
        tenantName: input.tenant.name,
        email: input.email.trim(),
        emailLower,
        fullName: input.fullName.trim().slice(0, 120),
        phone: input.phone?.trim().slice(0, 32),
        position: input.position?.trim().slice(0, 80),
        role: input.role,
        status: 'PENDING',
        expiresAt: addDaysIso(todayIsoDate(), 30),
        createdBy: actor.uid,
        createdByName: actor.fullName.slice(0, 120),
        createdAt: now,
        updatedAt: now,
      })
    );
    batch.set(doc(db, 'audit_logs', makeId('aud_inv')), {
      tenantId: input.tenant.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'TENANT_INVITATION_CREATED',
      entityType: 'tenant_invitation',
      entityId: inviteId,
      summary: `Issued ${input.role} invitation for ${emailLower} to join ${input.tenant.name}.`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${origin}/?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(emailLower)}&tenant=${encodeURIComponent(input.tenant.name)}`;
    return { inviteId, inviteUrl };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'tenant_invitations');
  }
}

export async function revokeTenantInvitation(
  invitation: TenantInvitation,
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'tenant_invitations', invitation.id), {
      status: 'REVOKED',
      updatedAt: now,
    });
    await setDoc(doc(db, 'audit_logs', makeId('aud_inv_rev')), {
      tenantId: invitation.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'TENANT_INVITATION_REVOKED',
      entityType: 'tenant_invitation',
      entityId: invitation.id,
      summary: `Revoked pending invitation for ${invitation.email} (${invitation.tenantName}).`,
      result: 'SUCCESS',
      createdAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tenant_invitations/${invitation.id}`);
  }
}

export async function startSupportAccessSession(
  tenant: TenantRecord,
  reason: string,
  durationMinutes: number,
  actor: PlatformActor
): Promise<SupportAccessSession> {
  if (!actor.platformRole) {
    throw new Error('Only authorized ZACMA platform personnel can initiate a support access session.');
  }
  const cleanReason = reason.trim().slice(0, 260);
  if (cleanReason.length < 5) {
    throw new Error('Please provide a clear support reason (at least 5 characters) for the audit trail.');
  }
  const safeMins = Math.max(5, Math.min(120, Math.round(durationMinutes || 30)));
  const now = new Date();
  const startedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + safeMins * 60_000).toISOString();
  const sessionId = makeId('sup');

  const session: SupportAccessSession = {
    id: sessionId,
    tenantId: tenant.tenantId,
    tenantName: tenant.name,
    actorUid: actor.uid,
    actorName: actor.fullName,
    actorPlatformRole: actor.platformRole,
    reason: cleanReason,
    status: 'ACTIVE',
    startedAt,
    expiresAt,
  };

  try {
    const batch = writeBatch(db);
    const { id: _id, ...body } = session;
    batch.set(doc(db, 'support_access_sessions', sessionId), body);
    batch.set(doc(db, 'notifications', makeId('not_sup')), {
      tenantId: tenant.tenantId,
      type: 'SUPPORT_SESSION_STARTED',
      title: `Authorized ZACMA Support Access Started`,
      message: `${actor.fullName} (${PLATFORM_ROLE_LABELS[actor.platformRole]}) opened a ${safeMins}-minute audited support session. Reason: ${cleanReason}`,
      targetRole: 'ADMIN',
      entityType: 'support_access_session',
      entityId: sessionId,
      isRead: false,
      createdAt: startedAt,
    });
    batch.set(doc(db, 'audit_logs', makeId('aud_sup_start')), {
      tenantId: tenant.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'SUPPORT_ACCESS_STARTED',
      entityType: 'support_access_session',
      entityId: sessionId,
      summary: `Started ${safeMins}-min authorized support session for ${tenant.name} (${tenant.tenantId}). Reason: ${cleanReason}`,
      result: 'SUCCESS',
      createdAt: startedAt,
    });
    await batch.commit();
    return session;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'support_access_sessions');
  }
}

export async function endSupportAccessSession(
  session: SupportAccessSession,
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'support_access_sessions', session.id), {
      status: 'ENDED',
      endedAt: now,
    });
    batch.set(doc(db, 'audit_logs', makeId('aud_sup_end')), {
      tenantId: session.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'SUPPORT_ACCESS_ENDED',
      entityType: 'support_access_session',
      entityId: session.id,
      summary: `Ended authorized support session for ${session.tenantName} (${session.tenantId}).`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `support_access_sessions/${session.id}`);
  }
}

export async function updateGlobalPlatformSettings(
  settings: Omit<PlatformGlobalSettings, 'id' | 'updatedAt' | 'updatedBy' | 'updatedByName'>,
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'platform_settings', 'default'),
      cleanObject({
        ...settings,
        updatedBy: actor.uid,
        updatedByName: actor.fullName.slice(0, 120),
        updatedAt: now,
      })
    );
    batch.set(doc(db, 'audit_logs', makeId('aud_gset')), {
      tenantId: DEFAULT_ZACMA_TENANT_ID,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'PLATFORM_SETTINGS_UPDATED',
      entityType: 'platform_settings',
      entityId: 'default',
      summary: `Updated global SaaS settings (Trial ${settings.defaultTrialDays}d, Grace ${settings.gracePeriodDays}d, Auto-Suspend ${settings.autoSuspendExpiredDays}d).`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'platform_settings/default');
  }
}

export async function updateUserPlatformRole(
  targetProfile: StaffProfile,
  newPlatformRole: PlatformRole | null,
  actor: PlatformActor
): Promise<void> {
  if (actor.platformRole !== 'SUPER_ADMIN') {
    throw new Error('Only a Platform Super Admin can assign or revoke platform-level roles.');
  }
  const now = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    const updatePayload: Record<string, unknown> = {
      updatedAt: now,
    };
    if (newPlatformRole) {
      updatePayload.platformRole = newPlatformRole;
    } else {
      updatePayload.platformRole = '';
    }
    batch.update(doc(db, 'profiles', targetProfile.id), updatePayload);
    batch.set(doc(db, 'audit_logs', makeId('aud_prole')), {
      tenantId: targetProfile.tenantId || DEFAULT_ZACMA_TENANT_ID,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'PLATFORM_ROLE_UPDATED',
      entityType: 'profile',
      entityId: targetProfile.id,
      summary: newPlatformRole
        ? `Assigned platform role ${newPlatformRole} to ${targetProfile.fullName} (${targetProfile.email}).`
        : `Revoked platform role from ${targetProfile.fullName} (${targetProfile.email}).`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `profiles/${targetProfile.id}`);
  }
}

export async function createSupportTicket(
  input: {
    tenantId: string;
    tenantName: string;
    subject: string;
    category: SupportTicket['category'];
    priority: SupportTicket['priority'];
    description: string;
  },
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  const ticketId = makeId('tkt');
  try {
    await setDoc(doc(db, 'support_tickets', ticketId), {
      tenantId: input.tenantId,
      tenantName: input.tenantName,
      subject: input.subject.trim().slice(0, 160),
      category: input.category,
      priority: input.priority,
      status: 'OPEN',
      description: input.description.trim().slice(0, 1500),
      createdBy: actor.uid,
      createdByName: actor.fullName.slice(0, 120),
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'support_tickets');
  }
}

export async function updateSupportTicket(
  ticketId: string,
  updates: {
    status: SupportTicket['status'];
    assignedToName?: string;
    resolutionNotes?: string;
  },
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await updateDoc(
      doc(db, 'support_tickets', ticketId),
      cleanObject({
        status: updates.status,
        assignedToName: updates.assignedToName || actor.fullName,
        resolutionNotes: updates.resolutionNotes?.trim().slice(0, 1000),
        updatedAt: now,
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `support_tickets/${ticketId}`);
  }
}

/**
 * Institute Admin self-service branding & operational settings update.
 * Enforced by firestore.rules to allow ONLY non-billing branding/operational keys.
 */
export async function updateOwnInstituteBranding(
  tenantId: string,
  updates: {
    name: string;
    shortName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    website?: string;
    logoUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    studentIdPrefix: string;
    staffIdPrefix: string;
    receiptPrefix: string;
    currency: 'ETB' | 'USD' | 'KES' | 'EUR' | 'GBP';
    timezone: string;
    academicYear: string;
    paymentMethods: PaymentMethod[];
    defaultLanguage: string;
    dateFormat: TenantRecord['dateFormat'];
    invoiceFooterNote?: string;
    notificationEmailEnabled: boolean;
    notificationSmsEnabled: boolean;
    notificationWhatsappEnabled: boolean;
    emailGatewayStatus: 'CONFIGURED' | 'UNCONFIGURED';
    smsGatewayStatus: 'CONFIGURED' | 'UNCONFIGURED';
    whatsappGatewayStatus: 'CONFIGURED' | 'UNCONFIGURED';
    smsSenderLabel?: string;
  },
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    const safeStuPrefix = sanitizeCodePrefix(updates.studentIdPrefix, 'STU');
    const safeStfPrefix = sanitizeCodePrefix(updates.staffIdPrefix, safeStuPrefix);
    batch.update(doc(db, 'tenants', tenantId), {
      name: sanitizeRequiredString(updates.name, 'Training Institute', 140),
      shortName: sanitizeRequiredString(updates.shortName, updates.name.trim().slice(0, 28), 40),
      email: sanitizeRequiredString(updates.email.toLowerCase(), 'info@institute.edu.et', 160),
      phone: sanitizePhone(updates.phone),
      address: sanitizeRequiredString(updates.address, `${updates.city || 'Addis Ababa'}, ${updates.country || 'Ethiopia'}`, 240),
      city: sanitizeRequiredString(updates.city, 'Addis Ababa', 80),
      country: sanitizeRequiredString(updates.country, 'Ethiopia', 80),
      website: updates.website?.trim().slice(0, 200) || '',
      logoUrl: updates.logoUrl?.slice(0, 90000) || '',
      primaryColor: sanitizeRequiredString(updates.primaryColor, '#0B2545', 20),
      secondaryColor: sanitizeRequiredString(updates.secondaryColor, '#D97706', 20),
      studentIdPrefix: safeStuPrefix,
      staffIdPrefix: safeStfPrefix,
      receiptPrefix: (
        updates.receiptPrefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 14) ||
        `${safeStuPrefix}-RCP`
      ).slice(0, 16),
      currency: updates.currency,
      timezone: sanitizeRequiredString(updates.timezone, 'Africa/Addis_Ababa', 60),
      academicYear: sanitizeRequiredString(updates.academicYear, `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`, 30),
      paymentMethods: updates.paymentMethods.slice(0, 10),
      defaultLanguage: sanitizeRequiredString(updates.defaultLanguage, 'English (Ethiopia)', 40),
      dateFormat: updates.dateFormat,
      invoiceFooterNote: updates.invoiceFooterNote?.trim().slice(0, 300) || '',
      notificationEmailEnabled: updates.notificationEmailEnabled,
      notificationSmsEnabled: updates.notificationSmsEnabled,
      notificationWhatsappEnabled: updates.notificationWhatsappEnabled,
      emailGatewayStatus: updates.emailGatewayStatus,
      smsGatewayStatus: updates.smsGatewayStatus,
      whatsappGatewayStatus: updates.whatsappGatewayStatus,
      smsSenderLabel: updates.smsSenderLabel?.trim().slice(0, 30) || '',
      updatedAt: now,
    });
    batch.set(
      doc(db, 'audit_logs', makeId('aud_brand')),
      cleanObject({
        tenantId,
        actorId: actor.uid,
        actorName: sanitizeRequiredString(actor.fullName, 'Institute Admin', 120),
        actorRole: actor.role,
        actorPlatformRole: actor.platformRole,
        action: 'INSTITUTE_BRANDING_UPDATED',
        entityType: 'tenant',
        entityId: tenantId,
        summary: `Updated branding and portal configuration for ${updates.name.trim()}.`.slice(0, 400),
        result: 'SUCCESS',
        createdAt: now,
      })
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tenants/${tenantId}`);
  }
}

export interface LegacyMigrationResult {
  totalUpdated: number;
  byCollection: Record<string, number>;
  completedAt: string;
}

/**
 * Safely stamps `tenantId: 'zacma_default'` on any pre-existing ZACMA documents
 * that were created prior to the multi-tenant SaaS upgrade. Non-destructive.
 */
export async function migrateLegacyZacmaRecordsToTenant(
  actor: PlatformActor
): Promise<LegacyMigrationResult> {
  if (actor.platformRole !== 'SUPER_ADMIN' && actor.platformRole !== 'PLATFORM_ADMIN') {
    throw new Error('Only Super Admins can execute legacy tenant migration.');
  }

  const targetCollections = [
    'profiles',
    'courses',
    'payment_plans',
    'students',
    'enrollments',
    'payment_installments',
    'payments',
    'expense_categories',
    'expenses',
    'attendance',
    'notifications',
    'chapa_transactions',
    'staff_records',
    'staff_compensation',
    'identity_documents',
    'directory_users',
    'conversations',
    'sms_logs',
  ];

  const byCollection: Record<string, number> = {};
  let totalUpdated = 0;

  for (const colName of targetCollections) {
    try {
      const snap = await getDocs(collection(db, colName));
      const docsToPatch = snap.docs.filter((d) => !d.data().tenantId);
      if (docsToPatch.length === 0) {
        byCollection[colName] = 0;
        continue;
      }

      // Commit in chunks of 400
      for (let i = 0; i < docsToPatch.length; i += 400) {
        const chunk = docsToPatch.slice(i, i + 400);
        const batch = writeBatch(db);
        for (const d of chunk) {
          batch.update(doc(db, colName, d.id), { tenantId: DEFAULT_ZACMA_TENANT_ID });
        }
        await batch.commit();
      }
      byCollection[colName] = docsToPatch.length;
      totalUpdated += docsToPatch.length;
    } catch {
      byCollection[colName] = 0;
    }
  }

  const completedAt = new Date().toISOString();
  try {
    await setDoc(doc(db, 'schema_migrations', `mig_multitenant_${Date.now()}`), {
      version: '3.0.0-saas',
      name: 'Legacy ZACMA Multi-Tenant Tagging (zacma_default)',
      appliedAt: completedAt,
      appliedBy: actor.fullName,
      status: 'APPLIED',
      notes: `Stamped tenantId='zacma_default' onto ${totalUpdated} pre-existing ZACMA documents.`,
    });
    await setDoc(doc(db, 'audit_logs', makeId('aud_mig')), {
      tenantId: DEFAULT_ZACMA_TENANT_ID,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'LEGACY_TENANT_MIGRATION_COMPLETED',
      entityType: 'schema_migration',
      entityId: DEFAULT_ZACMA_TENANT_ID,
      summary: `Tagged ${totalUpdated} legacy ZACMA records with tenantId='zacma_default'. Zero records removed.`,
      result: 'SUCCESS',
      createdAt: completedAt,
    });
  } catch {
    // Non-fatal
  }

  return { totalUpdated, byCollection, completedAt };
}

/**
 * Generates and downloads a multi-sheet Platform Executive Analytics Workbook (.xlsx)
 * with strictly separated Platform Subscription Revenue vs Institute Tuition Overview.
 */
export function exportPlatformAnalyticsWorkbook(params: {
  tenants: TenantRecord[];
  subscriptions: PlatformSubscription[];
  invoices: PlatformInvoice[];
  platformPayments: PlatformPayment[];
  allStudents: Student[];
  allStaffRecords: StaffRecord[];
  auditLogs: AuditLog[];
}): void {
  const wb = XLSX.utils.book_new();

  const tenantRows = params.tenants.map((t) => {
    const stuCount = params.allStudents.filter(
      (s) => (s.tenantId || DEFAULT_ZACMA_TENANT_ID) === t.tenantId
    ).length;
    const stfCount = params.allStaffRecords.filter(
      (s) => (s.tenantId || DEFAULT_ZACMA_TENANT_ID) === t.tenantId
    ).length;
    return {
      'Tenant ID': t.tenantId,
      'Institute Name': t.name,
      Status: t.status,
      Plan: t.planName,
      'Billing Cycle': t.billingCycle,
      'Monthly Price (ETB)': t.monthlyPriceEtb,
      'Students Registered': stuCount,
      'Student Limit': t.studentLimit,
      'Staff Registered': stfCount,
      'Staff Limit': t.staffLimit,
      'Storage Used (MB)': t.storageUsedMb,
      'Storage Limit (MB)': t.storageLimitMb,
      'Enabled Modules': t.enabledModules.length,
      'Admin Email': t.primaryAdminEmail,
      City: t.city,
      Country: t.country,
      'Subscription Expires': t.subscriptionExpiresAt,
      'Created At': t.createdAt.slice(0, 10),
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tenantRows), 'Registered Institutes');

  const paymentRows = params.platformPayments.map((p) => ({
    'Payment Ref': p.paymentRef,
    'Invoice #': p.invoiceNumber || '—',
    Institute: p.tenantName,
    'Tenant ID': p.tenantId,
    Plan: p.planName,
    'Amount (ETB)': p.amountEtb,
    Currency: p.currency,
    Method: p.paymentMethod,
    'Payment Date': p.paymentDate,
    Status: p.status,
    'Recorded By': p.recordedByName,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(paymentRows.length ? paymentRows : [{ Info: 'No platform payments yet' }]),
    'Platform Revenue'
  );

  const invoiceRows = params.invoices.map((inv) => ({
    'Invoice #': inv.invoiceNumber,
    Institute: inv.tenantName,
    Plan: inv.planName,
    Cycle: inv.billingCycle,
    'Amount (ETB)': inv.amountEtb,
    'Due Date': inv.dueDate,
    Status: inv.status,
    'Paid At': inv.paidAt ? inv.paidAt.slice(0, 10) : '—',
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(invoiceRows.length ? invoiceRows : [{ Info: 'No platform invoices yet' }]),
    'Platform Invoices'
  );

  const auditRows = params.auditLogs.slice(0, 500).map((a) => ({
    Timestamp: a.createdAt,
    Tenant: a.tenantId || DEFAULT_ZACMA_TENANT_ID,
    Actor: a.actorName,
    Role: a.actorPlatformRole || a.actorRole,
    Action: a.action,
    Entity: `${a.entityType}:${a.entityId}`,
    Summary: a.summary,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(auditRows.length ? auditRows : [{ Info: 'No audit logs' }]),
    'Platform Audit Trail'
  );

  XLSX.writeFile(wb, `ZACMA_SaaS_Platform_Analytics_${todayIsoDate()}.xlsx`);
}

// ---------------------------------------------------------------------------
// Public Institute Self-Registration, Approval Queue & Auto-Provisioning
// ---------------------------------------------------------------------------

export interface PublicInstituteRegistrationInput {
  instituteName: string;
  shortName: string;
  businessType: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  website?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  currency: 'ETB' | 'USD' | 'KES' | 'EUR' | 'GBP';
  selectedPlan: SubscriptionPlan;
  billingCycle: BillingCycle;
  adminFullName: string;
  adminEmail: string;
  adminPhone: string;
  adminPosition: string;
  applicantUid: string;
}

export interface PublicInstituteRegistrationResult {
  requestId: string;
  slug: string;
  status: 'PENDING' | 'APPROVED';
  provisionedTenantId?: string;
}

export async function submitInstituteRegistrationRequest(
  input: PublicInstituteRegistrationInput
): Promise<PublicInstituteRegistrationResult> {
  const now = new Date().toISOString();
  const today = todayIsoDate();
  const requestId = makeId('instreq');
  const slug = makeSlug(input.shortName || input.instituteName);

  // Check global platform settings for Automatic Approval vs Manual Approval
  let autoApprove = false;
  let allowSignup = true;
  try {
    const settingsSnap = await getDoc(doc(db, 'platform_settings', 'default'));
    if (settingsSnap.exists()) {
      const s = settingsSnap.data() as PlatformGlobalSettings;
      allowSignup = s.allowSelfSignupInstitutes !== false;
      autoApprove = Boolean(s.allowSelfSignupInstitutes && s.autoApproveInstituteRegistrations);
    }
  } catch {
    autoApprove = false;
  }

  if (!allowSignup) {
    throw new Error('Public institute self-registration is currently paused by ZACMA Platform Administration.');
  }

  let provisionedTenantId: string | undefined;

  if (autoApprove) {
    const rand4 = Math.random().toString(36).slice(2, 6);
    const tenantId = `inst_${slug.replace(/-/g, '_')}_${rand4}`;
    const subId = `sub_${tenantId}`;
    const isTrial = input.billingCycle === 'TRIAL' || input.selectedPlan.code === 'FREE_TRIAL';
    const durationDays = isTrial
      ? Math.max(7, input.selectedPlan.trialDays || 14)
      : input.billingCycle === 'ANNUAL'
      ? 365
      : input.billingCycle === 'QUARTERLY'
      ? 90
      : 30;
    const expiresAt = addDaysIso(today, durationDays);
    const prefix = sanitizeCodePrefix(slug.replace(/[^a-z0-9]/g, '').slice(0, 4).toUpperCase(), 'INS');
    const priceEtb = isTrial
      ? 0
      : input.billingCycle === 'ANNUAL'
      ? input.selectedPlan.annualPriceEtb
      : input.billingCycle === 'QUARTERLY'
      ? input.selectedPlan.quarterlyPriceEtb ?? Math.round(input.selectedPlan.monthlyPriceEtb * 2.7)
      : input.selectedPlan.monthlyPriceEtb;

    const safeCity = sanitizeRequiredString(input.city, 'Addis Ababa', 80);
    const safeCountry = sanitizeRequiredString(input.country, 'Ethiopia', 80);
    const safePhone = sanitizePhone(input.phone);
    const tenantPayload: Omit<TenantRecord, 'id'> = {
      tenantId,
      name: sanitizeRequiredString(input.instituteName, 'Training Institute', 140),
      shortName: sanitizeRequiredString(input.shortName, input.instituteName.trim().slice(0, 28), 40),
      slug,
      businessType: sanitizeRequiredString(input.businessType, 'Training Institute', 80),
      email: sanitizeRequiredString(input.email.toLowerCase(), 'info@institute.edu.et', 160),
      phone: safePhone,
      country: safeCountry,
      city: safeCity,
      address: sanitizeRequiredString(input.address, `${safeCity}, ${safeCountry}`, 240),
      website: input.website?.trim().slice(0, 200),
      logoUrl: input.logoUrl?.slice(0, 90000),
      primaryColor: sanitizeRequiredString(input.primaryColor, '#172DEB', 20),
      secondaryColor: sanitizeRequiredString(input.secondaryColor, '#E51B23', 20),
      studentIdPrefix: prefix,
      staffIdPrefix: prefix,
      receiptPrefix: `${prefix}-RCP`.slice(0, 16),
      currency: input.currency || 'ETB',
      timezone: 'Africa/Addis_Ababa',
      academicYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
      paymentMethods: ['Cash', 'CBE Birr', 'Telebirr', 'Bank Transfer', 'Chapa'],
      defaultLanguage: 'English (Ethiopia)',
      dateFormat: 'GREGORIAN_AND_ETHIOPIAN',
      invoiceFooterNote: `Official financial document issued by ${input.instituteName.trim()}.`.slice(0, 300),
      notificationEmailEnabled: true,
      notificationSmsEnabled: true,
      notificationWhatsappEnabled: false,
      emailGatewayStatus: 'CONFIGURED',
      smsGatewayStatus: 'CONFIGURED',
      whatsappGatewayStatus: 'UNCONFIGURED',
      smsSenderLabel: prefix,
      status: isTrial ? 'TRIAL' : 'ACTIVE',
      planId: input.selectedPlan.id,
      planCode: input.selectedPlan.code,
      planName: input.selectedPlan.name,
      billingCycle: input.billingCycle,
      monthlyPriceEtb: input.selectedPlan.monthlyPriceEtb,
      quarterlyPriceEtb:
        input.selectedPlan.quarterlyPriceEtb ?? Math.round(input.selectedPlan.monthlyPriceEtb * 2.7),
      annualPriceEtb: input.selectedPlan.annualPriceEtb,
      studentLimit: input.selectedPlan.studentLimit,
      staffLimit: input.selectedPlan.staffLimit,
      storageLimitMb: input.selectedPlan.storageLimitMb,
      storageUsedMb: 0,
      aiMonthlyQuota: input.selectedPlan.aiMonthlyQuota,
      aiRequestsUsed: 0,
      enabledModules: input.selectedPlan.includedModules,
      primaryAdminUid: input.applicantUid,
      primaryAdminName: input.adminFullName.trim().slice(0, 120),
      primaryAdminEmail: input.adminEmail.trim().toLowerCase().slice(0, 160),
      primaryAdminPhone: input.adminPhone.trim().slice(0, 30),
      primaryAdminPosition: input.adminPosition.trim().slice(0, 80) || 'Institute Administrator',
      subscriptionStartDate: today,
      trialEndsAt: isTrial ? expiresAt : undefined,
      subscriptionExpiresAt: expiresAt,
      isDefaultPlatformTenant: false,
      createdBy: input.applicantUid,
      createdByName: input.adminFullName.trim().slice(0, 120),
      createdAt: now,
      updatedAt: now,
    };

    try {
      // Create tenant first so security rules verify tenant ownership on profile update
      await setDoc(doc(db, 'tenants', tenantId), cleanObject(tenantPayload));

      const batch = writeBatch(db);
      batch.set(
        doc(db, 'platform_subscriptions', subId),
        cleanObject({
          tenantId,
          tenantName: tenantPayload.name,
          planId: input.selectedPlan.id,
          planCode: input.selectedPlan.code,
          planName: input.selectedPlan.name,
          billingCycle: input.billingCycle,
          priceEtb,
          currency: input.currency || 'ETB',
          status: isTrial ? 'TRIAL' : 'ACTIVE',
          startDate: today,
          trialEndsAt: isTrial ? expiresAt : undefined,
          expiresAt,
          autoRenew: true,
          updatedBy: input.applicantUid,
          createdAt: now,
          updatedAt: now,
        })
      );

      batch.set(
        doc(db, 'departments', `${tenantId}_dept_tech`),
        cleanObject({
          tenantId,
          code: 'TECH',
          name: 'Technology & Computing',
          description: 'Core digital and engineering training programs.',
          isActive: true,
          createdBy: input.applicantUid,
          createdAt: now,
          updatedAt: now,
        })
      );

      batch.set(
        doc(db, 'institute_registration_requests', requestId),
        cleanObject({
          instituteName: tenantPayload.name,
          shortName: tenantPayload.shortName,
          slug,
          businessType: tenantPayload.businessType,
          email: tenantPayload.email,
          phone: tenantPayload.phone,
          country: tenantPayload.country,
          city: tenantPayload.city,
          address: tenantPayload.address,
          website: tenantPayload.website,
          logoUrl: tenantPayload.logoUrl,
          primaryColor: tenantPayload.primaryColor,
          secondaryColor: tenantPayload.secondaryColor,
          currency: tenantPayload.currency,
          selectedPlanId: input.selectedPlan.id,
          selectedPlanCode: input.selectedPlan.code,
          selectedPlanName: input.selectedPlan.name,
          billingCycle: input.billingCycle,
          adminFullName: tenantPayload.primaryAdminName,
          adminEmail: tenantPayload.primaryAdminEmail,
          adminPhone: tenantPayload.primaryAdminPhone,
          adminPosition: tenantPayload.primaryAdminPosition,
          applicantUid: input.applicantUid,
          status: 'APPROVED',
          provisionedTenantId: tenantId,
          reviewedBy: 'AUTO_APPROVAL',
          reviewedByName: 'ZIMS Auto-Provisioning Engine',
          reviewedAt: now,
          createdAt: now,
          updatedAt: now,
        })
      );

      const applicantProfileSnap = await getDoc(doc(db, 'profiles', input.applicantUid)).catch(() => null);
      if (applicantProfileSnap?.exists() && !applicantProfileSnap.data()?.platformRole) {
        batch.update(doc(db, 'profiles', input.applicantUid), {
          tenantId,
          role: 'ADMIN',
          fullName: tenantPayload.primaryAdminName,
          phone: tenantPayload.primaryAdminPhone,
          updatedAt: now,
        });
      }

      await batch.commit();
      provisionedTenantId = tenantId;

      return { requestId, slug, status: 'APPROVED', provisionedTenantId };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `tenants/${tenantId}`);
    }
  }

  // Manual Super Admin Approval flow
  try {
    const safeCity = sanitizeRequiredString(input.city, 'Addis Ababa', 80);
    const safeCountry = sanitizeRequiredString(input.country, 'Ethiopia', 80);
    const safePhone = sanitizePhone(input.phone);
    const reqDoc: Omit<InstituteRegistrationRequest, 'id'> = {
      instituteName: sanitizeRequiredString(input.instituteName, 'Training Institute', 140),
      shortName: sanitizeRequiredString(input.shortName, input.instituteName.trim().slice(0, 28), 40),
      slug,
      businessType: sanitizeRequiredString(input.businessType, 'Training Institute', 80),
      email: sanitizeRequiredString(input.email.toLowerCase(), 'info@institute.edu.et', 160),
      phone: safePhone,
      country: safeCountry,
      city: safeCity,
      address: sanitizeRequiredString(input.address, `${safeCity}, ${safeCountry}`, 240),
      website: input.website?.trim().slice(0, 200),
      logoUrl: input.logoUrl?.slice(0, 90000),
      primaryColor: sanitizeRequiredString(input.primaryColor, '#172DEB', 20),
      secondaryColor: sanitizeRequiredString(input.secondaryColor, '#E51B23', 20),
      currency: input.currency || 'ETB',
      selectedPlanId: sanitizeRequiredString(input.selectedPlan.id, 'plan_free_trial', 80),
      selectedPlanCode: sanitizeRequiredString(input.selectedPlan.code, 'FREE_TRIAL', 40),
      selectedPlanName: sanitizeRequiredString(input.selectedPlan.name, 'Free Trial', 80),
      billingCycle: input.billingCycle,
      adminFullName: sanitizeRequiredString(input.adminFullName, 'Institute Administrator', 120),
      adminEmail: sanitizeRequiredString(input.adminEmail.toLowerCase(), 'admin@institute.edu.et', 160),
      adminPhone: sanitizePhone(input.adminPhone, safePhone),
      adminPosition: sanitizeRequiredString(input.adminPosition, 'Institute Administrator', 80),
      applicantUid: input.applicantUid,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'institute_registration_requests', requestId), cleanObject(reqDoc));
    return { requestId, slug, status: 'PENDING' };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `institute_registration_requests/${requestId}`);
  }
}

export async function approveInstituteRegistrationRequest(
  request: InstituteRegistrationRequest,
  plans: SubscriptionPlan[],
  actor: PlatformActor
): Promise<ProvisionInstituteResult> {
  if (actor.platformRole !== 'SUPER_ADMIN' && actor.platformRole !== 'PLATFORM_ADMIN') {
    throw new Error('Only Platform Administrators can approve institute registrations.');
  }

  const matchedPlan =
    plans.find((p) => p.id === request.selectedPlanId || p.code === request.selectedPlanCode) ||
    DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.code === request.selectedPlanCode) ||
    DEFAULT_SUBSCRIPTION_PLANS[0];

  const today = todayIsoDate();
  const isTrial = request.billingCycle === 'TRIAL' || matchedPlan.code === 'FREE_TRIAL';
  const durationDays = isTrial
    ? Math.max(7, matchedPlan.trialDays || 14)
    : request.billingCycle === 'ANNUAL'
    ? 365
    : request.billingCycle === 'QUARTERLY'
    ? 90
    : 30;
  const prefix = sanitizeCodePrefix(
    request.slug.replace(/[^a-z0-9]/g, '').slice(0, 4).toUpperCase(),
    'INS'
  );

  const result = await provisionTrainingInstitute(
    {
      name: request.instituteName,
      shortName: request.shortName,
      businessType: request.businessType,
      email: request.email,
      phone: request.phone,
      country: request.country,
      city: request.city,
      address: request.address,
      website: request.website,
      logoUrl: request.logoUrl,
      primaryAdminUid: request.applicantUid,
      primaryAdminName: request.adminFullName,
      primaryAdminEmail: request.adminEmail,
      primaryAdminPhone: request.adminPhone,
      primaryAdminPosition: request.adminPosition,
      studentIdPrefix: prefix,
      staffIdPrefix: prefix,
      receiptPrefix: `${prefix}-RCP`,
      currency: request.currency,
      timezone: 'Africa/Addis_Ababa',
      academicYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
      paymentMethods: ['Cash', 'CBE Birr', 'Telebirr', 'Bank Transfer', 'Chapa'],
      defaultLanguage: 'English (Ethiopia)',
      dateFormat: 'GREGORIAN_AND_ETHIOPIAN',
      primaryColor: request.primaryColor || '#172DEB',
      secondaryColor: request.secondaryColor || '#E51B23',
      notificationEmailEnabled: true,
      notificationSmsEnabled: true,
      notificationWhatsappEnabled: false,
      planId: matchedPlan.id,
      planCode: matchedPlan.code,
      planName: matchedPlan.name,
      billingCycle: request.billingCycle,
      monthlyPriceEtb: matchedPlan.monthlyPriceEtb,
      quarterlyPriceEtb:
        matchedPlan.quarterlyPriceEtb ?? Math.round(matchedPlan.monthlyPriceEtb * 2.7),
      annualPriceEtb: matchedPlan.annualPriceEtb,
      subscriptionStartDate: today,
      trialDays: matchedPlan.trialDays,
      subscriptionExpiresAt: addDaysIso(today, durationDays),
      studentLimit: matchedPlan.studentLimit,
      staffLimit: matchedPlan.staffLimit,
      storageLimitMb: matchedPlan.storageLimitMb,
      aiMonthlyQuota: matchedPlan.aiMonthlyQuota,
      enabledModules: matchedPlan.includedModules,
      markInitialInvoicePaid: false,
    },
    actor
  );

  const now = new Date().toISOString();
  const batch = writeBatch(db);
  batch.update(doc(db, 'institute_registration_requests', request.id), {
    status: 'APPROVED',
    provisionedTenantId: result.tenantId,
    reviewedBy: actor.uid,
    reviewedByName: actor.fullName.slice(0, 120),
    reviewedAt: now,
    updatedAt: now,
  });

  // Immediately bind the applicant's existing Firebase Auth profile as ADMIN of the new tenant
  // (never overwrite a Platform Admin / Super Admin profile if testing self-registration)
  if (request.applicantUid) {
    try {
      const profSnap = await getDoc(doc(db, 'profiles', request.applicantUid));
      if (profSnap.exists() && !profSnap.data()?.platformRole) {
        batch.update(doc(db, 'profiles', request.applicantUid), {
          tenantId: result.tenantId,
          role: 'ADMIN',
          isActive: true,
          updatedAt: now,
        });
      }
    } catch {
      // Applicant can also claim via tenant_invitations on sign-in
    }
  }

  await batch.commit();
  return result;
}

export async function rejectInstituteRegistrationRequest(
  request: InstituteRegistrationRequest,
  reason: string,
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  const cleanReason = reason.trim().slice(0, 280) || 'Application declined after review.';
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'institute_registration_requests', request.id), {
      status: 'REJECTED',
      rejectionReason: cleanReason,
      reviewedBy: actor.uid,
      reviewedByName: actor.fullName.slice(0, 120),
      reviewedAt: now,
      updatedAt: now,
    });
    batch.set(doc(db, 'audit_logs', makeId('aud_req_rej')), {
      tenantId: DEFAULT_ZACMA_TENANT_ID,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'INSTITUTE_REGISTRATION_REJECTED',
      entityType: 'institute_registration_request',
      entityId: request.id,
      summary: `Rejected registration request for "${request.instituteName}" (${request.adminEmail}): ${cleanReason}`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `institute_registration_requests/${request.id}`);
  }
}

export async function cancelOrExpireSubscription(
  tenant: TenantRecord,
  existingSub: PlatformSubscription | undefined,
  targetStatus: 'CANCELLED' | 'EXPIRED',
  reason: string,
  actor: PlatformActor
): Promise<void> {
  if (tenant.tenantId === DEFAULT_ZACMA_TENANT_ID) {
    throw new Error('The primary ZACMA Platform Owner tenant subscription cannot be cancelled.');
  }
  const now = new Date().toISOString();
  const subId = existingSub?.id || `sub_${tenant.tenantId}`;
  const cleanReason = reason.trim().slice(0, 280) || `Subscription marked ${targetStatus} by platform administration.`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'tenants', tenant.id), {
      status: targetStatus === 'EXPIRED' ? 'EXPIRED' : 'SUSPENDED',
      suspendedReason: cleanReason,
      suspendedAt: now,
      updatedAt: now,
    });
    if (existingSub) {
      batch.update(doc(db, 'platform_subscriptions', subId), {
        status: targetStatus,
        autoRenew: false,
        notes: cleanReason,
        updatedBy: actor.uid,
        updatedAt: now,
      });
    }
    batch.set(doc(db, 'audit_logs', makeId('aud_sub_stat')), {
      tenantId: tenant.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: `SUBSCRIPTION_${targetStatus}`,
      entityType: 'platform_subscription',
      entityId: subId,
      summary: `Marked subscription for "${tenant.name}" as ${targetStatus}: ${cleanReason}`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `platform_subscriptions/${subId}`);
  }
}

/**
 * Records a server-verified Chapa subscription payment made by an Institute Admin,
 * issuing a PAID platform invoice, logging platform revenue, and activating/extending the plan.
 */
export async function completeChapaSubscriptionPayment(
  params: {
    tenant: TenantRecord;
    existingSub?: PlatformSubscription;
    plan: SubscriptionPlan;
    billingCycle: BillingCycle;
    amountEtb: number;
    txRef: string;
    chapaReference: string;
    verificationProof: string;
  },
  actor: PlatformActor
): Promise<{ invoiceNumber: string; newExpiresAt: string }> {
  const now = new Date().toISOString();
  const today = todayIsoDate();
  const subId = params.existingSub?.id || `sub_${params.tenant.tenantId}`;
  const durationDays =
    params.billingCycle === 'ANNUAL' ? 365 : params.billingCycle === 'QUARTERLY' ? 90 : 30;
  const baseDate =
    params.tenant.subscriptionExpiresAt && params.tenant.subscriptionExpiresAt > today
      ? params.tenant.subscriptionExpiresAt
      : today;
  const newExpiresAt = addDaysIso(baseDate, durationDays);
  const invId = makeId('pinv');
  const payId = makeId('ppay');
  const invoiceNumber = `ZAC-INV-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'tenants', params.tenant.id), {
      status: 'ACTIVE',
      planId: params.plan.id,
      planCode: params.plan.code,
      planName: params.plan.name,
      billingCycle: params.billingCycle,
      monthlyPriceEtb: params.plan.monthlyPriceEtb,
      quarterlyPriceEtb:
        params.plan.quarterlyPriceEtb ?? Math.round(params.plan.monthlyPriceEtb * 2.7),
      annualPriceEtb: params.plan.annualPriceEtb,
      studentLimit: params.plan.studentLimit,
      staffLimit: params.plan.staffLimit,
      storageLimitMb: params.plan.storageLimitMb,
      aiMonthlyQuota: params.plan.aiMonthlyQuota,
      enabledModules: params.plan.includedModules,
      subscriptionStartDate: today,
      subscriptionExpiresAt: newExpiresAt,
      updatedAt: now,
    });

    batch.set(
      doc(db, 'platform_subscriptions', subId),
      cleanObject({
        tenantId: params.tenant.tenantId,
        tenantName: params.tenant.name,
        planId: params.plan.id,
        planCode: params.plan.code,
        planName: params.plan.name,
        billingCycle: params.billingCycle,
        priceEtb: params.amountEtb,
        currency: 'ETB',
        status: 'ACTIVE',
        startDate: params.existingSub?.startDate || today,
        expiresAt: newExpiresAt,
        autoRenew: true,
        notes: `Verified via Chapa (${params.chapaReference}, proof ${params.verificationProof.slice(0, 12)}).`,
        updatedBy: actor.uid,
        createdAt: params.existingSub?.createdAt || now,
        updatedAt: now,
      })
    );

    batch.set(
      doc(db, 'platform_invoices', invId),
      cleanObject({
        invoiceNumber,
        tenantId: params.tenant.tenantId,
        tenantName: params.tenant.name,
        subscriptionId: subId,
        planName: params.plan.name,
        billingCycle: params.billingCycle,
        amountEtb: params.amountEtb,
        currency: 'ETB',
        dueDate: today,
        status: 'PAID',
        paidAt: now,
        paymentRef: params.txRef,
        notes: `Chapa verified ref ${params.chapaReference} (proof ${params.verificationProof.slice(0, 12)}).`,
        issuedBy: actor.uid,
        issuedByName: actor.fullName.slice(0, 120),
        createdAt: now,
        updatedAt: now,
      })
    );

    batch.set(
      doc(db, 'platform_payments', payId),
      cleanObject({
        paymentRef: params.txRef,
        invoiceId: invId,
        invoiceNumber,
        tenantId: params.tenant.tenantId,
        tenantName: params.tenant.name,
        planName: params.plan.name,
        amountEtb: params.amountEtb,
        currency: 'ETB',
        paymentDate: today,
        paymentMethod: 'Chapa',
        status: 'COMPLETED',
        recordedBy: actor.uid,
        recordedByName: actor.fullName.slice(0, 120),
        notes: `Server-verified Chapa online renewal (${params.chapaReference}).`,
        createdAt: now,
      })
    );

    batch.set(doc(db, 'audit_logs', makeId('aud_chapa_sub')), {
      tenantId: params.tenant.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      action: 'CHAPA_SUBSCRIPTION_PAID',
      entityType: 'platform_subscription',
      entityId: subId,
      summary: `Chapa verified subscription payment of ETB ${params.amountEtb.toLocaleString()} for ${params.plan.name} (${params.billingCycle}). Valid until ${newExpiresAt}.`,
      result: 'SUCCESS',
      createdAt: now,
    });

    await batch.commit();
    return { invoiceNumber, newExpiresAt };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `platform_subscriptions/${subId}`);
  }
}

// ---------------------------------------------------------------------------
// Platform-Wide Announcements (Super Admin -> Institutes)
// ---------------------------------------------------------------------------

export async function publishPlatformAnnouncement(
  input: {
    title: string;
    message: string;
    severity: PlatformAnnouncement['severity'];
    targetAudience: PlatformAnnouncement['targetAudience'];
    targetTenantId?: string;
    expiresAt?: string;
  },
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  const annId = makeId('pann');
  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'platform_announcements', annId),
      cleanObject({
        title: input.title.trim().slice(0, 160),
        message: input.message.trim().slice(0, 800),
        severity: input.severity,
        targetAudience: input.targetAudience,
        targetTenantId: input.targetAudience === 'SPECIFIC_TENANT' ? input.targetTenantId : undefined,
        isActive: true,
        expiresAt: input.expiresAt?.trim() || undefined,
        createdBy: actor.uid,
        createdByName: actor.fullName.slice(0, 120),
        createdAt: now,
        updatedAt: now,
      })
    );
    batch.set(doc(db, 'audit_logs', makeId('aud_pann')), {
      tenantId: input.targetTenantId || DEFAULT_ZACMA_TENANT_ID,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      actorPlatformRole: actor.platformRole,
      action: 'PLATFORM_ANNOUNCEMENT_PUBLISHED',
      entityType: 'platform_announcement',
      entityId: annId,
      summary: `Published platform announcement "${input.title.trim()}" (${input.targetAudience}).`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'platform_announcements');
  }
}

export async function togglePlatformAnnouncement(
  ann: PlatformAnnouncement,
  isActive: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, 'platform_announcements', ann.id), {
      isActive,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `platform_announcements/${ann.id}`);
  }
}

export async function deletePlatformAnnouncement(annId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'platform_announcements', annId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `platform_announcements/${annId}`);
  }
}

// ---------------------------------------------------------------------------
// Tenant-Isolated Academic Structure: Departments, Classes/Batches & Documents
// ---------------------------------------------------------------------------

export async function saveDepartment(
  input: {
    id?: string;
    tenantId: string;
    code: string;
    name: string;
    headName?: string;
    description?: string;
    isActive: boolean;
    existingCreatedAt?: string;
  },
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  const deptId = input.id || makeId('dept');
  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'departments', deptId),
      cleanObject({
        tenantId: input.tenantId,
        code: input.code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20) || 'DEPT',
        name: input.name.trim().slice(0, 120),
        headName: input.headName?.trim().slice(0, 120),
        description: input.description?.trim().slice(0, 400),
        isActive: input.isActive,
        createdBy: actor.uid,
        createdAt: input.existingCreatedAt || now,
        updatedAt: now,
      })
    );
    batch.set(doc(db, 'audit_logs', makeId('aud_dept')), {
      tenantId: input.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      action: input.id ? 'DEPARTMENT_UPDATED' : 'DEPARTMENT_CREATED',
      entityType: 'department',
      entityId: deptId,
      summary: `${input.id ? 'Updated' : 'Created'} department "${input.name.trim()}" (${input.code.trim().toUpperCase()}).`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `departments/${deptId}`);
  }
}

export async function deleteDepartment(
  dept: Department,
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'departments', dept.id));
    batch.set(doc(db, 'audit_logs', makeId('aud_dept_del')), {
      tenantId: dept.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      action: 'DEPARTMENT_DELETED',
      entityType: 'department',
      entityId: dept.id,
      summary: `Deleted department "${dept.name}" (${dept.code}).`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `departments/${dept.id}`);
  }
}

export async function saveClassBatch(
  input: {
    id?: string;
    tenantId: string;
    batchCode: string;
    name: string;
    courseId: string;
    courseName: string;
    departmentId?: string;
    departmentName?: string;
    instructorId?: string;
    instructorName?: string;
    room?: string;
    schedule: string;
    startDate: string;
    endDate: string;
    capacity: number;
    status: ClassBatchStatus;
    existingCreatedAt?: string;
  },
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  const batchId = input.id || makeId('batch');
  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'class_batches', batchId),
      cleanObject({
        tenantId: input.tenantId,
        batchCode: input.batchCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 28) || 'BCH',
        name: input.name.trim().slice(0, 120),
        courseId: input.courseId,
        courseName: input.courseName.trim().slice(0, 120),
        departmentId: input.departmentId,
        departmentName: input.departmentName?.trim().slice(0, 120),
        instructorId: input.instructorId,
        instructorName: input.instructorName?.trim().slice(0, 120),
        room: input.room?.trim().slice(0, 80),
        schedule: input.schedule.trim().slice(0, 140),
        startDate: input.startDate,
        endDate: input.endDate,
        capacity: Math.max(1, Number(input.capacity || 30)),
        status: input.status,
        createdBy: actor.uid,
        createdAt: input.existingCreatedAt || now,
        updatedAt: now,
      })
    );
    batch.set(doc(db, 'audit_logs', makeId('aud_batch')), {
      tenantId: input.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      action: input.id ? 'CLASS_BATCH_UPDATED' : 'CLASS_BATCH_CREATED',
      entityType: 'class_batch',
      entityId: batchId,
      summary: `${input.id ? 'Updated' : 'Created'} class batch "${input.name.trim()}" (${input.batchCode}) for ${input.courseName}.`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `class_batches/${batchId}`);
  }
}

export async function deleteClassBatch(
  cb: ClassBatch,
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'class_batches', cb.id));
    batch.set(doc(db, 'audit_logs', makeId('aud_batch_del')), {
      tenantId: cb.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      action: 'CLASS_BATCH_DELETED',
      entityType: 'class_batch',
      entityId: cb.id,
      summary: `Deleted class batch "${cb.name}" (${cb.batchCode}).`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `class_batches/${cb.id}`);
  }
}

export async function saveInstituteDocument(
  input: {
    tenantId: string;
    title: string;
    category: InstituteDocumentCategory;
    description?: string;
    fileName: string;
    fileMimeType: string;
    fileSizeBytes: number;
    fileDataUrl: string;
    visibility: InstituteDocument['visibility'];
    departmentName?: string;
    courseName?: string;
  },
  actor: PlatformActor
): Promise<void> {
  if (input.fileDataUrl.length > 640000 || input.fileSizeBytes > 640000) {
    throw new Error('File exceeds the 450 KB secure document limit. Please compress the file before uploading.');
  }
  const now = new Date().toISOString();
  const docId = makeId('idoc');
  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'institute_documents', docId),
      cleanObject({
        tenantId: input.tenantId,
        title: input.title.trim().slice(0, 160),
        category: input.category,
        description: input.description?.trim().slice(0, 400),
        fileName: input.fileName.trim().slice(0, 160),
        fileMimeType: input.fileMimeType.trim().slice(0, 100) || 'application/octet-stream',
        fileSizeBytes: input.fileSizeBytes,
        fileDataUrl: input.fileDataUrl,
        visibility: input.visibility,
        departmentName: input.departmentName?.trim().slice(0, 120),
        courseName: input.courseName?.trim().slice(0, 120),
        uploadedBy: actor.uid,
        uploadedByName: actor.fullName.slice(0, 120),
        createdAt: now,
        updatedAt: now,
      })
    );
    batch.set(doc(db, 'audit_logs', makeId('aud_idoc')), {
      tenantId: input.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      action: 'INSTITUTE_DOCUMENT_UPLOADED',
      entityType: 'institute_document',
      entityId: docId,
      summary: `Uploaded institutional document "${input.title.trim()}" (${input.category}, ${input.visibility}).`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `institute_documents/${docId}`);
  }
}

export async function deleteInstituteDocument(
  item: InstituteDocument,
  actor: PlatformActor
): Promise<void> {
  const now = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'institute_documents', item.id));
    batch.set(doc(db, 'audit_logs', makeId('aud_idoc_del')), {
      tenantId: item.tenantId,
      actorId: actor.uid,
      actorName: actor.fullName.slice(0, 120),
      actorRole: actor.role,
      action: 'INSTITUTE_DOCUMENT_DELETED',
      entityType: 'institute_document',
      entityId: item.id,
      summary: `Deleted institutional document "${item.title}" (${item.fileName}).`,
      result: 'SUCCESS',
      createdAt: now,
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `institute_documents/${item.id}`);
  }
}

