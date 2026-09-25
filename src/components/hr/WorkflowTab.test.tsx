// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkflowReader } from "./WorkflowTab";

describe("WorkflowReader", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders ordered steps and opens the selected step details", () => {
    render(
      <WorkflowReader
        workflow={{
          name: "Onboarding workflow",
          description: "Guide for new employees",
          steps: [
            { id: "s1", title: "Receive documents", description: "Check submitted information", note: "Keep the original files", subTasks: [{ id: "task-1", title: "Verify identity" }], attachments: [{ id: "file-1", name: "onboarding-guide.pdf", url: "/guide.pdf", type: "file" }] },
            { id: "s2", title: "Create account", description: "Grant access by role" },
          ],
        } as any}
        canEdit={false}
        onBack={vi.fn()}
        onAddStep={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Onboarding workflow")).toBeTruthy();
    expect(screen.getByText("Receive documents")).toBeTruthy();
    expect(screen.getByText("Create account")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /edit|delete|add/i })).toBeNull();
    expect(screen.queryByText(/Dự kiến|ngày/)).toBeNull();
    expect(document.querySelectorAll("svg[aria-hidden='true']").length).toBeGreaterThan(0);

    const firstStepCard = screen.getByText("Receive documents").closest("li")!;
    fireEvent.click(within(firstStepCard).getByRole("button", { name: /sửa/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText("Keep the original files")).toBeTruthy();
    expect(within(dialog).getByText("Verify identity")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /xem preview/i }));
    expect(screen.getByRole("dialog", { name: /preview/i })).toBeTruthy();
    expect(screen.getByText("onboarding-guide.pdf")).toBeTruthy();
  });

  it("triggers onAddStep, onDelete, onEditStep, and onDeleteStep when canEdit is true", () => {
    const handleAddStep = vi.fn();
    const handleDelete = vi.fn();
    const handleEditStep = vi.fn();
    const handleDeleteStep = vi.fn();

    render(
      <WorkflowReader
        workflow={{
          name: "Sales workflow",
          description: "Process for store sale",
          steps: [
            { id: "s1", title: "Step 1", description: "First step" },
            { id: "s2", title: "Step 2", description: "Second step" },
          ],
        } as any}
        canEdit={true}
        onBack={vi.fn()}
        onAddStep={handleAddStep}
        onSave={vi.fn()}
        onDelete={handleDelete}
        onEditStep={handleEditStep}
        onDeleteStep={handleDeleteStep}
      />
    );

    // Test Thêm bước
    const addBtn = screen.getByRole("button", { name: /thêm bước/i });
    fireEvent.click(addBtn);
    expect(handleAddStep).toHaveBeenCalledTimes(1);

    // Test Xóa quy trình
    const deleteWorkflowBtn = screen.getByTitle("Xóa quy trình");
    fireEvent.click(deleteWorkflowBtn);
    expect(handleDelete).toHaveBeenCalledTimes(1);

    // Mở modal chi tiết bước 1
    const firstStepCard = screen.getByText("Step 1").closest("li")!;
    fireEvent.click(within(firstStepCard).getByRole("button", { name: /sửa/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();

    // Test nút Chỉnh sửa bước trong modal
    const editStepBtn = within(dialog).getByRole("button", { name: /chỉnh sửa bước/i });
    fireEvent.click(editStepBtn);
    expect(handleEditStep).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s1", title: "Step 1" })
    );

    // Mở lại modal để test Xóa bước
    fireEvent.click(within(firstStepCard).getByRole("button", { name: /sửa/i }));
    const deleteStepBtn = within(screen.getByRole("dialog")).getByRole("button", {
      name: /xóa bước này/i,
    });
    fireEvent.click(deleteStepBtn);
    expect(handleDeleteStep).toHaveBeenCalledWith("s1");
  });
});
