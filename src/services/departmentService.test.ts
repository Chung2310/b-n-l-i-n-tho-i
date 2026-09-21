// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { departmentService } from "./departmentService";

describe("departmentService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    localStorage.setItem("accessToken", "mock-token-123");
  });

  it("gọi API GET /api/v1/departments kèm companyCode", async () => {
    const mockData = [
      {
        _id: "dept1",
        companyCode: "TESTCO",
        code: "PB-KD",
        name: "Phòng Kinh Doanh",
        managerUid: "user1",
        managerName: "Nguyễn Văn A",
        sortOrder: 1,
        isActive: true,
        employeeCount: 5,
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "success", data: mockData }),
    } as any);

    const result = await departmentService.list("TESTCO");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/v1/departments?companyCode=TESTCO");
    expect(result).toEqual(mockData);
  });

  it("gọi API POST /api/v1/departments khi tạo mới phòng ban", async () => {
    const payload = {
      companyCode: "TESTCO",
      code: "PB-KT",
      name: "Phòng Kỹ Thuật",
      sortOrder: 2,
      isActive: true,
    };

    const createdData = {
      _id: "dept2",
      ...payload,
      employeeCount: 0,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "success", data: createdData }),
    } as any);

    const result = await departmentService.create(payload);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/v1/departments");
    const init = fetchSpy.mock.calls[0][1];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual(payload);
    expect(result).toEqual(createdData);
  });

  it("gọi API PUT /api/v1/departments/:id khi cập nhật", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "success", data: { _id: "dept1", name: "Phòng Kinh Doanh Mới" } }),
    } as any);

    await departmentService.update("dept1", { name: "Phòng Kinh Doanh Mới" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/v1/departments/dept1");
    expect(fetchSpy.mock.calls[0][1]?.method).toBe("PUT");
  });

  it("gọi API DELETE /api/v1/departments/:id khi xóa", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "success", message: "Đã xóa phòng ban" }),
    } as any);

    await departmentService.delete("dept1");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/v1/departments/dept1");
    expect(fetchSpy.mock.calls[0][1]?.method).toBe("DELETE");
  });
});
