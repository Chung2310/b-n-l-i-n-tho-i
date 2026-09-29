import { CustomerError } from "./customer-errors";
import { Types, type SortOrder } from "mongoose";
import type { CustomerScope } from "./customer.service";
import { CustomerModel } from "./models/customer.model";
import { RetailOrderModel } from "../retail/models/retail-order.model";
import { RepairTicketModel } from "../repair/repair-ticket.model";
import { RetailAfterSaleModel } from "../retail/models/retail-after-sale.model";
import { SerialUnitModel } from "../inventory/serials/serial-unit.model";
import { normalizePhone } from "./customer-normalization";

type PurchaseHistoryOrder = {
  _id: unknown;
  orderCode?: string;
  status?: string;
  businessDate?: string;
  grandTotal?: number;
  paidAmount?: number;
  dueAmount?: number;
  items?: Array<{ quantity?: number; productName?: string; sku?: string }>;
  salespersonName?: string;
  createdAt?: unknown;
};

export interface CustomerPurchaseHistoryItem {
  _id: string;
  orderCode?: string;
  recordType?: "purchase" | "repair" | "warranty" | "buyback" | "return";
  typeLabel?: string;
  status?: string;
  statusLabel?: string;
  businessDate?: string;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  itemCount: number;
  salespersonName?: string;
  description?: string;
  createdAt?: string;
  customerName?: string;
  customerPhone?: string;
  subtotal?: number;
  orderDiscount?: number;
  discountAmount?: number;
  shippingFee?: number;
  paymentStatus?: string;
  items?: any[];
  payments?: any[];
  device?: any;
  deviceInfo?: string;
  symptom?: string;
  diagnosis?: string;
  laborFee?: number;
  partCost?: number;
  technicianName?: string;
  ticketType?: string;
  statusHistory?: any[];
  coverage?: any;
  warrantyInfo?: {
    serialNumber?: string;
    productName?: string;
    expiresAt?: string | Date;
    isExpired?: boolean;
  };
  reason?: string;
  paymentMethod?: string;
  paymentReference?: string;
  orderCodeRef?: string;
  receiptCode?: string;
}

export interface CustomerPurchaseHistoryRepository {
  customer(scope: CustomerScope, customerId: string): Promise<unknown | null>;
  orders(filter: Record<string, unknown>, sort: Record<string, SortOrder>): Promise<PurchaseHistoryOrder[]>;
  repairs?(filter: Record<string, unknown>, sort: Record<string, SortOrder>): Promise<any[]>;
  warranties?(filter: Record<string, unknown>, sort: Record<string, SortOrder>): Promise<any[]>;
  afterSales?(filter: Record<string, unknown>, sort: Record<string, SortOrder>): Promise<any[]>;
}

const numberValue = (value: unknown) => Number(value) || 0;
const completedPurchase = (order: PurchaseHistoryOrder) => order.status === "confirmed" || order.status === "completed";

export function createCustomerPurchaseHistoryService(repository: CustomerPurchaseHistoryRepository) {
  return {
    async get(scope: CustomerScope, customerId: string, branchId: string) {
      if (!Types.ObjectId.isValid(customerId)) throw new CustomerError("CUSTOMER_ID_INVALID", "Mã khách hàng không hợp lệ.");
      const normalizedBranchId = String(branchId || "").trim();
      if (!normalizedBranchId) throw new CustomerError("CUSTOMER_BRANCH_REQUIRED", "Chi nhánh là bắt buộc.", 400);
      const customer = await repository.customer(scope, customerId);
      if (!customer) throw new CustomerError("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.", 404);

      const [orderDocs, repairDocs, warrantyDocs, afterSaleDocs] = await Promise.all([
        repository.orders(
          { companyCode: scope.companyCode, branchId: normalizedBranchId, customerId },
          { businessDate: -1, _id: -1 },
        ),
        repository.repairs
          ? repository.repairs(
              { companyCode: scope.companyCode, branchId: normalizedBranchId, customerId },
              { receivedAt: -1, createdAt: -1, _id: -1 },
            )
          : Promise.resolve([]),
        repository.warranties
          ? repository.warranties(
              { companyCode: scope.companyCode, branchId: normalizedBranchId, customerId },
              { soldAt: -1, createdAt: -1, _id: -1 },
            )
          : Promise.resolve([]),
        repository.afterSales
          ? repository.afterSales(
              { companyCode: scope.companyCode, branchId: normalizedBranchId, customerId },
              { businessDate: -1, createdAt: -1, _id: -1 },
            )
          : Promise.resolve([]),
      ]);

      const orderItems = orderDocs.map((order) => {
        const desc = (order.items || [])
          .filter((i: any) => i.productName || i.sku)
          .map((i: any) => `${i.quantity || 1}x ${i.productName || i.sku}`)
          .join(", ");
        return {
          _id: String(order._id),
          orderCode: order.orderCode,
          recordType: "purchase" as const,
          typeLabel: "Mua hàng",
          status: order.status,
          businessDate: order.businessDate,
          grandTotal: numberValue(order.grandTotal),
          paidAmount: numberValue(order.paidAmount),
          dueAmount: numberValue(order.dueAmount),
          itemCount: (order.items || []).reduce((total, item) => total + numberValue(item.quantity), 0),
          salespersonName: order.salespersonName,
          description: desc || undefined,
          createdAt: order.createdAt ? String(order.createdAt) : undefined,
          customerName: (order as any).customerName,
          customerPhone: (order as any).customerPhone,
          subtotal: (order as any).subtotal !== undefined ? numberValue((order as any).subtotal) : undefined,
          orderDiscount: (order as any).orderDiscount !== undefined ? numberValue((order as any).orderDiscount) : undefined,
          shippingFee: (order as any).shippingFee !== undefined ? numberValue((order as any).shippingFee) : undefined,
          paymentStatus: (order as any).paymentStatus,
          items: (order.items || []).map((i: any) => ({
            productId: i.productId,
            sku: i.sku,
            productName: i.productName,
            quantity: numberValue(i.quantity),
            unitPrice: i.unitPrice !== undefined ? numberValue(i.unitPrice) : undefined,
            discountAmount: i.discountAmount !== undefined ? numberValue(i.discountAmount) : undefined,
            lineTotal: i.lineTotal !== undefined ? numberValue(i.lineTotal) : undefined,
            serialNumbers: i.serialNumbers,
            internalBarcodes: i.internalBarcodes,
            trackingMode: i.trackingMode,
            note: i.note,
          })),
          payments: ((order as any).payments || []).map((p: any) => ({
            method: p.method,
            amount: numberValue(p.amount),
            paidAt: p.paidAt ? String(p.paidAt) : undefined,
            receivedByName: p.receivedByName,
            reference: p.reference,
          })),
        };
      });

      const repairItems = (repairDocs || []).map((ticket: any) => {
        const descParts = [
          ticket.device?.name,
          ticket.device?.serialNumber || ticket.device?.imei,
          ticket.symptom,
        ].filter(Boolean);
        const bDate = ticket.receivedAt
          ? new Date(ticket.receivedAt).toISOString().slice(0, 10)
          : ticket.createdAt
          ? new Date(ticket.createdAt).toISOString().slice(0, 10)
          : undefined;
        return {
          _id: String(ticket._id),
          orderCode: ticket.ticketCode,
          recordType: (ticket.ticketType === "warranty" || String(ticket.ticketCode || "").startsWith("BH")) ? ("warranty" as const) : ("repair" as const),
          typeLabel: (ticket.ticketType === "warranty" || String(ticket.ticketCode || "").startsWith("BH")) ? "Bảo hành" : "Sửa chữa",
          status: ticket.status,
          businessDate: bDate,
          grandTotal: numberValue(ticket.totalAmount),
          paidAmount: numberValue(ticket.paidAmount),
          dueAmount: numberValue(ticket.dueAmount),
          itemCount: 1,
          salespersonName: ticket.technicianName || ticket.createdByName || "Kỹ thuật viên",
          description: descParts.join(" - ") || undefined,
          createdAt: ticket.receivedAt ? String(ticket.receivedAt) : ticket.createdAt ? String(ticket.createdAt) : undefined,
          customerName: ticket.customerName,
          customerPhone: ticket.customerPhone,
          device: ticket.device,
          deviceInfo: [ticket.device?.name, ticket.device?.serialNumber || ticket.device?.imei].filter(Boolean).join(" - ") || undefined,
          symptom: ticket.symptom,
          diagnosis: ticket.diagnosis,
          laborFee: ticket.laborFee !== undefined ? numberValue(ticket.laborFee) : undefined,
          partCost: ticket.partCost !== undefined ? numberValue(ticket.partCost) : undefined,
          discountAmount: ticket.discountAmount !== undefined ? numberValue(ticket.discountAmount) : undefined,
          technicianName: ticket.technicianName,
          ticketType: ticket.ticketType,
          statusHistory: ticket.statusHistory,
          coverage: ticket.coverage,
        };
      });

      const warrantyItems = (warrantyDocs || []).map((unit: any) => {
        const endAtDate = (unit.customerWarranty?.endAt || unit.warrantyExpiresAt) ? new Date(unit.customerWarranty?.endAt || unit.warrantyExpiresAt) : null;
        const isExpired = endAtDate ? endAtDate.getTime() < Date.now() : false;
        const bDate = unit.soldAt
          ? new Date(unit.soldAt).toISOString().slice(0, 10)
          : unit.createdAt
          ? new Date(unit.createdAt).toISOString().slice(0, 10)
          : undefined;
        return {
          _id: String(unit._id),
          orderCode: unit.soldOrderCode ? `BH-${unit.soldOrderCode}` : unit.orderCode ? `BH-${unit.orderCode}` : unit.serialNumber ? `BH-${unit.serialNumber}` : `BH-${unit.internalBarcode}`,
          recordType: "warranty" as const,
          typeLabel: "Bảo hành",
          status: isExpired ? "expired" : "active",
          statusLabel: isExpired ? "Hết hạn bảo hành" : "Còn bảo hành",
          businessDate: bDate,
          grandTotal: 0,
          paidAmount: 0,
          dueAmount: 0,
          itemCount: 1,
          salespersonName: unit.soldOrderCode ? `Đơn bán ${unit.soldOrderCode}` : "Bảo hành thiết bị",
          description: `${unit.productName || unit.sku} (S/N: ${unit.serialNumber || unit.internalBarcode}) - ${isExpired ? "Hết hạn BH" : "Còn hạn BH"}${endAtDate ? ` (${endAtDate.toLocaleDateString("vi-VN")})` : ""}`,
          createdAt: unit.soldAt ? String(unit.soldAt) : unit.createdAt ? String(unit.createdAt) : undefined,
          customerName: (customer as any)?.name,
          customerPhone: (customer as any)?.phone,
          device: {
            name: unit.productName || unit.sku,
            serialNumber: unit.serialNumber,
            imei: unit.serialNumber,
            condition: "Thiết bị chính hãng",
          },
          coverage: {
            customer: {
              covered: !isExpired,
              endAt: endAtDate || undefined,
            },
            costBearer: "shop",
          },
          deviceInfo: [unit.productName || unit.sku, unit.serialNumber || unit.internalBarcode].filter(Boolean).join(" - ") || undefined,
          warrantyInfo: {
            serialNumber: unit.serialNumber || unit.internalBarcode,
            productName: unit.productName || unit.sku,
            expiresAt: endAtDate || undefined,
            isExpired,
          },
        };
      });

      const afterSaleItems = (afterSaleDocs || []).map((doc: any) => {
        const isBuyback = doc.type === "buyback";
        const itemsDesc = (doc.items || [])
          .map((i: any) => `${i.quantity || 1}x ${i.productName || i.sku}`)
          .filter(Boolean)
          .join(", ");
        const bDate = doc.businessDate || (doc.createdAt ? new Date(doc.createdAt).toISOString().slice(0, 10) : undefined);
        return {
          _id: String(doc._id),
          orderCode: doc.code,
          recordType: isBuyback ? ("buyback" as const) : ("return" as const),
          typeLabel: isBuyback ? "Bán lại / Thu mua" : "Đổi trả hàng",
          status: doc.status || "completed",
          businessDate: bDate,
          grandTotal: numberValue(doc.totalAmount),
          paidAmount: numberValue(doc.totalAmount),
          dueAmount: 0,
          itemCount: (doc.items || []).reduce((t: number, i: any) => t + numberValue(i.quantity || 1), 0),
          salespersonName: doc.createdByName || "Nhân viên",
          description: isBuyback
            ? `Thu mua máy cũ: ${itemsDesc}${doc.reason ? ` - ${doc.reason}` : ""}`
            : `Đổi trả hàng đơn ${doc.orderCode || ""}: ${itemsDesc}${doc.reason ? ` - ${doc.reason}` : ""}`,
          createdAt: doc.createdAt ? String(doc.createdAt) : undefined,
          customerName: doc.customerName,
          customerPhone: doc.customerPhone,
          reason: doc.reason,
          paymentMethod: doc.paymentMethod,
          paymentReference: doc.paymentReference,
          orderCodeRef: doc.orderCode,
          receiptCode: doc.receiptCode,
          items: (doc.items || []).map((i: any) => ({
            productId: i.productId,
            sku: i.sku,
            productName: i.productName,
            quantity: numberValue(i.quantity),
            unitAmount: i.unitAmount !== undefined ? numberValue(i.unitAmount) : undefined,
            lineAmount: i.lineAmount !== undefined ? numberValue(i.lineAmount) : undefined,
            serialNumbers: i.serialNumbers,
            internalBarcodes: i.internalBarcodes,
            condition: i.condition,
            note: i.note,
          })),
        };
      });

      const allItems: CustomerPurchaseHistoryItem[] = [...orderItems, ...repairItems, ...warrantyItems, ...afterSaleItems].sort((a, b) => {
        const dateA = a.businessDate || "";
        const dateB = b.businessDate || "";
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return String(b._id).localeCompare(String(a._id));
      });

      const purchases = orderDocs.filter(completedPurchase);
      const lastPurchase = purchases.find((order) => order.businessDate);

      const validRepairs = (repairDocs || []).filter((r: any) => ["done", "delivered"].includes(r.status));
      const buybacks = (afterSaleDocs || []).filter((a: any) => a.type === "buyback");
      const returns = (afterSaleDocs || []).filter((a: any) => a.type === "return");

      const totalPurchased = purchases.reduce((total, order) => total + numberValue(order.grandTotal), 0);
      const totalRepair = validRepairs.reduce((total: number, r: any) => total + numberValue(r.totalAmount), 0);
      const totalBuyback = buybacks.reduce((total: number, a: any) => total + numberValue(a.totalAmount), 0);
      const totalRefunded = returns.reduce((total: number, a: any) => total + numberValue(a.totalAmount), 0);

      const totalPaid = purchases.reduce((total, order) => total + numberValue(order.paidAmount), 0)
        + (repairDocs || []).reduce((total: number, r: any) => total + numberValue(r.paidAmount), 0);

      const currentDebt = orderDocs.filter((order) => order.status === "confirmed").reduce((total, order) => total + numberValue(order.dueAmount), 0)
        + (repairDocs || []).filter((r: any) => !["delivered", "cancelled"].includes(r.status) || r.paymentStatus === "partial" || r.paymentStatus === "unpaid").reduce((total: number, r: any) => total + numberValue(r.dueAmount), 0);

      return {
        summary: {
          orderCount: allItems.length,
          purchaseCount: orderDocs.length,
          repairCount: allItems.filter((i) => i.recordType === "repair").length,
          warrantyCount: allItems.filter((i) => i.recordType === "warranty").length,
          buybackCount: buybacks.length,
          returnCount: returns.length,
          totalPurchased,
          totalRepair,
          totalBuyback,
          totalRefunded,
          totalPaid,
          currentDebt,
          lastPurchaseAt: lastPurchase?.businessDate,
        },
        items: allItems,
      };
    },
  };
}

const repository: CustomerPurchaseHistoryRepository = {
  customer: (scope, customerId) => CustomerModel.findOne({ _id: customerId, ...scope }).lean(),
  orders: async (filter: any, sort: any) => {
    const { companyCode, branchId, customerId } = filter || {};
    if (!companyCode || !customerId) return [];
    const customer: any = await CustomerModel.findOne({ _id: customerId, companyCode }).lean();
    const customerIds = [
      String(customerId),
      customer?.customerCode,
      customer?.phone ? `KH-${String(customer.phone).trim()}` : undefined,
      customer?.phone ? String(customer.phone).trim() : undefined,
    ].filter(Boolean) as string[];

    const query: Record<string, unknown> = {
      companyCode,
      ...(branchId ? { branchId } : {}),
      $or: [
        { customerId: { $in: customerIds } },
        ...(customer?.phone ? [{ customerPhone: customer.phone }] : []),
      ],
    };
    return RetailOrderModel.find(query).sort(sort).lean() as any;
  },
  repairs: async (filter: any, sort: any) => {
    const { companyCode, customerId } = filter || {};
    if (!companyCode || !customerId) return [];
    const customer: any = await CustomerModel.findOne({ _id: customerId, companyCode }).lean();
    const customerIds = [
      String(customerId),
      customer?.customerCode,
      customer?.phone ? `KH-${String(customer.phone).trim()}` : undefined,
      customer?.phone ? String(customer.phone).trim() : undefined,
    ].filter(Boolean) as string[];

    const phones = [
      customer?.phone ? String(customer.phone).trim() : undefined,
      customer?.phone ? normalizePhone(customer.phone) : undefined,
    ].filter(Boolean) as string[];

    const query: Record<string, unknown> = {
      companyCode,
      $or: [
        { customerId: { $in: customerIds } },
        { customerCode: { $in: customerIds } },
        ...(phones.length
          ? [
              { customerPhone: { $in: phones } },
              { normalizedCustomerPhone: { $in: phones } },
            ]
          : []),
      ],
    };
    return RepairTicketModel.find(query).sort(sort).lean() as any;
  },
  warranties: async (filter: any, sort: any) => {
    const { companyCode, customerId } = filter || {};
    if (!companyCode || !customerId) return [];
    const customer: any = await CustomerModel.findOne({ _id: customerId, companyCode }).lean();
    const customerIds = [
      String(customerId),
      customer?.customerCode,
      customer?.phone ? `KH-${String(customer.phone).trim()}` : undefined,
      customer?.phone ? String(customer.phone).trim() : undefined,
    ].filter(Boolean) as string[];

    const query: Record<string, unknown> = {
      companyCode,
      customerId: { $in: customerIds },
      customerWarranty: { $exists: true },
    };
    return SerialUnitModel.find(query).sort(sort || { soldAt: -1, createdAt: -1 }).lean() as any;
  },
  afterSales: async (filter: any, sort: any) => {
    const { companyCode, branchId, customerId } = filter || {};
    if (!companyCode || !customerId) return [];
    const customer: any = await CustomerModel.findOne({ _id: customerId, companyCode }).lean();
    const customerIds = [
      String(customerId),
      customer?.customerCode,
      customer?.phone ? `KH-${String(customer.phone).trim()}` : undefined,
      customer?.phone ? String(customer.phone).trim() : undefined,
    ].filter(Boolean) as string[];

    const query: Record<string, unknown> = {
      companyCode,
      ...(branchId ? { branchId } : {}),
      $or: [
        { customerId: { $in: customerIds } },
        ...(customer?.phone ? [{ customerPhone: customer.phone }] : []),
      ],
    };
    return RetailAfterSaleModel.find(query).sort(sort).lean() as any;
  },
};

export const CustomerPurchaseHistoryService = createCustomerPurchaseHistoryService(repository);

