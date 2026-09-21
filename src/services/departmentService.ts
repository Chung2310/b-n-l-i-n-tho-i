import { getAccessToken } from "./authService";
import type { DepartmentRecord, DepartmentInput } from "../types/hr";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer " + (getAccessToken() || ""));
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Lỗi xử lý yêu cầu phòng ban");
  }
  return data.data as T;
}

export const departmentService = {
  list: (companyCode?: string) => {
    const query = companyCode ? `?companyCode=${encodeURIComponent(companyCode)}` : "";
    return request<DepartmentRecord[]>(`/api/v1/departments${query}`);
  },

  create: (input: DepartmentInput) => {
    return request<DepartmentRecord>("/api/v1/departments", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update: (id: string, input: Partial<DepartmentInput>) => {
    return request<DepartmentRecord>(`/api/v1/departments/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  delete: (id: string) => {
    return request<{ message: string }>(`/api/v1/departments/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};
