import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/sessions/[id] — セッション詳細（v1.2: 構造化ビュー対応）
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await prisma.agentSession.findUnique({
    where: { id },
    include: {
      company: {
        include: { companyProfile: true },
      },
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
      children: { select: { id: true, name: true } },
      bpPiis: {
        include: {
          personalInfoItem: true,
          dataSubject: true,
          storageLocation: true,
          thirdParties: { include: { thirdParty: true } },
          riskAssessments: { orderBy: { riskScore: "desc" } },
          evidences: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // 統計情報（v1.2拡張フィールド含む）
  const statusFields = [
    "purposeStatus", "acquisitionMethodStatus", "storageStatus",
    "retentionPeriodStatus", "disposalMethodStatus", "thirdPartyStatus",
    "categoryStatus", "infoNameStatus", "classificationStatus",
    "mediaTypeStatus", "storageMethodStatus", "usagePeriodStatus",
    "managerStatus", "accessiblePersonsStatus",
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
  const processesWithPii = businessProcesses.filter(bp => bp.bpPiis.length > 0).length;
  const processesWithRisk = businessProcesses.filter(bp =>
    bp.bpPiis.some(pii => pii.riskAssessments.length > 0)
  ).length;

  const documentCount = await prisma.document.count({
    where: { companyId: session.companyId },
  });

  // 会社全体に対するAIメッセージ履歴（チャットモーダル外の発話）
  const globalAgentMessages = await prisma.chatMessage.findMany({
    where: { sessionId: id, businessProcessId: null },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, role: true, content: true, createdAt: true },
  });

  // CompanyProfile整形
  const profile = session.company.companyProfile;
  const companyProfile = profile ? {
    id: profile.id,
    representative: profile.representative,
    address: profile.address,
    established: profile.established,
    businessDescription: profile.businessDescription,
    employees: {
      total: profile.employeesTotal,
      fullTime: profile.employeesFullTime,
      contract: profile.employeesContract,
      partTime: profile.employeesPartTime,
      temporary: profile.employeesTemporary,
    },
    locations: JSON.parse(profile.locations),
    groupCompanies: JSON.parse(profile.groupCompanies),
    mainServices: JSON.parse(profile.mainServices),
    statuses: {
      representative: profile.representativeStatus,
      address: profile.addressStatus,
      established: profile.establishedStatus,
      businessDescription: profile.businessDescriptionStatus,
      employees: profile.employeesStatus,
      locations: profile.locationsStatus,
    },
  } : null;

  // フロント用に整形（v1.2: 拡張カラム含む）
  const registry = businessProcesses.map(bp => ({
    id: bp.id,
    name: bp.name,
    department: bp.department,
    description: bp.description,
    parentId: bp.parentId,
    children: bp.children.map(c => ({ id: c.id, name: c.name })),
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
      // v1.2 追加フィールド
      category: pii.category,
      categoryStatus: pii.categoryStatus,
      infoName: pii.infoName,
      infoNameStatus: pii.infoNameStatus,
      classification: pii.classification,
      classificationStatus: pii.classificationStatus,
      mediaType: pii.mediaType,
      mediaTypeStatus: pii.mediaTypeStatus,
      storageMethod: pii.storageMethod,
      storageMethodStatus: pii.storageMethodStatus,
      usagePeriod: pii.usagePeriod,
      usagePeriodStatus: pii.usagePeriodStatus,
      disclosureTarget: pii.disclosureTarget,
      disclosureTargetStatus: pii.disclosureTargetStatus,
      manager: pii.manager,
      managerStatus: pii.managerStatus,
      accessiblePersons: pii.accessiblePersons,
      accessiblePersonsStatus: pii.accessiblePersonsStatus,
      remarks: pii.remarks,
      volumeEstimate: pii.volumeEstimate,
      // 関連情報
      thirdParties: pii.thirdParties.map(t => ({
        name: t.thirdParty.name,
        role: t.thirdParty.role,
      })),
      evidences: pii.evidences.map(e => ({
        id: e.id,
        targetField: e.targetField,
        sourceType: e.sourceType,
        sourceRef: e.sourceRef,
        detail: e.detail,
      })),
      isSensitive: pii.personalInfoItem.isSensitive,
    })),
  }));

  // 未確認項目の一覧
  const unconfirmedItems: { businessProcess: string; infoName: string; field: string }[] = [];
  const estimatedItems: { businessProcess: string; infoName: string; field: string; value: string }[] = [];
  const requiredFields = ["purpose", "acquisitionMethod", "retentionPeriod", "disposalMethod", "manager"] as const;
  for (const bp of businessProcesses) {
    for (const pii of bp.bpPiis) {
      for (const f of requiredFields) {
        const statusKey = `${f}Status` as keyof typeof pii;
        const value = pii[f as keyof typeof pii];
        if (pii[statusKey] === "estimated" && typeof value === "string" && value.trim()) {
          estimatedItems.push({
            businessProcess: bp.name,
            infoName: pii.infoName ?? pii.personalInfoItem.canonicalName,
            field: f,
            value,
          });
        }
        if (pii[statusKey] === "unconfirmed" && !pii[f as keyof typeof pii]) {
          unconfirmedItems.push({
            businessProcess: bp.name,
            infoName: pii.infoName ?? pii.personalInfoItem.canonicalName,
            field: f,
          });
        }
      }
    }
  }

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

  const pendingQuestionCount = session.questions.filter(q => q.status === "pending").length;
  const lastSessionUpdateMs = new Date(session.updatedAt).getTime();
  const staleRunning = session.status === "running" &&
    pendingQuestionCount === 0 &&
    Date.now() - lastSessionUpdateMs > 150_000;

  if (staleRunning) {
    await prisma.agentSession.update({
      where: { id },
      data: { status: "idle" },
    });
    session.status = "idle";
  }

  return NextResponse.json({
    session,
    companyProfile,
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
      pendingQuestions: pendingQuestionCount,
    },
    autonomy: {
      mode: session.phase === "phase3_risk_pms" || riskCount > 0 ? "risk_autopilot" : "discovery",
      steps: [
        {
          id: "research",
          label: "公開情報・資料調査",
          status: profile ? "done" : session.status === "running" ? "running" : "pending",
          detail: profile ? "会社基本情報を取得済み" : "会社基本情報を収集中",
        },
        {
          id: "process_discovery",
          label: "業務プロセス洗い出し",
          status: businessProcesses.length > 0 ? "done" : session.status === "running" ? "running" : "pending",
          detail: `${businessProcesses.length}件の業務を登録`,
        },
        {
          id: "register_draft",
          label: "個人情報台帳の仮説作成",
          status: allBpPiis.length > 0 ? "done" : businessProcesses.length > 0 ? "running" : "pending",
          detail: `${allBpPiis.length}件の個人情報取扱いを整理`,
        },
        {
          id: "human_checkpoints",
          label: "人間への確認依頼",
          status: session.questions.some(q => q.status === "pending")
            ? "needs_human"
            : session.questions.length > 0 ? "done" : "pending",
          detail: `${session.questions.filter(q => q.status === "pending").length}件が確認待ち`,
        },
        {
          id: "risk_assessment",
          label: "リスク分析",
          status: riskCount > 0
            ? (processesWithRisk >= processesWithPii && processesWithPii > 0 ? "done" : "running")
            : session.phase === "phase3_risk_pms" && session.status === "running" ? "running" : "pending",
          detail: `${processesWithRisk}/${processesWithPii}業務、${riskCount}件のリスクを登録`,
        },
      ],
      nextAction: riskCount === 0
        ? "AI自動運転で台帳からリスク分析まで進められます"
        : session.questions.some(q => q.status === "pending")
          ? "重要な確認依頼に回答すると推定値を確定できます"
          : "リスク分析まで到達しています。帳票出力を試せます",
    },
    registry,
    risks,
    unconfirmedItems,
    estimatedItems,
    agentMessages: globalAgentMessages.reverse(),
  });
}

// PATCH /api/sessions/[id] — セッション状態の手動更新（stuck recovery）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { status, phase } = body as { status?: string; phase?: string };

  const data: Record<string, string> = {};
  if (status) data.status = status;
  if (phase) data.phase = phase;

  const updated = await prisma.agentSession.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
