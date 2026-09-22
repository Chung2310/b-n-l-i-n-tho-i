import { expect, test, vi } from "vitest";
import { createLandingLifetime } from "./lifetime";

test("releases listeners, observers and animations once when the landing unmounts", () => {
  const life = createLandingLifetime();
  const target = new EventTarget();
  const listener = vi.fn();
  const disconnect = vi.fn();
  const cancelAnimation = vi.fn();
  life.on(target, "scroll", listener);
  life.observe({ disconnect });
  life.add(cancelAnimation);
  target.dispatchEvent(new Event("scroll"));
  expect(listener).toHaveBeenCalledTimes(1);
  life.dispose();
  life.dispose();
  target.dispatchEvent(new Event("scroll"));
  expect(listener).toHaveBeenCalledTimes(1);
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(cancelAnimation).toHaveBeenCalledTimes(1);
  expect(life.disposed).toBe(true);
});
