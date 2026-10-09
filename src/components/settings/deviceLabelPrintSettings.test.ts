// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_DEVICE_LABEL_PRINT_SETTINGS,
  DEVICE_LABEL_PRINT_SETTINGS_KEY,
  loadDeviceLabelPrintSettings,
  saveDeviceLabelPrintSettings,
} from "./deviceLabelPrintSettings";

describe("device label print settings", () => {
  afterEach(() => window.localStorage.clear());

  it("uses a 100 by 30 mm row for two 50 by 30 mm labels as the default", () => {
    expect(loadDeviceLabelPrintSettings()).toEqual({ widthMm: 100, heightMm: 30, columns: 2, mediaType: "gap" });
    expect(DEFAULT_DEVICE_LABEL_PRINT_SETTINGS).toEqual({ widthMm: 100, heightMm: 30, columns: 2, mediaType: "gap" });
  });

  it("migrates the previous 50 by 30 mm two-column default to the full roll width", () => {
    window.localStorage.setItem(DEVICE_LABEL_PRINT_SETTINGS_KEY, JSON.stringify({ widthMm: 50, heightMm: 30, columns: 2, mediaType: "gap" }));
    expect(loadDeviceLabelPrintSettings()).toEqual({ widthMm: 100, heightMm: 30, columns: 2, mediaType: "gap" });
    expect(JSON.parse(window.localStorage.getItem(DEVICE_LABEL_PRINT_SETTINGS_KEY)!)).toEqual({ widthMm: 100, heightMm: 30, columns: 2, mediaType: "gap" });
  });

  it("persists a local label profile and falls back for invalid dimensions", () => {
    saveDeviceLabelPrintSettings({ widthMm: 40.26, heightMm: 25, columns: 3, mediaType: "black-mark" });
    expect(loadDeviceLabelPrintSettings()).toEqual({ widthMm: 40.3, heightMm: 25, columns: 3, mediaType: "black-mark" });

    window.localStorage.setItem(DEVICE_LABEL_PRINT_SETTINGS_KEY, JSON.stringify({ widthMm: 300, heightMm: 5, mediaType: "unknown" }));
    expect(loadDeviceLabelPrintSettings()).toEqual(DEFAULT_DEVICE_LABEL_PRINT_SETTINGS);
  });

  it("accepts up to six columns and falls back for an unsupported count", () => {
    saveDeviceLabelPrintSettings({ columns: 6 });
    expect(loadDeviceLabelPrintSettings().columns).toBe(6);

    window.localStorage.setItem(DEVICE_LABEL_PRINT_SETTINGS_KEY, JSON.stringify({ columns: 7 }));
    expect(loadDeviceLabelPrintSettings().columns).toBe(DEFAULT_DEVICE_LABEL_PRINT_SETTINGS.columns);
  });
});
