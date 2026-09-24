import { describe, expect, it, vi, beforeEach } from "vitest";

const configRows: any[] = [];
const branchRows: any[] = [
  { _id: "b1", code: "CN1", name: "Chi nhánh Hà Nội", companyCode: "ANHKHOA", isActive: true },
  { _id: "b2", code: "CN2", name: "Chi nhánh Sài Gòn", companyCode: "ANHKHOA", isActive: true },
];
const conversationRows: any[] = [];
const messageRows: any[] = [];

vi.mock("../models/cskh-zalo-config.model", () => {
  return {
    CskhZaloConfigModel: {
      find: (filter: any) => ({
        lean: async () => configRows.filter((r) => !filter.companyCode || r.companyCode === filter.companyCode),
      }),
      findOne: (filter: any) => {
        const found = configRows.find((r) => {
          if (filter.companyCode && r.companyCode !== filter.companyCode) return false;
          if (filter.branchId && r.branchId !== filter.branchId) return false;
          if (filter.oaId && r.oaId !== filter.oaId) return false;
          return true;
        });
        if (!found) {
          return {
            lean: async () => null,
            save: async () => null,
          };
        }
        return {
          ...found,
          save: async () => found,
          lean: async () => ({ ...found }),
        };
      },
      findOneAndUpdate: (filter: any, update: any) => {
        let found = configRows.find(
          (r) => r.companyCode === filter.companyCode && r.branchId === filter.branchId
        );
        if (!found) {
          found = { ...filter, ...update.$set };
          configRows.push(found);
        } else {
          Object.assign(found, update.$set);
        }
        return {
          ...found,
          lean: async () => ({ ...found }),
        };
      },
      create: async (doc: any) => {
        const created = { ...doc, save: async () => created, lean: async () => ({ ...doc }) };
        configRows.push(created);
        return created;
      },
    },
  };
});

vi.mock("../../../model/branch.model", () => ({
  BranchModel: {
    find: () => ({
      select: () => ({
        lean: async () => branchRows,
      }),
    }),
    findOne: (filter: any) => ({
      select: () => ({
        lean: async () => branchRows.find((b) => b._id === filter._id),
      }),
    }),
  },
}));

vi.mock("../models/cskh-conversation.model", () => ({
  CskhConversationModel: {
    findOne: async (filter: any) => {
      const found = conversationRows.find((c) => {
        if (filter.companyCode && c.companyCode !== filter.companyCode) return false;
        if (filter.customerPhone && c.customerPhone === filter.customerPhone) return true;
        return false;
      });
      if (!found) return null;
      return {
        ...found,
        save: async () => found,
      };
    },
    create: async (doc: any) => {
      const created = { _id: `conv-${conversationRows.length + 1}`, ...doc };
      conversationRows.push(created);
      return {
        ...created,
        save: async () => created,
      };
    },
  },
}));

vi.mock("../models/cskh-message.model", () => ({
  CskhMessageModel: {
    create: async (doc: any) => {
      const created = { _id: `msg-${messageRows.length + 1}`, ...doc };
      messageRows.push(created);
      return created;
    },
  },
}));

const {
  getZaloConfigs,
  saveZaloConfig,
  testZaloConnection,
  handleZaloWebhook,
  getZaloOAuthUrl,
  handleZaloOAuthCallback,
} = await import("./cskh-zalo.service");

describe("cskh-zalo.service", () => {
  beforeEach(() => {
    configRows.length = 0;
    conversationRows.length = 0;
    messageRows.length = 0;
    vi.restoreAllMocks();
  });

  it("should get configs and active branches", async () => {
    configRows.push({ companyCode: "ANHKHOA", branchId: "ALL", oaId: "12345" });
    const result = await getZaloConfigs("ANHKHOA");
    expect(result.configs).toHaveLength(1);
    expect(result.branches).toHaveLength(2);
  });

  it("should save and update Zalo config for branch", async () => {
    const saved = await saveZaloConfig("ANHKHOA", "b1", {
      oaId: "oa_b1",
      accessToken: "token_b1",
      isActive: true,
    });
    expect(saved.branchId).toBe("b1");
    expect(saved.branchName).toBe("Chi nhánh Hà Nội");
    expect(saved.oaId).toBe("oa_b1");
  });

  it("should test connection successfully when Zalo returns error 0", async () => {
    configRows.push({
      companyCode: "ANHKHOA",
      branchId: "ALL",
      oaId: "oa_all",
      accessToken: "valid_token",
      save: async () => {},
    });

    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        error: 0,
        message: "Success",
        data: { name: "Anh Khoa Mobile Official" },
      }),
    } as any);

    const testRes = await testZaloConnection("ANHKHOA", "ALL");
    expect(testRes.connected).toBe(true);
    expect(testRes.message).toContain("Anh Khoa Mobile Official");
  });

  it("should handle webhook user message and create conversation", async () => {
    configRows.push({
      companyCode: "ANHKHOA",
      branchId: "ALL",
      oaId: "oa_all",
    });

    const webhookPayload = {
      event_name: "user_send_text",
      oa_id: "oa_all",
      sender: {
        id: "zalo_user_999",
        name: "Anh Tuấn",
        phone: "0987654321",
      },
      message: {
        text: "Shop ơi máy iPhone 13 của em sửa xong chưa?",
      },
    };

    const res = await handleZaloWebhook(webhookPayload, { companyCode: "ANHKHOA" });
    expect(res.status).toBe("processed");
    expect(conversationRows).toHaveLength(1);
    expect(conversationRows[0].customerName).toBe("Anh Tuấn");
    expect(conversationRows[0].customerPhone).toBe("0987654321");
    expect(conversationRows[0].lastMessage).toContain("iPhone 13");
    expect(messageRows).toHaveLength(1);
    expect(messageRows[0].content).toContain("iPhone 13");
  });

  it("should route webhook to specific branch by query.branchId or oaId", async () => {
    configRows.push({
      companyCode: "ANHKHOA",
      branchId: "b1",
      branchName: "Chi nhánh Hà Nội",
      oaId: "oa_hanoi",
    });

    const payloadBranch1 = {
      event_name: "user_send_text",
      oa_id: "oa_hanoi",
      sender: { id: "user_hanoi", name: "Khách HN", phone: "0911223344" },
      message: { text: "Hà Nội còn pin iPhone không?" },
    };

    const res = await handleZaloWebhook(payloadBranch1, { companyCode: "ANHKHOA", branchId: "b1" });
    expect(res.status).toBe("processed");
    expect(res.branchId).toBe("b1");
    expect(res.branchName).toBe("Chi nhánh Hà Nội");
    expect(conversationRows[0].branchId).toBe("b1");
  });

  it("should generate Zalo OAuth URL with PKCE and state", async () => {
    configRows.push({
      companyCode: "ANHKHOA",
      branchId: "ALL",
      appId: "app_123",
      secretKey: "secret_456",
      save: async () => {},
    });

    const res = await getZaloOAuthUrl("ANHKHOA", "ALL", "http://localhost:3011");
    expect(res.authUrl).toContain("https://oauth.zalo.me/v4/oa/permission");
    expect(res.authUrl).toContain("app_id=app_123");
    expect(res.authUrl).toContain("code_challenge=");
    expect(res.redirectUri).toBe("http://localhost:3011/api/v1/webhook/zalo/oauth/callback");
  });

  it("should handle OAuth callback and save access token and OA details", async () => {
    configRows.push({
      companyCode: "ANHKHOA",
      branchId: "b1",
      branchName: "Chi nhánh Hà Nội",
      appId: "app_123",
      secretKey: "secret_456",
      oauthCodeVerifier: "verifier_abc",
      save: async () => {},
    });

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("access_token")) {
        return {
          json: async () => ({
            access_token: "new_access_token_123",
            refresh_token: "new_refresh_token_456",
            expires_in: 86400,
          }),
        };
      }
      if (url.includes("getoa")) {
        return {
          json: async () => ({
            error: 0,
            data: { oa_id: "oa_999", name: "Anh Khoa Mobile HN", avatar: "http://avatar.png" },
          }),
        };
      }
      return { json: async () => ({}) };
    });

    const callbackRes = await handleZaloOAuthCallback(
      {
        code: "auth_code_xyz",
        state: "ANHKHOA:b1:random123",
      },
      "http://localhost:3011"
    );

    expect(callbackRes.success).toBe(true);
    expect(callbackRes.data?.oaName).toBe("Anh Khoa Mobile HN");
    expect(callbackRes.data?.oaId).toBe("oa_999");
    expect(callbackRes.html).toContain("Kết nối Zalo OA thành công");
  });
});
