import { Router } from "express";
import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { requireAuth, requirePermission } from "../../middleware/auth";
import { UserModel } from "../../model/user.model";
import { SupplierModel } from "../../model/supplier.model";
import { retailScopeFromRequest } from "../retail/contracts";
import { CommissionLedgerModel, CommissionPolicyModel, PartnerModel } from "./partner.models";
import { defaultPolicy, invalid, kpiBonus, monthKey, repairLines, validatePolicy } from "./commission-calculation";
import { RetailOrderModel } from "../retail/models/retail-order.model";
import { RepairTicketModel } from "../repair/repair-ticket.model";
import { closePartnerMonths, recordPartnerPayout, startCommissionRecovery } from "./commission.service";

export const partnerRouter = Router();
partnerRouter.use(requireAuth as any);
const read = requirePermission(["partner:read", "partner:manage"]) as any;
const manage = requirePermission("partner:manage") as any;
const policies = requirePermission("commission-policy:manage") as any;
const finance = requirePermission("commission-payment:manage") as any;
const own = requirePermission(["partner-self:read", "partner-self:manage"]) as any;
const picker = requirePermission(["retail:manage", "retail:read", "repair:manage", "partner:read", "partner:manage"]) as any;
export function partnerCompany(req: any) {
  const companyCode = retailScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode || req.user?.companyCode }).companyCode;
  if (!companyCode) throw invalid("Thiếu công ty."); return companyCode;
}
const id = (value: unknown) => { const result = String(value || ""); if (!Types.ObjectId.isValid(result)) throw invalid("ID không hợp lệ."); return result; };
const route = (fn: (req: any) => Promise<any>) => async (req: any, res: any, next: any) => { try { res.json({ success: true, data: await fn(req) }); } catch (error) { next(error); } };
const periodOf = (value: unknown) => { const period = String(value || monthKey(new Date())); if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw invalid("Kỳ phải có dạng YYYY-MM."); return period; };

export async function partnerStatement(companyCode: string, partnerId: string, period: string, page = 1) {
  const partner = await PartnerModel.findOne({ companyCode, _id: partnerId }).lean();
  if (!partner) throw invalid("Không tìm thấy đối tác.", 404);
  const filter = { companyCode, partnerId, period };
  const [entries, total, sums, pendingOrders, pendingRepairs] = await Promise.all([
    CommissionLedgerModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 100).limit(100).lean(),
    CommissionLedgerModel.countDocuments(filter),
    CommissionLedgerModel.aggregate([{ $match: filter }, { $group: { _id: "$kind", amount: { $sum: "$amount" }, machines: { $sum: "$machines" } } }]),
    RetailOrderModel.find({ companyCode, "commissionSnapshot.partnerId": partnerId, status: "confirmed" }).select("orderCode commissionSnapshot dueAmount").limit(100).lean(),
    RepairTicketModel.find({ companyCode, "commissionSnapshot.partnerId": partnerId, status: { $in: ["approved", "repairing", "waiting_parts", "waiting_supplier", "done"] } }).select("ticketCode commissionSnapshot laborFee partRevenue totalAmount dueAmount").limit(100).lean(),
  ]);
  const machines = Math.max(0, sums.reduce((s, r) => s + r.machines, 0));
  const pending = [...pendingOrders.map((o: any) => ({ code: o.orderCode, amount: o.commissionSnapshot.lines.reduce((s: number, l: any) => s + l.amount, 0), reason: "Chưa thu đủ tiền" })), ...pendingRepairs.map((r: any) => ({ code: r.ticketCode, amount: repairLines(r, r.commissionSnapshot.policy).reduce((s,l) => s+l.amount,0), reason: "Chưa giao máy và thu đủ tiền" }))];
  return {
    partner: {
      _id: partner._id,
      code: partner.code,
      name: partner.name,
      roles: partner.roles || [],
      status: partner.status,
      phone: partner.phone,
      email: partner.email,
      address: partner.address,
      supplierId: partner.supplierId,
      balance: partner.balance,
    },
    period,
    entries,
    total,
    page,
    sums,
    pending,
    kpi: { machines, bonus: kpiBonus(machines), provisional: period >= monthKey(new Date()), nextThreshold: machines < 10 ? 10 : machines < 20 ? 20 : null },
  };
}

partnerRouter.get("/collaborators", picker, route(async req => PartnerModel.find({ companyCode: partnerCompany(req), roles: "collaborator", status: "active" }).select("code name").sort({ name: 1 }).limit(1000).lean()));
partnerRouter.get("/me/statement", own, route(async req => {
  const companyCode = partnerCompany(req);
  const partner = await PartnerModel.findOne({ companyCode, userId: String(req.user.id), roles: "collaborator" }).select("_id").lean()
    || await PartnerModel.findOne({ companyCode, userId: String(req.user.id) }).select("_id").lean();
  if (!partner) throw invalid("Tài khoản chưa được liên kết với hồ sơ CTV.", 404);
  const statement = await partnerStatement(companyCode, String(partner._id), periodOf(req.query.period), Math.max(1, Math.floor(Number(req.query.page) || 1)));
  if (statement.partner.status === "inactive") throw invalid("Hồ sơ đối tác đã ngừng hoạt động.", 403);
  return statement;
}));
partnerRouter.get("/policies", read, route(async req => ({ defaults: defaultPolicy, items: await CommissionPolicyModel.find({ companyCode: partnerCompany(req) }).sort({ effectiveAt: -1 }).limit(100).lean() })));
partnerRouter.post("/policies", policies, route(async req => {
  const companyCode = partnerCompany(req), partnerId = req.body.partnerId ? id(req.body.partnerId) : "";
  if (partnerId && !await PartnerModel.exists({ companyCode, _id: partnerId, roles: "collaborator" })) throw invalid("CTV không tồn tại.");
  const effectiveAt = req.body.effectiveAt ? new Date(req.body.effectiveAt) : new Date();
  if (!Number.isFinite(effectiveAt.getTime()) || effectiveAt.getTime() < Date.now() - 60000) throw invalid("Ngày hiệu lực không được hồi tố.");
  return CommissionPolicyModel.create({ companyCode, partnerId, effectiveAt, config: validatePolicy(req.body.config), createdBy: req.user.id });
}));
partnerRouter.patch("/policies/:id", policies, route(async req => {
  const companyCode = partnerCompany(req), policyId = id(req.params.id);
  const existing = await CommissionPolicyModel.findOne({ companyCode, _id: policyId });
  if (!existing) throw invalid("Chính sách không tồn tại.", 404);
  const partnerId = req.body.partnerId !== undefined ? (req.body.partnerId ? id(req.body.partnerId) : "") : existing.partnerId;
  if (partnerId && !await PartnerModel.exists({ companyCode, _id: partnerId, roles: "collaborator" })) throw invalid("CTV không tồn tại.");
  const effectiveAt = req.body.effectiveAt ? new Date(req.body.effectiveAt) : existing.effectiveAt;
  if (!Number.isFinite(effectiveAt.getTime())) throw invalid("Ngày hiệu lực không hợp lệ.");
  const config = req.body.config ? validatePolicy(req.body.config) : existing.config;
  existing.partnerId = partnerId;
  existing.effectiveAt = effectiveAt;
  existing.config = config;
  await existing.save();
  return existing;
}));
partnerRouter.post("/import-suppliers", manage, route(async req => {
  const companyCode = partnerCompany(req); let count = 0;
  for await (const supplier of SupplierModel.find({ companyCode }).cursor()) {
    await PartnerModel.updateOne({ companyCode, supplierId: String(supplier._id) }, { $setOnInsert: { code: `NCC-${supplier._id}`, name: supplier.name, phone: supplier.phone, email: supplier.email, address: supplier.address, roles: ["supplier"], status: supplier.status, createdBy: req.user.id } }, { upsert: true }); count++;
  }
  return { count };
}));
partnerRouter.get("/", read, route(async req => {
  const filter: any = { companyCode: partnerCompany(req) };
  if (req.query.role) { if (!["collaborator", "dealer", "supplier"].includes(req.query.role)) throw invalid("Nhóm không hợp lệ."); filter.roles = req.query.role; }
  const items = await PartnerModel.find(filter).sort({ name: 1 }).limit(1000).lean();
  // Supplier remains the source of truth for its contact information.
  const suppliers = await SupplierModel.find({ companyCode: filter.companyCode, _id: { $in: items.filter(p => p.supplierId).map(p => p.supplierId) } }).lean();
  return items.map(p => { const s = suppliers.find(s => String(s._id) === p.supplierId); return s ? { ...p, name: s.name, phone: s.phone, email: s.email, address: s.address } : p; });
}));
async function partnerInput(req: any) {
  const companyCode = partnerCompany(req), body = req.body;
  const code = String(body.code || "").trim().toUpperCase(), name = String(body.name || "").trim();
  if (!code || code.length > 60 || !name || name.length > 200) throw invalid("Mã và tên đối tác là bắt buộc.");
  if (!Array.isArray(body.roles) || !body.roles.length || body.roles.some((r: string) => !["collaborator", "dealer", "supplier"].includes(r))) throw invalid("Chọn nhóm đối tác hợp lệ.");
  const userId = body.userId ? id(body.userId) : undefined;
  if (userId && !await UserModel.exists({ _id: userId, companyCode })) throw invalid("Tài khoản CTV không thuộc công ty.");
  const supplierId = body.supplierId ? id(body.supplierId) : undefined;
  if (supplierId && !await SupplierModel.exists({ _id: supplierId, companyCode })) throw invalid("Nhà cung cấp không thuộc công ty.");
  if (body.status && !["active", "inactive"].includes(body.status)) throw invalid("Trạng thái không hợp lệ.");
  return { companyCode, code, name, roles: [...new Set(body.roles)] as Array<"collaborator" | "dealer" | "supplier">, phone: String(body.phone || "").trim().slice(0, 30), email: String(body.email || "").trim().slice(0, 200), address: String(body.address || "").trim().slice(0, 500), userId, supplierId, status: body.status || "active", updatedBy: req.user.id };
}
async function provisionPartnerAccount(req: any, partner: any, password: string, emailOverride?: string) {
  if (partner.roles?.includes("supplier") && !partner.roles?.includes("collaborator") && !partner.roles?.includes("dealer")) {
    throw invalid("Không cấp tài khoản cho nhà cung cấp.", 400);
  }
  if (partner.status === "inactive") throw invalid("Chỉ có thể cấp tài khoản cho đối tác đang hoạt động.");
  const email = String(emailOverride || partner.email || "").trim().toLowerCase();
  const displayName = String(req.body?.displayName || partner.name || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 200) throw invalid("Email tài khoản không hợp lệ.");
  if (password.length < 6 || password.length > 128) throw invalid("Mật khẩu phải có từ 6 đến 128 ký tự.");
  if (!displayName || displayName.length > 200) throw invalid("Tên hiển thị không hợp lệ.");
  if (await UserModel.exists({ email })) throw invalid("Email này đã được sử dụng cho tài khoản khác.", 409);

  const companyCode = String(partner.companyCode);
  const partnerId = String(partner._id);
  const group = partner.roles?.[0] || "collaborator";
  const groupLabels: Record<string, string> = { collaborator: "Cộng tác viên", dealer: "Đại lý" };
  let user: any;
  try {
    user = await UserModel.create({
      email,
      password: await bcrypt.hash(password, 10),
      displayName,
      role: "user",
      companyCode,
      permissions: ["partner-self:read"],
      department: "Đối tác",
      division: groupLabels[group] || "Đối tác",
      jobTitle: groupLabels[group] || "Đối tác",
      phone: partner.phone || undefined,
      status: "offline",
      isActive: true,
    });
    const linked = await PartnerModel.findOneAndUpdate(
      { companyCode, _id: partnerId, userId: { $exists: false } },
      { $set: { userId: String(user._id), updatedBy: req.user.id } },
      { returnDocument: "after" },
    ).lean();
    if (!linked) throw invalid("Đối tác vừa được cấp tài khoản bởi người khác.", 409);
  } catch (error: any) {
    if (user?._id) await UserModel.deleteOne({ _id: user._id }).catch(() => undefined);
    if (error?.code === 11000) throw invalid("Email này đã được sử dụng cho tài khoản khác.", 409);
    throw error;
  }
  return { partnerId, userId: String(user._id), email, displayName, permissions: ["partner-self:read"] };
}

partnerRouter.post("/", manage, route(async req => {
  const input = await partnerInput(req);
  const partner = await PartnerModel.create({ ...input, createdBy: req.user.id });
  const isPureSupplier = input.roles.includes("supplier") && !input.roles.includes("collaborator") && !input.roles.includes("dealer");
  const accountPassword = Object.prototype.hasOwnProperty.call(req.body || {}, "accountPassword")
    ? String(req.body.accountPassword || "")
    : "";
  if (isPureSupplier || !Object.prototype.hasOwnProperty.call(req.body || {}, "accountPassword") || !accountPassword) return partner;
  try {
    const account = await provisionPartnerAccount(req, partner, accountPassword);
    const result = typeof partner.toObject === "function" ? partner.toObject() : partner;
    return { ...result, userId: account.userId };
  } catch (error) {
    await PartnerModel.deleteOne({ _id: partner._id, companyCode: input.companyCode }).catch(() => undefined);
    throw error;
  }
}));
partnerRouter.post("/:id/account", manage, route(async req => {
  const companyCode = partnerCompany(req);
  const partnerId = id(req.params.id);
  const partner = await PartnerModel.findOne({ companyCode, _id: partnerId }).lean();
  if (!partner) throw invalid("Không tìm thấy đối tác.", 404);
  if (partner.roles?.includes("supplier") && !partner.roles?.includes("collaborator") && !partner.roles?.includes("dealer")) {
    throw invalid("Không cấp tài khoản cho nhà cung cấp.", 400);
  }
  if (partner.status === "inactive") throw invalid("Chỉ có thể cấp tài khoản cho đối tác đang hoạt động.");
  if (partner.userId) throw invalid("Đối tác đã được cấp tài khoản.", 409);
  return provisionPartnerAccount(req, partner, String(req.body?.password || ""), String(req.body?.email || ""));
}));
partnerRouter.patch("/:id", manage, route(async req => {
  const input = await partnerInput(req), partnerId = id(req.params.id);
  const existing = await PartnerModel.findOne({ companyCode: input.companyCode, _id: partnerId }).lean();
  if (!existing) throw invalid("Không tìm thấy đối tác.", 404);
  if (existing.supplierId && existing.supplierId !== input.supplierId) throw invalid("Không được thay liên kết nhà cung cấp hiện hữu.");
  if (existing.roles.includes("collaborator") && !input.roles.includes("collaborator")) throw invalid("Giữ vai trò CTV để bảo toàn lịch sử; dùng trạng thái ngừng hoạt động.");
  const { userId, supplierId, ...fields } = input;
  return PartnerModel.findOneAndUpdate({ companyCode: input.companyCode, _id: partnerId }, { $set: { ...fields, ...(userId ? { userId } : {}), ...(supplierId ? { supplierId } : {}) }, ...(!userId ? { $unset: { userId: 1 } } : {}) }, { returnDocument: "after", runValidators: true });
}));
partnerRouter.delete("/:id", manage, route(async req => {
  const companyCode = partnerCompany(req), partnerId = id(req.params.id);
  const partner = await PartnerModel.findOne({ companyCode, _id: partnerId });
  if (!partner) throw invalid("Không tìm thấy đối tác.", 404);
  if (partner.balance && partner.balance !== 0) {
    throw invalid(`Không thể xóa đối tác vẫn còn số dư hoa hồng (${partner.balance.toLocaleString("vi-VN")} đ).`);
  }
  const hasLedger = await CommissionLedgerModel.exists({ companyCode, partnerId });
  if (hasLedger) {
    throw invalid("Không thể xóa đối tác đã phát sinh lịch sử hoa hồng. Vui lòng chuyển trạng thái sang Ngừng hoạt động.");
  }
  const [hasOrders, hasRepairs] = await Promise.all([
    RetailOrderModel.exists({ companyCode, "commissionSnapshot.partnerId": partnerId }),
    RepairTicketModel.exists({ companyCode, "commissionSnapshot.partnerId": partnerId }),
  ]);
  if (hasOrders || hasRepairs) {
    throw invalid("Không thể xóa đối tác đã gắn với đơn hàng hoặc phiếu sửa chữa. Vui lòng chuyển trạng thái sang Ngừng hoạt động.");
  }
  if (partner.userId) {
    await UserModel.deleteOne({ _id: partner.userId, companyCode }).catch(() => undefined);
  }
  await CommissionPolicyModel.deleteMany({ companyCode, partnerId });
  await PartnerModel.deleteOne({ companyCode, _id: partnerId });
  return { id: partnerId, deleted: true };
}));
partnerRouter.get("/:id/statement", read, route(async req => partnerStatement(partnerCompany(req), id(req.params.id), periodOf(req.query.period), Math.max(1, Math.floor(Number(req.query.page) || 1)))));
partnerRouter.post("/:id/close-months", finance, route(async req => { await closePartnerMonths(partnerCompany(req), id(req.params.id)); return { ok: true }; }));
partnerRouter.post("/:id/payouts", finance, route(async req => recordPartnerPayout(partnerCompany(req), id(req.params.id), req.body, req.user.id)));
startCommissionRecovery();
