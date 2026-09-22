import type { RepairStatus, RepairTicket } from "../../services/repairService";

export const columns: Array<{ status: RepairStatus; label: string; icon: string; description: string }> = [
  { status: "received", label: "Tiếp nhận", icon: "", description: "Máy mới nhận" },
  { status: "diagnosing", label: "Kiểm tra", icon: "", description: "KT đang test lỗi" },
  { status: "quoted", label: "Báo giá", icon: "", description: "Chờ khách đồng ý" },
  { status: "approved", label: "Đã duyệt", icon: "", description: "Khách đồng ý sửa" },
  { status: "repairing", label: "Đang sửa", icon: "", description: "Đang xử lý kỹ thuật" },
  { status: "waiting_parts", label: "Chờ linh kiện", icon: "", description: "Đang đặt phụ tùng" },
  { status: "waiting_supplier", label: "Chờ NCC", icon: "", description: "Gửi hãng/NCC" },
  { status: "done", label: "Hoàn tất", icon: "", description: "Chờ khách nhận & thu tiền" },
  { status: "delivered", label: "Đã giao", icon: "", description: "Đã bàn giao máy" },
];

export type PipelineStageId =
  | "stage_received"
  | "stage_diagnosing"
  | "stage_quoted"
  | "stage_repairing"
  | "stage_waiting"
  | "stage_done"
  | "stage_delivered";

export interface PipelineStageConfig {
  id: PipelineStageId;
  stepNumber: number;
  label: string;
  icon: string;
  colorScheme: {
    badge: string;
    header: string;
    border: string;
  };
  description: string;
  helperTip: string;
  statuses: RepairStatus[];
}

export const PIPELINE_STAGES: PipelineStageConfig[] = [
  {
    id: "stage_received",
    stepNumber: 1,
    label: "1. Tiếp nhận",
    icon: "",
    colorScheme: {
      badge: "bg-blue-100 text-blue-800 border-blue-200",
      header: "bg-blue-50/70 border-blue-200 text-blue-950",
      border: "border-blue-200/70",
    },
    description: "Máy mới nhận từ khách",
    helperTip: "Giao kỹ thuật viên kiểm tra lỗi",
    statuses: ["received"],
  },
  {
    id: "stage_diagnosing",
    stepNumber: 2,
    label: "2. Kiểm tra lỗi",
    icon: "",
    colorScheme: {
      badge: "bg-amber-100 text-amber-800 border-amber-200",
      header: "bg-amber-50/70 border-amber-200 text-amber-950",
      border: "border-amber-200/70",
    },
    description: "KTV đang test & chẩn đoán",
    helperTip: "Nhập giá sửa để chuyển báo khách",
    statuses: ["diagnosing"],
  },
  {
    id: "stage_quoted",
    stepNumber: 3,
    label: "3. Báo giá chờ duyệt",
    icon: "",
    colorScheme: {
      badge: "bg-purple-100 text-purple-800 border-purple-200",
      header: "bg-purple-50/70 border-purple-200 text-purple-950",
      border: "border-purple-200/70",
    },
    description: "Đã có giá, chờ khách chốt",
    helperTip: "Duyệt báo giá khi khách đồng ý",
    statuses: ["quoted"],
  },
  {
    id: "stage_repairing",
    stepNumber: 4,
    label: "4. Đang sửa chữa",
    icon: "",
    colorScheme: {
      badge: "bg-indigo-100 text-indigo-800 border-indigo-200",
      header: "bg-indigo-50/70 border-indigo-200 text-indigo-950",
      border: "border-indigo-200/70",
    },
    description: "Xử lý kỹ thuật & thay thế",
    helperTip: "Sửa xong chuyển sang chờ giao",
    statuses: ["approved", "repairing"],
  },
  {
    id: "stage_waiting",
    stepNumber: 5,
    label: "5. Chờ linh kiện / NCC",
    icon: "",
    colorScheme: {
      badge: "bg-orange-100 text-orange-800 border-orange-200",
      header: "bg-orange-50/70 border-orange-200 text-orange-950",
      border: "border-orange-200/70",
    },
    description: "Đặt phụ tùng hoặc gửi hãng",
    helperTip: "Có linh kiện chuyển tiếp tục sửa",
    statuses: ["waiting_parts", "waiting_supplier"],
  },
  {
    id: "stage_done",
    stepNumber: 6,
    label: "6. Chờ giao & Thu tiền",
    icon: "",
    colorScheme: {
      badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
      header: "bg-emerald-50/70 border-emerald-200 text-emerald-950",
      border: "border-emerald-200/70",
    },
    description: "Đã sửa xong, chờ khách lấy",
    helperTip: "Thu nợ công trước khi bàn giao",
    statuses: ["done"],
  },
  {
    id: "stage_delivered",
    stepNumber: 7,
    label: "7. Đã bàn giao",
    icon: "",
    colorScheme: {
      badge: "bg-teal-100 text-teal-800 border-teal-200",
      header: "bg-teal-50/70 border-teal-200 text-teal-950",
      border: "border-teal-200/70",
    },
    description: "Khách đã nhận & hoàn tất",
    helperTip: "Lưu trữ lịch sử, hỗ trợ hoàn tiền",
    statuses: ["delivered"],
  },
];

export const getSubStatusBadge = (status: RepairStatus) => {
  switch (status) {
    case "diagnosing":
      return { label: "Đang test lỗi", color: "bg-amber-50 text-amber-800 border-amber-200" };
    case "quoted":
      return { label: "Chờ duyệt giá", color: "bg-purple-50 text-purple-800 border-purple-200" };
    case "approved":
      return { label: "Khách đã duyệt", color: "bg-emerald-50 text-emerald-800 border-emerald-200" };
    case "repairing":
      return { label: "Đang sửa", color: "bg-indigo-50 text-indigo-800 border-indigo-200" };
    case "waiting_parts":
      return { label: "Chờ linh kiện", color: "bg-orange-50 text-orange-800 border-orange-200" };
    case "waiting_supplier":
      return { label: "Gửi hãng/NCC", color: "bg-sky-50 text-sky-800 border-sky-200" };
    case "done":
      return { label: "Sẵn sàng giao", color: "bg-teal-50 text-teal-800 border-teal-200" };
    case "delivered":
      return { label: "Đã bàn giao", color: "bg-slate-50 text-slate-700 border-slate-200" };
    default:
      return null;
  }
};

export const nextStatus: Partial<Record<RepairStatus, RepairStatus>> = {
  received: "diagnosing",
  diagnosing: "quoted",
  approved: "repairing",
  repairing: "done",
  waiting_parts: "repairing",
  waiting_supplier: "repairing",
  done: "delivered",
};

export const repairStatusLabels: Record<RepairStatus, string> = {
  received: "Tiếp nhận",
  diagnosing: "Kiểm tra",
  quoted: "Báo giá",
  approved: "Đã duyệt",
  repairing: "Đang sửa",
  waiting_parts: "Chờ linh kiện",
  waiting_supplier: "Chờ nhà cung cấp",
  done: "Hoàn tất",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
  returned: "Đã trả",
};

export const STEP_MAP: Record<RepairStatus, number> = {
  received: 1,
  diagnosing: 2,
  quoted: 2,
  approved: 3,
  repairing: 3,
  waiting_parts: 3,
  waiting_supplier: 3,
  done: 4,
  delivered: 5,
  cancelled: -1,
  returned: -1,
};

export const money = (value: number) => Number(value || 0).toLocaleString("vi-VN");
export const date = (value?: string) => (value ? new Date(value).toLocaleString("vi-VN") : "—");
export const repairStatusLabel = (status?: string) =>
  status && status in repairStatusLabels ? repairStatusLabels[status as RepairStatus] : "Chưa tiếp nhận";

export const COST_BEARER_LABEL: Record<string, string> = {
  customer: "Sửa chữa (khách trả phí)",
  shop: "Bảo hành cửa hàng",
  supplier: "Bảo hành nhà cung cấp",
};

export const COST_BEARER_BADGE_CLASS: Record<string, string> = {
  customer: "bg-amber-50 text-amber-700 border border-amber-200",
  shop: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  supplier: "bg-sky-50 text-sky-700 border border-sky-200",
};

export const costBearerLabel = (costBearer?: string) =>
  (costBearer && COST_BEARER_LABEL[costBearer]) || "Sửa chữa (khách trả phí)";
export const costBearerBadgeClass = (costBearer?: string) =>
  (costBearer && COST_BEARER_BADGE_CLASS[costBearer]) || COST_BEARER_BADGE_CLASS.customer;

export function getTicketBadge(ticket: RepairTicket) {
  if (ticket.ticketType === "service") {
    return {
      label: "Sửa dịch vụ",
      badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
    };
  }
  if (ticket.coverage?.costBearer === "supplier") {
    return {
      label: "BH Hãng (NCC)",
      badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    };
  }
  return {
    label: "BH Cửa hàng",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
  };
}

export type RepairViewMode = "pipeline6" | "detailed9" | "queue" | "delivered";

export type RepairCreatePrefill = {
  ticketType?: "warranty" | "service";
  productId?: string;
  serialNumber?: string;
  productName?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  coverage?: RepairTicket["coverage"];
};
