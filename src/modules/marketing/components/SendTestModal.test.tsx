// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SendTestModal from "./SendTestModal";

afterEach(cleanup);

describe("SendTestModal", () => {
  it("renders and calls onSend with entered recipient", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <SendTestModal
        automationType="thank_you"
        title="Cảm ơn sau khi xuất hoá đơn"
        onSend={onSend}
        onClose={onClose}
      />
    );

    expect(screen.getByText("Gửi tin thử nghiệm")).toBeTruthy();

    const input = screen.getByPlaceholderText("VD: test@example.com hoặc 0912345678");
    fireEvent.change(input, { target: { value: "test@demo.vn" } });

    fireEvent.click(screen.getByRole("button", { name: "Gửi ngay" }));

    expect(onSend).toHaveBeenCalledWith("test@demo.vn");
  });
});
