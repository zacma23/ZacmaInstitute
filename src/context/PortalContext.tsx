import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import {
  activeFirebaseProjectId,
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { ensureSeededDatabase } from '../lib/seedData';
import { evaluatePaymentReminders, ReminderEvaluationResult } from '../lib/zacmaService';
import {
  AttendanceRecord,
  AuditLog,
  Course,
  Enrollment,
  Expense,
  ExpenseCategory,
  NotificationPreference,
  Payment,
  PaymentInstallment,
  PaymentPlan,
  PortalNotification,
  Receipt,
  RoleCode,
  RoleRecord,
  SchemaMigration,
  StaffProfile,
  Student,
  todayIsoDate,
  addDaysIso,
} from '../types/zacma';

const BOOTSTRAP_ADMIN_EMAIL = 'zekimuluken@gmail.com';

interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info';
  message: string;
}

interface PortalContextValue {
  user: User | null;
  profile: StaffProfile | null;
  actualRole: RoleCode | null;
  effectiveRole: RoleCode | null;
  previewRole: RoleCode | null;
  setPreviewRole: (role: RoleCode | null) => void;
  previewStudentId: string | null;
  setPreviewStudentId: (studentId: string | null) => void;
  authLoading: boolean;
  dataLoading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;

  roles: RoleRecord[];
  staffProfiles: StaffProfile[];
  courses: Course[];
  paymentPlans: PaymentPlan[];
  students: Student[];
  enrollments: Enrollment[];
  installments: PaymentInstallment[];
  payments: Payment[];
  receipts: Receipt[];
  expenseCategories: ExpenseCategory[];
  expenses: Expense[];
  attendance: AttendanceRecord[];
  notifications: PortalNotification[];
  persistedNotifications: PortalNotification[];
  notificationPrefs: NotificationPreference | null;
  schemaMigrations: SchemaMigration[];
  auditLogs: AuditLog[];

  lastReminderRun: ReminderEvaluationResult | null;
  runningReminders: boolean;
  runReminderEvaluationNow: (options?: { upcomingLeadDays?: number; overdueRepeatDays?: number }) => Promise<ReminderEvaluationResult | null>;

  toasts: ToastMessage[];
  pushToast: (tone: 'success' | 'error' | 'info', message: string) => void;
  dismissToast: (id: string) => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [previewRole, setPreviewRole] = useState<RoleCode | null>(null);
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [installments, setInstallments] = useState<PaymentInstallment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [persistedNotifications, setPersistedNotifications] = useState<PortalNotification[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreference | null>(null);
  const [schemaMigrations, setSchemaMigrations] = useState<SchemaMigration[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [lastReminderRun, setLastReminderRun] = useState<ReminderEvaluationResult | null>(null);
  const [runningReminders, setRunningReminders] = useState(false);
  const autoReminderRanRef = useRef(false);

  const pushToast = (tone: 'success' | 'error' | 'info', message: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    // Capture any redirect sign-in errors (e.g., mobile popup fallback)
    getRedirectResult(auth).catch((err) => {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/unauthorized-domain') {
        const host = window.location.hostname;
        setAuthError(
          `UNAUTHORIZED_DOMAIN|${host}|${activeFirebaseProjectId}`
        );
      } else if (err instanceof Error && err.message) {
        setAuthError(err.message);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthError(null);
      if (!firebaseUser) {
        setProfile(null);
        setPreviewRole(null);
        setAuthLoading(false);
        setDataLoading(false);
        return;
      }

      setAuthLoading(true);
      try {
        const profileRef = doc(db, 'profiles', firebaseUser.uid);
        const snap = await getDoc(profileRef);
        const now = new Date().toISOString();
        const isBootstrap =
          (firebaseUser.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;

        let resolved: StaffProfile;
        if (snap.exists()) {
          const d = snap.data();
          resolved = {
            id: snap.id,
            uid: d.uid || firebaseUser.uid,
            email: d.email || firebaseUser.email || '',
            fullName: d.fullName || firebaseUser.displayName || 'ZACMA Staff',
            phone: d.phone,
            role: isBootstrap ? 'ADMIN' : (d.role as RoleCode),
            linkedStudentId: d.linkedStudentId,
            isActive: d.isActive ?? true,
            createdAt: d.createdAt || now,
            updatedAt: d.updatedAt || now,
          };
        } else {
          const initialRole: RoleCode = isBootstrap ? 'ADMIN' : 'INSTRUCTOR';
          const newProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            fullName: (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'ZACMA Staff').slice(0, 120),
            role: initialRole,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          };
          await setDoc(profileRef, newProfile);
          resolved = { id: firebaseUser.uid, ...newProfile };
        }

        setProfile(resolved);
        if (resolved.role === 'ADMIN') {
          await ensureSeededDatabase(resolved.uid, resolved.fullName);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to load staff profile.';
        setAuthError(msg);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const actualRole: RoleCode | null = profile?.role ?? null;
  const effectiveRole: RoleCode | null =
    actualRole === 'ADMIN' && previewRole ? previewRole : actualRole;

  useEffect(() => {
    if (!user || !profile || !actualRole) return;

    setDataLoading(true);
    const unsubs: Array<() => void> = [];

    const subscribe = <T extends { id: string }>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      sortFn?: (a: T, b: T) => number
    ) => {
      const unsub = onSnapshot(
        collection(db, colName),
        (snapshot) => {
          const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
          if (sortFn) rows.sort(sortFn);
          setter(rows);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, colName);
        }
      );
      unsubs.push(unsub);
    };

    // Always subscribe to own notification preferences
    const prefUnsub = onSnapshot(
      doc(db, 'notification_preferences', user.uid),
      (snap) => {
        if (snap.exists()) {
          setNotificationPrefs({ id: snap.id, ...snap.data() } as NotificationPreference);
        } else {
          setNotificationPrefs({
            id: user.uid,
            userId: user.uid,
            inAppEnabled: true,
            emailEnabled: false,
            smsEnabled: false,
            whatsappEnabled: false,
            upcomingLeadDays: 7,
            overdueRepeatDays: 3,
            updatedAt: new Date().toISOString(),
          });
        }
      },
      () => {
        // Non-fatal fallback
      }
    );
    unsubs.push(prefUnsub);

    // STRICT ISOLATED STUDENT ROLE SUBSCRIPTIONS (Only their own studentId records)
    if (actualRole === 'STUDENT') {
      const linkedId = profile.linkedStudentId;
      subscribe<Course>('courses', setCourses, (a, b) => a.name.localeCompare(b.name));
      setRoles([]);
      setPaymentPlans([]);
      setExpenseCategories([]);
      setExpenses([]);
      setAttendance([]);
      setStaffProfiles([profile]);
      setAuditLogs([]);
      setSchemaMigrations([]);

      if (linkedId) {
        const stuUnsub = onSnapshot(
          doc(db, 'students', linkedId),
          (snap) => {
            setStudents(snap.exists() ? [{ id: snap.id, ...snap.data() } as Student] : []);
          },
          (error) => handleFirestoreError(error, OperationType.GET, `students/${linkedId}`)
        );
        unsubs.push(stuUnsub);

        const subscribeOwn = <T extends { id: string }>(
          colName: string,
          setter: React.Dispatch<React.SetStateAction<T[]>>,
          sortFn?: (a: T, b: T) => number
        ) => {
          const q = query(collection(db, colName), where('studentId', '==', linkedId));
          const unsub = onSnapshot(
            q,
            (snapshot) => {
              const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
              if (sortFn) rows.sort(sortFn);
              setter(rows);
            },
            (error) => handleFirestoreError(error, OperationType.LIST, colName)
          );
          unsubs.push(unsub);
        };

        subscribeOwn<Enrollment>('enrollments', setEnrollments, (a, b) =>
          b.createdAt.localeCompare(a.createdAt)
        );
        subscribeOwn<PaymentInstallment>('payment_installments', setInstallments, (a, b) =>
          a.dueDate.localeCompare(b.dueDate)
        );
        subscribeOwn<Payment>('payments', setPayments, (a, b) =>
          b.createdAt.localeCompare(a.createdAt)
        );
        subscribeOwn<Receipt>('receipts', setReceipts, (a, b) =>
          b.issuedAt.localeCompare(a.issuedAt)
        );
        subscribeOwn<PortalNotification>('notifications', setPersistedNotifications, (a, b) =>
          b.createdAt.localeCompare(a.createdAt)
        );
      } else {
        setStudents([]);
        setEnrollments([]);
        setInstallments([]);
        setPayments([]);
        setReceipts([]);
        setPersistedNotifications([]);
      }

      const timer = window.setTimeout(() => setDataLoading(false), 350);
      return () => {
        window.clearTimeout(timer);
        unsubs.forEach((u) => u());
      };
    }

    // Core staff collections (readable by Admin, Accountant, Instructor, General Staff)
    subscribe<RoleRecord>('roles', setRoles);
    subscribe<Course>('courses', setCourses, (a, b) => a.name.localeCompare(b.name));
    subscribe<Student>('students', setStudents, (a, b) =>
      b.studentCode.localeCompare(a.studentCode)
    );
    subscribe<Enrollment>('enrollments', setEnrollments, (a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    subscribe<AttendanceRecord>('attendance', setAttendance, (a, b) =>
      b.attendanceDate.localeCompare(a.attendanceDate)
    );
    subscribe<PortalNotification>('notifications', setPersistedNotifications, (a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );

    // Finance-restricted collections (Strictly excluded for Instructors and General Staff)
    if (actualRole === 'ADMIN' || actualRole === 'ACCOUNTANT') {
      subscribe<PaymentPlan>('payment_plans', setPaymentPlans, (a, b) =>
        a.installmentCount - b.installmentCount
      );
      subscribe<PaymentInstallment>('payment_installments', setInstallments, (a, b) =>
        a.dueDate.localeCompare(b.dueDate)
      );
      subscribe<Payment>('payments', setPayments, (a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      subscribe<Receipt>('receipts', setReceipts, (a, b) =>
        b.issuedAt.localeCompare(a.issuedAt)
      );
      subscribe<ExpenseCategory>('expense_categories', setExpenseCategories, (a, b) =>
        a.name.localeCompare(b.name)
      );
      subscribe<Expense>('expenses', setExpenses, (a, b) =>
        b.expenseDate.localeCompare(a.expenseDate)
      );
    } else {
      setPaymentPlans([]);
      setInstallments([]);
      setPayments([]);
      setReceipts([]);
      setExpenseCategories([]);
      setExpenses([]);
    }

    // Admin-only collections (Staff directory PII + Immutable Audit Trail + Schema Migrations)
    if (actualRole === 'ADMIN') {
      subscribe<StaffProfile>('profiles', setStaffProfiles, (a, b) =>
        a.fullName.localeCompare(b.fullName)
      );
      subscribe<AuditLog>('audit_logs', setAuditLogs, (a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      subscribe<SchemaMigration>('schema_migrations', setSchemaMigrations, (a, b) =>
        a.version.localeCompare(b.version)
      );
    } else {
      setStaffProfiles([profile]);
      setAuditLogs([]);
      setSchemaMigrations([]);
    }

    const timer = window.setTimeout(() => setDataLoading(false), 350);

    return () => {
      window.clearTimeout(timer);
      unsubs.forEach((u) => u());
    };
  }, [user, profile, actualRole]);

  // Default preview student when Admin switches to STUDENT preview
  useEffect(() => {
    if (actualRole === 'ADMIN' && previewRole === 'STUDENT' && !previewStudentId && students.length > 0) {
      const preferred =
        students.find((s) => s.studentCode === 'ZAC-2026-0002') ||
        students.find((s) => s.registrationStatus === 'APPROVED') ||
        students[0];
      if (preferred) setPreviewStudentId(preferred.id);
    }
  }, [actualRole, previewRole, previewStudentId, students]);

  const runReminderEvaluationNow = useCallback(
    async (options?: { upcomingLeadDays?: number; overdueRepeatDays?: number }) => {
      if (!profile || (actualRole !== 'ADMIN' && actualRole !== 'ACCOUNTANT')) {
        return null;
      }
      setRunningReminders(true);
      try {
        const result = await evaluatePaymentReminders(
          {
            enrollments,
            installments,
            existingNotifications: persistedNotifications,
            upcomingLeadDays: options?.upcomingLeadDays ?? notificationPrefs?.upcomingLeadDays ?? 7,
            overdueRepeatDays: options?.overdueRepeatDays ?? notificationPrefs?.overdueRepeatDays ?? 3,
          },
          {
            uid: profile.uid,
            fullName: profile.fullName,
            role: actualRole,
          }
        );
        setLastReminderRun(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to evaluate payment reminders.';
        pushToast('error', msg);
        return null;
      } finally {
        setRunningReminders(false);
      }
    },
    [profile, actualRole, enrollments, installments, persistedNotifications, notificationPrefs]
  );

  // Automatic deduplicated background reminder evaluation once per Admin/Accountant session
  useEffect(() => {
    if (
      !dataLoading &&
      !autoReminderRanRef.current &&
      profile &&
      (actualRole === 'ADMIN' || actualRole === 'ACCOUNTANT') &&
      installments.length > 0 &&
      enrollments.length > 0
    ) {
      autoReminderRanRef.current = true;
      void runReminderEvaluationNow();
    }
  }, [dataLoading, profile, actualRole, installments.length, enrollments.length, runReminderEvaluationNow]);

  // Merge live dynamic financial/approval alerts with persisted notifications scoped to effectiveRole
  const notifications = useMemo(() => {
    if (!effectiveRole) return [];
    const today = todayIsoDate();
    const soon = addDaysIso(today, 7);
    const liveAlerts: PortalNotification[] = [];

    if (effectiveRole === 'ADMIN') {
      const pendingStu = students.filter((s) => s.registrationStatus === 'PENDING');
      if (pendingStu.length > 0) {
        liveAlerts.push({
          id: 'live_pending_reg',
          type: 'PENDING_REGISTRATION',
          title: `${pendingStu.length} Pending Registration Approval${pendingStu.length > 1 ? 's' : ''}`,
          message: pendingStu
            .slice(0, 3)
            .map((s) => `${s.fullName} (${s.studentCode})`)
            .join(', '),
          targetRole: 'ADMIN',
          entityType: 'student',
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      }
      const pendingPay = payments.filter((p) => p.status === 'PENDING');
      if (pendingPay.length > 0) {
        const sum = pendingPay.reduce((acc, p) => acc + p.amountEtb, 0);
        liveAlerts.push({
          id: 'live_pending_pay',
          type: 'PENDING_PAYMENT',
          title: `${pendingPay.length} Pending Payment Approval${pendingPay.length > 1 ? 's' : ''}`,
          message: `ETB ${sum.toLocaleString()} awaiting verification before official ledger posting.`,
          targetRole: 'ADMIN',
          entityType: 'payment',
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (effectiveRole === 'ADMIN' || effectiveRole === 'ACCOUNTANT') {
      const overdue = installments.filter(
        (i) => i.status !== 'PAID' && i.dueDate < today && i.amountDueEtb > i.amountPaidEtb
      );
      if (overdue.length > 0) {
        liveAlerts.push({
          id: 'live_overdue',
          type: 'OVERDUE_BALANCE',
          title: `${overdue.length} Overdue Installment${overdue.length > 1 ? 's' : ''}`,
          message: overdue
            .slice(0, 3)
            .map((i) => `${i.studentName} (ETB ${(i.amountDueEtb - i.amountPaidEtb).toLocaleString()})`)
            .join(', '),
          targetRole: effectiveRole,
          entityType: 'installment',
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      }

      const upcoming = installments.filter(
        (i) =>
          i.status !== 'PAID' &&
          i.dueDate >= today &&
          i.dueDate <= soon &&
          i.amountDueEtb > i.amountPaidEtb
      );
      if (upcoming.length > 0) {
        liveAlerts.push({
          id: 'live_upcoming',
          type: 'DEADLINE_APPROACHING',
          title: `${upcoming.length} Payment Deadline${upcoming.length > 1 ? 's' : ''} Within 7 Days`,
          message: upcoming
            .slice(0, 3)
            .map((i) => `${i.studentName} due ${i.dueDate}`)
            .join(', '),
          targetRole: effectiveRole,
          entityType: 'installment',
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    const filteredPersisted = persistedNotifications.filter((n) => {
      if (effectiveRole === 'INSTRUCTOR' || effectiveRole === 'GENERAL_STAFF') {
        return n.targetRole === effectiveRole;
      }
      if (effectiveRole === 'STUDENT') {
        const activeStuId =
          actualRole === 'ADMIN' && previewRole === 'STUDENT'
            ? previewStudentId
            : profile?.linkedStudentId;
        return n.targetRole === 'STUDENT' && (!activeStuId || n.studentId === activeStuId);
      }
      return n.targetRole === 'ALL' || n.targetRole === effectiveRole;
    });

    return [...liveAlerts, ...filteredPersisted];
  }, [
    effectiveRole,
    actualRole,
    previewRole,
    previewStudentId,
    profile?.linkedStudentId,
    students,
    payments,
    installments,
    persistedNotifications,
  ]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      const rawMsg = err instanceof Error ? err.message : String(err);

      if (code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, googleAuthProvider);
          return;
        } catch (redirectErr) {
          const rCode = (redirectErr as { code?: string })?.code || '';
          if (rCode === 'auth/unauthorized-domain') {
            setAuthError(`UNAUTHORIZED_DOMAIN|${window.location.hostname}|${activeFirebaseProjectId}`);
            return;
          }
        }
      }

      if (code === 'auth/unauthorized-domain' || rawMsg.includes('auth/unauthorized-domain')) {
        const host = window.location.hostname;
        setAuthError(`UNAUTHORIZED_DOMAIN|${host}|${activeFirebaseProjectId}`);
        pushToast(
          'error',
          `Domain "${host}" is not authorized in Firebase project "${activeFirebaseProjectId}".`
        );
        return;
      }

      const msg =
        code === 'auth/popup-closed-by-user'
          ? 'Sign-in popup was closed before completing authentication.'
          : rawMsg || 'Sign-in failed. Please allow popups and try again.';
      setAuthError(msg);
      pushToast('error', msg);
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
    setPreviewRole(null);
    setPreviewStudentId(null);
    autoReminderRanRef.current = false;
  };

  return (
    <PortalContext.Provider
      value={{
        user,
        profile,
        actualRole,
        effectiveRole,
        previewRole,
        setPreviewRole,
        previewStudentId,
        setPreviewStudentId,
        authLoading,
        dataLoading,
        authError,
        signInWithGoogle,
        signOutUser,
        roles,
        staffProfiles,
        courses,
        paymentPlans,
        students,
        enrollments,
        installments,
        payments,
        receipts,
        expenseCategories,
        expenses,
        attendance,
        notifications,
        persistedNotifications,
        notificationPrefs,
        schemaMigrations,
        auditLogs,
        lastReminderRun,
        runningReminders,
        runReminderEvaluationNow,
        toasts,
        pushToast,
        dismissToast,
      }}
    >
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used inside PortalProvider');
  return ctx;
}
