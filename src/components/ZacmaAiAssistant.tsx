import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  X,
  Zap,
} from 'lucide-react';
import { usePortal } from '../context/PortalContext';
import { formatEtbCompact, RoleCode, todayIsoDate } from '../types/zacma';
import { ZacmaLogo } from './ZacmaLogo';

type ChatMode = 'standard' | 'fast';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
  timestamp: string;
  model?: string;
}

const ROLE_STARTER_PROMPTS: Record<RoleCode, string[]> = {
  ADMIN: [
    'Summarize pending registrations and payments awaiting my approval.',
    'Which students currently have overdue installments and what is the total unpaid ETB?',
    'Explain our maker-checker rule for receipts, payments, and expenses.',
  ],
  MANAGER: [
    'Summarize active enrollments, courses, and pending approvals for our institute.',
    'Which students currently have overdue installments?',
    'How do I review institute attendance and fee collection progress?',
  ],
  ACCOUNTANT: [
    'How do I register a new student and assign a monthly or 3-month payment plan?',
    'Which students currently have overdue or upcoming installments?',
    'Why is a pending payment excluded from collected revenue?',
  ],
  INSTRUCTOR: [
    'How do I record daily student attendance for my assigned classes?',
    'Which courses and active student rosters are currently running?',
    'How do I filter attendance reports by course and date?',
  ],
  RECEPTIONIST: [
    'How do I register a new student using the AI ID Scanner?',
    'How do I look up a student by name, ID, or course?',
    'How do I check a student’s course schedule?',
  ],
  HR_OFFICER: [
    'How do I onboard a new staff member using AI ID OCR?',
    'Which staff registrations are pending approval?',
    'How are staff portal roles assigned after approval?',
  ],
  GENERAL_STAFF: [
    'What modules can General Staff access in the portal?',
    'How do I look up a student by name, ID, or course?',
    'Who should I direct a student to for fee payments or official receipts?',
  ],
  STUDENT: [
    'What is my current remaining fee balance and next payment deadline?',
    'How do I view and print my official payment receipt?',
    'Why is my recent payment still showing as pending?',
  ],
};

const ROLE_PERSONA_LABELS: Record<RoleCode, string> = {
  ADMIN: 'Executive & Finance Advisor',
  MANAGER: 'Institute Operations Advisor',
  ACCOUNTANT: 'Fee & Receivables Assistant',
  INSTRUCTOR: 'Academic & Attendance Guide',
  RECEPTIONIST: 'Admissions & Front Desk Helper',
  HR_OFFICER: 'Staff Onboarding & HR Guide',
  GENERAL_STAFF: 'Campus Operations Helper',
  STUDENT: 'Student Fee & Schedule Guide',
};

function formatTimeShort(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-slate-200/80 text-slate-900 font-mono text-[11px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function FormattedMessageBody({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 break-words">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={i} className="h-1" />;
        }
        if (/^#{1,3}\s+/.test(trimmed)) {
          return (
            <p key={i} className="font-display font-bold text-slate-900 text-xs pt-1">
              {renderInlineMarkdown(trimmed.replace(/^#{1,3}\s+/, ''))}
            </p>
          );
        }
        if (/^[-*•]\s+/.test(trimmed)) {
          return (
            <div key={i} className="flex items-start gap-2 pl-1">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-700 shrink-0" />
              <span className="flex-1">{renderInlineMarkdown(trimmed.replace(/^[-*•]\s+/, ''))}</span>
            </div>
          );
        }
        const numbered = trimmed.match(/^(\d+\.)\s+(.*)$/);
        if (numbered) {
          return (
            <div key={i} className="flex items-start gap-2 pl-1">
              <span className="font-mono font-semibold text-blue-700 shrink-0">{numbered[1]}</span>
              <span className="flex-1">{renderInlineMarkdown(numbered[2])}</span>
            </div>
          );
        }
        return <p key={i}>{renderInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

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
    activeTenantId,
    activeTenant,
    isModuleEnabled,
  } = usePortal();

  const aiEnabled = isModuleEnabled('AI_ASSISTANT');

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<ChatMode>('standard');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const storageKey =
    profile && effectiveRole ? `zacma_ai_chat_${activeTenantId}_${profile.id}_${effectiveRole}` : null;

  // Restore role-scoped multi-turn session history when user or role changes
  useEffect(() => {
    if (!storageKey) {
      setMessages([]);
      return;
    }
    try {
      const saved = window.sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed)) {
          setMessages(parsed.slice(-40));
          return;
        }
      }
    } catch {
      // Ignore storage read errors
    }
    setMessages([]);
  }, [storageKey]);

  // Persist non-streaming completed conversation turns
  useEffect(() => {
    if (!storageKey || streamingId) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)));
    } catch {
      // Ignore storage quota errors
    }
  }, [messages, storageKey, streamingId]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: streamingId ? 'auto' : 'smooth' });
    }
  }, [messages, loading, open, streamingId]);

  // Build strictly role-isolated read-only live context snapshot
  const liveContext = useMemo(() => {
    if (!profile || !effectiveRole) return {};
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
        scope:
          effectiveRole === 'INSTRUCTOR'
            ? 'INSTRUCTOR_ACADEMIC_ONLY'
            : 'GENERAL_STAFF_NON_FINANCIAL',
        today,
        activeCoursesCount: courses.filter((c) => c.isActive).length,
        courses: courses.slice(0, 12).map((c) => ({
          code: c.code,
          name: c.name,
          schedule: c.schedule,
          instructorName: c.instructorName || 'Staff',
          activeEnrolledCount: enrollments.filter(
            (e) => e.courseId === c.id && e.status === 'ACTIVE'
          ).length,
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
      overdueSummary: overdueInstallments.slice(0, 10).map((i) => ({
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
    profile,
    effectiveRole,
    actualRole,
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
  ]);

  if (!profile || !effectiveRole) return null;

  const stopGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setStreamingId(null);
  };

  const clearConversation = () => {
    if (loading) stopGeneration();
    setMessages([]);
    if (storageKey) {
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {
        // Ignore storage error
      }
    }
  };

  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    const historyPayload = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        text: m.text,
      }));

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    const assistantMsgId = `a_${Date.now() + 1}`;

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const requestBody = JSON.stringify({
      role: effectiveRole,
      userName: profile.fullName,
      tenantId: activeTenantId,
      tenantName: activeTenant?.name || 'ZACMA Technology Training Institute',
      mode,
      message: trimmed,
      history: historyPayload,
      context: liveContext,
    });

    const appendError = (errorText: string) => {
      setMessages((prev) => {
        const withoutEmptyDraft = prev.filter(
          (m) => !(m.id === assistantMsgId && !m.text.trim())
        );
        return [
          ...withoutEmptyDraft,
          {
            id: `e_${Date.now()}`,
            role: 'error',
            text: errorText,
            timestamp: new Date().toISOString(),
          },
        ];
      });
    };

    try {
      const streamRes = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        signal: controller.signal,
      });

      const contentType = streamRes.headers.get('content-type') || '';

      if (streamRes.ok && contentType.includes('text/event-stream') && streamRes.body) {
        setStreamingId(assistantMsgId);
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            text: '',
            timestamp: new Date().toISOString(),
          },
        ]);

        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let receivedText = '';
        let streamError: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const rawEvent of events) {
            const dataLines = rawEvent
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim());
            if (dataLines.length === 0) continue;

            try {
              const payload = JSON.parse(dataLines.join('\n')) as {
                delta?: string;
                done?: boolean;
                model?: string;
                timestamp?: string;
                error?: string;
              };
              if (payload.error) {
                streamError = payload.error;
              } else if (payload.delta) {
                receivedText += payload.delta;
                const snapshot = receivedText;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, text: snapshot } : m))
                );
              } else if (payload.done) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          model: payload.model,
                          timestamp: payload.timestamp || m.timestamp,
                        }
                      : m
                  )
                );
              }
            } catch {
              // Ignore partial non-JSON lines
            }
          }
        }

        if (streamError) {
          appendError(streamError);
        } else if (!receivedText.trim()) {
          appendError('AI service returned an empty response. Please try again.');
        }
        return;
      }

      // If /stream returned structured error (e.g., 503 missing key), show it immediately
      if (!streamRes.ok && contentType.includes('application/json')) {
        const errData = (await streamRes.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        appendError(
          errData?.error ||
            errData?.message ||
            'ZACMA AI Assistant is currently unavailable. Please verify that GEMINI_API_KEY is configured on the server.'
        );
        return;
      }

      // Graceful fallback to standard JSON endpoint /api/ai/chat
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as {
        reply?: string;
        model?: string;
        timestamp?: string;
        error?: string;
        message?: string;
      } | null;

      if (!res.ok || !data?.reply) {
        appendError(
          data?.error ||
            data?.message ||
            'ZACMA AI Assistant is currently unavailable. Please verify that GEMINI_API_KEY is configured on the server.'
        );
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            text: String(data.reply),
            model: data.model,
            timestamp: data.timestamp || new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User intentionally cancelled generation
        return;
      }
      appendError(
        'Could not reach the ZACMA AI Assistant server endpoint (/api/ai/chat). The rest of the portal remains fully operational.'
      );
    } finally {
      abortRef.current = null;
      setLoading(false);
      setStreamingId(null);
    }
  };

  const starters = ROLE_STARTER_PROMPTS[effectiveRole] || ROLE_STARTER_PROMPTS.GENERAL_STAFF;
  const turnCount = messages.filter((m) => m.role === 'user').length;

  if (!aiEnabled) {
    return null;
  }

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
          {turnCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-blue-900/80 text-blue-100">
              {turnCount}
            </span>
          )}
        </button>
      )}

      {/* Docked Multi-Turn Chatbot Drawer */}
      {open && (
        <div
          className={`fixed bottom-5 right-5 z-50 w-[calc(100vw-2rem)] ${
            expanded ? 'max-w-2xl h-[680px]' : 'max-w-md h-[590px]'
          } max-h-[85vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200`}
        >
          {/* Subtle Brand Accent Stripe */}
          <div className="h-1 w-full zacma-brand-stripe shrink-0" />
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <ZacmaLogo variant="mark" size="sm" framed />
              <div className="min-w-0">
                <p className="text-xs font-display font-bold tracking-tight truncate">
                  ZACMA AI ASSISTANT
                </p>
                <p className="text-[11px] text-slate-300 truncate">
                  <span className="font-mono font-semibold text-blue-300">{effectiveRole}</span> ·{' '}
                  {ROLE_PERSONA_LABELS[effectiveRole]}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearConversation}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                  title="New conversation"
                  aria-label="Clear conversation history"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="hidden sm:inline-flex p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                title={expanded ? 'Compact view' : 'Expand chat'}
                aria-label={expanded ? 'Compact chat drawer' : 'Expand chat drawer'}
              >
                {expanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                aria-label="Close AI Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Governance + Speed Mode Bar */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-[11px] text-slate-600 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <span className="truncate">Read-only · Role-isolated</span>
            </div>

            <div
              className="inline-flex items-center p-0.5 bg-slate-200/80 rounded-lg shrink-0"
              role="group"
              aria-label="Gemini response mode"
            >
              <button
                type="button"
                onClick={() => setMode('standard')}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                  mode === 'standard'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Gemini 4 Hydrogen — balanced depth for portal analysis and guidance"
              >
                <Sparkles className="w-3 h-3" />
                <span>Standard</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('fast')}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                  mode === 'fast'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Gemini 3.1 Flash Lite — ultra-fast quick answers"
              >
                <Zap className="w-3 h-3" />
                <span>Fast</span>
              </button>
            </div>
          </div>

          {/* Scrollable Multi-Turn Conversation Thread */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-white">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
                  <p className="font-semibold text-slate-900 mb-1">
                    Hello {profile.fullName}
                  </p>
                  <p>
                    I am your multi-turn ZACMA AI Assistant. Ask follow-up questions about ZACMA
                    portal workflows, payment schedules, official receipts, or live summaries
                    authorized for your{' '}
                    <span className="font-mono font-semibold text-blue-700">{effectiveRole}</span>{' '}
                    role.
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
                  className={`flex flex-col ${
                    m.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-blue-700 text-white whitespace-pre-wrap'
                        : m.role === 'error'
                        ? 'bg-red-50 border border-red-200 text-red-800 whitespace-pre-wrap'
                        : 'bg-slate-100 text-slate-800 border border-slate-200/70'
                    }`}
                  >
                    {m.role === 'error' && (
                      <div className="flex items-center gap-1.5 font-semibold text-red-900 mb-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Assistant Unavailable</span>
                      </div>
                    )}
                    {m.role === 'assistant' ? (
                      m.text ? (
                        <FormattedMessageBody text={m.text} />
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-500">
                          <Loader2 className="w-3 h-3 animate-spin text-blue-700" />
                          <span>Generating response...</span>
                        </span>
                      )
                    ) : (
                      m.text
                    )}
                  </div>

                  {/* Subtle message footer metadata */}
                  <div className="mt-1 px-1 flex items-center gap-2 text-[10px] text-slate-400">
                    <span>{formatTimeShort(m.timestamp)}</span>
                    {m.role === 'assistant' && m.model && (
                      <span className="font-mono text-slate-400">{m.model}</span>
                    )}
                    {m.role === 'assistant' && m.text && streamingId !== m.id && (
                      <button
                        type="button"
                        onClick={() => void copyMessage(m.id, m.text)}
                        className="inline-flex items-center gap-0.5 text-slate-400 hover:text-blue-700 transition-colors"
                        title="Copy reply"
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            {loading && !streamingId && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 text-xs text-slate-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
                  <span>
                    {mode === 'fast'
                      ? 'Preparing quick response...'
                      : 'Reviewing ZACMA records & guidance...'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Multi-Line Input Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
            className="p-3 border-t border-slate-200 bg-slate-50 flex items-end gap-2 shrink-0"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
              placeholder="Ask a question or follow up... (Enter to send)"
              disabled={loading}
              className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 resize-none max-h-[110px]"
            />
            {loading ? (
              <button
                type="button"
                onClick={stopGeneration}
                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shrink-0"
                title="Stop generating"
                aria-label="Stop response generation"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg transition-colors shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
