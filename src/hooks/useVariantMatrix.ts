import { useMemo } from 'react';

export interface Option {
  code: string;
  name: string;
  values: string[];
}

export interface GeneratedVariant {
  optionValues: { code: string; value: string }[];
  sku: string;
  price?: number; // Giá bán
  costPrice?: number; // Giá vốn
  barcode?: string;
  weightGrams?: number;
  mediaIds?: string[];
}

export function generateEAN13(): string {
  let code = "200"; // 200-299 is for internal use
  for (let i = 0; i < 9; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checksum = (10 - (sum % 10)) % 10;
  return code + checksum;
}

export function cleanOptionSlug(val: string): string {
  return val
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 10);
}

export function generateMatrixFromOptions(
  options: Option[],
  baseSku: string = "",
  existingMatrix: GeneratedVariant[] = []
): GeneratedVariant[] {
  if (!options || options.length === 0) return [];

  // Filter out options that have no values
  const validOptions = options.filter(opt => opt.values && opt.values.length > 0);
  if (validOptions.length === 0) return [];

  // Cartesian product algorithm
  const cartesian = (...a: any[][]) => a.reduce((acc, curr) => acc.flatMap(d => curr.map(e => [d, e].flat())));

  const optionValuesLists = validOptions.map(opt =>
    opt.values.map(val => ({ code: opt.code, value: val }))
  );

  const combinations: Array<Array<{ code: string; value: string }>> =
    optionValuesLists.length === 1
      ? optionValuesLists[0].map(v => [v])
      : cartesian(...optionValuesLists);

  // Map existing matrix items to preserve user changes (prices, images, barcodes, custom SKUs)
  const existingMap = new Map<string, GeneratedVariant>();
  for (const item of existingMatrix) {
    const key = (item.optionValues || [])
      .map(ov => `${ov.code}:${ov.value}`)
      .sort()
      .join("|");
    if (key) existingMap.set(key, item);
  }

  return combinations.map(combination => {
    const key = combination
      .map(c => `${c.code}:${c.value}`)
      .sort()
      .join("|");

    const existing = existingMap.get(key);
    if (existing) {
      return {
        ...existing,
        optionValues: combination,
      };
    }

    const skuSuffix = combination
      .map((c: any) => cleanOptionSlug(c.value))
      .join('-');

    const cleanBase = cleanOptionSlug(baseSku);
    const generatedSku = cleanBase ? `${cleanBase}-${skuSuffix}` : `SKU-${skuSuffix}`;

    return {
      optionValues: combination,
      sku: generatedSku,
      price: 0,
      costPrice: 0,
      barcode: generateEAN13(),
      weightGrams: 0,
      mediaIds: [],
    } as GeneratedVariant;
  });
}

export function useVariantMatrix(baseSku: string, options: Option[]) {
  return useMemo(() => generateMatrixFromOptions(options, baseSku), [baseSku, options]);
}

