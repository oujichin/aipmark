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

function StatCard({ label, value, color, href }: { label: string; value: number; color: string; href?: string }) {
  const inner = (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors ${href ? "cursor-pointer" : ""}`}>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const orgId = session.user.organizationId;
  const role = session.user.role;

  const [totalItems, pendingApproval, approved, rejected, recentLogs, processes] = await Promise.all([
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
  ]);

  const processProgress = processes.map((p) => {
    const total = p.registerItems.length;
    const done = p.registerItems.filter((i) => ["APPROVED", "LOCKED"].includes(i.status)).length;
    const pending = p.registerItems.filter((i) => i.status === "PENDING_APPROVAL").length;
    return { id: p.id, name: p.name, total, done, pending, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  });

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

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="台帳アイテム総数" value={totalItems} color="text-slate-800" href="/register/items" />
        <StatCard label="承認申請中" value={pendingApproval} color="text-amber-600" href="/register/approvals" />
        <StatCard label="承認済み" value={approved} color="text-green-600" href="/register/items" />
        <StatCard label="差戻し対応" value={rejected} color="text-red-600" href="/register/approvals" />
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
                try { details = JSON.parse(log.details ?? "{}"); } catch {}
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
