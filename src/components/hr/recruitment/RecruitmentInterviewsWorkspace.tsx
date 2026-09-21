import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  Video,
  XCircle,
} from "lucide-react";
import { recruitmentApi } from "../../../services/recruitmentService";
import { authService } from "../../../services/authService";
import { toast } from "../../../pages/Toast";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import type {
  RecruitmentApplicant,
  RecruitmentInterview,
  RecruitmentJob,
} from "../../../types/recruitment";
import type { UserProfile } from "../../../types";
import { useAuth } from "../../../context/AuthContext";
import { useBranch } from "../../../context/BranchContext";
import { ConfirmDialog } from "../../common/ConfirmDialog";
import {
  fieldClass,
  labelClass,
  primaryButton,
  RecruitmentDialog,
  secondaryButton,
  ViewState,
} from "./RecruitmentForms";

const statusLabels: Record<RecruitmentInterview["status"], string> = {
  scheduled: "Đã lên lịch",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const statusColors: Record<RecruitmentInterview["status"], { bg: string; text: string; dot: string }> = {
  scheduled: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", dot: "bg-blue-500" },
  completed: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  cancelled: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", dot: "bg-rose-500" },
};

const localDateTime = (value = "") => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

const oneHourAfter = (value: string) =>
  localDateTime(new Date(new Date(value).getTime() + 60 * 60_000).toISOString());

export default function RecruitmentInterviewsWorkspace({
  canManage,
}: {
  canManage: boolean;
}) {
  let userProfile: UserProfile | null = null;
  try {
    userProfile = useAuth()?.userProfile ?? null;
  } catch {
    userProfile = null;
  }

  let activeBranchId: string | null = null;
  try {
    activeBranchId = useBranch()?.activeBranchId ?? null;
  } catch {
    activeBranchId = null;
  }

  const [items, setItems] = useState<RecruitmentInterview[]>([]);
  const [applicants, setApplicants] = useState<RecruitmentApplicant[]>([]);
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<RecruitmentInterview | null | undefined>();
  const [pendingDelete, setPendingDelete] = useState<RecruitmentInterview | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [i, a, j, u] = await Promise.all([
        recruitmentApi.listInterviews(),
        recruitmentApi.listApplicants(),
        recruitmentApi.listJobs(),
        authService.getUsersByCompany(
          userProfile?.companyCode || "",
          activeBranchId || undefined
        ),
      ]);
      setItems(i);
      setApplicants(a);
      setJobs(j);
      setUsers(u.filter((user) => user.isActive !== false));
    } catch (e) {
      setError(getApiErrorMessage(e, "Không thể tải lịch phỏng vấn."));
    } finally {
      setLoading(false);
    }
  }, [userProfile?.companyCode, activeBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const applicantName = (item: RecruitmentInterview) =>
    applicants.find((a) => a._id === item.applicantId)?.fullName || "Ứng viên";

  const remove = async () => {
    if (!pendingDelete || deleting) return;
    const item = pendingDelete;
    const name = applicantName(item);
    setDeleting(true);
    try {
      await recruitmentApi.deleteInterview(item._id, item.version);
      setPendingDelete(null);
      await load();
      toast.success(`Đã xóa lịch phỏng vấn của ${name}.`);
    } catch (e: any) {
      const conflict = e.status === 409;
      const message = conflict
        ? "Không thể xóa vì lịch phỏng vấn đã được thay đổi ở nơi khác. Danh sách đã được tải lại."
        : getApiErrorMessage(e, "Không thể xóa lịch phỏng vấn. Vui lòng thử lại.");
      if (conflict) {
        setPendingDelete(null);
        await load();
      }
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  // KPI Stats
  const totalCount = items.length;
  const scheduledCount = items.filter((i) => i.status === "scheduled").length;
  const completedCount = items.filter((i) => i.status === "completed").length;
  const cancelledCount = items.filter((i) => i.status === "cancelled").length;

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const candidate = applicantName(item).toLowerCase();
        const jobTitle = (jobs.find((j) => j._id === item.jobId)?.title || "").toLowerCase();
        const notes = (item.notes || "").toLowerCase();
        if (!candidate.includes(q) && !jobTitle.includes(q) && !notes.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [items, statusFilter, search, applicants, jobs]);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tổng số lịch
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
              <CalendarClock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-800">{totalCount}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Sắp tới / Đã lên
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-blue-600">{scheduledCount}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Đã hoàn thành
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-600">{completedCount}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Đã hủy
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-rose-600">{cancelledCount}</p>
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
              placeholder="Tìm ứng viên, vị trí tuyển..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
            />
          </div>
          <div className="w-full sm:w-44 shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 outline-none transition-all focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="scheduled">Đã lên lịch</option>
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
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
            Lên lịch phỏng vấn
          </button>
        )}
      </div>

      <ViewState
        loading={loading}
        error={error}
        empty={
          !loading && !items.length
            ? "Chưa có lịch phỏng vấn trong chi nhánh này."
            : undefined
        }
      />

      {/* Interviews List / Card Grid */}
      {!loading && filteredItems.length > 0 && (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          {filteredItems.map((item) => {
            const name = applicantName(item);
            const jobTitle = jobs.find((j) => j._id === item.jobId)?.title;
            const startDate = new Date(item.scheduledStart);
            const endDate = new Date(item.scheduledEnd);
            const statusConfig = statusColors[item.status] || statusColors.scheduled;

            return (
              <div
                key={item._id}
                className="grid gap-3 p-4 sm:grid-cols-[160px_1fr_1fr_130px_auto] sm:items-center hover:bg-slate-50/70 transition-colors"
              >
                {/* Date & Time block */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center justify-center rounded-xl bg-cyan-50/80 border border-cyan-100/80 px-2.5 py-1.5 text-center min-w-[54px]">
                    <span className="text-[10px] font-bold uppercase text-cyan-700">
                      T{startDate.getMonth() + 1}
                    </span>
                    <span className="text-base font-black text-cyan-900 leading-tight">
                      {startDate.getDate()}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-xs sm:text-sm text-slate-900">
                      {startDate.toLocaleDateString("vi-VN")}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      {startDate.toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      -{" "}
                      {endDate.toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>

                {/* Candidate & Position */}
                <div>
                  <div className="font-bold text-sm text-slate-900">{name}</div>
                  <div className="text-xs text-cyan-800 font-medium">
                    {jobTitle || "Chưa gán vị trí"}
                  </div>
                  {item.notes && (
                    <div className="mt-1 text-[11px] text-slate-400 italic line-clamp-1">
                      {item.notes}
                    </div>
                  )}
                </div>

                {/* Interview Format & Location/Link */}
                <div className="text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 font-medium">
                    {item.format === "online" ? (
                      <>
                        <Video className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        {item.meetingLink ? (
                          <a
                            href={item.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline truncate max-w-[200px] inline-flex items-center gap-1"
                          >
                            {item.meetingLink}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          "Trực tuyến"
                        )}
                      </>
                    ) : item.format === "phone" ? (
                      <>
                        <Phone className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span>Điện thoại</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">{item.location || "Tại văn phòng"}</span>
                      </>
                    )}
                  </div>

                  {item.interviewerIds && item.interviewerIds.length > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                      <User className="h-3 w-3 text-slate-400" />
                      <span>
                        {item.interviewerIds
                          .map((id) => users.find((u) => u.uid === id)?.displayName)
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status Badge & Result */}
                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusConfig.bg} ${statusConfig.text}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
                    {statusLabels[item.status]}
                  </span>
                  {item.result && (
                    <div className="mt-1 text-[11px] font-medium text-slate-600">
                      KQ: <span className="font-bold text-slate-800">{item.result}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {canManage && (
                  <div className="flex gap-1 sm:justify-end">
                    <button
                      type="button"
                      className={secondaryButton}
                      aria-label={`Sửa lịch phỏng vấn ${name}`}
                      onClick={() => setEditing(item)}
                      title="Chỉnh sửa"
                    >
                      <Pencil className="h-4 w-4 text-slate-600" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                      aria-label={`Xóa lịch phỏng vấn ${name}`}
                      onClick={() => setPendingDelete(item)}
                      title="Xóa lịch"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing !== undefined && (
        <InterviewForm
          interview={editing}
          applicants={applicants}
          jobs={jobs}
          users={users}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await load();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Xóa lịch phỏng vấn?"
        description={
          pendingDelete
            ? `Bạn có chắc muốn xóa lịch phỏng vấn của ${applicantName(
                pendingDelete
              )} lúc ${new Date(pendingDelete.scheduledStart).toLocaleString("vi-VN")}?`
            : ""
        }
        cancelLabel="Hủy"
        confirmLabel="Xóa lịch"
        tone="danger"
        isSubmitting={deleting}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={remove}
      />
    </div>
  );
}

type FormValue = {
  applicantId: string;
  jobId: string;
  scheduledStart: string;
  scheduledEnd: string;
  format: RecruitmentInterview["format"];
  location: string;
  meetingLink: string;
  interviewerIds: string[];
  status: RecruitmentInterview["status"];
  result: string;
  notes: string;
};

function InterviewForm({
  interview,
  applicants,
  jobs,
  users,
  onClose,
  onSaved,
}: {
  interview: RecruitmentInterview | null;
  applicants: RecruitmentApplicant[];
  jobs: RecruitmentJob[];
  users: UserProfile[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<FormValue>(() => {
    const availableUserIds = new Set(users.map((user) => user.uid));
    return interview
      ? {
          applicantId: interview.applicantId,
          jobId: interview.jobId,
          scheduledStart: localDateTime(interview.scheduledStart),
          scheduledEnd: localDateTime(interview.scheduledEnd),
          format: interview.format,
          location: interview.location || "",
          meetingLink: interview.meetingLink || "",
          interviewerIds: (interview.interviewerIds || []).filter((id) =>
            availableUserIds.has(id)
          ),
          status: interview.status,
          result: interview.result || "",
          notes: interview.notes || "",
        }
      : {
          applicantId: "",
          jobId: "",
          scheduledStart: "",
          scheduledEnd: "",
          format: "onsite",
          location: "",
          meetingLink: "",
          interviewerIds: [],
          status: "scheduled",
          result: "",
          notes: "",
        };
  });
  const [saving, setSaving] = useState(false);

  const chooseApplicant = (id: string) => {
    const applicant = applicants.find((a) => a._id === id);
    setForm({ ...form, applicantId: id, jobId: applicant?.jobId || "" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.scheduledStart ||
      !form.scheduledEnd ||
      new Date(form.scheduledEnd) <= new Date(form.scheduledStart)
    ) {
      toast.error("Thời gian kết thúc phải sau thời gian bắt đầu.");
      return;
    }
    setSaving(true);
    const editable = {
      scheduledStart: form.scheduledStart,
      scheduledEnd: form.scheduledEnd,
      format: form.format,
      location: form.location,
      meetingLink: form.meetingLink,
      interviewerIds: form.interviewerIds,
      status: form.status,
      result: form.result,
      notes: form.notes,
    };
    try {
      if (interview) {
        await recruitmentApi.updateInterview(interview._id, {
          ...editable,
          version: interview.version,
        });
        toast.success(
          `Đã cập nhật lịch phỏng vấn của ${
            applicants.find((a) => a._id === interview.applicantId)?.fullName ||
            "ứng viên"
          }.`
        );
      } else {
        await recruitmentApi.createInterview({
          ...editable,
          applicantId: form.applicantId,
          jobId: form.jobId,
        });
        toast.success("Đã tạo lịch phỏng vấn.");
      }
      await onSaved();
    } catch (err) {
      toast.error(
        getApiErrorMessage(
          err,
          interview
            ? "Không thể cập nhật lịch phỏng vấn."
            : "Không thể tạo lịch phỏng vấn."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <RecruitmentDialog
      title={interview ? "Sửa lịch phỏng vấn" : "Lên lịch phỏng vấn"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Ứng viên
          <select
            aria-label="Ứng viên"
            required
            disabled={Boolean(interview)}
            className={fieldClass}
            value={form.applicantId}
            onChange={(e) => chooseApplicant(e.target.value)}
          >
            <option value="">Chọn ứng viên</option>
            {applicants.map((a) => (
              <option key={a._id} value={a._id}>
                {a.fullName}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Vị trí
          <input
            aria-label="Vị trí"
            disabled
            className={fieldClass}
            value={jobs.find((j) => j._id === form.jobId)?.title || ""}
          />
        </label>

        <label className={labelClass}>
          Bắt đầu
          <input
            aria-label="Bắt đầu"
            required
            type="datetime-local"
            className={fieldClass}
            value={form.scheduledStart}
            onChange={(e) => {
              const scheduledStart = e.target.value;
              setForm({
                ...form,
                scheduledStart,
                scheduledEnd:
                  !form.scheduledEnd || form.scheduledEnd <= scheduledStart
                    ? oneHourAfter(scheduledStart)
                    : form.scheduledEnd,
              });
            }}
          />
        </label>

        <label className={labelClass}>
          Kết thúc
          <input
            aria-label="Kết thúc"
            required
            type="datetime-local"
            min={form.scheduledStart}
            className={fieldClass}
            value={form.scheduledEnd}
            onInvalid={() => {
              if (form.scheduledEnd && form.scheduledEnd <= form.scheduledStart)
                toast.error("Thời gian kết thúc phải sau thời gian bắt đầu.");
            }}
            onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })}
          />
        </label>

        <label className={labelClass}>
          Hình thức
          <select
            aria-label="Hình thức"
            className={fieldClass}
            value={form.format}
            onChange={(e) =>
              setForm({
                ...form,
                format: e.target.value as RecruitmentInterview["format"],
              })
            }
          >
            <option value="onsite">Tại văn phòng</option>
            <option value="online">Trực tuyến</option>
            <option value="phone">Điện thoại</option>
          </select>
        </label>

        <label className={labelClass}>
          {form.format === "online" ? "Link họp" : "Địa điểm"}
          <input
            aria-label={form.format === "online" ? "Link họp" : "Địa điểm"}
            className={fieldClass}
            value={form.format === "online" ? form.meetingLink : form.location}
            onChange={(e) =>
              setForm({
                ...form,
                [form.format === "online" ? "meetingLink" : "location"]:
                  e.target.value,
              })
            }
          />
        </label>

        <label className={labelClass}>
          Trạng thái
          <select
            aria-label="Trạng thái"
            className={fieldClass}
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value as RecruitmentInterview["status"],
              })
            }
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Kết quả
          <input
            aria-label="Kết quả"
            className={fieldClass}
            value={form.result}
            onChange={(e) => setForm({ ...form, result: e.target.value })}
          />
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          Người phỏng vấn
          <select
            aria-label="Người phỏng vấn"
            multiple
            className={`${fieldClass} min-h-24`}
            value={form.interviewerIds}
            onChange={(e) =>
              setForm({
                ...form,
                interviewerIds: Array.from(
                  e.target.selectedOptions,
                  (option) => option.value
                ),
              })
            }
          >
            {users.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          Ghi chú
          <textarea
            aria-label="Ghi chú"
            className={fieldClass}
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>

        <div className="flex justify-end gap-2 sm:col-span-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            className={secondaryButton}
            onClick={onClose}
            disabled={saving}
          >
            Hủy
          </button>
          <button className={primaryButton} disabled={saving}>
            {saving ? "Đang lưu..." : interview ? "Lưu thay đổi" : "Tạo lịch"}
          </button>
        </div>
      </form>
    </RecruitmentDialog>
  );
}

