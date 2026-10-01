import type { ClientSession } from "mongoose";
import { SerialEventModel } from "../../inventory/serials/serial-event.model";
import { SerialUnitModel } from "../../inventory/serials/serial-unit.model";
import { normalizeSerialNumber } from "../../inventory/serials/serial-state";

function conflict() {
  return Object.assign(new Error("Máy không khớp phiếu sửa chữa hoặc thiếu bằng chứng tiếp nhận. Cần đối soát."), { statusCode: 409, code: "REPAIR_SERIAL_CONFLICT" });
}

export async function assertRepairSerialCompletion(ticket: any, phase: "delivered" | "cancelled" | "returned", session: ClientSession) {
  if (ticket.serialLifecycle?.mode === "untracked") return;
  const serial = String(ticket?.device?.serialNumber || ticket?.device?.imei || "").trim();
  if (!serial && !ticket.serialLifecycle) return;
  const event = await SerialEventModel.findOne({ companyCode: String(ticket.companyCode), branchId: String(ticket.branchId), documentType: "repair-ticket", documentId: String(ticket._id), eventType: `repair_${phase}`, fromStatus: "repairing", toStatus: "sold", ...(ticket.serialLifecycle?.unitId ? { serialUnitId: ticket.serialLifecycle.unitId } : { serialNumber: normalizeSerialNumber(serial) }) }).session(session).lean();
  if (!event) throw conflict();
}

// Service branches may differ from the selling branch within the same company.
// Preserve inventory ownership; receipt evidence identifies the servicing branch.
export async function recordRepairSerialLifecycle(ticket: any, phase: "received" | "delivered" | "cancelled" | "returned", actor: { id: string; name: string }, session: ClientSession) {
  if (!session?.inTransaction()) throw Object.assign(new Error("Repair lifecycle requires a transaction."), { statusCode: 503 });
  const serial = String(ticket?.device?.serialNumber || ticket?.device?.imei || "").trim();
  const scope = { companyCode: String(ticket.companyCode), branchId: String(ticket.branchId), documentType: "repair-ticket", documentId: String(ticket._id) };
  if (phase !== "received" && ticket.serialLifecycle?.mode === "untracked") return;
  if (!serial) {
    if (ticket.serialLifecycle?.mode === "tracked") throw conflict();
    if (phase === "received") ticket.serialLifecycle = { mode: "untracked" };
    return;
  }
  const identity = { companyCode: scope.companyCode, normalizedSerialNumber: normalizeSerialNumber(serial) };
  const unit: any = await SerialUnitModel.findOne(identity).session(session).lean();
  if (phase === "received" && !unit && ticket.ticketType === "service") {
    ticket.serialLifecycle = { mode: "untracked" };
    return;
  }
  if (!unit || (ticket.device.productId && String(unit.productId) !== String(ticket.device.productId))) throw conflict();
  if (phase !== "received") {
    if (ticket.serialLifecycle?.unitId && String(unit._id) !== ticket.serialLifecycle.unitId) throw conflict();
    const evidence = await SerialEventModel.findOne({ ...scope, serialUnitId: String(unit._id), eventType: "repair_received", fromStatus: "sold", toStatus: "repairing" }).session(session).lean();
    if (!evidence) throw conflict();
  }
  const fromStatus = phase === "received" ? "sold" : "repairing";
  const toStatus = phase === "received" ? "repairing" : "sold";
  const updated = await SerialUnitModel.findOneAndUpdate(
    { ...identity, _id: unit._id, status: fromStatus, ...(phase === "received" ? {} : { currentDocumentType: "repair-ticket", currentDocumentId: scope.documentId }) },
    { $set: { status: toStatus, currentDocumentType: "repair-ticket", currentDocumentId: scope.documentId, updatedBy: actor.id } },
    { returnDocument: "after", session },
  );
  if (!updated) throw conflict();
  await SerialEventModel.create([{ ...scope, serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: "repair_" + phase, fromStatus, toStatus, reason: String(ticket.ticketCode || ""), actorId: actor.id, actorName: actor.name }], { session });
  if (phase === "received") ticket.serialLifecycle = { mode: "tracked", unitId: String(unit._id) };
}
