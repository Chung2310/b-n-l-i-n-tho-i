// @vitest-environment jsdom
import React, { useState } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { TablePagination } from "./TablePagination";

afterEach(() => {
  cleanup();
});

describe("TablePagination component", () => {
  it("renders page range and total items count", () => {
    render(
      <TablePagination
        currentPage={1}
        totalPages={3}
        pageSize={10}
        totalItems={25}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        itemLabel="chi nhánh"
      />
    );

    expect(screen.getByText(/Hiển thị/)).not.toBeNull();
    expect(screen.getByText(/1 - 10/)).not.toBeNull();
    expect(screen.getByText("25")).not.toBeNull();
    expect(screen.getByText(/chi nhánh/)).not.toBeNull();
    expect(screen.getByText("1 / 3")).not.toBeNull();
  });

  it("handles next and previous page changes", async () => {
    const user = userEvent.setup();
    const handlePageChange = vi.fn();

    function TestWrapper() {
      const [page, setPage] = useState(2);
      return (
        <TablePagination
          currentPage={page}
          totalPages={5}
          pageSize={10}
          totalItems={45}
          onPageChange={(p) => {
            setPage(p);
            handlePageChange(p);
          }}
          onPageSizeChange={() => {}}
        />
      );
    }

    render(<TestWrapper />);

    expect(screen.getByText("2 / 5")).not.toBeNull();

    // Click next page
    await user.click(screen.getByRole("button", { name: "Sau" }));
    expect(handlePageChange).toHaveBeenCalledWith(3);
    expect(screen.getByText("3 / 5")).not.toBeNull();

    // Click previous page
    await user.click(screen.getByRole("button", { name: "Trước" }));
    expect(handlePageChange).toHaveBeenCalledWith(2);
    expect(screen.getByText("2 / 5")).not.toBeNull();
  });

  it("returns null when total items is 0", () => {
    const { container } = render(
      <TablePagination
        currentPage={1}
        totalPages={1}
        pageSize={10}
        totalItems={0}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
