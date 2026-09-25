import { apiFetch } from "../../shared/lib/apiFetch";

export interface CskhConversation {
  _id: string;
  companyCode: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  ticketId?: string;
  ticketCode?: string;
  channel: "zalo" | "sms" | "direct" | "web";
  status: "open" | "resolved";
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  assignedStaffId?: string;
  assignedStaffName?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CskhMessage {
  _id: string;
  conversationId: string;
  senderType: "staff" | "customer" | "ai";
  senderId?: string;
  senderName: string;
  content: string;
  attachments?: Array<{ url: string; filename: string; fileType: string }>;
  isRead: boolean;
  createdAt: string;
}

type Envelope<T> = { success: boolean; data: T };

export const cskhApi = {
  async listConversations(params: { status?: "open" | "resolved"; q?: string; page?: number; limit?: number } = {}) {
    return (await apiFetch<Envelope<{ items: CskhConversation[]; total: number; page: number; limit: number }>>(
      "/cskh/conversations",
      { params }
    )).data;
  },

  async getConversation(id: string) {
    return (await apiFetch<Envelope<{ conversation: CskhConversation; ticket: any }>>(
      `/cskh/conversations/${id}`
    )).data;
  },

  async openByTicket(payload: {
    ticketId: string;
    ticketCode?: string;
    customerName: string;
    customerPhone: string;
    channel?: "zalo" | "sms" | "direct" | "web";
  }) {
    return (await apiFetch<Envelope<CskhConversation>>("/cskh/conversations/open-by-ticket", {
      method: "POST",
      body: JSON.stringify(payload),
    })).data;
  },

  async listMessages(conversationId: string, params: { limit?: number; before?: string } = {}) {
    return (await apiFetch<Envelope<CskhMessage[]>>(
      `/cskh/conversations/${conversationId}/messages`,
      { params }
    )).data;
  },

  async sendMessage(
    conversationId: string,
    payload: {
      content: string;
      senderType?: "staff" | "customer" | "ai";
      attachments?: any[];
    }
  ) {
    return (await apiFetch<Envelope<CskhMessage>>(
      `/cskh/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    )).data;
  },

  async markRead(conversationId: string) {
    return (await apiFetch<Envelope<{ success: boolean }>>(
      `/cskh/conversations/${conversationId}/read`,
      { method: "POST" }
    )).data;
  },

  async updateStatus(conversationId: string, status: "open" | "resolved") {
    return (await apiFetch<Envelope<CskhConversation>>(
      `/cskh/conversations/${conversationId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }
    )).data;
  },

  async getAiSuggestion(conversationId: string, instruction?: string) {
    return (await apiFetch<Envelope<{ suggestion: string }>>(
      `/cskh/conversations/${conversationId}/ai-suggest`,
      {
        method: "POST",
        body: JSON.stringify({ instruction }),
      }
    )).data;
  },

  async getZaloConfigs() {
    return (await apiFetch<Envelope<{ configs: CskhZaloConfig[]; branches: CskhBranch[]; hasMasterApp?: boolean }>>(
      "/cskh/zalo-config"
    )).data;
  },

  async saveZaloConfig(payload: Partial<CskhZaloConfig>) {
    return (await apiFetch<Envelope<CskhZaloConfig>>("/cskh/zalo-config", {
      method: "PUT",
      body: JSON.stringify(payload),
    })).data;
  },

  async testZaloConfig(branchId: string = "ALL") {
    return (await apiFetch<Envelope<{ connected: boolean; message: string; oaInfo?: any }>>(
      "/cskh/zalo-config/test",
      {
        method: "POST",
        body: JSON.stringify({ branchId }),
      }
    )).data;
  },

  async disconnectZaloConfig(branchId: string = "ALL") {
    return (await apiFetch<Envelope<CskhZaloConfig>>(
      "/cskh/zalo-config/disconnect",
      {
        method: "POST",
        body: JSON.stringify({ branchId }),
      }
    )).data;
  },

  async getZaloOAuthUrl(branchId: string = "ALL") {
    return (await apiFetch<Envelope<{ authUrl: string; redirectUri: string; appId: string }>>(
      `/cskh/zalo-oauth/authorize?branchId=${encodeURIComponent(branchId)}`
    )).data;
  },
};

export interface CskhBranch {
  _id: string;
  code: string;
  name: string;
}

export interface CskhZaloConfig {
  _id?: string;
  companyCode: string;
  branchId: string;
  branchName?: string;
  oaId: string;
  oaName: string;
  oaAvatar?: string;
  appId: string;
  secretKey: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt?: string;
  webhookSecret?: string;
  isActive: boolean;
  isConnected: boolean;
  lastTestedAt?: string;
  lastTestStatus?: "success" | "failed";
  lastTestMessage?: string;
}
