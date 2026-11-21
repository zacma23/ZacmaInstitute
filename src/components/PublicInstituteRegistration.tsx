import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Palette,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
} from 'lucide-react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { usePortal } from '../context/PortalContext';
import {
  DEFAULT_SUBSCRIPTION_PLANS,
  DEFAULT_ZACMA_TENANT_ID,
  PublicInstituteRegistrationResult,
  submitInstituteRegistrationRequest,
} from '../lib/saasService';
import { compressImageToDataUrl } from '../lib/zacmaService';
import { ZacmaLogo } from './ZacmaLogo';
import { BillingCycle, formatEtbCompact, SubscriptionPlan, TenantRecord } from '../types/zacma';

function toUrlSlug(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36) || 'your-institute'
  );
}

export function PublicInstituteRegistration({ onBack }: { onBack: () => void }) {
  const { pushToast, refreshProfile } = usePortal();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — Institute Profile
  const [instituteName, setInstituteName] = useState('');
  const [shortName, setShortName] = useState('');
  const [businessType, setBusinessType] = useState('Technology & Vocational Training Institute');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+251 ');
  const [country, setCountry] = useState('Ethiopia');
  const [city, setCity] = useState('Addis Ababa');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#172DEB');
  const [secondaryColor, setSecondaryColor] = useState('#E51B23');
  const [currency, setCurrency] = useState<TenantRecord['currency']>('ETB');

  // Step 2 — Subscription Plan
  const plans: SubscriptionPlan[] = DEFAULT_SUBSCRIPTION_PLANS;
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan_free_trial');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('TRIAL');

  // Step 3 — Primary Admin Account
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('+251 ');
  const [adminPosition, setAdminPosition] = useState('Institute Director & Administrator');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicInstituteRegistrationResult | null>(null);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) || plans[0],
    [plans, selectedPlanId]
  );

  const previewSlug = useMemo(
    () => toUrlSlug(shortName.trim() || instituteName.trim()),
    [shortName, instituteName]
  );

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://zims.zacma.edu.et';

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setLogoUrl(dataUrl);
      pushToast('info', 'Institute logo attached.');
    } catch {
      pushToast('error', 'Unable to process logo image. Please use PNG or JPG.');
    }
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlanId(plan.id);
    if (plan.code === 'FREE_TRIAL') {
      setBillingCycle('TRIAL');
    } else if (billingCycle === 'TRIAL') {
      setBillingCycle('MONTHLY');
    }
  };

  const validateStep1 = (): boolean => {
    if (instituteName.trim().length < 3) {
      setError('Please enter your official institute name (at least 3 characters).');
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid official institute email address.');
      return false;
    }
    if (phone.trim().length < 7) {
      setError('Please enter a valid institute contact phone number.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (adminFullName.trim().length < 2) {
      setError('Please enter the primary administrator full name.');
      return;
    }
    if (!adminEmail.trim() || !adminEmail.includes('@')) {
      setError('Please enter a valid administrator email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter both fields.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create the administrator's Firebase Auth account (or reuse signed-in session if matching)
      let uid = auth.currentUser?.uid || '';
      const cleanAdminEmail = adminEmail.trim().toLowerCase();

      if (!uid) {
        try {
          window.sessionStorage.setItem(
            'zacma_pending_auth_intent',
            JSON.stringify({ fullName: adminFullName.trim().slice(0, 120), role: 'INSTRUCTOR' })
          );
        } catch {
          // Ignore sessionStorage restrictions
        }

        const cred = await createUserWithEmailAndPassword(auth, cleanAdminEmail, password);
        uid = cred.user.uid;
        await updateProfile(cred.user, {
          displayName: adminFullName.trim().slice(0, 120),
        }).catch(() => undefined);

        // Ensure base profile document exists immediately before submitting tenant request
        const profileRef = doc(db, 'profiles', uid);
        const existingSnap = await getDoc(profileRef);
        if (!existingSnap.exists()) {
          const now = new Date().toISOString();
          await setDoc(profileRef, {
            uid,
            tenantId: DEFAULT_ZACMA_TENANT_ID,
            email: cleanAdminEmail,
            fullName: adminFullName.trim().slice(0, 120),
            role: 'INSTRUCTOR',
            isActive: true,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // 2. Submit institute registration request (auto-provisions if Super Admin enabled Auto-Approve, else queues PENDING)
      const regRes = await submitInstituteRegistrationRequest({
        instituteName: instituteName.trim(),
        shortName: shortName.trim() || instituteName.trim().slice(0, 28),
        businessType: businessType.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        country: country.trim(),
        city: city.trim(),
        address: address.trim() || `${city.trim()}, ${country.trim()}`,
        website: website.trim() || undefined,
        logoUrl: logoUrl || undefined,
        primaryColor,
        secondaryColor,
        currency,
        selectedPlan,
        billingCycle: selectedPlan.code === 'FREE_TRIAL' ? 'TRIAL' : billingCycle,
        adminFullName: adminFullName.trim(),
        adminEmail: cleanAdminEmail,
        adminPhone: adminPhone.trim() || phone.trim(),
        adminPosition: adminPosition.trim(),
        applicantUid: uid,
      });

      setResult(regRes);
      await refreshProfile();

      if (regRes.status === 'APPROVED') {
        pushToast(
          'success',
          `${instituteName.trim()} workspace provisioned! Welcome to ZACMA Institute Management System.`
        );
      } else {
        pushToast(
          'success',
          'Institute registration submitted for ZACMA Super Admin review.'
        );
      }
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/email-already-in-use') {
        setError(
          'An account with this administrator email already exists. Please use a different email or sign in first.'
        );
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 6 characters.');
      } else {
        setError(err instanceof Error ? err.message : 'Unable to submit institute registration.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
          <div className="h-1.5 w-full zacma-brand-stripe" />
          <div className="p-8 space-y-5 text-center">
            <div
              className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${
                result.status === 'APPROVED'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-blue-50 text-[#172DEB]'
              }`}
            >
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold text-slate-900">
                {result.status === 'APPROVED'
                  ? 'Institute Workspace Provisioned!'
                  : 'Registration Submitted for Review'}
              </h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {result.status === 'APPROVED'
                  ? 'Your dedicated multi-tenant training institute workspace has been automatically provisioned and activated.'
                  : 'Your application has been queued for verification by the ZACMA Platform Super Admin. Once approved, your account will automatically unlock your isolated Institute Admin portal.'}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Institute Name</span>
                <span className="font-bold text-slate-900">{instituteName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Portal URL</span>
                <span className="font-mono font-semibold text-[#172DEB]">
                  {origin}/institute/{result.slug}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Reference ID</span>
                <span className="font-mono text-slate-800">
                  {result.provisionedTenantId || result.requestId}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Status</span>
                <span
                  className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                    result.status === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {result.status === 'APPROVED' ? 'LIVE & ACTIVE' : 'PENDING SUPER ADMIN APPROVAL'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onBack}
              className="w-full py-2.5 px-4 bg-[#172DEB] hover:bg-blue-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              {result.status === 'APPROVED' ? 'Open Institute Portal' : 'Return to Portal Sign-In'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top SaaS Brand Bar */}
      <div className="h-1.5 w-full zacma-brand-stripe shrink-0" />
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ZacmaLogo
              variant="lockup"
              theme="light"
              size="sm"
              subtitle="ZACMA Institute Management System (ZIMS)"
            />
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </button>
        </div>
      </header>

      <main className="flex-1 py-8 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header & Step Progress */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#172DEB]">
              <Sparkles className="w-4 h-4" />
              <span>Multi-Tenant SaaS Onboarding</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 tracking-tight">
              Register Your Training Institute on ZIMS
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto">
              Launch an isolated, white-labeled institutional portal with Student &amp; Staff AI ID Registration, ETB Tuition &amp; Chapa Payments, Attendance, Dual Calendar Reports, and Role-Isolated AI Assistants.
            </p>
          </div>

          {/* Stepper */}
          <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
            {[
              { num: 1 as const, label: 'Institute Profile', icon: <Building2 className="w-4 h-4" /> },
              { num: 2 as const, label: 'Subscription Plan', icon: <CreditCard className="w-4 h-4" /> },
              { num: 3 as const, label: 'Admin Account', icon: <UserCheck className="w-4 h-4" /> },
            ].map((s) => {
              const active = step === s.num;
              const done = step > s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    if (s.num < step) setStep(s.num);
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    active
                      ? 'bg-[#172DEB] text-white border-[#172DEB] shadow-sm'
                      : done
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 cursor-pointer'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  {done ? <Check className="w-4 h-4" /> : s.icon}
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">Step {s.num}</span>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-medium">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
          >
            {/* STEP 1: INSTITUTE PROFILE & BRANDING */}
            {step === 1 && (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-display font-bold text-slate-900">
                      1. Institute Identity &amp; Workspace Branding
                    </h2>
                    <p className="text-xs text-slate-500">
                      Configure your institute&apos;s official details, custom portal URL, logo, and colors.
                    </p>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] font-mono text-[#172DEB] flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>/institute/{previewSlug}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Official Training Institute Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={instituteName}
                      onChange={(e) => setInstituteName(e.target.value)}
                      placeholder="e.g., Horizon Digital & Engineering College"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#172DEB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Short Name / Acronym (for Sidebar &amp; URL)
                    </label>
                    <input
                      type="text"
                      value={shortName}
                      onChange={(e) => setShortName(e.target.value)}
                      placeholder="e.g., Horizon Tech"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#172DEB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Institution Category
                    </label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Technology & Vocational Training Institute">
                        Technology &amp; Vocational Training Institute
                      </option>
                      <option value="TVET College">TVET College</option>
                      <option value="Coding Bootcamp & Tech Academy">
                        Coding Bootcamp &amp; Tech Academy
                      </option>
                      <option value="Language & Business Training Center">
                        Language &amp; Business Training Center
                      </option>
                      <option value="Driving & Technical School">Driving &amp; Technical School</option>
                      <option value="Private College / Institute">Private College / Institute</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Official Institute Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="info@yourinstitute.edu.et"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#172DEB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Official Phone Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+251 911 000 000"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#172DEB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Country *</label>
                    <input
                      type="text"
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Campus Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g., Bole Sub-City, Woreda 03"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Operating Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as TenantRecord['currency'])}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="ETB">ETB — Ethiopian Birr</option>
                      <option value="USD">USD — US Dollar</option>
                      <option value="KES">KES — Kenyan Shilling</option>
                      <option value="EUR">EUR — Euro</option>
                      <option value="GBP">GBP — British Pound</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Website (Optional)
                    </label>
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://yourinstitute.edu.et"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Branding Strip */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo preview"
                        className="w-11 h-11 rounded-lg object-contain bg-white border border-slate-200 p-1"
                      />
                    ) : (
                      <div
                        className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-display font-bold text-sm"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {(shortName || instituteName || 'TI').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-[#172DEB]" />
                        Custom Branding &amp; Logo
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Applied to your portal header, official receipts, and student portal.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                      <span>Primary</span>
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                      <span>Accent</span>
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                      />
                    </label>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{logoUrl ? 'Change Logo' : 'Upload Logo'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => void handleLogoUpload(e)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (validateStep1()) setStep(2);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#172DEB] hover:bg-blue-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    <span>Continue to Subscription Plan</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: SUBSCRIPTION PLAN & BILLING CYCLE */}
            {step === 2 && (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-display font-bold text-slate-900">
                      2. Choose Subscription Plan &amp; Billing Cycle
                    </h2>
                    <p className="text-xs text-slate-500">
                      Start with a 14-day Free Trial or select a commercial plan with Monthly, Quarterly, or Annual billing.
                    </p>
                  </div>

                  {selectedPlan.code !== 'FREE_TRIAL' && (
                    <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                      {(
                        [
                          { id: 'MONTHLY', label: 'Monthly' },
                          { id: 'QUARTERLY', label: 'Quarterly (-10%)' },
                          { id: 'ANNUAL', label: 'Annual (2 mo free)' },
                        ] as const
                      ).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setBillingCycle(c.id)}
                          className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                            billingCycle === c.id
                              ? 'bg-[#172DEB] text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {plans.map((p) => {
                    const selected = p.id === selectedPlan.id;
                    const price =
                      p.code === 'FREE_TRIAL'
                        ? 0
                        : billingCycle === 'ANNUAL'
                        ? p.annualPriceEtb
                        : billingCycle === 'QUARTERLY'
                        ? p.quarterlyPriceEtb ?? Math.round(p.monthlyPriceEtb * 2.7)
                        : p.monthlyPriceEtb;
                    const unit =
                      p.code === 'FREE_TRIAL'
                        ? `/ ${p.trialDays} days`
                        : billingCycle === 'ANNUAL'
                        ? '/ year'
                        : billingCycle === 'QUARTERLY'
                        ? '/ quarter'
                        : '/ month';

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectPlan(p)}
                        className={`text-left p-4 rounded-xl border-2 transition-all flex flex-col justify-between cursor-pointer ${
                          selected
                            ? 'border-[#172DEB] bg-blue-50/40 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-mono font-bold uppercase text-slate-500">
                              {p.code}
                            </span>
                            {p.isFeatured && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#E51B23] text-white rounded">
                                POPULAR
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-display font-bold text-slate-900 mt-1">
                            {p.name}
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-1 min-h-[32px]">{p.tagline}</p>

                          <div className="mt-3 pb-3 border-b border-slate-200/80">
                            <p className="text-lg font-mono font-extrabold text-slate-900 tabular-nums">
                              {price === 0 ? 'FREE' : formatEtbCompact(price)}
                            </p>
                            <p className="text-[11px] text-slate-500">{unit}</p>
                          </div>

                          <ul className="mt-3 space-y-1.5 text-[11px] text-slate-700">
                            <li className="flex justify-between">
                              <span>Students</span>
                              <strong>{p.studentLimit.toLocaleString()}</strong>
                            </li>
                            <li className="flex justify-between">
                              <span>Staff</span>
                              <strong>{p.staffLimit.toLocaleString()}</strong>
                            </li>
                            <li className="flex justify-between">
                              <span>AI Quota/mo</span>
                              <strong>{p.aiMonthlyQuota.toLocaleString()}</strong>
                            </li>
                            <li className="flex justify-between">
                              <span>Modules</span>
                              <strong>{p.includedModules.length} included</strong>
                            </li>
                          </ul>
                        </div>

                        <div
                          className={`mt-4 py-1.5 text-center rounded-lg text-[11px] font-bold ${
                            selected ? 'bg-[#172DEB] text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {selected ? 'Selected Plan' : 'Select Plan'}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#172DEB] hover:bg-blue-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    <span>Continue to Admin Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: PRIMARY INSTITUTE ADMINISTRATOR ACCOUNT */}
            {step === 3 && (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="pb-4 border-b border-slate-100">
                  <h2 className="text-base font-display font-bold text-slate-900">
                    3. Primary Institute Administrator Credentials
                  </h2>
                  <p className="text-xs text-slate-500">
                    This account will own full administrative control over <strong>{instituteName}</strong>&apos;s isolated workspace.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Administrator Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={adminFullName}
                      onChange={(e) => setAdminFullName(e.target.value)}
                      placeholder="e.g., Abebe Kebede"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#172DEB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Position / Title
                    </label>
                    <input
                      type="text"
                      value={adminPosition}
                      onChange={(e) => setAdminPosition(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Administrator Login Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@yourinstitute.edu.et"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#172DEB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Administrator Phone *
                    </label>
                    <input
                      type="text"
                      required
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                      placeholder="+251 911 000 000"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Portal Password *
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirm Password *
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Summary Review Box */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] uppercase font-semibold text-slate-400">Institute</p>
                    <p className="font-bold text-slate-900 mt-0.5">{instituteName}</p>
                    <p className="text-[11px] text-slate-500">
                      {city}, {country}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-semibold text-slate-400">Workspace URL</p>
                    <p className="font-mono font-semibold text-[#172DEB] mt-0.5">
                      /institute/{previewSlug}
                    </p>
                    <p className="text-[11px] text-slate-500">Strict Tenant Isolation</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-semibold text-slate-400">Selected Plan</p>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedPlan.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {selectedPlan.code === 'FREE_TRIAL' ? '14-Day Free Trial' : billingCycle}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-[11px] text-slate-600 bg-blue-50/70 border border-blue-200 rounded-xl p-3.5">
                  <ShieldCheck className="w-4 h-4 text-[#172DEB] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Every institute receives its own isolated database partition enforced by backend security rules. Other institutions can never view your students, staff, tuition payments, or documents.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#172DEB] hover:bg-blue-800 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {submitting ? 'Submitting Registration...' : 'Complete Institute Registration'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
