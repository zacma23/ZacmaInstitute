import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { usePortal } from '../context/PortalContext';
import { formatEtbCompact, RoleCode, todayIsoDate } from '../types/zacma';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
  timestamp: string;
}

const ROLE_STARTER_PROMPTS: Record<RoleCode, string[]> = {
  ADMIN: [
    'Summarize pending registrations and payments awaiting my approval.',
    'How do I verify database migrations and run payment reminders?',
    'Explain our maker-checker rule for receipts and expenses.',
  ],
  ACCOUNTANT: [
    'How do I register a new student and select a payment plan?',
    'Which students currently have overdue or upcoming installments?',
    'Why is a pending payment excluded from collected revenue?',
  ],
  INSTRUCTOR: [
    'How do I record daily student attendance for my assigned classes?',
    'Which courses and active student rosters are currently running?',
    'How do I review attendance reports?',
  ],
  GENERAL_STAFF: [
    'What modules can General Staff access in the ZACMA portal?',
    'How do I check current course schedules and active enrollments?',
    'Who should I contact to handle a student fee payment?',
  ],
  STUDENT: [
    'What is my current remaining fee balance and next payment deadline?',
    'How do I print my official ZACMA payment receipt?',
    'Why is my recent payment still showing as pending?',
  ],
};

export function ZacmaAiAssistant() {
  const {
    profile,
    actualRole,
    effectiveRole,
    previewRole,
    previewStudentId,
    courses,
    students,
    enrollments,
    installments,
    payments,
    receipts,
    expenses,
    attendance,
    persistedNotifications,
  } = usePortal();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  if (!profile || !effectiveRole) return null;

  // Build strictly role-isolated read-only live context snapshot
  const liveContext = useMemo(() => {
    const today = todayIsoDate();

    if (effectiveRole === 'STUDENT') {
      const targetStuId =
        actualRole === 'ADMIN' && previewRole === 'STUDENT'
          ? previewStudentId
          : profile.linkedStudentId;
      const stu = students.find((s) => s.id === targetStuId);
      const myEnr = enrollments.filter((e) => e.studentId === targetStuId);
      const myInst = installments.filter((i) => i.studentId === targetStuId);
      const myPay = payments.filter((p) => p.studentId === targetStuId);
      const myRcp = receipts.filter((r) => r.studentId === targetStuId);
      const myNotif = persistedNotifications.filter(
        (n) => n.targetRole === 'STUDENT' && n.studentId === targetStuId
      );

      if (!stu) {
        return {
          scope: 'STUDENT_SELF_ONLY',
          note: 'No linked student record found for this account yet.',
        };
      }

      return {
        scope: 'STUDENT_SELF_ONLY',
        today,
        student: {
          studentCode: stu.studentCode,
          fullName: stu.fullName,
          courseName: stu.courseName,
          registrationStatus: stu.registrationStatus,
          enrollmentDate: stu.enrollmentDate,
        },
        enrollments: myEnr.map((e) => ({
          courseName: e.courseName,
          paymentPlan: e.paymentPlanName || e.paymentPlanCode,
          agreedFeeEtb: e.agreedFeeEtb,
          approvedPaidEtb: e.approvedPaidEtb,
          remainingBalanceEtb: e.remainingBalanceEtb,
          status: e.status,
        })),
        installments: myInst.map((i) => ({
          installmentNumber: i.installmentNumber,
          dueDate: i.dueDate,
          amountDueEtb: i.amountDueEtb,
          amountPaidEtb: i.amountPaidEtb,
          status: i.status !== 'PAID' && i.dueDate < today ? 'OVERDUE' : i.status,
        })),
        recentPayments: myPay.slice(0, 8).map((p) => ({
          transactionRef: p.transactionRef,
          amountEtb: p.amountEtb,
          paymentDate: p.paymentDate,
          method: p.paymentMethod,
          status: p.status,
          receiptNumber: p.receiptNumber || null,
        })),
        approvedReceiptsCount: myRcp.length,
        unreadRemindersCount: myNotif.filter((n) => !n.isRead).length,
      };
    }

    if (effectiveRole === 'INSTRUCTOR' || effectiveRole === 'GENERAL_STAFF') {
      const todayAtt = attendance.filter((a) => a.attendanceDate === today);
      return {
        scope: effectiveRole === 'INSTRUCTOR' ? 'INSTRUCTOR_ACADEMIC_ONLY' : 'GENERAL_STAFF_NON_FINANCIAL',
        today,
        activeCoursesCount: courses.filter((c) => c.isActive).length,
        courses: courses.slice(0, 12).map((c) => ({
          code: c.code,
          name: c.name,
          schedule: c.schedule,
          instructorName: c.instructorName || 'Staff',
          activeEnrolledCount: enrollments.filter((e) => e.courseId === c.id && e.status === 'ACTIVE').length,
        })),
        activeStudentsCount: students.filter((s) => s.registrationStatus === 'APPROVED').length,
        attendanceLoggedToday: todayAtt.length,
        presentToday: todayAtt.filter((a) => a.status === 'PRESENT').length,
        notice: 'Financial data is strictly excluded for this role.',
      };
    }

    // ADMIN or ACCOUNTANT read-only live summary
    const approvedIncome = payments
      .filter((p) => p.status === 'APPROVED')
      .reduce((acc, p) => acc + p.amountEtb, 0);
    const pendingPayments = payments.filter((p) => p.status === 'PENDING');
    const pendingStudents = students.filter((s) => s.registrationStatus === 'PENDING');
    const overdueInstallments = installments.filter(
      (i) => i.status !== 'PAID' && i.dueDate < today && i.amountDueEtb > i.amountPaidEtb
    );
    const totalOutstanding = enrollments
      .filter((e) => e.status === 'ACTIVE')
      .reduce((acc, e) => acc + Math.max(0, e.remainingBalanceEtb), 0);

    const base: Record<string, unknown> = {
      scope: effectiveRole,
      today,
      activeCoursesCount: courses.filter((c) => c.isActive).length,
      totalStudents: students.length,
      activeStudents: students.filter((s) => s.registrationStatus === 'APPROVED').length,
      pendingRegistrationsCount: pendingStudents.length,
      pendingRegistrations: pendingStudents.slice(0, 6).map((s) => ({
        code: s.studentCode,
        name: s.fullName,
        course: s.courseName,
      })),
      totalApprovedIncomeFormatted: formatEtbCompact(approvedIncome),
      pendingPaymentsCount: pendingPayments.length,
      pendingPaymentsAmountFormatted: formatEtbCompact(
        pendingPayments.reduce((acc, p) => acc + p.amountEtb, 0)
      ),
      totalOutstandingFormatted: formatEtbCompact(totalOutstanding),
      overdueInstallmentsCount: overdueInstallments.length,
      overdueSummary: overdueInstallments.slice(0, 8).map((i) => ({
        studentCode: i.studentCode,
        studentName: i.studentName,
        course: i.courseName,
        dueDate: i.dueDate,
        unpaidAmountEtb: Number((i.amountDueEtb - i.amountPaidEtb).toFixed(2)),
      })),
      officialReceiptsCount: receipts.length,
    };

    if (effectiveRole === 'ADMIN') {
      const totalExpenses = expenses.reduce((acc, e) => acc + e.amountEtb, 0);
      base.totalExpensesFormatted = formatEtbCompact(totalExpenses);
      base.netCashFlowFormatted = formatEtbCompact(approvedIncome - totalExpenses);
    }

    return base;
  }, [
    effectiveRole,
    actualRole,
    previewRole,
    previewStudentId,
    profile.linkedStudentId,
    courses,
    students,
    enrollments,
    installments,
    payments,
    receipts,
    expenses,
    attendance,
    persistedNotifications,
  ]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    window.setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: effectiveRole,
          userName: profile.fullName,
          message: trimmed,
          history: messages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .slice(-6)
            .map((m) => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              text: m.text,
            })),
          context: liveContext,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data?.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: `e_${Date.now()}`,
            role: 'error',
            text:
              data?.error ||
              data?.message ||
              'ZACMA AI Assistant is currently unavailable. Please verify that GEMINI_API_KEY is configured on the server.',
            timestamp: new Date().toISOString(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            text: String(data.reply),
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'error',
          text: 'Could not reach the ZACMA AI Assistant server endpoint (/api/ai/chat). The rest of the portal remains fully operational.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      window.setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 60);
    }
  };

  const starters = ROLE_STARTER_PROMPTS[effectiveRole] || ROLE_STARTER_PROMPTS.GENERAL_STAFF;

  return (
    <div className="no-print">
      {/* Floating Launcher Button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2.5 px-4 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl shadow-lg border border-blue-600 transition-colors"
          aria-label="Open ZACMA AI Assistant"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="text-xs font-display font-bold tracking-tight">
            ZACMA AI ASSISTANT
          </span>
        </button>
      )}

      {/* Docked Assistant Drawer */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-md h-[560px] max-h-[82vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-display font-bold tracking-tight truncate">
                  ZACMA AI ASSISTANT
                </p>
                <p className="text-[11px] text-slate-300 truncate">
                  Role Scope: <span className="font-mono font-semibold text-blue-300">{effectiveRole}</span> · Read-Only
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded-md"
              aria-label="Close AI Assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Governance Notice */}
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 text-[11px] text-slate-600 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-700 shrink-0" />
            <span>
              Strictly read-only &amp; role-isolated. Cannot approve payments or modify records.
            </span>
          </div>

          {/* Conversation Thread */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
                  <p className="font-semibold text-slate-900 mb-1">
                    Hello {profile.fullName}
                  </p>
                  <p>
                    I am the ZACMA AI Assistant. Ask me about ZACMA portal workflows, payment schedules,
                    receipts, or live summaries authorized for your{' '}
                    <span className="font-mono font-semibold text-blue-700">{effectiveRole}</span> role.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-slate-500">Suggested questions</p>
                  {starters.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 bg-white hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 rounded-lg transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-blue-700 text-white'
                        : m.role === 'error'
                        ? 'bg-red-50 border border-red-200 text-red-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {m.role === 'error' && (
                      <div className="flex items-center gap-1.5 font-semibold text-red-900 mb-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Assistant Unavailable</span>
                      </div>
                    )}
                    {m.text}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 text-xs text-slate-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
                  <span>Reviewing ZACMA documentation...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
            className="p-3 border-t border-slate-200 bg-slate-50 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about ZACMA procedures or your view..."
              disabled={loading}
              className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg transition-colors"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
