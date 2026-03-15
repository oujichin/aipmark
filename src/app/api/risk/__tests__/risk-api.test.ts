import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

// API handlers
import {
  GET as getAssessments,
  POST as createAssessment,
} from "../assessments/route";
import {
  GET as getAssessment,
  PUT as updateAssessment,
} from "../assessments/[id]/route";
import { POST as createItem } from "../assessments/[id]/items/route";
import { PUT as updateItem } from "../items/[id]/route";
import { POST as createMeasure } from "../items/[id]/measures/route";
import {
  POST as createResidual,
  PUT as updateResidual,
} from "../items/[id]/residual/route";

// Mock next-auth
import { vi } from "vitest";
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { getServerSession } from "next-auth";

const prisma = new PrismaClient();

const TEST_ORG_ID = "test-org-risk";
const TEST_USER_ID = "test-user-risk";
const TEST_DEPT_ID = "test-dept-risk";
const TEST_PROCESS_ID = "test-process-risk";

function mockSession() {
  (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: {
      id: TEST_USER_ID,
      organizationId: TEST_ORG_ID,
      role: "PRIVACY_OFFICER",
    },
  });
}

function makeRequest(url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

describe("Risk Management API", () => {
  beforeAll(async () => {
    // Seed test data
    await prisma.organization.upsert({
      where: { id: TEST_ORG_ID },
      update: {},
      create: { id: TEST_ORG_ID, name: "テスト組織", code: "TEST-RISK" },
    });
    await prisma.department.upsert({
      where: { id: TEST_DEPT_ID },
      update: {},
      create: {
        id: TEST_DEPT_ID,
        name: "テスト部署",
        code: "RISK-DEPT",
        organizationId: TEST_ORG_ID,
      },
    });
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        email: "risk-test@demo.jp",
        name: "リスクテストユーザー",
        role: "PRIVACY_OFFICER",
        organizationId: TEST_ORG_ID,
        departmentId: TEST_DEPT_ID,
      },
    });
    await prisma.businessProcess.upsert({
      where: { id: TEST_PROCESS_ID },
      update: {},
      create: {
        id: TEST_PROCESS_ID,
        name: "テスト業務プロセス",
        description: "リスクテスト用",
        departmentId: TEST_DEPT_ID,
        organizationId: TEST_ORG_ID,
      },
    });
  });

  afterAll(async () => {
    // Clean up in reverse dependency order
    await prisma.residualRisk.deleteMany({});
    await prisma.controlMeasure.deleteMany({});
    await prisma.riskItem.deleteMany({});
    await prisma.riskAssessment.deleteMany({
      where: { organizationId: TEST_ORG_ID },
    });
    await prisma.auditLog.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.businessProcess.deleteMany({
      where: { id: TEST_PROCESS_ID },
    });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
    await prisma.department.deleteMany({ where: { id: TEST_DEPT_ID } });
    await prisma.organization.deleteMany({ where: { id: TEST_ORG_ID } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockSession();
  });

  // Track created IDs for chained tests
  let assessmentId: string;
  let riskItemId: string;

  describe("RBAC — DEPT_STAFFはリスク評価を作成できない", () => {
    it("DEPT_STAFFがPOSTすると403を返す", async () => {
      (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: {
          id: TEST_USER_ID,
          organizationId: TEST_ORG_ID,
          role: "DEPT_STAFF",
        },
      });

      const req = makeRequest("/api/risk/assessments", {
        method: "POST",
        body: JSON.stringify({
          title: "権限テスト",
          fiscalYear: 2025,
        }),
      });

      const res = await createAssessment(req);
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/risk/assessments — リスク評価作成", () => {
    it("正常にリスク評価を作成できる", async () => {
      const req = makeRequest("/api/risk/assessments", {
        method: "POST",
        body: JSON.stringify({
          title: "2025年度リスク評価",
          fiscalYear: 2025,
          description: "年次リスク評価",
          targetScope: "全社",
        }),
      });

      const res = await createAssessment(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.title).toBe("2025年度リスク評価");
      expect(data.fiscalYear).toBe(2025);
      expect(data.status).toBe("DRAFT");
      expect(data.organizationId).toBe(TEST_ORG_ID);
      assessmentId = data.id;
    });

    it("titleが未指定の場合400を返す", async () => {
      const req = makeRequest("/api/risk/assessments", {
        method: "POST",
        body: JSON.stringify({ fiscalYear: 2025 }),
      });

      const res = await createAssessment(req);
      expect(res.status).toBe(400);
    });

    it("未認証の場合401を返す", async () => {
      (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const req = makeRequest("/api/risk/assessments", {
        method: "POST",
        body: JSON.stringify({
          title: "テスト",
          fiscalYear: 2025,
        }),
      });

      const res = await createAssessment(req);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/risk/assessments — リスク評価一覧取得", () => {
    it("organizationIdでフィルタされた一覧を取得できる", async () => {
      const req = makeRequest("/api/risk/assessments");
      const res = await getAssessments(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThanOrEqual(1);
      expect(data.items[0].organizationId).toBe(TEST_ORG_ID);
    });
  });

  describe("GET /api/risk/assessments/[id] — リスク評価詳細取得", () => {
    it("正常に詳細を取得できる", async () => {
      const req = makeRequest(`/api/risk/assessments/${assessmentId}`);
      const params = Promise.resolve({ id: assessmentId });
      const res = await getAssessment(req, { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(assessmentId);
      expect(data.title).toBe("2025年度リスク評価");
    });

    it("存在しないIDの場合404を返す", async () => {
      const req = makeRequest("/api/risk/assessments/nonexistent-id");
      const params = Promise.resolve({ id: "nonexistent-id" });
      const res = await getAssessment(req, { params });
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/risk/assessments/[id] — リスク評価更新", () => {
    it("正常に更新できる", async () => {
      const req = makeRequest(`/api/risk/assessments/${assessmentId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: "2025年度リスク評価（更新）",
          status: "IN_PROGRESS",
        }),
      });
      const params = Promise.resolve({ id: assessmentId });
      const res = await updateAssessment(req, { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.title).toBe("2025年度リスク評価（更新）");
      expect(data.status).toBe("IN_PROGRESS");
    });
  });

  describe("POST /api/risk/assessments/[id]/items — リスクアイテム追加", () => {
    it("正常にリスクアイテムを追加できる", async () => {
      const req = makeRequest(
        `/api/risk/assessments/${assessmentId}/items`,
        {
          method: "POST",
          body: JSON.stringify({
            lifecycleStage: "ACQUISITION",
            description: "個人情報の不正取得リスク",
            threatSource: "外部攻撃者",
            vulnerability: "入力バリデーション不足",
            likelihood: 2,
            impact: 3,
            businessProcessId: TEST_PROCESS_ID,
          }),
        }
      );
      const params = Promise.resolve({ id: assessmentId });
      const res = await createItem(req, { params });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.riskAssessmentId).toBe(assessmentId);
      expect(data.lifecycleStage).toBe("ACQUISITION");
      expect(data.likelihood).toBe(2);
      expect(data.impact).toBe(3);
      expect(data.riskValue).toBe(6); // 2 * 3
      riskItemId = data.id;
    });

    it("descriptionが未指定の場合400を返す", async () => {
      const req = makeRequest(
        `/api/risk/assessments/${assessmentId}/items`,
        {
          method: "POST",
          body: JSON.stringify({
            lifecycleStage: "USE",
          }),
        }
      );
      const params = Promise.resolve({ id: assessmentId });
      const res = await createItem(req, { params });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/risk/items/[id] — リスクアイテム更新", () => {
    it("likelihood/impact更新でriskValueが自動計算される", async () => {
      const req = makeRequest(`/api/risk/items/${riskItemId}`, {
        method: "PUT",
        body: JSON.stringify({
          likelihood: 3,
          impact: 3,
        }),
      });
      const params = Promise.resolve({ id: riskItemId });
      const res = await updateItem(req, { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.likelihood).toBe(3);
      expect(data.impact).toBe(3);
      expect(data.riskValue).toBe(9); // 3 * 3
    });

    it("descriptionを更新できる", async () => {
      const req = makeRequest(`/api/risk/items/${riskItemId}`, {
        method: "PUT",
        body: JSON.stringify({
          description: "更新されたリスク説明",
          status: "ANALYZED",
        }),
      });
      const params = Promise.resolve({ id: riskItemId });
      const res = await updateItem(req, { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.description).toBe("更新されたリスク説明");
      expect(data.status).toBe("ANALYZED");
    });
  });

  describe("POST /api/risk/items/[id]/measures — 管理策追加", () => {
    it("正常に管理策を追加できる", async () => {
      const req = makeRequest(`/api/risk/items/${riskItemId}/measures`, {
        method: "POST",
        body: JSON.stringify({
          category: "TECHNICAL",
          description: "WAFの導入",
          responsible: "情報システム部",
        }),
      });
      const params = Promise.resolve({ id: riskItemId });
      const res = await createMeasure(req, { params });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.riskItemId).toBe(riskItemId);
      expect(data.category).toBe("TECHNICAL");
      expect(data.description).toBe("WAFの導入");
      expect(data.status).toBe("PLANNED");
    });

    it("categoryが未指定の場合400を返す", async () => {
      const req = makeRequest(`/api/risk/items/${riskItemId}/measures`, {
        method: "POST",
        body: JSON.stringify({
          description: "対策のみ",
        }),
      });
      const params = Promise.resolve({ id: riskItemId });
      const res = await createMeasure(req, { params });
      expect(res.status).toBe(400);
    });
  });

  describe("テナント分離 — 他テナントのリスク評価にアクセスできない", () => {
    it("他テナントのorganizationIdでリスク評価詳細にアクセスすると403を返す", async () => {
      // 別のorganizationIdでセッションをモック
      (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: {
          id: "other-user",
          organizationId: "other-org-id",
          role: "PRIVACY_OFFICER",
        },
      });

      const req = makeRequest(`/api/risk/assessments/${assessmentId}`);
      const params = Promise.resolve({ id: assessmentId });
      const res = await getAssessment(req, { params });
      // organizationIdの不一致で404 Not Foundが返る（findFirstでテナント分離）
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/risk/items/[id]/residual — 残留リスク設定", () => {
    it("正常に残留リスクを設定できる", async () => {
      const req = makeRequest(`/api/risk/items/${riskItemId}/residual`, {
        method: "POST",
        body: JSON.stringify({
          likelihood: 1,
          impact: 2,
          accepted: true,
          justification: "WAF導入後のリスクは許容範囲",
        }),
      });
      const params = Promise.resolve({ id: riskItemId });
      const res = await createResidual(req, { params });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.riskItemId).toBe(riskItemId);
      expect(data.likelihood).toBe(1);
      expect(data.impact).toBe(2);
      expect(data.riskValue).toBe(2); // 1 * 2
      expect(data.accepted).toBe(true);
    });

    it("既に残留リスクがある場合409を返す", async () => {
      const req = makeRequest(`/api/risk/items/${riskItemId}/residual`, {
        method: "POST",
        body: JSON.stringify({
          likelihood: 1,
          impact: 1,
        }),
      });
      const params = Promise.resolve({ id: riskItemId });
      const res = await createResidual(req, { params });
      expect(res.status).toBe(409);
    });

    it("PUTで残留リスクを更新できる", async () => {
      const req = makeRequest(`/api/risk/items/${riskItemId}/residual`, {
        method: "PUT",
        body: JSON.stringify({
          likelihood: 1,
          impact: 1,
          justification: "さらに対策を追加した",
        }),
      });
      const params = Promise.resolve({ id: riskItemId });
      const res = await updateResidual(req, { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.likelihood).toBe(1);
      expect(data.impact).toBe(1);
      expect(data.riskValue).toBe(1);
      expect(data.justification).toBe("さらに対策を追加した");
    });
  });
});
