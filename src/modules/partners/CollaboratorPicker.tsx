import React, { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { partnerRequest, type Partner } from "./partnerApi";
import { Dropdown } from "../../components/common/Dropdown";
import CreateCollaboratorDialog from "./CreateCollaboratorDialog";

export interface CollaboratorPickerProps {
  value?: string;
  onChange: (id: string) => void;
  className?: string;
  label?: string;
  allowCreate?: boolean;
  extraAction?: React.ReactNode;
  triggerClassName?: string;
}

export default function CollaboratorPicker({
  value,
  onChange,
  className = "",
  label = "CTV giới thiệu",
  allowCreate = true,
  extraAction,
  triggerClassName,
}: CollaboratorPickerProps) {
  const [items, setItems] = useState<Array<{ _id: string; code: string; name: string }>>([]);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    let active = true;
    partnerRequest<Array<{ _id: string; code: string; name: string }>>("/collaborators")
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

  const handleCreated = (partner: Partner) => {
    const newItem = {
      _id: partner._id,
      code: partner.code,
      name: partner.name,
    };
    setItems((prev) => [newItem, ...prev.filter((p) => p._id !== partner._id)]);
    onChange(partner._id);
  };

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
      <div className="flex items-center justify-between">
        {label && <span className="font-semibold text-slate-700 dark:text-zinc-200">{label}</span>}
        <div className="flex items-center gap-2">
          {extraAction}
          {allowCreate && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition cursor-pointer"
              title="Tạo trực tiếp cộng tác viên mới"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>+ Thêm CTV</span>
            </button>
          )}
        </div>
      </div>

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
        triggerClassName={
          triggerClassName ||
          "w-full justify-between py-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 text-slate-800 shadow-2xs font-normal"
        }
        actionButton={
          allowCreate
            ? {
                label: "Tạo trực tiếp CTV mới",
                icon: <UserPlus className="h-3.5 w-3.5 text-cyan-600" />,
                onClick: () => setShowCreateModal(true),
              }
            : undefined
        }
      />
      {error && <span className="text-xs text-rose-600 font-medium">Không tải được CTV: {error}</span>}

      {showCreateModal && (
        <CreateCollaboratorDialog
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
