import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  FolderOpen, Folder, CloudUpload, Trash2, Eye, Download, HardDrive, ArrowLeft,
  FileText, Image as ImageIcon, Video as VideoIcon, File as FileIcon,
  Loader2, RefreshCw, AlertCircle, ArrowUpRight, FolderTree,
  Share2, Shield, Lock, Globe, Search, X, ChevronDown, Check, Users, Plus,
  Link as LinkIcon, FileSpreadsheet, Presentation, FolderPlus, Upload, MoreVertical,
  Info, Pencil, ArrowRightLeft, Copy, BellOff, MessageSquare, Briefcase, ChevronRight, ChevronLeft,
  ExternalLink, Link, SlidersHorizontal, Calendar, List, LayoutGrid, Mic, Undo2, Redo2
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { cn } from "../utils/cn";
import { toast } from "./Toast";
import { getAccessToken, authService } from "../services/authService";
import { FileExplorer } from "../components/resource/FileExplorer";
import UploadProgressPanel, { type UploadQueueItem } from "../components/resource/UploadProgressPanel";
import { internalChatService } from "../services/internalChatService";
import { resourceService } from "../services/resourceService";
import { useSubTabRouter } from "../hooks/useSubTabRouter";
import { RESOURCE_SUB_TAB_ROUTES } from "../router/subTabRoutes";

type ResourceSubTabType = "TÀI LIỆU KHÁC";

const SUB_TABS: Array<{ value: ResourceSubTabType; label: string; icon: React.ElementType }> = [
  { value: "TÀI LIỆU KHÁC", label: "Tài liệu nội bộ", icon: FileText },
];

const getMemberId = (u: any) => (u && typeof u === "object" ? (u._id || u.id) : u);

const getInitials = (name: string) => {
  if (!name) return "";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getBadgeColor = (name: string) => {
  const colors = [
    "bg-blue-500 text-white",
    "bg-emerald-500 text-white",
    "bg-indigo-500 text-white",
    "bg-amber-500 text-white",
    "bg-rose-500 text-white",
    "bg-teal-500 text-white",
    "bg-violet-500 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

interface OpenedTab {
  id: string;
  title: string;
  type: "explorer" | "google-doc";
  mimeType?: string;
  url?: string;
}

export default function ResourceTab() {
  const { userProfile, refreshProfile } = useAuth();
  const userProfileAny = userProfile as any;
  const userProfileId = userProfile?.uid || userProfileAny?.id || "";

  const [subTab, setSubTab] = useSubTabRouter<ResourceSubTabType>(RESOURCE_SUB_TAB_ROUTES, "TÀI LIỆU KHÁC");
  const [openedTabs, setOpenedTabs] = useState<OpenedTab[]>([
    { id: "explorer", title: "Thẻ mới", type: "explorer" }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("explorer");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Tăng để remount FileExplorer (về thư mục gốc + tải lại) khi bấm lại icon tab con đang mở
  const [explorerKey, setExplorerKey] = useState(0);
  const [localFolderId, setLocalFolderId] = useState<string | null>(null);
  const [localItemsCount, setLocalItemsCount] = useState({ count: 0, total: 0 });
  const [viewingTrash, setViewingTrash] = useState(false);

  const handleItemsCountChange = useCallback((count: number, total: number) => {
    setLocalItemsCount({ count, total });
  }, []);


  // Space management
  const [selectedSpace, setSelectedSpace] = useState<string>("personal");
  const [rooms, setRooms] = useState<any[]>([]);
  const [showSpaceDropdown, setShowSpaceDropdown] = useState(false);

  // User/Owner scoping for Admins
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [allStaff, setAllStaff] = useState<any[]>([]);

  useEffect(() => {
    if (userProfile) {
      setSelectedOwnerId(userProfileId);
    }
  }, [userProfile, userProfileId]);

  // Listen to ?id= query param to switch space & subTab
  useEffect(() => {
    if (!userProfile) return;
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    if (!idParam) return;

    let isSubscribed = true;

    const handleUrlNavigation = async () => {
      try {
        const item = await resourceService.getDetail(idParam);
        if (!isSubscribed || !item) return;

        if (item.roomId) {
          setSelectedSpace(item.roomId);
        } else {
          setSelectedSpace("personal");
          if (item.creatorUid) {
            setSelectedOwnerId(item.creatorUid);
          }
        }
        setSubTab("TÀI LIỆU KHÁC");
      } catch (err) {
        console.error("Failed to auto-navigate space from URL:", err);
      }
    };

    void handleUrlNavigation();

    return () => {
      isSubscribed = false;
    };
  }, [window.location.search, userProfile]);

  // Dùng uid ổn định làm dep để tránh infinite loop khi object userProfile thay đổi reference
  const userUid = userProfileId;
  const userRole = userProfile?.role;
  const userCompanyCode = userProfile?.companyCode;

  useEffect(() => {
    if (!userUid) return;
    const fetchStaff = async () => {
      try {
        let data: any[] = [];
        if (userRole === "superadmin") {
          data = await authService.getAllUsers();
        } else {
          // Dùng endpoint /users/colleagues không cần quyền access:read
          data = await authService.getColleagues();
        }
        setAllStaff(data);
      } catch (err) {
        console.error("Lỗi lấy danh sách nhân sự:", err);
      }
    };
    void fetchStaff();
  }, [userUid, userRole, userCompanyCode]);

  // Pill tab: Kho lưu trữ | Được chia sẻ
  const [currentPill, setCurrentPill] = useState<"KHO_LUU_TRU" | "DUOC_CHIA_SE">("KHO_LUU_TRU");

  // Advanced Filtering States
  const [showFilters, setShowFilters] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterType, setFilterType] = useState<string>("");

  const activeFiltersCount = React.useMemo(() => {
    return [filterStartDate, filterEndDate, filterType].filter(Boolean).length;
  }, [filterStartDate, filterEndDate, filterType]);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  // Add Popover Dropdown
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Link Modal States
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  // Note Modal States
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteTool, setNoteTool] = useState<"draw" | "text" | "arrow" | "rect" | "line" | "image">("draw");
  const [noteColor, setNoteColor] = useState<string>("#ef4444");

  // Image editing states on canvas
  const [editingImage, setEditingImage] = useState<{
    img: HTMLImageElement;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const isDraggingImageRef = useRef(false);
  const isResizingImageRef = useRef(false);
  const imageOffsetRef = useRef({ x: 0, y: 0 });
  const [noteTextInput, setNoteTextInput] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    value: string;
  }>({ isOpen: false, x: 0, y: 0, value: "" });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const noteImageInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  const undoStackRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);
  const isDrawingRef = useRef<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Audio Recording States
  const [showAddAudioModal, setShowAddAudioModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [savingAudio, setSavingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Dialog prompt state
  const [createFileDialog, setCreateFileDialog] = useState<{
    isOpen: boolean;
    type: "document" | "spreadsheet" | "presentation" | "folder" | "link";
    title: string;
    placeholder: string;
  } | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [newFileLink, setNewFileLink] = useState("");
  const [creatingFile, setCreatingFile] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Permissions & Sharing Modal States

  const handleOpenFile = (item: { _id: string; name: string; fileUrl?: string; mimeType?: string }) => {
    const existingTab = openedTabs.find(t => t.id === item._id);
    if (existingTab) {
      setActiveTabId(item._id);
    } else {
      const newTab: OpenedTab = {
        id: item._id,
        title: item.name,
        type: "google-doc",
        mimeType: item.mimeType,
        url: item.fileUrl,
      };
      setOpenedTabs([...openedTabs, newTab]);
      setActiveTabId(item._id);
    }
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tabIndex = openedTabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const newTabs = openedTabs.filter(t => t.id !== tabId);
    setOpenedTabs(newTabs);

    if (activeTabId === tabId) {
      const nextActiveIndex = tabIndex > 0 ? tabIndex - 1 : 0;
      if (newTabs.length > 0) {
        setActiveTabId(newTabs[nextActiveIndex].id);
      } else {
        setOpenedTabs([{ id: "explorer", title: "Thẻ mới", type: "explorer" }]);
        setActiveTabId("explorer");
      }
    }
  };

  const handleAddExplorerTab = () => {
    const newId = `explorer-${Date.now()}`;
    const newTab: OpenedTab = {
      id: newId,
      title: "Thẻ mới",
      type: "explorer"
    };
    setOpenedTabs([...openedTabs, newTab]);
    setActiveTabId(newId);
  };

  const fetchRooms = async () => {
    try {
      const data = await internalChatService.getRooms();
      setRooms(data.filter((r: any) => r.isGroup));
    } catch (err) {
      console.error("Lỗi lấy danh sách phòng chat:", err);
    }
  };

  // Reset folder position when switching space or owner
  useEffect(() => {
    setLocalFolderId(null);
    setViewingTrash(false);
  }, [selectedSpace, selectedOwnerId]);

  // Fetch chat groups on userProfile load
  useEffect(() => {
    if (userProfile) {
      void fetchRooms();
    }
  }, [userProfile]);

  // Click outside listener for custom dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSpaceDropdown(false);
      }
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleCreateFile = async () => {
    if (!createFileDialog) return;
    const name = newFileName.trim();
    if (!name) {
      toast.warning("Vui lòng nhập tên.");
      return;
    }

    setCreatingFile(true);
    try {
      if (createFileDialog.type === "folder") {
        const ownerIdParam = selectedSpace === "personal" ? selectedOwnerId : undefined;
        const roomIdParam = selectedSpace !== "personal" ? selectedSpace : undefined;
        await resourceService.createFolder(name, localFolderId, "local", ownerIdParam, roomIdParam);
        toast.success(`Đã tạo thư mục "${name}" thành công!`);
        setRefreshTrigger(prev => prev + 1);
      }
      setCreateFileDialog(null);
      setNewFileName("");
      setNewFileLink("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Có lỗi xảy ra khi tạo tài nguyên.");
    } finally {
      setCreatingFile(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (iso?: string): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const getFileIconDetails = (mimeType?: string) => {
    const mt = mimeType || "";
    if (mt.startsWith("image/")) {
      return { Icon: ImageIcon, iconColor: "text-emerald-500" };
    }
    if (mt.startsWith("video/")) {
      return { Icon: VideoIcon, iconColor: "text-blue-500" };
    }
    if (mt.includes("pdf") || mt.includes("document") || mt.includes("text")) {
      return { Icon: FileText, iconColor: "text-orange-500" };
    }
    return { Icon: FileIcon, iconColor: "text-gray-400" };
  };


  /** Upload 1 tệp vào kho tài liệu nội bộ; ném lỗi nếu thất bại. */
  const uploadLocalFile = async (file: File) => {
    const ownerIdParam = selectedSpace === "personal" ? selectedOwnerId : undefined;
    const roomIdParam = selectedSpace !== "personal" ? selectedSpace : undefined;
    await resourceService.uploadFile(file, localFolderId, ownerIdParam, roomIdParam);
  };

  /** Upload nhiều tệp tuần tự, cập nhật tiến trình từng tệp. */
  const uploadManyFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setUploadQueue(files.map((f) => ({ name: f.name, status: "pending" as const })));
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      setUploadQueue((q) => q.map((it, idx) => (idx === i ? { ...it, status: "uploading" } : it)));
      try {
        await uploadLocalFile(files[i]);
        ok += 1;
        setUploadQueue((q) => q.map((it, idx) => (idx === i ? { ...it, status: "done" } : it)));
      } catch (err: any) {
        console.error(err);
        setUploadQueue((q) =>
          q.map((it, idx) => (idx === i ? { ...it, status: "error", error: err?.message || "Tải lên thất bại." } : it))
        );
      }
    }
    setUploading(false);
    if (ok > 0) {
      toast.success(`Đã tải lên ${ok}/${files.length} tệp.`);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void uploadManyFiles(Array.from(e.target.files));
    }
    e.target.value = "";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void uploadManyFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Advanced feature handlers (Link, Note, Audio)
  const handleSaveLink = async () => {
    const name = linkName.trim();
    let url = linkUrl.trim();
    if (!name || !url) {
      toast.error("Vui lòng nhập đầy đủ tên và đường dẫn liên kết.");
      return;
    }

    if (!/^https?:\/\//i.test(url)) {
      url = "http://" + url;
    }

    setSavingLink(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      const token = getAccessToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/v1/resources/file", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          fileUrl: url,
          parentId: localFolderId === "root" ? null : localFolderId,
          mimeType: "text/html",
          size: 0,
          ownerId: selectedSpace === "personal" ? selectedOwnerId : undefined,
          roomId: selectedSpace !== "personal" ? selectedSpace : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Không thêm được liên kết.");
      }

      toast.success("Đã thêm liên kết thành công!");
      setShowAddLinkModal(false);
      setLinkName("");
      setLinkUrl("");
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error("Lỗi thêm liên kết:", err);
      toast.error(err.message || "Không thêm được liên kết.");
    } finally {
      setSavingLink(false);
    }
  };

  const handleSaveNote = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const title = noteTitle.trim() || "Ghi chú không tên";
    setSavingNote(true);

    try {
      // 1. Chuyển canvas thành PNG base64
      const dataUrl = canvas.toDataURL("image/png");

      // 2. Convert base64 dataUrl sang File object
      const byteString = atob(dataUrl.split(',')[1]);
      const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const noteFile = new File([blob], `${title}.png`, { type: "image/png" });

      // 3. Upload file lên qua resourceService.uploadFile
      await resourceService.uploadFile(
        noteFile,
        localFolderId === "root" ? null : localFolderId,
        selectedSpace === "personal" ? selectedOwnerId : undefined,
        selectedSpace !== "personal" ? selectedSpace : undefined
      );

      toast.success("Đã lưu ghi chú thành ảnh thành công!");
      setShowAddNoteModal(false);
      setNoteTitle("");
      setNoteContent("");
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      console.error("Lỗi lưu ghi chú:", err);
      toast.error(err.message || "Lỗi lưu ghi chú.");
    } finally {
      setSavingNote(false);
    }
  };

  // --- Canvas Note Drawing Helper Functions ---
  const saveCanvasState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Lưu lại trạng thái ImageData hiện tại vào undoStack
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push(imgData);

    // Clear redoStack
    redoStackRef.current = [];
  };

  const handleNoteUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || undoStackRef.current.length <= 1) {
      toast.info("Không có gì để hoàn tác.");
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Pop state hiện tại chuyển sang redoStack
    const currentState = undoStackRef.current.pop();
    if (currentState) {
      redoStackRef.current.push(currentState);
    }

    // Vẽ state trước đó
    const prevState = undoStackRef.current[undoStackRef.current.length - 1];
    if (prevState) {
      ctx.putImageData(prevState, 0, 0);
    }
  };

  const handleNoteRedo = () => {
    const canvas = canvasRef.current;
    if (!canvas || redoStackRef.current.length === 0) {
      toast.info("Không có gì để làm lại.");
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nextState = redoStackRef.current.pop();
    if (nextState) {
      undoStackRef.current.push(nextState);
      ctx.putImageData(nextState, 0, 0);
    }
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, fromx: number, fromy: number, tox: number, toy: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();

    const angle = Math.atan2(toy - fromy, tox - fromx);
    const headlen = 15;

    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  };

  const confirmApplyImage = () => {
    if (!editingImage) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Vẽ ảnh vĩnh viễn không có viền edit
        const lastState = undoStackRef.current[undoStackRef.current.length - 1];
        if (lastState) {
          ctx.putImageData(lastState, 0, 0);
        }
        ctx.drawImage(editingImage.img, editingImage.x, editingImage.y, editingImage.w, editingImage.h);
        saveCanvasState();
        setEditingImage(null);
        setNoteTool("draw");
        toast.success("Đã chèn ảnh vĩnh viễn vào ghi chú.");
      }
    }
  };

  const handleNoteImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;

          // Chiều rộng mặc định 240px, tự tính chiều cao tỷ lệ
          const defaultWidth = 240;
          const ratio = img.height / img.width;
          const defaultHeight = defaultWidth * ratio;

          setEditingImage({
            img,
            x: 50,
            y: 50,
            w: defaultWidth,
            h: defaultHeight
          });
          setNoteTool("image");
          toast.info("Đã tải ảnh lên. Dùng chuột kéo để di chuyển, kéo nút tròn góc để chỉnh kích cỡ ảnh.");
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Re-draw canvas whenever editingImage object changes
  useEffect(() => {
    if (editingImage) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const lastState = undoStackRef.current[undoStackRef.current.length - 1];
          if (lastState) {
            ctx.putImageData(lastState, 0, 0);
          }
          // Vẽ ảnh đang edit
          ctx.drawImage(editingImage.img, editingImage.x, editingImage.y, editingImage.w, editingImage.h);

          // Vẽ khung nét đứt màu teal
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = "#008bad";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(editingImage.x, editingImage.y, editingImage.w, editingImage.h);
          ctx.setLineDash([]);

          // Vẽ nút tròn resize ở góc dưới bên phải
          ctx.fillStyle = "#008bad";
          ctx.beginPath();
          ctx.arc(editingImage.x + editingImage.w, editingImage.y + editingImage.h, 7, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  }, [editingImage]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (noteTool === "image" && editingImage) {
      // 1. Kiểm tra trúng nút resize góc dưới phải
      const distToCorner = Math.sqrt(
        Math.pow(x - (editingImage.x + editingImage.w), 2) +
        Math.pow(y - (editingImage.y + editingImage.h), 2)
      );
      if (distToCorner < 16) {
        isResizingImageRef.current = true;
        return;
      }

      // 2. Kiểm tra click vào trong lòng ảnh
      if (x >= editingImage.x && x <= editingImage.x + editingImage.w &&
        y >= editingImage.y && y <= editingImage.y + editingImage.h) {
        isDraggingImageRef.current = true;
        imageOffsetRef.current = {
          x: x - editingImage.x,
          y: y - editingImage.y
        };
        return;
      }
    }

    isDrawingRef.current = true;
    startPosRef.current = { x, y };

    if (noteTool === "draw") {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = noteColor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (noteTool === "image" && editingImage) {
      if (isResizingImageRef.current) {
        const newW = Math.max(30, x - editingImage.x);
        const ratio = editingImage.img.height / editingImage.img.width;
        const newH = newW * ratio;
        setEditingImage(prev => prev ? { ...prev, w: newW, h: newH } : null);
      } else if (isDraggingImageRef.current) {
        const newX = x - imageOffsetRef.current.x;
        const newY = y - imageOffsetRef.current.y;
        setEditingImage(prev => prev ? { ...prev, x: newX, y: newY } : null);
      }
      return;
    }

    if (!isDrawingRef.current) return;

    if (noteTool === "draw") {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (noteTool === "arrow" || noteTool === "rect" || noteTool === "line") {
      const lastState = undoStackRef.current[undoStackRef.current.length - 1];
      if (lastState) {
        ctx.putImageData(lastState, 0, 0);
      }

      if (noteTool === "arrow") {
        drawArrow(ctx, startPosRef.current.x, startPosRef.current.y, x, y, noteColor);
      } else if (noteTool === "line") {
        ctx.strokeStyle = noteColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(startPosRef.current.x, startPosRef.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (noteTool === "rect") {
        ctx.strokeStyle = noteColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(
          startPosRef.current.x,
          startPosRef.current.y,
          x - startPosRef.current.x,
          y - startPosRef.current.y
        );
      }
    }
  };

  const handleCanvasMouseUp = () => {
    isResizingImageRef.current = false;
    isDraggingImageRef.current = false;

    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      saveCanvasState();
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (noteTool !== "text") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setNoteTextInput({
      isOpen: true,
      x,
      y,
      value: ""
    });

    setTimeout(() => {
      textInputRef.current?.focus();
    }, 50);
  };

  const handleSaveTextInput = () => {
    if (!noteTextInput.isOpen) return;
    const value = noteTextInput.value.trim();

    if (value) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = noteColor;
          ctx.font = "bold 16px Arial, Helvetica, sans-serif";
          ctx.textBaseline = "middle";
          ctx.fillText(value, noteTextInput.x, noteTextInput.y);
          saveCanvasState();
        }
      }
    }

    setNoteTextInput({
      isOpen: false,
      x: 0,
      y: 0,
      value: ""
    });
  };

  // Khởi tạo Canvas trắng ban đầu khi mở modal
  useEffect(() => {
    if (showAddNoteModal) {
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            canvas.width = canvas.parentElement?.clientWidth || 800;
            canvas.height = canvas.parentElement?.clientHeight || 500;

            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            undoStackRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
            redoStackRef.current = [];
            setNoteTool("draw");
            setNoteColor("#ef4444");
          }
        }
      }, 300);
    }
  }, [showAddNoteModal]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        stream.getTracks().forEach(track => track.stop());

        setSavingAudio(true);
        try {
          const fileName = `Ghi âm_${new Date().toLocaleDateString("vi-VN").replace(/\//g, "-")}_${new Date().toLocaleTimeString("vi-VN").replace(/:/g, "-")}.wav`;
          const audioFile = new File([audioBlob], fileName, { type: "audio/wav" });

          await resourceService.uploadFile(
            audioFile,
            localFolderId === "root" ? null : localFolderId,
            selectedSpace === "personal" ? selectedOwnerId : undefined,
            selectedSpace !== "personal" ? selectedSpace : undefined
          );

          toast.success("Đã tải tệp ghi âm lên thành công!");
          setShowAddAudioModal(false);
          setRecordingSeconds(0);
          setRefreshTrigger(prev => prev + 1);
        } catch (err: any) {
          console.error("Lỗi lưu file ghi âm:", err);
          toast.error(err.message || "Lỗi tải ghi âm lên.");
        } finally {
          setSavingAudio(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 180) {
            clearInterval(timerRef.current);
            mediaRecorder.stop();
            return 180;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error("Lỗi truy cập Microphone:", err);
      toast.error("Không thể kết nối Microphone. Vui lòng cho phép quyền truy cập mic.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setRecordingSeconds(0);
    setShowAddAudioModal(false);
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden bg-[#f8f9fa]"

    >
      {/* Horizontal Sub-tab Switcher */}
      <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-3 pt-2 pb-0 text-xs select-none sm:px-5" id="resource_sub_tabs_bar">
        <div className="flex min-w-0 max-w-full flex-1 gap-1 overflow-x-auto select-none scrollbar-none -mb-px">
          {SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setCurrentPill("KHO_LUU_TRU");
                  setViewingTrash(false);
                  setSearchQuery("");
                  setShowFilters(false);
                  setFilterStartDate("");
                  setFilterEndDate("");
                  setFilterType("");
                  setLocalFolderId(null);
                  setExplorerKey((k) => k + 1);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs transition-all duration-200 cursor-pointer shrink-0 rounded-xl ${
                  active 
                    ? "bg-cyan-600 text-white font-bold shadow-sm" 
                    : "text-slate-650 hover:text-cyan-600 hover:bg-cyan-50 font-semibold"
                }`}
                title={tab.label}
              >
                <Icon className={`h-4.5 w-4.5 shrink-0 ${active ? "text-white" : "text-slate-400"}`} strokeWidth={2} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8f9fa] overflow-hidden">
        {/* Browser Tabs Bar - only render if > 1 tabs or current tab is a google-doc */}
        {(openedTabs.length > 1 || (openedTabs.length === 1 && openedTabs[0].type !== "explorer")) && (
          <div className="h-12 bg-slate-100/90 border-b border-slate-200 flex items-end px-4 gap-1 shrink-0 select-none">
            {openedTabs.map((tab) => {
              const isActive = activeTabId === tab.id;
              const isExplorer = tab.type === "explorer";

              // Get Tab Icon
              let TabIcon = FileIcon;
              let iconColor = "text-slate-400";
              if (isExplorer) {
                TabIcon = FolderOpen;
                iconColor = "text-blue-500";
              } else if (tab.mimeType?.includes("spreadsheet") || tab.title.endsWith(".xlsx")) {
                TabIcon = FileSpreadsheet;
                iconColor = "text-green-600";
              } else if (tab.mimeType?.includes("presentation")) {
                TabIcon = Presentation;
                iconColor = "text-orange-500";
              } else {
                TabIcon = FileText;
                iconColor = "text-blue-500";
              }

              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`group h-9 flex items-center gap-2 px-4 rounded-t-xl text-xs font-bold transition duration-150 cursor-pointer border-x border-t max-w-[180px] ${isActive
                      ? "bg-white text-slate-800 border-slate-200 shadow-xs z-10"
                      : "text-slate-500 bg-slate-200/40 border-transparent hover:bg-slate-200/80 hover:text-slate-700"
                    }`}
                >
                  <TabIcon className={`h-4 w-4 shrink-0 ${iconColor}`} />

                  <span className="truncate max-w-[110px]">{tab.title}</span>

                  {/* Close Button */}
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="p-0.5 rounded-full hover:bg-slate-200 group-hover:opacity-100 opacity-60 text-slate-400 hover:text-slate-600 transition ml-auto"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

            <button
              onClick={handleAddExplorerTab}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition ml-2 mb-1.5"
              title="Thẻ mới"
            >
              <Plus className="h-4.5 w-4.5" />
            </button>
          </div>
        )}

        {/* Unified Top Header Bar */}
        {(() => {
          const activeTab = openedTabs.find(t => t.id === activeTabId);
          if (activeTab?.type === "google-doc") return null;

          return (
            <div className="min-h-16 px-3 sm:px-6 py-2 sm:py-0 border-b border-slate-200 bg-white flex flex-wrap sm:grid sm:grid-cols-3 items-center gap-2 shrink-0 select-none text-left">
              {/* Left: Title & Space Selector Dropdown */}
              <div className="flex items-center gap-2 justify-start">
                <span className="text-base font-extrabold text-slate-800 tracking-tight">Tài nguyên với</span>
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowSpaceDropdown(!showSpaceDropdown)}
                    className="flex items-center gap-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-1.5 transition duration-150 text-xs font-bold text-slate-700 cursor-pointer shadow-xs"
                  >
                    {selectedSpace === "personal" ? (
                      <div className="h-5 w-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                        {getInitials(
                          selectedOwnerId === userProfileId
                            ? (userProfile?.displayName || "Cá nhân")
                            : (allStaff.find(u => (u.uid || u.id) === selectedOwnerId)?.displayName || "NV")
                        )}
                      </div>
                    ) : (
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${getBadgeColor(rooms.find(r => r._id === selectedSpace)?.name || "")}`}>
                        {getInitials(rooms.find(r => r._id === selectedSpace)?.name || "")}
                      </div>
                    )}

                    <span className="uppercase">
                      {selectedSpace === "personal"
                        ? (selectedOwnerId === userProfileId
                          ? (userProfile?.displayName || "Cá nhân")
                          : (allStaff.find(u => (u.uid || u.id) === selectedOwnerId)?.displayName || "Nhân viên")
                        )
                        : (rooms.find(r => r._id === selectedSpace)?.name || "Nhóm chung")
                      }
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${showSpaceDropdown ? "rotate-180" : ""}`} />
                  </button>

                  {showSpaceDropdown && (
                    <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1.5 animate-fadeIn max-h-[300px] overflow-y-auto">
                      <div className="text-[9px] text-slate-400 font-bold px-2.5 py-1 uppercase tracking-wider text-left">Không gian lưu trữ</div>
                      <button
                        onClick={() => {
                          setSelectedSpace("personal");
                          setSelectedOwnerId(userProfileId);
                          setShowSpaceDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-xs font-bold transition ${selectedSpace === "personal" && selectedOwnerId === userProfileId
                            ? "bg-blue-50 text-blue-600"
                            : "hover:bg-slate-50 text-slate-700"
                          }`}
                      >
                        <div className="h-5 w-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                          {getInitials(userProfile?.displayName || "LAT")}
                        </div>
                        <span className="truncate">{userProfile?.displayName ? `${userProfile.displayName} (Tôi)` : "Cá nhân"}</span>
                      </button>

                      {/* Admin/Superadmin: List all employees */}
                      {allStaff.length > 0 && (
                        <>
                          <div className="border-t border-slate-100 my-1"></div>
                          <div className="text-[9px] text-slate-400 font-bold px-2.5 py-1 uppercase tracking-wider text-left">Không gian nhân sự</div>
                          <div className="max-h-48 overflow-y-auto">
                            {allStaff
                              .filter(u => (u.uid || u.id) !== userProfileId)
                              .map((u) => {
                                const isSelected = selectedSpace === "personal" && selectedOwnerId === (u.uid || u.id);
                                return (
                                  <button
                                    key={u.uid || u.id}
                                    onClick={() => {
                                      setSelectedSpace("personal");
                                      setSelectedOwnerId(u.uid || u.id);
                                      setShowSpaceDropdown(false);
                                    }}
                                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-bold transition ${isSelected
                                        ? "bg-blue-50 text-blue-600"
                                        : "hover:bg-slate-50 text-slate-700"
                                      }`}
                                  >
                                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${getBadgeColor(u.displayName || "")}`}>
                                      {getInitials(u.displayName || "")}
                                    </div>
                                    <span className="truncate">{u.displayName}</span>
                                  </button>
                                );
                              })}
                          </div>
                        </>
                      )}

                      {rooms.length > 0 && (
                        <>
                          <div className="border-t border-slate-100 my-1"></div>
                          <div className="text-[9px] text-slate-400 font-bold px-2.5 py-1 uppercase tracking-wider text-left">Nhóm chung (Chat)</div>
                          {rooms.map((room) => {
                            const isSelected = selectedSpace === room._id;
                            return (
                              <button
                                key={room._id}
                                onClick={() => {
                                  setSelectedSpace(room._id);
                                  setShowSpaceDropdown(false);
                                }}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs font-bold transition ${isSelected
                                    ? "bg-blue-50 text-blue-600"
                                    : "hover:bg-slate-50 text-slate-700"
                                  }`}
                              >
                                <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${getBadgeColor(room.name || "")}`}>
                                  {getInitials(room.name || "")}
                                </div>
                                <span className="truncate">{room.name}</span>
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Center: Pill tabs - Kho lưu trữ & Được chia sẻ */}
              <div className="flex items-center justify-center">
                {subTab === "TÀI LIỆU KHÁC" && (
                  <div className="flex items-center gap-1.5 bg-slate-100/90 rounded-2xl p-1 border border-slate-200/60 shadow-inner">
                    <button
                      onClick={() => { setCurrentPill("KHO_LUU_TRU"); setViewingTrash(false); }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${currentPill === "KHO_LUU_TRU"
                          ? "bg-cyan-600 text-white font-bold shadow-sm"
                          : "text-slate-600 hover:text-cyan-600 hover:bg-slate-200/60"
                        }`}
                    >
                      Kho lưu trữ
                    </button>
                    <button
                      onClick={() => { setCurrentPill("DUOC_CHIA_SE"); setViewingTrash(false); }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${currentPill === "DUOC_CHIA_SE"
                          ? "bg-cyan-600 text-white font-bold shadow-sm"
                          : "text-slate-600 hover:text-cyan-600 hover:bg-slate-200/60"
                        }`}
                    >
                      Được chia sẻ
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Thùng rác / Quay lại */}
              <div className="flex items-center justify-end">
                {subTab === "TÀI LIỆU KHÁC" && currentPill === "KHO_LUU_TRU" ? (
                  <button
                    onClick={() => setViewingTrash(!viewingTrash)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl text-xs font-bold transition bg-white shadow-xs cursor-pointer"
                  >
                    {viewingTrash ? (
                      <>
                        <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
                        <span>Quay lại</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                        <span>Thùng rác</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="h-8 w-24"></div> // Khung giữ chỗ để không bị nhảy layout
                )}
              </div>
            </div>
          );
        })()}

        {/* Tab Contents wrapper */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
          {(() => {
            const activeTab = openedTabs.find(t => t.id === activeTabId);
            if (activeTab?.type === "google-doc") {
              return (
                <div className="flex-1 bg-white flex flex-col overflow-hidden">
                  <iframe
                    src={activeTab.url}
                    title={activeTab.title}
                    className="w-full h-full border-0"
                    allow="autoplay; encrypted-media; clipboard-write; clipboard-read"
                  ></iframe>
                </div>
              );
            }


            return (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Unified Toolbar Row matching image 1 */}
                <div className="min-h-16 px-3 sm:px-6 py-2 sm:py-0 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-white select-none">
                  {/* Left side search & count */}
                  <div className="flex flex-col items-start gap-1">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Tên file..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full text-xs bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-bold"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 pl-1 text-left">
                      {`${localItemsCount.count}/${localItemsCount.total} tệp`}
                    </span>
                  </div>

                  {/* Right side actions */}
                  <div className="flex items-center gap-2 overflow-visible max-w-full">
                    {/* Filters icon button */}
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`p-2 rounded-xl transition active:scale-95 border flex items-center justify-center h-9 w-9 cursor-pointer relative ${showFilters
                          ? "bg-slate-900 border-slate-900 text-white"
                          : "bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 border-slate-200"
                        }`}
                      title="Bộ lọc"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      {activeFiltersCount > 0 && (
                        <span className={cn(
                          "absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[9px] font-black shadow-sm",
                          showFilters ? "bg-white text-slate-900" : "bg-cyan-600 text-white"
                        )}>
                          {activeFiltersCount}
                        </span>
                      )}
                    </button>

                    {/* List/grid toggle */}
                    <button
                      onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                      className="p-2 hover:bg-slate-50 rounded-xl text-slate-500 hover:text-slate-800 transition active:scale-95 border border-slate-200 bg-white flex items-center justify-center h-9 w-9 cursor-pointer"
                      title={viewMode === "grid" ? "Xem dạng danh sách" : "Xem dạng lưới"}
                    >
                      {viewMode === "grid" ? (
                        <List className="h-4.5 w-4.5" />
                      ) : (
                        <LayoutGrid className="h-4.5 w-4.5" />
                      )}
                    </button>

                    {/* Popover Add Button */}
                    {!viewingTrash && localFolderId !== "chat-attachments" && (
                      <div className="relative" ref={addMenuRef}>
                        <button
                          onClick={() => setShowAddMenu(!showAddMenu)}
                          className="p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl transition duration-150 active:scale-95 shadow-md shadow-teal-500/10 flex items-center justify-center h-9 w-9 cursor-pointer"
                          title="Thêm mới"
                        >
                          <Plus className="h-4 w-4" />
                        </button>

                        {showAddMenu && (
                          <div className="absolute left-1/2 -translate-x-1/2 mt-1.5 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1.5 animate-fadeIn text-left">
                            {/* Tải tệp lên */}
                            <button
                              onClick={() => {
                                fileInputRef.current?.click();
                                setShowAddMenu(false);
                              }}
                              disabled={uploading}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
                            >
                              {uploading ? (
                                <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                              ) : (
                                <Upload className="h-4.5 w-4.5 text-teal-600" />
                              )}
                              <span>Tải tệp lên</span>
                            </button>

                            {/* Thêm thư mục */}
                            <button
                              onClick={() => {
                                setCreateFileDialog({
                                  isOpen: true,
                                  type: "folder",
                                  title: "Thêm thư mục mới",
                                  placeholder: "Nhập tên thư mục..."
                                });
                                setShowAddMenu(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
                            >
                              <Folder className="h-4.5 w-4.5 text-[#7bc8c4]" />
                              <span>Thêm thư mục</span>
                            </button>

                            {/* Thêm liên kết */}
                            <button
                              onClick={() => {
                                setShowAddLinkModal(true);
                                setShowAddMenu(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
                            >
                              <Link className="h-4.5 w-4.5 text-slate-400" />
                              <span>Thêm liên kết</span>
                            </button>

                            {/* Thêm ghi chú */}
                            <button
                              onClick={() => {
                                setShowAddNoteModal(true);
                                setShowAddMenu(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
                            >
                              <FileText className="h-4.5 w-4.5 text-orange-500" />
                              <span>Thêm ghi chú</span>
                            </button>

                            {/* Thêm ghi âm */}
                            <button
                              onClick={() => {
                                setShowAddAudioModal(true);
                                setShowAddMenu(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
                            >
                              <Mic className="h-4.5 w-4.5 text-blue-500" />
                              <span>Thêm ghi âm</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <input
                      type="file"
                      multiple
                      ref={fileInputRef}
                      onChange={onFileChange}
                      className="hidden"
                    />

                    {/* Tiến trình tải lên nhiều tệp */}
                    <UploadProgressPanel queue={uploadQueue} onClose={() => setUploadQueue([])} />

                    {/* Reload/sync button */}
                    <button
                      onClick={() => setRefreshTrigger(prev => prev + 1)}
                      disabled={loading}
                      className="p-2 hover:bg-slate-50 rounded-xl text-slate-500 hover:text-slate-800 transition active:scale-95 border border-slate-200 bg-white flex items-center justify-center h-9 w-9 cursor-pointer"
                      title="Làm mới"
                    >
                      <RefreshCw className={`h-4.5 w-4.5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Advanced Filters Panel matching mockup */}
                {showFilters && subTab === "TÀI LIỆU KHÁC" && (
                  <div className="px-4 sm:px-6 py-3 border-b border-slate-100 bg-[#fbfcfc] flex flex-col gap-3 animate-fadeIn shrink-0 select-none text-left">
                    {/* CSS override to hide default browser date picker indicators but make them clickable */}
                    <style>{`
                      .style-date-input::-webkit-calendar-picker-indicator {
                        opacity: 0;
                        width: 100%;
                        height: 100%;
                        position: absolute;
                        left: 0;
                        top: 0;
                        cursor: pointer;
                        z-index: 10;
                      }
                      .style-date-input {
                        position: relative;
                        z-index: 5;
                      }
                    `}</style>

                    {/* Date filters and Clear button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Từ ngày */}
                        <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs hover:border-slate-300 transition duration-150 w-full sm:w-auto">
                          <input
                            type={filterStartDate ? "date" : "text"}
                            onFocus={(e) => (e.target.type = "date")}
                            onBlur={(e) => {
                              if (!e.target.value) e.target.type = "text";
                            }}
                            placeholder="Từ ngày"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="text-xs font-bold text-slate-700 bg-transparent focus:outline-hidden pr-6 w-full sm:w-28 cursor-pointer style-date-input"
                          />
                          <Calendar className="absolute right-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Đến ngày */}
                        <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs hover:border-slate-300 transition duration-150 w-full sm:w-auto">
                          <input
                            type={filterEndDate ? "date" : "text"}
                            onFocus={(e) => (e.target.type = "date")}
                            onBlur={(e) => {
                              if (!e.target.value) e.target.type = "text";
                            }}
                            placeholder="Đến ngày"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="text-xs font-bold text-slate-700 bg-transparent focus:outline-hidden pr-6 w-full sm:w-28 cursor-pointer style-date-input"
                          />
                          <Calendar className="absolute right-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        </div>
                      </div>

                      {/* Clear Filter button if any is active */}
                      {(filterStartDate || filterEndDate || filterType) && (
                        <button
                          onClick={() => {
                            setFilterStartDate("");
                            setFilterEndDate("");
                            setFilterType("");
                          }}
                          className="text-[10px] font-black text-rose-500 hover:text-rose-700 transition uppercase tracking-wider cursor-pointer text-left sm:text-right"
                        >
                          Xóa lọc
                        </button>
                      )}
                    </div>

                    {/* Filter Type Pills Row (Scrollable horizontally on mobile, wrapped on desktop) */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none whitespace-nowrap">
                      {[
                        { value: "folder", label: "Thư mục" },
                        { value: "image", label: "Hình ảnh" },
                        { value: "audio", label: "Âm thanh" },
                        { value: "video", label: "Video" },
                        { value: "pdf", label: "PDF" },
                        { value: "document", label: "Tài liệu" },
                        { value: "spreadsheet", label: "Bảng tính" },
                        { value: "presentation", label: "Bản trình bày" },
                        { value: "link", label: "Liên kết" }
                      ].map((type) => {
                        const isActive = filterType === type.value;
                        return (
                          <button
                            key={type.value}
                            onClick={() => setFilterType(isActive ? "" : type.value)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition duration-150 cursor-pointer border flex-shrink-0 ${isActive
                                ? "bg-slate-800 border-slate-800 text-white shadow-xs"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                              }`}
                          >
                            {type.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden relative text-left">
                  <div className="h-full w-full overflow-y-auto p-3 sm:p-6">
                      <FileExplorer
                        key={explorerKey}
                        onOpenFile={handleOpenFile}
                        searchQuery={searchQuery}
                        refreshTrigger={refreshTrigger}
                        onFolderChange={setLocalFolderId}
                        onItemsCountChange={handleItemsCountChange}
                        ownerId={selectedSpace === "personal" ? selectedOwnerId : undefined}
                        roomId={selectedSpace !== "personal" ? selectedSpace : undefined}
                        showTrash={viewingTrash}
                        users={allStaff}
                        rooms={rooms}
                        showSharedOnly={currentPill === "DUOC_CHIA_SE"}
                        filterStartDate={filterStartDate}
                        filterEndDate={filterEndDate}
                        filterType={filterType}
                        viewMode={viewMode}
                      />
                    </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Create Document/Folder Modal Dialog */}
      {createFileDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 border border-slate-100 flex flex-col gap-4 text-left max-h-[90dvh] overflow-y-auto overscroll-contain">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                {createFileDialog.type === "document" && <FileText className="h-6 w-6" />}
                {createFileDialog.type === "spreadsheet" && <FileSpreadsheet className="h-6 w-6" />}
                {createFileDialog.type === "presentation" && <Presentation className="h-6 w-6" />}
                {createFileDialog.type === "folder" && <FolderPlus className="h-6 w-6" />}
                {createFileDialog.type === "link" && <LinkIcon className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">{createFileDialog.title}</h3>
                <p className="text-[10px] text-slate-400">Tạo thư mục mới trong kho tài liệu nội bộ</p>
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder={createFileDialog.placeholder}
                className="w-full text-xs rounded-xl border border-slate-200 px-4 py-2.5 outline-hidden focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-semibold"
                autoFocus
              />
              {createFileDialog.type === "link" && (
                <input
                  type="text"
                  value={newFileLink}
                  onChange={(e) => setNewFileLink(e.target.value)}
                  placeholder="Dán đường dẫn link (General link hoặc Google Drive link)..."
                  className="w-full text-xs rounded-xl border border-slate-200 px-4 py-2.5 outline-hidden focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-semibold"
                />
              )}
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                onClick={() => {
                  setCreateFileDialog(null);
                  setNewFileName("");
                  setNewFileLink("");
                }}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition active:scale-95"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateFile}
                disabled={creatingFile || !newFileName.trim() || (createFileDialog.type === "link" && !newFileLink.trim())}
                className="flex-1 rounded-xl bg-cyan-600 hover:bg-cyan-700 py-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-55 flex items-center justify-center gap-1.5"
              >
                {creatingFile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Tạo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Link Modal Dialog */}
      {showAddLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-y-auto border border-slate-100 flex flex-col text-left relative animate-fadeIn max-h-[90dvh] overscroll-contain">
            {/* Close button X */}
            <button
              onClick={() => {
                setShowAddLinkModal(false);
                setLinkName("");
                setLinkUrl("");
              }}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 transition cursor-pointer z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-6 pb-4">
              <h3 className="text-base font-bold text-slate-800 mb-6">Thêm liên kết</h3>

              <div className="space-y-4">
                {/* Trong */}
                <div className="flex items-center gap-4">
                  <span className="w-16 text-xs font-bold text-slate-400">Trong</span>
                  <span className="text-xs font-bold text-slate-800">
                    {selectedSpace === "personal"
                      ? "Kho lưu trữ của tôi"
                      : (rooms.find(r => r._id === selectedSpace)?.name || "Thư mục hiện tại")
                    }
                  </span>
                </div>

                {/* Tên */}
                <div className="flex items-center gap-4">
                  <span className="w-16 text-xs font-bold text-slate-400">Tên</span>
                  <input
                    type="text"
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    placeholder="Nhập tên hiển thị..."
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-4 py-2.5 outline-hidden focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 font-semibold text-slate-700"
                  />
                </div>

                {/* URL */}
                <div className="flex items-center gap-4">
                  <span className="w-16 text-xs font-bold text-slate-400">URL</span>
                  <input
                    type="text"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-4 py-2.5 outline-hidden focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 font-semibold text-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end gap-2.5 px-6 py-4 bg-slate-50/50 border-t border-slate-100">
              <button
                onClick={() => {
                  setShowAddLinkModal(false);
                  setLinkName("");
                  setLinkUrl("");
                }}
                className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition active:scale-95 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveLink}
                disabled={savingLink || !linkName.trim() || !linkUrl.trim()}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-xs font-bold text-white transition active:scale-95 disabled:opacity-55 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingLink && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal Dialog */}
      {showAddNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-5xl h-[85vh] shadow-2xl overflow-hidden border border-slate-100 flex flex-col text-left relative animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">Thêm ghi chú</h3>
                <span className="text-xs text-slate-400">
                  Trong{" "}
                  <strong className="text-slate-600">
                    {selectedSpace === "personal"
                      ? "Kho lưu trữ của tôi"
                      : (rooms.find(r => r._id === selectedSpace)?.name || "Thư mục hiện tại")
                    }
                  </strong>
                </span>
              </div>
              <button
                onClick={() => {
                  setShowAddNoteModal(false);
                  setNoteTitle("");
                  setNoteContent("");
                }}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Interactive Toolbars matching mockup */}
            <div className="bg-slate-50/70 border-b border-slate-100 px-6 py-2 flex flex-wrap items-center gap-3 select-none">

              {/* Text formatting styles (A A A A) with inline colors */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                {[
                  { color: "#000000", label: "A" },
                  { color: "#ef4444", label: "A" },
                  { color: "#22c55e", label: "A" },
                  { color: "#3b82f6", label: "A" }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setNoteTool("text");
                      setNoteColor(item.color);
                    }}
                    style={{ color: item.color }}
                    className={`h-7 w-7 rounded-lg flex items-center justify-center text-sm font-extrabold transition active:scale-95 cursor-pointer ${noteTool === "text" && noteColor === item.color
                        ? "bg-slate-100 ring-2 ring-slate-300"
                        : "hover:bg-slate-50"
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Arrow symbols colors with inline colors */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                {[
                  { color: "#ef4444", label: "↗" },
                  { color: "#22c55e", label: "↗" },
                  { color: "#3b82f6", label: "↗" }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setNoteTool("arrow");
                      setNoteColor(item.color);
                    }}
                    style={{ color: item.color }}
                    className={`h-7 w-7 rounded-lg flex items-center justify-center text-sm font-extrabold transition active:scale-95 cursor-pointer ${noteTool === "arrow" && noteColor === item.color
                        ? "bg-slate-100 ring-2 ring-slate-300"
                        : "hover:bg-slate-50"
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Shape boxes color options with inline colors */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                {[
                  { color: "#ef4444" },
                  { color: "#22c55e" },
                  { color: "#3b82f6" }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setNoteTool("rect");
                      setNoteColor(item.color);
                    }}
                    className={`h-7 w-7 rounded-lg flex items-center justify-center transition active:scale-95 cursor-pointer ${noteTool === "rect" && noteColor === item.color
                        ? "bg-slate-100 ring-2 ring-slate-300"
                        : "hover:bg-slate-50"
                      }`}
                  >
                    <div
                      style={{ borderColor: item.color }}
                      className="h-4 w-4 rounded-xs border-2"
                    />
                  </button>
                ))}
              </div>

              {/* Pen Free Draw Tool with Dropdown */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                <button
                  onClick={() => {
                    setNoteTool("draw");
                  }}
                  className={`h-7 w-7 rounded-lg flex items-center justify-center transition active:scale-95 cursor-pointer ${noteTool === "draw" ? "bg-slate-100 ring-2 ring-slate-300" : "hover:bg-slate-50"
                    }`}
                  title="Cái bút vẽ tự do"
                >
                  <Pencil className="h-4 w-4 text-slate-700" />
                </button>

                <select
                  value={noteColor}
                  onChange={(e) => {
                    setNoteColor(e.target.value);
                    setNoteTool("draw");
                  }}
                  className="text-[10px] bg-slate-50 border border-slate-200 rounded-lg py-0.5 px-1 font-bold text-slate-700 focus:outline-hidden cursor-pointer"
                >
                  <option value="#000000">Đen</option>
                  <option value="#ef4444">Đỏ</option>
                  <option value="#22c55e">Xanh lá</option>
                  <option value="#3b82f6">Xanh dương</option>
                  <option value="#f59e0b">Vàng</option>
                  <option value="#8b5cf6">Tím</option>
                </select>
              </div>

              {/* Đường nét thẳng */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                <button
                  onClick={() => {
                    setNoteTool("line");
                  }}
                  className={`h-7 w-7 rounded-lg flex items-center justify-center transition active:scale-95 cursor-pointer ${noteTool === "line" ? "bg-slate-100 ring-2 ring-slate-300" : "hover:bg-slate-50"
                    }`}
                  title="Vẽ đường nét thẳng"
                >
                  <span className="text-base font-extrabold italic select-none" style={{ color: noteColor }}>╱</span>
                </button>
              </div>

              {/* Tải ảnh lên */}
              <button
                onClick={() => noteImageInputRef.current?.click()}
                className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl flex items-center gap-1.5 text-xs font-bold text-slate-600 transition active:scale-95 shadow-2xs cursor-pointer"
                title="Tải ảnh lên"
              >
                <ImageIcon className="h-4 w-4 text-emerald-500" />
                <span>Tải ảnh lên</span>
              </button>
              <input
                type="file"
                ref={noteImageInputRef}
                accept="image/*"
                onChange={handleNoteImageUpload}
                className="hidden"
              />

              {/* Đồng ý chèn ảnh */}
              {editingImage && (
                <button
                  onClick={confirmApplyImage}
                  className="h-9 px-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl flex items-center gap-1 text-xs font-bold text-white transition active:scale-95 shadow-md cursor-pointer animate-pulse"
                >
                  <span>✓ Xác nhận chèn ảnh</span>
                </button>
              )}

              {/* Undo / Redo - To hơn */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs ml-auto">
                <button
                  onClick={handleNoteUndo}
                  className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-50 text-slate-700 active:scale-95 transition cursor-pointer"
                  title="Hoàn tác (Undo)"
                >
                  <Undo2 className="h-5.5 w-5.5 stroke-[2.5]" />
                </button>
                <button
                  onClick={handleNoteRedo}
                  className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-50 text-slate-700 active:scale-95 transition cursor-pointer"
                  title="Làm lại (Redo)"
                >
                  <Redo2 className="h-5.5 w-5.5 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Note Editor Area (Title + Canvas) */}
            <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden relative">
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Tiêu đề ghi chú..."
                className="w-full text-lg font-bold text-slate-800 outline-hidden border-b border-slate-100 pb-2 placeholder-slate-300"
              />

              {/* Canvas Wrapper */}
              <div className="flex-1 border border-slate-200/80 rounded-2xl overflow-hidden relative bg-white shadow-inner flex">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onClick={handleCanvasClick}
                  style={{
                    cursor: noteTool === "draw"
                      ? "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' style='font-size:24px'><text y='24'>✏️</text></svg>\") 0 24, auto"
                      : "crosshair"
                  }}
                  className="flex-1 h-full"
                />

                {/* Absolute Text Input overlay for 'text' tool */}
                {noteTextInput.isOpen && (
                  <input
                    ref={textInputRef}
                    type="text"
                    value={noteTextInput.value}
                    onChange={(e) => setNoteTextInput(prev => ({ ...prev, value: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTextInput();
                      if (e.key === "Escape") {
                        setNoteTextInput({ isOpen: false, x: 0, y: 0, value: "" });
                      }
                    }}
                    onBlur={handleSaveTextInput}
                    style={{
                      position: "absolute",
                      left: noteTextInput.x,
                      top: noteTextInput.y - 12,
                      color: noteColor,
                      font: "bold 16px Arial, Helvetica, sans-serif",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      padding: 0,
                      margin: 0,
                      zIndex: 30,
                    }}
                    placeholder="..."
                  />
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2.5 px-6 py-4 bg-slate-50/50 border-t border-slate-100">
              <button
                onClick={() => {
                  setShowAddNoteModal(false);
                  setNoteTitle("");
                  setNoteContent("");
                }}
                className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition active:scale-95 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveNote}
                disabled={savingNote}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-xs font-bold text-white transition active:scale-95 disabled:opacity-55 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingNote && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Audio Modal Dialog */}
      {showAddAudioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-y-auto border border-slate-100 flex flex-col text-left relative animate-fadeIn max-h-[90dvh] overscroll-contain">
            {/* Close button X */}
            <button
              onClick={cancelRecording}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-6 flex flex-col items-center">
              <div className="w-full flex items-center gap-2 mb-6">
                <h3 className="text-base font-bold text-slate-800">Thêm ghi âm</h3>
                <span className="text-[10px] text-slate-400">
                  Trong{" "}
                  <strong className="text-slate-600">
                    {selectedSpace === "personal"
                      ? "Kho lưu trữ của tôi"
                      : (rooms.find(r => r._id === selectedSpace)?.name || "Thư mục hiện tại")
                    }
                  </strong>
                </span>
              </div>

              {/* Big mic indicator */}
              <div className="relative flex items-center justify-center my-6 select-none">
                {/* Wave circle effect when recording */}
                {isRecording && (
                  <div className="absolute h-24 w-24 rounded-full bg-red-100 border-2 border-red-200 animate-ping opacity-75"></div>
                )}

                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={savingAudio}
                  className={`h-20 w-20 rounded-full flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer z-10 ${isRecording
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-cyan-50 hover:bg-cyan-100 text-cyan-600"
                    }`}
                >
                  <Mic className={`h-8 w-8 ${isRecording ? "animate-pulse" : ""}`} />
                </button>
              </div>

              {/* Timer displaying 00:00:00 */}
              <div className="text-lg font-bold text-orange-500 mb-2">
                {new Date(recordingSeconds * 1000).toISOString().substr(11, 8)}
              </div>

              <div className="text-xs text-slate-400 text-center font-medium mb-2">
                {isRecording ? "Đang ghi âm..." : "Nhấn nút để bắt đầu ghi âm"}
              </div>

              <div className="text-[10px] text-slate-400 text-center font-semibold bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                Thời gian ghi âm tối đa: 180s
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2.5 px-6 py-4 bg-slate-50/50 border-t border-slate-100 w-full">
              <button
                onClick={cancelRecording}
                className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition active:scale-95 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={stopRecording}
                disabled={!isRecording || savingAudio}
                className="px-5 py-2.5 rounded-xl bg-[#7bc8c4] hover:bg-[#5bb8b4] text-xs font-bold text-white transition active:scale-95 disabled:opacity-55 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingAudio && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
