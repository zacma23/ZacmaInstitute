import React from 'react';
import { ArrowRight, BookOpen, CalendarDays, ClipboardCheck, ShieldCheck, Users } from 'lucide-react';
import { usePortal } from '../context/PortalContext';
import { EmptyState, StatusLabel } from '../components/PortalUI';
import { formatDateShort, NavSection, todayIsoDate } from '../types/zacma';

export function GeneralStaffView({ onNavigate }: { onNavigate: (tab: NavSection) => void }) {
  const { courses, students, enrollments, attendance } = usePortal();
  const today = todayIsoDate();

  const activeCourses = courses.filter((c) => c.isActive);
  const activeStudents = students.filter((s) => s.registrationStatus === 'APPROVED');
  const pendingRegistrations = students.filter((s) => s.registrationStatus === 'PENDING');
  const todayAttendance = attendance.filter((a) => a.attendanceDate === today);
  const presentToday = todayAttendance.filter((a) => a.status === 'PRESENT').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
            General Staff Operations Workspace
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Campus course schedules, student directory overview, and attendance coordination. Financial records are isolated to Finance and Admin roles.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('students')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            Student Directory
          </button>
          <button
            type="button"
            onClick={() => onNavigate('courses')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Course Catalog
          </button>
        </div>
      </div>

      {/* Operational KPIs (strictly non-financial) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Active Courses</span>
            <BookOpen className="w-4 h-4 text-blue-700" />
          </div>
          <p className="text-2xl font-display font-bold text-slate-900 tabular-nums">
            {activeCourses.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Scheduled ZACMA training programs</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Active Enrolled Students</span>
            <Users className="w-4 h-4 text-blue-700" />
          </div>
          <p className="text-2xl font-display font-bold text-slate-900 tabular-nums">
            {activeStudents.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {pendingRegistrations.length} registration{pendingRegistrations.length === 1 ? '' : 's'} pending review
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Attendance Logged Today</span>
            <ClipboardCheck className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="text-2xl font-display font-bold text-slate-900 tabular-nums">
            {todayAttendance.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {presentToday} present on {formatDateShort(today)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Role Access Scope</span>
            <ShieldCheck className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-base font-display font-bold text-slate-900 mt-1">Operations Only</p>
          <p className="text-xs text-slate-500 mt-1">Zero financial ledger or fee modification access</p>
        </div>
      </div>

      {/* Campus Schedules + Recent Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-700" />
              <h2 className="text-sm font-bold text-slate-900">Campus Training Schedule</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('courses')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {activeCourses.slice(0, 7).map((course) => {
              const count = enrollments.filter(
                (e) => e.courseId === course.id && e.status === 'ACTIVE'
              ).length;
              return (
                <div key={course.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{course.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span className="font-mono">{course.code}</span> · {course.schedule}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono font-semibold text-slate-900 tabular-nums">
                      {count} active
                    </p>
                    <p className="text-[11px] text-slate-500">{course.instructorName || 'Assigned Faculty'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Recent Campus Attendance</h2>
            <button
              type="button"
              onClick={() => onNavigate('attendance')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1"
            >
              Attendance log <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {attendance.length === 0 ? (
            <EmptyState
              title="No attendance records logged"
              description="Attendance entries recorded by instructors will appear here."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {attendance.slice(0, 7).map((row) => (
                <div key={row.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{row.studentName}</p>
                    <p className="text-[11px] text-slate-500">
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
