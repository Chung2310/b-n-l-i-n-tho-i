import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { beforeAll, afterAll, expect, test, vi } from "vitest";
import { BranchModel } from "../model/branch.model";
import { DepartmentModel } from "../model/department.model";
import { UserModel } from "../model/user.model";
import { TrainingCourseModel } from "../model/training-course.model";
import { TrainingEnrollmentModel } from "../model/training-enrollment.model";
import { WorkflowModel } from "../model/workflow.model";
import { KanbanTaskModel } from "../model/kanban-task.model";
import { departmentService } from "./department.service";
import { crudService } from "./crud.service";
import { migrateDepartmentBranchIndex } from "../model/department-branch-index-migration";
vi.mock("./notification.service", () => ({ notificationService: { notifyCourseAssigned: vi.fn(), notifyTaskAssigned: vi.fn().mockResolvedValue(undefined) } }));

const companyCode = "HR_BRANCH_TEST";
let main: string, cn2: string, employee: string;
let repl: MongoMemoryReplSet;
beforeAll(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
  const branches = await BranchModel.create([{ companyCode, code: "MAIN", name: "Main" }, { companyCode, code: "CN2", name: "CN2" }]);
  [main, cn2] = branches.map(b => String(b._id));
  employee = String((await UserModel.collection.insertOne({ companyCode, branchId: main, displayName: "Main manager", department: "Marketing" })).insertedId);
}, 120000);
afterAll(async () => { await mongoose.disconnect(); await repl.stop(); });

test("department legacy data, employee counts, writes and manager references are branch isolated", async () => {
  const legacy = await DepartmentModel.create({ companyCode, code: "MKT", name: "Marketing" });
  expect(await departmentService.list(companyCode, cn2)).toEqual([]);
  expect(await departmentService.list(companyCode, main)).toEqual([expect.objectContaining({ employeeCount: 1 })]);
  await expect(departmentService.update(companyCode, String(legacy._id), { name: "Wrong" }, false, cn2)).rejects.toThrow();
  await expect(departmentService.delete(companyCode, String(legacy._id), false, cn2)).rejects.toThrow();
  await expect(departmentService.create(companyCode, { code: "OTHER", name: "Other", managerUid: employee, managerName: "Forged" }, cn2)).rejects.toThrow();
  const other = await departmentService.create(companyCode, { code: "MKT", name: "Marketing" }, cn2);
  expect(await DepartmentModel.findById(other._id).lean()).toMatchObject({ branchId: cn2 });
  expect(await departmentService.list(companyCode, cn2)).toEqual([expect.objectContaining({ employeeCount: 0 })]);
  await departmentService.delete(companyCode, other._id, false, cn2);
});

test.each([
  ["training-courses", TrainingCourseModel], ["training-enrollments", TrainingEnrollmentModel],
  ["workflows", WorkflowModel], ["kanban-tasks", KanbanTaskModel],
] as const)("%s list and direct ID operations cannot cross branches", async (name, model) => {
  const legacy = await model.collection.insertOne({ companyCode, title: "Legacy", branchId: undefined } as any);
  const id = String(legacy.insertedId);
  expect((await crudService.getList(name, companyCode, { filters: { branchId: cn2 } }, "admin")).total).toBe(0);
  expect((await crudService.getList(name, companyCode, { filters: { branchId: main } }, "admin")).total).toBe(1);
  await expect(crudService.getById(name, id, companyCode, "admin", cn2)).rejects.toThrow();
  await expect(crudService.update(name, id, { title: "Wrong" }, companyCode, "admin", cn2)).rejects.toThrow();
  await expect(crudService.delete(name, id, companyCode, "admin", cn2)).rejects.toThrow();
  await expect(crudService.getList(name, companyCode, {}, "admin")).rejects.toThrow();
});

test("new courses stamp active branch and reject cross-branch enrollment", async () => {
  const course = await crudService.create("training-courses", { title: "CN2 course", category: "general", icon: "book", duration: "1h", instructor: "Teacher", creatorUid: employee, branchId: main }, companyCode, cn2);
  expect(course.branchId).toBe(cn2);
  await expect(crudService.create("training-enrollments", { courseId: String(course._id), uid: employee }, companyCode, cn2)).rejects.toThrow();
  await crudService.update("training-courses", String(course._id), { branchId: main, title: "Renamed" }, companyCode, "admin", cn2);
  expect(await TrainingCourseModel.findById(course._id).lean()).toMatchObject({ branchId: cn2, title: "Renamed" });
});

test("index migration allows the same department code in different branches", async () => {
  await DepartmentModel.collection.createIndex({ companyCode: 1, code: 1 }, { unique: true });
  await migrateDepartmentBranchIndex();
  await migrateDepartmentBranchIndex();
  await departmentService.create(companyCode, { code: "MKT", name: "Marketing" }, cn2);
  expect((await DepartmentModel.collection.indexes()).some(i => i.unique && Object.keys(i.key).length === 2 && i.key.code === 1)).toBe(false);
});

test("operator updates cannot move a course to another branch", async () => {
  const course = await TrainingCourseModel.findOne({ companyCode, branchId: cn2 }).lean();
  await expect(crudService.update("training-courses", String(course!._id), { $set: { branchId: main } }, companyCode, "admin", cn2)).rejects.toThrow();
  expect(await TrainingCourseModel.findById(course!._id).lean()).toMatchObject({ branchId: cn2 });
});

test("generic task writes remain forbidden; dedicated routes are required", async () => {
  await expect(crudService.create("kanban-tasks", { title: "Wrong", assigneeUid: employee }, companyCode, cn2)).rejects.toThrow();
  await expect(crudService.create("kanban-tasks", { title: "Wrong", projectId: new mongoose.Types.ObjectId().toString() }, companyCode, cn2)).rejects.toThrow();
});

test("leave template updates cannot reassign branch ownership", async () => {
  const project = await crudService.create("hr-leave-templates", { name: "Branch template", fileUrl: "/test.pdf", fileName: "test.pdf", uploadedBy: employee, branchId: main }, companyCode, cn2);
  expect(project.branchId).toBe(cn2);
  const updated = await crudService.update("hr-leave-templates", String(project._id), { branchId: main, name: "Renamed" }, companyCode, "admin", cn2);
  expect(updated.branchId).toBe(cn2);
  await expect(crudService.create("hr-leave-templates", { name: "Missing scope", branchId: main }, companyCode)).rejects.toThrow();
});
