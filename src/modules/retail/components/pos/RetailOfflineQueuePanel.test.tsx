// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RetailOfflineQueuePanel from "./RetailOfflineQueuePanel";
afterEach(cleanup);
const item: any = { id: "q1", idempotencyKey: "key", status: "pending", attempts: 0, createdAt: "2026-08-12T00:00:00Z", lastError: undefined };
describe("RetailOfflineQueuePanel", () => {
  it("labels pending orders and allows retry but preserves unresolved requests", () => { const retry = vi.fn(), remove = vi.fn(); render(<RetailOfflineQueuePanel items={[item, { ...item, id: "q2", status: "failed", lastError: "Sai giá" }]} onRetry={retry} onRemove={remove} />); expect(screen.getByText("Chờ đồng bộ")).toBeTruthy(); expect(screen.getByText("Sai giá")).toBeTruthy(); fireEvent.click(screen.getByRole("button", { name: "Thử lại q2" })); expect(screen.queryByRole("button", { name: "Xóa q1" })).toBeNull(); expect(retry).toHaveBeenCalledWith("q2"); expect(remove).not.toHaveBeenCalled(); });
});

it("offers explicit reconciliation/revocation without deleting unresolved intents", () => {
  const reconcile = vi.fn(), revoke = vi.fn();
  render(<RetailOfflineQueuePanel items={[item]} onRetry={vi.fn()} onRemove={vi.fn()} onReconcile={reconcile} onRevoke={revoke} />);
  fireEvent.click(screen.getByRole("button", { name: "Đối chiếu q1" })); fireEvent.click(screen.getByRole("button", { name: "Thu hồi q1" }));
  expect(reconcile).toHaveBeenCalledWith("q1"); expect(revoke).toHaveBeenCalledWith("q1");
  expect(screen.queryByRole("button", { name: "Xóa q1" })).toBeNull();
});
