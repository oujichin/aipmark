import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

// API handlers
import {
  GET as getReviews,
  POST as createReview,
} from "../route";
import {
  GET as getReview,
  PUT as updateReview,
} from "../[id]/route";
import { POST as createAgenda } from "../[id]/agendas/route";
import { POST as createDecision } from "../[id]/decisions/route";
import { PUT as updateDecision } from "../decisions/[id]/route";
import { POST as createParticipant } from "../[id]/participants/route";
import { DELETE as deleteParticipant } from "../participants/[id]/route";

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

const TEST_ORG_ID = "test-org-review";
const TEST_USER_ID = "test-user-review";
const TEST_USER2_ID = "test-user-review-2";
const TEST_DEPT_ID = "test-dept-review";

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

describe("Management Review API", () => {
  beforeAll(async () => {
    await prisma.organization.upsert({
      where: { id: TEST_ORG_ID },
      update: {},
      create: { id: TEST_ORG_ID, name: "テスト組織（レビュー）", code: "TEST-REVIEW" },
    });
    await prisma.department.upsert({
      where: { id: TEST_DEPT_ID },
      update: {},
      create: {
        id: TEST_DEPT_ID,
        name: "テスト部署",
        code: "REVIEW-DEPT",
        organizationId: TEST_ORG_ID,
      },
    });
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        email: "review-test@demo.jp",
        name: "レビューテストユーザー",
        role: "PRIVACY_OFFICER",
        organizationId: TEST_ORG_ID,
        departmentId: TEST_DEPT_ID,
      },
    });
    await prisma.user.upsert({
      where: { id: TEST_USER2_ID },
      update: {},
      create: {
        id: TEST_USER2_ID,
        email: "review-test2@demo.jp",
        name: "レビューテストユーザー2",
        role: "ADMIN",
        organizationId: TEST_ORG_ID,
        departmentId: TEST_DEPT_ID,
      },
    });
  });

  afterAll(async () => {
    await prisma.managementReviewParticipant.deleteMany({
      where: { review: { organizationId: TEST_ORG_ID } },
    });
    await prisma.managementReviewDecision.deleteMany({
      where: { review: { organizationId: TEST_ORG_ID } },
    });
    await prisma.managementReviewAgenda.deleteMany({
      where: { review: { organizationId: TEST_ORG_ID } },
    });
    await prisma.managementReview.deleteMany({
      where: { organizationId: TEST_ORG_ID },
    });
    await prisma.auditLog.deleteMany({
      where: { userId: { in: [TEST_USER_ID, TEST_USER2_ID] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [TEST_USER_ID, TEST_USER2_ID] } },
    });
    await prisma.department.deleteMany({ where: { id: TEST_DEPT_ID } });
    await prisma.organization.deleteMany({ where: { id: TEST_ORG_ID } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockSession();
  });

  // Track created IDs for chained tests
  let reviewId: string;
  let decisionId: string;
  let participantId: string;

  describe("POST /api/reviews - レビュー作成", () => {
    it("正常にレビューを作成できる", async () => {
      const req = makeRequest("/api/reviews", {
        method: "POST",
        body: JSON.stringify({ fiscalYear: 2025 }),
      });

      const res = await createReview(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.fiscalYear).toBe(2025);
      expect(data.status).toBe("DRAFT");
      expect(data.organizationId).toBe(TEST_ORG_ID);
      reviewId = data.id;
    });

    it("fiscalYearが未指定の場合400を返す", async () => {
      const req = makeRequest("/api/reviews", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const res = await createReview(req);
      expect(res.status).toBe(400);
    });

    it("未認証の場合401を返す", async () => {
      (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const req = makeRequest("/api/reviews", {
        method: "POST",
        body: JSON.stringify({ fiscalYear: 2025 }),
      });

      const res = await createReview(req);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/reviews - レビュー一覧取得", () => {
    it("organizationIdでフィルタされた一覧を取得できる", async () => {
      const req = makeRequest("/api/reviews");
      const res = await getReviews(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThanOrEqual(1);
      expect(data.items[0].organizationId).toBe(TEST_ORG_ID);
      expect(data.items[0]._count).toBeDefined();
      expect(data.total).toBeGreaterThanOrEqual(1);
      expect(data.page).toBe(1);
    });
  });

  describe("GET /api/reviews/[id] - レビュー詳細取得", () => {
    it("正常に詳細を取得できる", async () => {
      const req = makeRequest(`/api/reviews/${reviewId}`);
      const params = Promise.resolve({ id: reviewId });
      const res = await getReview(req, { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(reviewId);
      expect(data.agendas).toBeDefined();
      expect(data.decisions).toBeDefined();
      expect(data.participants).toBeDefined();
    });

    it("存在しないIDの場合404を返す", async () => {
      const req = makeRequest("/api/reviews/nonexistent-id");
      const params = Promise.resolve({ id: "nonexistent-id" });
      const res = await getReview(req, { params });
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/reviews/[id] テナント分離", () => {
    it("他テナントのorganizationIdでは404を返す", async () => {
      // 別組織のデータを作成
      const otherOrgId = "test-org-review-other";
      await prisma.organization.upsert({
        where: { id: otherOrgId },
        update: {},
        create: { id: otherOrgId, name: "他テナント組織（レビュー）", code: "TEST-REVIEW-OTHER" },
      });
      const otherReview = await prisma.managementReview.create({
        data: {
          organizationId: otherOrgId,
          fiscalYear: 2025,
        },
      });

      const req = makeRequest(`/api/reviews/${otherReview.id}`);
      const params = Promise.resolve({ id: otherReview.id });
      const res = await getReview(req, { params });
      expect(res.status).toBe(404);

      // クリーンアップ
      await prisma.managementReview.delete({ where: { id: otherReview.id } });
      await prisma.organization.delete({ where: { id: otherOrgId } });
    });
  });

  describe("PUT /api/reviews/[id] - レビュー更新", () => {
    it("正常に更新できる", async () => {
      const req = makeRequest(`/api/reviews/${reviewId}`, {
        method: "PUT",
        body: JSON.stringify({
          status: "PREPARED",
          minutes: "議事録テスト内容",
          externalIssues: "外部課題テスト",
        }),
      });
      const params = Promise.resolve({ id: reviewId });
      const res = await updateReview(req, { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("PREPARED");
      expect(data.minutes).toBe("議事録テスト内容");
      expect(data.externalIssues).toBe("外部課題テスト");
    });
  });

  describe("POST /api/reviews/[id]/agendas - 議題追加", () => {
    it("正常に議題を追加できる", async () => {
      const req = makeRequest(`/api/reviews/${reviewId}/agendas`, {
        method: "POST",
        body: JSON.stringify({
          agendaNumber: 1,
          title: "個人情報保護方針の見直し",
          description: "年次見直し",
          sortOrder: 1,
        }),
      });
      const params = Promise.resolve({ id: reviewId });
      const res = await createAgenda(req, { params });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.reviewId).toBe(reviewId);
      expect(data.agendaNumber).toBe(1);
      expect(data.title).toBe("個人情報保護方針の見直し");
    });

    it("title未指定の場合400を返す", async () => {
      const req = makeRequest(`/api/reviews/${reviewId}/agendas`, {
        method: "POST",
        body: JSON.stringify({ agendaNumber: 2 }),
      });
      const params = Promise.resolve({ id: reviewId });
      const res = await createAgenda(req, { params });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/reviews/[id]/decisions - 決定事項追加", () => {
    it("正常に決定事項を追加できる", async () => {
      const req = makeRequest(`/api/reviews/${reviewId}/decisions`, {
        method: "POST",
        body: JSON.stringify({
          decisionTitle: "教育体制の強化",
          decisionDetail: "全社員向けセキュリティ教育を四半期ごとに実施",
          responsibleId: TEST_USER_ID,
        }),
      });
      const params = Promise.resolve({ id: reviewId });
      const res = await createDecision(req, { params });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.reviewId).toBe(reviewId);
      expect(data.decisionTitle).toBe("教育体制の強化");
      expect(data.status).toBe("OPEN");
      decisionId = data.id;
    });

    it("decisionTitle未指定の場合400を返す", async () => {
      const req = makeRequest(`/api/reviews/${reviewId}/decisions`, {
        method: "POST",
        body: JSON.stringify({ decisionDetail: "詳細のみ" }),
      });
      const params = Promise.resolve({ id: reviewId });
      const res = await createDecision(req, { params });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/reviews/decisions/[id] - 決定事項更新", () => {
    it("正常に決定事項を更新できる", async () => {
      const req = makeRequest(`/api/reviews/decisions/${decisionId}`, {
        method: "PUT",
        body: JSON.stringify({
          status: "IN_PROGRESS",
          followUpNotes: "教育資料を作成中",
        }),
      });
      const params = Promise.resolve({ id: decisionId });
      const res = await updateDecision(req, { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("IN_PROGRESS");
      expect(data.followUpNotes).toBe("教育資料を作成中");
    });
  });

  describe("POST /api/reviews/[id]/participants - 参加者追加", () => {
    it("正常に参加者を追加できる", async () => {
      const req = makeRequest(`/api/reviews/${reviewId}/participants`, {
        method: "POST",
        body: JSON.stringify({
          userId: TEST_USER2_ID,
          role: "ATTENDEE",
        }),
      });
      const params = Promise.resolve({ id: reviewId });
      const res = await createParticipant(req, { params });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.reviewId).toBe(reviewId);
      expect(data.userId).toBe(TEST_USER2_ID);
      expect(data.role).toBe("ATTENDEE");
      expect(data.user).toBeDefined();
      participantId = data.id;
    });

    it("重複追加の場合409を返す", async () => {
      const req = makeRequest(`/api/reviews/${reviewId}/participants`, {
        method: "POST",
        body: JSON.stringify({
          userId: TEST_USER2_ID,
        }),
      });
      const params = Promise.resolve({ id: reviewId });
      const res = await createParticipant(req, { params });
      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /api/reviews/participants/[id] - 参加者削除", () => {
    it("正常に参加者を削除できる", async () => {
      const req = makeRequest(`/api/reviews/participants/${participantId}`, {
        method: "DELETE",
      });
      const params = Promise.resolve({ id: participantId });
      const res = await deleteParticipant(req, { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("存在しない参加者IDの場合404を返す", async () => {
      const req = makeRequest("/api/reviews/participants/nonexistent-id", {
        method: "DELETE",
      });
      const params = Promise.resolve({ id: "nonexistent-id" });
      const res = await deleteParticipant(req, { params });
      expect(res.status).toBe(404);
    });
  });
});
