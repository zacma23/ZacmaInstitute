import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Building2,
  Calendar,
  Clock,
  Edit3,
  Layers,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { usePortal } from '../context/PortalContext';
import { saveCourse } from '../lib/zacmaService';
import {
  DEFAULT_ZACMA_TENANT_ID,
  deleteClassBatch,
  deleteDepartment,
  saveClassBatch,
  saveDepartment,
} from '../lib/saasService';
import {
  CANONICAL_ZACMA_COURSES,
  ensureCanonicalZacmaCourses,
} from '../lib/registrationService';
import { EmptyState, TableSkeleton } from '../components/PortalUI';
import { ModuleAiToolbar } from '../components/ModuleAiToolbar';
import {
  addDaysIso,
  ClassBatch,
  ClassBatchStatus,
  Course,
  Department,
  formatDateShort,
  formatEtb,
  todayIsoDate,
} from '../types/zacma';

type CoursesSubTab = 'COURSES' | 'DEPARTMENTS' | 'BATCHES';

export function CoursesView() {
  const {
    profile,
    effectiveRole,
    activeTenantId,
    actorContext,
    canWriteInTenant,
    dataLoading,
    courses,
    departments,
    classBatches,
    enrollments,
    staffProfiles,
    pushToast,
  } = usePortal();

  const [subTab, setSubTab] = useState<CoursesSubTab>('COURSES');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [editingCourse, setEditingCourse] = useState<Course | 'NEW' | null>(null);
  const [editingDept, setEditingDept] = useState<Department | 'NEW' | null>(null);
  const [editingBatch, setEditingBatch] = useState<ClassBatch | 'NEW' | null>(null);
  const [syncingCanonical, setSyncingCanonical] = useState(false);

  const isAdmin = effectiveRole === 'ADMIN';
  const isManagerOrAdmin = effectiveRole === 'ADMIN' || effectiveRole === 'MANAGER';
  const isInstructor = effectiveRole === 'INSTRUCTOR';
  const isFlagshipZacma = activeTenantId === DEFAULT_ZACMA_TENANT_ID;

  const missingCanonicalCount = useMemo(() => {
    if (!isFlagshipZacma) return 0;
    const names = new Set(courses.map((c) => c.name.trim().toLowerCase()));
    const ids = new Set(courses.map((c) => c.id));
    return CANONICAL_ZACMA_COURSES.filter(
      (c) => !ids.has(c.id) && !names.has(c.name.trim().toLowerCase())
    ).length;
  }, [courses, isFlagshipZacma]);

  const categories = useMemo(() => {
    return Array.from(new Set(courses.map((c) => c.category))).sort();
  }, [courses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false;
      if (departmentFilter !== 'ALL' && (c.departmentId || '') !== departmentFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.departmentName || '').toLowerCase().includes(q) ||
        (c.instructorName || '').toLowerCase().includes(q)
      );
    });
  }, [courses, search, categoryFilter, departmentFilter]);

  const instructors = useMemo(
    () => staffProfiles.filter((s) => s.role === 'INSTRUCTOR' && s.isActive),
    [staffProfiles]
  );

  const handleDeleteDept = async (dept: Department) => {
    if (!profile || !isManagerOrAdmin) return;
    try {
      await deleteDepartment(dept, {
        uid: profile.uid,
        fullName: profile.fullName,
        role: profile.role,
        platformRole: profile.platformRole,
      });
      pushToast('info', `Deleted department ${dept.name}.`);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to delete department.');
    }
  };

  const handleDeleteBatch = async (cb: ClassBatch) => {
    if (!profile || !isManagerOrAdmin) return;
    try {
      await deleteClassBatch(cb, {
        uid: profile.uid,
        fullName: profile.fullName,
        role: profile.role,
        platformRole: profile.platformRole,
      });
      pushToast('info', `Deleted class batch ${cb.name}.`);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to delete class batch.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
            {isInstructor
              ? 'Assigned Training Classes & Batches'
              : 'Academics: Courses, Departments & Classes'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isManagerOrAdmin
              ? 'Manage academic departments, training courses, tuition schedules, and active class cohorts for your institute.'
              : isInstructor
              ? 'View assigned training tracks, departments, weekly schedules, and enrolled cohorts.'
              : 'Read-only institutional course catalog, departments, and class schedules.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {subTab === 'COURSES' && isAdmin && (
            <>
              {missingCanonicalCount > 0 && profile && (
                <button
                  type="button"
                  disabled={syncingCanonical || !canWriteInTenant}
                  onClick={async () => {
                    setSyncingCanonical(true);
                    try {
                      const added = await ensureCanonicalZacmaCourses(courses, {
                        uid: profile.uid,
                        fullName: profile.fullName,
                        role: profile.role,
                        tenantId: activeTenantId,
                      });
                      pushToast(
                        'success',
                        added > 0
                          ? `Added ${added} missing ZACMA Technology courses to the catalog.`
                          : 'All 18 canonical ZACMA courses are already active.'
                      );
                    } catch (err) {
                      pushToast(
                        'error',
                        err instanceof Error ? err.message : 'Unable to sync ZACMA courses.'
                      );
                    } finally {
                      setSyncingCanonical(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#172DEB] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {syncingCanonical
                    ? 'Syncing...'
                    : `Sync ${missingCanonicalCount} ZACMA Course${missingCanonicalCount > 1 ? 's' : ''}`}
                </button>
              )}
              <button
                type="button"
                disabled={!canWriteInTenant}
                onClick={() => setEditingCourse('NEW')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#172DEB] hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add New Course
              </button>
            </>
          )}

          {subTab === 'DEPARTMENTS' && isManagerOrAdmin && (
            <button
              type="button"
              disabled={!canWriteInTenant}
              onClick={() => setEditingDept('NEW')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#172DEB] hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Department
            </button>
          )}

          {subTab === 'BATCHES' && isManagerOrAdmin && (
            <button
              type="button"
              disabled={!canWriteInTenant || courses.length === 0}
              onClick={() => setEditingBatch('NEW')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#172DEB] hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Class / Batch
            </button>
          )}
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {(
          [
            {
              id: 'COURSES',
              label: `Courses Catalog (${courses.length})`,
              icon: <BookOpen className="w-3.5 h-3.5" />,
            },
            {
              id: 'DEPARTMENTS',
              label: `Departments (${departments.length})`,
              icon: <Building2 className="w-3.5 h-3.5" />,
            },
            {
              id: 'BATCHES',
              label: `Classes & Batches (${classBatches.length})`,
              icon: <Layers className="w-3.5 h-3.5" />,
            },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              subTab === t.id
                ? 'bg-[#172DEB] text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <ModuleAiToolbar moduleKey="courses" moduleLabel="Courses, Departments & Batches" />

      {/* TAB 1: COURSES CATALOG */}
      {subTab === 'COURSES' && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search course name, code, department..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#172DEB]"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {departments.length > 0 && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {dataLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl">
              <TableSkeleton rows={5} cols={4} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl">
              <EmptyState
                title="No courses found"
                description="Try clearing your filter or add a new training course for your institute."
                actionLabel={isAdmin ? 'Create Course' : undefined}
                onAction={isAdmin ? () => setEditingCourse('NEW') : undefined}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((course) => {
                const activeCount = enrollments.filter(
                  (e) =>
                    e.courseId === course.id &&
                    (e.status === 'ACTIVE' || e.status === 'COMPLETED')
                ).length;
                const pendingCount = enrollments.filter(
                  (e) => e.courseId === course.id && e.status === 'PENDING'
                ).length;

                return (
                  <div
                    key={course.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] text-slate-500">
                            <span className="font-mono font-semibold text-[#172DEB]">
                              {course.code}
                            </span>{' '}
                            · {course.category}
                            {course.departmentName ? ` · ${course.departmentName}` : ''}
                          </p>
                          <h3 className="text-base font-display font-bold text-slate-900 mt-1">
                            {course.name}
                          </h3>
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setEditingCourse(course)}
                            className="p-1.5 text-slate-400 hover:text-[#172DEB] rounded-md transition-colors"
                            aria-label={`Edit ${course.name}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {course.description && (
                        <p className="text-xs text-slate-600 leading-relaxed mt-2.5 line-clamp-2">
                          {course.description}
                        </p>
                      )}

                      <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{course.schedule}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {course.durationWeeks} weeks · Instructor:{' '}
                            <span className="font-medium text-slate-900">
                              {course.instructorName || 'Unassigned'}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="tabular-nums">
                            {activeCount} active student{activeCount === 1 ? '' : 's'}
                            {!isInstructor && pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!isInstructor && (
                      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-slate-500">Standard Tuition Fee</p>
                          <p className="text-base font-mono font-bold text-slate-900 tabular-nums">
                            {formatEtb(course.feeEtb)}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            course.isActive ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {course.isActive ? 'Active' : 'Archived'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: ACADEMIC DEPARTMENTS */}
      {subTab === 'DEPARTMENTS' && (
        <>
          {departments.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl">
              <EmptyState
                title="No departments configured yet"
                description="Organize your institute's courses, instructors, and class batches into academic departments (e.g., Software Engineering, Business & Accounting, Vocational Trades)."
                actionLabel={isManagerOrAdmin ? 'Create First Department' : undefined}
                onAction={isManagerOrAdmin ? () => setEditingDept('NEW') : undefined}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map((dept) => {
                const linkedCourses = courses.filter((c) => c.departmentId === dept.id).length;
                const linkedBatches = classBatches.filter((b) => b.departmentId === dept.id).length;
                return (
                  <div
                    key={dept.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-[11px] font-bold text-[#172DEB] bg-blue-50 px-2 py-0.5 rounded">
                            {dept.code}
                          </span>
                          <h3 className="text-base font-display font-bold text-slate-900 mt-1.5">
                            {dept.name}
                          </h3>
                        </div>
                        {isManagerOrAdmin && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingDept(dept)}
                              className="p-1.5 text-slate-400 hover:text-[#172DEB] rounded-md"
                              aria-label={`Edit ${dept.name}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteDept(dept)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-md"
                              aria-label={`Delete ${dept.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      {dept.description && (
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                          {dept.description}
                        </p>
                      )}
                      {dept.headName && (
                        <p className="text-xs text-slate-500 mt-2">
                          Department Head:{' '}
                          <strong className="text-slate-800">{dept.headName}</strong>
                        </p>
                      )}
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-600 tabular-nums">
                        <strong>{linkedCourses}</strong> courses · <strong>{linkedBatches}</strong>{' '}
                        batches
                      </span>
                      <span
                        className={`font-semibold ${
                          dept.isActive ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {dept.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 3: CLASSES & BATCHES */}
      {subTab === 'BATCHES' && (
        <>
          {classBatches.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl">
              <EmptyState
                title="No class batches scheduled yet"
                description="Schedule active training cohorts with room assignments, instructors, seat capacity, and start/end dates."
                actionLabel={
                  isManagerOrAdmin && courses.length > 0 ? 'Create First Class Batch' : undefined
                }
                onAction={isManagerOrAdmin ? () => setEditingBatch('NEW') : undefined}
              />
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
                      <th className="px-4 py-3">Batch &amp; Course</th>
                      <th className="px-4 py-3">Schedule &amp; Room</th>
                      <th className="px-4 py-3">Instructor</th>
                      <th className="px-4 py-3">Term Dates</th>
                      <th className="px-4 py-3 text-right">Capacity</th>
                      <th className="px-4 py-3">Status</th>
                      {isManagerOrAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classBatches.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">
                            <span className="font-mono text-[#172DEB] mr-1.5">{b.batchCode}</span>
                            {b.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {b.courseName}
                            {b.departmentName ? ` · ${b.departmentName}` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-800">{b.schedule}</p>
                          {b.room && (
                            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" />
                              {b.room}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {b.instructorName || 'Unassigned'}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-600">
                          {formatDateShort(b.startDate)} &rarr; {formatDateShort(b.endDate)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                          {b.capacity} seats
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              b.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : b.status === 'UPCOMING'
                                ? 'bg-blue-50 text-[#172DEB]'
                                : b.status === 'COMPLETED'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        {isManagerOrAdmin && (
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingBatch(b)}
                                className="p-1.5 text-slate-400 hover:text-[#172DEB] rounded"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteBatch(b)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* COURSE MODAL */}
      {editingCourse && profile && actorContext && (
        <CourseFormModal
          initial={editingCourse === 'NEW' ? null : editingCourse}
          instructors={instructors}
          departments={departments}
          onClose={() => setEditingCourse(null)}
          onSaved={async (payload) => {
            try {
              await saveCourse(payload, actorContext);
              pushToast(
                'success',
                payload.id ? `Updated course ${payload.name}.` : `Created course ${payload.name}.`
              );
              setEditingCourse(null);
            } catch (err) {
              pushToast('error', err instanceof Error ? err.message : 'Failed to save course.');
            }
          }}
        />
      )}

      {/* DEPARTMENT MODAL */}
      {editingDept && profile && (
        <DepartmentFormModal
          initial={editingDept === 'NEW' ? null : editingDept}
          onClose={() => setEditingDept(null)}
          onSaved={async (payload) => {
            try {
              await saveDepartment(
                {
                  ...payload,
                  tenantId: activeTenantId,
                },
                {
                  uid: profile.uid,
                  fullName: profile.fullName,
                  role: profile.role,
                  platformRole: profile.platformRole,
                }
              );
              pushToast(
                'success',
                payload.id
                  ? `Updated department ${payload.name}.`
                  : `Created department ${payload.name}.`
              );
              setEditingDept(null);
            } catch (err) {
              pushToast('error', err instanceof Error ? err.message : 'Failed to save department.');
            }
          }}
        />
      )}

      {/* CLASS BATCH MODAL */}
      {editingBatch && profile && (
        <ClassBatchFormModal
          initial={editingBatch === 'NEW' ? null : editingBatch}
          courses={courses}
          departments={departments}
          instructors={instructors}
          onClose={() => setEditingBatch(null)}
          onSaved={async (payload) => {
            try {
              await saveClassBatch(
                {
                  ...payload,
                  tenantId: activeTenantId,
                },
                {
                  uid: profile.uid,
                  fullName: profile.fullName,
                  role: profile.role,
                  platformRole: profile.platformRole,
                }
              );
              pushToast(
                'success',
                payload.id
                  ? `Updated class batch ${payload.name}.`
                  : `Created class batch ${payload.name}.`
              );
              setEditingBatch(null);
            } catch (err) {
              pushToast(
                'error',
                err instanceof Error ? err.message : 'Failed to save class batch.'
              );
            }
          }}
        />
      )}
    </div>
  );
}

function CourseFormModal({
  initial,
  instructors,
  departments,
  onClose,
  onSaved,
}: {
  initial: Course | null;
  instructors: ReturnType<typeof usePortal>['staffProfiles'];
  departments: Department[];
  onClose: () => void;
  onSaved: (payload: {
    id?: string;
    code: string;
    name: string;
    category: string;
    departmentId?: string;
    departmentName?: string;
    durationWeeks: number;
    feeEtb: number;
    schedule: string;
    instructorId?: string;
    instructorName?: string;
    description?: string;
    isActive: boolean;
    createdAt?: string;
  }) => Promise<void>;
}) {
  const [code, setCode] = useState(initial?.code || 'CRS-201');
  const [name, setName] = useState(initial?.name || '');
  const [category, setCategory] = useState(initial?.category || 'Short-Term Training');
  const [departmentId, setDepartmentId] = useState(initial?.departmentId || '');
  const [durationWeeks, setDurationWeeks] = useState(String(initial?.durationWeeks || 8));
  const [feeEtb, setFeeEtb] = useState(String(initial?.feeEtb || 10000));
  const [schedule, setSchedule] = useState(initial?.schedule || 'Mon, Wed, Fri · 14:00–16:30');
  const [instructorId, setInstructorId] = useState(initial?.instructorId || instructors[0]?.uid || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || Number(feeEtb) <= 0) return;
    setSaving(true);
    const chosenInstructor = instructors.find((i) => i.uid === instructorId);
    const chosenDept = departments.find((d) => d.id === departmentId);
    await onSaved({
      id: initial?.id,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      category: category.trim(),
      departmentId: chosenDept?.id || undefined,
      departmentName: chosenDept?.name || undefined,
      durationWeeks: Math.max(1, Number(durationWeeks)),
      feeEtb: Number(feeEtb),
      schedule: schedule.trim(),
      instructorId: chosenInstructor?.uid || initial?.instructorId,
      instructorName: chosenInstructor?.fullName || initial?.instructorName,
      description: description.trim(),
      isActive,
      createdAt: initial?.createdAt,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-base font-display font-bold text-slate-900">
            {initial ? 'Edit Training Course' : 'Create Training Course'}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Course Code</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono uppercase"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Course Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Mobile App Development"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <input
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">General / No Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Duration (Weeks)
              </label>
              <input
                type="number"
                required
                min={1}
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tuition Fee (ETB)
              </label>
              <input
                type="number"
                required
                min={1}
                step="0.01"
                value={feeEtb}
                onChange={(e) => setFeeEtb(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Class Schedule</label>
              <input
                type="text"
                required
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Instructor
              </label>
              <select
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Unassigned</option>
                {instructors.map((inst) => (
                  <option key={inst.uid} value={inst.uid}>
                    {inst.fullName}
                  </option>
                ))}
              </select>
            </div>
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

          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300 text-blue-700"
            />
            Course open for student enrollment
          </label>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
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
              className="px-4 py-2 text-xs font-semibold text-white bg-[#172DEB] hover:bg-blue-800 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : initial ? 'Save Changes' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DepartmentFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Department | null;
  onClose: () => void;
  onSaved: (payload: {
    id?: string;
    code: string;
    name: string;
    headName?: string;
    description?: string;
    isActive: boolean;
    existingCreatedAt?: string;
  }) => Promise<void>;
}) {
  const [code, setCode] = useState(initial?.code || 'TECH');
  const [name, setName] = useState(initial?.name || '');
  const [headName, setHeadName] = useState(initial?.headName || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    setSaving(true);
    await onSaved({
      id: initial?.id,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      headName: headName.trim() || undefined,
      description: description.trim() || undefined,
      isActive,
      existingCreatedAt: initial?.createdAt,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-base font-display font-bold text-slate-900">
            {initial ? 'Edit Department' : 'Create Academic Department'}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="TECH"
                className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-lg"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Software & IT Engineering"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department Head (Optional)
            </label>
            <input
              type="text"
              value={headName}
              onChange={(e) => setHeadName(e.target.value)}
              placeholder="e.g., Eng. Dawit Tesfaye"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Department active
          </label>
          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
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
              className="px-4 py-2 text-xs font-semibold text-white bg-[#172DEB] hover:bg-blue-800 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : initial ? 'Save Changes' : 'Create Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ClassBatchFormModal({
  initial,
  courses,
  departments,
  instructors,
  onClose,
  onSaved,
}: {
  initial: ClassBatch | null;
  courses: Course[];
  departments: Department[];
  instructors: ReturnType<typeof usePortal>['staffProfiles'];
  onClose: () => void;
  onSaved: (payload: {
    id?: string;
    batchCode: string;
    name: string;
    courseId: string;
    courseName: string;
    departmentId?: string;
    departmentName?: string;
    instructorId?: string;
    instructorName?: string;
    room?: string;
    schedule: string;
    startDate: string;
    endDate: string;
    capacity: number;
    status: ClassBatchStatus;
    existingCreatedAt?: string;
  }) => Promise<void>;
}) {
  const [batchCode, setBatchCode] = useState(
    initial?.batchCode || `BCH-${new Date().getFullYear()}-01`
  );
  const [name, setName] = useState(initial?.name || '');
  const [courseId, setCourseId] = useState(initial?.courseId || courses[0]?.id || '');
  const [departmentId, setDepartmentId] = useState(initial?.departmentId || '');
  const [instructorId, setInstructorId] = useState(initial?.instructorId || '');
  const [room, setRoom] = useState(initial?.room || 'Lab 101');
  const [schedule, setSchedule] = useState(initial?.schedule || 'Mon–Fri · 08:30–11:30');
  const [startDate, setStartDate] = useState(initial?.startDate || todayIsoDate());
  const [endDate, setEndDate] = useState(initial?.endDate || addDaysIso(todayIsoDate(), 60));
  const [capacity, setCapacity] = useState(String(initial?.capacity || 30));
  const [status, setStatus] = useState<ClassBatchStatus>(initial?.status || 'ACTIVE');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const course = courses.find((c) => c.id === courseId) || courses[0];
    if (!course || !name.trim()) return;
    setSaving(true);
    const dept = departments.find((d) => d.id === departmentId);
    const inst = instructors.find((i) => i.uid === instructorId);
    await onSaved({
      id: initial?.id,
      batchCode: batchCode.trim().toUpperCase(),
      name: name.trim(),
      courseId: course.id,
      courseName: course.name,
      departmentId: dept?.id || course.departmentId || undefined,
      departmentName: dept?.name || course.departmentName || undefined,
      instructorId: inst?.uid || undefined,
      instructorName: inst?.fullName || undefined,
      room: room.trim() || undefined,
      schedule: schedule.trim(),
      startDate,
      endDate,
      capacity: Math.max(1, Number(capacity || 30)),
      status,
      existingCreatedAt: initial?.createdAt,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-base font-display font-bold text-slate-900">
            {initial ? 'Edit Class / Batch' : 'Schedule New Class / Batch'}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Code</label>
              <input
                type="text"
                required
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-lg"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Cohort 2026-A Morning"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Course</label>
              <select
                required
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Use Course Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Instructor</label>
              <select
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Unassigned</option>
                {instructors.map((i) => (
                  <option key={i.uid} value={i.uid}>
                    {i.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Room / Lab</label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g., Computer Lab B"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Weekly Schedule</label>
            <input
              type="text"
              required
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Capacity</label>
              <input
                type="number"
                required
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ClassBatchStatus)}
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="UPCOMING">Upcoming</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
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
              className="px-4 py-2 text-xs font-semibold text-white bg-[#172DEB] hover:bg-blue-800 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : initial ? 'Save Changes' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
