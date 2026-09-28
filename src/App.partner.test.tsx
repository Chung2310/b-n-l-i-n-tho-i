// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: { uid: "partner-1" },
  userProfile: { uid: "partner-1", displayName: "Đại lý An", accountType: "partner", role: "user", permissions: ["partner-self:read"] } as any,
  loading: false,
  logout: vi.fn(),
}));
vi.mock("./context/AuthContext", () => ({ AuthProvider: ({ children }: any) => children, useAuth: () => auth }));
vi.mock("./context/BranchContext", () => ({ BranchProvider: () => { throw new Error("Partner must not initialize internal branches"); } }));
vi.mock("./context/ChatUnreadContext", () => ({ ChatUnreadProvider: () => { throw new Error("Partner must not initialize internal chat"); }, useChatUnread: vi.fn() }));
vi.mock("./modules/partners/PartnersPage", () => ({ default: ({ portalOnly }: any) => <div>{portalOnly ? "Thông tin đối tác của tôi" : "Quản lý nội bộ"}</div> }));
vi.mock("./seo/SEOHead", () => ({ SEOHead: () => null }));
vi.mock("./pages/Toast", () => ({ ToastContainer: () => null, toast: { error: vi.fn() } }));
import App from "./App";
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

it("renders a separate portal on an internal URL, without initializing the ERP shell", async () => {
  window.history.replaceState(null, "", "/nhan-su");
  render(<App />);
  expect(await screen.findByText("Thông tin đối tác của tôi")).toBeTruthy();
  await waitFor(() => expect(window.location.pathname).toBe("/doi-tac"));
  expect(document.getElementById("app_root_layout")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  expect(auth.logout).toHaveBeenCalledOnce();
});

it("routes older self-service accounts to the same separate portal", async () => {
  auth.userProfile = { uid: "old-partner", role: "user", permissions: ["partner-self:read"] };
  render(<App />);
  expect(await screen.findByText("Thông tin đối tác của tôi")).toBeTruthy();
});
