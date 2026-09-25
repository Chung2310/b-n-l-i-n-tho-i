import { describe, expect, it, vi, beforeEach } from "vitest";

const conversationRows: any[] = [];
const messageRows: any[] = [];

vi.mock("./models/cskh-conversation.model", () => {
  const model: any = {
    find: (filter: any) => ({
      sort: () => ({
        skip: () => ({
          limit: async () => conversationRows,
        }),
      }),
    }),
    countDocuments: async () => conversationRows.length,
    findOne: (filter: any) => {
      const found = conversationRows.find((c) => {
        if (filter._id && String(c._id) !== String(filter._id)) return false;
        if (filter.companyCode && c.companyCode !== filter.companyCode) return false;
        if (filter.ticketId && c.ticketId !== filter.ticketId) return false;
        if (filter.customerPhone && c.customerPhone !== filter.customerPhone) return false;
        return true;
      });
      if (!found) return null;
      return {
        ...found,
        save: async () => found,
        toObject: () => ({ ...found }),
        lean: async () => ({ ...found }),
      };
    },
    create: async (doc: any) => {
      const created = { _id: `conv-${conversationRows.length + 1}`, ...doc };
      conversationRows.push(created);
      return {
        ...created,
        save: async () => created,
        toObject: () => ({ ...created }),
      };
    },
    updateOne: async () => ({ acknowledged: true }),
    findOneAndUpdate: async (filter: any, update: any) => {
      const found = conversationRows.find((c) => String(c._id) === String(filter._id));
      if (!found) return null;
      if (update.$set) Object.assign(found, update.$set);
      return { ...found, lean: async () => found };
    },
  };
  return { CskhConversationModel: model };
});

vi.mock("./models/cskh-message.model", () => {
  const model: any = {
    find: () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => [...messageRows],
        }),
      }),
    }),
    create: async (doc: any) => {
      const created = { _id: `msg-${messageRows.length + 1}`, ...doc };
      messageRows.push(created);
      return { ...created, toObject: () => ({ ...created }) };
    },
    updateMany: async () => ({ acknowledged: true }),
  };
  return { CskhMessageModel: model };
});

vi.mock("../repair/repair-ticket.model", () => ({
  RepairTicketModel: {
    findOne: () => ({
      lean: async () => ({
        ticketCode: "SC-001",
        device: { name: "iPhone 13" },
        symptom: "Vỡ màn hình",
        technicianName: "Nguyễn Thợ",
        status: "repairing",
        totalAmount: 1500000,
        paidAmount: 0,
        dueAmount: 1500000,
      }),
    }),
  },
}));

vi.mock("../../service/openrouter.service", () => ({
  openrouterChat: async () => ({
    text: "Dạ Anh Khoa Mobile chào anh, máy iPhone 13 của anh hiện đang được kỹ thuật viên Nguyễn Thợ thay màn hình, dự kiến chiều nay xong ạ.",
  }),
}));

const {
  listCskhConversations,
  findOrCreateConversationByTicket,
  sendCskhMessage,
  generateCskhAiSuggestion,
} = await import("./cskh.service");

describe("CSKH Service", () => {
  beforeEach(() => {
    conversationRows.length = 0;
    messageRows.length = 0;
  });

  it("tạo cuộc hội thoại mới từ phiếu sửa chữa", async () => {
    const scope = { companyCode: "ANHKHOA" };
    const actor = { id: "user-1", name: "Lễ tân Nga" };

    const conv = await findOrCreateConversationByTicket(
      scope,
      {
        ticketId: "ticket-100",
        ticketCode: "SC-100",
        customerName: "Nguyễn Văn Khách",
        customerPhone: "0988888888",
      },
      actor
    );

    expect(conv).toBeDefined();
    expect(conv.customerName).toBe("Nguyễn Văn Khách");
    expect(conv.ticketCode).toBe("SC-100");
    expect(messageRows.length).toBe(1);
    expect(messageRows[0].content).toContain("SC-100");
  });

  it("gửi tin nhắn trong hội thoại", async () => {
    const scope = { companyCode: "ANHKHOA" };
    const actor = { id: "user-1", name: "Lễ tân Nga" };

    const conv = await findOrCreateConversationByTicket(
      scope,
      { ticketId: "ticket-100", customerName: "Khách", customerPhone: "0988888888" },
      actor
    );

    const message = await sendCskhMessage(
      scope,
      String(conv._id),
      { content: "Máy của anh đã kiểm tra xong rồi ạ." },
      actor
    );

    expect(message.content).toBe("Máy của anh đã kiểm tra xong rồi ạ.");
    expect(message.senderType).toBe("staff");
  });

  it("gọi AI Marketing Copilot sinh câu trả lời theo ngữ cảnh máy", async () => {
    const scope = { companyCode: "ANHKHOA" };
    const actor = { id: "user-1", name: "Lễ tân Nga" };

    const conv = await findOrCreateConversationByTicket(
      scope,
      { ticketId: "ticket-100", ticketCode: "SC-001", customerName: "Anh Tuấn", customerPhone: "0988888888" },
      actor
    );

    const result = await generateCskhAiSuggestion(scope, String(conv._id));
    expect(result.suggestion).toContain("Anh Khoa Mobile");
    expect(result.suggestion).toContain("iPhone 13");
  });
});
