import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/sessions/[id] — セッション詳細（進捗・統計）
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await prisma.agentSession.findUnique({
    where: { id },
    include: {
      company: true,
      questions: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // 業務プロセス＋PII＋リスク詳細を取得
  const businessProcesses = await prisma.businessProcess.findMany({
    where: { companyId: session.companyId },
    include: {
      bpPiis: {
        include: {
          personalInfoItem: true,
          dataSubject: true,
          storageLocation: true,
          riskAssessments: { orderBy: { riskScore: "desc" } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // 統計情報
  const statusFields = [
    "purposeStatus", "acquisitionMethodStatus", "storageStatus",
    "retentionPeriodStatus", "disposalMethodStatus", "thirdPartyStatus",
  ] as const;

  let confirmed = 0, estimated = 0, unconfirmed = 0, insufficientEvidence = 0;
  const allBpPiis = businessProcesses.flatMap(bp => bp.bpPiis);
  for (const bpPii of allBpPiis) {
    for (const field of statusFields) {
      const v = bpPii[field];
      if (v === "confirmed") confirmed++;
      else if (v === "estimated") estimated++;
      else if (v === "unconfirmed") unconfirmed++;
      else insufficientEvidence++;
    }
  }

  const total = confirmed + estimated + unconfirmed + insufficientEvidence;
  const completionRate = total > 0 ? Math.round(((confirmed + estimated) / total) * 100) : 0;

  const allRisks = allBpPiis.flatMap(p => p.riskAssessments);
  const riskCount = allRisks.length;
  const highRiskCount = allRisks.filter(r => (r.riskScore ?? 0) >= 6).length;

  const documentCount = await prisma.document.count({
    where: { companyId: session.companyId },
  });

  // フロント用に整形
  const registry = businessProcesses.map(bp => ({
    id: bp.id,
    name: bp.name,
    department: bp.department,
    description: bp.description,
    items: bp.bpPiis.map(pii => ({
      id: pii.id,
      dataCategory: pii.personalInfoItem.canonicalName,
      dataSubject: pii.dataSubject?.name ?? null,
      purpose: pii.purpose,
      purposeStatus: pii.purposeStatus,
      acquisitionMethod: pii.acquisitionMethod,
      acquisitionMethodStatus: pii.acquisitionMethodStatus,
      storageLocation: pii.storageLocation?.name ?? null,
      storageStatus: pii.storageStatus,
      retentionPeriod: pii.retentionPeriod,
      retentionPeriodStatus: pii.retentionPeriodStatus,
      disposalMethod: pii.disposalMethod,
      disposalMethodStatus: pii.disposalMethodStatus,
      thirdPartyStatus: pii.thirdPartyStatus,
    })),
  }));

  const risks = allRisks
    .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
    .map(r => {
      const bp = businessProcesses.find(bp => bp.bpPiis.some(p => p.id === r.bpPiiId));
      return {
        id: r.id,
        businessProcess: bp?.name ?? "不明",
        threat: r.threat,
        vulnerability: r.vulnerability,
        likelihood: r.likelihood,
        impact: r.impact,
        riskScore: r.riskScore,
        currentMeasures: r.currentMeasures,
        recommendedMeasures: r.recommendedMeasures,
        confidence: r.confidence,
      };
    });

  return NextResponse.json({
    session,
    stats: {
      businessProcessCount: businessProcesses.length,
      completionRate,
      confirmed,
      estimated,
      unconfirmed,
      insufficientEvidence,
      total,
      riskCount,
      highRiskCount,
      documentCount,
      pendingQuestions: session.questions.filter(q => q.status === "pending").length,
    },
    registry,
    risks,
  });
}
