import React, { useEffect, useMemo, useState } from "react";
import {
  FileSignature,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Upload,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  User,
  History,
  X,
  Loader2,
  Sparkles,
  ArrowRight,
  Eye,
} from "lucide-react";
import { getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { FilePreviewModal } from "../resource/FilePreviewModal";
import type { ResourceItem } from "../../types";
import { readContractSearch } from "../../utils/contractExpiryNavigation";
import { calculateContractEndDate } from "../../utils/hrContractDates";

type ContractStatus = "draft" | "active" | "expired" | "terminated";
const CONTRACT_TYPES = [
  "Hợp đồng thử việc 3 ngày",
  "Hợp đồng thử việc 7 ngày",
  "Hợp đồng thử việc 2 tháng",
  "Hợp đồng chính thức",
  "Khác",
] as const;
type ContractType = (typeof CONTRACT_TYPES)[number];
type Contract = {
  _id: string;
  contractType: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  contractFileUrl?: string;
  contractFileName?: string;
  contractFileMimeType?: string;
  contractFileSize?: number;
  contractResourceId?: string;
  signedImageUrl?: string;
  signedImageName?: string;
  signedImageMimeType?: string;
  signedImageSize?: number;
  signedImageResourceId?: string;
  note?: string;
};
type Employee = {
  _id: string;
  displayName?: string;
  email: string;
  department?: string;
};
type Extension = {
  _id: string;
  contractId: string;
  employeeName: string;
  previousEndDate: string;
  newEndDate: string;
  extensionDate: string;
  reason?: string;
  extensionFileUrl?: string;
  extensionFileName?: string;
  extensionFileMimeType?: string;
  extensionFileSize?: number;
  extensionResourceId?: string;
  signedImageUrl?: string;
  signedImageName?: string;
  signedImageMimeType?: string;
  signedImageSize?: number;
  signedImageResourceId?: string;
};
type ContractExpiryAlert = {
  id: string;
  contractType: string;
  employeeId: string;
  employeeName: string;
  endDate: string;
  daysRemaining: number;
  reminderDays: 3 | 7;
};

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getAccessToken()}`,
});
const date = (value?: string) =>
  value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "—";
const isoDate = (value?: string) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";
const fileNameFromUrl = (url: string, fallback: string) => {
  try {
    const name = decodeURIComponent(
      new URL(url).pathname.split("/").pop() || ""
    );
    return name.includes(".") ? name : fallback;
  } catch {
    return fallback;
  }
};
const mimeFromName = (name: string) => {
  const extension = name.toLowerCase().split(".").pop();
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "doc") return "application/msword";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension || ""))
    return `image/${extension === "jpg" ? "jpeg" : extension}`;
  return "";
};
const daysUntilExpiry = (value: string, now = new Date()) => {
  const expiry = new Date(value);
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryUtc = Date.UTC(
    expiry.getFullYear(),
    expiry.getMonth(),
    expiry.getDate()
  );
  return Math.ceil((expiryUtc - todayUtc) / 86_400_000);
};
const isExpiringSoon = (contract: Contract) => {
  const remaining = daysUntilExpiry(contract.endDate);
  return contract.status === "active" && remaining >= 1 && remaining <= 20;
};
const emptyContract = {
  contractType: "" as ContractType | "",
  employeeId: "",
  startDate: "",
  endDate: "",
  status: "active" as ContractStatus,
  contractFileUrl: "",
  contractFileName: "",
  contractFileMimeType: "",
  contractFileSize: 0,
  contractResourceId: "",
  contractFileUploadToken: "",
  signedImageUrl: "",
  signedImageName: "",
  signedImageMimeType: "",
  signedImageSize: 0,
  signedImageResourceId: "",
  signedImageUploadToken: "",
  note: "",
};
const emptyExtension = {
  contractId: "",
  newEndDate: "",
  extensionDate: new Date().toISOString().slice(0, 10),
  reason: "",
  extensionFileUrl: "",
  extensionFileName: "",
  extensionFileMimeType: "",
  extensionFileSize: 0,
  extensionResourceId: "",
  extensionFileUploadToken: "",
  signedImageUrl: "",
  signedImageName: "",
  signedImageMimeType: "",
  signedImageSize: 0,
  signedImageResourceId: "",
  extensionSignedImageUploadToken: "",
};

const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";

const statusLabel: Record<ContractStatus, string> = {
  draft: "Bản nháp",
  active: "Còn hiệu lực",
  expired: "Hết hạn",
  terminated: "Đã chấm dứt",
};

const statusBadgeStyle: Record<
  ContractStatus,
  { bg: string; text: string; border: string; dot: string }
> = {
  draft: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
  active: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  expired: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  terminated: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
};

export default function ContractsTab({
  canManage,
  companyCode,
  branchId,
}: {
  canManage: boolean;
  companyCode: string;
  branchId?: string;
}) {
  const [tab, setTab] = useState<"contracts" | "extensions">("contracts");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [expiryAlerts, setExpiryAlerts] = useState<ContractExpiryAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const initialSearch = readContractSearch(window.location.search);
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [editing, setEditing] = useState<Contract | "new" | null>(null);
  const [contractForm, setContractForm] = useState(emptyContract);
  const [extOpen, setExtOpen] = useState(false);
  const [extensionForm, setExtensionForm] = useState(emptyExtension);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<
    "contract" | "signed" | "extension" | "extensionSigned" | null
  >(null);
  const [previewItem, setPreviewItem] = useState<ResourceItem | null>(null);
  const suffix = `?companyCode=${encodeURIComponent(companyCode)}${
    branchId ? `&branchId=${encodeURIComponent(branchId)}` : ""
  }`;

  const load = async (
    currentPage = page,
    currentSearch = debouncedSearch
  ) => {
    setLoading(true);
    try {
      const contractSuffix = `${suffix}&page=${currentPage}&limit=${limit}${
        currentSearch ? `&search=${encodeURIComponent(currentSearch)}` : ""
      }`;
      const [a, b] = await Promise.all([
        fetch(`/api/v1/hr-contracts${contractSuffix}`, { headers: headers() }),
        fetch(`/api/v1/hr-contracts/extensions/list${suffix}`, {
          headers: headers(),
        }),
      ]);
      const ar = await a.json();
      const br = await b.json();
      if (!a.ok || !b.ok) throw new Error(ar.message || br.message);
      setContracts(ar.data?.contracts || []);
      setEmployees(ar.data?.employees || []);
      setExpiryAlerts(ar.data?.expiryAlerts || []);
      setTotal(ar.data?.total || 0);
      setExtensions(br.data || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể tải dữ liệu hợp đồng."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    load(page, debouncedSearch);
  }, [companyCode, branchId, page, debouncedSearch]);

  const expiringContracts = useMemo(
    () =>
      contracts
        .filter(isExpiringSoon)
        .sort(
          (a, b) => daysUntilExpiry(a.endDate) - daysUntilExpiry(b.endDate)
        ),
    [contracts]
  );

  const activeCount = useMemo(
    () => contracts.filter((c) => c.status === "active").length,
    [contracts]
  );

  // Client-side status filtered contracts
  const displayedContracts = useMemo(() => {
    if (statusFilter === "all") return contracts;
    if (statusFilter === "expiring") return expiringContracts;
    return contracts.filter((c) => c.status === statusFilter);
  }, [contracts, statusFilter, expiringContracts]);

  const openContract = (contract?: Contract) => {
    setEditing(contract || "new");
    setContractForm(
      contract
        ? {
            contractType: CONTRACT_TYPES.includes(contract.contractType as ContractType)
              ? (contract.contractType as ContractType)
              : "Khác",
            employeeId: contract.employeeId,
            startDate: isoDate(contract.startDate),
            endDate: isoDate(contract.endDate),
            status: contract.status,
            contractFileUrl: contract.contractFileUrl || "",
            contractFileName: contract.contractFileName || "",
            contractFileMimeType: contract.contractFileMimeType || "",
            contractFileSize: contract.contractFileSize || 0,
            contractResourceId: contract.contractResourceId || "",
            contractFileUploadToken: "",
            signedImageUrl: contract.signedImageUrl || "",
            signedImageName: contract.signedImageName || "",
            signedImageMimeType: contract.signedImageMimeType || "",
            signedImageSize: contract.signedImageSize || 0,
            signedImageResourceId: contract.signedImageResourceId || "",
            signedImageUploadToken: "",
            note: contract.note || "",
          }
        : emptyContract
    );
  };

  const saveContract = async () => {
    setSaving(true);
    try {
      const url =
        editing === "new"
          ? `/api/v1/hr-contracts${suffix}`
          : `/api/v1/hr-contracts/${(editing as Contract)._id}${suffix}`;
      const res = await fetch(url, {
        method: editing === "new" ? "POST" : "PATCH",
        headers: headers(),
        body: JSON.stringify(contractForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Đã lưu hợp đồng.");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể lưu hợp đồng."));
    } finally {
      setSaving(false);
    }
  };

  const openExtension = (contract?: Contract) => {
    setExtensionForm({
      ...emptyExtension,
      contractId: contract?._id || "",
      newEndDate: contract ? isoDate(contract.endDate) : "",
    });
    setExtOpen(true);
    setTab("extensions");
  };

  const saveExtension = async () => {
    setSaving(true);
    try {
      const { contractId, ...body } = extensionForm;
      const res = await fetch(
        `/api/v1/hr-contracts/${contractId}/extensions${suffix}`,
        { method: "POST", headers: headers(), body: JSON.stringify(body) }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Đã gia hạn hợp đồng.");
      setExtOpen(false);
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể gia hạn hợp đồng."));
    } finally {
      setSaving(false);
    }
  };

  const uploadContractFile = async (
    file: File,
    target: "contract" | "signed"
  ) => {
    const allowed =
      target === "signed"
        ? file.type.startsWith("image/")
        : [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ].includes(file.type);
    if (!allowed)
      return toast.error(
        target === "signed"
          ? "Ảnh đã ký phải là tệp hình ảnh."
          : "Hợp đồng chỉ hỗ trợ PDF, DOC hoặc DOCX."
      );
    if (file.size > 10 * 1024 * 1024)
      return toast.error("Tệp tải lên không được vượt quá 10 MB.");
    setUploading(target);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/v1/hr-contracts/upload${suffix}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          file: base64,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          kind: target,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Tải tệp thất bại.");
      setContractForm((current) =>
        target === "signed"
          ? {
              ...current,
              signedImageUrl: data.data.url,
              signedImageName: file.name,
              signedImageMimeType: file.type,
              signedImageSize: file.size,
              signedImageResourceId: "",
              signedImageUploadToken: data.data.uploadToken,
            }
          : {
              ...current,
              contractFileUrl: data.data.url,
              contractFileName: file.name,
              contractFileMimeType: file.type,
              contractFileSize: file.size,
              contractResourceId: "",
              contractFileUploadToken: data.data.uploadToken,
            }
      );
      toast.success(`Đã tải lên ${file.name}.`);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể tải tệp hợp đồng."));
    } finally {
      setUploading(null);
    }
  };

  const uploadExtensionFile = async (
    file: File,
    target: "extension" | "extensionSigned"
  ) => {
    const isSigned = target === "extensionSigned";
    const allowed = isSigned
      ? file.type.startsWith("image/")
      : [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ].includes(file.type);
    if (!allowed)
      return toast.error(
        isSigned
          ? "Ảnh đã ký phải là tệp hình ảnh."
          : "Phụ lục gia hạn chỉ hỗ trợ PDF, DOC hoặc DOCX."
      );
    if (file.size > 10 * 1024 * 1024)
      return toast.error("Tệp tải lên không được vượt quá 10 MB.");
    setUploading(target);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await fetch(`/api/v1/hr-contracts/upload${suffix}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          file: base64,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          kind: target,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Tải tệp thất bại.");
      setExtensionForm((current) =>
        isSigned
          ? {
              ...current,
              signedImageUrl: result.data.url,
              signedImageName: file.name,
              signedImageMimeType: file.type,
              signedImageSize: file.size,
              signedImageResourceId: "",
              extensionSignedImageUploadToken: result.data.uploadToken,
            }
          : {
              ...current,
              extensionFileUrl: result.data.url,
              extensionFileName: file.name,
              extensionFileMimeType: file.type,
              extensionFileSize: file.size,
              extensionResourceId: "",
              extensionFileUploadToken: result.data.uploadToken,
            }
      );
      toast.success(`Đã tải lên ${file.name}.`);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Không thể tải tệp gia hạn hợp đồng.")
      );
    } finally {
      setUploading(null);
    }
  };

  const preview = async (contract: Contract, kind: "contract" | "signed") => {
    const signed = kind === "signed";
    const fileUrl = signed ? contract.signedImageUrl : contract.contractFileUrl;
    if (!fileUrl) return;
    const resourceId = signed
      ? contract.signedImageResourceId
      : contract.contractResourceId;
    if (resourceId) {
      try {
        const response = await fetch(`/api/v1/resources/${resourceId}`, {
          headers: headers(),
        });
        const result = await response.json();
        if (response.ok && result.item?.fileUrl) {
          setPreviewItem(result.item);
          return;
        }
      } catch (error) {
        console.warn(
          "Không tải được ResourceItem của hợp đồng, dùng metadata dự phòng:",
          error
        );
      }
    }
    const storedName = signed
      ? contract.signedImageName
      : contract.contractFileName;
    const name =
      storedName ||
      fileNameFromUrl(
        fileUrl,
        signed ? "anh-hop-dong-da-ky.jpg" : "hop-dong.pdf"
      );
    setPreviewItem({
      _id: resourceId || `${contract._id}-${kind}`,
      companyCode,
      section: "local",
      type: "file",
      name,
      parentId: null,
      fileUrl,
      mimeType:
        (signed
          ? contract.signedImageMimeType
          : contract.contractFileMimeType) || mimeFromName(name),
      size: signed ? contract.signedImageSize : contract.contractFileSize,
      createdAt: "",
      updatedAt: "",
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6 text-left space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-md shadow-cyan-600/20">
            <FileSignature className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Quản lý hợp đồng lao động
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 border border-cyan-200/80 px-2.5 py-0.5 text-[10px] font-bold text-cyan-700">
                <Sparkles className="h-3 w-3" />
                Hồ sơ pháp lý
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi tình trạng hợp đồng lao động, thời hạn và lịch sử gia hạn của nhân viên.
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            {tab === "contracts" ? (
              <button
                onClick={() => openContract()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white px-4 py-2.5 text-xs font-bold transition-all cursor-pointer shadow-sm shadow-cyan-600/20 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Tạo hợp đồng</span>
              </button>
            ) : (
              <button
                onClick={() => openExtension()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white px-4 py-2.5 text-xs font-bold transition-all cursor-pointer shadow-sm shadow-cyan-600/20 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Tạo gia hạn</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tổng hợp đồng
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-cyan-800">{total}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Đã tạo trên hệ thống</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Còn hiệu lực
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-600">{activeCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Hợp đồng đang áp dụng</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Sắp hết hạn
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-amber-600">
            {expiringContracts.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Trong 20 ngày tới</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Lượt gia hạn
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <RefreshCw className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-indigo-700">
            {extensions.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Phụ lục đã ký</p>
        </div>
      </div>

      {/* Subtabs Switcher */}
      <div className="flex gap-1.5 rounded-xl border border-slate-200/80 bg-white p-1.5 w-fit shadow-2xs">
        <button
          type="button"
          onClick={() => setTab("contracts")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            tab === "contracts"
              ? "bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <FileSignature className="h-4 w-4" />
          <span>Danh sách hợp đồng</span>
          <span
            className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              tab === "contracts"
                ? "bg-white/20 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("extensions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            tab === "extensions"
              ? "bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <RefreshCw className="h-4 w-4" />
          <span>Lịch sử gia hạn</span>
          <span
            className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              tab === "extensions"
                ? "bg-white/20 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {extensions.length}
          </span>
        </button>
      </div>

      {/* Main Tab Content */}
      {tab === "contracts" && expiryAlerts.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-xs">
          <div className="mb-3 flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-amber-700" />
            <div>
              <h3 className="text-sm font-bold text-amber-900">Nhắc hạn hợp đồng</h3>
              <p className="text-[11px] text-amber-700">Các hợp đồng còn tối đa 7 ngày trước khi hết hạn.</p>
            </div>
          </div>
          <div className="space-y-2">
            {expiryAlerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => {
                  setSearch(alert.employeeName);
                  setDebouncedSearch(alert.employeeName);
                  setPage(1);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition hover:shadow-sm ${
                  alert.reminderDays === 3 ? "border-rose-200" : "border-amber-200"
                }`}
              >
                <span className="min-w-0 text-xs font-semibold text-slate-700">
                  {alert.contractType} của <strong>{alert.employeeName}</strong>{" "}
                  {alert.daysRemaining === 0
                    ? "hết hạn hôm nay"
                    : `${alert.daysRemaining} ngày nữa hết hạn`}
                  .
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  alert.reminderDays === 3
                    ? "bg-rose-100 text-rose-700"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  Mốc {alert.reminderDays} ngày
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-14 rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-600 mb-2" />
          <p className="text-xs font-bold text-slate-600">Đang tải dữ liệu hợp đồng...</p>
        </div>
      ) : tab === "contracts" ? (
        <div className="space-y-4">
          {/* Expiring Warning Alert */}
          {expiringContracts.length > 0 && (
            <div className="flex items-start gap-3.5 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-amber-900 shadow-2xs">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold">
                  Có {expiringContracts.length} hợp đồng sắp hết hạn trong 20 ngày tới
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {expiringContracts.slice(0, 5).map((c) => (
                    <span
                      key={c._id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/80 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                    >
                      <span>{c.employeeName}</span>
                      <span className="text-rose-600 font-bold">
                        (còn {daysUntilExpiry(c.endDate)} ngày)
                      </span>
                    </span>
                  ))}
                  {expiringContracts.length > 5 && (
                    <span className="text-[11px] font-semibold text-amber-700 self-center">
                      và {expiringContracts.length - 5} hợp đồng khác...
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action and Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Box */}
              <div className="relative w-full sm:w-72 md:w-80">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  className={inputClass + " pl-9"}
                  placeholder="Tìm nhân viên, email, phòng ban..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <div className="w-full sm:w-44 shrink-0">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 outline-none transition-all focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 cursor-pointer"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="active">Còn hiệu lực</option>
                  <option value="expiring">Sắp hết hạn (≤ 20 ngày)</option>
                  <option value="draft">Bản nháp</option>
                  <option value="expired">Hết hạn</option>
                  <option value="terminated">Đã chấm dứt</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contracts Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-3.5 text-left">Nhân viên</th>
                  <th className="p-3.5 text-left">Loại hợp đồng</th>
                  <th className="p-3.5 text-center">Bắt đầu</th>
                  <th className="p-3.5 text-center">Hết hạn</th>
                  <th className="p-3.5 text-center">Trạng thái</th>
                  <th className="p-3.5 text-center">Tài liệu</th>
                  <th className="p-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedContracts.map((c) => {
                  const remainingDays = daysUntilExpiry(c.endDate);
                  const expiringSoon = isExpiringSoon(c);
                  const emp = employees.find((e) => e._id === c.employeeId);
                  const badge = statusBadgeStyle[c.status] || statusBadgeStyle.draft;

                  return (
                    <tr
                      key={c._id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        expiringSoon ? "bg-amber-50/40" : ""
                      }`}
                    >
                      {/* Employee */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 text-cyan-800 font-bold text-xs shrink-0">
                            {c.employeeName?.charAt(0)?.toUpperCase() || "NV"}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-xs sm:text-sm">
                              {c.employeeName}
                            </p>
                            {emp && (
                              <p className="text-[11px] text-slate-400">
                                {emp.department ? `${emp.department} · ` : ""}
                                {emp.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contract Type */}
                      <td className="p-3.5">
                        <span className="font-medium text-slate-700">
                          {c.contractType}
                        </span>
                      </td>

                      {/* Start Date */}
                      <td className="p-3.5 text-center text-slate-600 font-medium">
                        {date(c.startDate)}
                      </td>

                      {/* End Date */}
                      <td className="p-3.5 text-center">
                        <span className="font-medium text-slate-700">
                          {date(c.endDate)}
                        </span>
                        {expiringSoon && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              <AlertTriangle className="h-3 w-3 text-amber-600" />
                              Còn {remainingDays} ngày
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                          {statusLabel[c.status]}
                        </span>
                      </td>

                      {/* Document Chips */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {c.contractFileUrl && (
                            <button
                              type="button"
                              onClick={() => preview(c, "contract")}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-cyan-700 hover:bg-cyan-50 hover:border-cyan-200 transition-colors cursor-pointer shadow-2xs"
                              title="Xem tệp hợp đồng PDF/DOCX"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>Hợp đồng</span>
                            </button>
                          )}
                          {c.signedImageUrl && (
                            <button
                              type="button"
                              onClick={() => preview(c, "signed")}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-cyan-700 hover:bg-cyan-50 hover:border-cyan-200 transition-colors cursor-pointer shadow-2xs"
                              title="Xem ảnh bản ký"
                            >
                              <ImageIcon className="h-3.5 w-3.5" />
                              <span>Ảnh ký</span>
                            </button>
                          )}
                          {!c.contractFileUrl && !c.signedImageUrl && (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        {canManage && (
                          <div className="inline-flex items-center gap-1 justify-end">
                            <button
                              title="Sửa thông tin hợp đồng"
                              onClick={() => openContract(c)}
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-cyan-700 transition-colors cursor-pointer"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              title="Gia hạn hợp đồng này"
                              onClick={() => openExtension(c)}
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {displayedContracts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center">
                        <FileSignature className="h-9 w-9 text-slate-300 mb-2" />
                        <p className="font-bold text-slate-600 text-xs">
                          Không tìm thấy hợp đồng nào
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {total > limit && (
              <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-3 sm:px-6">
                <div className="text-xs text-slate-500 font-medium">
                  Hiển thị từ{" "}
                  <span className="font-bold text-slate-800">
                    {(page - 1) * limit + 1}
                  </span>{" "}
                  đến{" "}
                  <span className="font-bold text-slate-800">
                    {Math.min(page * limit, total)}
                  </span>{" "}
                  trong tổng số{" "}
                  <span className="font-bold text-slate-800">{total}</span> hợp đồng
                </div>

                <div className="flex items-center gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    title="Trang đầu"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </button>
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    title="Trang trước"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const p = idx + 1;
                      if (Math.abs(page - p) > 2 && p !== 1 && p !== totalPages)
                        return null;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            page === p
                              ? "bg-cyan-600 text-white shadow-xs"
                              : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    title="Trang sau"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(totalPages)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    title="Trang cuối"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Extensions History Tab */
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-3.5 text-left">Nhân viên</th>
                  <th className="p-3.5 text-center">Ngày gia hạn</th>
                  <th className="p-3.5 text-center">Hạn cũ</th>
                  <th className="p-3.5 text-center">Hạn mới</th>
                  <th className="p-3.5 text-left">Lý do gia hạn</th>
                  <th className="p-3.5 text-center">Tài liệu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {extensions.map((x) => (
                  <tr key={x._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-800 text-xs sm:text-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-800 font-bold text-[11px]">
                          {x.employeeName?.charAt(0)?.toUpperCase() || "NV"}
                        </div>
                        <span>{x.employeeName}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-center text-slate-600 font-medium">
                      {date(x.extensionDate)}
                    </td>
                    <td className="p-3.5 text-center text-slate-500 font-medium">
                      {date(x.previousEndDate)}
                    </td>
                    <td className="p-3.5 text-center font-bold text-emerald-700">
                      <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5">
                        <ArrowRight className="h-3 w-3 text-emerald-600" />
                        <span>{date(x.newEndDate)}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-700 max-w-xs truncate">
                      {x.reason || "—"}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {x.extensionFileUrl && (
                          <a
                            href={x.extensionFileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-cyan-700 hover:bg-cyan-50 hover:border-cyan-200 transition-colors shadow-2xs"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>File</span>
                          </a>
                        )}
                        {x.signedImageUrl && (
                          <a
                            href={x.signedImageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-cyan-700 hover:bg-cyan-50 hover:border-cyan-200 transition-colors shadow-2xs"
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                            <span>Ảnh ký</span>
                          </a>
                        )}
                        {!x.extensionFileUrl && !x.signedImageUrl && (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {!extensions.length && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center">
                        <RefreshCw className="h-9 w-9 text-slate-300 mb-2" />
                        <p className="font-bold text-slate-600 text-xs">
                          Chưa có lịch sử gia hạn hợp đồng
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Các phụ lục gia hạn hợp đồng sẽ được lưu vết và thống kê tại đây.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contract Create / Edit Modal */}
      {editing && (
        <Modal
          title={editing === "new" ? "Tạo hợp đồng lao động mới" : "Cập nhật hợp đồng lao động"}
          subtitle="Điền thông tin hợp đồng và tải lên tệp tài liệu đính kèm"
          close={() => setEditing(null)}
          save={saveContract}
          saving={saving || uploading !== null}
          valid={Boolean(
            contractForm.employeeId &&
              contractForm.contractType &&
              contractForm.startDate &&
              contractForm.endDate
          )}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="sm:col-span-2 text-xs font-semibold text-slate-700">
              Nhân viên áp dụng <span className="text-rose-500">*</span>
              <select
                className={inputClass + " mt-1.5"}
                value={contractForm.employeeId}
                onChange={(e) =>
                  setContractForm({
                    ...contractForm,
                    employeeId: e.target.value,
                  })
                }
              >
                <option value="">-- Chọn nhân viên --</option>
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.displayName || e.email} {e.department ? `(${e.department})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="sm:col-span-2 text-xs font-semibold text-slate-700">
              Loại hợp đồng <span className="text-rose-500">*</span>
              <select
                className={inputClass + " mt-1.5"}
                value={contractForm.contractType}
                onChange={(e) => {
                  const contractType = e.target.value as ContractType;
                  const automaticEndDate = calculateContractEndDate(
                    contractType,
                    contractForm.startDate,
                  );
                  setContractForm({
                    ...contractForm,
                    contractType,
                    endDate: automaticEndDate || contractForm.endDate,
                  });
                }}
              >
                <option value="">-- Chọn loại hợp đồng --</option>
                {CONTRACT_TYPES.map((contractType) => (
                  <option key={contractType} value={contractType}>
                    {contractType}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Ngày bắt đầu hiệu lực <span className="text-rose-500">*</span>
              <input
                type="date"
                className={inputClass + " mt-1.5"}
                value={contractForm.startDate}
                onChange={(e) => {
                  const startDate = e.target.value;
                  const automaticEndDate = calculateContractEndDate(
                    contractForm.contractType,
                    startDate,
                  );
                  setContractForm({
                    ...contractForm,
                    startDate,
                    endDate: automaticEndDate || contractForm.endDate,
                  });
                }}
              />
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Ngày hết hạn <span className="text-rose-500">*</span>
              <input
                type="date"
                className={inputClass + " mt-1.5"}
                value={contractForm.endDate}
                onChange={(e) =>
                  setContractForm({ ...contractForm, endDate: e.target.value })
                }
              />
            </label>

            <label className="sm:col-span-2 text-xs font-semibold text-slate-700">
              Trạng thái hợp đồng
              <select
                className={inputClass + " mt-1.5"}
                value={contractForm.status}
                onChange={(e) =>
                  setContractForm({
                    ...contractForm,
                    status: e.target.value as ContractStatus,
                  })
                }
              >
                {Object.entries(statusLabel).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>

            {/* Contract File Upload */}
            <div className="rounded-xl border border-dashed border-slate-300 p-3 bg-slate-50/50">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Tệp hợp đồng (PDF, DOC, DOCX)
              </span>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50/60 px-3 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100 transition-colors">
                <Upload className="h-4 w-4" />
                <span>
                  {uploading === "contract" ? "Đang tải lên..." : "Chọn file hợp đồng"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={uploading !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadContractFile(file, "contract");
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {contractForm.contractFileUrl && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {contractForm.contractFileName || "Đã tải file hợp đồng"}
                  </span>
                </div>
              )}
            </div>

            {/* Signed Image Upload */}
            <div className="rounded-xl border border-dashed border-slate-300 p-3 bg-slate-50/50">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Ảnh hợp đồng đã ký
              </span>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50/60 px-3 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100 transition-colors">
                <Upload className="h-4 w-4" />
                <span>
                  {uploading === "signed" ? "Đang tải lên..." : "Chọn ảnh đã ký"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  disabled={uploading !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadContractFile(file, "signed");
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {contractForm.signedImageUrl && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {contractForm.signedImageName || "Đã tải ảnh hợp đồng"}
                  </span>
                </div>
              )}
            </div>

            <label className="sm:col-span-2 text-xs font-semibold text-slate-700">
              Ghi chú thêm
              <textarea
                rows={2}
                className="w-full mt-1.5 rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                placeholder="Ghi chú về phụ cấp, điều khoản đặc biệt..."
                value={contractForm.note}
                onChange={(e) =>
                  setContractForm({ ...contractForm, note: e.target.value })
                }
              />
            </label>
          </div>
        </Modal>
      )}

      {/* Extension Create Modal */}
      {extOpen && (
        <Modal
          title="Gia hạn hợp đồng lao động"
          subtitle="Tạo phụ lục gia hạn hợp đồng cho nhân viên"
          close={() => setExtOpen(false)}
          save={saveExtension}
          saving={saving || uploading !== null}
          valid={Boolean(
            extensionForm.contractId &&
              extensionForm.newEndDate &&
              extensionForm.extensionDate
          )}
        >
          <div className="space-y-4">
            <label className="block text-xs font-semibold text-slate-700">
              Hợp đồng cần gia hạn <span className="text-rose-500">*</span>
              <select
                className={inputClass + " mt-1.5"}
                value={extensionForm.contractId}
                onChange={(e) =>
                  setExtensionForm({
                    ...extensionForm,
                    contractId: e.target.value,
                  })
                }
              >
                <option value="">-- Chọn hợp đồng --</option>
                {contracts
                  .filter((c) => c.status !== "terminated")
                  .map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.employeeName} — {c.contractType} (hạn: {date(c.endDate)})
                    </option>
                  ))}
              </select>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Ngày thực hiện gia hạn <span className="text-rose-500">*</span>
                <input
                  type="date"
                  className={inputClass + " mt-1.5"}
                  value={extensionForm.extensionDate}
                  onChange={(e) =>
                    setExtensionForm({
                      ...extensionForm,
                      extensionDate: e.target.value,
                    })
                  }
                />
              </label>

              <label className="text-xs font-semibold text-slate-700">
                Ngày hết hạn mới <span className="text-rose-500">*</span>
                <input
                  type="date"
                  className={inputClass + " mt-1.5"}
                  value={extensionForm.newEndDate}
                  onChange={(e) =>
                    setExtensionForm({
                      ...extensionForm,
                      newEndDate: e.target.value,
                    })
                  }
                />
              </label>
            </div>

            <label className="block text-xs font-semibold text-slate-700">
              Lý do gia hạn
              <textarea
                rows={2}
                className="w-full mt-1.5 rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                placeholder="VD: Gia hạn thời gian công tác theo thỏa thuận..."
                value={extensionForm.reason}
                onChange={(e) =>
                  setExtensionForm({ ...extensionForm, reason: e.target.value })
                }
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Extension File */}
              <div className="rounded-xl border border-dashed border-slate-300 p-3 bg-slate-50/50">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  File phụ lục (PDF, DOC, DOCX)
                </span>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50/60 px-3 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100 transition-colors">
                  <Upload className="h-4 w-4" />
                  <span>
                    {uploading === "extension"
                      ? "Đang tải lên..."
                      : "Chọn file gia hạn"}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    disabled={uploading !== null}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadExtensionFile(file, "extension");
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {extensionForm.extensionFileUrl && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {extensionForm.extensionFileName || "Đã tải file phụ lục"}
                    </span>
                  </div>
                )}
              </div>

              {/* Signed Extension Image */}
              <div className="rounded-xl border border-dashed border-slate-300 p-3 bg-slate-50/50">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Ảnh phụ lục đã ký
                </span>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50/60 px-3 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100 transition-colors">
                  <Upload className="h-4 w-4" />
                  <span>
                    {uploading === "extensionSigned"
                      ? "Đang tải lên..."
                      : "Chọn ảnh đã ký"}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    disabled={uploading !== null}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadExtensionFile(file, "extensionSigned");
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {extensionForm.signedImageUrl && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {extensionForm.signedImageName || "Đã tải ảnh phụ lục"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* File Preview Modal */}
      <FilePreviewModal
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        hideShare
      />
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  close,
  save,
  saving,
  valid,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  close: () => void;
  save: () => void;
  saving: boolean;
  valid: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/80 px-5 py-3.5">
          <div>
            <h3 className="font-bold text-sm text-slate-900">{title}</h3>
            {subtitle && (
              <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/80 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200/80 bg-slate-50/50 px-5 py-3.5">
          <button
            type="button"
            onClick={close}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer shadow-2xs"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={!valid || saving}
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 px-5 py-2 text-xs font-bold text-white shadow-sm shadow-cyan-600/20 active:scale-95 disabled:opacity-50 cursor-pointer transition-all"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <span>Lưu thông tin</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
