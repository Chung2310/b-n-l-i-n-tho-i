// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SendTimeModal from "./SendTimeModal";

afterEach(cleanup);

describe("SendTimeModal", () => {
  it("renders with initial time and submits changed time", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <SendTimeModal
        initialTime="09:00"
        timeZone="Asia/Ho_Chi_Minh"
        canManage={true}
        onSave={onSave}
        onClose={onClose}
      />
    );

    expect(screen.getByText("Giờ quét & gửi hằng ngày")).toBeTruthy();
    expect(screen.getByText("08:00 - Đầu giờ sáng")).toBeTruthy();

    // Select preset 08:00
    fireEvent.click(screen.getByText("08:00 - Đầu giờ sáng"));

    // Submit
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận thay đổi" }));

    expect(onSave).toHaveBeenCalledWith("08:00");
    expect(onClose).toHaveBeenCalled();
  });
});
