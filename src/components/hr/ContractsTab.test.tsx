// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import ContractsTab from "./ContractsTab";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("waits for the company before requesting contracts when opened directly", async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    data: { contracts: [], employees: [], expiryAlerts: [], total: 0 },
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const view = render(<ContractsTab canManage={false} companyCode="" />);
  expect(fetchMock).not.toHaveBeenCalled();
  view.rerender(<ContractsTab canManage={false} companyCode="IGENMOBILE" />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  for (const call of fetchMock.mock.calls as unknown as [string, ...unknown[]][]) {
    expect(new URL(call[0], "http://localhost").searchParams.get("companyCode")).toBe("IGENMOBILE");
  }
});
