import { runInTransaction } from "../../config/database";
import { SupplierModel } from "../../model/supplier.model";
import { PartnerModel } from "./partner.models";
import { invalid } from "./commission-calculation";

export function supplierPartnerProfile(partner: any, supplier?: any) {
  if (!supplier) return partner;
  return {
    ...partner,
    supplierCode: supplier.code,
    name: supplier.name,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    taxCode: supplier.taxCode,
    paymentTerms: supplier.paymentTerms,
    notes: supplier.notes,
    status: supplier.status,
  };
}

// Both screens use the existing Supplier ID, preserving receipt and debt links.
export async function saveSupplierPartner(input: any, details: any, partnerId?: string) {
  return runInTransaction(async (session) => {
    const scope = { companyCode: input.companyCode };
    const partner = partnerId
      ? await PartnerModel.findOne({ ...scope, _id: partnerId }).session(session || null)
      : new PartnerModel({ ...input, createdBy: input.updatedBy });
    if (!partner) throw invalid("Không tìm thấy đối tác.", 404);
    const supplierId = partner.supplierId || input.supplierId;
    const supplier = supplierId
      ? await SupplierModel.findOne({ ...scope, _id: supplierId }).session(session || null)
      : new SupplierModel({ ...scope, code: input.code, createdBy: input.updatedBy });
    if (!supplier) throw invalid("Không tìm thấy nhà cung cấp.", 404);
    const isNewSupplier = supplier.isNew;
    const previousSupplier = supplier.toObject();
    for (const field of ["name", "phone", "email", "address", "status", "updatedBy"] as const) {
      supplier.set(field, input[field]);
    }
    for (const [field, maxLength] of [["taxCode", 100], ["paymentTerms", 2000], ["notes", 5000]] as const) {
      if (details[field] !== undefined) {
        const value = String(details[field] ?? "").trim();
        if (value.length > maxLength) throw invalid(`Thông tin ${field} quá dài.`);
        supplier.set(field, value);
      }
    }
    partner.set({ ...input, supplierId: String(supplier._id) });
    await supplier.validate();
    await partner.validate();
    await supplier.save({ session });
    try {
      await partner.save({ session });
    } catch (error) {
      // Standalone MongoDB has no transactions; undo the supplier write on failure.
      if (!session) {
        if (isNewSupplier) await SupplierModel.deleteOne({ ...scope, _id: supplier._id });
        else await SupplierModel.replaceOne({ ...scope, _id: supplier._id }, previousSupplier);
      }
      throw error;
    }
    return supplierPartnerProfile(partner.toObject(), supplier.toObject());
  });
}
