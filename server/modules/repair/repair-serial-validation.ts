export function assertSerialForRepairType(ticketType: "warranty" | "service" = "warranty", device?: { serialNumber?: string; imei?: string }): void {
  if (ticketType === "warranty") {
    if (!String(device?.serialNumber || device?.imei || "").trim()) {
      throw Object.assign(new Error("IMEI/serial là bắt buộc khi tạo phiếu bảo hành."), { statusCode: 400, code: "REPAIR_SERIAL_REQUIRED" });
    }
  }
}

export function assertSoldSerialForRepair(device: { serialNumber?: string; imei?: string }): void {
  assertSerialForRepairType("warranty", device);
}
