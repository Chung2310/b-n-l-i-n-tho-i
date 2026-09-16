// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { KanbanTaskProgress } from "./KanbanTaskProgress";
import type { HRTask } from "../../types/hr";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../modules/shared/lib/apiFetch", () => ({ apiFetch: api }));
const task = { id: "task", status: "In Progress", assigneeUid: "owner", assignee: "An", progress: 25, revision: 2 } as HRTask;
afterEach(cleanup);
beforeEach(() => { api.mockReset(); });
it("requires a note and saves the slider value with its revision", async () => {
  const saved = vi.fn();
  api.mockResolvedValue({ data: { ...task, _id: task.id, progress: 100, status: "Done" } });
  render(<KanbanTaskProgress task={task} uid="owner" manager={false} onSaved={saved} onReload={vi.fn()} />);
  const button = screen.getByRole("button", { name: "Lưu báo cáo tiến độ" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.change(screen.getByRole("slider"), { target: { value: "100" } });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Đã sửa xong" } });
  fireEvent.click(button);
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(JSON.parse(api.mock.calls[0][1].body)).toEqual({ action: "progress", progress: 100, note: "Đã sửa xong", revision: 2 });
});
it("lets coworkers join support without a progress slider or reassignment", async () => {
  api.mockResolvedValue({ data: { ...task, _id: task.id } });
  render(<KanbanTaskProgress task={{ ...task, helpRequested: true, helpReason: "Quá tải" }} uid="helper" manager={false} onSaved={vi.fn()} onReload={vi.fn()} />);
  expect(screen.queryByRole("slider")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tham gia hỗ trợ" }));
  await waitFor(() => expect(api).toHaveBeenCalled());
  expect(JSON.parse(api.mock.calls[0][1].body).action).toBe("join");
  expect(JSON.parse(api.mock.calls[0][1].body).assigneeUid).toBeUndefined();
});
it("preserves the draft note and reloads when another user updated the task", async () => {
  const reload = vi.fn();
  api.mockRejectedValue(Object.assign(new Error("Công việc đã thay đổi"), { status: 409 }));
  render(<KanbanTaskProgress task={task} uid="owner" manager={false} onSaved={vi.fn()} onReload={reload} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Đợi linh kiện" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu báo cáo tiến độ" }));
  await waitFor(() => expect(reload).toHaveBeenCalled());
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Đợi linh kiện");
  expect(screen.getByRole("alert").textContent).toContain("đã thay đổi");
});
