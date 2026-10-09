import { describe, expect, it } from "vitest";

import {
  ERP_SERVICE_WEBSITE_URL,
  RETAIL_SERVICE_WEBSITE_URL,
  resolveServiceWebsiteUrl,
} from "./brand";

describe("resolveServiceWebsiteUrl", () => {
  it("uses the Retail origin for the public Retail host", () => {
    expect(resolveServiceWebsiteUrl("retail.igentechnology.net")).toBe(RETAIL_SERVICE_WEBSITE_URL);
  });

  it("normalizes hostname casing and a trailing dot", () => {
    expect(resolveServiceWebsiteUrl("RETAIL.IGENTECHNOLOGY.NET.")).toBe(RETAIL_SERVICE_WEBSITE_URL);
  });

  it("keeps ERP as the safe default for other hosts", () => {
    expect(resolveServiceWebsiteUrl("erp.igentechnology.net")).toBe(ERP_SERVICE_WEBSITE_URL);
    expect(resolveServiceWebsiteUrl("attacker.example")).toBe(ERP_SERVICE_WEBSITE_URL);
  });
});
