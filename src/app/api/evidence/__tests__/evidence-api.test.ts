import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock auth options
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Mock prisma - use vi.hoisted to share refs with hoisted vi.mock
const { mockEvidenceRecord, mockAuditLog } = vi.hoisted(() => ({
  mockEvidenceRecord: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  mockAuditLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => {
  const txProxy = { evidenceRecord: mockEvidenceRecord, auditLog: mockAuditLog };
  return {
    prisma: {
      ...txProxy,
      $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txProxy)),
    },
  };
});

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

const mockedGetServerSession = vi.mocked(getServerSession);
const mockedPrisma = vi.mocked(prisma, true);

const mockSession = {
  user: {
    id: "user-privacy-officer",
    email: "tanaka@demo.jp",
    name: "田中 花子",
    role: "PRIVACY_OFFICER",
    organizationId: "org-demo",
  },
};

describe("POST /api/evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証なしで401を返す", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/evidence", {
      method: "POST",
      body: JSON.stringify({
        title: "テストエビデンス",
        type: "DOCUMENT",
        registerItemId: "item-1",
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("エビデンスを作成できる", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const mockEvidence = {
      id: "ev-1",
      registerItemId: "item-1",
      type: "DOCUMENT",
      title: "同意書テンプレート",
      description: "テスト説明",
      uploadedById: "user-privacy-officer",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockedPrisma.evidenceRecord.create.mockResolvedValue(mockEvidence as never);
    mockedPrisma.auditLog.create.mockResolvedValue({} as never);

    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/evidence", {
      method: "POST",
      body: JSON.stringify({
        title: "同意書テンプレート",
        type: "DOCUMENT",
        description: "テスト説明",
        registerItemId: "item-1",
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.title).toBe("同意書テンプレート");
  });

  it("紐付け先がない場合400を返す", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/evidence", {
      method: "POST",
      body: JSON.stringify({
        title: "テスト",
        type: "DOCUMENT",
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("titleが空で400を返す", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/evidence", {
      method: "POST",
      body: JSON.stringify({
        type: "DOCUMENT",
        registerItemId: "item-1",
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("typeが空で400を返す", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/evidence", {
      method: "POST",
      body: JSON.stringify({
        title: "テスト",
        registerItemId: "item-1",
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("vendorIdで紐付けできる", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const mockEvidence = {
      id: "ev-2",
      vendorId: "vendor-1",
      type: "CONTRACT",
      title: "委託契約書",
      uploadedById: "user-privacy-officer",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockedPrisma.evidenceRecord.create.mockResolvedValue(mockEvidence as never);
    mockedPrisma.auditLog.create.mockResolvedValue({} as never);

    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/evidence", {
      method: "POST",
      body: JSON.stringify({
        title: "委託契約書",
        type: "CONTRACT",
        vendorId: "vendor-1",
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(201);
  });
});

describe("GET /api/evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証なしで401を返す", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/evidence");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("エビデンス一覧を取得できる", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const mockList = [
      {
        id: "ev-1",
        title: "同意書テンプレート",
        type: "DOCUMENT",
        registerItemId: "item-1",
      },
    ];
    mockedPrisma.evidenceRecord.findMany.mockResolvedValue(mockList as never);
    mockedPrisma.evidenceRecord.count.mockResolvedValue(1 as never);

    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/evidence");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items[0].title).toBe("同意書テンプレート");
    expect(data.total).toBe(1);
  });

  it("typeフィルタで絞り込みできる", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    mockedPrisma.evidenceRecord.findMany.mockResolvedValue([] as never);
    mockedPrisma.evidenceRecord.count.mockResolvedValue(0 as never);

    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/evidence?type=DOCUMENT");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    expect(mockedPrisma.evidenceRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "DOCUMENT",
        }),
      })
    );
  });

  it("registerItemIdフィルタで絞り込みできる", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    mockedPrisma.evidenceRecord.findMany.mockResolvedValue([] as never);
    mockedPrisma.evidenceRecord.count.mockResolvedValue(0 as never);

    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/evidence?registerItemId=item-1");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    expect(mockedPrisma.evidenceRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          registerItemId: "item-1",
        }),
      })
    );
  });
});

describe("GET /api/evidence/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証なしで401を返す", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const { GET } = await import("../[id]/route");
    const req = new Request("http://localhost/api/evidence/ev-1");
    const res = await GET(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "ev-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("エビデンス詳細を取得できる", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const mockEvidence = {
      id: "ev-1",
      title: "同意書テンプレート",
      type: "DOCUMENT",
      registerItemId: "item-1",
      registerItem: { id: "item-1", dataSubject: "顧客" },
      uploadedBy: { id: "user-privacy-officer", name: "田中 花子" },
    };
    mockedPrisma.evidenceRecord.findFirst.mockResolvedValue(mockEvidence as never);

    const { GET } = await import("../[id]/route");
    const req = new Request("http://localhost/api/evidence/ev-1");
    const res = await GET(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "ev-1" }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("同意書テンプレート");
  });

  it("存在しないエビデンスで404を返す", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    mockedPrisma.evidenceRecord.findFirst.mockResolvedValue(null as never);

    const { GET } = await import("../[id]/route");
    const req = new Request("http://localhost/api/evidence/ev-nonexistent");
    const res = await GET(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "ev-nonexistent" }) }
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/evidence/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証なしで401を返す", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const { DELETE } = await import("../[id]/route");
    const req = new Request("http://localhost/api/evidence/ev-1", {
      method: "DELETE",
    });
    const res = await DELETE(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "ev-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("エビデンスを削除できる", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const mockEvidence = {
      id: "ev-1",
      title: "テスト",
      type: "DOCUMENT",
    };
    mockedPrisma.evidenceRecord.findFirst.mockResolvedValue(mockEvidence as never);
    mockedPrisma.evidenceRecord.delete.mockResolvedValue(mockEvidence as never);
    mockedPrisma.auditLog.create.mockResolvedValue({} as never);

    const { DELETE } = await import("../[id]/route");
    const req = new Request("http://localhost/api/evidence/ev-1", {
      method: "DELETE",
    });
    const res = await DELETE(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "ev-1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("存在しないエビデンスで404を返す", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    mockedPrisma.evidenceRecord.findFirst.mockResolvedValue(null as never);

    const { DELETE } = await import("../[id]/route");
    const req = new Request("http://localhost/api/evidence/ev-nonexistent", {
      method: "DELETE",
    });
    const res = await DELETE(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "ev-nonexistent" }) }
    );
    expect(res.status).toBe(404);
  });
});
