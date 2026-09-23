import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRetailReportController, retailReportScope } from "../controllers/retail-report.controller";
import { retailRouter } from "../router";
import { retailReportRoutes } from "../routes/retail-report.routes";
import {
  buildRetailReportOrderPipeline,
  buildRetailReportShiftPipeline,
  createRetailReportService,
} from "./retail-report.service";

test("report repository pipelines start with an inclusive company and branch date match", () => {
  const scope = { companyCode: "ACME", branchId: "branch-1" };
  const range = { from: "2026-08-01", to: "2026-08-10" };

  for (const pipeline of [
    buildRetailReportOrderPipeline(scope, range),
    buildRetailReportShiftPipeline(scope, range),
  ]) {
    assert.deepEqual(pipeline[0], {
      $match: {
        companyCode: "ACME",
        branchId: "branch-1",
        businessDate: { $gte: "2026-08-01", $lte: "2026-08-10" },
      },
    });
    assert.ok("$project" in pipeline[1], "repository must project only report fields after the scoped match");
  }
});

test("order pipeline scopes salesperson and product dimensions", () => {
  const pipeline = buildRetailReportOrderPipeline(
    { companyCode: "ACME", branchId: "branch-1" },
    { from: "2026-08-01", to: "2026-08-10" },
    { salespersonId: "seller-1", productId: "p1", sku: "SKU-1", category: "drinks", brand: "north" },
  );
  assert.deepEqual((pipeline[0] as any).$match, {
    companyCode: "ACME", branchId: "branch-1", businessDate: { $gte: "2026-08-01", $lte: "2026-08-10" }, salespersonId: "seller-1",
    items: { $elemMatch: { productId: "p1", sku: "SKU-1", category: { $regex: "^drinks$", $options: "i" }, brand: { $regex: "^north$", $options: "i" } } },
  });
});

test("report service loads scoped rows and delegates business semantics to the report reducer", async () => {
  type Pipeline = ReturnType<typeof buildRetailReportOrderPipeline>;
  const seen: { orders?: Pipeline; shifts?: Pipeline } = {};
  const service = createRetailReportService({
    loadOrders: async (pipeline) => {
      seen.orders = pipeline;
      return [{
        orderCode: "DH-1",
        businessDate: "2026-08-10",
        status: "completed",
        grandTotal: 100,
        totalCost: 60,
        refundedAmount: 0,
        dueAmount: 0,
        payments: [],
      }];
    },
    loadShifts: async (pipeline) => {
      seen.shifts = pipeline;
      return [];
    },
  });

  const result = await service.summary(
    { companyCode: "ACME", branchId: "branch-1" },
    { from: "2026-08-10", to: "2026-08-10" },
    false,
  );

  assert.deepEqual(seen.orders?.[0], {
    $match: {
      companyCode: "ACME",
      branchId: "branch-1",
      businessDate: { $gte: "2026-08-10", $lte: "2026-08-10" },
    },
  });
  assert.deepEqual(seen.shifts?.[0], seen.orders?.[0]);
  assert.equal(result.summary.netSales, 100);
  assert.equal("totalCost" in result.summary, false);
});

function response() {
  return {
    body: undefined as unknown,
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

test("controller ignores body scope and derives includeProfit from the manager capability", async () => {
  const calls: Array<{ scope: unknown; query: unknown; includeProfit: boolean }> = [];
  const capabilities: Array<{ actor: unknown; capability: string }> = [];
  const controller = createRetailReportController({
    hasCapability: async (actor, capability) => {
      capabilities.push({ actor, capability });
      return (actor as any).permissions.includes("retail:manage");
    },
    summary: async (scope, query, includeProfit) => {
      calls.push({ scope, query, includeProfit });
      return { marker: includeProfit } as any;
    },
  });

  for (const permissions of [["retail:operate"], ["retail:manage"]]) {
    const req: any = {
      user: { id: permissions[0], role: "user", companyCode: "ACME", branchId: "branch-1", permissions },
      query: { from: "2026-08-10", to: "2026-08-10", includeProfit: "true" },
      body: { companyCode: "OTHER", branchId: "branch-2", includeProfit: true },
    };
    await controller.summary(req, response() as any, () => undefined);
  }

  assert.deepEqual(calls.map(({ scope }) => scope), [
    { companyCode: "ACME", branchId: "branch-1" },
    { companyCode: "ACME", branchId: "branch-1" },
  ]);
  assert.deepEqual(calls.map(({ includeProfit }) => includeProfit), [false, true]);
  assert.deepEqual(capabilities.map(({ capability }) => capability), ["manager", "manager"]);
});

test("controller forwards async report errors to the API error middleware", async () => {
  const expected = Object.assign(new Error("Khoảng ngày báo cáo không hợp lệ."), { status: 400 });
  const controller = createRetailReportController({
    hasCapability: async () => false,
    summary: async () => { throw expected; },
  });
  const res = response();
  let forwarded: unknown;

  await (controller.summary as any)(
    {
      user: { role: "user", companyCode: "ACME", branchId: "branch-1" },
      query: { from: "invalid" },
      body: {},
    },
    res,
    (error: unknown) => { forwarded = error; },
  );

  assert.equal(forwarded, expected);
  assert.equal(res.body, undefined);
});

test("summary route is mounted and guarded by the existing operate and manager permissions", () => {
  const route = retailReportRoutes.stack.find((layer: any) => layer.route?.path === "/summary") as any;
  assert.ok(route?.route?.methods?.get);
  assert.equal(route.route.stack.length, 2, "GET summary must have the operate gate before its controller");

  const routeSource = readFileSync(new URL("../routes/retail-report.routes.ts", import.meta.url), "utf8");
  assert.match(
    routeSource,
    /requirePermission\(\[RETAIL_OPERATE_PERMISSION,\s*RETAIL_MANAGER_PERMISSION\]\)/,
  );

  const mountedPath = retailRouter.stack.find((layer: any) => layer.regexp?.test?.("/retail/reports"));
  assert.ok(mountedPath, "retail router must mount /retail/reports behind the existing parent guards");
});


test("all-branch pipelines retain company and date isolation", () => {
  for (const pipeline of [buildRetailReportOrderPipeline({ companyCode: "ACME" }, { from: "2026-09-01", to: "2026-09-23" }), buildRetailReportShiftPipeline({ companyCode: "ACME" }, { from: "2026-09-01", to: "2026-09-23" })]) {
    assert.deepEqual(pipeline[0], { $match: { companyCode: "ACME", businessDate: { $gte: "2026-09-01", $lte: "2026-09-23" } } });
  }
});
test("only company admins can request all branches or another verified branch", async () => {
  const user = { role: "admin", companyCode: "ACME", branchId: "B1" };
  let lookedUp: unknown;
  const lookup = async (scope: any) => { lookedUp = scope; return "B2"; };
  assert.deepEqual(await retailReportScope({ user, query: { branchId: "all" } } as any, lookup), { companyCode: "ACME" });
  assert.equal(lookedUp, undefined);
  assert.deepEqual(await retailReportScope({ user, query: { branchId: "B2" } } as any, lookup), { companyCode: "ACME", branchId: "B2" });
  assert.deepEqual(lookedUp, { companyCode: "ACME", branchId: "B2" });
  await assert.rejects(retailReportScope({ user, query: { companyCode: "OTHER", branchId: "all" } } as any, lookup), { status: 403 });
  for (const branchId of ["all", "B2"]) await assert.rejects(retailReportScope({ user: { ...user, role: "user" }, query: { branchId } } as any, lookup), { status: 403 });
  await assert.rejects(retailReportScope({ user, query: { branchId: "B2" } } as any, async () => { throw Object.assign(new Error("Wrong company"), { status: 404 }); }), { status: 404 });
});
test("all-branch export uses the same company scope as summary", async () => {
  let requested: unknown, exported: unknown;
  const controller = createRetailReportController({ hasCapability: async () => true, summary: async scope => { requested = scope; return {} as any; }, findBranchCode: async () => { throw new Error("Should not look up all as a branch"); }, buildWorkbook: (_model, options) => { exported = options; return { buffer: Buffer.from("test"), filename: "ALL.xlsx" }; } });
  let error: unknown;
  await controller.export({ user: { role: "admin", companyCode: "ACME", branchId: "B1" }, query: { branchId: "all" } } as any, { setHeader() {}, send() {} } as any, cause => { error = cause; });
  assert.equal(error, undefined);
  assert.deepEqual(requested, { companyCode: "ACME" });
  assert.deepEqual(exported, { includeProfit: true, branchCode: "ALL" });
});
