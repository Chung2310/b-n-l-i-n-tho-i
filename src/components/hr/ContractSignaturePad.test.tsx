// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContractSignaturePad, SignatureZoomModal } from "./ContractSignaturePad";

const context = {
  fillStyle: "",
  strokeStyle: "",
  lineCap: "butt",
  lineJoin: "miter",
  lineWidth: 1,
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  closePath: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as any);
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 900,
    height: 300,
    right: 900,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
    callback(new Blob(["signature"], { type: "image/png" }));
  });
});

describe("ContractSignaturePad", () => {
  it("preserves the canvas and strokes when signing full screen and returning", () => {
    const onSave = vi.fn();
    const { unmount } = render(<ContractSignaturePad onSave={onSave} />);
    const canvas = screen.getByLabelText("Vùng ký điện tử");
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 20, clientY: 30 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    const resets = context.fillRect.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Ký toàn màn hình" }));
    expect(screen.getByRole("dialog", { name: "Ký toàn màn hình" }).contains(canvas)).toBe(true);
    expect(screen.getByLabelText("Vùng ký điện tử")).toBe(canvas);
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 40, clientY: 50 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 90, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Thu nhỏ vùng ký" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Vùng ký điện tử")).toBe(canvas);
    expect(context.fillRect).toHaveBeenCalledTimes(resets);
    fireEvent.click(screen.getByRole("button", { name: "Lưu chữ ký vào hợp đồng" }));
    expect(onSave).toHaveBeenCalledOnce();
    unmount();
  });

  it("keeps the signing board open and saves pointer strokes as a PNG", async () => {
    const onSave = vi.fn();
    render(<ContractSignaturePad onSave={onSave} />);

    const canvas = screen.getByLabelText("Vùng ký điện tử");
    expect(canvas).toBeTruthy();
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 20, clientY: 30 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 80, clientY: 70 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 80, clientY: 70 });
    fireEvent.click(screen.getByRole("button", { name: "Lưu chữ ký vào hợp đồng" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const file = onSave.mock.calls[0][0] as File;
    expect(file.type).toBe("image/png");
    expect(file.name).toMatch(/^chu-ky-\d+\.png$/);
  });

  it("opens the signature in a full-screen zoom viewer without download links", () => {
    const { container } = render(
      <SignatureZoomModal url="https://example.com/signature.png" onClose={vi.fn()} />
    );

    expect(screen.getByRole("dialog", { name: "Xem toàn màn hình chữ ký điện tử" })).toBeTruthy();
    expect(container.querySelector("a")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Phóng to chữ ký" }));
    expect(screen.getByAltText("Chữ ký điện tử").getAttribute("style")).toContain("scale(1.25)");
  });
});
