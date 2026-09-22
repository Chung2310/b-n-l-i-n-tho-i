import { apiFetch } from "../shared/lib/apiFetch";
import type {
  BillingProfile,
  BillingProfileInput,
  Customer,
  CustomerInput,
  CustomerListQuery,
  CustomerPurchaseHistory,
  CustomerPurchaseHistoryScope,
  CustomerSettings,
  CustomerStatus,
  PaginatedCustomers,
  PaginatedPointLedger,
  CustomerPointLedgerItem,
} from "./types";

export const customerApi = {
  async list(query: CustomerListQuery = {}) {
    const response = await apiFetch<{ success: true; data: PaginatedCustomers }>("/customers", { params: query });
    return response.data;
  },
  async uploadAvatar(file: File): Promise<string> {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });

    try {
      const response = await fetch("/api/v1/media/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`,
        },
        body: JSON.stringify({
          file: base64Data,
          folder: "customers",
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.url) return data.url;
      }
    } catch {
      // Fallback
    }
    return base64Data;
  },
  async detail(id: string, companyCode?: string) {
    const response = await apiFetch<{ success: true; data: Customer }>(`/customers/${id}`, { params: { companyCode } });
    return response.data;
  },
  async create(input: CustomerInput, companyCode?: string) {
    const response = await apiFetch<{ success: true; data: Customer }>("/customers", { method: "POST", params: { companyCode }, body: JSON.stringify(input) });
    return response.data;
  },
  async update(id: string, input: CustomerInput, version: number, companyCode?: string) {
    const response = await apiFetch<{ success: true; data: Customer }>(`/customers/${id}`, { method: "PATCH", params: { companyCode }, body: JSON.stringify({ ...input, version }) });
    return response.data;
  },
  async setStatus(id: string, status: CustomerStatus, version: number, companyCode?: string) {
    const response = await apiFetch<{ success: true; data: Customer }>(`/customers/${id}/${status === "active" ? "activate" : "deactivate"}`, { method: "POST", params: { companyCode }, body: JSON.stringify({ version }) });
    return response.data;
  },
  async billingProfiles(id: string, companyCode?: string) {
    const response = await apiFetch<{ success: true; data: BillingProfile[] }>(`/customers/${id}/billing-profiles`, { params: { companyCode } }); return response.data;
  },
  async createBillingProfile(id: string, input: BillingProfileInput, companyCode?: string) {
    const response = await apiFetch<{ success: true; data: { profile: BillingProfile; warnings: Array<{ code: string; message: string }> } }>(`/customers/${id}/billing-profiles`, { method: "POST", params: { companyCode }, body: JSON.stringify(input) }); return response.data;
  },
  async purchaseHistory(id: string, scope: CustomerPurchaseHistoryScope) {
    const response = await apiFetch<{ success: true; data: CustomerPurchaseHistory }>(`/customers/${id}/purchase-history`, { params: scope });
    return response.data;
  },
  async getSettings(companyCode: string) {
    const response = await apiFetch<{ success: true; data: CustomerSettings }>("/customers/settings", { params: { companyCode } });
    return response.data;
  },
  async updateSettings(input: Partial<CustomerSettings>, companyCode: string) {
    const response = await apiFetch<{ success: true; data: CustomerSettings }>("/customers/settings", { method: "PATCH", params: { companyCode }, body: JSON.stringify(input) });
    return response.data;
  },
  async getPointLedger(id: string, params: { page?: number; limit?: number; type?: string; companyCode?: string } = {}) {
    const response = await apiFetch<{ success: true; data: PaginatedPointLedger }>(`/customers/${id}/points/ledger`, { params });
    return response.data;
  },
  async adjustPoints(id: string, payload: { points: number; reasonCategory: string; reason: string }, companyCode?: string) {
    const response = await apiFetch<{ success: true; data: CustomerPointLedgerItem }>(`/customers/${id}/points/adjust`, {
      method: "POST",
      params: { companyCode },
      body: JSON.stringify(payload),
    });
    return response.data;
  },
};
