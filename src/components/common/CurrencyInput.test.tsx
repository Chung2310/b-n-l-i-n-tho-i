// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { CurrencyInput, formatCurrencyInput, parseDigits } from "./CurrencyInput";

afterEach(cleanup);

describe("CurrencyInput", () => {
  it("formats numbers with thousand separators correctly", () => {
    expect(formatCurrencyInput(1500000)).toBe("1.500.000");
    expect(formatCurrencyInput(4000000)).toBe("4.000.000");
    expect(formatCurrencyInput(8000000)).toBe("8.000.000");
    expect(formatCurrencyInput("10000")).toBe("10.000");
    expect(parseDigits("1.500.000")).toBe(1500000);
  });

  it("renders formatted value in the input", () => {
    const handleChange = vi.fn();
    render(<CurrencyInput aria-label="Test Currency" value={1500000} onChange={handleChange} />);

    const input = screen.getByLabelText("Test Currency") as HTMLInputElement;
    expect(input.value).toBe("1.500.000");
  });

  it("calls onChange with numeric value when user types digits", () => {
    const handleChange = vi.fn();
    render(<CurrencyInput aria-label="Test Currency" value={0} onChange={handleChange} />);

    const input = screen.getByLabelText("Test Currency") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2500000" } });

    expect(handleChange).toHaveBeenCalledWith(2500000, "2.500.000");
  });
});
