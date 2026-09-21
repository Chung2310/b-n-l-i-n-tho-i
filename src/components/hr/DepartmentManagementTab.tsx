import React, { useState, useEffect, useMemo } from "react";
import {
  Building2,
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  LayoutGrid,
  List as ListIcon,
  X,
  UserCheck,
  Briefcase,
  AlertCircle,
  Layers,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { UserProfile, DepartmentRecord, DepartmentInput } from "../../types";
import { departmentService } from "../../services/departmentService";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { ConfirmDialog } from "../common/ConfirmDialog";

interface DepartmentManagementTabProps {
  userProfile?: any;
  selectedCompanyCode: string;
  usersList: UserProfile[];
  canManage: boolean;
}

export default function DepartmentManagementTab({
  userProfile,
  selectedCompanyCode,
  usersList,
  canManage,
}: DepartmentManagementTabProps) {
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formManagerUid, setFormManagerUid] = useState("");
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);

  // Delete State
  const [deletingDept, setDeletingDept] = useState<DepartmentRecord | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Detail Drawer for viewing employees in department
  const [selectedDeptForView, setSelectedDeptForView] = useState<DepartmentRecord | null>(null);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const data = await departmentService.list(selectedCompanyCode);
      setDepartments(data || []);
    } catch (error) {
      console.error("Lỗi khi tải danh sách phòng ban:", error);
      toast.error(getApiErrorMessage(error, "Không thể tải danh sách phòng ban."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [selectedCompanyCode]);

  const handleOpenAddModal = () => {
    setEditingDept(null);
    setFormCode("");
    setFormName("");
    setFormDescription("");
    setFormManagerUid("");
    setFormSortOrder(departments.length + 1);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (dept: DepartmentRecord) => {
    setEditingDept(dept);
    setFormCode(dept.code);
    setFormName(dept.name);
    setFormDescription(dept.description || "");
    setFormManagerUid(dept.managerUid || "");
    setFormSortOrder(dept.sortOrder || 0);
    setFormIsActive(dept.isActive !== false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formCode.trim().toUpperCase();
    const cleanName = formName.trim();

    if (!cleanCode) {
      toast.error("Vui lòng nhập mã phòng ban.");
      return;
    }
    if (!cleanName) {
      toast.error("Vui lòng nhập tên phòng ban.");
      return;
    }

    setSubmitting(true);
    try {
      const selectedManager = usersList.find((u) => u.uid === formManagerUid);
      const managerName = selectedManager ? selectedManager.displayName : "";

      const payload: DepartmentInput = {
        companyCode: selectedCompanyCode,
        code: cleanCode,
        name: cleanName,
        description: formDescription.trim(),
        managerUid: formManagerUid,
        managerName,
        sortOrder: Number(formSortOrder) || 0,
        isActive: formIsActive,
      };

      if (editingDept) {
        await departmentService.update(editingDept._id, payload);
        toast.success(`Đã cập nhật phòng ban "${cleanName}".`);
      } else {
        await departmentService.create(payload);
        toast.success(`Đã thêm mới phòng ban "${cleanName}".`);
      }

      setIsModalOpen(false);
      fetchDepartments();
    } catch (error) {
      console.error("Lỗi khi lưu phòng ban:", error);
      toast.error(getApiErrorMessage(error, "Không thể lưu thông tin phòng ban."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingDept) return;
    setDeleteSubmitting(true);
    try {
      await departmentService.delete(deletingDept._id);
      toast.success(`Đã xóa phòng ban "${deletingDept.name}".`);
      setDeletingDept(null);
      fetchDepartments();
    } catch (error) {
      console.error("Lỗi khi xóa phòng ban:", error);
      toast.error(getApiErrorMessage(error, "Không thể xóa phòng ban."));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Filter & Search
  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      const matchSearch =
        searchQuery === "" ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.managerName && d.managerName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && d.isActive) ||
        (statusFilter === "inactive" && !d.isActive);

      return matchSearch && matchStatus;
    });
  }, [departments, searchQuery, statusFilter]);

  // Key metrics
  const stats = useMemo(() => {
    const total = departments.length;
    const active = departments.filter((d) => d.isActive).length;
    const totalMembers = departments.reduce((sum, d) => sum + (d.employeeCount || 0), 0);
    const noManager = departments.filter((d) => !d.managerUid).length;
    return { total, active, totalMembers, noManager };
  }, [departments]);

  // Employees for drawer view
  const employeesInSelectedDept = useMemo(() => {
    if (!selectedDeptForView) return [];
    return usersList.filter(
      (u) =>
        u.department &&
        (u.department.trim().toLowerCase() === selectedDeptForView.name.trim().toLowerCase() ||
          u.department.trim().toLowerCase() === selectedDeptForView.code.trim().toLowerCase())
    );
  }, [selectedDeptForView, usersList]);

  return (
    <div className="flex flex-1 flex-col h-full min-h-0 bg-slate-50/50 p-3 sm:p-6 overflow-y-auto">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-sm shadow-cyan-200">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Quản lý Phòng Ban
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-bold">
                {departments.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Quản lý danh sách phòng ban, cấu trúc chức vụ và trưởng bộ phận của doanh nghiệp
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchDepartments}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-cyan-600" : ""}`} />
          </button>

          {canManage && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-cyan-600 text-white text-xs font-bold shadow-xs hover:bg-cyan-700 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm phòng ban</span>
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 border border-slate-200/70 shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{stats.total}</div>
            <div className="text-[11px] font-medium text-slate-500">Tổng số phòng ban</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 border border-slate-200/70 shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{stats.active}</div>
            <div className="text-[11px] font-medium text-slate-500">Đang hoạt động</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 border border-slate-200/70 shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{stats.totalMembers}</div>
            <div className="text-[11px] font-medium text-slate-500">Tổng nhân sự trong PB</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-white p-4 border border-slate-200/70 shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{stats.noManager}</div>
            <div className="text-[11px] font-medium text-slate-500">Chưa có trưởng phòng</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/70 shadow-2xs mb-5">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo mã, tên phòng ban hoặc trưởng phòng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 focus:border-cyan-500 outline-none cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Tạm dừng</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`flex items-center justify-center h-8 w-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === "grid"
                ? "bg-cyan-50 text-cyan-700 border border-cyan-200 font-bold"
                : "text-slate-500 hover:bg-slate-100"
            }`}
            title="Xem dạng lưới"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center justify-center h-8 w-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              viewMode === "table"
                ? "bg-cyan-50 text-cyan-700 border border-cyan-200 font-bold"
                : "text-slate-500 hover:bg-slate-100"
            }`}
            title="Xem dạng bảng"
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && departments.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-slate-200 text-slate-400">
          <div className="h-8 w-8 border-3 border-cyan-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs font-semibold">Đang tải danh sách phòng ban...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredDepartments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 text-center p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 mb-3">
            <Building2 className="h-7 w-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">
            {searchQuery || statusFilter !== "all"
              ? "Không tìm thấy phòng ban phù hợp"
              : "Chưa có phòng ban nào"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mb-4">
            {searchQuery || statusFilter !== "all"
              ? "Thử thay đổi từ khóa tìm kiếm hoặc bỏ bộ lọc trạng thái để xem đầy đủ kết quả."
              : "Thiết lập phòng ban để phân bổ nhân sự, sơ đồ báo cáo và quản lý công việc hiệu quả hơn."}
          </p>
          {canManage && !searchQuery && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-700 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Tạo phòng ban đầu tiên</span>
            </button>
          )}
        </div>
      )}

      {/* Grid View */}
      {!loading && filteredDepartments.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDepartments.map((dept) => {
            const manager = usersList.find((u) => u.uid === dept.managerUid);
            const avatarUrl =
              manager?.photoURL ||
              (dept.managerName
                ? `https://ui-avatars.com/api/?name=${encodeURIComponent(dept.managerName)}&background=random&color=fff`
                : null);

            return (
              <div
                key={dept._id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:shadow-md hover:border-cyan-300/80 transition-all"
              >
                <div>
                  {/* Top Bar: Code badge & Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                      {dept.code}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          dept.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            dept.isActive ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {dept.isActive ? "Hoạt động" : "Tạm dừng"}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-cyan-600 transition-colors mb-1">
                    {dept.name}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px] mb-4">
                    {dept.description || "Không có mô tả chi tiết cho phòng ban này."}
                  </p>

                  {/* Manager section */}
                  <div className="rounded-xl bg-slate-50/80 p-3 border border-slate-150 mb-4">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                      Trưởng bộ phận
                    </div>
                    {dept.managerName ? (
                      <div className="flex items-center gap-2.5">
                        <img
                          src={avatarUrl!}
                          alt={dept.managerName}
                          className="h-8 w-8 rounded-full object-cover border border-white shadow-2xs"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {dept.managerName}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {manager?.jobTitle || "Trưởng phòng"}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-amber-600 italic">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                        <span>Chưa bổ nhiệm trưởng phòng</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer: Member count & Action buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDeptForView(dept)}
                    className="flex items-center gap-1.5 text-xs font-bold text-cyan-600 hover:text-cyan-700 bg-cyan-50 hover:bg-cyan-100/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>{dept.employeeCount || 0} nhân sự</span>
                  </button>

                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(dept)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-cyan-50 hover:text-cyan-600 transition-colors cursor-pointer"
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingDept(dept)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Xóa phòng ban"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {!loading && filteredDepartments.length > 0 && viewMode === "table" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Mã PB</th>
                  <th className="py-3 px-4">Tên phòng ban</th>
                  <th className="py-3 px-4">Trưởng phòng</th>
                  <th className="py-3 px-4 text-center">Số lượng nhân sự</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Mô tả</th>
                  {canManage && <th className="py-3 px-4 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredDepartments.map((dept) => {
                  const manager = usersList.find((u) => u.uid === dept.managerUid);
                  const avatarUrl =
                    manager?.photoURL ||
                    (dept.managerName
                      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(dept.managerName)}&background=random&color=fff`
                      : null);

                  return (
                    <tr key={dept._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          {dept.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{dept.name}</td>
                      <td className="py-3 px-4">
                        {dept.managerName ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={avatarUrl!}
                              alt={dept.managerName}
                              className="h-6 w-6 rounded-full object-cover border border-white"
                            />
                            <span className="font-semibold text-slate-800">{dept.managerName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa bổ nhiệm</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedDeptForView(dept)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 font-bold hover:bg-cyan-100 transition-colors cursor-pointer"
                        >
                          <Users className="h-3 w-3" />
                          <span>{dept.employeeCount || 0}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            dept.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              dept.isActive ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          {dept.isActive ? "Hoạt động" : "Tạm dừng"}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-500">
                        {dept.description || "—"}
                      </td>
                      {canManage && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(dept)}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-cyan-50 hover:text-cyan-600 transition-colors cursor-pointer"
                              title="Sửa"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingDept(dept)}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Xóa"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Department Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingDept ? "Chỉnh sửa phòng ban" : "Thêm phòng ban mới"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingDept ? `Cập nhật thông tin phòng ban ${editingDept.code}` : "Tạo mới phòng ban cho doanh nghiệp"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Mã phòng ban <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: PB-KD, PB-KT..."
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full uppercase font-mono px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none transition-all font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Thứ tự hiển thị
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none transition-all font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Tên phòng ban <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Phòng Kinh Doanh, Phòng Kỹ Thuật..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none transition-all font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Trưởng phòng (Bộ phận)
                </label>
                <select
                  value={formManagerUid}
                  onChange={(e) => setFormManagerUid(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none transition-all bg-white font-semibold cursor-pointer"
                >
                  <option value="">-- Chưa chỉ định trưởng phòng --</option>
                  {usersList.map((user) => (
                    <option key={user.uid} value={user.uid}>
                      {user.displayName} ({user.email} - {user.jobTitle || user.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Mô tả phòng ban</label>
                <textarea
                  rows={3}
                  placeholder="Mô tả chức năng, nhiệm vụ chính của phòng ban..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none transition-all"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                <div>
                  <div className="font-bold text-slate-800">Trạng thái hoạt động</div>
                  <div className="text-[11px] text-slate-400">
                    Phòng ban đang hoạt động sẽ xuất hiện trong các form lựa chọn nhân sự
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-700 transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingDept ? "Cập nhật" : "Lưu phòng ban"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingDept)}
        title="Xác nhận xóa phòng ban"
        description={`Bạn có chắc chắn muốn xóa phòng ban "${deletingDept?.name}" (${deletingDept?.code}) không? Thao tác này không thể hoàn tác.`}
        confirmLabel="Xóa phòng ban"
        cancelLabel="Hủy"
        tone="danger"
        isSubmitting={deleteSubmitting}
        onClose={() => setDeletingDept(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Detail Drawer for seeing employees belonging to this department */}
      {selectedDeptForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-slate-150 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {selectedDeptForView.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {selectedDeptForView.code} • {employeesInSelectedDept.length} nhân sự
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDeptForView(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {employeesInSelectedDept.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                  <Users className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold">Chưa có nhân sự nào trong phòng ban này</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Cập nhật phòng ban cho nhân sự tại tab Sơ đồ tổ chức
                  </p>
                </div>
              ) : (
                employeesInSelectedDept.map((emp) => (
                  <div
                    key={emp.uid}
                    className="flex items-center justify-between rounded-xl border border-slate-150 bg-white p-3 shadow-2xs hover:border-cyan-200 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          emp.photoURL ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.displayName)}&background=random&color=fff`
                        }
                        alt={emp.displayName}
                        className="h-9 w-9 rounded-full object-cover border border-white shadow-2xs"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          {emp.displayName}
                          {emp.uid === selectedDeptForView.managerUid && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                              Trưởng phòng
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {emp.jobTitle || emp.role} • {emp.email}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
