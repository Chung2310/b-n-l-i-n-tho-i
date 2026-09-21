import React, { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { recruitmentApi } from "../../../services/recruitmentService";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import type {
  RecruitmentApplicant,
  RecruitmentAttachment,
  RecruitmentHistory,
  RecruitmentJob,
} from "../../../types/recruitment";
import {
  primaryButton,
  RecruitmentDialog,
  secondaryButton,
  ViewState,
} from "./RecruitmentForms";
import {
  RECRUITMENT_FILE_ACCEPT,
  validateRecruitmentFile,
} from "./recruitmentFile";

export default function ApplicantDetailPanel({
  applicant,
  jobs,
  canManage,
  onClose,
}: {
  applicant: RecruitmentApplicant;
  jobs: RecruitmentJob[];
  canManage: boolean;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<RecruitmentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attachment, setAttachment] = useState<RecruitmentAttachment | null>(
    null
  );

  const load = () =>
    Promise.all([
      recruitmentApi.applicantHistory(applicant._id),
      recruitmentApi.getApplicantAttachment(applicant._id),
    ])
      .then(([nextHistory, nextAttachment]) => {
        setHistory(nextHistory);
        setAttachment(nextAttachment);
      })
      .catch((e) =>
        setError(getApiErrorMessage(e, "Không thể tải lịch sử ứng viên."))
      )
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, [applicant._id]);

  const upload = async (file?: File) => {
    if (!canManage || !file) return;
    const message = validateRecruitmentFile(file);
    if (message) {
      setError(message);
      return;
    }
    try {
      await recruitmentApi.uploadApplicantAttachment(
        applicant._id,
        file,
        attachment?.version
      );
      await load();
    } catch (e: any) {
      setError(getApiErrorMessage(e, "Không thể cập nhật ứng viên."));
    }
  };

  const download = async (file: RecruitmentAttachment) => {
    try {
      const result = await recruitmentApi.downloadAttachment(file._id);
      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setError(getApiErrorMessage(e, "Không thể thêm tệp đính kèm."));
    }
  };

  const remove = async (file: RecruitmentAttachment) => {
    if (!canManage) return;
    if (!confirm(`Xóa ${file.originalName}?`)) return;
    try {
      await recruitmentApi.deleteAttachment(file._id);
      await load();
    } catch (e: any) {
      setError(getApiErrorMessage(e, "Không thể xóa tệp đính kèm."));
    }
  };

  const job = jobs.find((j) => j._id === applicant.jobId);

  return (
    <RecruitmentDialog title={applicant.fullName} onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-6">
        {/* Candidate Header Card */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 p-5 text-white shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 text-xl font-black text-white shadow-inner">
              {applicant.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">
                {applicant.fullName}
              </h3>
              <p className="text-xs text-cyan-200 mt-0.5 font-medium">
                Ứng tuyển: <span className="text-white font-semibold">{job?.title || "Chưa gán"}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-300">
                {applicant.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3 text-slate-400" />
                    {applicant.email}
                  </span>
                )}
                {applicant.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3 text-slate-400" />
                    {applicant.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2-Column Info & History */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Candidate Profile Details */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-cyan-600" />
              Thông tin chi tiết
            </h4>
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-3 text-sm">
              <dt className="text-slate-500 font-medium text-xs">Vị trí</dt>
              <dd className="font-semibold text-slate-900 text-xs">
                {job?.title || "-"}
              </dd>

              <dt className="text-slate-500 font-medium text-xs">Email</dt>
              <dd className="text-slate-700 text-xs break-all">
                {applicant.email || "-"}
              </dd>

              <dt className="text-slate-500 font-medium text-xs">Điện thoại</dt>
              <dd className="text-slate-700 text-xs">
                {applicant.phone || "-"}
              </dd>

              <dt className="text-slate-500 font-medium text-xs">Nguồn</dt>
              <dd className="text-slate-700 text-xs">
                {applicant.source || "-"}
              </dd>

              <dt className="text-slate-500 font-medium text-xs">Kỹ năng</dt>
              <dd className="text-slate-700 text-xs">
                {applicant.skills && applicant.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {applicant.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="rounded-md bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-800 border border-cyan-100"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  applicant.skills?.join(", ") || "-"
                )}
              </dd>

              <dt className="text-slate-500 font-medium text-xs">Kinh nghiệm</dt>
              <dd className="whitespace-pre-wrap text-slate-700 text-xs leading-relaxed">
                {applicant.experience || "-"}
              </dd>
            </dl>
          </div>

          {/* Process History */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-cyan-600" />
              Lịch sử quy trình
            </h4>
            <ViewState
              loading={loading}
              error={error}
              empty={
                !loading && !history.length
                  ? "Chưa có lịch sử chuyển bước."
                  : undefined
              }
            />
            {history.length > 0 && (
              <ol className="relative border-l border-slate-200 pl-4 space-y-4">
                {history.map((item) => (
                  <li key={item._id} className="relative">
                    <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-cyan-600 shadow-xs" />
                    <div className="text-xs font-bold text-slate-800">
                      {item.fromStageName ? `${item.fromStageName} → ` : ""}
                      <span className="text-cyan-700">{item.toStageName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(item.createdAt).toLocaleString("vi-VN")}
                    </div>
                    {item.note && (
                      <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 border border-slate-100">
                        {item.note}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Attachment Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-cyan-600" />
              CV và hồ sơ
            </h4>
            {canManage && (
              <label className={`${primaryButton} cursor-pointer text-xs h-8`}>
                <Upload className="h-3.5 w-3.5" />
                Tải tệp lên
                <input
                  aria-label="CV"
                  type="file"
                  accept={RECRUITMENT_FILE_ACCEPT}
                  className="hidden"
                  onChange={(e) => upload(e.target.files?.[0])}
                />
              </label>
            )}
          </div>

          {!attachment ? (
            <p className="text-xs text-slate-400 italic py-2">
              Chưa có tệp đính kèm.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/50">
              {[attachment].map((file) => (
                <div
                  key={file._id}
                  className="flex items-center gap-3 p-3 text-sm bg-white"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-100 shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-xs text-slate-800">
                      {file.originalName}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {Math.ceil(file.size / 1024)} KB
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className={secondaryButton}
                      title="Tải xuống"
                      onClick={() => download(file)}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Tải xuống
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-red-600 hover:bg-red-50 hover:border-red-200 cursor-pointer"
                        onClick={() => remove(file)}
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </RecruitmentDialog>
  );
}

