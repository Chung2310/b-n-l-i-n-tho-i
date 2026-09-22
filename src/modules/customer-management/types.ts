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

export interface CustomerPurchaseHistorySummary {
  orderCount: number;
  totalPurchased: number;
  totalPaid: number;
  currentDebt: number;
  lastPurchaseAt?: string;
}

export interface CustomerPurchaseHistoryItem {
  _id: string;
  orderCode?: string;
  status?: string;
  businessDate?: string;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  itemCount: number;
  salespersonName?: string;
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
