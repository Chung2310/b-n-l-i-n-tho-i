import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Columns3,
  ExternalLink,
  FileText,
  GraduationCap,
  List,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Tag,
  Upload,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { recruitmentApi } from "../../../services/recruitmentService";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import type {
  RecruitmentApplicant,
  RecruitmentJob,
  RecruitmentPipeline,
} from "../../../types/recruitment";
import ApplicantDetailPanel from "./ApplicantDetailPanel";
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
import { applicantOutcomeLabels } from "./recruitmentLabels";

const outcomeBadgeStyles: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", dot: "bg-blue-500" },
  hired: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  rejected: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", dot: "bg-rose-500" },
  withdrawn: { bg: "bg-slate-100 border-slate-200", text: "text-slate-600", dot: "bg-slate-400" },
};

export default function RecruitmentApplicantsView({
  canManage,
}: {
  canManage: boolean;
}) {
  const [applicants, setApplicants] = useState<RecruitmentApplicant[]>([]);
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [pipeline, setPipeline] = useState<RecruitmentPipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"list" | "kanban">("list");
  const [adding, setAdding] = useState(false);
  const [editingApplicant, setEditingApplicant] =
    useState<RecruitmentApplicant | null>(null);
  const [selected, setSelected] = useState<RecruitmentApplicant | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [a, j, p] = await Promise.all([
        recruitmentApi.listApplicants(),
        recruitmentApi.listJobs(),
        recruitmentApi.getPipeline(),
      ]);
      setApplicants(a);
      setJobs(j);
      setPipeline(p);
    } catch (e: any) {
      setError(
        getApiErrorMessage(e, "Không thể tải danh sách ứng viên.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const move = async (applicant: RecruitmentApplicant, stageId: string) => {
    try {
      await recruitmentApi.transitionApplicant(
        applicant._id,
        applicant.version,
        stageId
      );
      await load();
    } catch (e: any) {
      setError(
        e.status === 409
          ? "Ứng viên đã được cập nhật ở nơi khác. Dữ liệu đã tải lại."
          : e.message
      );
      await load();
    }
  };

  // KPIs
  const totalApplicants = applicants.length;
  const activeApplicants = applicants.filter((a) => a.outcome === "active").length;
  const hiredApplicants = applicants.filter((a) => a.outcome === "hired").length;
  const rejectedApplicants = applicants.filter(
    (a) => a.outcome === "rejected" || a.outcome === "withdrawn"
  ).length;

  // Filtered applicants
  const filteredApplicants = useMemo(() => {
    if (!search.trim()) return applicants;
    const q = search.toLowerCase().trim();
    return applicants.filter((a) => {
      const nameMatch = a.fullName.toLowerCase().includes(q);
      const emailMatch = (a.email || "").toLowerCase().includes(q);
      const phoneMatch = (a.phone || "").toLowerCase().includes(q);
      const jobTitle = (jobs.find((j) => j._id === a.jobId)?.title || "").toLowerCase();
      return nameMatch || emailMatch || phoneMatch || jobTitle.includes(q);
    });
  }, [applicants, search, jobs]);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tổng hồ sơ
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-800">{totalApplicants}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Đang xét tuyển
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-blue-600">{activeApplicants}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Đã tuyển dụng
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-600">{hiredApplicants}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Từ chối / Rút
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-rose-600">{rejectedApplicants}</p>
        </div>
      </div>

      {/* Action and Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm ứng viên, email, số điện thoại..."
              className={`${fieldClass} pl-9`}
            />
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1">
            <button
              title="Danh sách"
              className={`flex h-7 px-3 items-center gap-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === "list"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              onClick={() => setMode("list")}
            >
              <List className="h-3.5 w-3.5" />
              <span>Danh sách</span>
            </button>
            <button
              title="Kanban"
              className={`flex h-7 px-3 items-center gap-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === "kanban"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              onClick={() => setMode("kanban")}
            >
              <Columns3 className="h-3.5 w-3.5" />
              <span>Kanban</span>
            </button>
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            className={primaryButton}
            onClick={() => setAdding(true)}
          >
            <Plus className="h-4 w-4" />
            Thêm ứng viên
          </button>
        )}
      </div>

      <ViewState
        loading={loading}
        error={error}
        empty={
          !loading && !applicants.length
            ? "Chưa có ứng viên trong chi nhánh này."
            : undefined
        }
      />

      {/* List Mode View */}
      {!loading && applicants.length > 0 && mode === "list" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                <tr>
                  <th className="px-4 py-3.5">Ứng viên</th>
                  <th className="px-4 py-3.5">Vị trí</th>
                  <th className="px-4 py-3.5">Nguồn</th>
                  <th className="px-4 py-3.5">Giai đoạn</th>
                  <th className="px-4 py-3.5">Kết quả</th>
                  {canManage && (
                    <th className="px-4 py-3.5 text-right">Thao tác</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApplicants.map((a) => {
                  const outcomeStyle =
                    outcomeBadgeStyles[a.outcome] || outcomeBadgeStyles.active;
                  return (
                    <tr
                      key={a._id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800 font-bold text-xs shrink-0">
                            {a.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <button
                              type="button"
                              className="font-bold text-cyan-800 hover:text-cyan-900 hover:underline cursor-pointer text-left block"
                              onClick={() => setSelected(a)}
                            >
                              {a.fullName}
                            </button>
                            <div className="text-xs text-slate-500">
                              {a.email || a.phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-xs text-slate-800">
                          {jobs.find((j) => j._id === a.jobId)?.title || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {a.source ? (
                          <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-medium">
                            {a.source}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {canManage ? (
                          <select
                            className={`${fieldClass} w-44 py-1.5 text-xs font-semibold`}
                            value={a.stageId}
                            onChange={(e) => move(a, e.target.value)}
                          >
                            {pipeline?.stages
                              .filter((s) => s.isActive)
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <span className="text-xs font-semibold text-slate-700">
                            {pipeline?.stages.find((stage) => stage.id === a.stageId)
                              ?.name || "-"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${outcomeStyle.bg} ${outcomeStyle.text}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${outcomeStyle.dot}`}
                          />
                          {applicantOutcomeLabels[a.outcome]}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-cyan-700 cursor-pointer"
                            title={`Sửa ứng viên ${a.fullName}`}
                            aria-label={`Sửa ứng viên ${a.fullName}`}
                            onClick={() => setEditingApplicant(a)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
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

      {/* Kanban Mode View */}
      {!loading && applicants.length > 0 && mode === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
          {pipeline?.stages
            .filter((s) => s.isActive)
            .map((stage) => {
              const stageApplicants = filteredApplicants.filter(
                (a) => a.stageId === stage.id
              );
              return (
                <section
                  key={stage.id}
                  className="flex flex-col min-w-[290px] max-w-[320px] rounded-2xl border border-slate-200/80 bg-slate-100/60 p-3 shadow-2xs shrink-0"
                  style={{ borderTop: `4px solid ${stage.color || "#06b6d4"}` }}
                >
                  <div className="flex items-center justify-between px-1 py-1 mb-2">
                    <h3 className="font-bold text-xs text-slate-800 truncate">
                      {stage.name}
                    </h3>
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-slate-600 shadow-2xs ring-1 ring-slate-200/60">
                      {stageApplicants.length}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto max-h-[68vh] pr-0.5">
                    {stageApplicants.map((a) => (
                      <button
                        key={a._id}
                        type="button"
                        onClick={() => setSelected(a)}
                        className="flex flex-col rounded-xl border border-slate-200/80 bg-white p-3.5 text-left shadow-xs transition-all hover:border-cyan-400 hover:shadow-md cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-xs text-slate-900 group-hover:text-cyan-800 transition-colors">
                            {a.fullName}
                          </div>
                          {a.source && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 font-medium">
                              {a.source}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 text-[11px] font-semibold text-cyan-800 line-clamp-1">
                          {jobs.find((j) => j._id === a.jobId)?.title || "Chưa gán"}
                        </div>

                        {(a.email || a.phone) && (
                          <div className="mt-2 flex flex-col gap-0.5 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                            {a.email && (
                              <span className="truncate flex items-center gap-1">
                                <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                                {a.email}
                              </span>
                            )}
                            {a.phone && (
                              <span className="truncate flex items-center gap-1">
                                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                {a.phone}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    ))}

                    {stageApplicants.length === 0 && (
                      <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                        Chưa có ứng viên
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
        </div>
      )}

      {/* Forms & Dialogs */}
      {canManage && (adding || editingApplicant) && (
        <ApplicantForm
          jobs={editingApplicant ? jobs : jobs.filter((j) => j.status === "open")}
          applicant={editingApplicant}
          onClose={() => {
            setAdding(false);
            setEditingApplicant(null);
          }}
          onSaved={async () => {
            setAdding(false);
            setEditingApplicant(null);
            await load();
          }}
        />
      )}

      {selected && (
        <ApplicantDetailPanel
          applicant={selected}
          jobs={jobs}
          canManage={canManage}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function ApplicantForm({
  jobs,
  applicant,
  onClose,
  onSaved,
}: {
  jobs: RecruitmentJob[];
  applicant: RecruitmentApplicant | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>(
    applicant
      ? {
          ...applicant,
          birthDate: applicant.birthDate?.slice(0, 10) || "",
          availableDate: applicant.availableDate?.slice(0, 10) || "",
          skills: applicant.skills?.join(", ") || "",
          expectedSalary: applicant.expectedSalary ?? "",
          cvUrl: applicant.cvUrl || "",
          cvPublicId: applicant.cvPublicId || "",
        }
      : {
          jobId: jobs[0]?._id || "",
          fullName: "",
          email: "",
          phone: "",
          birthDate: "",
          address: "",
          experience: "",
          education: "",
          skills: "",
          expectedSalary: "",
          availableDate: "",
          source: "",
          notes: "",
          cvUrl: "",
          cvPublicId: "",
        }
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [temporaryPublicId, setTemporaryPublicId] = useState("");
  const [saved, setSaved] = useState(false);

  const fields = useMemo(
    () =>
      [
        ["fullName", "Họ tên"],
        ["email", "Email"],
        ["phone", "Điện thoại"],
        ["birthDate", "Ngày sinh"],
        ["address", "Địa chỉ"],
        ["source", "Nguồn ứng viên"],
        ["expectedSalary", "Lương mong muốn"],
        ["availableDate", "Ngày có thể nhận việc"],
      ] as const,
    []
  );

  const submit = async (e: React.FormEvent, confirmDuplicate = false) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        jobId: form.jobId,
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        birthDate: form.birthDate || null,
        address: form.address,
        experience: form.experience,
        education: form.education,
        skills: String(form.skills || "")
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        expectedSalary: form.expectedSalary ? Number(form.expectedSalary) : null,
        availableDate: form.availableDate || null,
        source: form.source,
        notes: form.notes,
        recruiterId: form.recruiterId ?? null,
        cvUrl: form.cvUrl || "",
        cvPublicId: form.cvPublicId || "",
      };
      if (applicant)
        await recruitmentApi.updateApplicant(applicant._id, {
          ...payload,
          version: applicant.version,
        });
      else {
        const result = await recruitmentApi.createApplicant({
          ...payload,
          confirmDuplicate,
        });
        if (result.duplicateWarning) {
          if (
            confirm(
              "Đã có hồ sơ trùng email hoặc điện thoại trong chi nhánh. Vẫn tạo hồ sơ mới?"
            )
          )
            return submit(e, true);
          return;
        }
      }
      setSaved(true);
      await onSaved();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Không thể cập nhật ứng viên."));
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
        cvUrl: uploaded.url,
        cvPublicId: uploaded.publicId,
      }));
      setTemporaryPublicId(uploaded.publicId);
    } catch (e: any) {
      setError(getApiErrorMessage(e, "Không thể lưu ứng viên."));
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
      title={applicant ? "Sửa ứng viên" : "Thêm ứng viên"}
      onClose={close}
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error && (
          <p className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
            {error}
          </p>
        )}

        <label className={`${labelClass} sm:col-span-2`}>
          Tin tuyển dụng
          <select
            required
            aria-label="Tin tuyển dụng"
            className={fieldClass}
            value={form.jobId}
            onChange={(e) => setForm({ ...form, jobId: e.target.value })}
          >
            <option value="">Chọn vị trí</option>
            {jobs.map((j) => (
              <option key={j._id} value={j._id}>
                {j.code} - {j.title}
              </option>
            ))}
          </select>
        </label>

        {fields.map(([key, label]) => (
          <label key={key} className={labelClass}>
            {label}
            <input
              required={key === "fullName"}
              aria-label={label}
              type={
                key.includes("Date") || key === "birthDate"
                  ? "date"
                  : key === "expectedSalary"
                    ? "number"
                    : key === "email"
                      ? "email"
                      : "text"
              }
              className={fieldClass}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}

        <label className={`${labelClass} sm:col-span-2`}>
          Kỹ năng (phân cách bằng dấu phẩy)
          <input
            aria-label="Kỹ năng (phân cách bằng dấu phẩy)"
            className={fieldClass}
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
          />
        </label>

        {["experience", "education", "notes"].map((key) => {
          const label =
            key === "experience"
              ? "Kinh nghiệm"
              : key === "education"
                ? "Học vấn"
                : "Ghi chú";
          return (
            <label key={key} className={`${labelClass} sm:col-span-2`}>
              {label}
              <textarea
                aria-label={label}
                rows={3}
                className={fieldClass}
                value={(form as any)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          );
        })}

        <label className={`${labelClass} sm:col-span-2`}>
          CV
          <input
            aria-label="CV"
            type="file"
            accept={RECRUITMENT_FILE_ACCEPT}
            className={fieldClass}
            onChange={(e) => void chooseFile(e.target.files?.[0])}
          />
          <span className="font-normal text-slate-500 text-xs">
            {uploading ? "Đang tải lên..." : file?.name || "Chưa có tệp"}
          </span>
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          Link CV
          <input
            aria-label="Link CV"
            type="url"
            className={fieldClass}
            value={form.cvUrl || ""}
            onChange={(e) =>
              setForm((old: any) => ({
                ...old,
                cvUrl: e.target.value,
                cvPublicId: "",
              }))
            }
          />
        </label>

        <div className="flex justify-end gap-2 sm:col-span-2 pt-2 border-t border-slate-100">
          <button type="button" className={secondaryButton} onClick={close}>
            Hủy
          </button>
          <button className={primaryButton} disabled={saving || uploading}>
            {saving
              ? "Đang lưu..."
              : applicant
                ? "Lưu thay đổi"
                : "Thêm ứng viên"}
          </button>
        </div>
      </form>
    </RecruitmentDialog>
  );
}
