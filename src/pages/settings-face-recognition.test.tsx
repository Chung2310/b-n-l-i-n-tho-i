// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const authState = vi.hoisted(() => ({
  userProfile: null as unknown,
  uploadAvatar: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("../components/settings/ProfileTab", () => ({ default: () => <div>PROFILE_TAB</div> }));
vi.mock("../components/settings/SecurityTab", () => ({ default: () => <div /> }));
vi.mock("../components/settings/ErpConfigTab", () => ({ default: () => <div /> }));
vi.mock("../components/settings/FaceRecognitionSettingsTab", () => ({
  default: () => <div>FACE_TAB</div>,
}));

import SettingsTab from "./SettingsTab";

describe("SettingsTab face recognition navigation", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("does not show the tab button for admins", async () => {
    authState.userProfile = { role: "admin", permissions: [] };
    render(<SettingsTab />);
    expect(screen.queryByRole("button", { name: "Nhận diện khuôn mặt" })).toBeNull();
  });

  it("does not show the tab button for unauthorized users", () => {
    authState.userProfile = { role: "user", permissions: [] };
    render(<SettingsTab />);
    expect(screen.queryByRole("button", { name: "Nhận diện khuôn mặt" })).toBeNull();
  });

  it("deep link falls back to profile", async () => {
    authState.userProfile = { role: "admin", permissions: [] };
    window.history.replaceState(null, "", "/?sub=nhan-dien-khuon-mat");
    render(<SettingsTab />);
    expect(await screen.findByText("PROFILE_TAB")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("FACE_TAB")).toBeNull());
  });
});
