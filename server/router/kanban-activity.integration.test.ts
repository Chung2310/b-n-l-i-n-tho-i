import express from "express";
import type { Server } from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ user: { id: "", role: "user", companyCode: "TEST", branchId: "b1" }, notify: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../middleware/auth", () => ({ requireAuth: (req: any, _res: any, next: any) => { req.user = state.user; next(); }, requirePermission: () => (_req: any, _res: any, next: any) => next() }));
vi.mock("../socket", () => ({ emitToCompany: vi.fn(), emitToUser: vi.fn() }));
vi.mock("../service/notification.service", () => ({ notificationService: { createNotification: state.notify } }));
vi.mock("../service/kanban-audit.service", () => ({ kanbanAuditService: { recordTaskMutation: vi.fn().mockResolvedValue(undefined) } }));
import { kanbanRouter } from "./kanban.router";
import { KanbanTaskModel } from "../model/kanban-task.model";
import { UserModel } from "../model/user.model";

let mongo: MongoMemoryServer;
let server: Server;
let url: string;
let taskId: string;
const primary = new mongoose.Types.ObjectId().toString();
const colleague = new mongoose.Types.ObjectId().toString();
const manager = new mongoose.Types.ObjectId().toString();
async function activity(body: any) {
  const response = await fetch(`${url}/tasks/${taskId}/activity`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() as any };
}
describe("task activity persistence and scope", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await UserModel.collection.insertMany([primary, colleague, manager].map((uid, i) => ({ _id: new mongoose.Types.ObjectId(uid), displayName: uid, companyCode: "TEST", branchId: "b1", role: i === 2 ? "manager" : "user" })) as any);
    const app = express(); app.use(express.json()); app.use(kanbanRouter);
    server = await new Promise<Server>(resolve => { const running = app.listen(0, "127.0.0.1", () => resolve(running)); });
    url = `http://127.0.0.1:${(server.address() as any).port}`;
  }, 120000);
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await mongoose.disconnect(); if (mongo) await mongo.stop(); });
  beforeEach(async () => {
    await KanbanTaskModel.deleteMany({});
    state.user = { id: primary, role: "user", companyCode: "TEST", branchId: "b1" };
    state.notify.mockClear();
    taskId = String((await KanbanTaskModel.create({ title: "Repair", assigneeUid: primary, assignee: "An", companyCode: "TEST", branchId: "b1", creatorUid: manager, status: "Not Started", dueDate: "2099-09-30T08:00:00Z" }))._id);
  });
  it("notifies coworkers, exposes help cards and keeps the primary when support joins", async () => {
    expect((await activity({ action: "help", note: "Waiting for parts", revision: 0 })).status).toBe(200);
    expect(state.notify.mock.calls.some(([notification]) => notification.recipientUid === colleague)).toBe(true);
    state.user.id = colleague;
    const list = await (await fetch(`${url}/tasks`)).json() as any;
    expect(list.data.map((task: any) => task._id)).toContain(taskId);
    const joined = await activity({ action: "join", revision: 1, assigneeUid: colleague });
    expect(joined.status).toBe(200);
    expect(joined.body.data.assigneeUid).toBe(primary);
    expect(joined.body.data.helpers[0].uid).toBe(colleague);
    expect((await activity({ action: "progress", progress: 100, note: "Done", revision: 2 })).status).toBe(403);
    state.user.id = primary;
    const completed = await activity({ action: "progress", progress: 100, note: "Fixed", revision: 2 });
    expect(completed.body.data).toMatchObject({ status: "Done", progress: 100, helpRequested: false, assigneeUid: primary });
    expect(completed.body.data.history).toHaveLength(3);
  });
  it("rejects cross-company and cross-branch access", async () => {
    state.user.companyCode = "OTHER";
    expect((await activity({ action: "help", note: "Help", revision: 0 })).status).toBe(404);
    state.user.companyCode = "TEST"; state.user.branchId = "b2";
    expect((await activity({ action: "help", note: "Help", revision: 0 })).status).toBe(404);
  });
  it("atomically rejects competing reports instead of losing history", async () => {
    const reports = await Promise.all([25, 75].map(progress => activity({ action: "progress", progress, note: "Report", revision: 0 })));
    expect(reports.map(result => result.status).sort()).toEqual([200, 409]);
    const task = await KanbanTaskModel.findById(taskId).lean();
    expect(task?.history).toHaveLength(1);
    expect(task?.revision).toBe(1);
  });
});
