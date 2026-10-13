import type { Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { getResolvedRetailSettings, updateRetailSettings } from "../services/retail-settings.service";
import { CompanyModel } from "../../../model/company.model";
import { BranchModel } from "../../../model/branch.model";
import { renderRetailInvoicePdf } from "../services/retail-invoice-pdf.service";
import type { RetailInvoicePaperSize } from "../interfaces/retail-settings.interface";
import type { IRetailInvoice } from "../interfaces/retail-invoice.interface";

function scope(req: Request) {
  return requireRetailBranch(retailScopeFromRequest((req as any).user || {}, {
    companyCode: req.query.companyCode,
    branchId: req.query.branchId,
  }));
}

export const retailSettingsController = {
  get: async (req: Request, res: Response) => res.json({ success: true, data: await getResolvedRetailSettings(scope(req)) }),
  printConfig: async (req: Request, res: Response) => {
    const retailScope = scope(req);
    const [settings, company] = await Promise.all([
      getResolvedRetailSettings(retailScope),
      CompanyModel.findOne({ code: retailScope.companyCode }).select("name").lean(),
    ]);
    return res.json({ success: true, data: { invoicePaperSize: settings.invoicePaperSize, invoiceTemplate: settings.invoiceTemplate, defaultTaxRate: settings.defaultTaxRate, storeName: String(company?.name || "") } });
  },
  printPreviewPdf: async (req: Request, res: Response) => {
    const retailScope = scope(req);
    const settings = await getResolvedRetailSettings(retailScope);
    const requestedPaperSize = String(req.query.paperSize || settings.invoicePaperSize);
    const paperSizes: RetailInvoicePaperSize[] = ["A4", "A5", "80mm", "58mm"];
    if (!paperSizes.includes(requestedPaperSize as RetailInvoicePaperSize)) {
      return res.status(400).json({ success: false, message: "Khổ giấy hóa đơn không hợp lệ." });
    }
    const [company, branch] = await Promise.all([
      CompanyModel.findOne({ code: retailScope.companyCode }).select("name").lean(),
      BranchModel.findOne({ _id: retailScope.branchId, companyCode: retailScope.companyCode }).select("code name address phone").lean(),
    ]);
    const issuedAt = new Date();
    const total = 13_300_000;
    const storeName = String(company?.name || retailScope.companyCode);
    const invoice: IRetailInvoice = {
      invoiceNo: `${settings.invoicePrefix || "HD"}-IN-THU`,
      orderId: "print-preview-order",
      orderCode: `${settings.orderPrefix || "DH"}-IN-THU`,
      companyCode: retailScope.companyCode,
      branchId: retailScope.branchId,
      issuedAt,
      issuedBy: String((req as any).user?.uid || "print-preview"),
      issuedByName: String((req as any).user?.displayName || ""),
      status: "issued",
      snapshot: {
        store: {
          legalName: storeName,
          storeName,
          branchCode: String(branch?.code || ""),
          branchName: String(branch?.name || ""),
          branchAddress: String(branch?.address || ""),
          branchPhone: String(branch?.phone || ""),
        },
        customerName: "Kh\u00e1ch h\u00e0ng in th\u1eed",
        cashierName: "Nh\u00e2n vi\u00ean b\u00e1n h\u00e0ng",
        salespersonName: "Nh\u00e2n vi\u00ean b\u00e1n h\u00e0ng",
        businessDate: issuedAt.toISOString().slice(0, 10),
        items: [
          { productId: "test-phone", sku: "SP-IN-THU-01", productName: "\u0110i\u1ec7n tho\u1ea1i m\u1eabu 128GB", unit: "c\u00e1i", quantity: 1, unitPrice: 12_900_000, discountAmount: 0, lineTotal: 12_900_000 },
          { productId: "test-case", sku: "SP-IN-THU-02", productName: "\u1ed0p l\u01b0ng m\u1eabu", unit: "c\u00e1i", quantity: 2, unitPrice: 250_000, discountAmount: 0, lineTotal: 500_000 },
        ],
        subtotal: 13_400_000,
        orderDiscount: 100_000,
        taxRate: 0,
        taxAmount: 0,
        shippingFee: 0,
        grandTotal: total,
        paidAmount: total,
        dueAmount: 0,
        paymentStatus: "paid",
        payments: [{ method: "cash", amount: total, tenderedAmount: 14_000_000, changeAmount: 700_000 }],
        amountInWords: "M\u01b0\u1eddi ba tri\u1ec7u ba tr\u0103m ngh\u00ecn \u0111\u1ed3ng",
      },
    };
    const { buffer } = await renderRetailInvoicePdf(invoice, requestedPaperSize as RetailInvoicePaperSize);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=hoa-don-mau.pdf");
    return res.send(buffer);
  },
  update: async (req: Request, res: Response) => res.json({ success: true, data: await updateRetailSettings(scope(req), req.body || {}) }),
};
