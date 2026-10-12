import { describe, expect, it } from "vitest";
import { allocateTikTokInventory } from "./tiktok-shop.service";

describe("TikTok Shop inventory allocation", () => {
  it("puts all available stock in the only TikTok warehouse", () => {
    expect(allocateTikTokInventory(12, [{ warehouseId: "WH-1", quantity: 3 }])).toEqual([
      { warehouse_id: "WH-1", quantity: 12 },
    ]);
  });

  it("preserves the existing warehouse ratio and exact total", () => {
    expect(allocateTikTokInventory(11, [
      { warehouseId: "WH-1", quantity: 3 },
      { warehouseId: "WH-2", quantity: 1 },
    ])).toEqual([
      { warehouse_id: "WH-1", quantity: 8 },
      { warehouse_id: "WH-2", quantity: 3 },
    ]);
  });

  it("requires a warehouse configured on TikTok", () => {
    expect(() => allocateTikTokInventory(1, [])).toThrow(/chưa có kho hàng/i);
  });
});
