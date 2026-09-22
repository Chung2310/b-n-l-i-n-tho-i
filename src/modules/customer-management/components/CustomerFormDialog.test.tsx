// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomerFormDialog from "./CustomerFormDialog";

vi.mock("../customerApi", () => ({
  customerApi: {
    uploadAvatar: vi.fn().mockResolvedValue("https://example.com/avatar.png"),
  },
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("CustomerFormDialog", () => {
  it("renders all form fields with consistent styling and customer type dropdown", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(<CustomerFormDialog onClose={onClose} onSave={onSave} />);

    // Basic inputs exist
    expect(screen.getByPlaceholderText("Nhập họ và tên khách hàng (VD: Nguyễn Văn A)...")).toBeTruthy();
    expect(screen.getByPlaceholderText("Nhập số điện thoại liên hệ (VD: 0912 345 678)...")).toBeTruthy();
    expect(screen.getByPlaceholderText("Nhập địa chỉ email (VD: an@example.com)...")).toBeTruthy();
    expect(screen.getByPlaceholderText("Nhập địa chỉ nhận hàng / cư trú...")).toBeTruthy();

    // Customer type dropdown is rendered and synchronized
    const typeDropdownButton = screen.getByRole("button", { name: /Khách thường/ });
    expect(typeDropdownButton).toBeTruthy();
    expect(typeDropdownButton.className).toContain("w-full");
    expect(typeDropdownButton.className).toContain("h-[38px]");

    // Click dropdown to view options
    fireEvent.click(typeDropdownButton);
    const vatOptions = screen.getAllByRole("option", { name: "Khách xuất VAT" });
    expect(vatOptions.length).toBeGreaterThanOrEqual(1);

    // Select VAT from custom option button
    const vatButtonOption = vatOptions.find((el) => el.tagName === "BUTTON") || vatOptions[0];
    fireEvent.click(vatButtonOption);
    expect(screen.getByRole("button", { name: /Khách xuất VAT/ })).toBeTruthy();
  });
});
