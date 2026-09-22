import { beforeEach, expect, test, vi } from "vitest";

const findOne = vi.fn();
vi.mock("../inventory/serials/serial-unit.model", () => ({ SerialUnitModel: { findOne } }));
const { lookupDeviceOptional, requireSoldSerialForRepair } = await import("./repair-sold-serial.service");

beforeEach(() => findOne.mockReset());

test("rejects a serial that is not sold", async () => {
  findOne.mockReturnValue({ lean: async () => null });
  await expect(requireSoldSerialForRepair({ companyCode: "c1" }, { serialNumber: "imei-1" })).rejects.toMatchObject({ code: "REPAIR_SERIAL_NOT_SOLD" });
});

test("returns the sold serial unit", async () => {
  findOne.mockReturnValue({ lean: async () => ({ _id: "unit-1", status: "sold" }) });
  await expect(requireSoldSerialForRepair({ companyCode: "c1" }, { serialNumber: " imei-1 " })).resolves.toMatchObject({ _id: "unit-1" });
  expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ companyCode: "c1", normalizedSerialNumber: "IMEI-1", status: "sold" }));
});

test("lookupDeviceOptional returns null when empty", async () => {
  expect(await lookupDeviceOptional({ companyCode: "c1" }, { serialNumber: "" })).toBeNull();
  expect(await lookupDeviceOptional({ companyCode: "c1" }, undefined)).toBeNull();
});

test("lookupDeviceOptional queries inventory for serial", async () => {
  findOne.mockReturnValue({ lean: async () => ({ _id: "unit-2", status: "sold" }) });
  const result = await lookupDeviceOptional({ companyCode: "c1" }, { serialNumber: "sn-999" });
  expect(result).toMatchObject({ _id: "unit-2" });
});
