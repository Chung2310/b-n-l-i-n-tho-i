// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiClientError } from "../../services/apiClientError";
import { BestSellingProductsCard, buildProductSegments } from "./BestSellingProductsCard";
const mocks = vi.hoisted(() => ({ summary: vi.fn(), scope: { companyCode: "C1", branchId: "B1" } }));
vi.mock("../../services/dashboardService", () => ({ dashboardService: { getBestSellingProducts: mocks.summary } }));
vi.mock("../../modules/retail/hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: mocks.scope }) }));
const product = (i: number, netSales: number) => ({ productId: String(i), sku: "SKU" + i, productName: "Product " + i, netSales, netQuantity: 1 });
beforeEach(() => { mocks.summary.mockReset(); mocks.scope.branchId = "B1"; });
afterEach(cleanup);
it("groups top five by revenue and retains the remainder without mutating data", () => {
 const products = [product(1, 10), product(2, 60), product(3, 50), product(4, 40), product(5, 30), product(6, 20), product(7, 0), product(8, -5)];
 const segments = buildProductSegments(products);
 expect(segments).toHaveLength(6);
 expect(segments[0].label).toContain("Product 2");
 expect(segments[5].label).toBe("Khác");
 expect(segments.reduce((sum, s) => sum + s.value, 0)).toBeCloseTo(100);
 expect(products[0].productId).toBe("1");
 expect(buildProductSegments([product(1, 0)])).toEqual([]);
});
it("loads API data for the branch and reloads when period or branch changes", async () => {
 mocks.summary.mockResolvedValue({ products: [product(1, 5000000)] });
 const { rerender } = render(<BestSellingProductsCard filter="month" />);
 await waitFor(() => expect(screen.getByText("Product 1 (SKU1)")).toBeTruthy());
 expect(mocks.summary.mock.calls[0][0]).toEqual({ companyCode: "C1", branchId: "B1" });
 const month = mocks.summary.mock.calls[0][1];
 rerender(<BestSellingProductsCard filter="year" />);
 await waitFor(() => expect(mocks.summary).toHaveBeenCalledTimes(2));
 expect(mocks.summary.mock.calls[1][1].from < month.from).toBe(true);
 mocks.scope.branchId = "B2";
 rerender(<BestSellingProductsCard filter="year" />);
 await waitFor(() => expect(mocks.summary).toHaveBeenCalledTimes(3));
 expect(mocks.summary.mock.calls[2][0].branchId).toBe("B2");
});
it("shows errors and empty data without a fabricated chart", async () => {
 mocks.summary.mockRejectedValue(new Error("Forbidden"));
 const { rerender } = render(<BestSellingProductsCard filter="month" />);
 await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
 mocks.summary.mockResolvedValue({ products: [] });
 rerender(<BestSellingProductsCard filter="quarter" />);
 await waitFor(() => expect(screen.getByText("Chưa có doanh thu sản phẩm trong kỳ này.")).toBeTruthy());
 expect(screen.queryByRole("alert")).toBeNull();
});

it("hides API error details and supports retry", async () => {
 mocks.summary.mockRejectedValueOnce(new ApiClientError({ status: 403, code: "DENIED", message: "Không có quyền báo cáo" }))
   .mockResolvedValueOnce({ products: [product(1, 100)] });
 render(<BestSellingProductsCard filter="month" />);
 await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Bạn không có quyền xem báo cáo này."));
 expect(screen.getByRole("alert").textContent).not.toContain("403");
 expect(screen.getByRole("alert").textContent).not.toContain("Không có quyền báo cáo");
 expect(screen.getByRole("alert").querySelector("svg")).toBeTruthy();
 fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
 await waitFor(() => expect(screen.getByText("Product 1 (SKU1)")).toBeTruthy());
 expect(screen.queryByRole("alert")).toBeNull();
});

it("does not expose server error messages or HTTP codes", async () => {
 mocks.summary.mockRejectedValue(new ApiClientError({ status: 500, code: "DB_FAILURE", message: "Internal database failure" }));
 render(<BestSellingProductsCard filter="month" />);
 await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Không tải được báo cáo sản phẩm. Vui lòng thử lại."));
 expect(screen.getByRole("alert").textContent).not.toMatch(/500|DB_FAILURE|database/);
});
