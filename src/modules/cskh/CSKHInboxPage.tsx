import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Send,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Clock,
  Phone,
  Wrench,
  User,
  ShieldCheck,
  RefreshCw,
  RotateCw,
  MessageSquare,
  ChevronRight,
  Bot,
  Filter,
  Settings,
} from "lucide-react";
import { cskhApi, type CskhConversation, type CskhMessage } from "./api/cskh.api";
import { useAuth } from "../../context/AuthContext";
import { toast } from "../../pages/Toast";
import ZaloSettingsModal from "./components/ZaloSettingsModal";

const QUICK_PROMPTS = [
  { label: "Báo giá sửa", prompt: "Soạn tin nhắn thông báo chi phí linh kiện và tiền công thay thế cần khách duyệt." },
  { label: "Máy đã kiểm tra", prompt: "Soạn tin nhắn báo đã kiểm tra xong tình trạng máy, mời khách xem phương án xử lý." },
  { label: "Hẹn lấy máy", prompt: "Soạn tin nhắn báo máy đã sửa xong, mời khách ghé lấy trong giờ làm việc." },
  { label: "Cảm ơn & BH", prompt: "Soạn tin nhắn cảm ơn quý khách và thông báo chính sách bảo hành sau sửa chữa." },
];

export default function CSKHInboxPage() {
  const { userProfile } = useAuth();
  const [conversations, setConversations] = useState<CskhConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<CskhConversation | null>(null);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<CskhMessage[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [sending, setSending] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [zaloModalOpen, setZaloModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load danh sách hội thoại
  const loadConversations = useCallback(async (selectId?: string) => {
    try {
      setLoadingList(true);
      const res = await cskhApi.listConversations({
        status: statusFilter === "all" ? undefined : statusFilter,
        q: searchQuery || undefined,
      });
      setConversations(res.items);
      if (res.items.length > 0) {
        if (selectId && res.items.some((c) => c._id === selectId)) {
          setActiveConvId(selectId);
        } else if (!activeConvId || !res.items.some((c) => c._id === activeConvId)) {
          setActiveConvId(res.items[0]._id);
        }
      } else {
        setActiveConvId(null);
        setActiveConv(null);
        setActiveTicket(null);
        setMessages([]);
      }
    } catch (err: any) {
      toast.error(err?.message || "Không thể tải danh sách hội thoại CSKH.");
    } finally {
      setLoadingList(false);
    }
  }, [statusFilter, searchQuery, activeConvId]);

  useEffect(() => {
    void loadConversations();
  }, [statusFilter, searchQuery]);

  // Lắng nghe sự kiện cskh:open-chat từ phiếu sửa chữa
  useEffect(() => {
    const handleOpenChat = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !detail.ticketId) return;
      try {
        const conv = await cskhApi.openByTicket({
          ticketId: detail.ticketId,
          ticketCode: detail.ticketCode,
          customerName: detail.customerName,
          customerPhone: detail.customerPhone,
        });
        toast.success(`Đã mở phiên chat CSKH cho phiếu ${detail.ticketCode || ""}`);
        await loadConversations(conv._id);
        setActiveConvId(conv._id);
      } catch (err: any) {
        toast.error(err?.message || "Không mở được phiên chat CSKH.");
      }
    };
    window.addEventListener("cskh:open-chat", handleOpenChat);
    return () => window.removeEventListener("cskh:open-chat", handleOpenChat);
  }, [loadConversations]);

  // Load chi tiết hội thoại và tin nhắn khi đổi activeConvId
  useEffect(() => {
    if (!activeConvId) return;
    let isCurrent = true;
    setLoadingMessages(true);
    Promise.all([
      cskhApi.getConversation(activeConvId),
      cskhApi.listMessages(activeConvId),
      cskhApi.markRead(activeConvId),
    ])
      .then(([convData, msgList]) => {
        if (!isCurrent) return;
        setActiveConv(convData.conversation);
        setActiveTicket(convData.ticket);
        setMessages(msgList);
        // Cập nhật lại unreadCount trên danh sách
        setConversations((prev) =>
          prev.map((c) => (c._id === activeConvId ? { ...c, unreadCount: 0 } : c))
        );
      })
      .catch((err) => {
        if (isCurrent) toast.error(err?.message || "Không tải được tin nhắn.");
      })
      .finally(() => {
        if (isCurrent) setLoadingMessages(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [activeConvId]);

  // Tự cuộn xuống đáy tin nhắn
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Gửi tin nhắn
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputMessage.trim();
    if (!content || !activeConvId || sending) return;

    setSending(true);
    try {
      const newMsg = await cskhApi.sendMessage(activeConvId, {
        content,
        senderType: "staff",
      });
      setMessages((prev) => [...prev, newMsg]);
      setInputMessage("");
      // Cập nhật lastMessage trên danh sách
      setConversations((prev) =>
        prev.map((c) =>
          c._id === activeConvId
            ? { ...c, lastMessage: content, lastMessageAt: new Date().toISOString() }
            : c
        )
      );
    } catch (err: any) {
      toast.error(err?.message || "Gửi tin nhắn thất bại.");
    } finally {
      setSending(false);
    }
  };

  // AI Copilot gợi ý câu trả lời
  const handleAiSuggest = async (customPrompt?: string) => {
    if (!activeConvId || loadingAi) return;
    setLoadingAi(true);
    try {
      const res = await cskhApi.getAiSuggestion(activeConvId, customPrompt);
      if (res.suggestion) {
        setInputMessage(res.suggestion);
        toast.success("AI Marketing đã soạn sẵn phản hồi!");
      }
    } catch (err: any) {
      toast.error(err?.message || "Không sinh được câu trả lời từ AI.");
    } finally {
      setLoadingAi(false);
    }
  };

  // Cập nhật trạng thái hội thoại (open/resolved)
  const handleToggleStatus = async () => {
    if (!activeConvId || !activeConv) return;
    const nextStatus = activeConv.status === "open" ? "resolved" : "open";
    try {
      const updated = await cskhApi.updateStatus(activeConvId, nextStatus);
      setActiveConv((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      setConversations((prev) =>
        prev.map((c) => (c._id === activeConvId ? { ...c, status: nextStatus } : c))
      );
      toast.success(nextStatus === "resolved" ? "Đã đóng phiên CSKH." : "Đã mở lại phiên CSKH.");
    } catch (err: any) {
      toast.error(err?.message || "Không cập nhật được trạng thái.");
    }
  };

  return (
    <div className="flex h-[calc(100vh-4.25rem)] min-h-[600px] flex-col overflow-hidden bg-slate-50">
      {/* Top Banner */}
      <div className="flex h-13 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white shadow-xs">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900">
              Hộp Thư CSKH 1-1 & AI Marketing Copilot
            </h1>
            <p className="text-[11px] text-slate-500">
              Chăm sóc khách hàng sửa chữa & bán lẻ · Anh Khoa Mobile
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZaloModalOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer shadow-2xs"
            title="Cài đặt kết nối Zalo OA cho các trung tâm"
          >
            <Settings className="h-3.5 w-3.5 text-blue-600" />
            Cài đặt Zalo OA
          </button>
          <button
            type="button"
            onClick={() => void loadConversations(activeConvId || undefined)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            <RotateCw className="h-3.5 w-3.5 text-slate-400" />
            Làm mới
          </button>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* CỘT 1: Danh sách khách hàng (Inbox List) */}
        <div className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
          {/* Search & Status Filters */}
          <div className="border-b border-slate-100 p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo tên, SĐT, mã phiếu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs focus:border-sky-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              {(["open", "resolved", "all"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`flex-1 rounded-lg py-1 text-center text-xs font-semibold transition cursor-pointer ${
                    statusFilter === filter
                      ? "bg-sky-100 text-sky-800"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {filter === "open" ? "Đang xử lý" : filter === "resolved" ? "Đã xong" : "Tất cả"}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingList ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <RefreshCw className="mx-auto mb-2 h-4 w-4 animate-spin text-sky-500" />
                Đang tải danh sách...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Không tìm thấy hội thoại nào.
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv._id === activeConvId;
                return (
                  <button
                    key={conv._id}
                    type="button"
                    onClick={() => setActiveConvId(conv._id)}
                    className={`w-full text-left p-3.5 transition flex items-start gap-3 cursor-pointer ${
                      isActive ? "bg-sky-50/80 border-l-4 border-sky-600" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 font-bold text-slate-700 text-xs shadow-2xs">
                      {conv.customerName.slice(0, 2).toUpperCase()}
                      {conv.channel === "zalo" && (
                        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white ring-2 ring-white">
                          Z
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {conv.customerName}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(conv.lastMessageAt).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-slate-500 truncate">{conv.customerPhone}</span>
                        {conv.ticketCode && (
                          <span className="rounded bg-sky-100 px-1 py-0.2 text-[10px] font-bold text-sky-700 truncate">
                            {conv.ticketCode}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-600 truncate font-normal">
                        {conv.lastMessage || "Chưa có tin nhắn"}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* CỘT 2: Khung Chat 2 chiều + AI Copilot */}
        {activeConv ? (
          <div className="flex flex-1 min-w-0 flex-col bg-slate-100/60">
            {/* Chat Header */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700 font-bold text-xs shrink-0">
                  {activeConv.customerName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 truncate">
                      {activeConv.customerName}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">({activeConv.customerPhone})</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        activeConv.status === "open"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {activeConv.status === "open" ? "Đang mở" : "Đã giải quyết"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>Kênh: {activeConv.channel.toUpperCase()}</span>
                    {activeConv.ticketCode && <span>· Phiếu: {activeConv.ticketCode}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* 1-Click mở Zalo Chat ngoài đời */}
                <a
                  href={`https://zalo.me/${activeConv.customerPhone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-2xs"
                  title="Mở ứng dụng hoặc web Zalo chat trực tiếp"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Mở Zalo Direct
                </a>
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer ${
                    activeConv.status === "open"
                      ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {activeConv.status === "open" ? "Đóng phiên" : "Mở lại"}
                </button>
              </div>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  <RefreshCw className="mx-auto mb-2 h-4 w-4 animate-spin text-sky-500" />
                  Đang tải nội dung cuộc hội thoại...
                </div>
              ) : messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                  Chưa có tin nhắn nào. Bấm vào nút AI gợi ý hoặc gõ tin nhắn bên dưới để bắt đầu.
                </div>
              ) : (
                messages.map((msg) => {
                  const isStaff = msg.senderType === "staff";
                  const isAi = msg.senderType === "ai";
                  return (
                    <div
                      key={msg._id}
                      className={`flex flex-col ${isStaff ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400">
                        {isAi && <Bot className="h-3 w-3 text-purple-600" />}
                        <span className="font-semibold text-slate-600">
                          {isStaff ? msg.senderName || "Nhân viên CSKH" : isAi ? "Trợ lý AI" : msg.senderName}
                        </span>
                        <span>·</span>
                        <span>{new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs leading-relaxed whitespace-pre-wrap ${
                          isStaff
                            ? "bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-tr-xs"
                            : isAi
                            ? "bg-purple-50 border border-purple-200 text-purple-950 rounded-tl-xs"
                            : "bg-white border border-slate-200 text-slate-800 rounded-tl-xs"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* AI Copilot Suggestion Bar */}
            <div className="border-t border-slate-200 bg-white p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={loadingAi}
                  onClick={() => void handleAiSuggest()}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:from-purple-700 hover:to-indigo-700 transition cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className={`h-3.5 w-3.5 ${loadingAi ? "animate-spin" : ""}`} />
                  {loadingAi ? "AI đang soạn..." : "✨ AI Gợi ý phản hồi"}
                </button>
                <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden sm:block" />
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    type="button"
                    disabled={loadingAi}
                    onClick={() => void handleAiSuggest(qp.prompt)}
                    className="rounded-lg border border-purple-100 bg-purple-50/60 px-2 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 transition cursor-pointer disabled:opacity-50"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>

              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="mt-2 flex items-center gap-2">
                <textarea
                  rows={2}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  placeholder="Nhập nội dung trao đổi với khách (Nhấn Enter để gửi, Shift+Enter để xuống dòng)..."
                  className="flex-1 resize-none rounded-xl border border-slate-300 bg-white p-2.5 text-xs focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || sending}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs hover:bg-sky-700 transition cursor-pointer disabled:opacity-50"
                  title="Gửi tin nhắn"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-slate-50 text-center p-8">
            <div className="max-w-sm space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <MessageSquare className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-sm text-slate-800">Chọn cuộc trò chuyện để bắt đầu</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Chọn một khách hàng bên cột trái hoặc bấm nút "Nhắn tin CSKH" trên phiếu sửa chữa để mở phiên chat.
              </p>
            </div>
          </div>
        )}

        {/* CỘT 3: Hồ sơ Phiếu Sửa Chữa (Mini CRM Context) */}
        {activeConv && (
          <div className="hidden lg:flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white p-4 overflow-y-auto">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Wrench className="h-4 w-4 text-sky-600" />
              <b className="font-bold text-xs text-slate-900">Hồ sơ phiếu sửa chữa</b>
            </div>

            {activeTicket ? (
              <div className="mt-3 space-y-3 text-xs">
                {/* Thông tin thiết bị */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-700">{activeTicket.ticketCode}</span>
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                      {activeTicket.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px]">Thiết bị:</span>
                    <p className="font-semibold text-slate-800">
                      {activeTicket.device?.name || "Không có tên"}
                    </p>
                    {activeTicket.device?.serialNumber && (
                      <p className="text-[11px] text-slate-500 font-mono">
                        S/N: {activeTicket.device.serialNumber}
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px]">Tình trạng khách báo:</span>
                    <p className="text-slate-700 italic">
                      "{activeTicket.symptom || "—"}"
                    </p>
                  </div>
                </div>

                {/* Kỹ thuật viên & Chi phí */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">KTV phụ trách:</span>
                    <span className="font-bold text-slate-800">
                      {activeTicket.technicianName || "Chưa phân công"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Tổng chi phí:</span>
                    <span className="font-bold text-rose-600">
                      {Number(activeTicket.totalAmount || activeTicket.quotedAmount || 0).toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Đã thanh toán:</span>
                    <span className="text-slate-600">
                      {Number(activeTicket.paidAmount || 0).toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Còn nợ:</span>
                    <span className="font-semibold text-rose-700">
                      {Number(activeTicket.dueAmount || 0).toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                </div>

                {/* Quick Timeline 4 bước */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
                  <span className="font-bold text-[11px] text-slate-700 uppercase tracking-wide">
                    Tiến độ 4 bước thông báo:
                  </span>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                      <CheckCircle2 className="h-3 w-3" /> 1. Tiếp nhận máy
                    </div>
                    <div className={`flex items-center gap-1.5 ${activeTicket.technicianId ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
                      <CheckCircle2 className="h-3 w-3" /> 2. Phân công thợ
                    </div>
                    <div className={`flex items-center gap-1.5 ${["done", "delivered"].includes(activeTicket.status) ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
                      <CheckCircle2 className="h-3 w-3" /> 3. Sửa xong
                    </div>
                    <div className={`flex items-center gap-1.5 ${activeTicket.status === "delivered" ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
                      <CheckCircle2 className="h-3 w-3" /> 4. Bàn giao & Cảm ơn
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-xs text-slate-400">
                Chưa gắn phiếu sửa chữa cụ thể với khách hàng này.
              </div>
            )}
          </div>
        )}
      </div>

      <ZaloSettingsModal
        isOpen={zaloModalOpen}
        onClose={() => setZaloModalOpen(false)}
        companyCode={userProfile?.companyCode || "ANHKHOA"}
      />
    </div>
  );
}
