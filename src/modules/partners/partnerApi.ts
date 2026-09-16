import { apiFetch } from "../shared/lib/apiFetch";
export async function partnerRequest<T = any>(path: string, method = "GET", body?: unknown, params?: Record<string, string | number>) {
  const response = await apiFetch<{ success: boolean; data: T }>(`/partners${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }), params });
  return response.data;
}
export type Partner = { _id: string; code: string; name: string; roles: string[]; status: string; phone?: string; email?: string; address?: string; userId?: string; supplierId?: string; balance: number };
