import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { getTestPrisma, seedTestData, cleanTestData } from "@/test/helpers";
import type { PrismaClient } from "@prisma/client";

// next-auth のモック
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// prisma モック - テスト用DBインスタンスを使う
const testPrisma = getTestPrisma();
vi.mock("@/lib/prisma", () => ({
  prisma: testPrisma,
}));

import { getServerSession } from "next-auth";

// 動的インポート用の型
type RouteContext = { params: Promise<{ id: string }> };
type CollectionRouteModule = {
  GET?: (req: NextRequest) => Promise<Response>;
  POST?: (req: NextRequest) => Promise<Response>;
};
type DetailRouteModule = {
  GET?: (req: NextRequest, ctx: RouteContext) => Promise<Response>;
  POST?: (req: NextRequest, ctx: RouteContext) => Promise<Response>;
  PUT?: (req: NextRequest, ctx: RouteContext) => Promise<Response>;
  DELETE?: (req: NextRequest, ctx: RouteContext) => Promise<Response>;
};

const mockedGetSession = vi.mocked(getServerSession);

function makeRequest(url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${url}`), init);
}

function jsonBody(data: Record<string, unknown>): { method: string; headers: Record<string, string>; body: string } {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

function putBody(data: Record<string, unknown>): { method: string; headers: Record<string, string>; body: string } {
  return {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

let seedData: Awaited<ReturnType<typeof seedTestData>>;

describe("Vendors API", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
    await cleanTestData(testPrisma);
    seedData = await seedTestData(testPrisma);
  });

  afterAll(async () => {
    await cleanTestData(testPrisma);
    await testPrisma.$disconnect();
  });

  beforeEach(() => {
    mockedGetSession.mockResolvedValue({
      user: {
        id: seedData.officer.id,
        name: seedData.officer.name,
        email: seedData.officer.email,
        role: seedData.officer.role,
        organizationId: seedData.org.id,
      },
      expires: "2099-01-01",
    });
  });

  // ────────────────────────────────────────────
  // RBAC: DEPT_STAFFはPOSTできない
  // ────────────────────────────────────────────
  describe("RBAC — DEPT_STAFFは委託先を登録できない", () => {
    it("DEPT_STAFFがPOSTすると403を返す", async () => {
      mockedGetSession.mockResolvedValueOnce({
        user: {
          id: seedData.staff.id,
          name: seedData.staff.name,
          email: seedData.staff.email,
          role: "DEPT_STAFF",
          organizationId: seedData.org.id,
        },
        expires: "2099-01-01",
      });

      const mod: CollectionRouteModule = await import("@/app/api/vendors/route");
      const req = makeRequest("/api/vendors", jsonBody({
        name: "権限テストベンダー",
        vendorType: "SAAS",
      }));

      const res = await mod.POST!(req);
      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────
  // 1. POST /api/vendors — 委託先登録
  // ────────────────────────────────────────────
  describe("POST /api/vendors", () => {
    it("委託先を登録できる", async () => {
      const mod: CollectionRouteModule = await import("@/app/api/vendors/route");
      const req = makeRequest("/api/vendors", jsonBody({
        name: "テストベンダー株式会社",
        vendorType: "SAAS",
        description: "テスト用SaaSベンダー",
        contactName: "担当太郎",
        contactEmail: "contact@vendor.jp",
        hasPmark: true,
        pmarkNumber: "12345678",
      }));

      const res = await mod.POST!(req);
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.name).toBe("テストベンダー株式会社");
      expect(body.vendorType).toBe("SAAS");
      expect(body.status).toBe("ACTIVE");
      expect(body.organizationId).toBe(seedData.org.id);
    });

    it("nameが未入力の場合400を返す", async () => {
      const mod: CollectionRouteModule = await import("@/app/api/vendors/route");
      const req = makeRequest("/api/vendors", jsonBody({
        vendorType: "SAAS",
      }));

      const res = await mod.POST!(req);
      expect(res.status).toBe(400);
    });

    it("未認証の場合401を返す", async () => {
      mockedGetSession.mockResolvedValueOnce(null);
      const mod: CollectionRouteModule = await import("@/app/api/vendors/route");
      const req = makeRequest("/api/vendors", jsonBody({
        name: "Test",
        vendorType: "SAAS",
      }));

      const res = await mod.POST!(req);
      expect(res.status).toBe(401);
    });
  });

  // ────────────────────────────────────────────
  // 2. GET /api/vendors — 一覧取得
  // ────────────────────────────────────────────
  describe("GET /api/vendors", () => {
    it("委託先一覧を取得できる", async () => {
      const mod: CollectionRouteModule = await import("@/app/api/vendors/route");
      const req = makeRequest("/api/vendors");

      const res = await mod.GET!(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBeGreaterThan(0);
    });

    it("statusフィルタで絞り込みできる", async () => {
      const mod: CollectionRouteModule = await import("@/app/api/vendors/route");
      const req = makeRequest("/api/vendors?status=ACTIVE");

      const res = await mod.GET!(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      for (const vendor of body.items) {
        expect(vendor.status).toBe("ACTIVE");
      }
    });

    it("vendorTypeフィルタで絞り込みできる", async () => {
      const mod: CollectionRouteModule = await import("@/app/api/vendors/route");
      const req = makeRequest("/api/vendors?vendorType=SAAS");

      const res = await mod.GET!(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      for (const vendor of body.items) {
        expect(vendor.vendorType).toBe("SAAS");
      }
    });
  });

  // ────────────────────────────────────────────
  // 3. GET /api/vendors/[id] — 詳細取得
  // ────────────────────────────────────────────
  describe("GET /api/vendors/[id]", () => {
    it("委託先の詳細を取得できる（evaluations, questionnaires含む）", async () => {
      // まず委託先IDを取得
      const vendors = await testPrisma.vendor.findMany({
        where: { organizationId: seedData.org.id },
      });
      const vendorId = vendors[0].id;

      const mod: DetailRouteModule = await import("@/app/api/vendors/[id]/route");
      const req = makeRequest(`/api/vendors/${vendorId}`);

      const res = await mod.GET!(req, { params: Promise.resolve({ id: vendorId }) });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.id).toBe(vendorId);
      expect(body).toHaveProperty("evaluations");
      expect(body).toHaveProperty("questionnaires");
    });

    it("存在しないIDは404を返す", async () => {
      const mod: DetailRouteModule = await import("@/app/api/vendors/[id]/route");
      const req = makeRequest("/api/vendors/nonexistent-id");

      const res = await mod.GET!(req, { params: Promise.resolve({ id: "nonexistent-id" }) });
      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────
  // 4. PUT /api/vendors/[id] — 更新
  // ────────────────────────────────────────────
  describe("PUT /api/vendors/[id]", () => {
    it("委託先を更新できる", async () => {
      const vendors = await testPrisma.vendor.findMany({
        where: { organizationId: seedData.org.id },
      });
      const vendorId = vendors[0].id;

      const mod: DetailRouteModule = await import("@/app/api/vendors/[id]/route");
      const req = makeRequest(`/api/vendors/${vendorId}`, putBody({
        name: "更新後ベンダー名",
        status: "PENDING_REVIEW",
        hasIsms: true,
        ismsNumber: "ISMS-001",
      }));

      const res = await mod.PUT!(req, { params: Promise.resolve({ id: vendorId }) });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.name).toBe("更新後ベンダー名");
      expect(body.status).toBe("PENDING_REVIEW");
      expect(body.hasIsms).toBe(true);
    });
  });

  // ────────────────────────────────────────────
  // 5. DELETE /api/vendors/[id] — 削除
  // ────────────────────────────────────────────
  describe("DELETE /api/vendors/[id]", () => {
    it("委託先を削除できる（関連データcascade）", async () => {
      // 削除用のベンダーを新規作成
      const vendor = await testPrisma.vendor.create({
        data: {
          name: "削除対象ベンダー",
          vendorType: "OTHER",
          organizationId: seedData.org.id,
        },
      });

      // 関連データも作成
      await testPrisma.vendorEvaluation.create({
        data: {
          vendorId: vendor.id,
          fiscalYear: 2025,
          status: "DRAFT",
        },
      });
      await testPrisma.vendorQuestionnaire.create({
        data: {
          vendorId: vendor.id,
          status: "DRAFT",
        },
      });

      const mod: DetailRouteModule = await import("@/app/api/vendors/[id]/route");
      const req = makeRequest(`/api/vendors/${vendor.id}`, { method: "DELETE" });

      const res = await mod.DELETE!(req, { params: Promise.resolve({ id: vendor.id }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("TERMINATED");

      // ソフト削除なので関連データは残る
      const evalCount = await testPrisma.vendorEvaluation.count({
        where: { vendorId: vendor.id },
      });
      const qCount = await testPrisma.vendorQuestionnaire.count({
        where: { vendorId: vendor.id },
      });
      expect(evalCount).toBe(1);
      expect(qCount).toBe(1);

      // クリーンアップ
      await testPrisma.vendorEvaluation.deleteMany({ where: { vendorId: vendor.id } });
      await testPrisma.vendorQuestionnaire.deleteMany({ where: { vendorId: vendor.id } });
      await testPrisma.vendor.delete({ where: { id: vendor.id } });
    });
  });

  // ────────────────────────────────────────────
  // テナント分離テスト
  // ────────────────────────────────────────────
  describe("テナント分離", () => {
    it("他テナントのorganizationIdで委託先詳細にアクセスすると404を返す", async () => {
      const vendors = await testPrisma.vendor.findMany({
        where: { organizationId: seedData.org.id },
      });
      const vendorId = vendors[0].id;

      // 別テナントのセッションをモック
      mockedGetSession.mockResolvedValueOnce({
        user: {
          id: "other-user",
          name: "Other User",
          email: "other@other.jp",
          role: "PRIVACY_OFFICER",
          organizationId: "org-other-tenant",
        },
        expires: "2099-01-01",
      });

      const mod: DetailRouteModule = await import("@/app/api/vendors/[id]/route");
      const req = makeRequest(`/api/vendors/${vendorId}`);
      const res = await mod.GET!(req, { params: Promise.resolve({ id: vendorId }) });
      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────
  // 6. POST /api/vendors/[id]/evaluations — 評価作成
  // ────────────────────────────────────────────
  describe("POST /api/vendors/[id]/evaluations", () => {
    it("評価を作成できる", async () => {
      const vendors = await testPrisma.vendor.findMany({
        where: { organizationId: seedData.org.id },
      });
      const vendorId = vendors[0].id;

      const mod: DetailRouteModule = await import("@/app/api/vendors/[id]/evaluations/route");
      const req = makeRequest(`/api/vendors/${vendorId}/evaluations`, jsonBody({
        fiscalYear: 2025,
        scores: JSON.stringify({ organizational: 4, human: 3, physical: 4, technical: 5 }),
        overallScore: 80,
        rating: "A",
        findings: "良好な管理体制",
      }));

      const res = await mod.POST!(req, { params: Promise.resolve({ id: vendorId }) });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.vendorId).toBe(vendorId);
      expect(body.fiscalYear).toBe(2025);
      expect(body.rating).toBe("A");
      expect(body.evaluatedById).toBe(seedData.officer.id);
    });
  });

  // ────────────────────────────────────────────
  // 7. PUT /api/vendors/evaluations/[id] — 評価更新・承認
  // ────────────────────────────────────────────
  describe("PUT /api/vendors/evaluations/[id]", () => {
    it("評価を更新・承認できる", async () => {
      const evals = await testPrisma.vendorEvaluation.findMany({
        where: { vendor: { organizationId: seedData.org.id } },
      });
      const evalId = evals[0].id;

      const mod: DetailRouteModule = await import("@/app/api/vendors/evaluations/[id]/route");
      const req = makeRequest(`/api/vendors/evaluations/${evalId}`, putBody({
        status: "APPROVED",
        overallScore: 85,
        rating: "A",
      }));

      const res = await mod.PUT!(req, { params: Promise.resolve({ id: evalId }) });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe("APPROVED");
      expect(body.approvedById).toBe(seedData.officer.id);
      expect(body.approvedAt).toBeTruthy();
    });
  });

  // ────────────────────────────────────────────
  // 8. POST /api/vendors/[id]/questionnaires — 質問票作成
  // ────────────────────────────────────────────
  describe("POST /api/vendors/[id]/questionnaires", () => {
    it("質問票を作成できる", async () => {
      const vendors = await testPrisma.vendor.findMany({
        where: { organizationId: seedData.org.id },
      });
      const vendorId = vendors[0].id;

      const mod: DetailRouteModule = await import("@/app/api/vendors/[id]/questionnaires/route");
      const questions = JSON.stringify([
        { q: "個人情報保護方針はありますか？", type: "yes_no" },
        { q: "情報セキュリティ教育の実施状況は？", type: "text" },
      ]);

      const req = makeRequest(`/api/vendors/${vendorId}/questionnaires`, jsonBody({
        questions,
        dueDate: "2025-12-31T00:00:00.000Z",
      }));

      const res = await mod.POST!(req, { params: Promise.resolve({ id: vendorId }) });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.vendorId).toBe(vendorId);
      expect(body.status).toBe("DRAFT");
    });
  });

  // ────────────────────────────────────────────
  // 9. PUT /api/vendors/questionnaires/[id] — 質問票回答・ステータス遷移
  // ────────────────────────────────────────────
  describe("PUT /api/vendors/questionnaires/[id]", () => {
    it("質問票の回答とステータス遷移ができる", async () => {
      const questionnaires = await testPrisma.vendorQuestionnaire.findMany({
        where: { vendor: { organizationId: seedData.org.id } },
      });
      const qId = questionnaires[0].id;

      // まず SENT に遷移
      const mod: DetailRouteModule = await import("@/app/api/vendors/questionnaires/[id]/route");
      const reqSent = makeRequest(`/api/vendors/questionnaires/${qId}`, putBody({
        status: "SENT",
      }));
      const resSent = await mod.PUT!(reqSent, { params: Promise.resolve({ id: qId }) });
      expect(resSent.status).toBe(200);
      const bodySent = await resSent.json();
      expect(bodySent.status).toBe("SENT");
      expect(bodySent.sentAt).toBeTruthy();

      // 回答して RESPONDED に遷移
      const answers = JSON.stringify([
        { q: "個人情報保護方針はありますか？", a: "はい" },
        { q: "情報セキュリティ教育の実施状況は？", a: "年2回実施" },
      ]);
      const reqResponded = makeRequest(`/api/vendors/questionnaires/${qId}`, putBody({
        status: "RESPONDED",
        answers,
      }));
      const resResponded = await mod.PUT!(reqResponded, { params: Promise.resolve({ id: qId }) });
      expect(resResponded.status).toBe(200);
      const bodyResponded = await resResponded.json();
      expect(bodyResponded.status).toBe("RESPONDED");
      expect(bodyResponded.respondedAt).toBeTruthy();

      // EVALUATED に遷移
      const reqEval = makeRequest(`/api/vendors/questionnaires/${qId}`, putBody({
        status: "EVALUATED",
      }));
      const resEval = await mod.PUT!(reqEval, { params: Promise.resolve({ id: qId }) });
      expect(resEval.status).toBe(200);
      const bodyEval = await resEval.json();
      expect(bodyEval.status).toBe("EVALUATED");
    });
  });
});
