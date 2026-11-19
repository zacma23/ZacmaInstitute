import React from 'react';
import { BookOpen, Calculator, CheckSquare, Lock, ShieldCheck } from 'lucide-react';
import { usePortal } from '../context/PortalContext';

export function LoginScreen() {
  const { signInWithGoogle, authLoading, authError } = usePortal();

  return (
    <div className="min-h-screen bg-slate-50 grid grid-cols-1 lg:grid-cols-12">
      {/* Left Institutional Brand Rail */}
      <div className="lg:col-span-7 bg-slate-900 text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-lg bg-blue-700 text-white font-display font-extrabold text-base flex items-center justify-center">
              ZT
            </div>
            <div>
              <p className="font-display font-bold text-lg tracking-tight leading-none">
                ZACMA Institute
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Technology &amp; Training Portal
              </p>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-white max-w-xl leading-tight mb-5">
            Student Fee Management &amp; Institutional Accounting Portal
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-lg leading-relaxed mb-10">
            Centralized admissions approval, ETB tuition installment tracking, maker-checker payment verification, official receipt issuance, and daily class attendance for ZACMA Technology &amp; Training Institute.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Control</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Approves student registrations and fee submissions, configures courses, monitors cash flow, and audits all ledger activity.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold mb-2">
                <Calculator className="w-4 h-4" />
                <span>Accountant Desk</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Registers students with installment schedules, records fee receipts for verification, and prints official approved receipts.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold mb-2">
                <CheckSquare className="w-4 h-4" />
                <span>Instructor Roster</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Manages daily classroom attendance and student attendance reports with strict financial data isolation.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-10 mt-10 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <span>ZACMA Technology &amp; Training Institute · Addis Ababa</span>
          </div>
          <span className="font-mono text-slate-500">Currency: ETB</span>
        </div>
      </div>

      {/* Right Authentication Panel */}
      <div className="lg:col-span-5 flex items-center justify-center p-8 sm:p-12 bg-white">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="text-xs font-semibold text-blue-700 mb-2">Staff Portal Access</p>
            <h2 className="text-2xl font-display font-bold text-slate-900 mb-2">
              Sign in to continue
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Authenticate with your institutional Google account. Role permissions are enforced automatically by the portal database.
            </p>
          </div>

          {authError && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {authError}
            </div>
          )}

          <button
            type="button"
            disabled={authLoading}
            onClick={() => void signInWithGoogle()}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.27v3.09A12 12 0 0 0 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.29A7.22 7.22 0 0 1 4.9 12c0-.79.14-1.56.38-2.29V6.62H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4.01-3.09Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.62l4.01 3.09c.95-2.84 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>{authLoading ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>

          <div className="mt-8 pt-6 border-t border-slate-200 flex items-start gap-2.5 text-xs text-slate-500">
            <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Protected by database-enforced Role-Based Access Control (Admin, Accountant, Instructor) and immutable financial audit logging.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
