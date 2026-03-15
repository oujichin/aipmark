import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock auth options
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Mock auth-guard
vi.mock("@/lib/auth-guard", () => ({
  requireRole: vi.fn().mockResolvedValue({ error: null, session: { user: { id: "user-privacy-officer", role: "PRIVACY_OFFICER", organizationId: "org-demo" } } }),
}));

// Mock prisma - use vi.hoisted to share refs with hoisted vi.mock
const { mockPMSDocument, mockPMSDocumentVersion, mockAuditLog } = vi.hoisted(() => ({
  mockPMSDocument: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  mockPMSDocumentVersion: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  mockAuditLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => {
  const txProxy = { pMSDocument: mockPMSDocument, pMSDocumentVersion: mockPMSDocumentVersion, auditLog: mockAuditLog };
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

describe("POST /api/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証なしで401を返す", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/documents", {
      method: "POST",
      body: JSON.stringify({ title: "テスト文書", type: "POLICY" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("PMS文書を作成できる", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const mockDoc = {
      id: "doc-1",
      organizationId: "org-demo",
      type: "POLICY",
      title: "個人情報保護方針",
      description: "テスト説明",
      category: "PMS_BASIC",
      status: "DRAFT",
      createdAt: new Date(),
      updatedAt: new Date(),
      versions: [],
    };
    mockedPrisma.pMSDocument.create.mockResolvedValue(mockDoc as never);
    mockedPrisma.auditLog.create.mockResolvedValue({} as never);

    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/documents", {
      method: "POST",
      body: JSON.stringify({
        title: "個人情報保護方針",
        type: "POLICY",
        description: "テスト説明",
        category: "PMS_BASIC",
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.title).toBe("個人情報保護方針");
    expect(data.type).toBe("POLICY");
  });

  it("titleが空で400を返す", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/documents", {
      method: "POST",
      body: JSON.stringify({ type: "POLICY" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("typeが空で400を返す", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/documents", {
      method: "POST",
      body: JSON.stringify({ title: "テスト" }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証なしで401を返す", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/documents");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("文書一覧を取得できる", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const mockDocs = [
      {
        id: "doc-1",
        title: "個人情報保護方針",
        type: "POLICY",
        category: "PMS_BASIC",
        status: "DRAFT",
        _count: { versions: 2 },
      },
    ];
    mockedPrisma.pMSDocument.findMany.mockResolvedValue(mockDocs as never);
    mockedPrisma.pMSDocument.count.mockResolvedValue(1 as never);

    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/documents");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items[0].title).toBe("個人情報保護方針");
    expect(data.total).toBe(1);
  });

  it("typeフィルタで絞り込みできる", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    mockedPrisma.pMSDocument.findMany.mockResolvedValue([] as never);
    mockedPrisma.pMSDocument.count.mockResolvedValue(0 as never);

    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/documents?type=POLICY");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    expect(mockedPrisma.pMSDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "POLICY",
        }),
      })
    );
  });

  it("categoryフィルタで絞り込みできる", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    mockedPrisma.pMSDocument.findMany.mockResolvedValue([] as never);
    mockedPrisma.pMSDocument.count.mockResolvedValue(0 as never);

    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/documents?category=PMS_BASIC");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    expect(mockedPrisma.pMSDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: "PMS_BASIC",
        }),
      })
    );
  });
});

describe("GET /api/documents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証なしで401を返す", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const { GET } = await import("../[id]/route");
    const req = new Request("http://localhost/api/documents/doc-1");
    const res = await GET(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("文書詳細を版履歴含めて取得できる", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const mockDoc = {
      id: "doc-1",
      organizationId: "org-demo",
      title: "個人情報保護方針",
      type: "POLICY",
      category: "PMS_BASIC",
      status: "ACTIVE",
      versions: [
        { id: "ver-1", versionNumber: "1.0", status: "APPROVED" },
        { id: "ver-2", versionNumber: "2.0", status: "DRAFT" },
      ],
    };
    mockedPrisma.pMSDocument.findFirst.mockResolvedValue(mockDoc as never);

    const { GET } = await import("../[id]/route");
    const req = new Request("http://localhost/api/documents/doc-1");
    const res = await GET(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("個人情報保護方針");
    expect(data.versions).toHaveLength(2);
  });

  it("存在しない文書で404を返す", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    mockedPrisma.pMSDocument.findFirst.mockResolvedValue(null as never);

    const { GET } = await import("../[id]/route");
    const req = new Request("http://localhost/api/documents/doc-nonexistent");
    const res = await GET(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "doc-nonexistent" }) }
    );
    expect(res.status).toBe(404);
  });
});

describe("テナント分離 GET /api/documents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("他テナントのorganizationIdで文書詳細にアクセスすると404を返す", async () => {
    // 他テナントのセッション
    mockedGetServerSession.mockResolvedValue({
      user: {
        id: "user-other-tenant",
        email: "other@other.jp",
        name: "他テナントユーザー",
        role: "PRIVACY_OFFICER",
        organizationId: "org-other-tenant",
      },
    });
    // findFirstはorganizationIdでフィルタするのでnullを返す
    mockedPrisma.pMSDocument.findFirst.mockResolvedValue(null as never);

    const { GET } = await import("../[id]/route");
    const req = new Request("http://localhost/api/documents/doc-1");
    const res = await GET(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/documents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証なしで401を返す", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const { PUT } = await import("../[id]/route");
    const req = new Request("http://localhost/api/documents/doc-1", {
      method: "PUT",
      body: JSON.stringify({ title: "更新タイトル" }),
    });
    const res = await PUT(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("文書を更新できる", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const existing = {
      id: "doc-1",
      organizationId: "org-demo",
      title: "旧タイトル",
      type: "POLICY",
      status: "DRAFT",
    };
    const updated = {
      ...existing,
      title: "新タイトル",
      versions: [],
    };
    mockedPrisma.pMSDocument.findFirst.mockResolvedValue(existing as never);
    mockedPrisma.pMSDocument.update.mockResolvedValue(updated as never);
    mockedPrisma.auditLog.create.mockResolvedValue({} as never);

    const { PUT } = await import("../[id]/route");
    const req = new Request("http://localhost/api/documents/doc-1", {
      method: "PUT",
      body: JSON.stringify({ title: "新タイトル" }),
    });
    const res = await PUT(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("新タイトル");
  });

  it("存在しない文書で404を返す", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    mockedPrisma.pMSDocument.findFirst.mockResolvedValue(null as never);

    const { PUT } = await import("../[id]/route");
    const req = new Request("http://localhost/api/documents/doc-nonexistent", {
      method: "PUT",
      body: JSON.stringify({ title: "テスト" }),
    });
    const res = await PUT(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "doc-nonexistent" }) }
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/documents/[id]/versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証なしで401を返す", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const { POST } = await import("../[id]/versions/route");
    const req = new Request("http://localhost/api/documents/doc-1/versions", {
      method: "POST",
      body: JSON.stringify({ versionNumber: "1.0" }),
    });
    const res = await POST(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("新バージョンを追加できる", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const mockDoc = {
      id: "doc-1",
      organizationId: "org-demo",
      title: "テスト文書",
    };
    const mockVersion = {
      id: "ver-1",
      documentId: "doc-1",
      versionNumber: "1.0",
      status: "DRAFT",
      createdById: "user-privacy-officer",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockedPrisma.pMSDocument.findFirst.mockResolvedValue(mockDoc as never);
    mockedPrisma.pMSDocumentVersion.create.mockResolvedValue(mockVersion as never);
    mockedPrisma.auditLog.create.mockResolvedValue({} as never);

    const { POST } = await import("../[id]/versions/route");
    const req = new Request("http://localhost/api/documents/doc-1/versions", {
      method: "POST",
      body: JSON.stringify({
        versionNumber: "1.0",
        changeNote: "初版作成",
      }),
    });
    const res = await POST(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.versionNumber).toBe("1.0");
  });

  it("存在しない文書で404を返す", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    mockedPrisma.pMSDocument.findFirst.mockResolvedValue(null as never);

    const { POST } = await import("../[id]/versions/route");
    const req = new Request("http://localhost/api/documents/doc-nonexistent/versions", {
      method: "POST",
      body: JSON.stringify({ versionNumber: "1.0" }),
    });
    const res = await POST(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "doc-nonexistent" }) }
    );
    expect(res.status).toBe(404);
  });

  it("versionNumberが空で400を返す", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const mockDoc = { id: "doc-1", organizationId: "org-demo" };
    mockedPrisma.pMSDocument.findFirst.mockResolvedValue(mockDoc as never);

    const { POST } = await import("../[id]/versions/route");
    const req = new Request("http://localhost/api/documents/doc-1/versions", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/documents/versions/[id]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証なしで401を返す", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const { PUT } = await import("../versions/[id]/route");
    const req = new Request("http://localhost/api/documents/versions/ver-1", {
      method: "PUT",
      body: JSON.stringify({ action: "approve" }),
    });
    const res = await PUT(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "ver-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("バージョンを承認できる", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const existingVersion = {
      id: "ver-1",
      documentId: "doc-1",
      versionNumber: "1.0",
      status: "DRAFT",
    };
    const approvedVersion = {
      ...existingVersion,
      status: "APPROVED",
      approvedById: "user-privacy-officer",
      approvedAt: new Date(),
    };
    mockedPrisma.pMSDocumentVersion.findFirst.mockResolvedValue(existingVersion as never);
    mockedPrisma.pMSDocumentVersion.update.mockResolvedValue(approvedVersion as never);
    mockedPrisma.auditLog.create.mockResolvedValue({} as never);

    const { PUT } = await import("../versions/[id]/route");
    const req = new Request("http://localhost/api/documents/versions/ver-1", {
      method: "PUT",
      body: JSON.stringify({ action: "approve" }),
    });
    const res = await PUT(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "ver-1" }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("APPROVED");
  });

  it("存在しないバージョンで404を返す", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    mockedPrisma.pMSDocumentVersion.findFirst.mockResolvedValue(null as never);

    const { PUT } = await import("../versions/[id]/route");
    const req = new Request("http://localhost/api/documents/versions/ver-nonexistent", {
      method: "PUT",
      body: JSON.stringify({ action: "approve" }),
    });
    const res = await PUT(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "ver-nonexistent" }) }
    );
    expect(res.status).toBe(404);
  });

  it("既に承認済みのバージョンで400を返す", async () => {
    mockedGetServerSession.mockResolvedValue(mockSession);
    const existingVersion = {
      id: "ver-1",
      documentId: "doc-1",
      versionNumber: "1.0",
      status: "APPROVED",
    };
    mockedPrisma.pMSDocumentVersion.findFirst.mockResolvedValue(existingVersion as never);

    const { PUT } = await import("../versions/[id]/route");
    const req = new Request("http://localhost/api/documents/versions/ver-1", {
      method: "PUT",
      body: JSON.stringify({ action: "approve" }),
    });
    const res = await PUT(
      req as unknown as import("next/server").NextRequest,
      { params: Promise.resolve({ id: "ver-1" }) }
    );
    expect(res.status).toBe(400);
  });
});
