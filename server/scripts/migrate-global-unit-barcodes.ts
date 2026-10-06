import "dotenv/config";
import mongoose from "mongoose";
import { GoodsReceiptModel } from "../model/goods-receipt.model";
import { SerialUnitModel } from "../modules/inventory/serials/serial-unit.model";
import { ensureInternalBarcodeCounterAtLeast, allocateInternalBarcodes } from "../modules/inventory/serials/unit-barcode-allocator";

const apply = process.argv.includes("--apply");
const norm = (value: unknown) => String(value || "").trim().toUpperCase();
const composite = (companyCode: unknown, barcode: unknown) => `${norm(companyCode)}\u0000${norm(barcode)}`;
type SerialUnitRecord = { _id: unknown; companyCode: string; internalBarcode: string; sku: string; normalizedInternalBarcode?: string; normalizedSerialNumber?: string; serialNumber?: string; createdAt?: Date | string; barcodeAliases?: string[]; normalizedBarcodeAliases?: string[]; imei1?: string; imei2?: string };
type ReceiptUnitDetail = { internalBarcode?: string; barcodeAliases?: string[]; serialNumber?: string; imei1?: string; imei2?: string };
type ReceiptLine = { unitDetails?: ReceiptUnitDetail[]; [key: string]: unknown };
type ReceiptRecord = { _id: unknown; companyCode: string; items?: ReceiptLine[] };

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://mongodb/igen-erp";
  await mongoose.connect(uri, { autoIndex: false });
  try {
    const units = await SerialUnitModel.find({}).sort({ createdAt: 1, _id: 1 }).lean() as unknown as SerialUnitRecord[];
    const receipts = await GoodsReceiptModel.find({ "items.unitDetails": { $exists: true } }).select("companyCode items").lean() as unknown as ReceiptRecord[];
    const byCompanyBarcode = new Map<string, SerialUnitRecord[]>();
    const knownCodes = new Set<string>();
    let maxIssued = 0;
    for (const unit of units) {
      const code = norm(unit.normalizedInternalBarcode || unit.internalBarcode);
      knownCodes.add(code);
      const seq = /^DVU(\d+)$/.exec(code);
      if (seq) maxIssued = Math.max(maxIssued, Number(seq[1]));
      for (const alias of [...(unit.barcodeAliases || []), ...(unit.normalizedBarcodeAliases || [])]) {
        const normalizedAlias = norm(alias);
        knownCodes.add(normalizedAlias);
        const aliasSequence = /^DVU(\d+)$/.exec(normalizedAlias);
        if (aliasSequence) maxIssued = Math.max(maxIssued, Number(aliasSequence[1]));
      }
      const key = composite(unit.companyCode, code);
      byCompanyBarcode.set(key, [...(byCompanyBarcode.get(key) || []), unit]);
    }
    const scopedCollisions = [...byCompanyBarcode.entries()].filter(([, group]) => group.length > 1);
    if (scopedCollisions.length) {
      throw new Error(`Có ${scopedCollisions.length} nhóm barcode trùng trong cùng công ty. Cần xử lý thủ công trước khi chạy migration toàn cục.`);
    }
    const globalGroups = new Map<string, SerialUnitRecord[]>();
    for (const unit of units) {
      const code = norm(unit.normalizedInternalBarcode || unit.internalBarcode);
      globalGroups.set(code, [...(globalGroups.get(code) || []), unit]);
    }
    const globalCollisions = [...globalGroups.entries()].filter(([, group]) => group.length > 1);
    const byCompanySerial = new Map<string, SerialUnitRecord[]>();
    for (const unit of units) {
      const serial = norm(unit.normalizedSerialNumber || unit.serialNumber);
      if (!serial) continue;
      const key = composite(unit.companyCode, serial);
      byCompanySerial.set(key, [...(byCompanySerial.get(key) || []), unit]);
    }
    const receiptImeis = new Map<string, { imei1?: string; imei2?: string }>();
    let unresolvedReceiptUnits = 0;
    for (const receipt of receipts) {
      for (const item of receipt.items || []) {
        for (const detail of item.unitDetails || []) {
          const code = norm(detail.internalBarcode);
          const serial = norm(detail.serialNumber);
          const candidates = new Map<string, SerialUnitRecord>();
          for (const unit of (code ? byCompanyBarcode.get(composite(receipt.companyCode, code)) : []) || []) candidates.set(String(unit._id), unit);
          for (const unit of (serial ? byCompanySerial.get(composite(receipt.companyCode, serial)) : []) || []) candidates.set(String(unit._id), unit);
          const matches = [...candidates.values()];
          if (matches.length !== 1) { unresolvedReceiptUnits += 1; continue; }
          const unit = matches[0];
          const prior = receiptImeis.get(String(unit._id)) || {};
          const next = { imei1: prior.imei1 || norm(detail.imei1) || undefined, imei2: prior.imei2 || norm(detail.imei2) || undefined };
          if ((prior.imei1 && detail.imei2 && prior.imei1 !== norm(detail.imei2)) || (prior.imei2 && detail.imei1 && prior.imei2 !== norm(detail.imei1))) {
            throw new Error(`IMEI 1/2 không nhất quán ở thiết bị ${unit.sku}, barcode ${code || unit.internalBarcode}.`);
          }
          receiptImeis.set(String(unit._id), next);
        }
      }
    }

    const imeiOwner = new Map<string, string>();
    for (const unit of units) {
      const metadata = receiptImeis.get(String(unit._id)) || {};
      for (const imei of [unit.imei1, unit.imei2, metadata.imei1, metadata.imei2].map(norm).filter(Boolean)) {
        const previousOwner = imeiOwner.get(imei);
        if (previousOwner && previousOwner !== String(unit._id)) throw new Error(`IMEI ${imei} đang thuộc nhiều thiết bị (${previousOwner}, ${unit._id}); cần xử lý trùng trước khi chạy migration.`);
        imeiOwner.set(imei, String(unit._id));
      }
    }
    console.log(`Serial unit: ${units.length}; barcode trùng giữa công ty: ${globalCollisions.length} nhóm; IMEI tìm thấy từ phiếu cũ: ${imeiOwner.size}; chi tiết phiếu chưa ánh xạ được: ${unresolvedReceiptUnits}.`);
    if (!apply) {
      console.log("Dry-run chỉ đọc dữ liệu, chưa thay đổi dữ liệu hay bộ đếm. Đọc kết quả rồi chạy lại với --apply để áp dụng.");
      return;
    }
    await ensureInternalBarcodeCounterAtLeast(maxIssued);

    const updates: Array<{ unit: SerialUnitRecord; internalBarcode: string; normalizedInternalBarcode: string; aliases: string[]; imei1?: string; imei2?: string }> = [];
    const receiptBarcodeRewrites = new Map<string, string>();
    for (const [oldCode, group] of globalGroups) {
      const sorted = [...group].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || String(a._id).localeCompare(String(b._id)));
      for (let index = 0; index < sorted.length; index += 1) {
        const unit = sorted[index];
        let internalBarcode = String(unit.internalBarcode || oldCode).trim();
        let normalizedInternalBarcode = oldCode;
        let aliases = [...new Set([...(unit.barcodeAliases || []), ...(unit.normalizedBarcodeAliases || [])])];
        if (index > 0) {
          do {
            internalBarcode = (await allocateInternalBarcodes(1))[0];
            normalizedInternalBarcode = norm(internalBarcode);
          } while (knownCodes.has(normalizedInternalBarcode));
          knownCodes.add(normalizedInternalBarcode);
          aliases = [...new Set([...aliases, String(unit.internalBarcode || oldCode), oldCode])];
          receiptBarcodeRewrites.set(composite(unit.companyCode, oldCode), normalizedInternalBarcode);
        }
        const metadata = receiptImeis.get(String(unit._id)) || {};
        updates.push({ unit, internalBarcode, normalizedInternalBarcode, aliases, imei1: unit.imei1 || metadata.imei1, imei2: unit.imei2 || metadata.imei2 });
      }
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const update of updates) {
          const normalizedImeis = [update.imei1, update.imei2].map(norm).filter(Boolean);
          await SerialUnitModel.updateOne(
            { _id: update.unit._id, companyCode: update.unit.companyCode },
            { $set: {
              internalBarcode: update.internalBarcode,
              normalizedInternalBarcode: update.normalizedInternalBarcode,
              globalBarcodeKey: update.normalizedInternalBarcode,
              ...(update.aliases.length ? { barcodeAliases: update.aliases, normalizedBarcodeAliases: update.aliases.map(norm) } : {}),
              ...(update.imei1 ? { imei1: update.imei1 } : {}),
              ...(update.imei2 ? { imei2: update.imei2 } : {}),
              ...(normalizedImeis.length ? { normalizedImeis: [...new Set(normalizedImeis)] } : {}),
            } },
            { session },
          );
        }
        for (const receipt of receipts) {
          let changed = false;
        const items = (receipt.items || []).map((item) => ({
          ...item,
          unitDetails: (item.unitDetails || []).map((detail) => {
              const replacement = receiptBarcodeRewrites.get(composite(receipt.companyCode, detail.internalBarcode));
              if (!replacement) return detail;
              changed = true;
              return { ...detail, internalBarcode: replacement, barcodeAliases: [...new Set([...(detail.barcodeAliases || []), norm(detail.internalBarcode)])] };
            }),
          }));
          if (changed) await GoodsReceiptModel.updateOne({ _id: receipt._id, companyCode: receipt.companyCode }, { $set: { items } }, { session });
        }
      });
    } finally {
      await session.endSession();
    }

    await SerialUnitModel.collection.createIndex({ globalBarcodeKey: 1 }, { name: "unique_global_unit_barcode", unique: true, partialFilterExpression: { globalBarcodeKey: { $type: "string" } } });
    await SerialUnitModel.collection.createIndex({ companyCode: 1, normalizedImeis: 1 }, { name: "unique_company_unit_imei", unique: true, partialFilterExpression: { normalizedImeis: { $type: "array" } } });
    console.log("Migration hoàn tất. Mã cũ bị trùng đã được giữ làm alias để tiếp tục tra cứu.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Migration barcode thiết bị thất bại:", error);
  process.exit(1);
});
