import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGeminiClient, MODEL } from "@/lib/ai/gemini-client";
import { buildReviewSummaryPrompt } from "@/lib/ai/prompts/review-summary";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { reviewSummarySchema } from "@/lib/validations/ai";

interface ReviewSummaryResult {
  riskSummary: string;
  trainingSummary: string;
  vendorSummary: string;
  auditSummary: string;
  incidentSummary: string;
}

function getMockSummary(): ReviewSummaryResult {
  return {
    riskSummary:
      "当年度のリスクアセスメントを実施し、主要な業務プロセスのリスクを特定・評価しました。高リスク項目については優先的に対策を実施し、残留リスクの受容判断を行いました。今後はリスク対策の実効性検証を強化する必要があります。",
    trainingSummary:
      "全従業者を対象とした個人情報保護教育を実施しました。理解度テストの平均スコアは概ね良好でした。次年度は事例ベースの実践的な教育コンテンツの充実を検討します。",
    vendorSummary:
      "委託先の定期評価を実施し、管理体制の確認を行いました。一部の委託先において改善要請を行い、対応を確認しました。契約更新時の評価プロセスを標準化する必要があります。",
    auditSummary:
      "内部監査を計画通り実施し、指摘事項に対する是正措置を完了しました。前年度の是正事項についてもフォローアップを行い、改善が維持されていることを確認しました。",
    incidentSummary:
      "事故対応体制を整備し、発生した事案に対して適切に対応しました。速報義務の判断基準を明確化し、報告プロセスの迅速化を図りました。予防措置の強化が今後の課題です。",
  };
}

export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = parseBody(reviewSummarySchema, body);
  if (!parsed.success) return parsed.error;
  const { reviewId, fiscalYear } = parsed.data;

  const review = await prisma.managementReview.findFirst({
    where: { id: reviewId, organizationId: session.user.organizationId },
  });

  if (!review) {
    return NextResponse.json({ error: "マネジメントレビューが見つかりません" }, { status: 404 });
  }

  const orgId = review.organizationId;

  // 各モジュールの統計データを収集
  const [
    riskItems,
    trainingSessions,
    trainingResults,
    vendors,
    vendorEvaluations,
    auditPlans,
    auditFindings,
    correctiveActions,
    incidents,
  ] = await Promise.all([
    prisma.riskItem.findMany({
      where: { riskAssessment: { organizationId: orgId, fiscalYear } },
      select: { riskValue: true, status: true },
    }),
    prisma.trainingSession.findMany({
      where: { trainingPlan: { organizationId: orgId, fiscalYear } },
      select: { id: true },
    }),
    prisma.trainingResult.findMany({
      where: { trainingSession: { trainingPlan: { organizationId: orgId, fiscalYear } } },
      select: { quizScore: true, quizMaxScore: true },
    }),
    prisma.vendor.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      select: { id: true, overallRating: true },
    }),
    prisma.vendorEvaluation.findMany({
      where: { vendor: { organizationId: orgId }, fiscalYear },
      select: { rating: true },
    }),
    prisma.auditPlan.findMany({
      where: { organizationId: orgId, fiscalYear },
      select: { id: true },
    }),
    prisma.auditFinding.findMany({
      where: { auditPlan: { organizationId: orgId, fiscalYear } },
      select: { severity: true, status: true },
    }),
    prisma.correctiveAction.findMany({
      where: { auditFinding: { auditPlan: { organizationId: orgId, fiscalYear } } },
      select: { status: true },
    }),
    prisma.incidentCase.findMany({
      where: { organizationId: orgId },
      select: { severity: true, status: true, createdAt: true },
    }),
  ]);

  // 統計データの集計
  const riskStats = {
    total: riskItems.length,
    highRisk: riskItems.filter((r) => r.riskValue >= 6).length,
    treated: riskItems.filter((r) => r.status === "TREATED").length,
  };

  const validScores = trainingResults.filter(
    (r) => r.quizScore !== null && r.quizMaxScore !== null && r.quizMaxScore > 0
  );
  const avgScore =
    validScores.length > 0
      ? Math.round(
          validScores.reduce(
            (sum, r) => sum + ((r.quizScore ?? 0) / (r.quizMaxScore ?? 1)) * 100,
            0
          ) / validScores.length
        )
      : null;

  const trainingStats = {
    sessions: trainingSessions.length,
    participants: trainingResults.length,
    avgScore,
  };

  const ratingBreakdown: Record<string, number> = {};
  for (const evaluation of vendorEvaluations) {
    const rating = evaluation.rating ?? "UNRATED";
    ratingBreakdown[rating] = (ratingBreakdown[rating] ?? 0) + 1;
  }

  const vendorStats = {
    total: vendors.length,
    evaluated: vendorEvaluations.length,
    ratingBreakdown,
  };

  const auditStats = {
    plans: auditPlans.length,
    findings: auditFindings.length,
    corrected: correctiveActions.filter((c) => c.status === "CLOSED" || c.status === "VERIFIED").length,
  };

  const bySeverity: Record<string, number> = {};
  for (const inc of incidents) {
    bySeverity[inc.severity] = (bySeverity[inc.severity] ?? 0) + 1;
  }

  const incidentStats = {
    total: incidents.length,
    bySeverity,
    closed: incidents.filter((i) => i.status === "CLOSED").length,
  };

  const prompt = buildReviewSummaryPrompt({
    fiscalYear,
    riskStats,
    trainingStats,
    vendorStats,
    auditStats,
    incidentStats,
  });

  const start = Date.now();
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSONが見つかりませんでした");
    const summary: ReviewSummaryResult = JSON.parse(jsonMatch[0]);

    const usage = result.response.usageMetadata;
    await prisma.aiUsageLog.create({
      data: {
        userId: session.user.id,
        feature: "REVIEW_SUMMARY",
        inputTokens: usage?.promptTokenCount ?? null,
        outputTokens: usage?.candidatesTokenCount ?? null,
        durationMs: Date.now() - start,
      },
    });

    return NextResponse.json(summary);
  } catch (err) {
    if (err instanceof Error && err.message.includes("GOOGLE_API_KEY")) {
      return NextResponse.json(getMockSummary());
    }
    const msg = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  } catch (error) {
    console.error("POST /api/ai/review-summary error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
