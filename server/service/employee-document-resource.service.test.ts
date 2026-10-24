import { describe, expect, it, vi } from "vitest";
import { createEmployeeDocumentResourceService } from "./employee-document-resource.service";

describe("EmployeeDocumentResourceService", () => {
  it("finalizes a job description against the persisted employee", async () => {
    const finalize = vi.fn(async () => []);
    const service = createEmployeeDocumentResourceService({ finalize });

    await service.finalizeJobDescription(
      { companyCode: "ACME", actorId: "admin-1" },
      { _id: "employee-1", displayName: "Nguyen A" },
      "token-1",
    );

    expect(finalize).toHaveBeenCalledWith(expect.anything(), {
      entityType: "employee",
      entityId: "employee-1",
      entityLabel: "Nguyen A",
      sourceRecordId: "employee-1",
      uploads: [{ uploadToken: "token-1", sourceField: "jobDescriptionLink" }],
    });
  });

  it("finalizes each new employee document against its saved list position", async () => {
    const finalize = vi.fn(async () => []);
    const service = createEmployeeDocumentResourceService({ finalize });
    await service.finalizeDocuments(
      { companyCode: "ACME", actorId: "admin-1" },
      { _id: "employee-1", displayName: "Nguyen A" },
      [{}, { uploadToken: "token-certificate" }, { uploadToken: "token-degree" }],
    );
    expect(finalize).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      entityType: "employee",
      entityId: "employee-1",
      expectedSourceType: "hr.employee",
      uploads: [
        { uploadToken: undefined, sourceField: "employeeDocuments.0" },
        { uploadToken: "token-certificate", sourceField: "employeeDocuments.1" },
        { uploadToken: "token-degree", sourceField: "employeeDocuments.2" },
      ],
    }));
  });
});
