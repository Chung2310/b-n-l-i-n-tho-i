import { Schema, model } from "mongoose";
import { REPAIR_NOTIFICATION_EVENTS } from "./permissions";

const TemplateSchema = new Schema({ enabled: { type: Boolean, default: true }, subject: { type: String, default: "" }, html: { type: String, default: "" } }, { _id: false });
const RepairSettingsSchema = new Schema({
  companyCode: { type: String, required: true, unique: true, uppercase: true },
  /** Thứ tự ưu tiên kênh gửi; kênh chưa nối API tự bị bỏ qua khi gửi. */
  notifyChannels: { type: [String], default: ["email", "zalo", "sms"] },
  templates: { type: Map, of: TemplateSchema, default: {} },
  loyaltyDiscountRate: { type: Number, min: 0, max: 100, default: 10 },
  updatedBy: String,
}, { timestamps: true });
export const RepairSettingsModel = model("RepairSettings", RepairSettingsSchema);

export type RepairTemplate = { enabled: boolean; subject: string; html: string };

/** Mẫu mặc định 4 bước mang thương hiệu Anh Khoa Mobile để công ty chưa cấu hình gì vẫn gửi được tin. */
export const DEFAULT_REPAIR_TEMPLATES: Record<(typeof REPAIR_NOTIFICATION_EVENTS)[number], RepairTemplate> = {
  received: {
    enabled: true,
    subject: "[Anh Khoa Mobile] Tiếp nhận thiết bị {{deviceName}} — phiếu {{ticketCode}}",
    html: "<p>Chào {{customerName}},</p><p><b>Anh Khoa Mobile</b> ({{branchName}}) đã tiếp nhận thiết bị <b>{{deviceName}}</b> theo phiếu <b>{{ticketCode}}</b> lúc {{receivedAt}}.</p><p>Tình trạng ghi nhận: {{symptom}}</p><p>Dự kiến hẹn trả máy: {{promisedAt}}. Chúng tôi sẽ kiểm tra và thông báo tiến độ sớm nhất.</p>",
  },
  technician_assigned: {
    enabled: true,
    subject: "[Anh Khoa Mobile] Đã phân công KTV cho phiếu {{ticketCode}} — {{deviceName}}",
    html: "<p>Chào {{customerName}},</p><p>Phiếu sửa chữa <b>{{ticketCode}}</b> (máy <b>{{deviceName}}</b>) đã được phân công cho Kỹ thuật viên <b>{{technicianName}}</b> trực tiếp kiểm tra và xử lý.</p><p>Anh Khoa Mobile sẽ cập nhật kết quả xử lý ngay khi hoàn tất.</p>",
  },
  done: {
    enabled: true,
    subject: "[Anh Khoa Mobile] Thiết bị {{deviceName}} đã sửa xong — phiếu {{ticketCode}}",
    html: "<p>Chào {{customerName}},</p><p>Thiết bị <b>{{deviceName}}</b> (phiếu <b>{{ticketCode}}</b>) đã được sửa chữa và kiểm tra hoàn tất tại {{branchName}}.</p><p>Tổng chi phí: <b>{{totalAmount}}</b>.</p><p>Kính mời quý khách tới cửa hàng kiểm tra và nhận máy.</p><p>Đánh giá chất lượng phục vụ: {{feedbackUrl}}</p>",
  },
  delivered: {
    enabled: true,
    subject: "[Anh Khoa Mobile] Cảm ơn quý khách đã sử dụng dịch vụ — phiếu {{ticketCode}}",
    html: "<p>Chào {{customerName}},</p><p><b>Anh Khoa Mobile</b> xin chân thành cảm ơn quý khách đã tin tưởng và hoàn tất nhận máy <b>{{deviceName}}</b> theo phiếu <b>{{ticketCode}}</b>.</p><p>Thiết bị đã được kích hoạt chính sách bảo hành sau sửa chữa theo tiêu chuẩn cửa hàng.</p><p>Nếu cần hỗ trợ thêm, quý khách vui lòng liên hệ hotline hoặc nhắn tin cho chúng tôi. Chúc quý khách một ngày tốt lành!</p>",
  },
};
