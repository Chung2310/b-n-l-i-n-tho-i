import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, FileText, Trash2, Upload, X } from "lucide-react";
import { Dropdown } from "../common/Dropdown";
import { authService, getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";
import type { EmployeeDocument } from "../../types";

const categories = [
  { value: "identity", label: "CCCD/CMND" },
  { value: "certificate", label: "Chứng chỉ" },
  { value: "degree", label: "Bằng cấp" },
  { value: "other", label: "Giấy tờ khác" },
] as const;

function labelFor(category: EmployeeDocument["category"]) {
  return categories.find((item) => item.value === category)?.label || "Giấy tờ khác";
}

export function EmployeeDocumentsList({ documents, employeeId, localPreviewUrls = {}, onRemove }: {
  documents: EmployeeDocument[];
  employeeId: string;
  localPreviewUrls?: Record<string, string>;
  onRemove?: (index: number) => void;
}) {
  const [preview, setPreview] = useState<{ document: EmployeeDocument; url: string } | null>(null);
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);
  const openPreview = async (document: EmployeeDocument) => {
    if (document.uploadToken) {
      const url = localPreviewUrls[document.fileUrl];
      if (url) setPreview({ document, url });
      return;
    }
    setLoadingUrl(document.fileUrl);
    try {
      const response = await fetch(`/api/v1/auth/users/${encodeURIComponent(employeeId)}/documents/preview?fileUrl=${encodeURIComponent(document.fileUrl)}`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      const result = await response.json();
      if (!response.ok || !result.data?.url) throw new Error(result.message || "Không thể xem trước giấy tờ.");
      setPreview({ document, url: result.data.url });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xem trước giấy tờ.");
    } finally {
      setLoadingUrl(null);
    }
  };
  return <>
    <div className="space-y-2">
      {documents.length === 0 && <p className="text-xs text-slate-400">Chưa có giấy tờ nào.</p>}
      {documents.map((document, index) => <div key={`${document.fileUrl}-${index}`} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs">
        <FileText className="h-4 w-4 shrink-0 text-blue-600" />
        <div className="min-w-0 flex-1"><div className="text-slate-500">{labelFor(document.category)}</div><div className="truncate text-slate-800" title={document.fileName}>{document.fileName}</div></div>
        <button type="button" title="Xem trước" aria-label={`Xem trước ${document.fileName}`} disabled={Boolean(document.uploadToken && !localPreviewUrls[document.fileUrl]) || loadingUrl === document.fileUrl} onClick={() => void openPreview(document)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"><Eye className="h-4 w-4" /></button>
        {onRemove && <button type="button" title="Xóa giấy tờ" aria-label={`Xóa ${document.fileName}`} onClick={() => onRemove(index)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>}
      </div>)}
    </div>
    {preview && createPortal(<div role="dialog" aria-modal="true" aria-label={`Xem trước ${preview.document.fileName}`} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setPreview(null)}>
      <div className="flex h-[min(90vh,900px)] w-[min(95vw,1000px)] flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div className="min-w-0"><div className="text-sm text-slate-800">{labelFor(preview.document.category)}</div><div className="truncate text-xs text-slate-500">{preview.document.fileName}</div></div><button type="button" aria-label="Đóng xem trước" onClick={() => setPreview(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
        {preview.document.mimeType === "application/pdf"
          ? <iframe title={preview.document.fileName} src={preview.url} className="min-h-0 flex-1" referrerPolicy="no-referrer" />
          : <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-50 p-4"><img src={preview.url} alt={preview.document.fileName} className="max-h-full max-w-full object-contain" /></div>}
      </div>
    </div>, document.body)}
  </>;
}

export function EmployeeDocumentsEditor({ documents, employeeId, onChange, companyCode, onUploadingChange }: {
  documents: EmployeeDocument[];
  employeeId: string;
  onChange: (documents: EmployeeDocument[]) => void;
  companyCode: string;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const [category, setCategory] = useState<EmployeeDocument["category"]>("identity");
  const [uploading, setUploading] = useState(false);
  const [localPreviewUrls, setLocalPreviewUrls] = useState<Record<string, string>>({});
  const previewUrlsRef = useRef<string[]>([]);
  useEffect(() => () => previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);
  const upload = async (file?: File) => {
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("Chỉ hỗ trợ PDF, JPG, PNG hoặc WebP.");
    if (file.size === 0) return toast.error("Tệp trống, vui lòng chọn tệp khác.");
    if (file.size > 10 * 1024 * 1024) return toast.error("Tệp không được vượt quá 10 MB.");
    if (documents.length >= 100) return toast.error("Mỗi nhân sự được lưu tối đa 100 giấy tờ.");
    setUploading(true);
    onUploadingChange(true);
    try {
      const result = await authService.uploadManagedFile(file, "hr.employee", companyCode);
      const localUrl = URL.createObjectURL(file);
      previewUrlsRef.current.push(localUrl);
      setLocalPreviewUrls((current) => ({ ...current, [result.url]: localUrl }));
      onChange([...documents, { category, fileName: file.name, fileUrl: result.url, mimeType: file.type, size: file.size, uploadToken: result.uploadToken }]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể tải giấy tờ lên."); }
    finally { setUploading(false); onUploadingChange(false); }
  };
  return <div className="space-y-2 border-t border-slate-200 pt-3">
    <label className="block text-xs text-slate-700">Hồ sơ nhân sự</label>
    <EmployeeDocumentsList documents={documents} employeeId={employeeId} localPreviewUrls={localPreviewUrls} onRemove={(index) => onChange(documents.filter((_, i) => i !== index))} />
    <div className="flex gap-2">
      <Dropdown value={category} onChange={setCategory} options={[...categories]} variant="form" size="sm" aria-label="Loại giấy tờ" className="min-w-0 flex-1" />
      <label className={`flex cursor-pointer items-center gap-1.5 rounded-xl border border-blue-200 px-3 py-2 text-xs text-blue-700 ${uploading ? "opacity-50" : ""}`}><Upload className="h-4 w-4" />{uploading ? "Đang tải..." : "Tải file"}<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" disabled={uploading} className="hidden" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label>
    </div>
  </div>;
}
