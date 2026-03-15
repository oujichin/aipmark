import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { getServerSession } from "next-auth";

const mockSession = {
  user: {
    id: "user-privacy-officer",
    name: "田中 花子",
    email: "tanaka@demo.jp",
    role: "PRIVACY_OFFICER",
    organizationId: "org-demo",
  },
};

// Helper: create NextRequest
function createRequest(url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ----------- Setup / Cleanup -----------
beforeEach(async () => {
  vi.mocked(getServerSession).mockResolvedValue(mockSession);

  // Cleanup in reverse dependency order
  await prisma.quizQuestion.deleteMany();
  await prisma.trainingResult.deleteMany();
  await prisma.trainingSession.deleteMany();
  await prisma.trainingPlan.deleteMany();

  // Ensure organization and user exist
  await prisma.organization.upsert({
    where: { id: "org-demo" },
    update: {},
    create: { id: "org-demo", name: "デモ組織", code: "DEMO" },
  });
  await prisma.user.upsert({
    where: { id: "user-privacy-officer" },
    update: {},
    create: {
      id: "user-privacy-officer",
      email: "tanaka@demo.jp",
      name: "田中 花子",
      role: "PRIVACY_OFFICER",
      organizationId: "org-demo",
    },
  });
  await prisma.user.upsert({
    where: { id: "user-dept-staff" },
    update: {},
    create: {
      id: "user-dept-staff",
      email: "suzuki@demo.jp",
      name: "鈴木 一郎",
      role: "DEPT_STAFF",
      organizationId: "org-demo",
    },
  });
});

// =========================================================
// 1. POST /api/training/plans — 教育計画作成
// =========================================================
describe("POST /api/training/plans", () => {
  it("教育計画を作成できる", async () => {
    const { POST } = await import("@/app/api/training/plans/route");
    const req = createRequest("http://localhost:3000/api/training/plans", {
      method: "POST",
      body: JSON.stringify({
        fiscalYear: 2025,
        title: "2025年度 個人情報保護教育",
        description: "全社員向け年次教育",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.title).toBe("2025年度 個人情報保護教育");
    expect(data.fiscalYear).toBe(2025);
    expect(data.status).toBe("DRAFT");
    expect(data.organizationId).toBe("org-demo");
    expect(data.createdById).toBe("user-privacy-officer");
  });

  it("認証なしは401", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/training/plans/route");
    const req = createRequest("http://localhost:3000/api/training/plans", {
      method: "POST",
      body: JSON.stringify({ fiscalYear: 2025, title: "テスト" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("タイトル未指定は400", async () => {
    const { POST } = await import("@/app/api/training/plans/route");
    const req = createRequest("http://localhost:3000/api/training/plans", {
      method: "POST",
      body: JSON.stringify({ fiscalYear: 2025 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// =========================================================
// 2. GET /api/training/plans — 計画一覧取得
// =========================================================
describe("GET /api/training/plans", () => {
  async function seedPlan(overrides: Record<string, unknown> = {}) {
    return prisma.trainingPlan.create({
      data: {
        organizationId: "org-demo",
        fiscalYear: 2025,
        title: "テスト計画",
        createdById: "user-privacy-officer",
        ...overrides,
      },
    });
  }

  it("一覧を取得できる", async () => {
    await seedPlan();
    await seedPlan({ title: "計画2", fiscalYear: 2024 });

    const { GET } = await import("@/app/api/training/plans/route");
    const req = createRequest("http://localhost:3000/api/training/plans");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBe(2);
    expect(data.total).toBe(2);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(50);
  });

  it("fiscalYearでフィルタできる", async () => {
    await seedPlan({ fiscalYear: 2025 });
    await seedPlan({ fiscalYear: 2024 });

    const { GET } = await import("@/app/api/training/plans/route");
    const req = createRequest("http://localhost:3000/api/training/plans?fiscalYear=2025");
    const res = await GET(req);
    const data = await res.json();
    expect(data.items.length).toBe(1);
    expect(data.items[0].fiscalYear).toBe(2025);
  });

  it("statusでフィルタできる", async () => {
    await seedPlan({ status: "DRAFT" });
    await seedPlan({ status: "COMPLETED" });

    const { GET } = await import("@/app/api/training/plans/route");
    const req = createRequest("http://localhost:3000/api/training/plans?status=COMPLETED");
    const res = await GET(req);
    const data = await res.json();
    expect(data.items.length).toBe(1);
    expect(data.items[0].status).toBe("COMPLETED");
  });
});

// =========================================================
// 3. GET /api/training/plans/[id] — 計画詳細
// =========================================================
describe("GET /api/training/plans/[id]", () => {
  it("セッション含む詳細を取得できる", async () => {
    const plan = await prisma.trainingPlan.create({
      data: {
        organizationId: "org-demo",
        fiscalYear: 2025,
        title: "詳細テスト",
        createdById: "user-privacy-officer",
        sessions: {
          create: [
            { title: "第1回研修", location: "会議室A" },
            { title: "第2回研修", location: "オンライン" },
          ],
        },
      },
    });

    const { GET } = await import("@/app/api/training/plans/[id]/route");
    const req = createRequest(`http://localhost:3000/api/training/plans/${plan.id}`);
    const res = await GET(req, { params: Promise.resolve({ id: plan.id }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.title).toBe("詳細テスト");
    expect(data.sessions.length).toBe(2);
  });

  it("存在しないIDは404", async () => {
    const { GET } = await import("@/app/api/training/plans/[id]/route");
    const req = createRequest("http://localhost:3000/api/training/plans/nonexistent");
    const res = await GET(req, { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(404);
  });
});

// =========================================================
// 3.1 テナント分離テスト
// =========================================================
describe("GET /api/training/plans/[id] テナント分離", () => {
  it("他テナントのorganizationIdでは404を返す", async () => {
    // 別組織のデータを作成
    await prisma.organization.upsert({
      where: { id: "org-other" },
      update: {},
      create: { id: "org-other", name: "他テナント組織", code: "OTHER" },
    });
    const otherPlan = await prisma.trainingPlan.create({
      data: {
        organizationId: "org-other",
        fiscalYear: 2025,
        title: "他テナントの計画",
      },
    });

    const { GET } = await import("@/app/api/training/plans/[id]/route");
    const req = createRequest(`http://localhost:3000/api/training/plans/${otherPlan.id}`);
    const res = await GET(req, { params: Promise.resolve({ id: otherPlan.id }) });
    expect(res.status).toBe(404);

    // クリーンアップ
    await prisma.trainingPlan.delete({ where: { id: otherPlan.id } });
  });
});

// =========================================================
// 4. PUT /api/training/plans/[id] — 計画更新
// =========================================================
describe("PUT /api/training/plans/[id]", () => {
  it("計画を更新できる", async () => {
    const plan = await prisma.trainingPlan.create({
      data: {
        organizationId: "org-demo",
        fiscalYear: 2025,
        title: "更新前",
        createdById: "user-privacy-officer",
      },
    });

    const { PUT } = await import("@/app/api/training/plans/[id]/route");
    const req = createRequest(`http://localhost:3000/api/training/plans/${plan.id}`, {
      method: "PUT",
      body: JSON.stringify({ title: "更新後", status: "SCHEDULED" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: plan.id }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.title).toBe("更新後");
    expect(data.status).toBe("SCHEDULED");
  });

  it("存在しないIDは404", async () => {
    const { PUT } = await import("@/app/api/training/plans/[id]/route");
    const req = createRequest("http://localhost:3000/api/training/plans/nonexistent", {
      method: "PUT",
      body: JSON.stringify({ title: "x" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(404);
  });
});

// =========================================================
// 5. POST /api/training/plans/[id]/sessions — セッション追加
// =========================================================
describe("POST /api/training/plans/[id]/sessions", () => {
  it("セッションを追加できる", async () => {
    const plan = await prisma.trainingPlan.create({
      data: {
        organizationId: "org-demo",
        fiscalYear: 2025,
        title: "セッションテスト",
        createdById: "user-privacy-officer",
      },
    });

    const { POST } = await import("@/app/api/training/plans/[id]/sessions/route");
    const req = createRequest(`http://localhost:3000/api/training/plans/${plan.id}/sessions`, {
      method: "POST",
      body: JSON.stringify({
        title: "第1回 個人情報保護研修",
        sessionDate: "2025-07-15T10:00:00.000Z",
        facilitator: "田中 花子",
        location: "会議室A",
        materialNote: "Pマーク教育テキスト",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: plan.id }) });
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.title).toBe("第1回 個人情報保護研修");
    expect(data.trainingPlanId).toBe(plan.id);
    expect(data.facilitator).toBe("田中 花子");
  });

  it("存在しない計画IDは404", async () => {
    const { POST } = await import("@/app/api/training/plans/[id]/sessions/route");
    const req = createRequest("http://localhost:3000/api/training/plans/nonexistent/sessions", {
      method: "POST",
      body: JSON.stringify({ title: "テスト" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(404);
  });
});

// =========================================================
// 6. PUT /api/training/sessions/[id] — セッション更新
// =========================================================
describe("PUT /api/training/sessions/[id]", () => {
  it("セッションを更新できる", async () => {
    const plan = await prisma.trainingPlan.create({
      data: {
        organizationId: "org-demo",
        fiscalYear: 2025,
        title: "テスト",
        sessions: { create: [{ title: "更新前セッション" }] },
      },
    });
    const session = await prisma.trainingSession.findFirst({
      where: { trainingPlanId: plan.id },
    });

    const { PUT } = await import("@/app/api/training/sessions/[id]/route");
    const req = createRequest(`http://localhost:3000/api/training/sessions/${session!.id}`, {
      method: "PUT",
      body: JSON.stringify({ title: "更新後セッション", status: "COMPLETED" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: session!.id }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.title).toBe("更新後セッション");
    expect(data.status).toBe("COMPLETED");
  });
});

// =========================================================
// 7. POST /api/training/sessions/[id]/results — 受講結果一括登録
// =========================================================
describe("POST /api/training/sessions/[id]/results", () => {
  it("受講結果を一括登録できる", async () => {
    const plan = await prisma.trainingPlan.create({
      data: {
        organizationId: "org-demo",
        fiscalYear: 2025,
        title: "結果テスト",
        sessions: { create: [{ title: "研修セッション" }] },
      },
    });
    const session = await prisma.trainingSession.findFirst({
      where: { trainingPlanId: plan.id },
    });

    const { POST } = await import("@/app/api/training/sessions/[id]/results/route");
    const req = createRequest(`http://localhost:3000/api/training/sessions/${session!.id}/results`, {
      method: "POST",
      body: JSON.stringify({
        results: [
          { userId: "user-privacy-officer", attended: true },
          { userId: "user-dept-staff", attended: false },
        ],
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: session!.id }) });
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.length).toBe(2);
    expect(data.find((r: { userId: string }) => r.userId === "user-privacy-officer").attended).toBe(true);
    expect(data.find((r: { userId: string }) => r.userId === "user-dept-staff").attended).toBe(false);
  });

  it("空配列は400", async () => {
    const plan = await prisma.trainingPlan.create({
      data: {
        organizationId: "org-demo",
        fiscalYear: 2025,
        title: "空配列テスト",
        sessions: { create: [{ title: "セッション" }] },
      },
    });
    const session = await prisma.trainingSession.findFirst({
      where: { trainingPlanId: plan.id },
    });

    const { POST } = await import("@/app/api/training/sessions/[id]/results/route");
    const req = createRequest(`http://localhost:3000/api/training/sessions/${session!.id}/results`, {
      method: "POST",
      body: JSON.stringify({ results: [] }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: session!.id }) });
    expect(res.status).toBe(400);
  });
});

// =========================================================
// 8. PUT /api/training/results/[id] — 受講結果更新
// =========================================================
describe("PUT /api/training/results/[id]", () => {
  it("受講結果を更新できる（出席/テスト結果）", async () => {
    const plan = await prisma.trainingPlan.create({
      data: {
        organizationId: "org-demo",
        fiscalYear: 2025,
        title: "結果更新テスト",
        sessions: {
          create: [{
            title: "研修",
            results: {
              create: [{
                userId: "user-privacy-officer",
                attended: false,
                status: "PENDING",
              }],
            },
          }],
        },
      },
    });
    const result = await prisma.trainingResult.findFirst({
      where: { trainingSession: { trainingPlanId: plan.id } },
    });

    const { PUT } = await import("@/app/api/training/results/[id]/route");
    const req = createRequest(`http://localhost:3000/api/training/results/${result!.id}`, {
      method: "PUT",
      body: JSON.stringify({
        attended: true,
        quizScore: 85,
        quizMaxScore: 100,
        passed: true,
        status: "COMPLETED",
      }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: result!.id }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.attended).toBe(true);
    expect(data.quizScore).toBe(85);
    expect(data.passed).toBe(true);
    expect(data.status).toBe("COMPLETED");
  });

  it("存在しないIDは404", async () => {
    const { PUT } = await import("@/app/api/training/results/[id]/route");
    const req = createRequest("http://localhost:3000/api/training/results/nonexistent", {
      method: "PUT",
      body: JSON.stringify({ attended: true }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(404);
  });
});

// =========================================================
// 9. POST /api/training/sessions/[id]/quiz — クイズ問題追加
// =========================================================
describe("POST /api/training/sessions/[id]/quiz", () => {
  it("クイズ問題を追加できる", async () => {
    const plan = await prisma.trainingPlan.create({
      data: {
        organizationId: "org-demo",
        fiscalYear: 2025,
        title: "クイズテスト",
        sessions: { create: [{ title: "クイズ付き研修" }] },
      },
    });
    const session = await prisma.trainingSession.findFirst({
      where: { trainingPlanId: plan.id },
    });

    const { POST } = await import("@/app/api/training/sessions/[id]/quiz/route");
    const req = createRequest(`http://localhost:3000/api/training/sessions/${session!.id}/quiz`, {
      method: "POST",
      body: JSON.stringify({
        questionText: "個人情報保護法における「要配慮個人情報」に該当するものはどれですか？",
        questionType: "SINGLE_CHOICE",
        options: ["住所", "電話番号", "病歴", "氏名"],
        correctAnswer: "病歴",
        points: 10,
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: session!.id }) });
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.questionText).toContain("要配慮個人情報");
    expect(data.points).toBe(10);
    expect(data.trainingSessionId).toBe(session!.id);
  });

  it("存在しないセッションIDは404", async () => {
    const { POST } = await import("@/app/api/training/sessions/[id]/quiz/route");
    const req = createRequest("http://localhost:3000/api/training/sessions/nonexistent/quiz", {
      method: "POST",
      body: JSON.stringify({
        questionText: "テスト",
        options: ["A", "B"],
        correctAnswer: "A",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(404);
  });
});
