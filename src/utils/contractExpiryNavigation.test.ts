import { describe, expect, it } from "vitest";
import { buildContractReviewUrl, readContractSearch } from "./contractExpiryNavigation";

describe("contract expiry navigation", () => {
  it("builds the HR contract route with the employee name prefilled", () => {
    const url = buildContractReviewUrl("Nguyễn Văn ABC");
    expect(url).toBe("/nhan-su?sub=hop-dong&contractSearch=Nguy%E1%BB%85n+V%C4%83n+ABC");
    expect(readContractSearch(url.split("?")[1])).toBe("Nguyễn Văn ABC");
  });
});
