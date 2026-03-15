import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { seedTestData, cleanTestData } from "@/test/helpers";

// テスト用PrismaClient（モック前に生成しておく）
const testPrisma = new PrismaClient({
  datasources: { db: { url: "file:./prisma/test.db" } },
});

// Gemini モック用の関数
const mockGenerateContent = vi.fn();

vi.mock("@/lib/ai/gemini-client", () => ({
  getGeminiClient: () => ({
    getGenerativeModel: () => ({
      generateContent: mockGenerateContent,
    }),
  }),
  MODEL: "gemini-2.0-flash",
}));

vi.mock("next-auth", () => ({
  getServerSession: () =>
    Promise.resolve({
      user: {
        id: "user-officer",
        email: "officer@test.jp",
        name: "テスト管理者",
        role: "PRIVACY_OFFICER",
        organizationId: "org-test",
      },
    }),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: testPrisma,
}));

// ルートのインポート（モック設定後）
const { POST: riskSuggestionsPost } = await import("../risk-suggestions/route");
const { POST: auditChecklistPost } = await import("../audit-checklist/route");
const { POST: trainingMaterialPost } = await import("../training-material/route");
const { POST: incidentAssessPost } = await import("../incident-assess/route");
const { POST: reviewSummaryPost } = await import("../review-summary/route");

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/ai/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGeminiResponse(jsonContent: string) {
  return {
    response: {
      text: () => jsonContent,
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 200,
      },
    },
  };
}

// テストデータ用の変数
let testData: Awaited<ReturnType<typeof seedTestData>>;
let riskAssessmentId: string;
let auditPlanId: string;
let trainingSessionId: string;
let incidentId: string;
let reviewId: string;

beforeAll(async () => {
  await cleanTestData(testPrisma);
  testData = await seedTestData(testPrisma);

  // リスクアセスメント作成
  const riskAssessment = await testPrisma.riskAssessment.create({
    data: {
      id: "ra-test-1",
      organizationId: testData.org.id,
      fiscalYear: 2025,
      title: "2025年度リスクアセスメント",
    },
  });
  riskAssessmentId = riskAssessment.id;

  // 監査計画作成
  const auditPlan = await testPrisma.auditPlan.create({
    data: {
      id: "ap-test-1",
      organizationId: testData.org.id,
      fiscalYear: 2025,
      title: "2025年度内部監査",
      scope: "全部門のPMS運用状況",
    },
  });
  auditPlanId = auditPlan.id;

  // 教育計画・セッション作成
  const trainingPlan = await testPrisma.trainingPlan.create({
    data: {
      id: "tp-test-1",
      organizationId: testData.org.id,
      fiscalYear: 2025,
      title: "2025年度個人情報保護教育",
    },
  });
  const trainingSession = await testPrisma.trainingSession.create({
    data: {
      id: "ts-test-1",
      trainingPlanId: trainingPlan.id,
      title: "個人情報保護基礎研修",
    },
  });
  trainingSessionId = trainingSession.id;

  // インシデント作成
  const incident = await testPrisma.incidentCase.create({
    data: {
      id: "inc-test-1",
      organizationId: testData.org.id,
      title: "顧客メールの誤送信",
      description: "営業担当者が顧客10名分のメールアドレスをCCに含めて一斉送信した",
      category: "MISDIRECTION",
      affectedCount: 10,
      containsSensitive: false,
      containsMyNumber: false,
    },
  });
  incidentId = incident.id;

  // マネジメントレビュー作成
  const review = await testPrisma.managementReview.create({
    data: {
      id: "mr-test-1",
      organizationId: testData.org.id,
      fiscalYear: 2025,
    },
  });
  reviewId = review.id;
});

afterAll(async () => {
  await cleanTestData(testPrisma);
  await testPrisma.$disconnect();
});

beforeEach(() => {
  mockGenerateContent.mockReset();
});

// ════════════════════════════════════════════════════════════════════
// 1. /api/ai/risk-suggestions
// ════════════════════════════════════════════════════════════════════
describe("POST /api/ai/risk-suggestions", () => {
  it("正常系: Geminiからリスク候補を取得できる", async () => {
    const mockSuggestions = [
      {
        lifecycleStage: "ACQUISITION",
        description: "Webフォームからの個人情報取得時のリスク",
        threatSource: "外部攻撃者",
        vulnerability: "暗号化通信の未実装",
        likelihood: 2,
        impact: 3,
      },
    ];
    mockGenerateContent.mockResolvedValueOnce(
      makeGeminiResponse(JSON.stringify(mockSuggestions))
    );

    const req = createRequest({
      businessProcessId: testData.bp.id,
      assessmentId: riskAssessmentId,
    });
    const res = await riskSuggestionsPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.suggestions).toHaveLength(1);
    expect(json.suggestions[0].lifecycleStage).toBe("ACQUISITION");
  });

  it("バリデーション: 必須パラメータが欠落", async () => {
    const req = createRequest({ businessProcessId: testData.bp.id });
    const res = await riskSuggestionsPost(req);
    expect(res.status).toBe(400);
  });

  it("存在しない業務プロセスIDで404", async () => {
    const req = createRequest({
      businessProcessId: "non-existent",
      assessmentId: riskAssessmentId,
    });
    const res = await riskSuggestionsPost(req);
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════
// 2. /api/ai/audit-checklist
// ════════════════════════════════════════════════════════════════════
describe("POST /api/ai/audit-checklist", () => {
  it("正常系: Geminiから監査チェックリストを取得できる", async () => {
    const mockItems = [
      {
        category: "個人情報保護方針",
        question: "方針は公表されていますか？",
        responseType: "YES_NO",
      },
    ];
    mockGenerateContent.mockResolvedValueOnce(
      makeGeminiResponse(JSON.stringify(mockItems))
    );

    const req = createRequest({ auditPlanId });
    const res = await auditChecklistPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].category).toBe("個人情報保護方針");
  });

  it("バリデーション: auditPlanIdが欠落", async () => {
    const req = createRequest({});
    const res = await auditChecklistPost(req);
    expect(res.status).toBe(400);
  });

  it("存在しない監査計画IDで404", async () => {
    const req = createRequest({ auditPlanId: "non-existent" });
    const res = await auditChecklistPost(req);
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════
// 3. /api/ai/training-material
// ════════════════════════════════════════════════════════════════════
describe("POST /api/ai/training-material", () => {
  it("正常系: Geminiからクイズ問題を取得できる", async () => {
    const mockQuestions = [
      {
        questionText: "個人情報に該当するものは？",
        questionType: "SINGLE_CHOICE",
        options: ["氏名", "法人番号"],
        correctAnswer: "氏名",
        points: 1,
      },
    ];
    mockGenerateContent.mockResolvedValueOnce(
      makeGeminiResponse(JSON.stringify(mockQuestions))
    );

    const req = createRequest({
      sessionId: trainingSessionId,
      topic: "個人情報保護の基本",
      questionCount: 3,
    });
    const res = await trainingMaterialPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.questions).toHaveLength(1);
    expect(json.questions[0].questionType).toBe("SINGLE_CHOICE");
  });

  it("バリデーション: 必須パラメータが欠落", async () => {
    const req = createRequest({ sessionId: trainingSessionId });
    const res = await trainingMaterialPost(req);
    expect(res.status).toBe(400);
  });

  it("存在しないセッションIDで404", async () => {
    const req = createRequest({
      sessionId: "non-existent",
      topic: "テスト",
    });
    const res = await trainingMaterialPost(req);
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════
// 4. /api/ai/incident-assess
// ════════════════════════════════════════════════════════════════════
describe("POST /api/ai/incident-assess", () => {
  it("正常系: Geminiからインシデント評価を取得できる", async () => {
    const mockAssessment = {
      suggestedSeverity: "MEDIUM",
      requiresSpeedReport: false,
      reasoning: "影響件数が少なく、要配慮個人情報は含まれていません。",
      suggestedActions: ["影響範囲の確認", "再発防止策の策定"],
    };
    mockGenerateContent.mockResolvedValueOnce(
      makeGeminiResponse(JSON.stringify(mockAssessment))
    );

    const req = createRequest({ incidentId });
    const res = await incidentAssessPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.suggestedSeverity).toBe("MEDIUM");
    expect(json.requiresSpeedReport).toBe(false);
    expect(json.suggestedActions).toBeInstanceOf(Array);
  });

  it("バリデーション: incidentIdが欠落", async () => {
    const req = createRequest({});
    const res = await incidentAssessPost(req);
    expect(res.status).toBe(400);
  });

  it("存在しないインシデントIDで404", async () => {
    const req = createRequest({ incidentId: "non-existent" });
    const res = await incidentAssessPost(req);
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════
// 5. /api/ai/review-summary
// ════════════════════════════════════════════════════════════════════
describe("POST /api/ai/review-summary", () => {
  it("正常系: Geminiからレビューサマリーを取得できる", async () => {
    const mockSummary = {
      riskSummary: "リスク管理のサマリー",
      trainingSummary: "教育のサマリー",
      vendorSummary: "委託先管理のサマリー",
      auditSummary: "監査のサマリー",
      incidentSummary: "事故対応のサマリー",
    };
    mockGenerateContent.mockResolvedValueOnce(
      makeGeminiResponse(JSON.stringify(mockSummary))
    );

    const req = createRequest({ reviewId, fiscalYear: 2025 });
    const res = await reviewSummaryPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.riskSummary).toBe("リスク管理のサマリー");
    expect(json.trainingSummary).toBe("教育のサマリー");
    expect(json.vendorSummary).toBe("委託先管理のサマリー");
    expect(json.auditSummary).toBe("監査のサマリー");
    expect(json.incidentSummary).toBe("事故対応のサマリー");
  });

  it("バリデーション: 必須パラメータが欠落", async () => {
    const req = createRequest({ reviewId });
    const res = await reviewSummaryPost(req);
    expect(res.status).toBe(400);
  });

  it("存在しないレビューIDで404", async () => {
    const req = createRequest({ reviewId: "non-existent", fiscalYear: 2025 });
    const res = await reviewSummaryPost(req);
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════
// AiUsageLog 記録テスト
// ════════════════════════════════════════════════════════════════════
describe("AiUsageLog記録", () => {
  it("AI API呼び出し時にUsageLogが記録される", async () => {
    const mockSuggestions = [
      {
        lifecycleStage: "STORAGE",
        description: "テスト",
        threatSource: "テスト",
        vulnerability: "テスト",
        likelihood: 1,
        impact: 1,
      },
    ];
    mockGenerateContent.mockResolvedValueOnce(
      makeGeminiResponse(JSON.stringify(mockSuggestions))
    );

    const beforeCount = await testPrisma.aiUsageLog.count({
      where: { feature: "RISK_SUGGESTIONS" },
    });

    const req = createRequest({
      businessProcessId: testData.bp.id,
      assessmentId: riskAssessmentId,
    });
    await riskSuggestionsPost(req);

    const afterCount = await testPrisma.aiUsageLog.count({
      where: { feature: "RISK_SUGGESTIONS" },
    });

    expect(afterCount).toBe(beforeCount + 1);
  });
});
