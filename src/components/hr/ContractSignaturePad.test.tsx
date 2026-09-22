// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContractSignaturePad, SignatureZoomModal } from "./ContractSignaturePad";

afterEach(cleanup);

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
  it("opens from the single board and closes only after a successful save", async () => {
    let finish!: (saved: boolean) => void;
    const onSave = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    render(<ContractSignaturePad onSave={onSave} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mở ô chữ ký" }));
    const canvas = screen.getByLabelText("Vùng ký điện tử");
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 20, clientY: 30 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Lưu chữ ký" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    finish(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Mở ô chữ ký" })).toBeTruthy();
  });

  it("keeps failed saves open, clears strokes and closes with X", async () => {
    render(<ContractSignaturePad onSave={async () => false} />);
    fireEvent.click(screen.getByRole("button", { name: "Mở ô chữ ký" }));
    const canvas = screen.getByLabelText("Vùng ký điện tử");
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 20, clientY: 30 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Lưu chữ ký" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xóa chữ ký" }));
    expect((screen.getByRole("button", { name: "Lưu chữ ký" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Đóng màn hình ký" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the saved signature in the same board", () => {
    render(<ContractSignaturePad value="https://example.com/signature.png" onSave={async () => true} />);
    const board = screen.getByRole("button", { name: "Mở ô chữ ký" });
    expect(board.querySelector("img")?.getAttribute("src")).toBe("https://example.com/signature.png");
    expect(screen.queryByRole("button", { name: "Ký toàn màn hình" })).toBeNull();
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
