import { getServerSession } from "next-auth";
import { authOptions, ROLE_LABELS } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "作成",
  UPDATE: "更新",
  APPROVE: "承認",
  REJECT: "差戻し",
  REQUEST_APPROVAL: "承認申請",
  SUBMIT: "提出",
  AI_GENERATE: "AI生成",
  LOCK: "ロック",
};

const ENTITY_LABELS: Record<string, string> = {
  RegisterItem: "台帳",
  BusinessProcess: "業務プロセス",
  Hearing: "ヒアリング",
};

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "下書き",
  GENERATING: "生成中",
  READY: "準備完了",
  REVIEWING: "レビュー中",
  APPROVED: "承認済",
  SUBMITTED: "提出済",
};

function StatCard({ label, value, color, href }: { label: string; value: number | string; color: string; href?: string }) {
  const inner = (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors ${href ? "cursor-pointer" : ""}`}>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

type ModuleCardProps = {
  title: string;
  href: string;
  icon: string;
  stats: Array<{ label: string; value: number | string; status: "ok" | "warn" | "danger" | "neutral" }>;
};

function ModuleCard({ title, href, icon, stats }: ModuleCardProps) {
  const statusColors = {
    ok: "text-green-600",
    warn: "text-amber-600",
    danger: "text-red-600",
    neutral: "text-slate-800",
  };

  const statusDotColors = {
    ok: "bg-green-500",
    warn: "bg-amber-500",
    danger: "bg-red-500",
    neutral: "bg-slate-400",
  };

  // カード全体のステータスを最も深刻なものに合わせる
  const worstStatus = stats.some((s) => s.status === "danger")
    ? "danger"
    : stats.some((s) => s.status === "warn")
    ? "warn"
    : stats.some((s) => s.status === "ok")
    ? "ok"
    : "neutral";

  const borderColors = {
    ok: "border-green-200 hover:border-green-300",
    warn: "border-amber-200 hover:border-amber-300",
    danger: "border-red-200 hover:border-red-300",
    neutral: "border-slate-200 hover:border-slate-300",
  };

  return (
    <Link href={href} className="block">
      <div className={`bg-white rounded-xl border ${borderColors[worstStatus]} p-5 transition-colors cursor-pointer`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{icon}</span>
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          <div className={`w-2 h-2 rounded-full ml-auto ${statusDotColors[worstStatus]}`} />
        </div>
        <div className="space-y-1.5">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{stat.label}</span>
              <span className={`text-sm font-bold ${statusColors[stat.status]}`}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const orgId = session.user.organizationId;
  const role = session.user.role;
  const currentYear = new Date().getFullYear();
  const now = new Date();

  const [
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
    prisma.registerItem.count({ where: { businessProcess: { organizationId: orgId } } }),
    prisma.registerItem.count({ where: { businessProcess: { organizationId: orgId }, status: "PENDING_APPROVAL" } }),
    prisma.registerItem.count({ where: { businessProcess: { organizationId: orgId }, status: { in: ["APPROVED", "LOCKED"] } } }),
    prisma.registerItem.count({ where: { businessProcess: { organizationId: orgId }, status: "REJECTED" } }),
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { user: true },
    }),
    prisma.businessProcess.findMany({
      where: { organizationId: orgId },
      include: { registerItems: { select: { status: true } } },
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
    const total = p.registerItems.length;
    const done = p.registerItems.filter((i) => ["APPROVED", "LOCKED"].includes(i.status)).length;
    const pending = p.registerItems.filter((i) => i.status === "PENDING_APPROVAL").length;
    return { id: p.id, name: p.name, total, done, pending, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  });

  const trainingCompletionRate =
    trainingResultTotal > 0 ? Math.round((trainingResultCompleted / trainingResultTotal) * 100) : 0;

  return (
    <div>
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 mb-1">
          ダッシュボード
        </h1>
        <p className="text-sm text-slate-500">
          <span className="font-medium text-slate-700">{session.user.name}</span> さん（{ROLE_LABELS[role]}）のビューを表示しています。
        </p>
      </div>

      {/* 台帳統計 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="台帳アイテム総数" value={totalItems} color="text-slate-800" href="/register/items" />
        <StatCard label="承認申請中" value={pendingApproval} color="text-amber-600" href="/register/approvals" />
        <StatCard label="承認済み" value={approved} color="text-green-600" href="/register/items" />
        <StatCard label="差戻し対応" value={rejected} color="text-red-600" href="/register/approvals" />
      </div>

      {/* モジュール別統計カード */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">モジュール別ステータス</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ModuleCard
            title="リスク管理"
            href="/risk"
            icon="⚠"
            stats={[
              { label: "評価数", value: riskAssessmentCount, status: riskAssessmentCount > 0 ? "ok" : "neutral" },
              { label: "未対応リスク", value: riskItemIdentified, status: riskItemIdentified > 0 ? "warn" : "ok" },
              { label: "高リスク", value: riskItemHigh, status: riskItemHigh > 0 ? "danger" : "ok" },
            ]}
          />
          <ModuleCard
            title="文書管理"
            href="/documents"
            icon="📁"
            stats={[
              { label: "文書数", value: documentCount, status: "neutral" },
              { label: "有効文書", value: documentActive, status: documentActive > 0 ? "ok" : "neutral" },
            ]}
          />
          <ModuleCard
            title="教育管理"
            href="/training"
            icon="🎓"
            stats={[
              { label: `${currentYear}年度計画`, value: trainingPlanCount, status: trainingPlanCount > 0 ? "ok" : "neutral" },
              { label: "受講完了率", value: `${trainingCompletionRate}%`, status: trainingCompletionRate >= 80 ? "ok" : trainingCompletionRate >= 50 ? "warn" : "neutral" },
            ]}
          />
          <ModuleCard
            title="委託先管理"
            href="/vendors"
            icon="🏢"
            stats={[
              { label: "委託先数", value: vendorCount, status: "neutral" },
              { label: "要評価", value: vendorNeedsEval, status: vendorNeedsEval > 0 ? "warn" : "ok" },
            ]}
          />
          <ModuleCard
            title="監査・是正"
            href="/audit"
            icon="🔍"
            stats={[
              { label: "監査計画", value: auditPlanCount, status: "neutral" },
              { label: "未クローズ是正", value: correctiveUnclosed, status: correctiveUnclosed > 0 ? "warn" : "ok" },
            ]}
          />
          <ModuleCard
            title="事故対応"
            href="/incidents"
            icon="🚨"
            stats={[
              { label: "事故件数", value: incidentCount, status: "neutral" },
              { label: "未対応", value: incidentOpen, status: incidentOpen > 0 ? "warn" : "ok" },
              { label: "報告期限超過", value: incidentOverdue, status: incidentOverdue > 0 ? "danger" : "ok" },
            ]}
          />
          <ModuleCard
            title="申請管理"
            href="/application"
            icon="📝"
            stats={[
              { label: "パッケージ数", value: applicationPackageCount, status: "neutral" },
              {
                label: "最新状態",
                value: latestApplication ? APPLICATION_STATUS_LABELS[latestApplication.status] ?? latestApplication.status : "未作成",
                status: latestApplication?.status === "SUBMITTED" ? "ok" : latestApplication?.status === "APPROVED" ? "ok" : "neutral",
              },
            ]}
          />
          <ModuleCard
            title="マネジメントレビュー"
            href="/reviews"
            icon="📊"
            stats={[
              { label: "レビュー数", value: reviewCount, status: "neutral" },
              { label: "未承認", value: reviewUnapproved, status: reviewUnapproved > 0 ? "warn" : "ok" },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Process Progress */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">台帳整備進捗</h2>
            <Link href="/register/processes" className="text-xs text-blue-600 hover:text-blue-700">全て見る</Link>
          </div>

          {processProgress.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">業務プロセスが未登録です</p>
          ) : (
            <div className="space-y-4">
              {processProgress.map((p) => (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700">{p.name}</span>
                    <span className="text-xs text-slate-400">{p.done}/{p.total} ({p.pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${p.pct}%` }}
                    />
                  </div>
                  {p.pending > 0 && (
                    <p className="text-xs text-amber-600 mt-0.5">承認申請中 {p.pending}件</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Role-specific tasks */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            {role === "PRIVACY_OFFICER" && "承認待ち台帳"}
            {role === "DEPT_STAFF" && "ヒアリング・差戻し対応"}
            {role === "TOP_MANAGEMENT" && "全体サマリー"}
          </h2>

          {role === "PRIVACY_OFFICER" && (
            <div className="space-y-2">
              {pendingApproval > 0 ? (
                <>
                  <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <span className="text-xl">⏳</span>
                    <div>
                      <p className="text-sm font-medium text-amber-800">{pendingApproval}件の承認申請が届いています</p>
                      <Link href="/register/approvals" className="text-xs text-amber-600 hover:underline">承認一覧を確認する →</Link>
                    </div>
                  </div>
                  {rejected > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                      <span className="text-xl">↩</span>
                      <div>
                        <p className="text-sm font-medium text-red-800">{rejected}件の差戻し対応が必要です</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">承認待ちはありません</p>
              )}
            </div>
          )}

          {role === "DEPT_STAFF" && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-xl">📋</span>
                <div>
                  <p className="text-sm font-medium text-blue-800">ヒアリングを実施する</p>
                  <Link href="/register/hearing" className="text-xs text-blue-600 hover:underline">ヒアリング入力へ →</Link>
                </div>
              </div>
              {rejected > 0 && (
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                  <span className="text-xl">↩</span>
                  <div>
                    <p className="text-sm font-medium text-red-800">{rejected}件の差戻し対応が必要です</p>
                    <Link href="/register/approvals" className="text-xs text-red-600 hover:underline">確認する →</Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {role === "TOP_MANAGEMENT" && (
            <div className="space-y-3">
              {[
                { label: "全業務プロセス", value: processes.length, unit: "件", href: "/register/processes" },
                { label: "台帳整備完了", value: approved, unit: "件", href: "/register/items" },
                { label: "整備率", value: totalItems > 0 ? Math.round((approved / totalItems) * 100) : 0, unit: "%", href: "/register/items" },
              ].map((s) => (
                <Link key={s.label} href={s.href} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                  <span className="text-sm text-slate-600">{s.label}</span>
                  <span className="text-base font-bold text-slate-800">{s.value}<span className="text-xs font-normal text-slate-400 ml-0.5">{s.unit}</span></span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Activity Log */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 col-span-2">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">最近の活動</h2>
          {recentLogs.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">活動ログがありません</p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => {
                let details: Record<string, string> = {};
                try { details = JSON.parse(log.details ?? "{}"); } catch { /* ignore parse error */ }
                return (
                  <div key={log.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs shrink-0">
                      {log.user?.name?.[0] ?? "S"}
                    </div>
                    <span className="text-xs text-slate-500 w-24 shrink-0">
                      {new Date(log.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                    <span className="text-xs font-medium text-slate-700 w-16 shrink-0">
                      {log.user?.name ?? "システム"}
                    </span>
                    <span className="text-xs text-slate-600">
                      {ENTITY_LABELS[log.entityType] ?? log.entityType}を
                      {ACTION_LABELS[log.action] ?? log.action}
                      {details.message ? `: ${details.message}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Suggest */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-5 col-span-2">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-white text-sm">✨</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-800 mb-1">AIアシスタントからのサジェスト</p>
              <p className="text-xs text-blue-700 leading-relaxed">
                {totalItems === 0
                  ? "台帳アイテムが未登録です。まず「業務プロセス」を登録して、AIヒアリングフローで台帳候補を生成することをお勧めします。"
                  : approved < totalItems
                  ? `${totalItems - approved}件の台帳アイテムがまだ承認されていません。ヒアリングで推定（INFERRED）状態のアイテムを確認・確定し、承認申請してください。`
                  : "台帳整備が完了しています。次はリスク管理・内部監査の準備を進めましょう。"}
              </p>
              <Link href="/ai-support" className="text-xs text-blue-600 hover:text-blue-700 mt-2 inline-block font-medium hover:underline">
                AIアシスタントに相談する →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
