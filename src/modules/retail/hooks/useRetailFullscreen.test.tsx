// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useRetailFullscreen } from "./useRetailFullscreen";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("fills the viewport without native support and exits on Escape", async () => {
  const { result } = renderHook(useRetailFullscreen);
  await act(() => result.current.toggleFullscreen());
  expect(result.current.fullscreen).toBe(true);
  act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(result.current.fullscreen).toBe(false);
});

it("enters native fullscreen on the document and reacts to browser exit", async () => {
  let element: Element | null = null;
  const request = vi.fn(async () => { element = document.documentElement; });
  Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: request });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => element });
  try {
    const { result } = renderHook(useRetailFullscreen);
    await act(() => result.current.toggleFullscreen());
    expect(request).toHaveBeenCalledOnce();
    expect(result.current.fullscreen).toBe(true);
    act(() => { element = null; document.dispatchEvent(new Event("fullscreenchange")); });
    expect(result.current.fullscreen).toBe(false);
  } finally {
    delete (document.documentElement as any).requestFullscreen;
    delete (document as any).fullscreenElement;
  }
});

it("keeps viewport mode usable when the browser rejects fullscreen", async () => {
  Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: vi.fn().mockRejectedValue(new Error("Not supported")) });
  try {
    const { result } = renderHook(useRetailFullscreen);
    await act(() => result.current.toggleFullscreen());
    expect(result.current.fullscreen).toBe(true);
    await act(() => result.current.toggleFullscreen());
    expect(result.current.fullscreen).toBe(false);
  } finally { delete (document.documentElement as any).requestFullscreen; }
});
