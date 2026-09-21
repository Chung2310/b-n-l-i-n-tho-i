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

it("opens progress popup, requires a note and saves the slider value with its revision", async () => {
  const saved = vi.fn();
  api.mockResolvedValue({ data: { ...task, _id: task.id, progress: 100, status: "Done" } });
  render(<KanbanTaskProgress task={task} uid="owner" manager={false} onSaved={saved} onReload={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Báo cáo tiến độ" }));
  expect(screen.getByText("Báo cáo tiến độ công việc")).toBeTruthy();
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
  fireEvent.click(screen.getByRole("button", { name: "Báo cáo tiến độ" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Đợi linh kiện" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu báo cáo tiến độ" }));
  await waitFor(() => expect(reload).toHaveBeenCalled());
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Đợi linh kiện");
  expect(screen.getByRole("alert").textContent).toContain("đã thay đổi");
});

it("opens help popup to select helper and reason", async () => {
  const saved = vi.fn();
  api.mockResolvedValue({ data: { ...task, _id: task.id, helpRequested: true, helpReason: "Cần linh kiện" } });
  render(
    <KanbanTaskProgress
      task={task}
      uid="owner"
      manager={false}
      employees={[{ id: "helper-1", name: "Bình Kỹ Thuật" }]}
      onSaved={saved}
      onReload={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Yêu cầu trợ giúp" }));
  expect(screen.getByText("Yêu cầu trợ giúp công việc")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Chọn người trợ giúp"), { target: { value: "helper-1" } });
  fireEvent.change(screen.getByLabelText("Nguyên nhân cần trợ giúp"), { target: { value: "Bo mạch chập chờn cần hỗ trợ đo điện áp" } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu trợ giúp" }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(JSON.parse(api.mock.calls[0][1].body)).toEqual({
    action: "help",
    note: "Nhờ Bình Kỹ Thuật hỗ trợ: Bo mạch chập chờn cần hỗ trợ đo điện áp",
    helper: { uid: "helper-1", name: "Bình Kỹ Thuật" },
    revision: 2,
  });
});
