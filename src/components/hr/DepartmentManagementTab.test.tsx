// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import DepartmentManagementTab from "./DepartmentManagementTab";
import { departmentService } from "../../services/departmentService";

vi.mock("../../services/departmentService", () => ({
  departmentService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../pages/Toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("DepartmentManagementTab", () => {
  const mockDepartments = [
    {
      _id: "dept1",
      companyCode: "TESTCO",
      code: "PB-KD",
      name: "Phòng Kinh Doanh",
      description: "Phòng phụ trách kinh doanh và bán lẻ",
      managerUid: "user1",
      managerName: "Nguyễn Văn A",
      sortOrder: 1,
      isActive: true,
      employeeCount: 3,
    },
    {
      _id: "dept2",
      companyCode: "TESTCO",
      code: "PB-KT",
      name: "Phòng Kỹ Thuật",
      description: "Phòng bảo hành và sửa chữa",
      managerUid: "",
      managerName: "",
      sortOrder: 2,
      isActive: false,
      employeeCount: 0,
    },
  ];

  const mockUsers = [
    {
      uid: "user1",
      displayName: "Nguyễn Văn A",
      email: "a@gmail.com",
      role: "manager",
      department: "Phòng Kinh Doanh",
    },
    {
      uid: "user2",
      displayName: "Trần Thị B",
      email: "b@gmail.com",
      role: "user",
      department: "Phòng Kinh Doanh",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (departmentService.list as any).mockResolvedValue(mockDepartments);
  });

  afterEach(() => {
    cleanup();
  });

  it("hiển thị tiêu đề, số lượng thống kê và danh sách phòng ban", async () => {
    render(
      <DepartmentManagementTab
        userProfile={{ role: "admin" }}
        selectedCompanyCode="TESTCO"
        usersList={mockUsers as any}
        canManage={true}
      />
    );

    expect(screen.getByText("Quản lý Phòng Ban")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("Phòng Kinh Doanh")).toBeDefined();
      expect(screen.getByText("PB-KD")).toBeDefined();
      expect(screen.getByText("Phòng Kỹ Thuật")).toBeDefined();
      expect(screen.getByText("PB-KT")).toBeDefined();
    });

    // Check manager name and fallback
    expect(screen.getByText("Nguyễn Văn A")).toBeDefined();
    expect(screen.getByText("Chưa bổ nhiệm trưởng phòng")).toBeDefined();
  });

  it("cho phép tìm kiếm phòng ban theo tên hoặc mã", async () => {
    render(
      <DepartmentManagementTab
        userProfile={{ role: "admin" }}
        selectedCompanyCode="TESTCO"
        usersList={mockUsers as any}
        canManage={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Phòng Kinh Doanh")).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText(
      "Tìm theo mã, tên phòng ban hoặc trưởng phòng..."
    );
    fireEvent.change(searchInput, { target: { value: "PB-KT" } });

    expect(screen.queryByText("Phòng Kinh Doanh")).toBeNull();
    expect(screen.getByText("Phòng Kỹ Thuật")).toBeDefined();
  });

  it("mở modal thêm phòng ban khi nhấn nút Thêm phòng ban", async () => {
    render(
      <DepartmentManagementTab
        userProfile={{ role: "admin" }}
        selectedCompanyCode="TESTCO"
        usersList={mockUsers as any}
        canManage={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Phòng Kinh Doanh")).toBeDefined();
    });

    const addButtons = screen.getAllByRole("button", { name: /Thêm phòng ban/i });
    fireEvent.click(addButtons[0]);

    expect(screen.getByText("Thêm phòng ban mới")).toBeDefined();
    expect(screen.getByPlaceholderText("VD: PB-KD, PB-KT...")).toBeDefined();
    expect(screen.getByPlaceholderText("VD: Phòng Kinh Doanh, Phòng Kỹ Thuật...")).toBeDefined();
  });
});
