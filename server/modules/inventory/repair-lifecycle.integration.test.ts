import { RepairPartRequestModel } from "../repair/repair-part-request.model";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { RepairTicketModel } from "../repair/repair-ticket.model";
import { RepairSettingsModel } from "../repair/repair-settings.model";
import { RepairPartModel } from "../repair/repair-part.model";
import { SerialUnitModel } from "./serials/serial-unit.model";
import { SerialEventModel } from "./serials/serial-event.model";
import { RepairCreationRequestModel } from "../repair/repair-creation-request.model";
import { revokeRepairCreation, reconcileRepairCreation, createRepairTicket, deliverRepairTicket, transitionRepairTicket, cancelRepairTicket } from "../repair/repair-ticket.service";

const { notify, publish } = vi.hoisted(() => ({ notify: vi.fn(async () => undefined), publish: vi.fn(async () => undefined) }));
vi.mock("../repair/services/repair-notify.service", () => ({ dispatchRepairNotification: notify }));
vi.mock("../repair/services/repair-events", () => ({ publishRepairTicketEvent: publish }));
const scope = { companyCode: "REPAIR-LIFE", branchId: "service-branch" };
const actor = { id: "staff", name: "Staff" };
const input = (extra: any = {}) => ({ ticketCode: "SC-1", ticketType: "warranty", customerId: "KH-1", customerName: "Customer", customerPhone: "0901234567", device: { name: "Phone", serialNumber: "SERIAL-1", condition: "Broken", accessories: [], imeiVerified: true }, symptom: "Screen", receivedAt: new Date("2026-09-30"), ...extra } as any);
const models = [RepairPartRequestModel, RepairCreationRequestModel, RepairTicketModel, RepairSettingsModel, RepairPartModel, SerialUnitModel, SerialEventModel];
let replica: MongoMemoryReplSet;
const create = (extra: any = {}) => createRepairTicket(scope, input(extra), actor);
const unit = () => SerialUnitModel.findOne({ companyCode: scope.companyCode }).lean();
const seedUnit = () => SerialUnitModel.create({ ...scope, branchId: "selling-branch", productId: "product-1", sku: "PHONE", productName: "Phone", internalBarcode: "BAR-1", normalizedInternalBarcode: "BAR-1", serialNumber: "SERIAL-1", normalizedSerialNumber: "SERIAL-1", status: "sold", createdBy: actor.id, updatedBy: actor.id });
const ready = async () => { const t = await create(); await RepairTicketModel.updateOne({ _id: t._id }, { $set: { status: "done" } }); return String(t._id); };
beforeAll(async () => { replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replica.getUri()); await Promise.all(models.map(m => (m as any).init())); }, 60000);
beforeEach(async () => { vi.restoreAllMocks(); notify.mockClear(); publish.mockClear(); await Promise.all(models.map(m => (m as any).deleteMany({}))); await seedUnit(); });
afterAll(async () => { await mongoose.disconnect(); await replica?.stop(); });

it("receives across company branches and preserves the selling branch", async () => {
  const t = await create();
  expect(await unit()).toMatchObject({ status: "repairing", branchId: "selling-branch", currentDocumentId: String(t._id) });
  expect(t.serialLifecycle).toMatchObject({ mode: "tracked" });
  expect(await SerialEventModel.findOne().lean()).toMatchObject({ branchId: scope.branchId, eventType: "repair_received" });
  expect(notify).toHaveBeenCalledTimes(1);
});
it.each(["event", "ticket"])("rolls back receipt on %s failure and emits nothing", async failure => {
  if (failure === "event") vi.spyOn(SerialEventModel, "create").mockRejectedValueOnce(new Error("injected"));
  else vi.spyOn(RepairTicketModel.prototype, "save").mockRejectedValueOnce(new Error("injected"));
  await expect(create()).rejects.toThrow("injected");
  expect(await unit()).toMatchObject({ status: "sold" });
  expect(await RepairTicketModel.countDocuments()).toBe(0);
  expect(await SerialEventModel.countDocuments()).toBe(0);
  expect(notify).not.toHaveBeenCalled(); expect(publish).not.toHaveBeenCalled();
});
it("replays concurrent receipt once and rejects changed input or branch", async () => {
  const ts = await Promise.all([create(), create()]);
  expect(String(ts[0]._id)).toBe(String(ts[1]._id));
  expect(await RepairTicketModel.countDocuments()).toBe(1); expect(await SerialEventModel.countDocuments()).toBe(1);
  await expect(create({ symptom: "Other" })).rejects.toMatchObject({ statusCode: 409 });
  await expect(createRepairTicket({ ...scope, branchId: "other" }, input(), actor)).rejects.toMatchObject({ statusCode: 409 });
  expect(notify).toHaveBeenCalledTimes(1);
});
it("allows only one of two tickets to receive the same machine", async () => {
  const result = await Promise.allSettled([create(), create({ ticketCode: "SC-2" })]);
  expect(result.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(await RepairTicketModel.countDocuments()).toBe(1); expect(await SerialEventModel.countDocuments()).toBe(1);
});
it("delivers through either endpoint with one event under concurrency and retries", async () => {
  const id = await ready(); notify.mockClear();
  await Promise.all([deliverRepairTicket(scope, id, actor), transitionRepairTicket(scope, id, "delivered", actor)]);
  await deliverRepairTicket(scope, id, actor);
  expect(await unit()).toMatchObject({ status: "sold" });
  expect(await SerialEventModel.countDocuments({ eventType: "repair_delivered" })).toBe(1);
  expect(notify).toHaveBeenCalledTimes(1);
});
it("rolls back delivery and notification when event persistence fails", async () => {
  const id = await ready(); notify.mockClear(); publish.mockClear();
  vi.spyOn(SerialEventModel, "create").mockRejectedValueOnce(new Error("injected"));
  await expect(deliverRepairTicket(scope, id, actor)).rejects.toThrow("injected");
  expect(await RepairTicketModel.findById(id).lean()).toMatchObject({ status: "done" });
  expect(await unit()).toMatchObject({ status: "repairing" });
  expect(await SerialEventModel.countDocuments()).toBe(1); expect(notify).not.toHaveBeenCalled();
});
it.each(["owner", "branch", "missing", "evidence"])("rejects delivery with wrong %s", async failure => {
  const id = await ready();
  if (failure === "owner") await SerialUnitModel.updateMany({}, { $set: { currentDocumentId: "other-ticket" } });
  if (failure === "missing") await SerialUnitModel.deleteMany({});
  if (failure === "evidence") await SerialEventModel.updateMany({}, { $set: { branchId: "other" } });
  await expect(deliverRepairTicket(failure === "branch" ? { ...scope, branchId: "other" } : scope, id, actor)).rejects.toMatchObject({ statusCode: failure === "branch" ? 404 : 409 });
  expect(await RepairTicketModel.findById(id).lean()).toMatchObject({ status: "done" });
});
it("cancels concurrently once and returns the machine to sold", async () => {
  const t = await create(); const id = String(t._id);
  await Promise.all([cancelRepairTicket(scope, id, "reason", actor), cancelRepairTicket(scope, id, "reason", actor)]);
  expect(await unit()).toMatchObject({ status: "sold" });
  expect(await SerialEventModel.countDocuments({ eventType: "repair_cancelled" })).toBe(1);
});
it("rolls back cancellation when serial events fail", async () => {
  const t = await create(); vi.spyOn(SerialEventModel, "create").mockRejectedValueOnce(new Error("injected"));
  await expect(cancelRepairTicket(scope, String(t._id), "reason", actor)).rejects.toThrow("injected");
  expect(await unit()).toMatchObject({ status: "repairing" });
  expect(await RepairTicketModel.findById(t._id).lean()).toMatchObject({ status: "received" });
});
it("returns an unrepaired machine through the returned transition", async () => {
  const t = await create(); await transitionRepairTicket(scope, String(t._id), "returned", actor);
  expect(await unit()).toMatchObject({ status: "sold" });
  expect(await SerialEventModel.countDocuments({ eventType: "repair_returned" })).toBe(1);
});
it("freezes external service classification and never captures a later registry entry", async () => {
  await SerialUnitModel.deleteMany({}); const t = await create({ ticketType: "service" });
  expect(t.serialLifecycle).toMatchObject({ mode: "untracked" });
  await seedUnit(); await cancelRepairTicket(scope, String(t._id), "reason", actor);
  expect(await unit()).toMatchObject({ status: "sold" }); expect(await SerialEventModel.countDocuments()).toBe(0);
});
it("rejects warranty reception outside company scope", async () => {
  await expect(createRepairTicket({ ...scope, companyCode: "OTHER" }, input(), actor)).rejects.toMatchObject({ statusCode: 409 });
  expect(await unit()).toMatchObject({ status: "sold" }); expect(await RepairTicketModel.countDocuments()).toBe(0);
});
it("does not publish within a caller-owned transaction or after its abort", async () => {
  const session = await mongoose.startSession(); const effects: Array<() => void> = [];
  try { await expect(session.withTransaction(async () => { await createRepairTicket(scope, input(), actor, session, effects); expect(notify).not.toHaveBeenCalled(); throw new Error("abort"); })).rejects.toThrow("abort"); }
  finally { await session.endSession(); }
  expect(notify).not.toHaveBeenCalled(); expect(await RepairTicketModel.countDocuments()).toBe(0); expect(await unit()).toMatchObject({ status: "sold" });
});

it("rejects a completed historical ticket without lifecycle evidence", async () => {
  const id = await ready(); await RepairTicketModel.updateOne({ _id: id }, { $set: { status: "delivered" } });
  await expect(deliverRepairTicket(scope, id, actor)).rejects.toMatchObject({ code: "REPAIR_SERIAL_CONFLICT" });
  expect(await unit()).toMatchObject({ status: "repairing" });
});
it("publishes reception only after its ticket is visible outside the transaction", async () => {
  let committed: Promise<number> | undefined;
  notify.mockImplementationOnce(async () => { committed = RepairTicketModel.countDocuments({ ...scope, status: "received" }).exec(); });
  await create(); expect(await committed).toBe(1);
});

it("serializes cancellation against returning a machine", async () => {
  const t = await create(); const id = String(t._id);
  const results = await Promise.allSettled([cancelRepairTicket(scope, id, "reason", actor), transitionRepairTicket(scope, id, "returned", actor)]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(await unit()).toMatchObject({ status: "sold" });
  expect(await SerialEventModel.countDocuments()).toBe(2);
});
it("rejects a different product and a service machine that has not been sold", async () => {
  await expect(create({ device: { ...input().device, productId: "wrong-product" } })).rejects.toMatchObject({ statusCode: 409 });
  await SerialUnitModel.updateMany({}, { $set: { status: "in_stock" } });
  await expect(create({ ticketType: "service" })).rejects.toMatchObject({ statusCode: 409 });
  expect(await RepairTicketModel.countDocuments()).toBe(0); expect(await SerialEventModel.countDocuments()).toBe(0);
});

it("reconciles exact creation after ticket progress without writes or notifications", async () => {
  expect((await reconcileRepairCreation(scope, input(), actor)).status).toBe("not_found");
  const t = await create(); await cancelRepairTicket(scope, String(t._id), "Customer cancelled", actor);
  const tickets = await RepairTicketModel.find().lean(), events = await SerialEventModel.find().lean(), beforeUnit = await unit();
  notify.mockClear(); publish.mockClear();
  expect(await reconcileRepairCreation(scope, JSON.parse(JSON.stringify(input())), actor)).toMatchObject({ status: "completed", ticketId: String(t._id) });
  expect(await RepairTicketModel.find().lean()).toEqual(tickets); expect(await SerialEventModel.find().lean()).toEqual(events); expect(await unit()).toEqual(beforeUnit);
  expect(notify).not.toHaveBeenCalled(); expect(publish).not.toHaveBeenCalled();
});
it.each(["payload", "actor", "legacy"])("does not confirm creation with mismatched %s evidence", async change => {
  await create(); if (change === "legacy") await RepairTicketModel.updateMany({}, { $unset: { creationFingerprint: 1 } });
  expect((await reconcileRepairCreation(scope, input(change === "payload" ? { symptom: "Other" } : {}), change === "actor" ? { ...actor, id: "other" } : actor)).status).toBe("conflict");
});
it.each(["branchId", "companyCode"])("does not expose a creation result outside %s", async field => {
  await create(); expect((await reconcileRepairCreation({ ...scope, [field]: "other" }, input(), actor)).status).toBe("not_found");
});
it("requires an actor and code for creation reconciliation", async () => {
  await expect(reconcileRepairCreation(scope, input({ ticketCode: "" }), actor)).rejects.toMatchObject({ statusCode: 400 });
  await expect(reconcileRepairCreation(scope, input(), { ...actor, id: "" })).rejects.toMatchObject({ statusCode: 400 });
});

const revoke = (extra: any = {}) => revokeRepairCreation(scope, input(extra), actor);
it("revokes durably without receiving the device or emitting notifications", async () => {
  const before = await unit(); expect((await revoke()).status).toBe("revoked"); expect((await revoke()).status).toBe("revoked");
  expect((await reconcileRepairCreation(scope, input(), actor)).status).toBe("revoked");
  await expect(create()).rejects.toMatchObject({ code: "REPAIR_CREATION_REVOKED" });
  expect(await unit()).toEqual(before); expect(await RepairTicketModel.countDocuments()).toBe(0); expect(await SerialEventModel.countDocuments()).toBe(0);
  expect(notify).not.toHaveBeenCalled(); expect(publish).not.toHaveBeenCalled();
  await create({ ticketCode: "replacement" }); expect(await RepairTicketModel.countDocuments()).toBe(1);
});
it("returns a created ticket on revoke without cancelling or changing it", async () => {
  const t = await create(); const before = await RepairTicketModel.findById(t._id).lean(), beforeUnit = await unit(); notify.mockClear(); publish.mockClear();
  expect(await revoke()).toMatchObject({ status: "completed", ticketId: String(t._id) });
  expect(await RepairTicketModel.findById(t._id).lean()).toEqual(before); expect(await unit()).toEqual(beforeUnit);
  expect(notify).not.toHaveBeenCalled(); expect(publish).not.toHaveBeenCalled();
});
it.each(["payload", "actor", "branch"])("refuses revoked-code reuse with changed %s", async changed => {
  await revoke();
  await expect(createRepairTicket(changed === "branch" ? { ...scope, branchId: "other" } : scope, input(changed === "payload" ? { symptom: "other" } : {}), changed === "actor" ? { ...actor, id: "other" } : actor)).rejects.toMatchObject({ code: "REPAIR_CREATION_CONFLICT" });
  expect(await RepairTicketModel.countDocuments()).toBe(0);
});
it.each(["payload", "branch", "legacy"])("does not poison existing ticket codes on conflicting %s revocation", async changed => {
  await create(); await RepairCreationRequestModel.deleteMany({});
  if (changed === "legacy") await RepairTicketModel.updateMany({}, { $unset: { creationFingerprint: 1 } });
  await expect(revokeRepairCreation(changed === "branch" ? { ...scope, branchId: "other" } : scope, input(changed === "payload" ? { symptom: "other" } : {}), actor)).rejects.toMatchObject({ code: "REPAIR_CREATION_CONFLICT" });
  expect(await RepairCreationRequestModel.countDocuments()).toBe(0);
  if (changed !== "legacy") expect((await revoke()).status).toBe("completed");
});
it("rolls back revocation failure and permits the original request", async () => {
  vi.spyOn(RepairCreationRequestModel.prototype, "save").mockRejectedValueOnce(new Error("injected"));
  await expect(revoke()).rejects.toThrow("injected"); expect(await RepairCreationRequestModel.countDocuments()).toBe(0);
  await create(); expect(await RepairTicketModel.countDocuments()).toBe(1);
});
it("requires an active external transaction", async () => {
  const session = await mongoose.startSession();
  try { await expect(revokeRepairCreation(scope, input(), actor, session)).rejects.toMatchObject({ statusCode: 503 }); }
  finally { await session.endSession(); }
  expect(await RepairCreationRequestModel.countDocuments()).toBe(0);
});
it.each(["create", "revoke"])("serializes delayed %s against its competitor", async delayed => {
  const original = RepairCreationRequestModel.findOneAndUpdate.bind(RepairCreationRequestModel);
  let entered!: () => void, release!: () => void;
  const reached = new Promise<void>(resolve => { entered = resolve; }); const pause = new Promise<void>(resolve => { release = resolve; });
  vi.spyOn(RepairCreationRequestModel, "findOneAndUpdate").mockImplementationOnce((async (...args: any[]) => { entered(); await pause; return (original as any)(...args); }) as any);
  const pending = (delayed === "create" ? create() : revoke()).then(value => ({ value, error: null as any }), error => ({ value: null, error }));
  await reached;
  try { await (delayed === "create" ? revoke() : create()); } finally { release(); }
  const result = await pending;
  if (delayed === "create") { expect(result.error).toMatchObject({ code: "REPAIR_CREATION_REVOKED" }); expect(await RepairTicketModel.countDocuments()).toBe(0); expect(await SerialEventModel.countDocuments()).toBe(0); expect(notify).not.toHaveBeenCalled(); }
  else { expect(result.error).toBeNull(); expect(result.value).toMatchObject({ status: "completed" }); expect(await RepairTicketModel.countDocuments()).toBe(1); expect(await SerialEventModel.countDocuments()).toBe(1); expect(notify).toHaveBeenCalledOnce(); }
});
