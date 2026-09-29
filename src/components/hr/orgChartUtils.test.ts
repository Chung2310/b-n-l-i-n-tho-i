import { describe, expect, it } from "vitest";
import { EmployeeNode } from "../../types";
import { filterOrgChartEmployees, getManagerForEmployee, getRootEmployees, getRootDirectReports } from "./orgChartUtils";

const employees: EmployeeNode[] = [
  { id: "1", name: "Nguyễn An", role: "Giám đốc", department: "Điều hành", email: "an@example.com", phone: "0901", avatar: "A", level: 1, status: "online", division: "Khối Vận Hành" },
  { id: "2", name: "Trần Bình", role: "Nhân viên", department: "Kỹ thuật", email: "binh@example.com", phone: "0902", avatar: "B", level: 2, parentId: "1", status: "offline", division: "Khối Kỹ Thuật" },
];

describe("org chart list helpers", () => {
  it("filters flat employees by normalized search and department", () => {
    expect(filterOrgChartEmployees(employees, "NGUYEN", "Tất cả")).toHaveLength(1);
    expect(filterOrgChartEmployees(employees, "", "Kỹ thuật")).toEqual([employees[1]]);
  });

  it("returns the direct manager or a missing-data fallback", () => {
    expect(getManagerForEmployee(employees[1], employees)?.name).toBe("Nguyễn An");
    expect(getManagerForEmployee(employees[0], employees)).toBeUndefined();
  });

  it("correctly identifies multiple root admins and sorts leader first", () => {
    const multiAdminList: EmployeeNode[] = [
      { id: "admin2", name: "Leo Nguyen", role: "CEO", department: "Ban Giám Đốc", email: "leo@example.com", phone: "0909", avatar: "L", level: 1, status: "online", division: "Khối Quản Trị" },
      { id: "admin1", name: "iGen Test", role: "CEO", department: "Ban Giám Đốc", email: "test@example.com", phone: "0908", avatar: "I", level: 1, isLeader: true, status: "online", division: "Khối Quản Trị" },
      { id: "mgr1", name: "Trần Đình Trọng", role: "Quản lý", department: "Phòng Kỹ Thuật", email: "trong@example.com", phone: "0907", avatar: "T", level: 3, parentId: "admin1", status: "online", division: "Khối Kỹ Thuật" },
      { id: "mgr2", name: "Nguyễn Văn Hưng", role: "Quản lý", department: "Phòng Kinh Doanh", email: "hung@example.com", phone: "0906", avatar: "H", level: 3, parentId: "admin1", status: "online", division: "Khối Kinh Doanh" },
    ];

    const roots = getRootEmployees(multiAdminList);
    expect(roots).toHaveLength(2);
    // Leader should be sorted first
    expect(roots[0].id).toBe("admin1");
    expect(roots[1].id).toBe("admin2");

    const reports = getRootDirectReports(multiAdminList, roots);
    expect(reports).toHaveLength(2);
    expect(reports.map((r) => r.id)).toEqual(["mgr1", "mgr2"]);
  });
});
