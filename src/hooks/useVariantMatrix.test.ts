import { describe, it, expect } from "vitest";
import {
  generateMatrixFromOptions,
  cleanOptionSlug,
  generateEAN13,
  type Option,
} from "./useVariantMatrix";

describe("useVariantMatrix", () => {
  it("cleanOptionSlug normalizes vietnamese and special chars", () => {
    expect(cleanOptionSlug("Màu Xanh Đậm")).toBe("MAU-XANH-D");
    expect(cleanOptionSlug("128 GB")).toBe("128-GB");
    expect(cleanOptionSlug("Mới 99%")).toBe("MOI-99");
  });

  it("generateEAN13 creates a 13-digit valid EAN barcode", () => {
    const ean = generateEAN13();
    expect(ean).toHaveLength(13);
    expect(ean.startsWith("20")).toBe(true);
  });

  it("generateMatrixFromOptions returns empty array if no options or values", () => {
    expect(generateMatrixFromOptions([])).toEqual([]);
    expect(generateMatrixFromOptions([{ code: "COLOR", name: "Màu", values: [] }])).toEqual([]);
  });

  it("generates correct Cartesian combinations for multiple options", () => {
    const options: Option[] = [
      { code: "COLOR", name: "Màu sắc", values: ["Đen", "Trắng"] },
      { code: "STORAGE", name: "Dung lượng", values: ["128GB", "256GB"] },
    ];
    const matrix = generateMatrixFromOptions(options, "IP15");
    expect(matrix).toHaveLength(4);
    expect(matrix[0].sku).toBe("IP15-DEN-128GB");
    expect(matrix[1].sku).toBe("IP15-DEN-256GB");
    expect(matrix[2].sku).toBe("IP15-TRANG-128GB");
    expect(matrix[3].sku).toBe("IP15-TRANG-256GB");
    expect(matrix[0].barcode).toHaveLength(13);
  });

  it("preserves custom price, barcode, image and sku when options update", () => {
    const initialOptions: Option[] = [
      { code: "COLOR", name: "Màu sắc", values: ["Đen"] },
      { code: "STORAGE", name: "Dung lượng", values: ["128GB"] },
    ];
    const initialMatrix = generateMatrixFromOptions(initialOptions, "IP15");
    expect(initialMatrix).toHaveLength(1);

    // User customizes price and image
    initialMatrix[0].price = 20_000_000;
    initialMatrix[0].mediaIds = ["https://example.com/black.png"];
    const customBarcode = initialMatrix[0].barcode;

    // User adds another storage: 256GB
    const updatedOptions: Option[] = [
      { code: "COLOR", name: "Màu sắc", values: ["Đen"] },
      { code: "STORAGE", name: "Dung lượng", values: ["128GB", "256GB"] },
    ];
    const updatedMatrix = generateMatrixFromOptions(updatedOptions, "IP15", initialMatrix);
    expect(updatedMatrix).toHaveLength(2);

    // Đen 128GB must retain the custom values!
    const black128 = updatedMatrix.find((v) =>
      v.optionValues.some((o) => o.value === "Đen") && v.optionValues.some((o) => o.value === "128GB")
    );
    expect(black128).toBeDefined();
    expect(black128?.price).toBe(20_000_000);
    expect(black128?.mediaIds).toEqual(["https://example.com/black.png"]);
    expect(black128?.barcode).toBe(customBarcode);

    // New combination Đen 256GB has defaults
    const black256 = updatedMatrix.find((v) =>
      v.optionValues.some((o) => o.value === "Đen") && v.optionValues.some((o) => o.value === "256GB")
    );
    expect(black256).toBeDefined();
    expect(black256?.price).toBe(0);
    expect(black256?.sku).toBe("IP15-DEN-256GB");
  });
});
