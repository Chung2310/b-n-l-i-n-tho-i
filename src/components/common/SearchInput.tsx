import React from "react";
import { Search, X } from "lucide-react";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onClear?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  id?: string;
  name?: string;
  "aria-label"?: string;
}

const sizeClasses = {
  xs: {
    input: "py-1 pl-7 pr-7 text-xs",
    icon: "h-3.5 w-3.5 left-2",
    clear: "right-1.5 p-0.5",
    clearIcon: "h-3 w-3",
  },
  sm: {
    input: "py-1.5 pl-8 pr-8 text-xs",
    icon: "h-3.5 w-3.5 left-2.5",
    clear: "right-2 p-0.5",
    clearIcon: "h-3.5 w-3.5",
  },
  md: {
    input: "py-2 pl-9 pr-9 text-sm",
    icon: "h-4 w-4 left-3",
    clear: "right-2.5 p-1",
    clearIcon: "h-4 w-4",
  },
  lg: {
    input: "py-2.5 pl-10 pr-10 text-base",
    icon: "h-5 w-5 left-3.5",
    clear: "right-3 p-1",
    clearIcon: "h-4.5 w-4.5",
  },
};

export function SearchInput({
  value,
  onChange,
  placeholder = "Tìm kiếm...",
  size = "sm",
  className = "",
  inputClassName = "",
  disabled = false,
  autoFocus = false,
  onClear,
  onKeyDown,
  id,
  name,
  "aria-label": ariaLabel = "Tìm kiếm",
}: SearchInputProps) {
  const currentSize = sizeClasses[size] || sizeClasses.sm;

  const handleClear = () => {
    onChange("");
    onClear?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && value) {
      e.stopPropagation();
      handleClear();
    }
    onKeyDown?.(e);
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search
        className={`pointer-events-none absolute text-slate-400 ${currentSize.icon}`}
        aria-hidden="true"
      />
      <input
        type="text"
        id={id}
        name={name}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={`w-full rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 transition shadow-2xs ${currentSize.input} ${inputClassName}`}
      />
      {value && !disabled && (
        <button
          type="button"
          aria-label="Xóa tìm kiếm"
          onClick={handleClear}
          className={`absolute rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none cursor-pointer transition ${currentSize.clear}`}
        >
          <X className={currentSize.clearIcon} />
        </button>
      )}
    </div>
  );
}

export default SearchInput;
