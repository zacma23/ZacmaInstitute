/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  CheckCheck,
  ClipboardCheck,
  CreditCard,
  Database,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { PortalProvider, usePortal } from './context/PortalContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { ReceiptModal } from './components/ReceiptModal';
import { ToastContainer } from './components/PortalUI';
import { ZacmaAiAssistant } from './components/ZacmaAiAssistant';
import { DashboardView } from './modules/DashboardView';
import { StudentsView } from './modules/StudentsView';
import { CoursesView } from './modules/CoursesView';
import {
  ApprovalsQueueView,
  PaymentsView,
  ReceiptsArchiveView,
} from './modules/PaymentsAndApprovalsView';
import { AccountingView } from './modules/AccountingView';
import { AttendanceView } from './modules/AttendanceView';
import { AuditLogsView, StaffRolesView } from './modules/StaffAndAuditView';
import { RemindersAndPreferencesView } from './modules/RemindersAndPreferencesView';
import { SetupWizardView } from './modules/SetupWizardView';
import { StudentPortalView } from './modules/StudentPortalView';
import { markNotificationRead } from './lib/zacmaService';
import { formatDateShort, NavSection, Receipt, RoleCode, todayIsoDate } from './types/zacma';

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ReactNode;
  roles: RoleCode[];
  badgeCount?: number;
}

function PortalShell() {
  const {
    user,
    profile,
    actualRole,
    effectiveRole,
    previewRole,
    setPreviewRole,
    authLoading,
    signOutUser,
    students,
    installments,
    payments,
    notifications,
    toasts,
    dismissToast,
  } = usePortal();

  const [activeTab, setActiveTab] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);

  const pendingApprovalsCount = useMemo(() => {
    const pStu = students.filter((s) => s.registrationStatus === 'PENDING').length;
    const pPay = payments.filter((p) => p.status === 'PENDING').length;
    return pStu + pPay;
  }, [students, payments]);

  const overdueInstallmentsCount = useMemo(() => {
    const today = todayIsoDate();
    return installments.filter(
      (i) => i.status !== 'PAID' && i.dueDate < today && i.amountDueEtb > i.amountPaidEtb
    ).length;
  }, [installments]);

  const navItems: NavItem[] = useMemo(() => {
    const all: NavItem[] = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: <LayoutDashboard className="w-4 h-4" />,
        roles: ['ADMIN', 'ACCOUNTANT', 'INSTRUCTOR', 'GENERAL_STAFF'],
      },
      {
        id: 'students',
        label: 'Students',
        icon: <Users className="w-4 h-4" />,
        roles: ['ADMIN', 'ACCOUNTANT', 'INSTRUCTOR', 'GENERAL_STAFF'],
      },
      {
        id: 'courses',
        label: 'Courses',
        icon: <BookOpen className="w-4 h-4" />,
        roles: ['ADMIN', 'ACCOUNTANT', 'INSTRUCTOR', 'GENERAL_STAFF'],
      },
      {
        id: 'payments',
        label: 'Fees & Payments',
        icon: <CreditCard className="w-4 h-4" />,
        roles: ['ADMIN', 'ACCOUNTANT'],
      },
      {
        id: 'reminders',
        label: 'Payment Reminders',
        icon: <BellRing className="w-4 h-4" />,
        roles: ['ADMIN', 'ACCOUNTANT'],
        badgeCount: overdueInstallmentsCount,
      },
      {
        id: 'approvals',
        label: 'Approvals Queue',
        icon: <ShieldCheck className="w-4 h-4" />,
        roles: ['ADMIN'],
        badgeCount: pendingApprovalsCount,
      },
      {
        id: 'receipts',
        label: 'Official Receipts',
        icon: <FileText className="w-4 h-4" />,
        roles: ['ADMIN', 'ACCOUNTANT'],
      },
      {
        id: 'accounting',
        label: 'Accounting & Reports',
        icon: <BarChart3 className="w-4 h-4" />,
        roles: ['ADMIN', 'ACCOUNTANT'],
      },
      {
        id: 'attendance',
        label: 'Attendance',
        icon: <ClipboardCheck className="w-4 h-4" />,
        roles: ['ADMIN', 'ACCOUNTANT', 'INSTRUCTOR', 'GENERAL_STAFF'],
      },
      {
        id: 'staff',
        label: 'Staff & Roles',
        icon: <UserCog className="w-4 h-4" />,
        roles: ['ADMIN'],
      },
      {
        id: 'audit',
        label: 'Audit Logs',
        icon: <History className="w-4 h-4" />,
        roles: ['ADMIN'],
      },
      {
        id: 'setup',
        label: 'System Setup',
        icon: <Database className="w-4 h-4" />,
        roles: ['ADMIN'],
      },
    ];
    if (!effectiveRole) return [];
    return all.filter((item) => item.roles.includes(effectiveRole));
  }, [effectiveRole, pendingApprovalsCount, overdueInstallmentsCount]);

  // Redirect to dashboard if effectiveRole switches away from a restricted tab
  useEffect(() => {
    if (navItems.length > 0 && !navItems.some((item) => item.id === activeTab)) {
      setActiveTab('dashboard');
    }
  }, [navItems, activeTab]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white font-display font-extrabold text-sm flex items-center justify-center mx-auto">
            ZT
          </div>
          <p className="text-xs font-medium text-slate-500">Loading ZACMA Portal...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile || !effectiveRole) {
    return (
      <>
        <LoginScreen />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // Strictly isolated Student Self-Service Portal (completely separate from employee sidebar & dashboards)
  if (effectiveRole === 'STUDENT') {
    return (
      <>
        <StudentPortalView onOpenReceipt={setActiveReceipt} />
        <ZacmaAiAssistant />
        <ReceiptModal receipt={activeReceipt} onClose={() => setActiveReceipt(null)} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const currentNav = navItems.find((n) => n.id === activeTab);

  const SidebarContent = (
    <div className="h-full flex flex-col bg-slate-900 text-slate-200 select-none">
      {/* Brand Block */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-700 text-white font-display font-extrabold text-xs flex items-center justify-center shrink-0">
            ZT
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-xs text-white tracking-tight truncate">
              ZACMA TECHNOLOGY
            </p>
            <p className="text-[10px] text-slate-400 truncate">&amp; Training Institute</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden text-slate-400 hover:text-white p-1"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-blue-700 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                {item.icon}
                <span className="truncate">{item.label}</span>
              </span>
              {item.badgeCount !== undefined && item.badgeCount > 0 && (
                <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white tabular-nums">
                  {item.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Signed-In Staff Footer */}
      <div className="p-4 border-t border-slate-800 space-y-3 shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white truncate">{profile.fullName}</p>
          <p className="text-[11px] text-slate-400 truncate">
            {effectiveRole} · {profile.email}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOutUser()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Fixed Navy Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 fixed inset-y-0 left-0 z-30 no-print">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex no-print">
          <div className="w-64 max-w-[80vw] h-full shadow-2xl">{SidebarContent}</div>
          <button
            type="button"
            aria-label="Close overlay"
            className="flex-1 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
              <span className="font-semibold text-slate-900 whitespace-nowrap hidden sm:inline">
                ZACMA Portal
              </span>
              <span className="hidden sm:inline">/</span>
              <span className="font-semibold text-blue-700 truncate">
                {currentNav?.label || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Admin Role-Preview Selector (strictly downscopes UI for testing all 5 roles) */}
            {actualRole === 'ADMIN' && (
              <div className="hidden md:flex items-center gap-2 text-xs">
                <span className="text-slate-500 whitespace-nowrap">View as:</span>
                <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg">
                  {(
                    [
                      { code: 'ADMIN', label: 'Admin' },
                      { code: 'ACCOUNTANT', label: 'Accountant' },
                      { code: 'INSTRUCTOR', label: 'Instructor' },
                      { code: 'GENERAL_STAFF', label: 'Staff' },
                      { code: 'STUDENT', label: 'Student' },
                    ] as Array<{ code: RoleCode; label: string }>
                  ).map((item) => {
                    const active = effectiveRole === item.code;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setPreviewRole(item.code === 'ADMIN' ? null : item.code)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Open notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white font-mono text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Active Role Preview Banner */}
        {actualRole === 'ADMIN' && previewRole && (
          <div className="bg-slate-900 text-slate-100 px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs no-print">
            <span>
              Previewing portal workspace as <strong>{previewRole}</strong>. Financial navigation and role actions reflect this role.
            </span>
            <button
              type="button"
              onClick={() => setPreviewRole(null)}
              className="text-blue-400 hover:text-blue-300 font-semibold whitespace-nowrap"
            >
              Return to Admin View
            </button>
          </div>
        )}

        {/* Active Module Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView onNavigate={setActiveTab} onOpenReceipt={setActiveReceipt} />
          )}
          {activeTab === 'students' && <StudentsView />}
          {activeTab === 'courses' && <CoursesView />}
          {activeTab === 'payments' && <PaymentsView onOpenReceipt={setActiveReceipt} />}
          {activeTab === 'reminders' && <RemindersAndPreferencesView />}
          {activeTab === 'approvals' && <ApprovalsQueueView />}
          {activeTab === 'receipts' && <ReceiptsArchiveView onOpenReceipt={setActiveReceipt} />}
          {activeTab === 'accounting' && <AccountingView />}
          {activeTab === 'attendance' && <AttendanceView />}
          {activeTab === 'staff' && <StaffRolesView />}
          {activeTab === 'audit' && <AuditLogsView />}
          {activeTab === 'setup' && <SetupWizardView />}
        </main>
      </div>

      {/* Notification Slide-Over Drawer */}
      {notifOpen && (
        <div className="fixed inset-0 z-50 flex justify-end no-print">
          <button
            type="button"
            aria-label="Close notifications overlay"
            className="flex-1 bg-slate-950/40"
            onClick={() => setNotifOpen(false)}
          />
          <div className="w-full max-w-md bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-display font-bold text-slate-900">
                  Portal Notifications
                </h2>
                <p className="text-xs text-slate-500">
                  {unreadCount} active alert{unreadCount === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotifOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  All caught up — no pending alerts.
                </div>
              ) : (
                notifications.map((n) => {
                  const isLive = n.id.startsWith('live_');
                  const toneColor =
                    n.type === 'OVERDUE_BALANCE' || n.type === 'REJECTED_PAYMENT'
                      ? 'text-red-700'
                      : n.type === 'DEADLINE_APPROACHING'
                      ? 'text-amber-700'
                      : 'text-blue-700';

                  return (
                    <div
                      key={n.id}
                      className={`p-4 space-y-1.5 ${n.isRead ? 'bg-white' : 'bg-slate-50/80'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-bold ${toneColor}`}>{n.title}</p>
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                          {formatDateShort(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (n.type === 'PENDING_PAYMENT' || n.type === 'PENDING_REGISTRATION') {
                              setActiveTab(effectiveRole === 'ADMIN' ? 'approvals' : 'students');
                            } else if (n.type === 'REJECTED_PAYMENT' || n.type === 'PAYMENT_REJECTED') {
                              setActiveTab('payments');
                            } else if (
                              n.type === 'PAYMENT_OVERDUE' ||
                              n.type === 'PAYMENT_DUE_TODAY' ||
                              n.type === 'UPCOMING_PAYMENT' ||
                              n.type === 'OVERDUE_BALANCE' ||
                              n.type === 'DEADLINE_APPROACHING'
                            ) {
                              setActiveTab('reminders');
                            } else {
                              setActiveTab('accounting');
                            }
                            setNotifOpen(false);
                          }}
                          className="text-[11px] font-semibold text-blue-700 hover:underline"
                        >
                          Open module
                        </button>
                        {!isLive && !n.isRead && (
                          <button
                            type="button"
                            onClick={() => void markNotificationRead(n.id)}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <ZacmaAiAssistant />
      <ReceiptModal receipt={activeReceipt} onClose={() => setActiveReceipt(null)} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PortalProvider>
        <PortalShell />
      </PortalProvider>
    </ErrorBoundary>
  );
}
