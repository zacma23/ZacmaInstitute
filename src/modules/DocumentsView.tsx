import React, { useMemo, useState } from 'react';
import {
  Download,
  Eye,
  FileText,
  FolderOpen,
  Lock,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { usePortal } from '../context/PortalContext';
import { deleteInstituteDocument, saveInstituteDocument } from '../lib/saasService';
import { EmptyState, TableSkeleton } from '../components/PortalUI';
import { formatAddisDateTimeDual } from '../lib/ethiopianCalendar';
import { InstituteDocument, InstituteDocumentCategory } from '../types/zacma';

const CATEGORY_LABELS: Record<InstituteDocumentCategory, string> = {
  SYLLABUS: 'Course Syllabus',
  POLICY: 'Institutional Policy',
  HANDBOOK: 'Student / Staff Handbook',
  CERTIFICATE_TEMPLATE: 'Certificate Template',
  FEE_SCHEDULE: 'Fee Schedule',
  FORM: 'Official Form',
  OTHER: 'Other Document',
};

const VISIBILITY_LABELS: Record<InstituteDocument['visibility'], string> = {
  ADMIN_ONLY: 'Admins & Managers Only',
  ALL_STAFF: 'All Institute Staff',
  STUDENTS_AND_STAFF: 'Students & All Staff',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DocumentsView() {
  const {
    profile,
    effectiveRole,
    activeTenantId,
    canWriteInTenant,
    dataLoading,
    instituteDocuments,
    departments,
    courses,
    pushToast,
  } = usePortal();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | InstituteDocumentCategory>('ALL');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<InstituteDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Upload form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<InstituteDocumentCategory>('SYLLABUS');
  const [visibility, setVisibility] = useState<InstituteDocument['visibility']>('ALL_STAFF');
  const [departmentName, setDepartmentName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [description, setDescription] = useState('');
  const [fileMeta, setFileMeta] = useState<{
    name: string;
    mimeType: string;
    size: number;
    dataUrl: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  const canUpload =
    effectiveRole === 'ADMIN' ||
    effectiveRole === 'MANAGER' ||
    effectiveRole === 'ACCOUNTANT' ||
    effectiveRole === 'INSTRUCTOR' ||
    effectiveRole === 'HR_OFFICER';
  const canDelete = effectiveRole === 'ADMIN' || effectiveRole === 'MANAGER';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return instituteDocuments.filter((doc) => {
      if (categoryFilter !== 'ALL' && doc.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.fileName.toLowerCase().includes(q) ||
        (doc.description || '').toLowerCase().includes(q) ||
        (doc.departmentName || '').toLowerCase().includes(q) ||
        (doc.courseName || '').toLowerCase().includes(q) ||
        doc.uploadedByName.toLowerCase().includes(q)
      );
    });
  }, [instituteDocuments, search, categoryFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 450 * 1024) {
      pushToast(
        'error',
        'File exceeds the 450 KB secure storage cap. Please compress your PDF/image and retry.'
      );
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl || dataUrl.length > 640000) {
        pushToast('error', 'Encoded file is too large (max 450 KB).');
        return;
      }
      setFileMeta({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl,
      });
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !fileMeta) {
      pushToast('error', 'Please select a file to upload.');
      return;
    }
    if (!canWriteInTenant) {
      pushToast('error', 'Account is suspended (read-only mode).');
      return;
    }
    setUploading(true);
    try {
      await saveInstituteDocument(
        {
          tenantId: activeTenantId,
          title: title.trim(),
          category,
          description: description.trim() || undefined,
          fileName: fileMeta.name,
          fileMimeType: fileMeta.mimeType,
          fileSizeBytes: fileMeta.size,
          fileDataUrl: fileMeta.dataUrl,
          visibility,
          departmentName: departmentName || undefined,
          courseName: courseName || undefined,
        },
        {
          uid: profile.uid,
          fullName: profile.fullName,
          role: profile.role,
          platformRole: profile.platformRole,
        }
      );
      pushToast('success', `Document "${title.trim()}" uploaded to institutional library.`);
      setTitle('');
      setDescription('');
      setDepartmentName('');
      setCourseName('');
      setFileMeta(null);
      setUploadOpen(false);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Unable to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docItem: InstituteDocument) => {
    if (!profile || !canDelete) return;
    setDeletingId(docItem.id);
    try {
      await deleteInstituteDocument(docItem, {
        uid: profile.uid,
        fullName: profile.fullName,
        role: profile.role,
        platformRole: profile.platformRole,
      });
      pushToast('info', `Deleted document "${docItem.title}".`);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to delete document.');
    } finally {
      setDeletingId(null);
    }
  };

  const triggerDownload = (docItem: InstituteDocument) => {
    const link = document.createElement('a');
    link.href = docItem.fileDataUrl;
    link.download = docItem.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
            Institutional Document Library
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tenant-isolated repository for course syllabi, training handbooks, official policies, fee schedules, and certificate templates.
          </p>
        </div>
        {canUpload && (
          <button
            type="button"
            disabled={!canWriteInTenant}
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#172DEB] hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        )}
      </div>

      {/* Filter Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents, courses, departments..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#172DEB]"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | InstituteDocumentCategory)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
        >
          <option value="ALL">All Categories ({instituteDocuments.length})</option>
          {(Object.keys(CATEGORY_LABELS) as InstituteDocumentCategory[]).map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      {/* Document Grid */}
      {dataLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl">
          <TableSkeleton rows={5} cols={5} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl">
          <EmptyState
            title="No institutional documents yet"
            description="Upload course syllabi, student handbooks, fee policies, or official forms to share securely inside your institute."
            actionLabel={canUpload ? 'Upload First Document' : undefined}
            onAction={canUpload ? () => setUploadOpen(true) : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((docItem) => {
            const canPreview =
              docItem.fileMimeType.startsWith('image/') ||
              docItem.fileMimeType === 'application/pdf' ||
              docItem.fileMimeType.startsWith('text/');

            return (
              <div
                key={docItem.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#172DEB] flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[#172DEB]">
                          {CATEGORY_LABELS[docItem.category] || docItem.category}
                        </span>
                        <h3 className="text-sm font-display font-bold text-slate-900 truncate">
                          {docItem.title}
                        </h3>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                        docItem.visibility === 'ADMIN_ONLY'
                          ? 'bg-red-50 text-[#E51B23]'
                          : docItem.visibility === 'STUDENTS_AND_STAFF'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {docItem.visibility === 'ADMIN_ONLY' ? (
                        <Lock className="w-3 h-3" />
                      ) : (
                        <Users className="w-3 h-3" />
                      )}
                      <span>
                        {docItem.visibility === 'ADMIN_ONLY'
                          ? 'Admin Only'
                          : docItem.visibility === 'STUDENTS_AND_STAFF'
                          ? 'Students + Staff'
                          : 'Staff Only'}
                      </span>
                    </span>
                  </div>

                  {docItem.description && (
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {docItem.description}
                    </p>
                  )}

                  <div className="text-[11px] text-slate-500 space-y-1">
                    <p className="font-mono text-slate-700 truncate">
                      {docItem.fileName} · {formatFileSize(docItem.fileSizeBytes)}
                    </p>
                    {(docItem.departmentName || docItem.courseName) && (
                      <p className="flex items-center gap-1.5 text-slate-600">
                        <FolderOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {[docItem.departmentName, docItem.courseName].filter(Boolean).join(' · ')}
                        </span>
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">
                      Uploaded by {docItem.uploadedByName} · {formatAddisDateTimeDual(docItem.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {canPreview && (
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(docItem)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => triggerDownload(docItem)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#172DEB] bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      disabled={deletingId === docItem.id}
                      onClick={() => void handleDelete(docItem)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      aria-label={`Delete ${docItem.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Document Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-display font-bold text-slate-900">
                Upload Institutional Document
              </h2>
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleUploadSubmit(e)} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document File (PDF, Image, DOCX, TXT — Max 450 KB) *
                </label>
                <label className="flex flex-col items-center justify-center gap-1.5 p-4 border-2 border-dashed border-slate-300 hover:border-[#172DEB] rounded-xl bg-slate-50 cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-[#172DEB]" />
                  <span className="text-xs font-semibold text-slate-700">
                    {fileMeta
                      ? `${fileMeta.name} (${formatFileSize(fileMeta.size)})`
                      : 'Click to select file from computer'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., 2026 Full-Stack Web Development Syllabus"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as InstituteDocumentCategory)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {(Object.keys(CATEGORY_LABELS) as InstituteDocumentCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Access Visibility
                  </label>
                  <select
                    value={visibility}
                    onChange={(e) =>
                      setVisibility(e.target.value as InstituteDocument['visibility'])
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {(Object.keys(VISIBILITY_LABELS) as InstituteDocument['visibility'][]).map(
                      (vis) => (
                        <option key={vis} value={vis}>
                          {VISIBILITY_LABELS[vis]}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department (Optional)
                  </label>
                  <select
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Related Course (Optional)
                  </label>
                  <select
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">General / All Courses</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional summary of document contents..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !fileMeta}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#172DEB] hover:bg-blue-800 rounded-lg disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Save to Library'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-display font-bold text-slate-900 truncate">
                  {previewDoc.title}
                </h3>
                <p className="text-[11px] font-mono text-slate-500">{previewDoc.fileName}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerDownload(previewDoc)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#172DEB] text-white rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center">
              {previewDoc.fileMimeType.startsWith('image/') ? (
                <img
                  src={previewDoc.fileDataUrl}
                  alt={previewDoc.title}
                  className="max-w-full max-h-[68vh] rounded-lg shadow"
                />
              ) : (
                <iframe
                  src={previewDoc.fileDataUrl}
                  title={previewDoc.title}
                  className="w-full h-[68vh] bg-white rounded-lg border border-slate-200"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
