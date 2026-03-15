import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.user.organizationId;
  const currentYear = new Date().getFullYear();
  const now = new Date();

  const [
    // 台帳管理
    processCount,
    totalItems,
    pendingApproval,
    approved,
    rejected,
    recentLogs,
    processes,
    // リスク管理
    riskAssessmentCount,
    riskItemIdentified,
    riskItemHigh,
    // 文書管理
    documentCount,
    documentActive,
    // 教育管理
    trainingPlanCount,
    trainingResultTotal,
    trainingResultCompleted,
    // 委託先管理
    vendorCount,
    vendorNeedsEval,
    // 監査管理
    auditPlanCount,
    correctiveUnclosed,
    // 事故対応
    incidentCount,
    incidentOpen,
    incidentOverdue,
    // 申請管理
    applicationPackageCount,
    latestApplication,
    // マネジメントレビュー
    reviewCount,
    reviewUnapproved,
  ] = await Promise.all([
    // 台帳管理
    prisma.businessProcess.count({ where: { organizationId: orgId } }),
    prisma.registerItem.count({ where: { businessProcess: { organizationId: orgId } } }),
    prisma.registerItem.count({
      where: { businessProcess: { organizationId: orgId }, status: "PENDING_APPROVAL" },
    }),
    prisma.registerItem.count({
      where: { businessProcess: { organizationId: orgId }, status: { in: ["APPROVED", "LOCKED"] } },
    }),
    prisma.registerItem.count({
      where: { businessProcess: { organizationId: orgId }, status: "REJECTED" },
    }),
    prisma.auditLog.findMany({
      where: { user: { organizationId: orgId } },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { user: true },
    }),
    prisma.businessProcess.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { registerItems: true } },
        registerItems: { select: { status: true } },
      },
    }),

    // リスク管理
    prisma.riskAssessment.count({ where: { organizationId: orgId } }),
    prisma.riskItem.count({
      where: { riskAssessment: { organizationId: orgId }, status: "IDENTIFIED" },
    }),
    prisma.riskItem.count({
      where: { riskAssessment: { organizationId: orgId }, riskValue: { gte: 6 } },
    }),

    // 文書管理
    prisma.pMSDocument.count({ where: { organizationId: orgId } }),
    prisma.pMSDocument.count({ where: { organizationId: orgId, status: "ACTIVE" } }),

    // 教育管理
    prisma.trainingPlan.count({ where: { organizationId: orgId, fiscalYear: currentYear } }),
    prisma.trainingResult.count({
      where: { trainingSession: { trainingPlan: { organizationId: orgId, fiscalYear: currentYear } } },
    }),
    prisma.trainingResult.count({
      where: {
        trainingSession: { trainingPlan: { organizationId: orgId, fiscalYear: currentYear } },
        status: "COMPLETED",
      },
    }),

    // 委託先管理
    prisma.vendor.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
    prisma.vendor.count({
      where: {
        organizationId: orgId,
        status: "ACTIVE",
        OR: [
          { nextEvaluationDue: { lte: now } },
          { overallRating: "UNRATED" },
        ],
      },
    }),

    // 監査管理
    prisma.auditPlan.count({ where: { organizationId: orgId } }),
    prisma.correctiveAction.count({
      where: {
        status: { notIn: ["CLOSED", "VERIFIED"] },
        OR: [
          { auditFinding: { auditPlan: { organizationId: orgId } } },
          { incident: { organizationId: orgId } },
        ],
      },
    }),

    // 事故対応
    prisma.incidentCase.count({ where: { organizationId: orgId } }),
    prisma.incidentCase.count({
      where: { organizationId: orgId, status: { notIn: ["CLOSED"] } },
    }),
    prisma.incidentCase.count({
      where: {
        organizationId: orgId,
        status: { notIn: ["CLOSED"] },
        OR: [
          { speedReportDeadline: { lt: now }, speedReportedAt: null, requiresSpeedReport: true },
          { fullReportDeadline: { lt: now }, fullReportedAt: null, requiresFullReport: true },
        ],
      },
    }),

    // 申請管理
    prisma.applicationPackage.count({ where: { organizationId: orgId } }),
    prisma.applicationPackage.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: { status: true, fiscalYear: true },
    }),

    // マネジメントレビュー
    prisma.managementReview.count({ where: { organizationId: orgId } }),
    prisma.managementReview.count({
      where: { organizationId: orgId, status: { notIn: ["APPROVED", "LOCKED"] } },
    }),
  ]);

  const processProgress = processes.map((p) => {
    const items = p.registerItems;
    const lockedOrApproved = items.filter((i) => ["LOCKED", "APPROVED"].includes(i.status)).length;
    const total = items.length;
    return {
      id: p.id,
      name: p.name,
      total,
      approved: lockedOrApproved,
      pending: items.filter((i) => i.status === "PENDING_APPROVAL").length,
      draft: items.filter((i) => ["DRAFT", "REVIEWING"].includes(i.status)).length,
      progress: total > 0 ? Math.round((lockedOrApproved / total) * 100) : 0,
    };
  });

  const trainingCompletionRate =
    trainingResultTotal > 0 ? Math.round((trainingResultCompleted / trainingResultTotal) * 100) : 0;

  return NextResponse.json({
    stats: { processCount, totalItems, pendingApproval, approved, rejected },
    processProgress,
    recentLogs: recentLogs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      userName: l.user?.name ?? "システム",
      details: l.details,
      createdAt: l.createdAt,
    })),
    // 各モジュール統計
    risk: {
      assessmentCount: riskAssessmentCount,
      identifiedCount: riskItemIdentified,
      highRiskCount: riskItemHigh,
    },
    documents: {
      totalCount: documentCount,
      activeCount: documentActive,
    },
    training: {
      planCount: trainingPlanCount,
      completionRate: trainingCompletionRate,
    },
    vendors: {
      totalCount: vendorCount,
      needsEvalCount: vendorNeedsEval,
    },
    audit: {
      planCount: auditPlanCount,
      unclosedCorrectiveCount: correctiveUnclosed,
    },
    incidents: {
      totalCount: incidentCount,
      openCount: incidentOpen,
      overdueCount: incidentOverdue,
    },
    application: {
      packageCount: applicationPackageCount,
      latestStatus: latestApplication?.status ?? null,
      latestFiscalYear: latestApplication?.fiscalYear ?? null,
    },
    reviews: {
      totalCount: reviewCount,
      unapprovedCount: reviewUnapproved,
    },
  });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
