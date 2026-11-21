import React, { useEffect, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Globe,
  Headphones,
  Layers,
  Loader2,
  Palette,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { usePortal } from '../context/PortalContext';
import {
  ALL_SAAS_MODULES,
  completeChapaSubscriptionPayment,
  createSupportTicket,
  DEFAULT_SUBSCRIPTION_PLANS,
  updateOwnInstituteBranding,
} from '../lib/saasService';
import { compressImageToDataUrl } from '../lib/zacmaService';
import {
  BillingCycle,
  formatDateShort,
  formatEtb,
  formatEtbCompact,
  PaymentMethod,
  SupportTicket,
  TenantRecord,
} from '../types/zacma';

const ALL_METHODS: PaymentMethod[] = [
  'Cash',
  'CBE Birr',
  'Telebirr',
  'Bank Transfer',
  'Check',
  'Chapa',
];

export function InstituteSettingsView() {
  const {
    profile,
    activeTenant,
    activeTenantId,
    students,
    staffRecords,
    subscriptionPlans,
    platformSubscriptions,
    platformInvoices,
    supportTickets,
    canWriteInTenant,
    pushToast,
  } = usePortal();

  const [tab, setTab] = useState<'BRANDING' | 'SUBSCRIPTION' | 'SUPPORT'>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('chapa_sub_tx_ref=')) {
      return 'SUBSCRIPTION';
    }
    return 'BRANDING';
  });
  const [saving, setSaving] = useState(false);
  const [copiedPortalUrl, setCopiedPortalUrl] = useState(false);

  // Chapa Online SaaS Subscription Upgrade / Renewal State
  const paidPlans = (subscriptionPlans.length > 0 ? subscriptionPlans : DEFAULT_SUBSCRIPTION_PLANS).filter(
    (p) => p.monthlyPriceEtb > 0
  );
  const [checkoutPlanId, setCheckoutPlanId] = useState<string>(paidPlans[1]?.id || paidPlans[0]?.id || 'plan_professional');
  const [checkoutCycle, setCheckoutCycle] = useState<BillingCycle>('MONTHLY');
  const [startingChapa, setStartingChapa] = useState(false);
  const [verifyingChapa, setVerifyingChapa] = useState(false);
  const [pendingChapaRef, setPendingChapaRef] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return new URLSearchParams(window.location.search).get('chapa_sub_tx_ref');
    } catch {
      return null;
    }
  });

  // Branding & Operational Config State
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0B2545');
  const [secondaryColor, setSecondaryColor] = useState('#D97706');
  const [studentIdPrefix, setStudentIdPrefix] = useState('ZAC-STU');
  const [staffIdPrefix, setStaffIdPrefix] = useState('ZAC-STA');
  const [receiptPrefix, setReceiptPrefix] = useState('RCP');
  const [currency, setCurrency] = useState<TenantRecord['currency']>('ETB');
  const [timezone, setTimezone] = useState('Africa/Addis_Ababa');
  const [academicYear, setAcademicYear] = useState('2025/2026');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(ALL_METHODS);
  const [defaultLanguage, setDefaultLanguage] = useState('English (Ethiopia)');
  const [dateFormat, setDateFormat] = useState<TenantRecord['dateFormat']>('GREGORIAN_AND_ETHIOPIAN');
  const [invoiceFooterNote, setInvoiceFooterNote] = useState('');
  const [notificationEmailEnabled, setNotificationEmailEnabled] = useState(true);
  const [notificationSmsEnabled, setNotificationSmsEnabled] = useState(true);
  const [notificationWhatsappEnabled, setNotificationWhatsappEnabled] = useState(false);
  const [emailGatewayStatus, setEmailGatewayStatus] = useState<'CONFIGURED' | 'UNCONFIGURED'>('CONFIGURED');
  const [smsGatewayStatus, setSmsGatewayStatus] = useState<'CONFIGURED' | 'UNCONFIGURED'>('CONFIGURED');
  const [whatsappGatewayStatus, setWhatsappGatewayStatus] = useState<'CONFIGURED' | 'UNCONFIGURED'>('UNCONFIGURED');
  const [smsSenderLabel, setSmsSenderLabel] = useState('');

  // Support Ticket Form State
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState<SupportTicket['category']>('TECHNICAL');
  const [ticketPriority, setTicketPriority] = useState<SupportTicket['priority']>('MEDIUM');
  const [ticketDesc, setTicketDesc] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);

  useEffect(() => {
    if (!activeTenant) return;
    setName(activeTenant.name || '');
    setShortName(activeTenant.shortName || '');
    setEmail(activeTenant.email || '');
    setPhone(activeTenant.phone || '');
    setAddress(activeTenant.address || '');
    setCity(activeTenant.city || '');
    setCountry(activeTenant.country || '');
    setWebsite(activeTenant.website || '');
    setLogoUrl(activeTenant.logoUrl || '');
    setPrimaryColor(activeTenant.primaryColor || '#0B2545');
    setSecondaryColor(activeTenant.secondaryColor || '#D97706');
    setStudentIdPrefix(activeTenant.studentIdPrefix || 'ZAC');
    setStaffIdPrefix(activeTenant.staffIdPrefix || 'ZAC');
    setReceiptPrefix(activeTenant.receiptPrefix || 'RCP');
    setCurrency(activeTenant.currency || 'ETB');
    setTimezone(activeTenant.timezone || 'Africa/Addis_Ababa');
    setAcademicYear(activeTenant.academicYear || '2025/2026');
    setPaymentMethods(activeTenant.paymentMethods?.length ? activeTenant.paymentMethods : ALL_METHODS);
    setDefaultLanguage(activeTenant.defaultLanguage || 'English (Ethiopia)');
    setDateFormat(activeTenant.dateFormat || 'GREGORIAN_AND_ETHIOPIAN');
    setInvoiceFooterNote(activeTenant.invoiceFooterNote || '');
    setNotificationEmailEnabled(Boolean(activeTenant.notificationEmailEnabled));
    setNotificationSmsEnabled(Boolean(activeTenant.notificationSmsEnabled));
    setNotificationWhatsappEnabled(Boolean(activeTenant.notificationWhatsappEnabled));
    setEmailGatewayStatus(activeTenant.emailGatewayStatus || 'UNCONFIGURED');
    setSmsGatewayStatus(activeTenant.smsGatewayStatus || 'UNCONFIGURED');
    setWhatsappGatewayStatus(activeTenant.whatsappGatewayStatus || 'UNCONFIGURED');
    setSmsSenderLabel(activeTenant.smsSenderLabel || '');
  }, [activeTenant]);

  const handleVerifyChapaSubRef = async (txRef: string) => {
    if (!profile || !activeTenant || !txRef) return;
    setVerifyingChapa(true);
    try {
      let savedIntent: { planId?: string; billingCycle?: BillingCycle; amountEtb?: number } = {};
      try {
        const raw = window.sessionStorage.getItem('zims_chapa_sub_intent');
        if (raw) savedIntent = JSON.parse(raw);
      } catch {
        savedIntent = {};
      }
      const res = await fetch('/api/chapa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txRef }),
      });
      const data = (await res.json()) as {
        verified?: boolean;
        amount?: number;
        chapaReference?: string;
        verificationProof?: string;
        error?: string;
      };
      if (!res.ok || !data.verified || !data.verificationProof) {
        throw new Error(data.error || 'Chapa payment has not been confirmed yet.');
      }

      const targetPlan =
        paidPlans.find((p) => p.id === (savedIntent.planId || checkoutPlanId)) || paidPlans[0];
      const targetCycle = savedIntent.billingCycle || checkoutCycle;
      const verifiedAmount =
        typeof data.amount === 'number' && data.amount > 0
          ? data.amount
          : savedIntent.amountEtb || targetPlan.monthlyPriceEtb;
      const existingSub = platformSubscriptions.find((s) => s.tenantId === activeTenant.tenantId);

      const completion = await completeChapaSubscriptionPayment(
        {
          tenant: activeTenant,
          existingSub,
          plan: targetPlan,
          billingCycle: targetCycle,
          amountEtb: verifiedAmount,
          txRef,
          chapaReference: data.chapaReference || txRef,
          verificationProof: data.verificationProof,
        },
        {
          uid: profile.uid,
          fullName: profile.fullName,
          role: profile.role,
          platformRole: profile.platformRole,
        }
      );

      try {
        window.sessionStorage.removeItem('zims_chapa_sub_intent');
        window.history.replaceState(null, '', window.location.pathname);
      } catch {
        // Ignore
      }
      setPendingChapaRef(null);
      pushToast(
        'success',
        `Subscription activated! Invoice ${completion.invoiceNumber} marked PAID. Valid through ${formatDateShort(completion.newExpiresAt)}.`
      );
    } catch (err) {
      pushToast(
        'error',
        err instanceof Error ? err.message : 'Unable to verify Chapa subscription payment.'
      );
    } finally {
      setVerifyingChapa(false);
    }
  };

  const handleStartChapaSubscriptionCheckout = async () => {
    if (!profile || !activeTenant) return;
    if (!canWriteInTenant) {
      pushToast('error', 'Suspended accounts must contact ZACMA Platform Support to reactivate.');
      return;
    }
    const chosenPlan = paidPlans.find((p) => p.id === checkoutPlanId) || paidPlans[0];
    if (!chosenPlan) return;
    const amountEtb =
      checkoutCycle === 'ANNUAL'
        ? chosenPlan.annualPriceEtb
        : checkoutCycle === 'QUARTERLY'
        ? chosenPlan.quarterlyPriceEtb ?? Math.round(chosenPlan.monthlyPriceEtb * 2.7)
        : chosenPlan.monthlyPriceEtb;
    const txRef = `ZIMS-SUB-${activeTenant.tenantId.slice(0, 12).toUpperCase()}-${Date.now()}`;

    setStartingChapa(true);
    try {
      const nameParts = (profile.fullName || 'Institute Admin').trim().split(/\s+/);
      const res = await fetch('/api/chapa/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txRef,
          amount: amountEtb,
          currency: 'ETB',
          email: activeTenant.email || profile.email,
          firstName: nameParts[0] || 'Institute',
          lastName: nameParts.slice(1).join(' ') || 'Admin',
          phoneNumber: activeTenant.phone,
          purpose: 'SUBSCRIPTION',
          description: `${chosenPlan.name} (${checkoutCycle}) for ${activeTenant.name}`,
        }),
      });
      const data = (await res.json()) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(
          data.error || 'Chapa gateway is not configured on this server. Set CHAPA_SECRET_KEY or contact ZACMA Platform Billing.'
        );
      }

      try {
        window.sessionStorage.setItem(
          'zims_chapa_sub_intent',
          JSON.stringify({
            txRef,
            planId: chosenPlan.id,
            billingCycle: checkoutCycle,
            amountEtb,
          })
        );
      } catch {
        // Ignore
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      pushToast(
        'error',
        err instanceof Error ? err.message : 'Unable to start Chapa subscription checkout.'
      );
    } finally {
      setStartingChapa(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setLogoUrl(dataUrl);
      pushToast('info', 'Institute logo prepared. Click Save Institute Settings to apply.');
    } catch {
      pushToast('error', 'Unable to process image file. Please upload a PNG or JPG logo.');
    }
  };

  const toggleMethod = (m: PaymentMethod) => {
    setPaymentMethods((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !activeTenant) return;
    if (!canWriteInTenant) {
      pushToast('error', 'This institute account is suspended. Contact ZACMA Platform Support.');
      return;
    }
    setSaving(true);
    try {
      await updateOwnInstituteBranding(
        activeTenant.id,
        {
          name,
          shortName,
          email,
          phone,
          address,
          city,
          country,
          website,
          logoUrl,
          primaryColor,
          secondaryColor,
          studentIdPrefix,
          staffIdPrefix,
          receiptPrefix,
          currency,
          timezone,
          academicYear,
          paymentMethods: paymentMethods.length > 0 ? paymentMethods : ['Cash', 'Chapa'],
          defaultLanguage,
          dateFormat,
          invoiceFooterNote,
          notificationEmailEnabled,
          notificationSmsEnabled,
          notificationWhatsappEnabled,
          emailGatewayStatus,
          smsGatewayStatus,
          whatsappGatewayStatus,
          smsSenderLabel,
        },
        {
          uid: profile.uid,
          fullName: profile.fullName,
          role: profile.role,
          platformRole: profile.platformRole,
        }
      );
      pushToast('success', 'Institute branding, prefixes, and portal settings updated.');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to save branding settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !activeTenant) return;
    setSubmittingTicket(true);
    try {
      await createSupportTicket(
        {
          tenantId: activeTenant.tenantId,
          tenantName: activeTenant.name,
          subject: ticketSubject,
          category: ticketCategory,
          priority: ticketPriority,
          description: ticketDesc,
        },
        {
          uid: profile.uid,
          fullName: profile.fullName,
          role: profile.role,
          platformRole: profile.platformRole,
        }
      );
      setTicketSubject('');
      setTicketDesc('');
      pushToast('success', 'Support ticket submitted to ZACMA Platform Operations.');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to submit support ticket.');
    } finally {
      setSubmittingTicket(false);
    }
  };

  if (!activeTenant) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
        Loading institute profile ({activeTenantId})...
      </div>
    );
  }

  const tenantInvoices = platformInvoices.filter((i) => i.tenantId === activeTenant.tenantId);
  const tenantTickets = supportTickets.filter((t) => t.tenantId === activeTenant.tenantId);

  const studentPct = Math.min(100, Math.round((students.length / Math.max(1, activeTenant.studentLimit)) * 100));
  const staffPct = Math.min(100, Math.round((staffRecords.length / Math.max(1, activeTenant.staffLimit)) * 100));
  const storagePct = Math.min(100, Math.round(((activeTenant.storageUsedMb || 0) / Math.max(1, activeTenant.storageLimitMb)) * 100));
  const aiPct =
    activeTenant.aiMonthlyQuota > 0
      ? Math.min(100, Math.round(((activeTenant.aiRequestsUsed || 0) / activeTenant.aiMonthlyQuota) * 100))
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-900">
            Institute Branding, Plan &amp; Support
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Customize your institute&apos;s visual identity, receipt headers, ID numbering prefixes, subscription usage, and ZACMA platform support.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg w-fit">
          {(
            [
              { id: 'BRANDING', label: 'Branding & Config', icon: <Palette className="w-3.5 h-3.5" /> },
              { id: 'SUBSCRIPTION', label: 'Plan & Quotas', icon: <CreditCard className="w-3.5 h-3.5" /> },
              { id: 'SUPPORT', label: 'Platform Support', icon: <Headphones className="w-3.5 h-3.5" /> },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                tab === t.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: BRANDING & OPERATIONAL CONFIG */}
      {tab === 'BRANDING' && (
        <form onSubmit={(e) => void handleSaveBranding(e)} className="space-y-6">
          {/* Live Brand Preview Header */}
          <div
            className="rounded-xl p-5 text-white flex flex-wrap items-center justify-between gap-4 shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-3.5">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={name}
                  className="w-12 h-12 rounded-lg object-contain bg-white p-1"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center font-display font-extrabold text-lg text-white border border-white/20"
                  style={{ backgroundColor: secondaryColor }}
                >
                  {(shortName || name || 'TI').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-base font-display font-bold leading-tight">{name || 'Institute Name'}</p>
                <p className="text-xs text-white/80 mt-0.5">
                  {city}, {country} · Prefixes: {studentIdPrefix} / {staffIdPrefix} / {receiptPrefix}
                </p>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Institute Logo</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => void handleLogoUpload(e)}
                className="hidden"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Identity & Contact */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Building2 className="w-4 h-4 text-blue-700" />
                <h3 className="text-sm font-display font-bold text-slate-900">
                  Institutional Identity &amp; Contact
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Official Institute Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Short Name (Sidebar)
                  </label>
                  <input
                    type="text"
                    required
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    required
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official Phone
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Campus Street Address (Displayed on Official Receipts)
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Website URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://yourinstitute.edu.et"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Theme, Prefixes & Financial Formatting */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Palette className="w-4 h-4 text-blue-700" />
                <h3 className="text-sm font-display font-bold text-slate-900">
                  Theme Colors, ID Prefixes &amp; Receipt Footer
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Brand Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-9 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Secondary Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-10 h-9 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Student ID Prefix
                  </label>
                  <input
                    type="text"
                    required
                    value={studentIdPrefix}
                    onChange={(e) => setStudentIdPrefix(e.target.value)}
                    placeholder="e.g., ABC-STU"
                    className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Staff ID Prefix
                  </label>
                  <input
                    type="text"
                    required
                    value={staffIdPrefix}
                    onChange={(e) => setStaffIdPrefix(e.target.value)}
                    placeholder="e.g., ABC-STA"
                    className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Receipt Prefix
                  </label>
                  <input
                    type="text"
                    required
                    value={receiptPrefix}
                    onChange={(e) => setReceiptPrefix(e.target.value)}
                    placeholder="e.g., ABC-RCP"
                    className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as TenantRecord['currency'])}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="ETB">ETB — Ethiopian Birr</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="KES">KES — Kenyan Shilling</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — British Pound</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Accepted Payment Methods
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_METHODS.map((m) => {
                      const active = paymentMethods.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => toggleMethod(m)}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                            active
                              ? 'bg-blue-50 border-blue-300 text-blue-800'
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official Receipt / Invoice Footer Note
                  </label>
                  <input
                    type="text"
                    value={invoiceFooterNote}
                    onChange={(e) => setInvoiceFooterNote(e.target.value)}
                    placeholder="Official financial document issued by..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notification Channel Preferences */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-display font-bold text-slate-900">
              Notification Channels &amp; SMS Sender Label
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationEmailEnabled}
                  onChange={(e) => {
                    setNotificationEmailEnabled(e.target.checked);
                    setEmailGatewayStatus(e.target.checked ? 'CONFIGURED' : 'UNCONFIGURED');
                  }}
                />
                <span className="font-semibold text-slate-800">Email Notifications</span>
              </label>
              <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationSmsEnabled}
                  onChange={(e) => {
                    setNotificationSmsEnabled(e.target.checked);
                    setSmsGatewayStatus(e.target.checked ? 'CONFIGURED' : 'UNCONFIGURED');
                  }}
                />
                <span className="font-semibold text-slate-800">SMS Alerts</span>
              </label>
              <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationWhatsappEnabled}
                  onChange={(e) => {
                    setNotificationWhatsappEnabled(e.target.checked);
                    setWhatsappGatewayStatus(e.target.checked ? 'CONFIGURED' : 'UNCONFIGURED');
                  }}
                />
                <span className="font-semibold text-slate-800">WhatsApp Alerts</span>
              </label>
              <div>
                <input
                  type="text"
                  value={smsSenderLabel}
                  onChange={(e) => setSmsSenderLabel(e.target.value)}
                  placeholder="SMS Sender ID (e.g., ZACMA)"
                  className="w-full px-3 py-2.5 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !canWriteInTenant}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Save Institute Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: SUBSCRIPTION & USAGE QUOTAS */}
      {tab === 'SUBSCRIPTION' && (
        <div className="space-y-6">
          {/* Chapa Return Verification Prompt */}
          {pendingChapaRef && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-blue-950">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#172DEB]" />
                  Chapa Subscription Checkout Returned
                </p>
                <p className="text-blue-900/90 mt-0.5">
                  Reference <code className="font-mono font-bold">{pendingChapaRef}</code> is ready for server-side verification and automatic plan activation.
                </p>
              </div>
              <button
                type="button"
                disabled={verifyingChapa}
                onClick={() => void handleVerifyChapaSubRef(pendingChapaRef)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#172DEB] hover:bg-blue-800 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer"
              >
                {verifyingChapa && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{verifyingChapa ? 'Verifying with Chapa...' : 'Verify & Activate Plan'}</span>
              </button>
            </div>
          )}

          <div className="bg-slate-900 text-white rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                {activeTenant.status} Subscription
              </span>
              <h3 className="text-2xl font-display font-bold mt-1">{activeTenant.planName}</h3>
              <p className="text-xs text-slate-300 mt-1">
                Billing Cycle: <strong>{activeTenant.billingCycle}</strong> · Valid Through:{' '}
                <strong>{formatDateShort(activeTenant.subscriptionExpiresAt)}</strong>
              </p>
            </div>
            <div className="text-left sm:text-right space-y-1.5">
              <div>
                <p className="text-[11px] text-slate-400">Tenant Identifier</p>
                <p className="font-mono text-sm font-bold text-white">{activeTenant.tenantId}</p>
              </div>
              {activeTenant.slug && (
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/institute/${activeTenant.slug}`;
                    void navigator.clipboard?.writeText(url);
                    setCopiedPortalUrl(true);
                    window.setTimeout(() => setCopiedPortalUrl(false), 2000);
                    pushToast('success', 'Institute portal URL copied to clipboard.');
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[11px] font-mono text-blue-200 cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>/institute/{activeTenant.slug}</span>
                  {copiedPortalUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>
          </div>

          {/* Self-Service Online Renewal / Plan Upgrade via Chapa */}
          {!activeTenant.isDefaultPlatformTenant && paidPlans.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-display font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#172DEB]" />
                    Upgrade or Renew Subscription Online (Chapa ETB)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Instant server-verified subscription renewal via Telebirr, CBE Birr, or Bank Card through Chapa.
                  </p>
                </div>
                <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg text-xs">
                  {(
                    [
                      { id: 'MONTHLY', label: 'Monthly' },
                      { id: 'QUARTERLY', label: 'Quarterly' },
                      { id: 'ANNUAL', label: 'Annual' },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCheckoutCycle(c.id)}
                      className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                        checkoutCycle === c.id ? 'bg-[#172DEB] text-white' : 'text-slate-600'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {paidPlans.map((p) => {
                  const selected = p.id === checkoutPlanId;
                  const price =
                    checkoutCycle === 'ANNUAL'
                      ? p.annualPriceEtb
                      : checkoutCycle === 'QUARTERLY'
                      ? p.quarterlyPriceEtb ?? Math.round(p.monthlyPriceEtb * 2.7)
                      : p.monthlyPriceEtb;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setCheckoutPlanId(p.id)}
                      className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        selected
                          ? 'border-[#172DEB] bg-blue-50/40'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="text-xs font-bold text-slate-900">{p.name}</p>
                      <p className="text-lg font-mono font-extrabold text-[#172DEB] mt-1 tabular-nums">
                        {formatEtbCompact(price)}{' '}
                        <span className="text-[11px] font-sans font-normal text-slate-500">
                          / {checkoutCycle === 'ANNUAL' ? 'year' : checkoutCycle === 'QUARTERLY' ? 'quarter' : 'month'}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {p.studentLimit.toLocaleString()} students · {p.staffLimit} staff · {p.aiMonthlyQuota.toLocaleString()} AI req/mo
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={startingChapa || !canWriteInTenant}
                  onClick={() => void handleStartChapaSubscriptionCheckout()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#172DEB] hover:bg-blue-800 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  {startingChapa ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                  <span>{startingChapa ? 'Opening Chapa Checkout...' : 'Pay & Activate via Chapa'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Usage Progress Bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Students Enrolled',
                used: students.length,
                limit: activeTenant.studentLimit,
                pct: studentPct,
                unit: 'students',
              },
              {
                label: 'Staff Records',
                used: staffRecords.length,
                limit: activeTenant.staffLimit,
                pct: staffPct,
                unit: 'staff',
              },
              {
                label: 'Document Storage',
                used: activeTenant.storageUsedMb || 0,
                limit: activeTenant.storageLimitMb,
                pct: storagePct,
                unit: 'MB',
              },
              {
                label: 'AI Monthly Requests',
                used: activeTenant.aiRequestsUsed || 0,
                limit: activeTenant.aiMonthlyQuota,
                pct: aiPct,
                unit: 'req',
              },
            ].map((q) => (
              <div key={q.label} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {q.label}
                </p>
                <p className="text-lg font-display font-bold text-slate-900 tabular-nums">
                  {q.used.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    / {q.limit.toLocaleString()} {q.unit}
                  </span>
                </p>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      q.pct >= 90 ? 'bg-red-600' : q.pct >= 75 ? 'bg-amber-500' : 'bg-blue-700'
                    }`}
                    style={{ width: `${q.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Enabled Modules Grid */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-700" />
              <h3 className="text-sm font-display font-bold text-slate-900">
                Active Platform Modules ({activeTenant.enabledModules.length} / {ALL_SAAS_MODULES.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ALL_SAAS_MODULES.map((m) => {
                const enabled = activeTenant.enabledModules.includes(m.code);
                return (
                  <div
                    key={m.code}
                    className={`p-3 rounded-lg border text-xs ${
                      enabled
                        ? 'bg-emerald-50/60 border-emerald-200 text-slate-900'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{m.label}</span>
                      {enabled ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="text-[10px] font-semibold uppercase">Not in Plan</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{m.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Platform Subscription Invoices */}
          {tenantInvoices.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200">
                <h3 className="text-sm font-display font-bold text-slate-900">
                  ZACMA SaaS Subscription Invoices
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
                      <th className="px-4 py-2.5">Invoice #</th>
                      <th className="px-4 py-2.5">Plan</th>
                      <th className="px-4 py-2.5">Amount</th>
                      <th className="px-4 py-2.5">Due Date</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tenantInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-4 py-2.5">{inv.planName}</td>
                        <td className="px-4 py-2.5 font-mono tabular-nums font-semibold">
                          {formatEtb(inv.amountEtb)}
                        </td>
                        <td className="px-4 py-2.5">{formatDateShort(inv.dueDate)}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                              inv.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PLATFORM SUPPORT TICKETS */}
      {tab === 'SUPPORT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={(e) => void handleCreateTicket(e)}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Headphones className="w-4 h-4 text-blue-700" />
              <h3 className="text-sm font-display font-bold text-slate-900">
                Contact ZACMA Platform Support
              </h3>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                required
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="e.g., Request upgrade to Enterprise plan"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value as SupportTicket['category'])}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="TECHNICAL">Technical</option>
                  <option value="BILLING">Billing</option>
                  <option value="MODULE_UPGRADE">Module Upgrade</option>
                  <option value="ONBOARDING">Onboarding</option>
                  <option value="SECURITY">Security</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                <select
                  value={ticketPriority}
                  onChange={(e) => setTicketPriority(e.target.value as SupportTicket['priority'])}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Issue Details
              </label>
              <textarea
                rows={4}
                required
                value={ticketDesc}
                onChange={(e) => setTicketDesc(e.target.value)}
                placeholder="Describe what you need help with..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={submittingTicket}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submittingTicket ? 'Submitting...' : 'Submit Support Ticket'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h3 className="text-sm font-display font-bold text-slate-900">
                Your Institute Support Tickets ({tenantTickets.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {tenantTickets.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No support tickets opened yet. Use the form on the left to request assistance or plan upgrades.
                </div>
              ) : (
                tenantTickets.map((t) => (
                  <div key={t.id} className="p-4 space-y-1.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-slate-900">{t.subject}</p>
                      <span
                        className={`px-2 py-0.5 rounded font-semibold text-[10px] shrink-0 ${
                          t.status === 'RESOLVED' || t.status === 'CLOSED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <p className="text-slate-600">{t.description}</p>
                    {t.resolutionNotes && (
                      <div className="mt-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-900">
                        <p className="font-semibold text-[11px]">
                          ZACMA Support Response ({t.assignedToName || 'Support Team'}):
                        </p>
                        <p className="text-xs mt-0.5">{t.resolutionNotes}</p>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400">
                      {t.category} · Priority {t.priority} · {formatDateShort(t.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
