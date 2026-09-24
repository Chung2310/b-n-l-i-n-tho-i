// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ScanResultModal from "./ScanResultModal";

afterEach(cleanup);

describe("ScanResultModal", () => {
  it("renders scan statistics and closes on button click", () => {
    const onClose = vi.fn();

    render(
      <ScanResultModal
        typeLabel="Chúc mừng sinh nhật"
        stats={{ eligible: 12, queued: 10, skipped: 2, failed: 0 }}
        onClose={onClose}
      />
    );

    expect(screen.getByText("Kết quả quét tự động")).toBeTruthy();
    expect(screen.getByText("Chúc mừng sinh nhật")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Đã hiểu" }));
    expect(onClose).toHaveBeenCalled();
  });
});
