// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const { printDeviceBarcodeLabelsMock } = vi.hoisted(() => ({
  printDeviceBarcodeLabelsMock: vi.fn(),
}));

vi.mock("../inventory/receiving/printDeviceBarcodeLabels", () => ({
  printDeviceBarcodeLabels: printDeviceBarcodeLabelsMock,
}));

import DeviceLabelPrintSettingsTab from "./DeviceLabelPrintSettingsTab";

describe("DeviceLabelPrintSettingsTab", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("keeps custom dimensions collapsed until requested", () => {
    render(<DeviceLabelPrintSettingsTab />);

    expect(screen.queryByLabelText("Chiều ngang toàn cuộn giấy (mm)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tùy chỉnh khổ giấy" }));
    expect(screen.getByLabelText("Chiều ngang toàn cuộn giấy (mm)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ẩn tùy chỉnh" }));
    expect(screen.queryByLabelText("Chiều ngang toàn cuộn giấy (mm)")).toBeNull();
  });

  it("prints one duplicate sample barcode for each selected column", () => {
    render(<DeviceLabelPrintSettingsTab />);

    fireEvent.click(screen.getByRole("button", { name: "3 tem" }));
    fireEvent.click(screen.getByRole("button", { name: "In thử 3 tem" }));

    expect(printDeviceBarcodeLabelsMock).toHaveBeenCalledOnce();
    const labels = printDeviceBarcodeLabelsMock.mock.calls[0][0] as Array<{ internalBarcode: string }>;
    expect(labels).toHaveLength(3);
    expect(new Set(labels.map((label) => label.internalBarcode))).toEqual(new Set(["TEST-DVU000001"]));
  });
});
