import { EmployeeNode } from "../../types";

const normalizeOrgChartText = (value?: string): string => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

export const filterOrgChartEmployees = (
  employees: EmployeeNode[],
  searchQuery: string,
  department: string,
): EmployeeNode[] => {
  const query = normalizeOrgChartText(searchQuery);
  return employees.filter((employee) => {
    const matchesSearch = !query || [employee.name, employee.role, employee.department, employee.division]
      .some((value) => normalizeOrgChartText(value).includes(query));
    const matchesDepartment = department === "Tất cả" || employee.department === department;
    return matchesSearch && matchesDepartment;
  });
};

export const getManagerForEmployee = (employee: EmployeeNode, employees: EmployeeNode[]): EmployeeNode | undefined => {
  return employee.parentId ? employees.find((candidate) => candidate.id === employee.parentId) : undefined;
};

export const getRootEmployees = (arrangedEmployees: EmployeeNode[]): EmployeeNode[] => {
  return arrangedEmployees
    .filter((e) => !e.parentId || !arrangedEmployees.some((p) => p.id === e.parentId))
    .sort((a, b) => (b.isLeader ? 1 : 0) - (a.isLeader ? 1 : 0) || (a.level ?? 99) - (b.level ?? 99));
};

export const getRootDirectReports = (
  arrangedEmployees: EmployeeNode[],
  rootEmployees: EmployeeNode[]
): EmployeeNode[] => {
  const rootIds = new Set(rootEmployees.map((r) => r.id));
  return arrangedEmployees.filter((e) => e.parentId && rootIds.has(e.parentId));
};
