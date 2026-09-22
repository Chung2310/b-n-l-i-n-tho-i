import React, { useEffect, useState } from "react";
import { partnerRequest } from "./partnerApi";
import { Dropdown } from "../../components/common/Dropdown";

export interface CollaboratorPickerProps {
  value?: string;
  onChange: (id: string) => void;
  className?: string;
  label?: string;
}

export default function CollaboratorPicker({
  value,
  onChange,
  className = "",
  label = "CTV giới thiệu",
}: CollaboratorPickerProps) {
  const [items, setItems] = useState<Array<{ _id: string; code: string; name: string }>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    partnerRequest("/collaborators")
      .then((data) => {
        if (active) setItems(data || []);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);

  const options = [
    { value: "", label: "Không có CTV (Khách đến trực tiếp)" },
    ...items.map((p) => ({
      value: p._id,
      label: `${p.code} — ${p.name}`,
    })),
  ];

  if (value && !items.some((p) => p._id === value)) {
    options.splice(1, 0, { value, label: "CTV đã chọn" });
  }

  return (
    <div className={`flex flex-col gap-1.5 text-sm ${className}`}>
      {label && <span className="font-semibold text-slate-700">{label}</span>}
      <Dropdown<string>
        aria-label="Chọn CTV giới thiệu"
        value={value || ""}
        onChange={onChange}
        options={options}
        variant="default"
        size="md"
        searchable={items.length > 5}
        searchPlaceholder="Tìm kiếm CTV theo mã hoặc tên..."
        className="w-full"
        triggerClassName="w-full justify-between py-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 text-slate-800 shadow-2xs font-normal"
      />
      {error && <span className="text-xs text-rose-600 font-medium">Không tải được CTV: {error}</span>}
    </div>
  );
}
