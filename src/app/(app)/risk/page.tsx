"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

interface RiskAssessment {
  id: string;
  title: string;
  fiscalYear: number;
  description: string | null;
  targetScope: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  assessedBy: { id: string; name: string } | null;
  _count: { items: number };
}

interface RiskItem {
  id: string;
  likelihood: number;
  impact: number;
  riskValue: number;
  description: string;
  lifecycleStage: string;
  status: string;
}

interface AssessmentDetail extends RiskAssessment {
  items: RiskItem[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "下書き", color: "bg-slate-100 text-slate-600" },
  IN_PROGRESS: { label: "実施中", color: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "完了", color: "bg-green-100 text-green-700" },
  APPROVED: { label: "承認済", color: "bg-purple-100 text-purple-700" },
};

const LIFECYCLE_LABELS: Record<string, string> = {
  ACQUISITION: "取得",
  USE: "利用",
  STORAGE: "保管",
  PROVISION: "提供",
  ENTRUSTMENT: "委託",
  DISPOSAL: "廃棄",
};

function StatusBadge({ status }: { status: string }) {
  const st = STATUS_LABELS[status] ?? { label: status, color: "bg-slate-100 text-slate-500" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>
      {st.label}
    </span>
  );
}

function RiskLevelBadge({ value }: { value: number }) {
  let color = "bg-green-100 text-green-700";
  if (value >= 6) color = "bg-red-100 text-red-700";
  else if (value >= 3) color = "bg-amber-100 text-amber-700";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {value}
    </span>
  );
}

function HeatmapCell({
  likelihood,
  impact,
  items,
}: {
  likelihood: number;
  impact: number;
  items: RiskItem[];
}) {
  const count = items.filter(
    (item) => item.likelihood === likelihood && item.impact === impact
  ).length;
  const riskValue = likelihood * impact;

  let bg = "bg-green-50";
  if (riskValue >= 6) bg = "bg-red-100";
  else if (riskValue >= 3) bg = "bg-amber-50";

  return (
    <div
      className={`${bg} border border-slate-200 rounded-lg p-3 text-center min-h-[60px] flex flex-col items-center justify-center`}
    >
      {count > 0 ? (
        <>
          <div className="text-lg font-bold text-slate-800">{count}</div>
          <div className="text-xs text-slate-500">件</div>
        </>
      ) : (
        <div className="text-xs text-slate-300">-</div>
      )}
    </div>
  );
}

function Heatmap({ items }: { items: RiskItem[] }) {
  const levels = [3, 2, 1];
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        リスクヒートマップ（発生可能性 x 影響度）
      </h3>
      <div className="flex gap-4">
        <div className="flex flex-col items-center justify-between py-1 mr-1">
          <span className="text-xs text-slate-400 writing-mode-vertical">発生可能性</span>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-4 gap-1">
            {/* Header row */}
            <div />
            <div className="text-center text-xs text-slate-500 font-medium pb-1">影響度 1</div>
            <div className="text-center text-xs text-slate-500 font-medium pb-1">影響度 2</div>
            <div className="text-center text-xs text-slate-500 font-medium pb-1">影響度 3</div>
            {/* Data rows */}
            {levels.map((likelihood) => (
              <>
                <div
                  key={`label-${likelihood}`}
                  className="flex items-center justify-end pr-2 text-xs text-slate-500 font-medium"
                >
                  {likelihood}
                </div>
                {[1, 2, 3].map((impact) => (
                  <HeatmapCell
                    key={`${likelihood}-${impact}`}
                    likelihood={likelihood}
                    impact={impact}
                    items={items}
                  />
                ))}
              </>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [description, setDescription] = useState("");
  const [targetScope, setTargetScope] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/risk/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          fiscalYear,
          description: description || null,
          targetScope: targetScope || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "作成に失敗しました");
        return;
      }

      setTitle("");
      setDescription("");
      setTargetScope("");
      onCreated();
      onClose();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">新規リスク評価作成</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 2025年度 年次リスク評価"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              対象年度 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">説明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="リスク評価の概要・目的"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">対象範囲</label>
            <input
              type="text"
              value={targetScope}
              onChange={(e) => setTargetScope(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 全社 / 営業部門のみ"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting || !title}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "作成中..." : "作成"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RiskPage() {
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchAssessments = useCallback(async () => {
    try {
      const res = await fetch("/api/risk/assessments");
      if (res.ok) {
        const data = await res.json();
        setAssessments(Array.isArray(data) ? data : data.items ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const handleSelectAssessment = async (id: string) => {
    try {
      const res = await fetch(`/api/risk/assessments/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedAssessment(data);
      }
    } catch {
      // silently fail
    }
  };

  return (
    <div>
      <PageHeader
        title="リスク管理"
        description="個人情報に関するリスクの識別・評価・対応策を管理します。"
        actions={
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + 新規リスク評価
          </button>
        }
      />

      <CreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={fetchAssessments}
      />

      {/* Heatmap (show if an assessment is selected and has items) */}
      {selectedAssessment && selectedAssessment.items.length > 0 && (
        <Heatmap items={selectedAssessment.items} />
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">読み込み中...</div>
      ) : assessments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <EmptyState
            icon="🛡"
            title="リスク評価がありません"
            description="「+ 新規リスク評価」ボタンからリスク評価を作成してください。"
          />
        </div>
      ) : (
        <>
          {/* Assessment list */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">タイトル</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">年度</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">リスク件数</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">評価者</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">ステータス</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">更新日</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <tr
                    key={a.id}
                    className={`border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${
                      selectedAssessment?.id === a.id ? "bg-blue-50" : ""
                    }`}
                    onClick={() => handleSelectAssessment(a.id)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{a.title}</td>
                    <td className="px-4 py-3 text-slate-600">{a.fiscalYear}</td>
                    <td className="px-4 py-3 text-slate-600">{a._count.items} 件</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{a.assessedBy?.name ?? "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(a.updatedAt).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/risk/${a.id}`}
                        className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Selected assessment detail: risk items */}
          {selectedAssessment && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-700">
                  {selectedAssessment.title} - リスクアイテム一覧
                </h3>
              </div>
              {selectedAssessment.items.length === 0 ? (
                <EmptyState
                  icon="📋"
                  title="リスクアイテムがありません"
                  description="詳細画面からリスクアイテムを追加してください。"
                />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">No.</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">リスク内容</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">ライフサイクル</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">発生可能性</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">影響度</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">リスク値</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">対応状況</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAssessment.items.map((item, i) => (
                      <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-2 text-slate-800 max-w-xs truncate">{item.description}</td>
                        <td className="px-4 py-2 text-xs text-slate-600">
                          {LIFECYCLE_LABELS[item.lifecycleStage] ?? item.lifecycleStage}
                        </td>
                        <td className="px-4 py-2 text-center">{item.likelihood}</td>
                        <td className="px-4 py-2 text-center">{item.impact}</td>
                        <td className="px-4 py-2 text-center">
                          <RiskLevelBadge value={item.riskValue} />
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge status={item.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
