// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { apiFetch, setAccessToken } from "./apiFetch";
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
it("sends the logged-in token and encoded scope to the shared API", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher); setAccessToken("test-token");
  await expect(apiFetch("/partners", { params: { companyCode: "ACME", empty: undefined } })).resolves.toEqual({ success: true, data: [] });
  expect(new URL(fetcher.mock.calls[0][0]).search).toBe("?companyCode=ACME");
  expect(fetcher.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer test-token");
});

it("does not refresh or replay a scoped request after a session changes", async () => {
  const fetcher = vi.fn().mockImplementation(async () => {
    setAccessToken("new-session");
    return new Response(JSON.stringify({ message: "Expired" }), { status: 401 });
  });
  vi.stubGlobal("fetch", fetcher); setAccessToken("old-session");
  await expect(apiFetch("/inventory/counts/c/items/i", { method: "PATCH", refreshSession: false })).rejects.toMatchObject({ status: 401 });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem("accessToken")).toBe("new-session");
  expect(fetcher.mock.calls[0][1]).not.toHaveProperty("refreshSession");
});
