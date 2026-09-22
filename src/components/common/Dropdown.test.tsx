// @vitest-environment jsdom
import React, { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Dropdown } from "./Dropdown";

afterEach(() => {
  cleanup();
});

describe("Dropdown component", () => {
  it("renders with the selected value label", () => {
    render(
      <Dropdown
        aria-label="Chọn người"
        value="u1"
        onChange={() => {}}
        options={[
          { value: "u1", label: "Người dùng 1" },
          { value: "u2", label: "Người dùng 2" },
        ]}
      />
    );

    expect(screen.getByRole("button", { name: "Chọn người" })).not.toBeNull();
    expect(screen.getByText("Người dùng 1")).not.toBeNull();
  });

  it("opens menu when clicked and selects an option", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    function TestWrapper() {
      const [val, setVal] = useState("all");
      return (
        <Dropdown
          aria-label="Lọc KTV"
          value={val}
          onChange={(next) => {
            setVal(next);
            handleChange(next);
          }}
          options={[
            { value: "all", label: "Tất cả kỹ thuật viên" },
            { value: "unassigned", label: "Chưa giao KTV" },
            { value: "tech-1", label: "KTV: Tuấn" },
          ]}
        />
      );
    }

    render(<TestWrapper />);

    const trigger = screen.getByRole("button", { name: "Lọc KTV" });
    await user.click(trigger);

    // Options are displayed
    expect(screen.getByRole("option", { name: "Chưa giao KTV" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "KTV: Tuấn" })).not.toBeNull();

    // Select an option
    await user.click(screen.getByRole("option", { name: "KTV: Tuấn" }));

    expect(handleChange).toHaveBeenCalledWith("tech-1");
    // Trigger updates label
    expect(screen.getByText("KTV: Tuấn")).not.toBeNull();
  });

  it("closes when clicking outside or pressing Escape", async () => {
    const user = userEvent.setup();

    render(
      <div>
        <div data-testid="outside">Bên ngoài</div>
        <Dropdown
          value="a"
          onChange={() => {}}
          options={[
            { value: "a", label: "Lựa chọn A" },
            { value: "b", label: "Lựa chọn B" },
          ]}
        />
      </div>
    );

    const trigger = screen.getByRole("button");
    await user.click(trigger);
    expect(screen.getByRole("listbox")).not.toBeNull();

    // Press Escape
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();

    // Click outside
    await user.click(trigger);
    expect(screen.getByRole("listbox")).not.toBeNull();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
