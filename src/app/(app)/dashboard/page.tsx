"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { QuestionCard } from "@/components/question-card";
import { StatusBadge } from "@/components/status-badge";

interface RegistryItem {
  id: string;
  dataCategory: string;
  dataSubject: string | null;
  purpose: string | null;
  purposeStatus: string;
  acquisitionMethod: string | null;
  acquisitionMethodStatus: string;
  storageLocation: string | null;
  storageStatus: string;
  retentionPeriod: string | null;
  retentionPeriodStatus: string;
  disposalMethod: string | null;
  disposalMethodStatus: string;
  thirdPartyStatus: string;
}

interface RegistryProcess {
  id: string;
  name: string;
  department: string | null;
  description: string | null;
  items: RegistryItem[];
}

interface Risk {
  id: string;
  businessProcess: string;
  threat: string;
  vulnerability: string;
  likelihood: string;
  impact: string;
  riskScore: number | null;
  currentMeasures: string | null;
  recommendedMeasures: string | null;
  confidence: string;
}

interface SessionData {
  session: {
    id: string;
    status: string;
    phase: string;
    company: { name: string; url: string | null };
    questions: Question[];
  };
  stats: {
    businessProcessCount: number;
    completionRate: number;
    confirmed: number;
    estimated: number;
    unconfirmed: number;
    insufficientEvidence: number;
    riskCount: number;
    highRiskCount: number;
    documentCount: number;
    pendingQuestions: number;
  };
  registry: RegistryProcess[];
  risks: Risk[];
}

interface Question {
  id: string;
  questionText: string;
  questionType: string;
  options: string | null;
  priority: string;
  context: string | null;
  status: string;
  answer: string | null;
}

const PHASE_LABELS: Record<string, string> = {
  discovery: "資料読込み・Web調査中",
  gap_analysis: "ギャップ分析・質問生成中",
  drafting: "文書ドラフト作成中",
  review: "レビュー完了",
};

const STATUS_LABELS: Record<string, string> = {
  running: "実行中",
  idle: "待機中",
  waiting_for_answers: "回答待ち",
  completed: "完了",
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center mt-20"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch(`/api/sessions/${sessionId}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (!sessionId) {
    return <p className="text-gray-500 text-center mt-12">セッションIDが指定されていません</p>;
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center mt-20">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const { session, stats, registry, risks } = data;
  const pendingQuestions = session.questions.filter(q => q.status === "pending");

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {session.company.name} のPマーク整備状況
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <StatusBadge status={session.status} label={STATUS_LABELS[session.status] ?? session.status} />
          <span className="text-sm text-gray-500">{PHASE_LABELS[session.phase] ?? session.phase}</span>
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="整備率" value={`${stats.completionRate}%`} color="blue" />
        <StatCard label="業務プロセス" value={`${stats.businessProcessCount}件`} color="green" />
        <StatCard label="要確認" value={`${stats.unconfirmed + stats.insufficientEvidence}件`} color="orange" />
        <StatCard label="高リスク" value={`${stats.highRiskCount}件`} color="red" />
      </div>

      {/* AIの作業状況 */}
      {session.status === "running" && (
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">AIの作業状況</h2>
          <div className="space-y-2 text-sm">
            {stats.businessProcessCount > 0 && (
              <ActivityItem icon="check" text={`${stats.businessProcessCount}つの業務プロセスを特定しました`} />
            )}
            {stats.riskCount > 0 && (
              <ActivityItem icon="check" text={`${stats.riskCount}件のリスク評価を完了しました`} />
            )}
            <ActivityItem icon="spinner" text={PHASE_LABELS[session.phase] ?? "処理中..."} />
          </div>
        </section>
      )}

      {/* 質問セクション */}
      {pendingQuestions.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">
            あなたへの質問 ({pendingQuestions.length}件)
          </h2>
          <div className="space-y-4">
            {pendingQuestions.map(q => (
              <QuestionCard key={q.id} question={q} onAnswered={fetchData} />
            ))}
          </div>
        </section>
      )}

      {/* 個人情報管理台帳 */}
      {registry.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">個人情報管理台帳</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="pb-2 pr-3">No.</th>
                  <th className="pb-2 pr-3">業務プロセス</th>
                  <th className="pb-2 pr-3">個人情報項目</th>
                  <th className="pb-2 pr-3">データ主体</th>
                  <th className="pb-2 pr-3">利用目的</th>
                  <th className="pb-2 pr-3">保管場所</th>
                  <th className="pb-2">確信度</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let rowNum = 0;
                  return registry.flatMap(bp =>
                    bp.items.map(item => {
                      rowNum++;
                      const worstStatus = getWorstStatus([
                        item.purposeStatus,
                        item.acquisitionMethodStatus,
                        item.storageStatus,
                        item.retentionPeriodStatus,
                        item.disposalMethodStatus,
                        item.thirdPartyStatus,
                      ]);
                      return (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 pr-3 text-gray-400">{rowNum}</td>
                          <td className="py-2 pr-3 font-medium text-gray-900">{bp.name}</td>
                          <td className="py-2 pr-3 text-gray-700">{item.dataCategory}</td>
                          <td className="py-2 pr-3 text-gray-600">{item.dataSubject ?? "—"}</td>
                          <td className="py-2 pr-3 text-gray-600 max-w-48 truncate">{item.purpose ?? "—"}</td>
                          <td className="py-2 pr-3 text-gray-600">{item.storageLocation ?? "—"}</td>
                          <td className="py-2"><ConfidenceBadge status={worstStatus} /></td>
                        </tr>
                      );
                    })
                  );
                })()}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* リスク分析 */}
      {risks.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">リスク分析</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="pb-2 pr-3">スコア</th>
                  <th className="pb-2 pr-3">業務プロセス</th>
                  <th className="pb-2 pr-3">脅威</th>
                  <th className="pb-2 pr-3">現状の対策</th>
                  <th className="pb-2">推奨対策</th>
                </tr>
              </thead>
              <tbody>
                {risks.map(r => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-3"><RiskScoreBadge score={r.riskScore} /></td>
                    <td className="py-2 pr-3 font-medium text-gray-900">{r.businessProcess}</td>
                    <td className="py-2 pr-3 text-gray-700">{r.threat}</td>
                    <td className="py-2 pr-3 text-gray-600 max-w-48 truncate">{r.currentMeasures ?? "—"}</td>
                    <td className="py-2 text-gray-600 max-w-56 truncate">{r.recommendedMeasures ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <div className={`rounded-lg border p-4 ${colorMap[color] ?? colorMap.blue}`}>
      <p className="text-xs opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function ActivityItem({ icon, text }: { icon: "check" | "spinner"; text: string }) {
  return (
    <div className="flex items-center gap-2 text-gray-700">
      {icon === "check" ? (
        <span className="text-green-500 flex-shrink-0">&#10003;</span>
      ) : (
        <span className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full flex-shrink-0" />
      )}
      <span>{text}</span>
    </div>
  );
}

const CONFIDENCE_STYLES: Record<string, { label: string; className: string }> = {
  confirmed: { label: "確認済", className: "bg-green-100 text-green-800" },
  estimated: { label: "推定", className: "bg-yellow-100 text-yellow-800" },
  unconfirmed: { label: "未確認", className: "bg-orange-100 text-orange-800" },
  insufficient_evidence: { label: "証跡不足", className: "bg-red-100 text-red-800" },
};

function ConfidenceBadge({ status }: { status: string }) {
  const style = CONFIDENCE_STYLES[status] ?? CONFIDENCE_STYLES.unconfirmed;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}

function getWorstStatus(statuses: string[]): string {
  const priority = ["insufficient_evidence", "unconfirmed", "estimated", "confirmed"];
  for (const p of priority) {
    if (statuses.includes(p)) return p;
  }
  return "unconfirmed";
}

function RiskScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-400">—</span>;
  let className = "bg-green-100 text-green-800";
  if (score >= 9) className = "bg-red-100 text-red-800";
  else if (score >= 6) className = "bg-orange-100 text-orange-800";
  else if (score >= 4) className = "bg-yellow-100 text-yellow-800";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${className}`}>
      {score}
    </span>
  );
}
