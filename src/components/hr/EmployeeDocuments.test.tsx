// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EmployeeDocumentsList } from "./EmployeeDocuments";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("previews a locally uploaded PDF inside the employee dialog and closes the preview", () => {
  render(<EmployeeDocumentsList employeeId="employee-1" documents={[{
    category: "identity", fileName: "CCCD.pdf", fileUrl: "private://pending",
    mimeType: "application/pdf", size: 100,
    uploadToken: "pending-token",
  }]} localPreviewUrls={{ "private://pending": "blob:local-pdf" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Xem trước CCCD.pdf" }));
  const dialog = screen.getByRole("dialog", { name: "Xem trước CCCD.pdf" });
  expect(dialog.querySelector("iframe")?.getAttribute("src")).toBe("blob:local-pdf");
  fireEvent.click(screen.getByRole("button", { name: "Đóng xem trước" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("fetches a short-lived signed URL before previewing a saved image", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { url: "https://signed.example/photo.png" } }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<EmployeeDocumentsList employeeId="employee-1" documents={[{
    category: "identity", fileName: "photo.png", fileUrl: "private://igen_erp/managed/acme/hr/employee/photo.png",
    mimeType: "image/png", size: 100,
  }]} />);
  fireEvent.click(screen.getByRole("button", { name: "Xem trước photo.png" }));
  const dialog = await screen.findByRole("dialog", { name: "Xem trước photo.png" });
  expect(dialog.querySelector("img")?.getAttribute("src")).toBe("https://signed.example/photo.png");
  expect(fetchMock.mock.calls[0][0]).toContain("/api/v1/auth/users/employee-1/documents/preview?");
});
