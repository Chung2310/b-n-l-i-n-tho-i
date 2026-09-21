import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  MapPin,
  Pencil,
  Plus,
  Search,
  Upload,
  Users,
} from "lucide-react";
import { recruitmentApi } from "../../../services/recruitmentService";
import { departmentService } from "../../../services/departmentService";
import type { DepartmentRecord } from "../../../types/hr";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "../../../pages/Toast";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import type {
  RecruitmentJob,
  RecruitmentJobStatus,
} from "../../../types/recruitment";
import {
  fieldClass,
  labelClass,
  primaryButton,
  RecruitmentDialog,
  secondaryButton,
  ViewState,
} from "./RecruitmentForms";
import {
  RECRUITMENT_FILE_ACCEPT,
  validateRecruitmentFile,
} from "./recruitmentFile";
import { jobStatusLabels } from "./recruitmentLabels";
import { ConfirmDialog } from "../../common/ConfirmDialog";

const emptyJob = {
  code: "",
  title: "",
  department: "",
  headcount: 1,
  description: "",
  requirements: "",
  benefits: "",
  employmentType: "full_time",
  workplaceType: "onsite" as const,
  location: "",
  applicationDeadline: "",
  showSalary: false,
  status: "draft" as const,
};

const statusLabel: Record<RecruitmentJobStatus, string> = jobStatusLabels;

const statusBadgeStyles: Record<
  RecruitmentJobStatus,
  { bg: string; text: string; dot: string }
> = {
  open: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  draft: { bg: "bg-slate-100 border-slate-200", text: "text-slate-600", dot: "bg-slate-400" },
  paused: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
  closed: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", dot: "bg-rose-500" },
};

export default function RecruitmentJobsView({
  canManage,
}: {
  canManage: boolean;
}) {
  let companyCode = "";
  try {
    companyCode = useAuth()?.userProfile?.companyCode || "";
  } catch {
    companyCode = "";
  }

  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<RecruitmentJob | null | undefined>();
  const [changingStatusJobId, setChangingStatusJobId] = useState<string | null>(
    null
  );
  const [pendingDeleteJob, setPendingDeleteJob] =
    useState<RecruitmentJob | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    departmentService
      .list(companyCode && companyCode !== "SYSTEM" ? companyCode : undefined)
      .then((data) => {
        if (Array.isArray(data)) {
          setDepartments(data.filter((d) => d.isActive !== false));
        }
      })
      .catch(() => {
        setDepartments([]);
      });
  }, [companyCode]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setJobs(await recruitmentApi.listJobs({ search, status }));
    } catch (e: any) {
      setError(
        getApiErrorMessage(e, "Không thể tải danh sách vị trí tuyển dụng.")
      );
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = async (
    job: RecruitmentJob,
    next: RecruitmentJobStatus
  ) => {
    if (next === job.status) return;
    setChangingStatusJobId(job._id);
    try {
      await recruitmentApi.changeJobStatus(job._id, job.version, next);
      await load();
      toast.success(`Đã chuyển tin ${job.code} sang ${statusLabel[next]}.`);
    } catch (e: any) {
      const message =
        e.status === 409
          ? "Không thể cập nhật trạng thái vì tin tuyển dụng đã được thay đổi ở nơi khác. Danh sách đã được tải lại."
          : getApiErrorMessage(
              e,
              "Không thể cập nhật trạng thái tin tuyển dụng. Vui lòng thử lại."
            );
      await load();
      toast.error(message);
    } finally {
      setChangingStatusJobId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDeleteJob || deleting) return;
    const job = pendingDeleteJob;
    setDeleting(true);
    try {
      await recruitmentApi.deleteJob(job._id, job.version);
      setPendingDeleteJob(null);
      await load();
      toast.success(`Đã xóa tin tuyển dụng ${job.code}.`);
    } catch (e: any) {
      const isConflict = e.status === 409;
      const message = isConflict
        ? "Không thể xóa vì tin tuyển dụng đã được thay đổi ở nơi khác. Danh sách đã được tải lại."
        : getApiErrorMessage(
            e,
            "Không thể xóa tin tuyển dụng. Vui lòng thử lại."
          );
      if (isConflict) {
        setPendingDeleteJob(null);
        await load();
      }
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  // KPI calculations
  const totalJobs = jobs.length;
  const openJobs = jobs.filter((j) => j.status === "open").length;
  const draftJobs = jobs.filter((j) => j.status === "draft").length;
  const pausedJobs = jobs.filter((j) => j.status === "paused").length;
  const totalHeadcount = useMemo(
    () => jobs.reduce((acc, j) => acc + (Number(j.headcount) || 0), 0),
    [jobs]
  );

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Đang mở tuyển
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-600">{openJobs}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Bản nháp
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-700">{draftJobs}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tạm dừng
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-amber-600">{pausedJobs}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Chỉ tiêu tuyển
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-cyan-700">{totalHeadcount}</p>
        </div>
      </div>

      {/* Action and Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72 md:w-80">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã, vị trí, phòng ban"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
            />
          </div>

          <div className="w-full sm:w-44 shrink-0">
            <select
              aria-label="Lọc trạng thái"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 outline-none transition-all focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 cursor-pointer"
            >
              <option value="">Mọi trạng thái</option>
              {Object.entries(statusLabel).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            className={`${primaryButton} h-10 shrink-0 self-start sm:self-auto`}
            onClick={() => setEditing(null)}
          >
            <Plus className="h-4 w-4" />
            Tạo tin
          </button>
        )}
      </div>

      <ViewState
        loading={loading}
        error={error}
        empty={
          !loading && !jobs.length
            ? "Chưa có tin tuyển dụng trong chi nhánh này."
            : undefined
        }
      />

      {/* Jobs Table */}
      {!loading && jobs.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                <tr>
                  <th className="px-4 py-3.5">Vị trí</th>
                  <th className="px-4 py-3.5">Phòng ban</th>
                  <th className="px-4 py-3.5">Số lượng</th>
                  <th className="px-4 py-3.5">Hạn nộp</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  {canManage && (
                    <th className="px-4 py-3.5 text-right">Thao tác</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => {
                  const badge =
                    statusBadgeStyles[job.status] || statusBadgeStyles.draft;
                  return (
                    <tr
                      key={job._id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        {canManage ? (
                          <button
                            type="button"
                            className="font-bold text-cyan-800 hover:text-cyan-900 hover:underline cursor-pointer text-left block"
                            onClick={() => setEditing(job)}
                          >
                            {job.title || "Chưa đặt tên"}
                          </button>
                        ) : (
                          <div className="font-bold text-slate-900">
                            {job.title || "Chưa đặt tên"}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 font-mono">
                            {job.code}
                          </span>
                          {job.workplaceType && (
                            <span className="text-[11px] text-slate-400 capitalize">
                              • {job.workplaceType}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {job.department ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100/70 rounded-lg px-2 py-1">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            {job.department}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 bg-cyan-50/70 border border-cyan-100 rounded-lg px-2.5 py-0.5">
                          <Users className="h-3 w-3 text-cyan-600" />
                          {job.headcount}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 font-medium">
                        {job.applicationDeadline ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {new Date(job.applicationDeadline).toLocaleDateString(
                              "vi-VN"
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {canManage ? (
                          <select
                            aria-label={`Trạng thái ${job.code}`}
                            className={`${fieldClass} min-w-32 py-1.5 text-xs font-semibold`}
                            value={job.status}
                            disabled={changingStatusJobId === job._id}
                            onChange={(event) =>
                              void changeStatus(
                                job,
                                event.target.value as RecruitmentJobStatus
                              )
                            }
                          >
                            {Object.entries(statusLabel).map(([val, label]) => (
                              <option key={val} value={val}>
                                {label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.bg} ${badge.text}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${badge.dot}`}
                            />
                            {statusLabel[job.status]}
                          </span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              title="Xóa"
                              aria-label={`Xóa tin tuyển dụng ${job.code}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                              onClick={() => setPendingDeleteJob(job)}
                            >
                              <Archive className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title={`Sửa tin tuyển dụng ${job.code}`}
                              aria-label={`Sửa tin tuyển dụng ${job.code}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-cyan-700 cursor-pointer"
                              onClick={() => setEditing(job)}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing !== undefined && (
        <JobDialog
          job={editing}
          departments={departments}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await load();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={pendingDeleteJob !== null}
        title="Xóa tin tuyển dụng?"
        description={
          pendingDeleteJob
            ? `Bạn có chắc muốn xóa tin ${pendingDeleteJob.code} - ${
                pendingDeleteJob.title || "Chưa đặt tên"
              }?`
            : ""
        }
        cancelLabel="Hủy"
        confirmLabel="Xóa tin"
        tone="danger"
        isSubmitting={deleting}
        onClose={() => {
          if (!deleting) setPendingDeleteJob(null);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function JobDialog({
  job,
  departments,
  onClose,
  onSaved,
}: {
  job: RecruitmentJob | null;
  departments: DepartmentRecord[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<any>(
    job
      ? {
          ...job,
          applicationDeadline: job.applicationDeadline?.slice(0, 10) || "",
        }
      : emptyJob
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [temporaryPublicId, setTemporaryPublicId] = useState("");
  const [saved, setSaved] = useState(false);

  const set = (key: string, value: any) =>
    setForm((old: any) => ({ ...old, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        code: form.code,
        title: form.title,
        department: form.department,
        headcount: Number(form.headcount),
        description: form.description,
        requirements: form.requirements,
        benefits: form.benefits,
        salaryMin: form.salaryMin,
        salaryMax: form.salaryMax,
        showSalary: form.showSalary,
        employmentType: form.employmentType,
        workplaceType: form.workplaceType,
        location: form.location,
        applicationDeadline: form.applicationDeadline || null,
        status: form.status,
        jdFileUrl: form.jdFileUrl,
        jdFilePublicId: form.jdFilePublicId,
      };
      job
        ? await recruitmentApi.updateJob(job._id, {
            ...payload,
            version: job.version,
          })
        : await recruitmentApi.createJob(payload);
      setSaved(true);
      await onSaved();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Không thể cập nhật vị trí tuyển dụng."));
    } finally {
      setSaving(false);
    }
  };

  const chooseFile = async (next?: File) => {
    if (!next) return;
    const message = validateRecruitmentFile(next);
    setError(message);
    if (message) return;
    setFile(next);
    setUploading(true);
    try {
      const uploaded = await recruitmentApi.uploadPublicFile(next);
      setForm((old: any) => ({
        ...old,
        jdFileUrl: uploaded.url,
        jdFilePublicId: uploaded.publicId,
      }));
      setTemporaryPublicId(uploaded.publicId);
    } catch (e: any) {
      setError(getApiErrorMessage(e, "Không thể lưu vị trí tuyển dụng."));
    } finally {
      setUploading(false);
    }
  };

  const close = () => {
    if (!saved && temporaryPublicId)
      void recruitmentApi
        .deleteTemporaryPublicFile(temporaryPublicId)
        .catch(() => undefined);
    onClose();
  };

  return (
    <RecruitmentDialog
      title={job ? "Cập nhật tin tuyển dụng" : "Tạo tin tuyển dụng"}
      onClose={close}
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error && (
          <p className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
            {error}
          </p>
        )}

        <label className={labelClass}>
          Mã tin
          <input
            required
            className={fieldClass}
            value={form.code}
            disabled={Boolean(job)}
            onChange={(e) => set("code", e.target.value)}
          />
        </label>

        <label className={labelClass}>
          Tên vị trí
          <input
            required
            className={fieldClass}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </label>

        <label className={labelClass}>
          Phòng ban
          <select
            aria-label="Phòng ban"
            className={fieldClass}
            value={form.department}
            onChange={(e) => set("department", e.target.value)}
          >
            <option value="">-- Chọn phòng ban --</option>
            {departments
              .filter((d) => d.isActive !== false)
              .map((d) => (
                <option key={d._id || d.code} value={d.name}>
                  {d.name}
                </option>
              ))}
            {form.department &&
              !departments.some((d) => d.name === form.department) && (
                <option value={form.department}>{form.department}</option>
              )}
          </select>
        </label>

        <label className={labelClass}>
          Số lượng
          <input
            required
            min="1"
            type="number"
            className={fieldClass}
            value={form.headcount}
            onChange={(e) => set("headcount", e.target.value)}
          />
        </label>

        <label className={labelClass}>
          Hình thức nơi làm việc
          <select
            className={fieldClass}
            value={form.workplaceType}
            onChange={(e) => set("workplaceType", e.target.value)}
          >
            <option value="onsite">Tại văn phòng</option>
            <option value="hybrid">Kết hợp</option>
            <option value="remote">Từ xa</option>
          </select>
        </label>

        <label className={labelClass}>
          Địa điểm
          <input
            className={fieldClass}
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
          />
        </label>

        <label className={labelClass}>
          Hạn ứng tuyển
          <input
            type="date"
            className={fieldClass}
            value={form.applicationDeadline}
            onChange={(e) => set("applicationDeadline", e.target.value)}
          />
        </label>

        <div className="hidden sm:block" />

        <label className={`${labelClass} sm:col-span-2`}>
          Mô tả
          <textarea
            rows={4}
            className={fieldClass}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          Yêu cầu
          <textarea
            rows={4}
            className={fieldClass}
            value={form.requirements}
            onChange={(e) => set("requirements", e.target.value)}
          />
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          Quyền lợi
          <textarea
            rows={3}
            className={fieldClass}
            value={form.benefits}
            onChange={(e) => set("benefits", e.target.value)}
          />
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          File JD
          <input
            aria-label="File JD"
            type="file"
            accept={RECRUITMENT_FILE_ACCEPT}
            className={fieldClass}
            onChange={(e) => chooseFile(e.target.files?.[0])}
          />
          <span className="font-normal text-slate-500 text-xs">
            {uploading ? "Đang tải lên..." : file?.name || "Chưa có tệp"}
          </span>
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          Link JD
          <input
            aria-label="Link JD"
            type="url"
            className={fieldClass}
            value={form.jdFileUrl || ""}
            onChange={(e) =>
              setForm((old: any) => ({
                ...old,
                jdFileUrl: e.target.value,
                jdFilePublicId: "",
              }))
            }
          />
        </label>

        <div className="flex justify-end gap-2 sm:col-span-2 pt-2 border-t border-slate-100">
          <button type="button" className={secondaryButton} onClick={close}>
            Hủy
          </button>
          <button className={primaryButton} disabled={saving || uploading}>
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </RecruitmentDialog>
  );
}


