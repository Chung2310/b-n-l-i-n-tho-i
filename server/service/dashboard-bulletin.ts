import { UserModel } from "../model/user.model";
import { TimekeepingLogModel } from "../model/timekeeping.model";
import { InventoryBalanceModel } from "../model/inventory-balance.model";
import { RetailOrderModel } from "../modules/retail/models/retail-order.model";
import { RetailAfterSaleModel } from "../modules/retail/models/retail-after-sale.model";
import { RepairTicketModel } from "../modules/repair/repair-ticket.model";
import { resolveDashboardModuleAccess } from "./dashboard-module-access";
import type { DashboardUser } from "./dashboard.service";

export function resolveBulletinRole(role: string, jobTitle = "", department = "") {
  if (["admin", "manager", "superadmin"].includes(role)) return "manager";
  const text = `${role} ${jobTitle} ${department}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /technician|technical|ky thuat|repair/.test(text) ? "technical" : "sales";
}

export async function getDashboardBulletin(user: DashboardUser) {
  const profile = await UserModel.findById(user.id).select("jobTitle department").lean();
  const role = resolveBulletinRole(user.role, profile?.jobTitle, profile?.department);
  const access = resolveDashboardModuleAccess(user);
  const scope = { companyCode: user.companyCode, ...(user.branchId ? { branchId: user.branchId } : {}) };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const start = new Date(`${today}T00:00:00+07:00`);
  const tomorrow = new Date(start.getTime() + 86400000);
  const yesterday = new Date(start.getTime() - 86400000);
  const cards: Array<{ title: string; value: string; detail: string; href?: string }> = [];
  const money = (n: number) => `${n.toLocaleString("vi-VN")} ₫`;
  if (role !== "manager" && access.timekeeping) {
    const log = await TimekeepingLogModel.findOne({ companyCode: user.companyCode, uid: user.id, date: today }).lean();
    cards.push({ title: "Chấm công hôm nay", value: log?.checkOut ? "Đã kết thúc ca" : log?.checkIn ? "Đã vào ca" : "Chưa chấm công", detail: "Kiểm tra giờ vào / ra ca trong lịch cá nhân.", href: "/nhan-su?sub=lich" });
  }
  if (role === "sales" && access.retail) {
    const held = await RetailOrderModel.countDocuments({ ...scope, salespersonId: user.id, status: "draft", heldAt: { $ne: null } });
    cards.push({ title: "Đơn treo", value: `${held} đơn`, detail: "Tiếp tục xử lý các đơn đang giữ của bạn.", href: "/ban-le?sub=don-hang" });
    const revenue = await RetailOrderModel.aggregate([{ $match: { ...scope, salespersonId: user.id, status: "completed", completedAt: { $gte: new Date(`${today.slice(0, 7)}-01T00:00:00+07:00`), $lt: tomorrow } } }, { $group: { _id: null, total: { $sum: "$grandTotal" } } }]);
    cards.push({ title: "KPI / doanh số tháng", value: money(revenue[0]?.total || 0), detail: "Doanh số đơn hoàn tất. Chưa có chỉ tiêu doanh số để tính phần còn thiếu." });
    const arrivals = await RetailAfterSaleModel.find({ ...scope, createdAt: { $gte: new Date(start.getTime() - 6 * 86400000), $lt: tomorrow }, "items.condition": "like_new" }).select("items").lean();
    const items = arrivals.flatMap(r => r.items).filter(i => i.condition === "like_new");
    cards.push({ title: "Máy like-new về", value: `${items.reduce((n, i) => n + i.quantity, 0)} máy / 7 ngày`, detail: items.slice(0, 3).map(i => i.productName).join(", ") || "Chưa có máy like-new thu mua / trả về trong 7 ngày qua.", href: "/ban-le" });
  }
  if (role === "technical" && access.repair) {
    const query = { ...scope, technicianId: user.id, status: { $nin: ["delivered", "cancelled", "returned"] as const } };
    const [unfinished, appointments, parts] = await Promise.all([
      RepairTicketModel.countDocuments({ ...query, status: { $nin: ["done", "delivered", "cancelled", "returned"] } }),
      RepairTicketModel.find({ ...query, promisedAt: { $lt: tomorrow } }).sort({ promisedAt: 1 }).limit(5).select("ticketCode promisedAt").lean(),
      RepairTicketModel.countDocuments({ ...query, status: "waiting_parts" }),
    ]);
    cards.push(
      { title: "Phiếu sửa dở", value: `${unfinished} phiếu`, detail: "Các phiếu được phân công cho bạn chưa hoàn tất.", href: "/sua-chua-bao-hanh" },
      { title: "Lịch hẹn trả máy", value: appointments.length ? `${appointments.length}${appointments.length === 5 ? "+" : ""} phiếu cần chú ý` : "Chưa có lịch đến hạn", detail: appointments.map(t => `${t.ticketCode} · ${new Date(t.promisedAt!).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`).join("; ") || "Bao gồm lịch hôm nay và các phiếu đã quá hẹn.", href: "/sua-chua-bao-hanh" },
      { title: "Thiếu linh kiện", value: `${parts} phiếu`, detail: "Phiếu đang chờ linh kiện — kiểm tra để tiếp tục sửa.", href: "/sua-chua-bao-hanh" },
    );
  }
  if (role === "manager") {
    if (access.retail) {
      const totals = await RetailOrderModel.aggregate([{ $match: { ...scope, status: "completed", completedAt: { $gte: yesterday, $lt: tomorrow } } }, { $group: { _id: { $cond: [{ $gte: ["$completedAt", start] }, "today", "yesterday"] }, total: { $sum: "$grandTotal" } } }]);
      for (const [key, title] of [["today", "Doanh số hôm nay"], ["yesterday", "Doanh số hôm qua"]]) cards.push({ title, value: money(totals.find(t => t._id === key)?.total || 0), detail: "", href: "/ban-le" });
    }
    if (access.hr && access.timekeeping) {
      const [total, checked] = await Promise.all([UserModel.countDocuments({ ...scope, isActive: true, role: { $ne: "superadmin" } }), TimekeepingLogModel.distinct("uid", { ...scope, date: today, checkIn: { $ne: null } })]);
      cards.push({ title: "Nhân sự hôm nay", value: `${checked.length} / ${total} đã vào ca`, detail: "", href: "/nhan-su?sub=lich" });
    }
    if (access.inventory) {
      const low = await InventoryBalanceModel.find({ ...scope, $expr: { $lte: [{ $subtract: ["$quantity", "$reservedQuantity"] }, "$minStock"] } }).sort({ quantity: 1 }).limit(6).select("sku quantity reservedQuantity minStock").lean();
      cards.push({ title: "Hàng chạm đáy an toàn", value: low.length ? `${low.length}${low.length === 6 ? "+" : ""} vị trí cần nhập` : "Tồn kho trong ngưỡng", detail: low.map(p => `${p.sku}: còn ${p.quantity - p.reservedQuantity}, ngưỡng ${p.minStock}`).join("; ") || "", href: "/kho-san-pham?sub=nhap-hang" });
    }
  }
  return { role, cards, updatedAt: new Date().toISOString() };
}
