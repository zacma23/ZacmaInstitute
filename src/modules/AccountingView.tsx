import React, { useMemo, useState } from 'react';
import {
  Download,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  X,
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
import {
  createExpenseCategory,
  createExpenseRecord,
  deleteExpenseRecord,
  exportRowsToCsv,
} from '../lib/zacmaService';
import { ConfirmDialog, EmptyState, PaginationBar, StatusLabel } from '../components/PortalUI';
import {
  addDaysIso,
  Expense,
  formatDateShort,
  formatEtb,
  formatEtbCompact,
  PaymentMethod,
  todayIsoDate,
} from '../types/zacma';

type PeriodFilter = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL' | 'ALL';
type AccountingTab = 'cashflow' | 'expenses' | 'by_course' | 'outstanding';

export function AccountingView() {
  const {
    profile,
    effectiveRole,
    courses,
    enrollments,
    installments,
    payments,
    expenses,
    expenseCategories,
    pushToast,
  } = usePortal();

  const [period, setPeriod] = useState<PeriodFilter>('ALL');
  const [tab, setTab] = useState<AccountingTab>('cashflow');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCatFilter, setExpenseCatFilter] = useState('ALL');
  const [outstandingSearch, setOutstandingSearch] = useState('');
  const [expPage, setExpPage] = useState(1);

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [busy, setBusy] = useState(false);

  if (effectiveRole === 'INSTRUCTOR') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <ShieldAlert className="w-7 h-7 text-red-600 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">Financial Module Restricted</h2>
        <p className="text-xs text-slate-500 mt-1">
          Instructors do not have access to accounting reports, income ledgers, or expenses.
        </p>
      </div>
    );
  }

  const isAdmin = effectiveRole === 'ADMIN';
  const today = todayIsoDate();

  const inPeriod = (dateStr: string): boolean => {
    if (period === 'ALL') return true;
    if (period === 'DAILY') return dateStr === today;
    if (period === 'WEEKLY') return dateStr >= addDaysIso(today, -7);
    if (period === 'MONTHLY') return dateStr.slice(0, 7) === today.slice(0, 7);
    if (period === 'ANNUAL') return dateStr.slice(0, 4) === today.slice(0, 4);
    return true;
  };

  // Strict financial invariant: ONLY APPROVED payments are ever counted as official income
  const periodApprovedPayments = useMemo(
    () => payments.filter((p) => p.status === 'APPROVED' && inPeriod(p.paymentDate)),
    [payments, period, today]
  );

  const periodExpenses = useMemo(
    () => expenses.filter((e) => inPeriod(e.expenseDate)),
    [expenses, period, today]
  );

  const summary = useMemo(() => {
    const approvedIncome = periodApprovedPayments.reduce((acc, p) => acc + p.amountEtb, 0);
    const totalExpenses = periodExpenses.reduce((acc, e) => acc + e.amountEtb, 0);
    const pendingExcluded = payments
      .filter((p) => p.status === 'PENDING' && inPeriod(p.paymentDate))
      .reduce((acc, p) => acc + p.amountEtb, 0);
    const outstandingTotal = enrollments
      .filter((e) => e.status === 'ACTIVE' || e.status === 'COMPLETED')
      .reduce((acc, e) => acc + Math.max(0, e.remainingBalanceEtb), 0);

    return {
      approvedIncome,
      totalExpenses,
      netCashFlow: approvedIncome - totalExpenses,
      pendingExcluded,
      outstandingTotal,
    };
  }, [periodApprovedPayments, periodExpenses, payments, enrollments, period, today]);

  const cashFlowLedger = useMemo(() => {
    const rows: Array<{
      id: string;
      date: string;
      type: 'INCOME' | 'EXPENSE';
      reference: string;
      description: string;
      method: string;
      amountEtb: number;
    }> = [];

    for (const p of periodApprovedPayments) {
      rows.push({
        id: `inc_${p.id}`,
        date: p.paymentDate,
        type: 'INCOME',
        reference: p.receiptNumber || p.transactionRef,
        description: `${p.studentName} (${p.studentCode}) — ${p.courseName}`,
        method: p.paymentMethod,
        amountEtb: p.amountEtb,
      });
    }
    for (const e of periodExpenses) {
      rows.push({
        id: `exp_${e.id}`,
        date: e.expenseDate,
        type: 'EXPENSE',
        reference: e.referenceNo || 'EXPENSE',
        description: `${e.title} (${e.categoryName})`,
        method: e.paymentMethod,
        amountEtb: -e.amountEtb,
      });
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [periodApprovedPayments, periodExpenses]);

  const revenueByCourse = useMemo(() => {
    return courses
      .map((c) => {
        const courseEnrs = enrollments.filter(
          (e) => e.courseId === c.id && (e.status === 'ACTIVE' || e.status === 'COMPLETED')
        );
        const approvedCollected = periodApprovedPayments
          .filter((p) => p.courseId === c.id)
          .reduce((acc, p) => acc + p.amountEtb, 0);
        const agreedTotal = courseEnrs.reduce((acc, e) => acc + e.agreedFeeEtb, 0);
        const outstanding = courseEnrs.reduce((acc, e) => acc + Math.max(0, e.remainingBalanceEtb), 0);
        const rate = agreedTotal > 0 ? Math.round(((agreedTotal - outstanding) / agreedTotal) * 100) : 0;
        return {
          id: c.id,
          code: c.code,
          name: c.name,
          shortName: c.name.length > 16 ? `${c.name.slice(0, 15)}…` : c.name,
          students: courseEnrs.length,
          agreedTotal,
          approvedCollected,
          outstanding,
          rate,
        };
      })
      .sort((a, b) => b.approvedCollected - a.approvedCollected);
  }, [courses, enrollments, periodApprovedPayments]);

  const filteredExpenses = useMemo(() => {
    const q = expenseSearch.trim().toLowerCase();
    return periodExpenses.filter((e) => {
      if (expenseCatFilter !== 'ALL' && e.categoryId !== expenseCatFilter) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.categoryName.toLowerCase().includes(q) ||
        (e.referenceNo || '').toLowerCase().includes(q)
      );
    });
  }, [periodExpenses, expenseSearch, expenseCatFilter]);

  const outstandingEnrollments = useMemo(() => {
    const q = outstandingSearch.trim().toLowerCase();
    return enrollments
      .filter((e) => e.status === 'ACTIVE' && e.remainingBalanceEtb > 0)
      .filter((e) => {
        if (!q) return true;
        return (
          e.studentName.toLowerCase().includes(q) ||
          e.studentCode.toLowerCase().includes(q) ||
          e.courseName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.remainingBalanceEtb - a.remainingBalanceEtb);
  }, [enrollments, outstandingSearch]);

  const handleExportCashFlow = () => {
    exportRowsToCsv(
      `zacma-cashflow-${period.toLowerCase()}-${today}.csv`,
      ['Date', 'Type', 'Reference', 'Description', 'Payment Method', 'Amount (ETB)'],
      cashFlowLedger.map((r) => [
        r.date,
        r.type,
        r.reference,
        r.description,
        r.method,
        r.amountEtb.toFixed(2),
      ])
    );
    pushToast('success', 'Exported cash-flow report to CSV.');
  };

  const handleExportOutstanding = () => {
    exportRowsToCsv(
      `zacma-outstanding-fees-${today}.csv`,
      ['Student ID', 'Student Name', 'Course', 'Agreed Fee (ETB)', 'Approved Paid (ETB)', 'Outstanding (ETB)'],
      outstandingEnrollments.map((e) => [
        e.studentCode,
        e.studentName,
        e.courseName,
        e.agreedFeeEtb.toFixed(2),
        e.approvedPaidEtb.toFixed(2),
        e.remainingBalanceEtb.toFixed(2),
      ])
    );
    pushToast('success', 'Exported outstanding balances to CSV.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
            Accounting &amp; Financial Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Official ETB income, institutional expenses, cash-flow statements, and course revenue analytics.
          </p>
        </div>

        {/* Period Filter */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              ['DAILY', 'Daily'],
              ['WEEKLY', 'Weekly'],
              ['MONTHLY', 'Monthly'],
              ['ANNUAL', 'Annual'],
              ['ALL', 'All-Time'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                period === key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Financial Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Approved Income ({period.toLowerCase()})</p>
          <p className="text-xl font-mono font-bold text-emerald-700 tabular-nums mt-1.5">
            {formatEtb(summary.approvedIncome)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Pending excluded: {formatEtbCompact(summary.pendingExcluded)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Total Expenses ({period.toLowerCase()})</p>
          <p className="text-xl font-mono font-bold text-red-700 tabular-nums mt-1.5">
            {formatEtb(summary.totalExpenses)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {periodExpenses.length} expense voucher{periodExpenses.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Net Cash Flow</p>
          <p
            className={`text-xl font-mono font-bold tabular-nums mt-1.5 ${
              summary.netCashFlow >= 0 ? 'text-blue-700' : 'text-red-700'
            }`}
          >
            {formatEtb(summary.netCashFlow)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Approved income minus expenses</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Total Outstanding Tuition</p>
          <p className="text-xl font-mono font-bold text-slate-900 tabular-nums mt-1.5">
            {formatEtb(summary.outstandingTotal)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Across {outstandingEnrollments.length} active balances
          </p>
        </div>
      </div>

      {/* Sub-Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['cashflow', 'Cash-Flow Statement'],
              ['expenses', 'Expenses & Categories'],
              ['by_course', 'Revenue by Course'],
              ['outstanding', 'Outstanding Student Fees'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                tab === key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {tab === 'cashflow' && (
            <button
              type="button"
              onClick={handleExportCashFlow}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
          {tab === 'outstanding' && (
            <button
              type="button"
              onClick={handleExportOutstanding}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
          {tab === 'expenses' && isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
              >
                Add Category
              </button>
              <button
                type="button"
                onClick={() => setShowExpenseModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                Record Expense
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab 1: Cash Flow */}
      {tab === 'cashflow' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {cashFlowLedger.length === 0 ? (
            <EmptyState
              title="No approved financial entries in this period"
              description="Switch the period selector above to view historical cash-flow movements."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Reference</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3">Method</th>
                    <th className="py-3 px-4 text-right">Amount (ETB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {cashFlowLedger.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                        {formatDateShort(r.date)}
                      </td>
                      <td className="py-3 px-3 font-semibold">
                        <span className={r.type === 'INCOME' ? 'text-emerald-700' : 'text-red-700'}>
                          {r.type === 'INCOME' ? 'Approved Income' : 'Expense'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700">{r.reference}</td>
                      <td className="py-3 px-3 text-slate-900 font-medium">{r.description}</td>
                      <td className="py-3 px-3 text-slate-600">{r.method}</td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                          r.amountEtb >= 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {r.amountEtb >= 0 ? '+' : ''}
                        {formatEtb(r.amountEtb)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Expenses */}
      {tab === 'expenses' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={expenseSearch}
                onChange={(e) => {
                  setExpenseSearch(e.target.value);
                  setExpPage(1);
                }}
                placeholder="Search expense title, voucher ref..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
            <select
              value={expenseCatFilter}
              onChange={(e) => {
                setExpenseCatFilter(e.target.value);
                setExpPage(1);
              }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="ALL">All Expense Categories</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {filteredExpenses.length === 0 ? (
              <EmptyState
                title="No expenses recorded in this period"
                description="Log operational expenses to track ZACMA net cash flow accurately."
                actionLabel={isAdmin ? 'Record Expense' : undefined}
                onAction={isAdmin ? () => setShowExpenseModal(true) : undefined}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-3">Expense Title &amp; Category</th>
                      <th className="py-3 px-3">Method &amp; Ref</th>
                      <th className="py-3 px-3">Recorded By</th>
                      <th className="py-3 px-3 text-right">Amount (ETB)</th>
                      {isAdmin && <th className="py-3 px-4 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredExpenses.slice((expPage - 1) * 8, expPage * 8).map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                          {formatDateShort(exp.expenseDate)}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-900">{exp.title}</p>
                          <p className="text-[11px] text-slate-500">{exp.categoryName}</p>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          <p>{exp.paymentMethod}</p>
                          <p className="text-[11px] font-mono text-slate-500">
                            {exp.referenceNo || '—'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{exp.recordedByName}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-red-700 tabular-nums whitespace-nowrap">
                          {formatEtb(exp.amountEtb)}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setDeletingExpense(exp)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-md"
                              aria-label="Delete expense"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <PaginationBar
              page={expPage}
              pageSize={8}
              total={filteredExpenses.length}
              onPageChange={setExpPage}
            />
          </div>
        </div>
      )}

      {/* Tab 3: Revenue by Course */}
      {tab === 'by_course' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-4">
              Approved Tuition Revenue by Course (ETB)
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByCourse} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="shortName" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                  />
                  <Tooltip formatter={(val: unknown) => formatEtb(Number(val || 0))} />
                  <Bar dataKey="approvedCollected" name="Approved Revenue" fill="#1d4ed8" radius={[4, 4, 0, 0]} maxBarSize={42} />
                  <Bar dataKey="outstanding" name="Outstanding" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">Course</th>
                    <th className="py-3 px-3 text-right">Active Students</th>
                    <th className="py-3 px-3 text-right">Agreed Tuition</th>
                    <th className="py-3 px-3 text-right">Approved Collected</th>
                    <th className="py-3 px-3 text-right">Outstanding</th>
                    <th className="py-3 px-4 text-right">Collection Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {revenueByCourse.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{row.name}</p>
                        <p className="text-[11px] font-mono text-slate-500">{row.code}</p>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">{row.students}</td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                        {formatEtb(row.agreedTotal)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold tabular-nums text-emerald-700">
                        {formatEtb(row.approvedCollected)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums text-red-700">
                        {formatEtb(row.outstanding)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {row.rate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Outstanding Student Fees */}
      {tab === 'outstanding' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={outstandingSearch}
                onChange={(e) => setOutstandingSearch(e.target.value)}
                placeholder="Search student name, ID, or course..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {outstandingEnrollments.length === 0 ? (
              <EmptyState
                title="Zero outstanding student balances"
                description="All active student tuition obligations are settled."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-3">Course &amp; Plan</th>
                      <th className="py-3 px-3 text-right">Agreed Fee</th>
                      <th className="py-3 px-3 text-right">Approved Paid</th>
                      <th className="py-3 px-3 text-right">Outstanding (ETB)</th>
                      <th className="py-3 px-4 text-right">Installment State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {outstandingEnrollments.map((enr) => {
                      const hasOverdue = installments.some(
                        (i) =>
                          i.enrollmentId === enr.id &&
                          i.status !== 'PAID' &&
                          i.dueDate < today
                      );
                      return (
                        <tr key={enr.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-900">{enr.studentName}</p>
                            <p className="text-[11px] font-mono text-slate-500">{enr.studentCode}</p>
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-medium text-slate-900">{enr.courseName}</p>
                            <p className="text-[11px] text-slate-500">
                              {enr.paymentPlanName || enr.paymentPlanCode}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums">
                            {formatEtb(enr.agreedFeeEtb)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-700">
                            {formatEtb(enr.approvedPaidEtb)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold tabular-nums text-red-700">
                            {formatEtb(enr.remainingBalanceEtb)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <StatusLabel status={hasOverdue ? 'OVERDUE' : 'PARTIAL'} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && profile && (
        <ExpenseModal
          categories={expenseCategories}
          onClose={() => setShowExpenseModal(false)}
          onSave={async (data) => {
            await createExpenseRecord(data, {
              uid: profile.uid,
              fullName: profile.fullName,
              role: profile.role,
            });
            pushToast('success', `Recorded expense "${data.title}".`);
            setShowExpenseModal(false);
          }}
        />
      )}

      {/* Expense Category Modal */}
      {showCategoryModal && profile && (
        <CategoryModal
          onClose={() => setShowCategoryModal(false)}
          onSave={async (data) => {
            await createExpenseCategory(data, {
              uid: profile.uid,
              fullName: profile.fullName,
              role: profile.role,
            });
            pushToast('success', `Added expense category "${data.name}".`);
            setShowCategoryModal(false);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deletingExpense)}
        title="Delete Expense Entry"
        description={`Remove expense "${deletingExpense?.title}" (${formatEtb(
          deletingExpense?.amountEtb || 0
        )})? This removal will be recorded in the immutable audit trail.`}
        confirmLabel="Delete Expense"
        tone="danger"
        loading={busy}
        onConfirm={async () => {
          if (!deletingExpense || !profile) return;
          setBusy(true);
          try {
            await deleteExpenseRecord(deletingExpense, {
              uid: profile.uid,
              fullName: profile.fullName,
              role: profile.role,
            });
            pushToast('info', 'Expense removed and logged to audit trail.');
            setDeletingExpense(null);
          } catch (err) {
            pushToast('error', err instanceof Error ? err.message : 'Failed to delete expense.');
          } finally {
            setBusy(false);
          }
        }}
        onClose={() => setDeletingExpense(null)}
      />
    </div>
  );
}

function ExpenseModal({
  categories,
  onClose,
  onSave,
}: {
  categories: ReturnType<typeof usePortal>['expenseCategories'];
  onClose: () => void;
  onSave: (data: {
    category: ReturnType<typeof usePortal>['expenseCategories'][number];
    title: string;
    amountEtb: number;
    expenseDate: string;
    paymentMethod: PaymentMethod;
    referenceNo?: string;
    notes?: string;
  }) => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [title, setTitle] = useState('');
  const [amountEtb, setAmountEtb] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayIsoDate());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat || !title.trim() || Number(amountEtb) <= 0) return;
    setSaving(true);
    await onSave({
      category: cat,
      title: title.trim(),
      amountEtb: Number(amountEtb),
      expenseDate,
      paymentMethod,
      referenceNo: referenceNo.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="text-base font-display font-bold text-slate-900">Record Expense (ETB)</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Monthly Campus Electricity Bill"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (ETB)</label>
              <input
                type="number"
                required
                min={1}
                step="0.01"
                value={amountEtb}
                onChange={(e) => setAmountEtb(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Date</label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="CBE Birr">CBE Birr</option>
                <option value="Telebirr">Telebirr</option>
                <option value="Check">Check</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Voucher Ref</label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: { name: string; description?: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), description: description.trim() || undefined });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="text-base font-display font-bold text-slate-900">New Expense Category</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Software Subscriptions"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
            >
              {saving ? 'Creating...' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
