import { describe, expect, it, vi } from "vitest";
import { createAttendanceResourceService } from "./attendance-resource.service";

describe("AttendanceResourceService", () => {
  it("indexes accepted employee evidence after a timekeeping log is persisted", async () => {
    const registerUploadedResource = vi.fn(async () => ({} as any));
    const service = createAttendanceResourceService({ registerUploadedResource });

    await service.indexAcceptedEvidence({
      companyCode: "ACME",
      branchId: "branch-a",
      userId: "user-1",
      userLabel: "Nguyen A",
      recordId: "log-1",
      action: "check-in",
      mimeType: "image/jpeg",
      evidence: { publicId: "attendance/evidence-1", resourceType: "image", type: "authenticated", format: "jpg", bytes: 20 },
    });

    expect(registerUploadedResource).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: "hr.employee",
      sourceRecordId: "log-1",
      sourceField: "check-in.evidence",
      storagePublicId: "attendance/evidence-1",
      storageAccess: "authenticated",
    }));
  });
});
