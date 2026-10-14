export type DomainEventType = "retail.order.confirmed" | "retail.order.paid" | "retail.order.cancelled" | "finance.receivable.settled" | "finance.receivable.overdue" | "repair.ticket.received" | "repair.ticket.done" | "repair.ticket.delivered" | "inventory.stock.changed" | "inventory.price.changed" | "tiktok.order.status.changed";

export interface RetailOrderConfirmedPayload { orderId: string; orderCode: string; branchId: string; customerId?: string; customerName?: string; customerPhone?: string; grandTotal: number; paidAmount: number; dueAmount: number; dueDate?: string; financingPartner?: string; }
export interface RetailOrderPaidPayload { orderId: string; orderCode: string; branchId: string; customerId: string; amount: number; transactionKey: string; occurredAt: string; }
export interface RetailOrderCancelledPayload { orderId: string; orderCode: string; branchId: string; customerId?: string; dueAmount: number; refundedAmount: number; reason: string; cancelledAt: string; }
export interface FinanceReceivableSettledPayload { receivableId: string; sourceType: string; sourceId: string; sourceCode: string; settledAt: string; }
export interface FinanceReceivableOverduePayload { receivableId: string; customerId: string; customerPhone?: string; balance: number; daysOverdue: number; sourceCode: string; }

export interface RepairTicketEventPayload { ticketId: string; ticketCode: string; branchId: string; customerId: string; customerName: string; customerPhone: string; deviceName: string; serialNumber?: string; imei?: string; technicianId?: string; technicianName?: string; status: string; totalAmount: number; dueAmount: number; occurredAt: string; }
export interface InventoryProductChangedPayload { variantId?: string; sku: string; }
export interface TikTokOrderStatusChangedPayload { notificationId: string; sellerOpenId: string; shopId: string; shopCipher: string; orderId: string; orderStatus: string; eventTimestamp: number; }

export type DomainPayloadMap = {
  "retail.order.confirmed": RetailOrderConfirmedPayload;
  "retail.order.paid": RetailOrderPaidPayload;
  "retail.order.cancelled": RetailOrderCancelledPayload;
  "finance.receivable.settled": FinanceReceivableSettledPayload;
  "finance.receivable.overdue": FinanceReceivableOverduePayload;
  "repair.ticket.received": RepairTicketEventPayload;
  "repair.ticket.done": RepairTicketEventPayload;
  "repair.ticket.delivered": RepairTicketEventPayload;
  "inventory.stock.changed": InventoryProductChangedPayload;
  "inventory.price.changed": InventoryProductChangedPayload;
  "tiktok.order.status.changed": TikTokOrderStatusChangedPayload;
};

export interface NewDomainEvent<T extends DomainEventType = DomainEventType> {
  eventId: string; eventType: T; companyCode: string; branchId?: string;
  aggregateType: string; aggregateId: string; payload: DomainPayloadMap[T];
  occurredAt: Date; actorId: string; actorName: string;
}
