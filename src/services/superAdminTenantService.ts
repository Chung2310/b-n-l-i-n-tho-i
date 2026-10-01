import type { BusinessType } from "../config/businessTypes";

export type Tenant = { code: string; name?: string; ownerEmail?: string; lifecycleStatus?: string; enabledModules?: string[]; businessType?: BusinessType; [key: string]: unknown };
export type TenantMutation = { actionId: string; result: Tenant };
export type TenantUser = { _id: string; displayName: string; email: string; role: string; status: string; disabledAt?: string | null; createdAt: string; phone?: string; department?: string; jobTitle?: string };
export type TenantSummary = { userCount: number; usersByRole: Record<string, number>; enabledModulesCount: number };
export type TenantCreateInput = { code: string; name: string; ownerEmail: string; ownerName: string; ownerPassword: string; enabledModules?: string[]; businessType?: BusinessType };
export type TenantCreateUserInput = { displayName: string; email: string; password: string; role?: string; phone?: string; department?: string; jobTitle?: string };
export type TenantUpdateUserInput = { displayName?: string; email?: string; role?: string; phone?: string; department?: string; jobTitle?: string; password?: string; disabledAt?: string | null };
type StepUp = { reason: string; password: string; token: string; step: number };
type ReasonOnly = { reason: string };

import { superAdminRequest as request } from "./superAdminRequest";
const mutation = (path: string, method: string, body: unknown) => request(path, { method, headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(body) }) as Promise<TenantMutation>;
export const superAdminTenantService = {
  list: async (query = "") => (await request(`/api/v1/super-admin/tenants${query ? `?query=${encodeURIComponent(query)}` : ""}`)).tenants as Tenant[],
  detail: async (code: string) => request(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}`) as Promise<{ tenant: Tenant; summary: TenantSummary; audit: any[] }>,
  listUsers: async (code: string) => (await request(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}/users`)).users as TenantUser[],
  createUser: (code: string, input: TenantCreateUserInput) =>
    request(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}/users`, {
      method: "POST",
      body: JSON.stringify(input),
      successMessage: "Đã tạo tài khoản thành công.",
    }) as Promise<{ user: TenantUser; message: string }>,
  updateUser: (code: string, userId: string, input: TenantUpdateUserInput) =>
    request(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
      successMessage: "Đã cập nhật tài khoản thành công.",
    }) as Promise<{ user: TenantUser; message: string }>,
  deleteUser: (code: string, userId: string) =>
    request(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      successMessage: "Đã xóa tài khoản thành công.",
    }) as Promise<{ message: string }>,
  create: (tenant: TenantCreateInput) => mutation("/api/v1/super-admin/tenants", "POST", tenant),
  update: (code: string, input: Partial<Tenant> & StepUp) => mutation(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}`, "PATCH", input),
  updateModules: (code: string, input: { enabledModules: string[]; businessType: BusinessType } & ReasonOnly) => mutation(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}/modules`, "PATCH", input),
  transition: (code: string, input: { lifecycleStatus: string } & ReasonOnly) => mutation(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}/lifecycle`, "POST", input),
  scheduleDeletion: (code: string, input: StepUp) => mutation(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}/deletion`, "POST", input),
  cancelDeletion: (code: string, input: StepUp) => mutation(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}/deletion`, "DELETE", input),
};
