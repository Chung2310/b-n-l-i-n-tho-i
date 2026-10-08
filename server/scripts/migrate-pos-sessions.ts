import "dotenv/config";
import mongoose from "mongoose";
import { CashierShiftModel } from "../modules/retail/models/cashier-shift.model";
import { RetailPosDrawerModel } from "../modules/retail/models/retail-pos-drawer.model";
import { RetailPosSessionSnapshotModel } from "../modules/retail/models/retail-pos-session-snapshot.model";
import { posSessionOperationalEndsAt } from "../modules/retail/services/cashier-shift.service";
import { RolePermissionModel } from "../model/role-permission.model";

// npm run migrate:pos-sessions           -> report only
// npm run migrate:pos-sessions -- --apply -> assign legacy drawers/deadlines
// Closed sessions are never rebuilt into a fictitious historical snapshot.
const apply = process.argv.includes("--apply");
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is required.");
await mongoose.connect(uri, {
  autoIndex: false,
  ...(process.env.MONGODB_USER ? { user: process.env.MONGODB_USER, pass: process.env.MONGODB_PASSWORD, authSource: process.env.MONGODB_AUTH_SOURCE || "admin" } : {}),
});
try {
  const duplicates = await CashierShiftModel.aggregate([
    { $match: { status: "open" } },
    { $group: { _id: { companyCode: "$companyCode", branchId: "$branchId", cashierId: "$cashierId" }, ids: { $push: "$_id" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  const open = await CashierShiftModel.find({ status: "open" }).lean();
  const legacyClosed = await CashierShiftModel.countDocuments({ status: { $in: ["closed", "reconciled"] }, closingSnapshot: { $exists: false } });
  const configuredManagersWithoutAccess = await RolePermissionModel.find({ role: "manager", permissions: { $nin: ["*", "retail:manage"] } }).select("companyCode role").lean();
  const invalidBusinessDates = open.filter((shift) => !/^\d{4}-\d{2}-\d{2}$/.test(shift.businessDate || "") || !Number.isFinite(posSessionOperationalEndsAt(shift.businessDate).getTime())).map((shift) => String(shift._id));
  const deadlineChanges = open.filter((shift) => !invalidBusinessDates.includes(String(shift._id)) && new Date(shift.operationalEndsAt || 0).getTime() !== posSessionOperationalEndsAt(shift.businessDate).getTime()).map((shift) => ({ id: String(shift._id), previous: shift.operationalEndsAt, next: posSessionOperationalEndsAt(shift.businessDate) }));
  console.log(JSON.stringify({ mode: apply ? "apply" : "report", open: open.length, missingDrawers: open.filter((shift) => !shift.drawerId).length, missingDeadlines: open.filter((shift) => !shift.operationalEndsAt).length, deadlineChanges, legacyClosedWithoutSnapshot: legacyClosed, duplicateOpenCashiers: duplicates, invalidBusinessDates, configuredManagersWithoutAccess }, null, 2));
  if (duplicates.length) throw new Error("Resolve duplicate open cashiers before applying the migration.");
  if (invalidBusinessDates.length) throw new Error("Resolve invalid session business dates before applying the migration.");
  if (apply) {
    await RetailPosDrawerModel.createIndexes();
    await RetailPosSessionSnapshotModel.createIndexes();
    for (const shift of open) {
      const values: Record<string, unknown> = {};
      const deadline = posSessionOperationalEndsAt(shift.businessDate);
      if (new Date(shift.operationalEndsAt || 0).getTime() !== deadline.getTime()) values.operationalEndsAt = deadline;
      if (!shift.drawerId) {
        const code = `LEGACY-${String(shift._id)}`;
        const drawer = await RetailPosDrawerModel.findOneAndUpdate({ companyCode: shift.companyCode, branchId: shift.branchId, code },
          { $setOnInsert: { name: `Két phiên cũ · ${shift.cashierName}`, isActive: true } }, { upsert: true, returnDocument: "after" });
        values.drawerId = String(drawer!._id); values.drawerName = drawer!.name;
      }
      if (Object.keys(values).length) await CashierShiftModel.updateOne({ _id: shift._id, status: "open" }, { $set: values, $push: { auditLog: { action: "migration", at: new Date(), by: "system:pos-migration", byName: "Hệ thống", detail: "Bổ sung dữ liệu phiên cũ; giữ nguyên số liệu tiền." } } });
    }
    await CashierShiftModel.createIndexes();
    console.log("POS session migration completed.");
  }
} finally { await mongoose.disconnect(); }
