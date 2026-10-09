// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductVariantSelectorModal } from "./ProductVariantSelectorModal";
import type { RetailProduct } from "../../types";

afterEach(cleanup);

const mockVariants: RetailProduct[] = [
  {
    _id: "v1",
    productId: "p-ip16",
    sku: "P1-0011",
    name: "iPhone 16",
    variantName: "128GB · Titan Đen · Like new · Quốc tế",
    category: "Điện thoại",
    unit: "cái",
    stock: 5,
    price: 18_040_000,
    optionValues: [
      { code: "STORAGE", value: "128GB" },
      { code: "COLOR", value: "Titan Đen" },
      { code: "CONDITION", value: "Like new" },
      { code: "ORIGIN", value: "Quốc tế" },
    ],
  },
  {
    _id: "v2",
    productId: "p-ip16",
    sku: "P1-2101",
    name: "iPhone 16",
    variantName: "512GB · Titan Trắng · Mới 100% · Quốc tế",
    category: "Điện thoại",
    unit: "cái",
    stock: 1,
    price: 30_490_000,
    optionValues: [
      { code: "STORAGE", value: "512GB" },
      { code: "COLOR", value: "Titan Trắng" },
      { code: "CONDITION", value: "Mới 100%" },
      { code: "ORIGIN", value: "Quốc tế" },
    ],
  },
  {
    _id: "v3",
    productId: "p-ip16",
    sku: "P1-2210",
    name: "iPhone 16",
    variantName: "512GB · Titan Sa mạc · Like new · VN/A",
    category: "Điện thoại",
    unit: "cái",
    stock: 2,
    price: 27_190_000,
    optionValues: [
      { code: "STORAGE", value: "512GB" },
      { code: "COLOR", value: "Titan Sa mạc" },
      { code: "CONDITION", value: "Like new" },
      { code: "ORIGIN", value: "VN/A" },
    ],
  },
  {
    _id: "v4",
    productId: "p-ip16",
    sku: "P1-2211",
    name: "iPhone 16",
    variantName: "512GB · Titan Sa mạc · Like new · Quốc tế",
    category: "Điện thoại",
    unit: "cái",
    stock: 0,
    price: 25_690_000,
    optionValues: [
      { code: "STORAGE", value: "512GB" },
      { code: "COLOR", value: "Titan Sa mạc" },
      { code: "CONDITION", value: "Like new" },
      { code: "ORIGIN", value: "Quốc tế" },
    ],
  },
];

const mockGroup = {
  key: "p-ip16",
  name: "iPhone 16",
  variants: mockVariants,
};

describe("ProductVariantSelectorModal", () => {
  it("renders attributes tab with options, color dots, price and adds to cart", async () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();

    render(
      <ProductVariantSelectorModal
        isOpen={true}
        onClose={onClose}
        group={mockGroup}
        onAdd={onAdd}
      />
    );

    // Modal Title
    expect(screen.getByText("iPhone 16")).toBeTruthy();

    // Attribute Groups
    expect(screen.getByText("Dung lượng")).toBeTruthy();
    expect(screen.getByText("Màu")).toBeTruthy();
    expect(screen.getByText("Tình trạng")).toBeTruthy();
    expect(screen.getByText("Phiên bản")).toBeTruthy();

    // Check options
    expect(screen.getByRole("button", { name: "128GB" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "512GB" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Titan Đen/ })).toBeTruthy();

    // Price and stock of initial selected variant (v1: 18.040.000đ, Còn 5 tại quầy)
    expect(screen.getByText("18.040.000đ")).toBeTruthy();
    expect(screen.getByText("Còn 5 tại quầy")).toBeTruthy();

    // Click "Thêm vào giỏ"
    await userEvent.click(screen.getByRole("button", { name: "Thêm vào giỏ" }));
    expect(onAdd).toHaveBeenCalledWith(mockVariants[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("switches to SKU list tab, filters by search query, and adds SKU directly", async () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();

    render(
      <ProductVariantSelectorModal
        isOpen={true}
        onClose={onClose}
        group={mockGroup}
        onAdd={onAdd}
      />
    );

    // Switch tab to "Danh sách SKU"
    await userEvent.click(screen.getByRole("button", { name: "Danh sách SKU" }));

    // Verify search input
    const searchInput = screen.getByPlaceholderText("Lọc: 256, đen, like new...");
    expect(searchInput).toBeTruthy();

    // Check SKU list items
    expect(screen.getByText(/P1-2101/)).toBeTruthy();
    expect(screen.getByText("30.490.000đ")).toBeTruthy();

    // Filter by "Trắng"
    await userEvent.type(searchInput, "Trắng");
    expect(screen.getByText(/Titan Trắng/)).toBeTruthy();
    expect(screen.queryByText(/Titan Sa mạc/)).toBeNull();

    // Click "Thêm" on filtered SKU
    await userEvent.click(screen.getByRole("button", { name: "Thêm" }));
    expect(onAdd).toHaveBeenCalledWith(mockVariants[1]);
    expect(onClose).toHaveBeenCalled();
  });

  it("distinguishes available, other-version and sold-out options and auto-switches on click", async () => {
    render(
      <ProductVariantSelectorModal isOpen={true} onClose={vi.fn()} group={mockGroup} onAdd={vi.fn()} />
    );
    // Top row (storage) is evaluated against the whole stock: 512GB is still sellable
    const storage512 = screen.getByRole("button", { name: "512GB" }) as HTMLButtonElement;
    expect(storage512.disabled).toBe(false);
    expect(storage512.className).not.toContain("line-through");

    // Titan Trắng only exists as 512GB -> shown as "other version" (dashed), not sold out
    const white = screen.getByRole("button", { name: "Titan Trắng" }) as HTMLButtonElement;
    expect(white.className).toContain("border-dashed");
    expect(white.title).toMatch(/Sẽ đổi/);

    // Clicking it switches storage automatically
    await userEvent.click(white);
    expect(screen.getByText("30.490.000đ")).toBeTruthy();
    expect(screen.getByRole("button", { name: "512GB" }).className).toContain("border-cyan-600");
  });
});
