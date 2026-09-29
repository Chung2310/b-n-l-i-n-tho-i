// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CollaboratorPicker from "./CollaboratorPicker";
import { partnerRequest } from "./partnerApi";

vi.mock("./partnerApi", () => ({
  partnerRequest: vi.fn(),
}));

describe("CollaboratorPicker & CreateCollaboratorDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads and displays existing collaborators in dropdown", async () => {
    vi.mocked(partnerRequest).mockResolvedValueOnce([
      { _id: "ctv-1", code: "CTV-001", name: "Nguyễn Văn A" },
      { _id: "ctv-2", code: "CTV-002", name: "Trần Thị B" },
    ]);

    const handleChange = vi.fn();
    render(<CollaboratorPicker value="" onChange={handleChange} />);

    await waitFor(() => {
      expect(partnerRequest).toHaveBeenCalledWith("/collaborators");
    });

    expect(screen.getByText("+ Thêm CTV")).toBeTruthy();
  });

  it("opens create collaborator dialog when clicking '+ Thêm CTV'", async () => {
    vi.mocked(partnerRequest).mockResolvedValueOnce([
      { _id: "ctv-1", code: "CTV-001", name: "Nguyễn Văn A" },
    ]);

    const user = userEvent.setup();
    render(<CollaboratorPicker value="" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("+ Thêm CTV")).toBeTruthy();
    });

    await user.click(screen.getByText("+ Thêm CTV"));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Tạo trực tiếp cộng tác viên (CTV)")).toBeTruthy();
    expect(screen.getByLabelText(/Họ và tên CTV/i)).toBeTruthy();
    expect(screen.getByLabelText(/Mã CTV/i)).toBeTruthy();
  });

  it("creates a collaborator directly and automatically selects it", async () => {
    vi.mocked(partnerRequest).mockImplementation(async (path, method, body) => {
      if (path === "/collaborators") {
        return [{ _id: "ctv-1", code: "CTV-001", name: "Nguyễn Văn A" }];
      }
      if (path === "/" && method === "POST") {
        return {
          _id: "ctv-new-123",
          code: (body as any).code,
          name: (body as any).name,
          phone: (body as any).phone,
          roles: ["collaborator"],
          status: "active",
        } as any;
      }
      return null;
    });

    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<CollaboratorPicker value="" onChange={handleChange} />);

    await waitFor(() => {
      expect(screen.getByText("+ Thêm CTV")).toBeTruthy();
    });

    // Open create dialog
    await user.click(screen.getByText("+ Thêm CTV"));

    const nameInput = screen.getByLabelText(/Họ và tên CTV/i);
    const phoneInput = screen.getByLabelText(/Số điện thoại/i);

    await user.type(nameInput, "Hoàng Nam CTV");
    await user.type(phoneInput, "0988776655");

    // Click submit button
    const submitBtn = screen.getByRole("button", { name: /Lưu & Chọn CTV/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(partnerRequest).toHaveBeenCalledWith(
        "/",
        "POST",
        expect.objectContaining({
          name: "Hoàng Nam CTV",
          phone: "0988776655",
          roles: ["collaborator"],
          status: "active",
        })
      );
    });

    // Automatically calls onChange with the newly created partner's ID
    expect(handleChange).toHaveBeenCalledWith("ctv-new-123");

    // Dialog closes
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("creates a collaborator with optional contact fields and without account provisioning", async () => {
    vi.mocked(partnerRequest).mockImplementation(async (path, method, body) => {
      if (path === "/collaborators") return [];
      if (path === "/" && method === "POST") {
        return {
          _id: "ctv-clean",
          code: (body as any).code,
          name: (body as any).name,
          email: (body as any).email,
          phone: (body as any).phone,
          address: (body as any).address,
          roles: ["collaborator"],
          status: "active",
        } as any;
      }
      return null;
    });

    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<CollaboratorPicker value="" onChange={handleChange} />);

    await waitFor(() => {
      expect(screen.getByText("+ Thêm CTV")).toBeTruthy();
    });

    await user.click(screen.getByText("+ Thêm CTV"));

    await user.type(screen.getByLabelText(/Họ và tên CTV/i), "Lê Văn Hùng");
    await user.type(screen.getByLabelText(/Email/i), "hung@example.com");
    await user.type(screen.getByLabelText(/Địa chỉ/i), "Hà Nội");

    // Account provisioning fields should not exist
    expect(screen.queryByLabelText(/Cấp tài khoản/i)).toBeNull();
    expect(screen.queryByLabelText(/Mật khẩu/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: /Lưu & Chọn CTV/i }));

    await waitFor(() => {
      expect(partnerRequest).toHaveBeenCalledWith(
        "/",
        "POST",
        expect.objectContaining({
          name: "Lê Văn Hùng",
          email: "hung@example.com",
          address: "Hà Nội",
          roles: ["collaborator"],
          status: "active",
        })
      );
    });

    expect(handleChange).toHaveBeenCalledWith("ctv-clean");
  });

  it("does not show '+ Thêm CTV' button when allowCreate is false", async () => {
    vi.mocked(partnerRequest).mockResolvedValueOnce([]);

    render(<CollaboratorPicker value="" onChange={vi.fn()} allowCreate={false} />);

    await waitFor(() => {
      expect(screen.queryByText("+ Thêm CTV")).toBeNull();
    });
  });
});
