// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { handleInternalNavigation } from "./internalNavigation";

describe("handleInternalNavigation", () => {
  it("renders an internal route without reloading the document", () => {
    const onPopState = vi.fn();
    window.addEventListener("popstate", onPopState);
    const preventDefault = vi.fn();

    handleInternalNavigation({
      button: 0,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault,
    }, "/privacy-policy");

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/privacy-policy");
    expect(onPopState).toHaveBeenCalledOnce();
    window.removeEventListener("popstate", onPopState);
  });

  it("preserves native navigation for modified clicks", () => {
    const preventDefault = vi.fn();
    handleInternalNavigation({
      button: 0,
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault,
    }, "/terms-of-service");

    expect(preventDefault).not.toHaveBeenCalled();
  });
});
