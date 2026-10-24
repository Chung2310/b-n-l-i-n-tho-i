import { describe, expect, it } from "vitest";
import { normalizeHireDate } from "./hire-date";

describe("normalizeHireDate", () => {
  it("stores a valid hiring day at UTC midnight", () => {
    expect(normalizeHireDate("2024-02-29")?.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("rejects impossible dates instead of rolling them into another month", () => {
    expect(() => normalizeHireDate("2026-02-29")).toThrow("Ngày vào làm không hợp lệ.");
  });
});
