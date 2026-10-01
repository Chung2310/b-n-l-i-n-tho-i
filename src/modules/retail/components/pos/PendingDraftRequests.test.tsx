// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PendingDraftRequests from "./PendingDraftRequests";
import { retailOrdersApi } from "../../api/retailOrders.api";
vi.mock("../../api/retailOrders.api", () => ({ retailOrdersApi: { createDraft: vi.fn(), updateDraft: vi.fn(), confirm: vi.fn(), reconcileDraftRequest: vi.fn(), revokeDraftRequest: vi.fn() } }));
const scope = { companyCode: "A", branchId: "B" };
const key = 'retail-create-draft:v1:["A","B","u1"]';
const request = { idempotencyKey: "original-key", input: { customerId: "c1", items: [{ productId: "p1", quantity: 1 }] } };
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_key, _options, work) => work({})) } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("recovers the exact persisted creation without confirming payment", async () => {
  localStorage.setItem(key, JSON.stringify(request));
  vi.mocked(retailOrdersApi.createDraft).mockResolvedValue({ _id: "o1", version: 0 } as any);
  const done = vi.fn(); render(<PendingDraftRequests scope={scope} userId="u1" busy={false} onRecovered={done} />);
  fireEvent.click(screen.getByText("Khôi phục bản nháp"));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(retailOrdersApi.createDraft).toHaveBeenCalledWith(scope, { ...request.input, idempotencyKey: request.idempotencyKey });
  expect(localStorage.getItem(key)).toBeNull(); expect(retailOrdersApi.confirm).not.toHaveBeenCalled();
});
it("keeps the old update version after a lost response", async () => {
  const updateKey = 'retail-update-draft:v1:["A","B","u1","o1"]';
  const saved = { ...request, input: { ...request.input, version: 2 } };
  localStorage.setItem(updateKey, JSON.stringify(saved));
  vi.mocked(retailOrdersApi.updateDraft).mockRejectedValue(new Error("network"));
  render(<PendingDraftRequests scope={scope} userId="u1" busy={false} onRecovered={vi.fn()} />);
  fireEvent.click(screen.getByText("Khôi phục bản nháp"));
  await screen.findByText("network");
  expect(retailOrdersApi.updateDraft).toHaveBeenCalledWith(scope, "o1", { ...saved.input, idempotencyKey: saved.idempotencyKey });
  expect(JSON.parse(localStorage.getItem(updateKey)!)).toEqual(saved);
});
it("preserves conflicting legacy/shared requests without offering a send", () => {
  localStorage.setItem(key, JSON.stringify(request));
  sessionStorage.setItem(key, JSON.stringify({ ...request, idempotencyKey: "other" }));
  render(<PendingDraftRequests scope={scope} userId="u1" busy={false} onRecovered={vi.fn()} />);
  expect(screen.getByText(/Bản lưu chung khác bản tab cũ/)).toBeTruthy();
  expect(screen.getAllByText("Khôi phục bản nháp").every(button => (button as HTMLButtonElement).disabled)).toBe(true);
  expect(retailOrdersApi.createDraft).not.toHaveBeenCalled();
});
it("retains the request after a malformed successful response", async () => {
  localStorage.setItem(key, JSON.stringify(request));
  vi.mocked(retailOrdersApi.createDraft).mockResolvedValue({ _id: "o1" } as any);
  const done = vi.fn(); render(<PendingDraftRequests scope={scope} userId="u1" busy={false} onRecovered={done} />);
  fireEvent.click(screen.getByText("Khôi phục bản nháp"));
  await screen.findByText(/Phản hồi bản nháp không khớp/);
  expect(localStorage.getItem(key)).not.toBeNull(); expect(done).not.toHaveBeenCalled();
});
it("does not notify a different scope after the old panel unmounts", async () => {
  localStorage.setItem(key, JSON.stringify(request));
  let resolve!: (value: any) => void;
  vi.mocked(retailOrdersApi.createDraft).mockReturnValue(new Promise(r => { resolve = r; }));
  const done = vi.fn(); const view = render(<PendingDraftRequests scope={scope} userId="u1" busy={false} onRecovered={done} />);
  fireEvent.click(screen.getByText("Khôi phục bản nháp"));
  await waitFor(() => expect(retailOrdersApi.createDraft).toHaveBeenCalledOnce());
  view.unmount(); resolve({ _id: "o1", version: 0 });
  await waitFor(() => expect(localStorage.getItem(key)).toBeNull());
  expect(done).not.toHaveBeenCalled();
});

it("clears a completed request through read-only reconciliation", async () => {
  localStorage.setItem(key, JSON.stringify(request));
  vi.mocked(retailOrdersApi.reconcileDraftRequest).mockResolvedValue({ status: "completed", order: { _id: "o1", version: 4, status: "completed" } });
  const done = vi.fn(); render(<PendingDraftRequests scope={scope} userId="u1" busy={false} onRecovered={done} />);
  fireEvent.click(screen.getByText("Đối chiếu"));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(retailOrdersApi.reconcileDraftRequest).toHaveBeenCalledWith(scope, { request });
  expect(retailOrdersApi.createDraft).not.toHaveBeenCalled(); expect(retailOrdersApi.updateDraft).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBeNull();
});
it("resolves different legacy/shared requests independently without sending either writer", async () => {
  localStorage.setItem(key, JSON.stringify(request));
  const legacy = { ...request, idempotencyKey: "legacy-key" }; sessionStorage.setItem(key, JSON.stringify(legacy));
  vi.mocked(retailOrdersApi.reconcileDraftRequest).mockResolvedValue({ status: "completed", order: { _id: "o1", version: 0 } });
  render(<PendingDraftRequests scope={scope} userId="u1" busy={false} onRecovered={vi.fn()} />);
  const row = screen.getByText(/Bản tab cũ ·/).parentElement!;
  fireEvent.click(within(row).getByText("Đối chiếu"));
  await waitFor(() => expect(sessionStorage.getItem(key)).toBeNull());
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(request);
  expect(retailOrdersApi.reconcileDraftRequest).toHaveBeenCalledWith(scope, { request: legacy });
  expect(retailOrdersApi.createDraft).not.toHaveBeenCalled();
});
it.each(["not_found", "processing", "conflict"])("retains storage after read-only %s", async status => {
  localStorage.setItem(key, JSON.stringify(request));
  vi.mocked(retailOrdersApi.reconcileDraftRequest).mockResolvedValue({ status });
  render(<PendingDraftRequests scope={scope} userId="u1" busy={false} onRecovered={vi.fn()} />);
  fireEvent.click(screen.getByText("Đối chiếu")); await screen.findByText(/Chưa đủ bằng chứng/);
  expect(localStorage.getItem(key)).not.toBeNull();
});
it("recovers a lost revocation response through read-only reconciliation", async () => {
  localStorage.setItem(key, JSON.stringify(request)); vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(retailOrdersApi.revokeDraftRequest).mockRejectedValue(new Error("network"));
  render(<PendingDraftRequests scope={scope} userId="u1" busy={false} onRecovered={vi.fn()} />);
  fireEvent.click(screen.getByText("Thu hồi yêu cầu")); await screen.findByText("network");
  expect(localStorage.getItem(key)).not.toBeNull();
  vi.mocked(retailOrdersApi.reconcileDraftRequest).mockResolvedValue({ status: "revoked" });
  fireEvent.click(screen.getByText("Đối chiếu")); await waitFor(() => expect(localStorage.getItem(key)).toBeNull());
});
it("preserves a replacement pending payload when a revocation response arrives", async () => {
  localStorage.setItem(key, JSON.stringify(request)); vi.spyOn(window, "confirm").mockReturnValue(true);
  const replacement = { ...request, input: { ...request.input, shippingFee: 10 } };
  vi.mocked(retailOrdersApi.revokeDraftRequest).mockImplementation(async () => { localStorage.setItem(key, JSON.stringify(replacement)); return { status: "revoked" }; });
  render(<PendingDraftRequests scope={scope} userId="u1" busy={false} onRecovered={vi.fn()} />);
  fireEvent.click(screen.getByText("Thu hồi yêu cầu")); await screen.findByText(/Không dọn yêu cầu khác/);
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(replacement);
});
it("does not revoke when the user dismisses the confirmation", () => {
  localStorage.setItem(key, JSON.stringify(request)); vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<PendingDraftRequests scope={scope} userId="u1" busy={false} onRecovered={vi.fn()} />);
  fireEvent.click(screen.getByText("Thu hồi yêu cầu"));
  expect(retailOrdersApi.revokeDraftRequest).not.toHaveBeenCalled(); expect(localStorage.getItem(key)).not.toBeNull();
});

it("keeps same-key/different-payload conflicts separate during cleanup", async () => {
  localStorage.setItem(key, JSON.stringify(request));
  const legacy = { ...request, input: { ...request.input, shippingFee: 1 } }; sessionStorage.setItem(key, JSON.stringify(legacy));
  vi.mocked(retailOrdersApi.reconcileDraftRequest).mockResolvedValue({ status: "revoked" });
  render(<PendingDraftRequests scope={scope} userId="u1" busy={false} onRecovered={vi.fn()} />);
  fireEvent.click(within(screen.getByText(/Bản lưu chung ·/).parentElement!).getByText("Đối chiếu"));
  await waitFor(() => expect(localStorage.getItem(key)).toBeNull());
  expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual(legacy);
});
