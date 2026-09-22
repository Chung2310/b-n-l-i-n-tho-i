// @vitest-environment jsdom
import React, { useState } from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { SearchInput } from "./SearchInput";

afterEach(() => {
  cleanup();
});

describe("SearchInput component", () => {
  it("renders with placeholder and value", () => {
    render(
      <SearchInput
        value="iPhone 13"
        onChange={() => {}}
        placeholder="Tìm kiếm phiếu..."
      />
    );

    const input = screen.getByPlaceholderText("Tìm kiếm phiếu...") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe("iPhone 13");
  });

  it("calls onChange when typing", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    function TestWrapper() {
      const [val, setVal] = useState("");
      return (
        <SearchInput
          value={val}
          onChange={(next) => {
            setVal(next);
            handleChange(next);
          }}
          placeholder="Tìm..."
        />
      );
    }

    render(<TestWrapper />);

    const input = screen.getByPlaceholderText("Tìm...");
    await user.type(input, "test");

    expect(handleChange).toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe("test");
  });

  it("renders clear button when value is non-empty and clears on click", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleClear = vi.fn();

    function TestWrapper() {
      const [val, setVal] = useState("abc");
      return (
        <SearchInput
          value={val}
          onChange={(next) => {
            setVal(next);
            handleChange(next);
          }}
          onClear={handleClear}
          placeholder="Tìm..."
        />
      );
    }

    render(<TestWrapper />);

    const clearBtn = screen.getByRole("button", { name: "Xóa tìm kiếm" });
    expect(clearBtn).not.toBeNull();

    await user.click(clearBtn);

    expect(handleChange).toHaveBeenCalledWith("");
    expect(handleClear).toHaveBeenCalled();
  });

  it("clears input on Escape key press", () => {
    const handleChange = vi.fn();

    render(
      <SearchInput
        value="hello"
        onChange={handleChange}
        placeholder="Tìm..."
      />
    );

    const input = screen.getByPlaceholderText("Tìm...");
    fireEvent.keyDown(input, { key: "Escape" });

    expect(handleChange).toHaveBeenCalledWith("");
  });

  it("disables input when disabled prop is true and hides clear button", () => {
    render(
      <SearchInput
        value="text"
        onChange={() => {}}
        disabled={true}
        placeholder="Tìm..."
      />
    );

    const input = screen.getByPlaceholderText("Tìm...") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Xóa tìm kiếm" })).toBeNull();
  });
});
