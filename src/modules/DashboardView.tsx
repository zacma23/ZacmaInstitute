import React, { useMemo } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  CreditCard,
  Printer,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePortal } from '../context/PortalContext';
import { Avatar, EmptyState, StatusLabel } from '../components/PortalUI';
import { GeneralStaffView } from './GeneralStaffView';
import {
  addDaysIso,
  formatDateShort,
  formatEtb,
  formatEtbCompact,
  NavSection,
  Receipt,
  todayIsoDate,
} from '../types/zacma';

export function DashboardView({
  onNavigate,
  onOpenReceipt,
}: {
  onNavigate: (tab: NavSection) => void;
  onOpenReceipt: (receipt: Receipt) => void;
}) {
  const {
    profile,
    effectiveRole,
    courses,
    students,
    enrollments,
    installments,
    payments,
    receipts,
    expenses,
    attendance,
  } = usePortal();

  const today = todayIsoDate();
  const next14Days = addDaysIso(today, 14);

  // Strict General Staff non-financial operational dashboard
  if (effectiveRole === 'GENERAL_STAFF') {
    return <GeneralStaffView onNavigate={onNavigate} />;
  }

  // Strict Instructor-only non-financial dashboard
  if (effectiveRole === 'INSTRUCTOR') {
    const myCourses = courses.filter(
      (c) => c.instructorId === profile?.uid || c.isActive
    );
    const activeEnrollments = enrollments.filter((e) => e.status === 'ACTIVE');
    const todayAtt = attendance.filter((a) => a.attendanceDate === today);
    const presentToday = todayAtt.filter((a) => a.status === 'PRESENT').length;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
              Instructor Academic Workspace
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Assigned classes, enrolled students, and daily attendance overview.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('attendance')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <ClipboardCheck className="w-4 h-4" />
            Record Daily Attendance
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Assigned / Active Classes</p>
            <p className="text-2xl font-display font-bold text-slate-900 tabular-nums mt-2">
              {myCourses.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">Active ZACMA training tracks</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Active Enrolled Students</p>
            <p className="text-2xl font-display font-bold text-slate-900 tabular-nums mt-2">
              {activeEnrollments.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">Approved for classroom attendance</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Attendance Logged Today</p>
            <p className="text-2xl font-display font-bold text-emerald-700 tabular-nums mt-2">
              {todayAtt.length}{' '}
              <span className="text-sm font-medium text-slate-500">({presentToday} Present)</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">{formatDateShort(today)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Class Schedule &amp; Enrollment</h2>
              <button
                type="button"
                onClick={() => onNavigate('courses')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1"
              >
                All classes <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {myCourses.slice(0, 6).map((course) => {
                const count = activeEnrollments.filter((e) => e.courseId === course.id).length;
                return (
                  <div key={course.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{course.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <span className="font-mono">{course.code}</span> · {course.schedule}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono font-semibold text-slate-900 tabular-nums">
                        {count} enrolled
                      </p>
                      <p className="text-xs text-slate-500">{course.instructorName || 'Staff'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Recent Attendance Entries</h2>
              <button
                type="button"
                onClick={() => onNavigate('attendance')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1"
              >
                Open roster <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {attendance.length === 0 ? (
              <EmptyState
                title="No attendance entries yet"
                description="Start logging daily student attendance for your assigned classes."
                actionLabel="Take Attendance"
                onAction={() => onNavigate('attendance')}
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {attendance.slice(0, 6).map((row) => (
                  <div key={row.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {row.studentName}
                      </p>
                      <p className="text-xs text-slate-500">
                        <span className="font-mono">{row.studentCode}</span> · {row.courseName} ·{' '}
                        {formatDateShort(row.attendanceDate)}
                      </p>
                    </div>
                    <StatusLabel status={row.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Financial & Executive metrics (Admin & Accountant)
  const metrics = useMemo(() => {
    const totalStudents = students.length;
    const activeStudents = students.filter((s) => s.registrationStatus === 'APPROVED').length;
    const pendingStudents = students.filter((s) => s.registrationStatus === 'PENDING').length;
    const totalCourses = courses.filter((c) => c.isActive).length;

    // Strict financial rule: ONLY APPROVED payments count as official collected income!
    const approvedPayments = payments.filter((p) => p.status === 'APPROVED');
    const pendingPayments = payments.filter((p) => p.status === 'PENDING');
    const totalApprovedIncome = approvedPayments.reduce((acc, p) => acc + p.amountEtb, 0);
    const totalPendingAmount = pendingPayments.reduce((acc, p) => acc + p.amountEtb, 0);

    const activeEnrollments = enrollments.filter(
      (e) => e.status === 'ACTIVE' || e.status === 'COMPLETED'
    );
    const totalOutstandingFees = activeEnrollments.reduce(
      (acc, e) => acc + Math.max(0, e.remainingBalanceEtb),
      0
    );

    const totalExpenses = expenses.reduce((acc, e) => acc + e.amountEtb, 0);
    const netCashFlow = totalApprovedIncome - totalExpenses;

    return {
      totalStudents,
      activeStudents,
      pendingStudents,
      totalCourses,
      totalApprovedIncome,
      totalPendingAmount,
      pendingPaymentsCount: pendingPayments.length,
      totalOutstandingFees,
      totalExpenses,
      netCashFlow,
    };
  }, [students, courses, payments, enrollments, expenses]);

  // Monthly Revenue vs Expenses Chart Data (last 6 months)
  const monthlySeries = useMemo(() => {
    const map = new Map<string, { month: string; key: string; income: number; expenses: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      map.set(key, { month: label, key, income: 0, expenses: 0 });
    }

    for (const p of payments) {
      if (p.status !== 'APPROVED') continue;
      const key = p.paymentDate.slice(0, 7);
      const bucket = map.get(key);
      if (bucket) bucket.income += p.amountEtb;
    }

    for (const e of expenses) {
      const key = e.expenseDate.slice(0, 7);
      const bucket = map.get(key);
      if (bucket) bucket.expenses += e.amountEtb;
    }

    return Array.from(map.values());
  }, [payments, expenses]);

  const upcomingDeadlines = useMemo(() => {
    return installments
      .filter((i) => i.status !== 'PAID' && i.amountDueEtb > i.amountPaidEtb && i.dueDate <= next14Days)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 6);
  }, [installments, next14Days]);

  const pendingPaymentsList = useMemo(
    () => payments.filter((p) => p.status === 'PENDING').slice(0, 4),
    [payments]
  );

  const pendingStudentsList = useMemo(
    () => students.filter((s) => s.registrationStatus === 'PENDING').slice(0, 4),
    [students]
  );

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
            {effectiveRole === 'ADMIN' ? 'Executive Financial Dashboard' : 'Accountant Operations Desk'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Live ETB fee collections, enrollment status, and maker-checker approval queue.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('students')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            Register Student
          </button>
          <button
            type="button"
            onClick={() => onNavigate('payments')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Students Enrolled</span>
            <Users className="w-4 h-4 text-blue-700" />
          </div>
          <p className="text-2xl font-display font-bold text-slate-900 tabular-nums">
            {metrics.totalStudents}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            <span className="font-semibold text-emerald-700">{metrics.activeStudents} active</span> ·{' '}
            <span className="font-semibold text-amber-700">{metrics.pendingStudents} pending</span> ·{' '}
            {metrics.totalCourses} courses
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Approved Income</span>
            <TrendingUp className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="text-2xl font-mono font-bold text-slate-900 tabular-nums">
            {formatEtbCompact(metrics.totalApprovedIncome)}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            {metrics.pendingPaymentsCount > 0 ? (
              <span className="text-amber-700 font-medium">
                +{formatEtbCompact(metrics.totalPendingAmount)} pending (excluded)
              </span>
            ) : (
              <span>All submitted payments settled</span>
            )}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Outstanding Student Fees</span>
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-mono font-bold text-red-700 tabular-nums">
            {formatEtbCompact(metrics.totalOutstandingFees)}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            Receivable balance across active cohorts
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">
              {effectiveRole === 'ADMIN' ? 'Net Cash Flow' : 'Total Courses'}
            </span>
            {effectiveRole === 'ADMIN' ? (
              <Wallet className="w-4 h-4 text-blue-700" />
            ) : (
              <BookOpen className="w-4 h-4 text-blue-700" />
            )}
          </div>
          {effectiveRole === 'ADMIN' ? (
            <>
              <p
                className={`text-2xl font-mono font-bold tabular-nums ${
                  metrics.netCashFlow >= 0 ? 'text-slate-900' : 'text-red-700'
                }`}
              >
                {formatEtbCompact(metrics.netCashFlow)}
              </p>
              <p className="text-xs text-slate-500 mt-1.5 inline-flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                <span>Expenses: {formatEtbCompact(metrics.totalExpenses)}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-display font-bold text-slate-900 tabular-nums">
                {metrics.totalCourses}
              </p>
              <p className="text-xs text-slate-500 mt-1.5">Active fee schedules configured</p>
            </>
          )}
        </div>
      </div>

      {/* Main Analytics + Pending Approvals Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Revenue Chart */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Monthly Approved Income vs. Operational Expenses
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                6-month cash performance in Ethiopian Birr (ETB) — excludes pending submissions
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-700" />
                Approved Income
              </span>
              {effectiveRole === 'ADMIN' && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-red-600" />
                  Expenses
                </span>
              )}
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                />
                <Tooltip
                  formatter={(value: unknown) => formatEtb(Number(value || 0))}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="income" name="Approved Income" fill="#1d4ed8" radius={[4, 4, 0, 0]} maxBarSize={36} />
                {effectiveRole === 'ADMIN' && (
                  <Bar dataKey="expenses" name="Expenses" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={36} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pending Approvals Panel */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Pending Approvals</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {metrics.pendingStudents} registrations · {metrics.pendingPaymentsCount} payments
              </p>
            </div>
            {effectiveRole === 'ADMIN' && (
              <button
                type="button"
                onClick={() => onNavigate('approvals')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap"
              >
                Review all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {pendingPaymentsList.length === 0 && pendingStudentsList.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-900">Approval queue is clear</p>
                <p className="text-xs text-slate-500 mt-1">
                  No pending registrations or fee submissions waiting.
                </p>
              </div>
            ) : (
              <>
                {pendingPaymentsList.map((p) => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        Payment · {p.studentName}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                        {p.transactionRef} · {p.paymentMethod}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono font-bold text-amber-700 tabular-nums">
                        {formatEtbCompact(p.amountEtb)}
                      </p>
                      <p className="text-[11px] text-slate-500">Pending</p>
                    </div>
                  </div>
                ))}
                {pendingStudentsList.map((s) => (
                  <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar src={s.photoUrl} name={s.fullName} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          Registration · {s.fullName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          <span className="font-mono">{s.studentCode}</span> · {s.courseName}
                        </p>
                      </div>
                    </div>
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Split: Recent Transactions + Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Recent Transactions</h2>
            <button
              type="button"
              onClick={() => onNavigate('payments')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1"
            >
              Full ledger <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Reference / Student</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-4 text-right">Amount (ETB)</th>
                  <th className="py-2.5 px-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {payments.slice(0, 6).map((p) => {
                  const rcp = receipts.find((r) => r.paymentId === p.id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{p.studentName}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {p.transactionRef} · {p.paymentMethod}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {formatDateShort(p.paymentDate)}
                      </td>
                      <td className="py-3 px-3">
                        <StatusLabel status={p.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatEtb(p.amountEtb)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {p.status === 'APPROVED' && rcp ? (
                          <button
                            type="button"
                            onClick={() => onOpenReceipt(rcp)}
                            className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold whitespace-nowrap"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Print
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-red-600" />
              <h2 className="text-sm font-bold text-slate-900">Upcoming &amp; Overdue Deadlines</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('payments')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800"
            >
              Collect fee
            </button>
          </div>
          {upcomingDeadlines.length === 0 ? (
            <EmptyState
              title="No imminent deadlines"
              description="All student installments due in the next 14 days are settled."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingDeadlines.map((inst) => {
                const isOverdue = inst.dueDate < today;
                const dueRemaining = inst.amountDueEtb - inst.amountPaidEtb;
                return (
                  <div key={inst.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {inst.studentName}{' '}
                        <span className="font-mono font-normal text-slate-500">
                          · {inst.studentCode}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {inst.courseName} · Installment #{inst.installmentNumber}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-xs font-mono font-bold tabular-nums ${
                          isOverdue ? 'text-red-700' : 'text-slate-900'
                        }`}
                      >
                        {formatEtbCompact(dueRemaining)}
                      </p>
                      <p
                        className={`text-[11px] font-medium ${
                          isOverdue ? 'text-red-600' : 'text-amber-700'
                        }`}
                      >
                        {isOverdue ? `Overdue ${formatDateShort(inst.dueDate)}` : `Due ${formatDateShort(inst.dueDate)}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
