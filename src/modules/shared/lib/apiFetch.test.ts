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
