import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";

// next-auth セッションモック
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth";

const mockedGetServerSession = vi.mocked(getServerSession);

// テスト用定数
const TEST_ORG_ID = "org-incident-test";
const TEST_USER_ID = "user-incident-test";

function mockSession() {
  mockedGetServerSession.mockResolvedValue({
    user: {
      id: TEST_USER_ID,
      email: "test@demo.jp",
      name: "テストユーザー",
      role: "PRIVACY_OFFICER",
      organizationId: TEST_ORG_ID,
    },
  });
}

function mockNoSession() {
  mockedGetServerSession.mockResolvedValue(null);
}

// NextRequest ヘルパー
function createRequest(
  url: string,
  options: { method?: string; body?: Record<string, unknown> } = {}
) {
  const { method = "GET", body } = options;
  const reqInit: RequestInit = { method };
  if (body) {
    reqInit.body = JSON.stringify(body);
    reqInit.headers = { "Content-Type": "application/json" };
  }
  return new Request(`http://localhost:3000${url}`, reqInit) as unknown as import("next/server").NextRequest;
}

describe("M-08 インシデント対応 API", () => {
  beforeAll(async () => {
    // テスト用Organization & User
    await prisma.organization.upsert({
      where: { id: TEST_ORG_ID },
      update: {},
      create: { id: TEST_ORG_ID, name: "テスト組織", code: "INC-TEST" },
    });
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        email: "incident-test@demo.jp",
        name: "テストユーザー",
        role: "PRIVACY_OFFICER",
        organizationId: TEST_ORG_ID,
      },
    });
  });

  afterAll(async () => {
    // クリーンアップ
    await prisma.incidentAction.deleteMany({
      where: { incident: { organizationId: TEST_ORG_ID } },
    });
    await prisma.incidentCase.deleteMany({
      where: { organizationId: TEST_ORG_ID },
    });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
    await prisma.organization.deleteMany({ where: { id: TEST_ORG_ID } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────────────────────────────────────
  // 1. POST /api/incidents — インシデント報告
  // ───────────────────────────────────────────────────
  describe("POST /api/incidents", () => {
    it("認証なしで401を返す", async () => {
      mockNoSession();
      const { POST } = await import("@/app/api/incidents/route");
      const req = createRequest("/api/incidents", {
        method: "POST",
        body: { title: "test", description: "desc", category: "LEAKAGE" },
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("必須フィールド不足で400を返す", async () => {
      mockSession();
      const { POST } = await import("@/app/api/incidents/route");
      const req = createRequest("/api/incidents", {
        method: "POST",
        body: { title: "" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("正常にインシデントを作成し201を返す", async () => {
      mockSession();
      const { POST } = await import("@/app/api/incidents/route");
      const req = createRequest("/api/incidents", {
        method: "POST",
        body: {
          title: "メール誤送信による個人情報漏えい",
          description: "営業部が顧客リストを誤送信",
          category: "MISDIRECTION",
          incidentDate: "2025-01-15T00:00:00.000Z",
          discoveredDate: "2025-01-15T10:00:00.000Z",
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.title).toBe("メール誤送信による個人情報漏えい");
      expect(data.category).toBe("MISDIRECTION");
      expect(data.status).toBe("REPORTED");
      expect(data.severity).toBe("UNASSESSED");
      expect(data.organizationId).toBe(TEST_ORG_ID);
    });
  });

  // ───────────────────────────────────────────────────
  // 2. GET /api/incidents — 一覧取得
  // ───────────────────────────────────────────────────
  describe("GET /api/incidents", () => {
    it("認証なしで401を返す", async () => {
      mockNoSession();
      const { GET } = await import("@/app/api/incidents/route");
      const req = createRequest("/api/incidents");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("一覧を取得できる", async () => {
      mockSession();
      const { GET } = await import("@/app/api/incidents/route");
      const req = createRequest("/api/incidents");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("items");
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThanOrEqual(1);
      expect(data).toHaveProperty("total");
    });

    it("statusフィルタで絞り込み", async () => {
      mockSession();
      const { GET } = await import("@/app/api/incidents/route");
      const req = createRequest("/api/incidents?status=REPORTED");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const item of data.items) {
        expect(item.status).toBe("REPORTED");
      }
    });

    it("categoryフィルタで絞り込み", async () => {
      mockSession();
      const { GET } = await import("@/app/api/incidents/route");
      const req = createRequest("/api/incidents?category=MISDIRECTION");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const item of data.items) {
        expect(item.category).toBe("MISDIRECTION");
      }
    });
  });

  // ───────────────────────────────────────────────────
  // 3. GET /api/incidents/[id] — 詳細取得
  // ───────────────────────────────────────────────────
  describe("GET /api/incidents/[id]", () => {
    let incidentId: string;

    beforeAll(async () => {
      const incident = await prisma.incidentCase.findFirst({
        where: { organizationId: TEST_ORG_ID },
      });
      incidentId = incident!.id;
    });

    it("詳細を取得でき、actionsを含む", async () => {
      mockSession();
      const { GET } = await import("@/app/api/incidents/[id]/route");
      const req = createRequest(`/api/incidents/${incidentId}`);
      const res = await GET(req, { params: Promise.resolve({ id: incidentId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(incidentId);
      expect(Array.isArray(data.actions)).toBe(true);
    });

    it("存在しないIDで404を返す", async () => {
      mockSession();
      const { GET } = await import("@/app/api/incidents/[id]/route");
      const req = createRequest("/api/incidents/nonexistent");
      const res = await GET(req, { params: Promise.resolve({ id: "nonexistent" }) });
      expect(res.status).toBe(404);
    });
  });

  // ───────────────────────────────────────────────────
  // 3.1 GET /api/incidents/[id] テナント分離
  // ───────────────────────────────────────────────────
  describe("GET /api/incidents/[id] テナント分離", () => {
    it("他テナントのorganizationIdでは404を返す", async () => {
      const otherOrgId = "org-incident-other";
      await prisma.organization.upsert({
        where: { id: otherOrgId },
        update: {},
        create: { id: otherOrgId, name: "他テナント組織", code: "INC-OTHER" },
      });
      const otherIncident = await prisma.incidentCase.create({
        data: {
          organizationId: otherOrgId,
          title: "他テナントのインシデント",
          description: "テスト",
          category: "OTHER",
        },
      });

      mockSession(); // 自テナント（TEST_ORG_ID）のセッション
      const { GET } = await import("@/app/api/incidents/[id]/route");
      const req = createRequest(`/api/incidents/${otherIncident.id}`);
      const res = await GET(req, { params: Promise.resolve({ id: otherIncident.id }) });
      expect(res.status).toBe(404);

      // クリーンアップ
      await prisma.incidentCase.delete({ where: { id: otherIncident.id } });
      await prisma.organization.delete({ where: { id: otherOrgId } });
    });
  });

  // ───────────────────────────────────────────────────
  // 4. PUT /api/incidents/[id] — 更新
  // ───────────────────────────────────────────────────
  describe("PUT /api/incidents/[id]", () => {
    let incidentId: string;

    beforeAll(async () => {
      const incident = await prisma.incidentCase.findFirst({
        where: { organizationId: TEST_ORG_ID },
      });
      incidentId = incident!.id;
    });

    it("インシデントを更新できる", async () => {
      mockSession();
      const { PUT } = await import("@/app/api/incidents/[id]/route");
      const req = createRequest(`/api/incidents/${incidentId}`, {
        method: "PUT",
        body: {
          title: "更新済みインシデント",
          affectedCount: 100,
          affectedScope: "顧客",
          containsSensitive: true,
        },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: incidentId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.title).toBe("更新済みインシデント");
      expect(data.affectedCount).toBe(100);
      expect(data.containsSensitive).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────
  // 5. POST /api/incidents/[id]/assess — 深刻度判定
  // ───────────────────────────────────────────────────
  describe("POST /api/incidents/[id]/assess", () => {
    let incidentId: string;

    beforeAll(async () => {
      // assessテスト用のインシデント作成
      const incident = await prisma.incidentCase.create({
        data: {
          organizationId: TEST_ORG_ID,
          reportedById: TEST_USER_ID,
          title: "判定テスト用インシデント",
          description: "テスト",
          category: "LEAKAGE",
          discoveredDate: new Date("2025-03-01T00:00:00.000Z"),
          containsMyNumber: false,
        },
      });
      incidentId = incident.id;
    });

    it("severity HIGH → speedReport期限=発見日+5日, fullReport期限=発見日+30日", async () => {
      mockSession();
      const { POST } = await import("@/app/api/incidents/[id]/assess/route");
      const req = createRequest(`/api/incidents/${incidentId}/assess`, {
        method: "POST",
        body: {
          severity: "HIGH",
          affectedCount: 500,
        },
      });
      const res = await POST(req, { params: Promise.resolve({ id: incidentId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.severity).toBe("HIGH");
      expect(data.requiresSpeedReport).toBe(true);
      expect(data.requiresFullReport).toBe(true);
      expect(data.status).toBe("ASSESSING");

      // 速報期限: discoveredDate + 5日
      const speedDeadline = new Date(data.speedReportDeadline);
      const expectedSpeed = new Date("2025-03-06T00:00:00.000Z");
      expect(speedDeadline.toISOString().slice(0, 10)).toBe(expectedSpeed.toISOString().slice(0, 10));

      // 確報期限: discoveredDate + 30日
      const fullDeadline = new Date(data.fullReportDeadline);
      const expectedFull = new Date("2025-03-31T00:00:00.000Z");
      expect(fullDeadline.toISOString().slice(0, 10)).toBe(expectedFull.toISOString().slice(0, 10));
    });

    it("severity CRITICAL → 同様に法定報告要", async () => {
      mockSession();
      // リセット
      await prisma.incidentCase.update({
        where: { id: incidentId },
        data: { severity: "UNASSESSED", requiresSpeedReport: false, requiresFullReport: false },
      });
      const { POST } = await import("@/app/api/incidents/[id]/assess/route");
      const req = createRequest(`/api/incidents/${incidentId}/assess`, {
        method: "POST",
        body: { severity: "CRITICAL" },
      });
      const res = await POST(req, { params: Promise.resolve({ id: incidentId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.severity).toBe("CRITICAL");
      expect(data.requiresSpeedReport).toBe(true);
      expect(data.requiresFullReport).toBe(true);
    });

    it("containsMyNumber → fullReportDeadline=発見日+60日", async () => {
      mockSession();
      // MyNumber含むインシデントを作成
      const myNumIncident = await prisma.incidentCase.create({
        data: {
          organizationId: TEST_ORG_ID,
          reportedById: TEST_USER_ID,
          title: "マイナンバー漏えい",
          description: "テスト",
          category: "LEAKAGE",
          discoveredDate: new Date("2025-03-01T00:00:00.000Z"),
          containsMyNumber: true,
        },
      });

      const { POST } = await import("@/app/api/incidents/[id]/assess/route");
      const req = createRequest(`/api/incidents/${myNumIncident.id}/assess`, {
        method: "POST",
        body: { severity: "HIGH" },
      });
      const res = await POST(req, { params: Promise.resolve({ id: myNumIncident.id }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.requiresFullReport).toBe(true);
      // マイナンバー → 60日
      const fullDeadline = new Date(data.fullReportDeadline);
      const expectedFull = new Date("2025-04-30T00:00:00.000Z");
      expect(fullDeadline.toISOString().slice(0, 10)).toBe(expectedFull.toISOString().slice(0, 10));
    });

    it("severity LOW → 法定報告不要", async () => {
      mockSession();
      const lowIncident = await prisma.incidentCase.create({
        data: {
          organizationId: TEST_ORG_ID,
          reportedById: TEST_USER_ID,
          title: "軽微なインシデント",
          description: "テスト",
          category: "OTHER",
          discoveredDate: new Date("2025-03-01T00:00:00.000Z"),
        },
      });

      const { POST } = await import("@/app/api/incidents/[id]/assess/route");
      const req = createRequest(`/api/incidents/${lowIncident.id}/assess`, {
        method: "POST",
        body: { severity: "LOW" },
      });
      const res = await POST(req, { params: Promise.resolve({ id: lowIncident.id }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.severity).toBe("LOW");
      expect(data.requiresSpeedReport).toBe(false);
      expect(data.requiresFullReport).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────
  // 6. POST /api/incidents/[id]/actions — アクション追加
  // ───────────────────────────────────────────────────
  describe("POST /api/incidents/[id]/actions", () => {
    let incidentId: string;

    beforeAll(async () => {
      const incident = await prisma.incidentCase.findFirst({
        where: { organizationId: TEST_ORG_ID },
      });
      incidentId = incident!.id;
    });

    it("アクションを追加し201を返す", async () => {
      mockSession();
      const { POST } = await import("@/app/api/incidents/[id]/actions/route");
      const req = createRequest(`/api/incidents/${incidentId}/actions`, {
        method: "POST",
        body: {
          actionType: "INITIAL_RESPONSE",
          title: "初動対応実施",
          description: "該当メールの削除依頼",
        },
      });
      const res = await POST(req, { params: Promise.resolve({ id: incidentId }) });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.actionType).toBe("INITIAL_RESPONSE");
      expect(data.title).toBe("初動対応実施");
      expect(data.status).toBe("PENDING");
    });
  });

  // ───────────────────────────────────────────────────
  // 7. PUT /api/incidents/actions/[id] — アクション更新
  // ───────────────────────────────────────────────────
  describe("PUT /api/incidents/actions/[id]", () => {
    let actionId: string;

    beforeAll(async () => {
      const action = await prisma.incidentAction.findFirst({
        where: { incident: { organizationId: TEST_ORG_ID } },
      });
      actionId = action!.id;
    });

    it("アクションのステータスを更新できる", async () => {
      mockSession();
      const { PUT } = await import("@/app/api/incidents/actions/[id]/route");
      const req = createRequest(`/api/incidents/actions/${actionId}`, {
        method: "PUT",
        body: {
          status: "IN_PROGRESS",
          description: "対応中",
        },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: actionId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("IN_PROGRESS");
    });

    it("COMPLETEDに更新するとperformedAtが設定される", async () => {
      mockSession();
      const { PUT } = await import("@/app/api/incidents/actions/[id]/route");
      const req = createRequest(`/api/incidents/actions/${actionId}`, {
        method: "PUT",
        body: { status: "COMPLETED" },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: actionId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("COMPLETED");
      expect(data.performedAt).not.toBeNull();
    });
  });

  // ───────────────────────────────────────────────────
  // 8. PUT /api/incidents/[id]/close — インシデントクローズ
  // ───────────────────────────────────────────────────
  describe("PUT /api/incidents/[id]/close", () => {
    let incidentId: string;

    beforeAll(async () => {
      const incident = await prisma.incidentCase.findFirst({
        where: { organizationId: TEST_ORG_ID },
      });
      incidentId = incident!.id;
    });

    it("インシデントをクローズできる", async () => {
      mockSession();
      // まずステータスをRESPONDINGにしておく
      await prisma.incidentCase.update({
        where: { id: incidentId },
        data: { status: "RESPONDING" },
      });

      const { PUT } = await import("@/app/api/incidents/[id]/close/route");
      const req = createRequest(`/api/incidents/${incidentId}/close`, {
        method: "PUT",
        body: { closureNote: "再発防止策を実施済み" },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: incidentId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("CLOSED");
      expect(data.closedAt).not.toBeNull();
    });
  });
});
