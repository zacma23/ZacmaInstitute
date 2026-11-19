import React, { useMemo, useState } from 'react';
import { Download, Edit3, Plus, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import { usePortal } from '../context/PortalContext';
import { exportRowsToCsv, removeStaffProfile, saveStaffProfile } from '../lib/zacmaService';
import { ConfirmDialog, EmptyState, PaginationBar } from '../components/PortalUI';
import { formatDateShort, RoleCode, StaffProfile, todayIsoDate } from '../types/zacma';

export function StaffRolesView() {
  const { profile, effectiveRole, staffProfiles, roles, students, pushToast } = usePortal();
  const [editing, setEditing] = useState<StaffProfile | 'NEW' | null>(null);
  const [deleting, setDeleting] = useState<StaffProfile | null>(null);
  const [busy, setBusy] = useState(false);

  if (effectiveRole !== 'ADMIN') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <ShieldAlert className="w-7 h-7 text-red-600 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">Administrator Access Only</h2>
        <p className="text-xs text-slate-500 mt-1">
          Staff accounts and RBAC role assignments can only be managed by an Administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
            Staff, Accounts &amp; Role Permissions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Assign Admin, Accountant, Instructor, General Staff, and Student Portal roles enforced directly by database security rules.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('NEW')}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Add Staff Member
        </button>
      </div>

      {/* Role Permissions Reference Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {roles.map((r) => (
          <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-mono font-bold text-blue-700">{r.code}</p>
            <h3 className="text-sm font-display font-bold text-slate-900 mt-1">{r.name}</h3>
            <p className="text-xs text-slate-600 leading-relaxed mt-2">{r.description}</p>
          </div>
        ))}
      </div>

      {/* Staff Directory Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-3">Email &amp; Phone</th>
                <th className="py-3 px-3">Assigned Role</th>
                <th className="py-3 px-3">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {staffProfiles.map((member) => {
                const isSelf = member.uid === profile?.uid;
                return (
                  <tr key={member.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">
                        {member.fullName}{' '}
                        {isSelf && <span className="text-blue-700 font-normal">(You)</span>}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500">{member.uid}</p>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <p>{member.email}</p>
                      <p className="text-[11px] font-mono text-slate-500">{member.phone || '—'}</p>
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-900">
                      {member.role}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-semibold ${
                          member.isActive ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {member.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditing(member)}
                          className="p-1.5 text-slate-500 hover:text-blue-700 rounded-md"
                          aria-label={`Edit ${member.fullName}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => setDeleting(member)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-md"
                            aria-label={`Remove ${member.fullName}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && profile && (
        <StaffModal
          initial={editing === 'NEW' ? null : editing}
          students={students}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            await saveStaffProfile(data, {
              uid: profile.uid,
              fullName: profile.fullName,
              role: profile.role,
            });
            pushToast('success', `Saved account ${data.fullName} (${data.role}).`);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Remove Staff Account"
        description={`Revoke portal access for ${deleting?.fullName} (${deleting?.email})?`}
        confirmLabel="Remove Staff"
        tone="danger"
        loading={busy}
        onConfirm={async () => {
          if (!deleting || !profile) return;
          setBusy(true);
          try {
            await removeStaffProfile(deleting, {
              uid: profile.uid,
              fullName: profile.fullName,
              role: profile.role,
            });
            pushToast('info', `Removed ${deleting.fullName}.`);
            setDeleting(null);
          } catch (err) {
            pushToast('error', err instanceof Error ? err.message : 'Unable to remove staff.');
          } finally {
            setBusy(false);
          }
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function StaffModal({
  initial,
  students,
  onClose,
  onSave,
}: {
  initial: StaffProfile | null;
  students: Array<{ id: string; studentCode: string; fullName: string }>;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    email: string;
    fullName: string;
    phone?: string;
    role: RoleCode;
    linkedStudentId?: string;
    isActive: boolean;
    createdAt?: string;
  }) => Promise<void>;
}) {
  const [fullName, setFullName] = useState(initial?.fullName || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [role, setRole] = useState<RoleCode>(initial?.role || 'ACCOUNTANT');
  const [linkedStudentId, setLinkedStudentId] = useState(initial?.linkedStudentId || '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;
    setSaving(true);
    await onSave({
      id: initial?.id,
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      role,
      linkedStudentId: role === 'STUDENT' ? linkedStudentId || undefined : undefined,
      isActive,
      createdAt: initial?.createdAt,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="text-base font-display font-bold text-slate-900">
            {initial ? 'Edit Portal Account Role' : 'Add Portal Account'}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+251 9..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Portal Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as RoleCode)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="ADMIN">ADMIN — Full Financial &amp; Governance Access</option>
              <option value="ACCOUNTANT">ACCOUNTANT — Registration &amp; Fee Collection</option>
              <option value="INSTRUCTOR">INSTRUCTOR — Classes &amp; Attendance Only</option>
              <option value="GENERAL_STAFF">GENERAL_STAFF — Campus Operations (No Finance)</option>
              <option value="STUDENT">STUDENT — Isolated Student Self-Service Portal</option>
            </select>
          </div>
          {role === 'STUDENT' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Linked ZACMA Student Record
              </label>
              <select
                value={linkedStudentId}
                onChange={(e) => setLinkedStudentId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Select student to bind...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.studentCode} — {s.fullName}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Student portal access is strictly isolated to this single student record.
              </p>
            </div>
          )}
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300 text-blue-700"
            />
            Account active
          </label>
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
              {saving ? 'Saving...' : 'Save Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AuditLogsView() {
  const { effectiveRole, auditLogs, pushToast } = usePortal();
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  if (effectiveRole !== 'ADMIN') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <ShieldAlert className="w-7 h-7 text-red-600 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">Administrator Access Only</h2>
        <p className="text-xs text-slate-500 mt-1">
          The immutable financial and governance audit trail is restricted to Administrators.
        </p>
      </div>
    );
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auditLogs.filter((l) => {
      if (entityFilter !== 'ALL' && l.entityType !== entityFilter) return false;
      if (!q) return true;
      return (
        l.actorName.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.summary.toLowerCase().includes(q) ||
        l.entityId.toLowerCase().includes(q)
      );
    });
  }, [auditLogs, search, entityFilter]);

  const paginated = filtered.slice((page - 1) * 12, page * 12);

  const handleExport = () => {
    exportRowsToCsv(
      `zacma-audit-trail-${todayIsoDate()}.csv`,
      ['Timestamp', 'Actor', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Summary'],
      filtered.map((l) => [
        l.createdAt,
        l.actorName,
        l.actorRole,
        l.action,
        l.entityType,
        l.entityId,
        l.summary,
      ])
    );
    pushToast('success', 'Audit trail exported to CSV.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
            Immutable Financial &amp; Governance Audit Trail
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Append-only log of registrations, approvals, rejections, receipts, expenses, and role updates. Entries cannot be altered or deleted.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
        >
          <Download className="w-3.5 h-3.5" />
          Export Audit CSV
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search actor, action, reference, summary..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
          />
        </div>
        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
        >
          <option value="ALL">All Domains</option>
          <option value="payment">Payments</option>
          <option value="student">Students</option>
          <option value="course">Courses</option>
          <option value="expense">Expenses</option>
          <option value="attendance">Attendance</option>
          <option value="profile">Staff Roles</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {paginated.length === 0 ? (
          <EmptyState
            title="No audit events match your filter"
            description="System actions will appear here automatically."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-3">Actor</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-4">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginated.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {formatDateShort(log.createdAt)} ·{' '}
                      {new Date(log.createdAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <p className="font-semibold text-slate-900">{log.actorName}</p>
                      <p className="text-[11px] font-mono text-slate-500">{log.actorRole}</p>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <p className="font-mono font-semibold text-blue-700">{log.action}</p>
                      <p className="text-[11px] text-slate-500">{log.entityType}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-700 leading-relaxed">{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PaginationBar
          page={page}
          pageSize={12}
          total={filtered.length}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
