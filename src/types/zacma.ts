export type RoleCode = 'ADMIN' | 'ACCOUNTANT' | 'INSTRUCTOR' | 'GENERAL_STAFF' | 'STUDENT';

export type PaymentPlanCode =
  | 'FULL'
  | 'MONTHLY'
  | 'TWO_MONTH'
  | 'THREE_MONTH'
  | 'SIX_MONTH'
  | 'CUSTOM';

export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type EnrollmentStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'REJECTED';
export type InstallmentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PaymentMethod = 'Cash' | 'CBE Birr' | 'Telebirr' | 'Bank Transfer' | 'Check';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export type NotificationType =
  | 'DEADLINE_APPROACHING'
  | 'OVERDUE_BALANCE'
  | 'PENDING_REGISTRATION'
  | 'PENDING_PAYMENT'
  | 'REJECTED_PAYMENT'
  | 'UPCOMING_PAYMENT'
  | 'PAYMENT_DUE_TODAY'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_APPROVED'
  | 'PAYMENT_REJECTED'
  | 'OUTSTANDING_BALANCE'
  | 'REGISTRATION_APPROVED'
  | 'COURSE_ANNOUNCEMENT'
  | 'ATTENDANCE_UPDATE'
  | 'INSTRUCTOR_MESSAGE'
  | 'ADMIN_ANNOUNCEMENT'
  | 'SCHEDULE_CHANGE'
  | 'NEW_INTERNAL_MESSAGE';

export type NavSection =
  | 'dashboard'
  | 'students'
  | 'courses'
  | 'payments'
  | 'reminders'
  | 'approvals'
  | 'receipts'
  | 'accounting'
  | 'reports'
  | 'attendance'
  | 'messages'
  | 'communications'
  | 'staff'
  | 'audit'
  | 'setup';

export type StudentPaymentCategory = 'FULLY_PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE';

export type FinancialAdjustmentType =
  | 'REFUND'
  | 'REVERSAL'
  | 'SCHOLARSHIP_DISCOUNT'
  | 'FEE_ADJUSTMENT';

export interface RoleRecord {
  id: string;
  code: RoleCode;
  name: string;
  description: string;
  permissions?: string[];
}

export interface StaffProfile {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  phone?: string;
  role: RoleCode;
  linkedStudentId?: string;
  allowedModules?: NavSection[];
  canExportReports?: boolean;
  lastLoginAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialAdjustment {
  id: string;
  adjustmentRef: string;
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  courseId: string;
  courseName: string;
  paymentId?: string;
  type: FinancialAdjustmentType;
  amountEtb: number;
  effectiveDate: string;
  reason: string;
  approvedBy: string;
  approvedByName: string;
  createdAt: string;
}

export interface SecurityConfig {
  id: string;
  adminTimeoutMinutes: number;
  userTimeoutMinutes: number;
  warningBeforeSeconds: number;
  maxFailedLogins: number;
  lockoutMinutes: number;
  enforceAuditOnExports: boolean;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt: string;
}

export interface LoginHistoryRecord {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  role: RoleCode;
  eventType: 'LOGIN' | 'LOGOUT' | 'SESSION_EXPIRED' | 'FAILED_LOGIN' | 'LOCKOUT';
  authMethod: 'EMAIL_PASSWORD' | 'GOOGLE' | 'SYSTEM';
  userAgent?: string;
  sessionId?: string;
  detail?: string;
  createdAt: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  category: string;
  durationWeeks: number;
  feeEtb: number;
  schedule: string;
  instructorId?: string;
  instructorName?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentPlan {
  id: string;
  code: PaymentPlanCode;
  name: string;
  installmentCount: number;
  intervalDays: number;
  description?: string;
  isActive: boolean;
}

export interface Student {
  id: string;
  studentCode: string;
  fullName: string;
  gender: 'Male' | 'Female';
  phone: string;
  altPhone?: string;
  address: string;
  photoUrl?: string;
  courseId: string;
  courseName: string;
  enrollmentDate: string;
  registrationDateEthiopian?: string;
  registrationTimeEat?: string;
  courseFeeEtb: number;
  paymentPlanCode: PaymentPlanCode;
  registrationStatus: RegistrationStatus;
  registeredBy: string;
  registeredByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  courseId: string;
  courseName: string;
  instructorId?: string;
  paymentPlanCode: PaymentPlanCode;
  paymentPlanName?: string;
  enrollmentDate: string;
  agreedFeeEtb: number;
  approvedPaidEtb: number;
  remainingBalanceEtb: number;
  status: EnrollmentStatus;
  registeredBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentInstallment {
  id: string;
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  courseId: string;
  courseName: string;
  installmentNumber: number;
  dueDate: string;
  amountDueEtb: number;
  amountPaidEtb: number;
  status: InstallmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  transactionRef: string;
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  courseId: string;
  courseName: string;
  amountEtb: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  recordedBy: string;
  recordedByName: string;
  status: PaymentStatus;
  approvedBy?: string;
  approvedByName?: string;
  approvalDate?: string;
  rejectionReason?: string;
  receiptId?: string;
  receiptNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  paymentId: string;
  transactionRef: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  studentPhone?: string;
  courseName: string;
  previousBalanceEtb: number;
  amountPaidEtb: number;
  remainingBalanceEtb: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  authorizedBy: string;
  verificationHash: string;
  issuedAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface Expense {
  id: string;
  categoryId: string;
  categoryName: string;
  title: string;
  amountEtb: number;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  referenceNo?: string;
  recordedBy: string;
  recordedByName: string;
  notes?: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  courseId: string;
  courseName: string;
  attendanceDate: string;
  status: AttendanceStatus;
  recordedBy: string;
  recordedByName: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PortalNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  targetRole: RoleCode | 'ALL';
  recipientUid?: string;
  category?: string;
  actionSection?: string;
  entityType?: string;
  entityId?: string;
  studentId?: string;
  studentCode?: string;
  studentName?: string;
  courseName?: string;
  expectedAmountEtb?: number;
  paidAmountEtb?: number;
  remainingBalanceEtb?: number;
  dueDate?: string;
  paymentStatus?: string;
  dedupKey?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  upcomingLeadDays: number;
  overdueRepeatDays: number;
  updatedAt: string;
}

export interface SchemaMigration {
  id: string;
  version: string;
  name: string;
  appliedAt: string;
  appliedBy: string;
  status: 'APPLIED' | 'VERIFIED';
  notes?: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: RoleCode;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// SMS Gateway, Unified Notification Engine & Internal Messaging Models
// ---------------------------------------------------------------------------

export type SmsProviderCode = 'afromessage' | 'geezsms' | 'twilio' | 'africastalking';

export type CommunicationEventType =
  | 'REGISTRATION_APPROVED'
  | 'PAYMENT_REMINDER'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_APPROVED'
  | 'COURSE_ANNOUNCEMENT'
  | 'ATTENDANCE_UPDATE'
  | 'INSTRUCTOR_MESSAGE'
  | 'ADMIN_ANNOUNCEMENT';

export type SmsDeliveryStatus =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'TEST_SIMULATED';

export interface SmsSystemConfig {
  id: string;
  ownerPhoneNumber: string;
  activeProvider: SmsProviderCode;
  senderId?: string;
  smsEnabled: boolean;
  portalNotificationsEnabled: boolean;
  internalMessagingEnabled: boolean;
  testMode: boolean;
  allowStudentToInstructor: boolean;
  allowStudentToAdmin: boolean;
  allowStudentToStudent: boolean;
  allowAttachments: boolean;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt: string;
}

export interface CommunicationPolicy {
  id: string;
  portalNotificationsEnabled: boolean;
  internalMessagingEnabled: boolean;
  allowStudentToInstructor: boolean;
  allowStudentToAdmin: boolean;
  allowStudentToStudent: boolean;
  allowAttachments: boolean;
  updatedAt: string;
}

export interface SmsTemplate {
  id: string;
  eventType: CommunicationEventType;
  name: string;
  body: string;
  isActive: boolean;
  updatedBy?: string;
  updatedAt: string;
}

export interface SmsLog {
  id: string;
  dedupKey?: string;
  eventType: CommunicationEventType;
  recipientName: string;
  recipientPhone: string;
  studentId?: string;
  studentCode?: string;
  courseName?: string;
  templateId?: string;
  messageBody: string;
  provider: SmsProviderCode;
  mode: 'LIVE' | 'TEST';
  status: SmsDeliveryStatus;
  providerMessageId?: string;
  errorMessage?: string;
  retryCount: number;
  sentBy: string;
  sentByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationChannelRule {
  id: string;
  eventType: CommunicationEventType;
  label: string;
  description: string;
  smsEnabled: boolean;
  portalEnabled: boolean;
  internalMessageEnabled: boolean;
  updatedAt: string;
}

export interface DirectoryUser {
  id: string;
  uid: string;
  fullName: string;
  role: RoleCode;
  linkedStudentId?: string;
  studentCode?: string;
  courseId?: string;
  courseName?: string;
  isActive: boolean;
  lastSeenAt: string;
  updatedAt: string;
}

export type ConversationType = 'DIRECT' | 'GROUP' | 'BROADCAST';

export type BroadcastAudience =
  | 'ALL_USERS'
  | 'ALL_STUDENTS'
  | 'ALL_INSTRUCTORS'
  | 'ALL_ACCOUNTANTS'
  | 'ALL_STAFF'
  | 'COURSE'
  | 'CUSTOM';

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string;
  description?: string;
  participantIds: string[];
  participantLabels: string[]; // "uid|Name|Role" bounded parallel list for crisp display without PII lookup
  courseId?: string;
  courseName?: string;
  broadcastAudience?: BroadcastAudience;
  createdBy: string;
  createdByName: string;
  createdByRole: RoleCode;
  lastMessageText?: string;
  lastMessageAt?: string;
  lastMessageBy?: string;
  lastMessageByName?: string;
  readByUids: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InternalMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: RoleCode;
  body: string;
  replyToId?: string;
  replyToSender?: string;
  replyToPreview?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSize?: number;
  attachmentDataUrl?: string;
  readByUids: string[];
  createdAt: string;
}

export function formatEtb(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `ETB ${safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatEtbCompact(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${safe.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} ETB`;
}

export function formatDateShort(isoOrDate: string | undefined): string {
  if (!isoOrDate) return '—';
  const d = new Date(isoOrDate.length === 10 ? `${isoOrDate}T00:00:00` : isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(baseDate: string, days: number): string {
  const d = new Date(`${baseDate.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function sanitizeRefId(ref: string): string {
  return ref
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '_');
}

export function generateVerificationHash(receiptNo: string, txRef: string, amount: number): string {
  const raw = `ZACMA|${receiptNo}|${txRef}|${amount.toFixed(2)}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `ZAC-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
}
