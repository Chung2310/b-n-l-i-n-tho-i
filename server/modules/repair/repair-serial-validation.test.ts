import { describe, expect, test } from "vitest";
import { assertSerialForRepairType, assertSoldSerialForRepair } from "./repair-serial-validation";

describe("assertSoldSerialForRepair", () => {
  test("rejects a repair ticket without an IMEI or serial", () => {
    expect(() => assertSoldSerialForRepair({ serialNumber: "", imei: "" })).toThrow("IMEI/serial");
  });

  test("accepts a ticket that identifies its sold device", () => {
    expect(() => assertSoldSerialForRepair({ serialNumber: " SN-001 " })).not.toThrow();
  });
});

describe("assertSerialForRepairType", () => {
  test("warranty requires serial or IMEI", () => {
    expect(() => assertSerialForRepairType("warranty", { serialNumber: "" })).toThrow("IMEI/serial");
    expect(() => assertSerialForRepairType("warranty", { serialNumber: "ABC" })).not.toThrow();
  });

  test("service allows empty serial or IMEI", () => {
    expect(() => assertSerialForRepairType("service", { serialNumber: "" })).not.toThrow();
    expect(() => assertSerialForRepairType("service", undefined)).not.toThrow();
  });
});
