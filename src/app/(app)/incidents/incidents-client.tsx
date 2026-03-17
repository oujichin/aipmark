"use client";

import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useEffect, useState, useCallback } from "react";

// ───────────────────────────────────────────────────
// 型定義
// ───────────────────────────────────────────────────

interface IncidentCase {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  incidentDate: string | null;
  discoveredDate: string | null;
  affectedCount: number | null;
  affectedScope: string | null;
  containsSensitive: boolean;
  containsMyNumber: boolean;
  requiresSpeedReport: boolean;
  speedReportDeadline: string | null;
  speedReportedAt: string | null;
  requiresFullReport: boolean;
  fullReportDeadline: string | null;
  fullReportedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  reportedBy: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
  _count?: { actions: number };
}

type StatusFilter = "" | "REPORTED" | "ASSESSING" | "RESPONDING" | "CORRECTING" | "CLOSED";

export interface IncidentsClientProps {
  initialIncidents: IncidentCase[];
}

// ───────────────────────────────────────────────────
// 定数
// ───────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  CRITICAL: { label: "重大", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  HIGH: { label: "高", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  MEDIUM: { label: "中", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  LOW: { label: "低", bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  UNASSESSED: { label: "未評価", bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200" },
};

const STATUS_LABELS: Record<string, string> = {
  REPORTED: "報告済",
  ASSESSING: "評価中",
  RESPONDING: "対応中",
  CORRECTING: "是正中",
  CLOSED: "クローズ",
};

const CATEGORY_LABELS: Record<string, string> = {
  LEAKAGE: "漏えい",
  LOSS: "紛失",
  DAMAGE: "毀損",
  UNAUTHORIZED_ACCESS: "不正アクセス",
  MISDIRECTION: "誤送信",
  THEFT: "盗難",
  OTHER: "その他",
};

// ───────────────────────────────────────────────────
// ヘルパー
// ───────────────────────────────────────────────────

function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const now = new Date();
  const target = new Date(deadline);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function DeadlineBar({ label, deadline, reportedAt }: { label: string; deadline: string | null; reportedAt: string | null }) {
  if (!deadline) return null;
  const days = daysUntil(deadline);
  const isComplete = !!reportedAt;

  if (isComplete) {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-green-700">{label} 完了</span>
      </div>
    );
  }

  const isOverdue = days !== null && days < 0;
  const isUrgent = days !== null && days <= 3;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${isOverdue ? "bg-red-500" : isUrgent ? "bg-orange-500" : "bg-blue-500"}`} />
      <span className={isOverdue ? "text-red-700 font-medium" : isUrgent ? "text-orange-700" : "text-slate-600"}>
        {label}: {isOverdue ? `${Math.abs(days!)}日超過` : `残${days}日`}
      </span>
      <span className="text-slate-400">({formatDate(deadline)})</span>
    </div>
  );
}

// ───────────────────────────────────────────────────
// モーダル
// ───────────────────────────────────────────────────

function ReportModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: Record<string, unknown>) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("LEAKAGE");
  const [incidentDate, setIncidentDate] = useState("");
  const [discoveredDate, setDiscoveredDate] = useState("");
  const [containsMyNumber, setContainsMyNumber] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({
      title,
      description,
      category,
      incidentDate: incidentDate ? new Date(incidentDate).toISOString() : null,
      discoveredDate: discoveredDate ? new Date(discoveredDate).toISOString() : null,
      containsMyNumber,
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">インシデント報告</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">タイトル *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="インシデントの概要を入力"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">説明 *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="詳細な状況を記述"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">カテゴリ</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">発生日</label>
                <input
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">発見日</label>
                <input
                  type="date"
                  value={discoveredDate}
                  onChange={(e) => setDiscoveredDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={containsMyNumber}
                    onChange={(e) => setContainsMyNumber(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  マイナンバーを含む
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                キャンセル
              </button>
              <button
                type="submit"
                disabled={submitting || !title || !description}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "報告中..." : "報告する"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────
// メインクライアントコンポーネント
// ───────────────────────────────────────────────────

export default function IncidentsClient({ initialIncidents }: IncidentsClientProps) {
  const [incidents, setIncidents] = useState<IncidentCase[]>(initialIncidents);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [showModal, setShowModal] = useState(false);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/incidents?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setIncidents(Array.isArray(data) ? data : data.items ?? []);
    }
    setLoading(false);
  }, [statusFilter]);

  // statusFilterが変わった時だけfetchする（初回はinitialIncidentsを使う）
  useEffect(() => {
    if (statusFilter !== "") {
      fetchIncidents();
    }
  }, [statusFilter, fetchIncidents]);

  const handleReport = async (data: Record<string, unknown>) => {
    const res = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setShowModal(false);
      fetchIncidents();
    }
  };

  // サマリー計算
  const total = incidents.length;
  const activeCount = incidents.filter((i) => i.status !== "CLOSED").length;
  const closedCount = incidents.filter((i) => i.status === "CLOSED").length;
  const urgentCount = incidents.filter((i) => {
    if (i.status === "CLOSED") return false;
    const speedDays = daysUntil(i.speedReportDeadline);
    const fullDays = daysUntil(i.fullReportDeadline);
    return (speedDays !== null && speedDays <= 3 && !i.speedReportedAt) ||
      (fullDays !== null && fullDays <= 3 && !i.fullReportedAt);
  }).length;

  return (
    <div>
      <PageHeader
        title="インシデント対応"
        description="個人情報に関するインシデントの報告・対応・再発防止策を管理します。"
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            + インシデント報告
          </button>
        }
      />

      {/* サマリーカード */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">総件数</div>
          <div className="text-2xl font-bold text-slate-900">{total}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">対応中</div>
          <div className="text-2xl font-bold text-blue-600">{activeCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">クローズ済み</div>
          <div className="text-2xl font-bold text-green-600">{closedCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4">
          <div className="text-xs text-red-500 mb-1">期限間近</div>
          <div className="text-2xl font-bold text-red-600">{urgentCount}</div>
        </div>
      </div>

      {/* ステータスフィルタ */}
      <div className="flex gap-2 mb-4">
        {[
          { value: "" as StatusFilter, label: "すべて" },
          { value: "REPORTED" as StatusFilter, label: "報告済" },
          { value: "ASSESSING" as StatusFilter, label: "評価中" },
          { value: "RESPONDING" as StatusFilter, label: "対応中" },
          { value: "CORRECTING" as StatusFilter, label: "是正中" },
          { value: "CLOSED" as StatusFilter, label: "クローズ" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              statusFilter === opt.value
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* インシデント一覧 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <div className="col-span-2">インシデント内容</div>
          <div>発生日</div>
          <div>深刻度</div>
          <div>対応期限</div>
          <div>ステータス</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-sm text-slate-400">読み込み中...</div>
          </div>
        ) : incidents.length === 0 ? (
          <EmptyState
            icon="🚨"
            title="インシデントがありません"
            description="個人情報に関するインシデントが発生した場合、速やかに報告・対応を行います。"
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {incidents.map((incident) => {
              const sev = SEVERITY_CONFIG[incident.severity] ?? SEVERITY_CONFIG.UNASSESSED;
              return (
                <div key={incident.id} className="grid grid-cols-6 gap-4 px-4 py-3 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-slate-900 truncate">{incident.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {CATEGORY_LABELS[incident.category] ?? incident.category}
                      {incident.reportedBy && ` / ${incident.reportedBy.name}`}
                    </div>
                  </div>
                  <div className="text-sm text-slate-600">{formatDate(incident.incidentDate)}</div>
                  <div>
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${sev.bg} ${sev.text} ${sev.border}`}>
                      {sev.label}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {incident.requiresSpeedReport && (
                      <DeadlineBar label="速報" deadline={incident.speedReportDeadline} reportedAt={incident.speedReportedAt} />
                    )}
                    {incident.requiresFullReport && (
                      <DeadlineBar label="確報" deadline={incident.fullReportDeadline} reportedAt={incident.fullReportedAt} />
                    )}
                    {!incident.requiresSpeedReport && !incident.requiresFullReport && (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </div>
                  <div>
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      incident.status === "CLOSED"
                        ? "bg-slate-100 text-slate-600"
                        : "bg-blue-50 text-blue-700 border border-blue-200"
                    }`}>
                      {STATUS_LABELS[incident.status] ?? incident.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* モーダル */}
      {showModal && <ReportModal onClose={() => setShowModal(false)} onSubmit={handleReport} />}
    </div>
  );
}
