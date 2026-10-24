export function permissionForMediaUpload(sourceType: unknown): string {
  const type = String(sourceType || "").trim().toLowerCase();
  if (type === "hr.kanban") return "work:manage";
  if (type === "hr.employee") return "access:manage";
  return "resource:manage";
}
