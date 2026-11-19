import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  LogOut,
  MessageSquare,
  Printer,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { usePortal } from '../context/PortalContext';
import { Avatar, EmptyState, StatusLabel } from '../components/PortalUI';
import { ZacmaLogo } from '../components/ZacmaLogo';
import { DualDateDisplay } from '../components/DualCalendarDatePicker';
import { MessagingView } from './MessagingView';
import { markNotificationRead } from '../lib/zacmaService';
import { markAllNotificationsRead } from '../lib/communicationService';
import { formatAddisDateTimeDual, todayAddisIsoDate } from '../lib/ethiopianCalendar';
import {
  formatEtb,
  formatEtbCompact,
  Receipt,
} from '../types/zacma';

export function StudentPortalView({
  onOpenReceipt,
}: {
  onOpenReceipt: (receipt: Receipt) => void;
}) {
  const {
    user,
    profile,
    actualRole,
    previewRole,
    setPreviewRole,
    previewStudentId,
    setPreviewStudentId,
    signOutUser,
    students,
    enrollments,
    installments,
    payments,
    receipts,
    attendance,
    financialAdjustments,
    persistedNotifications,
    unreadMessagesCount,
    pushToast,
  } = usePortal();

  const [portalTab, setPortalTab] = useState<'overview' | 'attendance' | 'notifications' | 'messages'>('overview');
  const [notifCategory, setNotifCategory] = useState<'ALL' | 'PAYMENTS' | 'COURSES' | 'ATTENDANCE' | 'MESSAGES' | 'ADMIN'>('ALL');
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const today = todayAddisIsoDate();
  const isAdminPreview = actualRole === 'ADMIN' && previewRole === 'STUDENT';

  const activeStudentId = isAdminPreview
    ? previewStudentId || students[0]?.id || null
    : profile?.linkedStudentId || null;

  const student = useMemo(
    () => students.find((s) => s.id === activeStudentId) || null,
    [students, activeStudentId]
  );

  // Strictly isolated data slices for this student ONLY
  const myEnrollments = useMemo(
    () => enrollments.filter((e) => e.studentId === activeStudentId),
    [enrollments, activeStudentId]
  );

  const myInstallments = useMemo(
    () =>
      installments
        .filter((i) => i.studentId === activeStudentId)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [installments, activeStudentId]
  );

  const myPayments = useMemo(
    () =>
      payments
        .filter((p) => p.studentId === activeStudentId)
        .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)),
    [payments, activeStudentId]
  );

  const myReceipts = useMemo(
    () =>
      receipts
        .filter((r) => r.studentId === activeStudentId)
        .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    [receipts, activeStudentId]
  );

  const myAttendance = useMemo(
    () =>
      attendance
        .filter((a) => a.studentId === activeStudentId)
        .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate)),
    [attendance, activeStudentId]
  );

  const myAttendanceStats = useMemo(() => {
    const total = myAttendance.length;
    const present = myAttendance.filter((a) => a.status === 'PRESENT').length;
    const late = myAttendance.filter((a) => a.status === 'LATE').length;
    const absent = myAttendance.filter((a) => a.status === 'ABSENT').length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { total, present, late, absent, rate };
  }, [myAttendance]);

  const myAdjustments = useMemo(
    () =>
      financialAdjustments
        .filter((a) => a.studentId === activeStudentId)
        .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)),
    [financialAdjustments, activeStudentId]
  );

  const myNotifications = useMemo(
    () =>
      persistedNotifications
        .filter((n) => {
          if (n.recipientUid && user) return n.recipientUid === user.uid;
          if (n.targetRole === 'ALL') return true;
          return n.targetRole === 'STUDENT' && (!n.studentId || n.studentId === activeStudentId);
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [persistedNotifications, activeStudentId, user]
  );

  const filteredNotifications = useMemo(() => {
    if (notifCategory === 'ALL') return myNotifications;
    return myNotifications.filter((n) => {
      if (n.category) return n.category === notifCategory;
      if (notifCategory === 'PAYMENTS') {
        return n.type.includes('PAYMENT') || n.type.includes('BALANCE') || n.type === 'REGISTRATION_APPROVED';
      }
      if (notifCategory === 'COURSES') {
        return n.type === 'COURSE_ANNOUNCEMENT' || n.type === 'SCHEDULE_CHANGE';
      }
      if (notifCategory === 'ATTENDANCE') return n.type === 'ATTENDANCE_UPDATE';
      if (notifCategory === 'MESSAGES') {
        return n.type === 'NEW_INTERNAL_MESSAGE' || n.type === 'INSTRUCTOR_MESSAGE';
      }
      if (notifCategory === 'ADMIN') return n.type === 'ADMIN_ANNOUNCEMENT';
      return true;
    });
  }, [myNotifications, notifCategory]);

  const handleMarkAllRead = async () => {
    setMarkingAllRead(true);
    try {
      const count = await markAllNotificationsRead(myNotifications);
      if (count > 0) pushToast('success', `Marked ${count} notification(s) as read.`);
    } catch {
      pushToast('error', 'Unable to mark all notifications as read.');
    } finally {
      setMarkingAllRead(false);
    }
  };

  const totals = useMemo(() => {
    const agreedFee = myEnrollments.reduce((acc, e) => acc + e.agreedFeeEtb, 0);
    const approvedPaid = myEnrollments.reduce((acc, e) => acc + e.approvedPaidEtb, 0);
    const remaining = myEnrollments.reduce((acc, e) => acc + Math.max(0, e.remainingBalanceEtb), 0);
    const overdueInstallments = myInstallments.filter(
      (i) => i.status !== 'PAID' && i.dueDate < today && i.amountDueEtb > i.amountPaidEtb
    );
    const nextUpcoming = myInstallments.find(
      (i) => i.status !== 'PAID' && i.dueDate >= today && i.amountDueEtb > i.amountPaidEtb
    );
    const pendingPayments = myPayments.filter((p) => p.status === 'PENDING');
    return {
      agreedFee,
      approvedPaid,
      remaining,
      overdueInstallments,
      nextUpcoming,
      pendingPayments,
    };
  }, [myEnrollments, myInstallments, myPayments, today]);

  const unreadCount = myNotifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Standalone Student Portal Top Navigation (completely isolated from employee sidebar) */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 no-print">
        <div className="zacma-brand-stripe" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <ZacmaLogo
              variant="lockup"
              theme="dark"
              size="sm"
              framed
              subtitle="Student Fee & Payment Notification Portal"
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isAdminPreview && (
              <div className="flex items-center gap-2">
                <select
                  value={activeStudentId || ''}
                  onChange={(e) => setPreviewStudentId(e.target.value)}
                  className="text-xs bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5"
                  aria-label="Select student to preview"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.studentCode} — {s.fullName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setPreviewRole(null)}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white rounded-lg whitespace-nowrap"
                >
                  Exit Student Preview
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {isAdminPreview && (
        <div className="bg-blue-700 text-white px-4 py-2 text-xs text-center no-print">
          Admin Preview Mode: Viewing isolated Student Self-Service Portal for{' '}
          <strong>{student ? `${student.fullName} (${student.studentCode})` : 'selected student'}</strong>.
          Staff dashboards, internal accounting, and other students’ records are strictly inaccessible here.
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {!student ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-lg mx-auto">
            <ShieldCheck className="w-8 h-8 text-blue-700 mx-auto mb-3" />
            <h1 className="text-lg font-display font-bold text-slate-900">
              Student Record Not Linked Yet
            </h1>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Your portal login ({profile?.email}) has the STUDENT role, but an administrator has not
              yet linked your ZACMA Student ID. Please visit the ZACMA registrar office to link your account.
            </p>
          </div>
        ) : (
          <>
            {/* Student Identity Banner */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <Avatar src={student.photoUrl} name={student.fullName} size="lg" />
                <div className="min-w-0">
                  <p className="text-xs font-mono font-bold text-blue-700">{student.studentCode}</p>
                  <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 truncate">
                    {student.fullName}
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span>{student.courseName}</span>
                    <span>·</span>
                    <span>
                      Registered{' '}
                      <DualDateDisplay
                        isoDate={student.enrollmentDate}
                        ethiopianOverride={student.registrationDateEthiopian}
                        timeEat={student.registrationTimeEat}
                        inline
                      />
                    </span>
                    <span>·</span>
                    <span className="font-mono">{student.phone}</span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium text-slate-500">Registration Status</p>
                <div className="mt-1">
                  <StatusLabel status={student.registrationStatus} />
                </div>
              </div>
            </div>

            {/* Student Portal Workspace Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2.5 no-print">
              <button
                type="button"
                onClick={() => setPortalTab('overview')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                  portalTab === 'overview'
                    ? 'bg-[#172DEB] text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Fees, Schedule &amp; Receipts</span>
              </button>
              <button
                type="button"
                onClick={() => setPortalTab('attendance')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                  portalTab === 'attendance'
                    ? 'bg-[#172DEB] text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>My Attendance</span>
                {myAttendanceStats.total > 0 && (
                  <span className="ml-1 font-mono text-[11px] opacity-80 tabular-nums">
                    ({myAttendanceStats.rate}%)
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setPortalTab('notifications')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                  portalTab === 'notifications'
                    ? 'bg-[#172DEB] text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Notifications Center</span>
                {unreadCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-[#E51B23] text-white font-mono text-[10px] font-bold tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setPortalTab('messages')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                  portalTab === 'messages'
                    ? 'bg-[#172DEB] text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Messages</span>
                {unreadMessagesCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-[#E51B23] text-white font-mono text-[10px] font-bold tabular-nums">
                    {unreadMessagesCount}
                  </span>
                )}
              </button>
            </div>

            {portalTab === 'messages' && <MessagingView embedded />}

            {portalTab === 'attendance' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-medium text-slate-500">Attendance Rate</p>
                    <p className="text-2xl font-mono font-bold text-[#172DEB] tabular-nums mt-1">
                      {myAttendanceStats.rate}%
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                      {myAttendanceStats.total} recorded session{myAttendanceStats.total === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-medium text-slate-500">Present</p>
                    <p className="text-2xl font-mono font-bold text-emerald-700 tabular-nums mt-1">
                      {myAttendanceStats.present}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">On-time sessions</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-medium text-slate-500">Late</p>
                    <p className="text-2xl font-mono font-bold text-amber-700 tabular-nums mt-1">
                      {myAttendanceStats.late}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Arrived late</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-medium text-slate-500">Absent</p>
                    <p className="text-2xl font-mono font-bold text-[#E51B23] tabular-nums mt-1">
                      {myAttendanceStats.absent}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Missed sessions</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">My Personal Attendance Record</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Strictly isolated to your own ZACMA class attendance history (Gregorian &amp; Ethiopian dates).
                      </p>
                    </div>
                  </div>
                  {myAttendance.length === 0 ? (
                    <EmptyState
                      title="No attendance records logged yet"
                      description="Your classroom attendance entries will appear here once recorded by your instructor."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                            <th className="py-3 px-4">Date (Gregorian &amp; Ethiopian)</th>
                            <th className="py-3 px-3">Course</th>
                            <th className="py-3 px-3">Status</th>
                            <th className="py-3 px-3">Notes</th>
                            <th className="py-3 px-4 text-right">Recorded By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {myAttendance.map((rec) => (
                            <tr key={rec.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-4 whitespace-nowrap text-slate-800">
                                <DualDateDisplay isoDate={rec.attendanceDate} />
                              </td>
                              <td className="py-3 px-3 font-medium text-slate-900">{rec.courseName}</td>
                              <td className="py-3 px-3">
                                <StatusLabel status={rec.status} />
                              </td>
                              <td className="py-3 px-3 text-slate-600">{rec.remarks || '—'}</td>
                              <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                                {rec.recordedByName}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {portalTab === 'notifications' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Student Portal Notification Center
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Payment confirmations, course announcements, attendance notices, and direct message alerts.
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      disabled={markingAllRead}
                      onClick={() => void handleMarkAllRead()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#172DEB] text-white hover:bg-[#263FEF] disabled:opacity-50"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>{markingAllRead ? 'Updating...' : 'Mark All as Read'}</span>
                    </button>
                  )}
                </div>

                <div className="px-4 py-2.5 bg-[#F5F7FC] border-b border-slate-200 flex flex-wrap gap-1.5">
                  {(['ALL', 'PAYMENTS', 'COURSES', 'ATTENDANCE', 'MESSAGES', 'ADMIN'] as const).map(
                    (cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNotifCategory(cat)}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                          notifCategory === cat
                            ? 'bg-[#172DEB] text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {cat === 'ALL'
                          ? 'All'
                          : cat.charAt(0) + cat.slice(1).toLowerCase()}
                      </button>
                    )
                  )}
                </div>

                {filteredNotifications.length === 0 ? (
                  <div className="p-10 text-center">
                    <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-900">No notifications in this category</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Notifications sent while you are offline remain stored here until you read them.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredNotifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                          n.isRead ? 'bg-white' : 'bg-[#F5F7FC]'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {!n.isRead && (
                              <span className="w-2 h-2 rounded-full bg-[#E51B23] shrink-0" />
                            )}
                            <p
                              className={`text-xs font-bold ${
                                n.type === 'PAYMENT_OVERDUE' || n.type === 'PAYMENT_REJECTED'
                                  ? 'text-[#E51B23]'
                                  : n.type === 'PAYMENT_APPROVED' || n.type === 'REGISTRATION_APPROVED'
                                  ? 'text-emerald-700'
                                  : 'text-[#172DEB]'
                              }`}
                            >
                              {n.title}
                            </p>
                            {n.courseName && (
                              <span className="text-[11px] text-slate-500">· {n.courseName}</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed">{n.message}</p>
                          <p className="text-[11px] text-slate-400 tabular-nums">
                            {formatAddisDateTimeDual(n.createdAt)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {(n.actionSection === 'messages' ||
                            n.type === 'NEW_INTERNAL_MESSAGE' ||
                            n.type === 'INSTRUCTOR_MESSAGE') && (
                            <button
                              type="button"
                              onClick={() => setPortalTab('messages')}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-[#172DEB] text-[#172DEB] hover:bg-blue-50"
                            >
                              Open Messages
                            </button>
                          )}
                          {!n.isRead && (
                            <button
                              type="button"
                              onClick={() => void markNotificationRead(n.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {portalTab === 'overview' && (
              <>

            {/* Overdue Alert Banner if any unpaid past-due installments exist */}
            {totals.overdueInstallments.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-900">
                      {totals.overdueInstallments.length} Overdue Installment
                      {totals.overdueInstallments.length > 1 ? 's' : ''} Require Attention
                    </p>
                    <p className="text-xs text-red-800 mt-0.5">
                      Please settle your overdue fee balance at the ZACMA accounts office or via CBE Birr / Telebirr so your enrollment stays in good standing. Only Admin-approved payments clear overdue status.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Personal Balance Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-slate-500">Total Course Tuition</p>
                <p className="text-xl font-mono font-bold text-slate-900 tabular-nums mt-2">
                  {formatEtbCompact(totals.agreedFee)}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Plan: {myEnrollments[0]?.paymentPlanName || student.paymentPlanCode}
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-slate-500">Approved Amount Paid</p>
                <p className="text-xl font-mono font-bold text-emerald-700 tabular-nums mt-2">
                  {formatEtbCompact(totals.approvedPaid)}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {totals.pendingPayments.length > 0
                    ? `${totals.pendingPayments.length} submission(s) awaiting approval`
                    : 'All receipts verified'}
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-slate-500">Remaining Balance</p>
                <p
                  className={`text-xl font-mono font-bold tabular-nums mt-2 ${
                    totals.remaining > 0 ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {formatEtbCompact(totals.remaining)}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {totals.remaining <= 0 ? 'Tuition fully settled' : 'Outstanding approved balance'}
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-slate-500">Next Payment Deadline</p>
                <div className="mt-2">
                  {totals.overdueInstallments.length > 0 ? (
                    <p className="text-lg font-display font-bold text-[#E51B23]">Overdue Now</p>
                  ) : totals.nextUpcoming ? (
                    <DualDateDisplay isoDate={totals.nextUpcoming.dueDate} />
                  ) : (
                    <p className="text-lg font-display font-bold text-slate-900">No Upcoming Due</p>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                  {totals.overdueInstallments.length > 0
                    ? `Due ${totals.overdueInstallments[0].dueDate}`
                    : totals.nextUpcoming
                    ? formatEtb(totals.nextUpcoming.amountDueEtb - totals.nextUpcoming.amountPaidEtb)
                    : 'Up to date'}
                </p>
              </div>
            </div>

            {/* Installment Schedule + Student Notifications */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-blue-700" />
                    <h2 className="text-sm font-bold text-slate-900">
                      My Payment Schedule &amp; Deadlines
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    {myInstallments.length} installment{myInstallments.length === 1 ? '' : 's'}
                  </span>
                </div>
                {myInstallments.length === 0 ? (
                  <EmptyState
                    title="No installment schedule found"
                    description="Your payment schedule will appear once your enrollment is processed."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                          <th className="py-2.5 px-4">Installment</th>
                          <th className="py-2.5 px-3">Due Date</th>
                          <th className="py-2.5 px-3 text-right">Expected</th>
                          <th className="py-2.5 px-3 text-right">Paid</th>
                          <th className="py-2.5 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {myInstallments.map((inst) => {
                          const isOverdue =
                            inst.status !== 'PAID' &&
                            inst.dueDate < today &&
                            inst.amountDueEtb > inst.amountPaidEtb;
                          return (
                            <tr key={inst.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                Installment #{inst.installmentNumber}
                                <p className="text-[11px] font-normal text-slate-500">
                                  {inst.courseName}
                                </p>
                              </td>
                              <td
                                className={`py-3 px-3 whitespace-nowrap font-medium ${
                                  isOverdue ? 'text-red-700' : 'text-slate-700'
                                }`}
                              >
                                <DualDateDisplay isoDate={inst.dueDate} />
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900">
                                {formatEtb(inst.amountDueEtb)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-700">
                                {formatEtb(inst.amountPaidEtb)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <StatusLabel status={isOverdue ? 'OVERDUE' : inst.status} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-700" />
                    <h2 className="text-sm font-bold text-slate-900">Recent Alerts &amp; Notices</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-red-700 tabular-nums">
                      {unreadCount} unread
                    </span>
                    <button
                      type="button"
                      onClick={() => setPortalTab('notifications')}
                      className="text-[11px] font-semibold text-[#172DEB] hover:underline"
                    >
                      View all
                    </button>
                  </div>
                </div>
                {myNotifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-900">No active alerts</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Payment confirmations, course notices, and announcements appear here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {myNotifications.slice(0, 6).map((n) => (
                      <div
                        key={n.id}
                        className={`p-4 space-y-1.5 ${n.isRead ? 'bg-white' : 'bg-blue-50/40'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-xs font-bold ${
                              n.type === 'PAYMENT_OVERDUE' || n.type === 'PAYMENT_REJECTED'
                                ? 'text-red-700'
                                : n.type === 'PAYMENT_APPROVED' || n.type === 'REGISTRATION_APPROVED'
                                ? 'text-emerald-700'
                                : 'text-blue-700'
                            }`}
                          >
                            {n.title}
                          </p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap tabular-nums">
                            {formatAddisDateTimeDual(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                        {!n.isRead && (
                          <button
                            type="button"
                            onClick={() => void markNotificationRead(n.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline pt-0.5"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            Mark as read
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Payment History & Printable Official Receipts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-700" />
                  <h2 className="text-sm font-bold text-slate-900">My Payment History</h2>
                </div>
                {myPayments.length === 0 ? (
                  <EmptyState
                    title="No payments submitted yet"
                    description="Your submitted and approved tuition payments will be listed here."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                          <th className="py-2.5 px-4">Reference &amp; Method</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-4 text-right">Amount (ETB)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {myPayments.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-4">
                              <p className="font-mono font-semibold text-slate-900">
                                {p.transactionRef}
                              </p>
                              <p className="text-[11px] text-slate-500">{p.paymentMethod}</p>
                            </td>
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                              <DualDateDisplay isoDate={p.paymentDate} />
                            </td>
                            <td className="py-3 px-3">
                              <StatusLabel status={p.status} />
                              {p.rejectionReason && (
                                <p className="text-[11px] text-red-600 mt-0.5">{p.rejectionReason}</p>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                              {formatEtb(p.amountEtb)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-700" />
                  <h2 className="text-sm font-bold text-slate-900">Official Approved Receipts</h2>
                </div>
                {myReceipts.length === 0 ? (
                  <EmptyState
                    title="No approved receipts yet"
                    description="Official ZACMA receipts appear automatically after payment approval."
                  />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {myReceipts.map((rcp) => (
                      <div
                        key={rcp.id}
                        className="px-5 py-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-mono font-bold text-slate-900">
                            {rcp.receiptNumber}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            <DualDateDisplay isoDate={rcp.paymentDate} inline /> · {rcp.paymentMethod} ·{' '}
                            <span className="font-mono font-semibold text-slate-700">
                              {formatEtbCompact(rcp.amountPaidEtb)}
                            </span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenReceipt(rcp)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg shrink-0"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Authorized Refunds, Discounts & Fee Adjustments (if any) */}
            {myAdjustments.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-blue-700" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Authorized Account Adjustments &amp; Refunds
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                        <th className="py-2.5 px-4">Reference</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-4 text-right">Amount (ETB)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {myAdjustments.map((adj) => (
                        <tr key={adj.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                            {adj.adjustmentRef}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                            <DualDateDisplay isoDate={adj.effectiveDate} />
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold text-blue-700">
                            {adj.type.replace(/_/g, ' ')}
                          </td>
                          <td className="py-3 px-3 text-slate-700">{adj.reason}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                            {formatEtb(adj.amountEtb)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
