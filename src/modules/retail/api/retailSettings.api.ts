import { parseApiErrorResponse } from "../../../services/apiClientError";
import { apiFetch, getAccessToken } from "../../shared/lib/apiFetch";
import type { RetailScope, RetailSettings } from "../types";

const params = (scope: RetailScope) => ({ companyCode: scope.companyCode, branchId: scope.branchId });

export const retailSettingsApi = {
  async get(scope: RetailScope): Promise<RetailSettings> {
    const response = await apiFetch<{ success: true; data: RetailSettings }>("/retail/settings", { params: params(scope) });
    return response.data;
  },
  async printConfig(scope: RetailScope): Promise<Pick<RetailSettings, "invoicePaperSize" | "invoiceTemplate" | "defaultTaxRate"> & { storeName: string }> {
    const response = await apiFetch<{ success: true; data: Pick<RetailSettings, "invoicePaperSize" | "invoiceTemplate" | "defaultTaxRate"> & { storeName: string } }>("/retail/settings/print", { params: params(scope) });
    return response.data;
  },
  async printPreviewPdf(scope: RetailScope, paperSize: RetailSettings["invoicePaperSize"]): Promise<Blob> {
    const query = new URLSearchParams({ ...params(scope), paperSize });
    const response = await fetch(`/api/v1/retail/settings/print-preview.pdf?${query.toString()}`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    if (!response.ok) throw await parseApiErrorResponse(response);
    return response.blob();
  },
  async update(input: Omit<RetailSettings, "companyCode" | "branchId">, scope: RetailScope): Promise<RetailSettings> {
    const response = await apiFetch<{ success: true; data: RetailSettings }>("/retail/settings", {
      method: "PUT",
      params: params(scope),
      body: JSON.stringify(input),
    });
    return response.data;
  },
};
