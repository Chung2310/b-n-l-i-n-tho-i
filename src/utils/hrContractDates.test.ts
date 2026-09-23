import { describe, expect, it } from "vitest";
import { calculateContractEndDate } from "./hrContractDates";

describe("calculateContractEndDate", () => {
  it("adds three days for a three-day probation contract", () => {
    expect(calculateContractEndDate("Hợp đồng thử việc 3 ngày", "2026-09-22"))
      .toBe("2026-09-25");
  });

  it("adds seven days for a seven-day probation contract", () => {
    expect(calculateContractEndDate("Hợp đồng thử việc 7 ngày", "2026-09-22"))
      .toBe("2026-09-29");
  });

  it("adds two calendar months and clamps month-end dates", () => {
    expect(calculateContractEndDate("Hợp đồng thử việc 2 tháng", "2026-12-31"))
      .toBe("2027-02-28");
  });

  it("does not set a date for contract types without an automatic duration", () => {
    expect(calculateContractEndDate("Hợp đồng chính thức", "2026-09-22")).toBe("");
    expect(calculateContractEndDate("Khác", "2026-09-22")).toBe("");
  });
});
