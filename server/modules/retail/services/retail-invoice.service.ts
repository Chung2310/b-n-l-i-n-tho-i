import type { ClientSession } from "mongoose";
import { RetailInvoiceCounterModel } from "../models/retail-invoice-counter.model";
import { RetailInvoiceModel } from "../models/retail-invoice.model";
import { RetailOrderModel } from "../models/retail-order.model";
import type { IRetailOrder } from "../interfaces/retail-order.interface";
import type { RetailBranchScope } from "../contracts";
import { buildInvoiceListQuery } from "./retail-query.service";
import type { RetailStoreSnapshot } from "../interfaces/retail-invoice.interface";
import { BranchModel } from "../../../model/branch.model";
import { CompanyModel } from "../../../model/company.model";
import { UserModel } from "../../../model/user.model";
export { invoicePdfFilename, invoicePdfPageSize, invoicePdfPaymentRows, renderRetailInvoicePdf } from "./retail-invoice-pdf.service";

export function buildRetailInvoiceSnapshot(order: any, actor: any, store: RetailStoreSnapshot) {
  const vndValues = [order.grandTotal, order.paidAmount, order.dueAmount, ...(order.payments || []).map((payment: any) => payment.amount)];
  if (vndValues.some((value) => !Number.isSafeInteger(Number(value)) || Number(value) < 0)) throw new Error("INVALID_INVOICE_VND");
  if (order.paymentStatus !== "refunded" && Number(order.paidAmount) + Number(order.dueAmount) !== Number(order.grandTotal)) throw new Error("INVALID_INVOICE_PAYMENT_TOTAL");
  return {
    store,
    customerName: order.customerName || "Khách lẻ",
    customerPhone: order.customerPhone,
    customerSnapshot: order.customerSnapshot,
    billingSnapshot: order.billingSnapshot,
    cashierName: String(actor.displayName || actor.email || ""),
    salespersonName: String(order.salespersonName || actor.displayName || actor.email || ""),
    businessDate: order.businessDate,
    items: order.items.map(({ unitCost: _unitCost, category: _category, note: _note, ...item }: any) => item),
    subtotal: order.subtotal,
    orderDiscount: order.orderDiscount,
    taxRate: order.taxRate,
    taxAmount: order.taxAmount,
    shippingFee: order.shippingFee,
    grandTotal: order.grandTotal,
    paidAmount: order.paidAmount,
    dueAmount: order.dueAmount,
    paymentStatus: order.paymentStatus,
    payments: (order.payments || []).map(({ method, amount, tenderedAmount, changeAmount, reference }: any) => ({ method, amount, tenderedAmount, changeAmount, reference })),
    amountInWords: `${order.grandTotal.toLocaleString("vi-VN")} đồng`,
  };
}

const emailLike = (value: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
const invoiceActorId = (actor: any) => String(actor?.id || actor?.uid || "");
const invoiceActorName = (actor: any) => String(actor?.displayName || actor?.email || "");
const invoiceFlowError = (message: string, status: number, code: string) => Object.assign(new Error(message), { status, code });
export function projectLegacyInvoiceCashier(invoice: any, displayName?: string) {
  if (!displayName || !emailLike(invoice?.snapshot?.cashierName)) return invoice;
  return { ...invoice, issuedByName: displayName, snapshot: { ...invoice.snapshot, cashierName: displayName } };
}

async function projectInvoiceCashiers(invoices: any[]) {
  const legacy = invoices.filter((invoice) => emailLike(invoice?.snapshot?.cashierName) && invoice.issuedBy);
  if (!legacy.length) return invoices;
  const users = await UserModel.find({ _id: { $in: [...new Set(legacy.map((invoice) => String(invoice.issuedBy)))] } }).select("displayName").lean();
  const names = new Map(users.map((user: any) => [String(user._id), String(user.displayName || "").trim()]));
  return invoices.map((invoice) => projectLegacyInvoiceCashier(invoice, names.get(String(invoice.issuedBy))));
}

async function projectInvoiceSalespersons(invoices: any[]) {
  const missing = invoices.filter((invoice) => !String(invoice?.snapshot?.salespersonName || "").trim() && invoice?.orderId);
  if (!missing.length) return invoices;
  const orders = await RetailOrderModel.find({ _id: { $in: [...new Set(missing.map((invoice) => String(invoice.orderId)))] } }).select("salespersonName").lean();
  const names = new Map(orders.map((order: any) => [String(order._id), String(order.salespersonName || "").trim()]));
  return invoices.map((invoice) => {
    const salespersonName = String(invoice?.snapshot?.salespersonName || names.get(String(invoice.orderId)) || "").trim();
    return salespersonName ? { ...invoice, snapshot: { ...invoice.snapshot, salespersonName } } : invoice;
  });
}

export async function issueRetailInvoice(order: IRetailOrder & { _id: unknown }, prefix: string, branchCode: string, scope: string, actor: any, session: ClientSession) {
  const [company, branch] = await Promise.all([
    CompanyModel.findOne({ code: order.companyCode }).session(session).lean(),
    BranchModel.findOne({ _id: order.branchId, companyCode: order.companyCode }).session(session).lean(),
  ]);
  if (!company || !branch) throw new Error("Không thể xác định thông tin cửa hàng trên hóa đơn.");
  const store: RetailStoreSnapshot = {
    legalName: company.name,
    storeName: company.name,
    branchCode: branch.code || branchCode,
    branchName: branch.name,
    branchAddress: branch.address || undefined,
    branchPhone: branch.phone || undefined,
  };
  const counter = await RetailInvoiceCounterModel.findOneAndUpdate({ companyCode: order.companyCode, branchId: order.branchId, scope }, { $inc: { seq: 1 } }, { returnDocument: 'after', upsert: true, session });
  const invoiceNo = `${prefix.trim().toUpperCase()}-${branchCode.trim().toUpperCase()}-${scope}-${String(counter!.seq).padStart(6, "0")}`;
  const invoice = await RetailInvoiceModel.create([{ invoiceNo, orderId: String(order._id), orderCode: order.orderCode!, companyCode: order.companyCode, branchId: order.branchId, snapshot: buildRetailInvoiceSnapshot(order, actor, store), issuedAt: new Date(), issuedBy: String(actor.id || actor.uid || ""), issuedByName: String(actor.displayName || actor.email || ""), status: "issued" }], { session });
  return invoice[0];
}

export const RetailInvoiceService = {
  async list(scope: RetailBranchScope, query: any) {
    const { filter, page, limit, skip } = buildInvoiceListQuery(scope, query);
    const [items, total] = await Promise.all([
      RetailInvoiceModel.find(filter).sort({ issuedAt: -1 }).skip(skip).limit(limit).lean(),
      RetailInvoiceModel.countDocuments(filter),
    ]);
    return { items: await projectInvoiceSalespersons(await projectInvoiceCashiers(items)), total, page, limit };
  },
  async detail(scope: RetailBranchScope, id: string) {
    const invoice = await RetailInvoiceModel.findOne({ _id: id, ...scope }).lean();
    if (!invoice) throw new Error("Không tìm thấy hóa đơn.");
    return (await projectInvoiceSalespersons(await projectInvoiceCashiers([invoice])))[0];
  },
  async registerPosPrint(scope: RetailBranchScope, id: string, actor: any) {
    const actorId = invoiceActorId(actor);
    const actorName = invoiceActorName(actor);
    if (!actorId) throw invoiceFlowError("Không xác định được nhân viên in hóa đơn.", 401, "INVOICE_PRINT_ACTOR_REQUIRED");
    const invoice = await RetailInvoiceModel.findOneAndUpdate(
      { _id: id, ...scope, status: "issued", issuedBy: actorId, initialPrintedAt: { $exists: false } },
      { $set: { initialPrintedAt: new Date(), initialPrintedBy: actorId, initialPrintedByName: actorName } },
      { returnDocument: "after" },
    ).lean();
    if (invoice) return (await projectInvoiceSalespersons(await projectInvoiceCashiers([invoice])))[0];

    const current = await RetailInvoiceModel.findOne({ _id: id, ...scope }).select("status issuedBy initialPrintedAt").lean();
    if (!current) throw new Error("Không tìm thấy hóa đơn.");
    if (String(current.issuedBy) !== actorId) throw invoiceFlowError("Chỉ nhân viên tạo đơn mới được in hóa đơn lần đầu tại POS.", 403, "INVOICE_INITIAL_PRINT_FORBIDDEN");
    if (current.initialPrintedAt) throw invoiceFlowError("Hóa đơn đã được in tại POS. Vui lòng nhờ quản lý in lại.", 409, "INVOICE_ALREADY_PRINTED");
    throw invoiceFlowError("Hóa đơn không ở trạng thái có thể in.", 409, "INVOICE_NOT_PRINTABLE");
  },
  async reprint(scope: RetailBranchScope, id: string, actor: any) {
    const actorId = invoiceActorId(actor);
    if (!actorId) throw invoiceFlowError("Không xác định được người in lại hóa đơn.", 401, "INVOICE_REPRINT_ACTOR_REQUIRED");
    const invoice = await RetailInvoiceModel.findOneAndUpdate(
      { _id: id, ...scope, status: "issued" },
      { $inc: { reprintCount: 1 }, $push: { reprintLog: { at: new Date(), by: actorId, byName: invoiceActorName(actor) } } },
      { returnDocument: "after" },
    ).lean();
    if (!invoice) throw new Error("Không tìm thấy hóa đơn đang phát hành.");
    return (await projectInvoiceSalespersons(await projectInvoiceCashiers([invoice])))[0];
  },
};
