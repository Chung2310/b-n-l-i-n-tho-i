export type CustomerStatus = "active" | "inactive";
export type CustomerType = "regular" | "vat";
export type CustomerGender = "male" | "female" | "other";

export interface CustomerTier {
  code: string;
  name: string;
  minSpend: number;
  minGrossProfit?: number;
  pointMultiplier?: number;
  discountPercent?: number;
  color?: string;
}

export interface CustomerPointsPolicy {
  enabled: boolean;
  grossProfitPerPoint: number;
  pointRedeemValue: number;
  maxRedeemPercent: number;
  minOrderTotalForRedeem: number;
  allowRepairRedeem: boolean;
  allowRetailRedeem: boolean;
}

export interface CustomerSettings {
  companyCode: string;
  tierEvaluationMetric?: "gross_profit" | "sales";
  evaluationWindow?: "rolling12Months" | "allTime";
  customerTiers: CustomerTier[];
  pointsPolicy?: CustomerPointsPolicy;
}

export interface Customer {
  _id: string;
  companyCode: string;
  customerCode: string;
  type: CustomerType;
  name: string;
  phone: string;
  email?: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  gender?: CustomerGender;
  address?: string;
  notes?: string;
  status: CustomerStatus;
  source: "manual" | "pos" | "import";
  tier?: CustomerTier;
  tierGrossProfit?: number;
  tierTotalSales?: number;
  tierUpdatedAt?: string;

  // Loyalty Points
  pointsBalance?: number;
  totalPointsEarned?: number;
  totalPointsRedeemed?: number;

  createdBy: string;
  createdByName: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export type CustomerInput = Pick<Customer, "name" | "phone"> & Partial<Pick<Customer, "type" | "email" | "avatarUrl" | "dateOfBirth" | "gender" | "address" | "notes">>;
export type CustomerListQuery = {
  companyCode?: string;
  q?: string;
  status?: CustomerStatus;
  type?: CustomerType;
  page?: number;
  limit?: number;
};
export type PaginatedCustomers = { items: Customer[]; total: number; page: number; limit: number };
export interface BillingProfile { _id: string; customerId: string; legalName: string; taxId: string; address: string; invoiceEmail: string; contactName?: string; isDefault: boolean; status: CustomerStatus; version: number }
export type BillingProfileInput = Pick<BillingProfile, "legalName" | "taxId" | "address" | "invoiceEmail"> & Partial<Pick<BillingProfile, "contactName" | "isDefault">>;

export type CustomerTransactionType = "purchase" | "repair" | "warranty" | "buyback" | "return";

export interface CustomerPurchaseHistorySummary {
  orderCount: number;
  purchaseCount?: number;
  repairCount?: number;
  warrantyCount?: number;
  buybackCount?: number;
  returnCount?: number;
  totalPurchased: number;
  totalRepair?: number;
  totalBuyback?: number;
  totalRefunded?: number;
  totalPaid: number;
  currentDebt: number;
  lastPurchaseAt?: string;
}

export interface CustomerPurchaseHistoryLineItem {
  productId?: string;
  sku?: string;
  productName?: string;
  quantity?: number;
  unitPrice?: number;
  unitAmount?: number;
  discountAmount?: number;
  lineTotal?: number;
  lineAmount?: number;
  serialNumbers?: string[];
  internalBarcodes?: string[];
  trackingMode?: string;
  condition?: string;
  note?: string;
}

export interface CustomerPurchaseHistoryPayment {
  method: string;
  amount: number;
  paidAt?: string;
  receivedByName?: string;
  reference?: string;
}

export interface CustomerPurchaseHistoryItem {
  _id: string;
  orderCode?: string;
  recordType?: CustomerTransactionType;
  typeLabel?: string;
  status?: string;
  businessDate?: string;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  itemCount: number;
  salespersonName?: string;
  description?: string;
  createdAt?: string;

  // Enriched detail fields
  customerName?: string;
  customerPhone?: string;
  subtotal?: number;
  orderDiscount?: number;
  shippingFee?: number;
  paymentStatus?: string;
  items?: CustomerPurchaseHistoryLineItem[];
  payments?: CustomerPurchaseHistoryPayment[];

  // Repair specific
  device?: {
    name?: string;
    serialNumber?: string;
    imei?: string;
    condition?: string;
    accessories?: string[];
  };
  symptom?: string;
  diagnosis?: string;
  laborFee?: number;
  partCost?: number;
  discountAmount?: number;
  technicianName?: string;
  ticketType?: string;
  statusHistory?: Array<{
    from?: string;
    to: string;
    at: string;
    byName: string;
    note?: string;
  }>;

  // After-sale / Buyback / Return specific
  reason?: string;
  paymentMethod?: string;
  paymentReference?: string;
  orderCodeRef?: string;
  receiptCode?: string;

  // Warranty & extra info
  deviceInfo?: string;
  statusLabel?: string;
  coverage?: {
    customer?: {
      covered?: boolean;
      endAt?: string | Date;
    };
    costBearer?: string;
  };
  warrantyInfo?: {
    serialNumber?: string;
    productName?: string;
    expiresAt?: string | Date;
    isExpired?: boolean;
  };
}

export interface CustomerPurchaseHistory {
  summary: CustomerPurchaseHistorySummary;
  items: CustomerPurchaseHistoryItem[];
}

export type CustomerPurchaseHistoryScope = { companyCode: string; branchId: string };

export type PointTransactionType =
  | "EARN_ORDER"
  | "EARN_REPAIR"
  | "REDEEM_ORDER"
  | "REDEEM_REPAIR"
  | "MANUAL_GRANT"
  | "MANUAL_DEDUCT"
  | "REFUND_REVERT";

export interface CustomerPointLedgerItem {
  _id: string;
  companyCode: string;
  branchId?: string;
  customerId: string;
  transactionCode: string;
  type: PointTransactionType;
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  sourceType: "retail_order" | "repair_ticket" | "manual";
  sourceId?: string;
  sourceCode?: string;
  reasonCategory?: "purchase" | "repair" | "birthday" | "compensation" | "loyalty_gift" | "refund" | "correction";
  reason: string;
  actorId?: string;
  actorName?: string;
  createdAt: string;
}

export type PaginatedPointLedger = {
  items: CustomerPointLedgerItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
