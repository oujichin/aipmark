"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

// ─── Types ───────────────────────────────────────────────────────────

interface ControlMeasure {
  id: string;
  category: string;
  description: string;
  responsible: string | null;
  status: string;
  createdAt: string;
}

interface ResidualRisk {
  id: string;
  likelihood: number;
  impact: number;
  riskValue: number;
  accepted: boolean;
  justification: string | null;
  acceptedAt: string | null;
}

interface RiskItem {
  id: string;
  lifecycleStage: string;
  description: string;
  threatSource: string | null;
  vulnerability: string | null;
  likelihood: number;
  impact: number;
  riskValue: number;
  status: string;
  measures: ControlMeasure[];
  residualRisk: ResidualRisk | null;
  businessProcess: { id: string; name: string } | null;
  registerItem: { id: string } | null;
}

interface BusinessProcessOption {
  id: string;
  name: string;
}

interface RiskAssessmentDetail {
  id: string;
  title: string;
  fiscalYear: number;
  description: string | null;
  targetScope: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  assessedBy: { id: string; name: string } | null;
  approvedBy: { id: string; name: string } | null;
  approvedAt: string | null;
  items: RiskItem[];
}

// ─── Constants ───────────────────────────────────────────────────────

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

const LIFECYCLE_OPTIONS = Object.entries(LIFECYCLE_LABELS).map(([value, label]) => ({ value, label }));

const ITEM_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  IDENTIFIED: { label: "識別済", color: "bg-slate-100 text-slate-600" },
  ANALYZED: { label: "分析済", color: "bg-blue-100 text-blue-700" },
  TREATED: { label: "対応済", color: "bg-green-100 text-green-700" },
};

const MEASURE_CATEGORY_LABELS: Record<string, string> = {
  ORGANIZATIONAL: "組織的",
  HUMAN: "人的",
  PHYSICAL: "物理的",
  TECHNICAL: "技術的",
};

const MEASURE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PLANNED: { label: "計画", color: "bg-slate-100 text-slate-600" },
  IMPLEMENTED: { label: "実施済", color: "bg-blue-100 text-blue-700" },
  VERIFIED: { label: "検証済", color: "bg-green-100 text-green-700" },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: ["APPROVED"],
  APPROVED: [],
};

// ─── Shared Components ───────────────────────────────────────────────

function StatusBadge({ status, labels }: { status: string; labels?: Record<string, { label: string; color: string }> }) {
  const map = labels ?? STATUS_LABELS;
  const st = map[status] ?? { label: status, color: "bg-slate-100 text-slate-500" };
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

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    orange: "bg-orange-50 border-orange-200 text-orange-800",
    red: "bg-red-50 border-red-200 text-red-800",
    green: "bg-green-50 border-green-200 text-green-800",
    purple: "bg-purple-50 border-purple-200 text-purple-800",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${colorMap[color] ?? colorMap.blue}`}>
      <div className="text-xs font-medium opacity-70 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

// ─── Heatmap ─────────────────────────────────────────────────────────

function HeatmapCell({ likelihood, impact, items }: { likelihood: number; impact: number; items: RiskItem[] }) {
  const count = items.filter((i) => i.likelihood === likelihood && i.impact === impact).length;
  const rv = likelihood * impact;
  let bg = "bg-green-50";
  if (rv >= 6) bg = "bg-red-100";
  else if (rv >= 3) bg = "bg-amber-50";
  return (
    <div className={`${bg} border border-slate-200 rounded-lg p-3 text-center min-h-[60px] flex flex-col items-center justify-center`}>
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
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">リスクヒートマップ</h3>
      <div className="flex gap-4">
        <div className="flex flex-col items-center justify-between py-1 mr-1">
          <span className="text-xs text-slate-400">発生可能性</span>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-4 gap-1">
            <div />
            <div className="text-center text-xs text-slate-500 font-medium pb-1">影響度 1</div>
            <div className="text-center text-xs text-slate-500 font-medium pb-1">影響度 2</div>
            <div className="text-center text-xs text-slate-500 font-medium pb-1">影響度 3</div>
            {[3, 2, 1].map((lk) => (
              <div key={`row-${lk}`} className="contents">
                <div className="flex items-center justify-end pr-2 text-xs text-slate-500 font-medium">{lk}</div>
                {[1, 2, 3].map((imp) => (
                  <HeatmapCell key={`${lk}-${imp}`} likelihood={lk} impact={imp} items={items} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Wrapper ───────────────────────────────────────────────────

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Edit Assessment Modal ───────────────────────────────────────────

function EditAssessmentModal({
  open,
  onClose,
  assessment,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  assessment: RiskAssessmentDetail;
  onUpdated: () => void;
}) {
  const [title, setTitle] = useState(assessment.title);
  const [fiscalYear, setFiscalYear] = useState(assessment.fiscalYear);
  const [description, setDescription] = useState(assessment.description ?? "");
  const [targetScope, setTargetScope] = useState(assessment.targetScope ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/risk/assessments/${assessment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, fiscalYear, description: description || null, targetScope: targetScope || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "更新に失敗しました");
        return;
      }
      onUpdated();
      onClose();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="リスク評価を編集">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">タイトル <span className="text-red-500">*</span></label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">対象年度 <span className="text-red-500">*</span></label>
          <input type="number" value={fiscalYear} onChange={(e) => setFiscalYear(parseInt(e.target.value, 10))} required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">説明</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">対象範囲</label>
          <input type="text" value={targetScope} onChange={(e) => setTargetScope(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
          <button type="submit" disabled={submitting || !title}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {submitting ? "更新中..." : "更新"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Add Risk Item Modal ─────────────────────────────────────────────

function AddRiskItemModal({
  open,
  onClose,
  assessmentId,
  businessProcesses,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  assessmentId: string;
  businessProcesses: BusinessProcessOption[];
  onCreated: () => void;
}) {
  const [lifecycleStage, setLifecycleStage] = useState("ACQUISITION");
  const [description, setDescription] = useState("");
  const [threatSource, setThreatSource] = useState("");
  const [vulnerability, setVulnerability] = useState("");
  const [likelihood, setLikelihood] = useState(1);
  const [impact, setImpact] = useState(1);
  const [businessProcessId, setBusinessProcessId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/risk/assessments/${assessmentId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lifecycleStage,
          description,
          threatSource: threatSource || undefined,
          vulnerability: vulnerability || undefined,
          likelihood,
          impact,
          businessProcessId: businessProcessId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "作成に失敗しました");
        return;
      }
      setDescription("");
      setThreatSource("");
      setVulnerability("");
      setLikelihood(1);
      setImpact(1);
      setBusinessProcessId("");
      onCreated();
      onClose();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="リスクアイテム追加">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">ライフサイクル段階 <span className="text-red-500">*</span></label>
          <select value={lifecycleStage} onChange={(e) => setLifecycleStage(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {LIFECYCLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">業務プロセス</label>
          <select value={businessProcessId} onChange={(e) => setBusinessProcessId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">-- 選択しない --</option>
            {businessProcesses.map((bp) => <option key={bp.id} value={bp.id}>{bp.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">リスク内容 <span className="text-red-500">*</span></label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: メール誤送信による個人情報漏えい" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">脅威源</label>
          <input type="text" value={threatSource} onChange={(e) => setThreatSource(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 従業者の操作ミス" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">脆弱性</label>
          <input type="text" value={vulnerability} onChange={(e) => setVulnerability(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 送信先確認手順の不備" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">発生可能性 (1-3)</label>
            <select value={likelihood} onChange={(e) => setLikelihood(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value={1}>1 - 低</option>
              <option value={2}>2 - 中</option>
              <option value={3}>3 - 高</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">影響度 (1-3)</label>
            <select value={impact} onChange={(e) => setImpact(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value={1}>1 - 低</option>
              <option value={2}>2 - 中</option>
              <option value={3}>3 - 高</option>
            </select>
          </div>
        </div>
        <div className="text-sm text-slate-500">
          リスク値: <RiskLevelBadge value={likelihood * impact} />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
          <button type="submit" disabled={submitting || !description}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {submitting ? "追加中..." : "追加"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Risk Item Modal ────────────────────────────────────────────

function EditRiskItemModal({
  open,
  onClose,
  item,
  businessProcesses,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  item: RiskItem;
  businessProcesses: BusinessProcessOption[];
  onUpdated: () => void;
}) {
  const [lifecycleStage, setLifecycleStage] = useState(item.lifecycleStage);
  const [description, setDescription] = useState(item.description);
  const [threatSource, setThreatSource] = useState(item.threatSource ?? "");
  const [vulnerability, setVulnerability] = useState(item.vulnerability ?? "");
  const [likelihood, setLikelihood] = useState(item.likelihood);
  const [impact, setImpact] = useState(item.impact);
  const [status, setStatus] = useState(item.status);
  const [businessProcessId, setBusinessProcessId] = useState(item.businessProcess?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/risk/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lifecycleStage,
          description,
          threatSource: threatSource || null,
          vulnerability: vulnerability || null,
          likelihood,
          impact,
          status,
          businessProcessId: businessProcessId || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "更新に失敗しました");
        return;
      }
      onUpdated();
      onClose();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="リスクアイテム編集">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">ライフサイクル段階</label>
          <select value={lifecycleStage} onChange={(e) => setLifecycleStage(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {LIFECYCLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">リスク内容 <span className="text-red-500">*</span></label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">脅威源</label>
          <input type="text" value={threatSource} onChange={(e) => setThreatSource(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">脆弱性</label>
          <input type="text" value={vulnerability} onChange={(e) => setVulnerability(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">発生可能性</label>
            <select value={likelihood} onChange={(e) => setLikelihood(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value={1}>1 - 低</option>
              <option value={2}>2 - 中</option>
              <option value={3}>3 - 高</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">影響度</label>
            <select value={impact} onChange={(e) => setImpact(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value={1}>1 - 低</option>
              <option value={2}>2 - 中</option>
              <option value={3}>3 - 高</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">業務プロセス</label>
          <select value={businessProcessId} onChange={(e) => setBusinessProcessId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">-- 選択しない --</option>
            {businessProcesses.map((bp) => <option key={bp.id} value={bp.id}>{bp.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">対応状況</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="IDENTIFIED">識別済</option>
            <option value="ANALYZED">分析済</option>
            <option value="TREATED">対応済</option>
          </select>
        </div>
        <div className="text-sm text-slate-500">
          リスク値: <RiskLevelBadge value={likelihood * impact} />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
          <button type="submit" disabled={submitting || !description}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {submitting ? "更新中..." : "更新"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Add Measure Modal ───────────────────────────────────────────────

function AddMeasureModal({
  open,
  onClose,
  riskItemId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  riskItemId: string;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState("ORGANIZATIONAL");
  const [description, setDescription] = useState("");
  const [responsible, setResponsible] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/risk/items/${riskItemId}/measures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, description, responsible: responsible || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "作成に失敗しました");
        return;
      }
      setDescription("");
      setResponsible("");
      onCreated();
      onClose();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="管理策を追加">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">区分 <span className="text-red-500">*</span></label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {Object.entries(MEASURE_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">管理策の内容 <span className="text-red-500">*</span></label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: メール送信時のダブルチェック体制を導入" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">責任者</label>
          <input type="text" value={responsible} onChange={(e) => setResponsible(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 情報システム部長" />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
          <button type="submit" disabled={submitting || !description}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {submitting ? "追加中..." : "追加"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Measure Modal ──────────────────────────────────────────────

function EditMeasureModal({
  open,
  onClose,
  measure,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  measure: ControlMeasure;
  onUpdated: () => void;
}) {
  const [category, setCategory] = useState(measure.category);
  const [description, setDescription] = useState(measure.description);
  const [responsible, setResponsible] = useState(measure.responsible ?? "");
  const [status, setStatus] = useState(measure.status);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/risk/measures/${measure.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description,
          responsible: responsible || null,
          status,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "更新に失敗しました");
        return;
      }
      onUpdated();
      onClose();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="管理策を編集">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">区分 <span className="text-red-500">*</span></label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {Object.entries(MEASURE_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">管理策の内容 <span className="text-red-500">*</span></label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">責任者</label>
          <input type="text" value={responsible} onChange={(e) => setResponsible(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">実施状況</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="PLANNED">計画</option>
            <option value="IMPLEMENTED">実施済</option>
            <option value="VERIFIED">検証済</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
          <button type="submit" disabled={submitting || !description}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {submitting ? "更新中..." : "更新"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Residual Risk Modal ─────────────────────────────────────────────

function ResidualRiskModal({
  open,
  onClose,
  riskItemId,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  riskItemId: string;
  existing: ResidualRisk | null;
  onSaved: () => void;
}) {
  const [likelihood, setLikelihood] = useState(existing?.likelihood ?? 1);
  const [impact, setImpact] = useState(existing?.impact ?? 1);
  const [accepted, setAccepted] = useState(existing?.accepted ?? false);
  const [justification, setJustification] = useState(existing?.justification ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isUpdate = existing !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/risk/items/${riskItemId}/residual`, {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ likelihood, impact, accepted, justification: justification || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "保存に失敗しました");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isUpdate ? "残留リスクを更新" : "残留リスクを設定"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">残留発生可能性</label>
            <select value={likelihood} onChange={(e) => setLikelihood(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value={1}>1 - 低</option>
              <option value={2}>2 - 中</option>
              <option value={3}>3 - 高</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">残留影響度</label>
            <select value={impact} onChange={(e) => setImpact(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value={1}>1 - 低</option>
              <option value={2}>2 - 中</option>
              <option value={3}>3 - 高</option>
            </select>
          </div>
        </div>
        <div className="text-sm text-slate-500">
          残留リスク値: <RiskLevelBadge value={likelihood * impact} />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
              className="rounded border-slate-300" />
            リスクを受容する
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">受容理由・備考</label>
          <textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="リスク受容の根拠を記載" />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
          <button type="submit" disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {submitting ? "保存中..." : "保存"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Risk Item Detail Card ───────────────────────────────────────────

function RiskItemCard({
  item,
  index,
  onEdit,
  onDelete,
  onAddMeasure,
  onEditMeasure,
  onDeleteMeasure,
  onResidualRisk,
}: {
  item: RiskItem;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onAddMeasure: () => void;
  onEditMeasure: (measure: ControlMeasure) => void;
  onDeleteMeasure: (measureId: string) => void;
  onResidualRisk: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-4 px-4 py-3 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs text-slate-400 w-6 text-right">{index + 1}</span>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
          {LIFECYCLE_LABELS[item.lifecycleStage] ?? item.lifecycleStage}
        </span>
        <span className="flex-1 text-sm text-slate-800 truncate">{item.description}</span>
        {item.businessProcess && (
          <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-600">
            {item.businessProcess.name}
          </span>
        )}
        <RiskLevelBadge value={item.riskValue} />
        <StatusBadge status={item.status} labels={ITEM_STATUS_LABELS} />
        <span className="text-xs text-slate-400">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 space-y-4">
          {/* Info grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-xs text-slate-500 block">脅威源</span>
              <span className="text-slate-700">{item.threatSource || "-"}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">脆弱性</span>
              <span className="text-slate-700">{item.vulnerability || "-"}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">発生可能性</span>
              <span className="text-slate-700">{item.likelihood}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">影響度</span>
              <span className="text-slate-700">{item.impact}</span>
            </div>
          </div>

          {/* Business Process */}
          {item.businessProcess && (
            <div className="text-sm">
              <span className="text-xs text-slate-500 block">紐付け業務プロセス</span>
              <span className="text-slate-700">{item.businessProcess.name}</span>
            </div>
          )}

          {/* Control Measures */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-600">管理策 ({item.measures.length})</h4>
              <button onClick={onAddMeasure}
                className="text-xs text-blue-600 hover:text-blue-700 hover:underline">
                + 管理策を追加
              </button>
            </div>
            {item.measures.length > 0 ? (
              <div className="space-y-1">
                {item.measures.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-100">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                      {MEASURE_CATEGORY_LABELS[m.category] ?? m.category}
                    </span>
                    <span className="text-sm text-slate-700 flex-1">{m.description}</span>
                    {m.responsible && <span className="text-xs text-slate-400 shrink-0">{m.responsible}</span>}
                    <StatusBadge status={m.status} labels={MEASURE_STATUS_LABELS} />
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditMeasure(m); }}
                      className="text-xs text-blue-500 hover:text-blue-700 shrink-0"
                      title="管理策を編集"
                    >
                      編集
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteMeasure(m.id); }}
                      className="text-xs text-red-500 hover:text-red-700 shrink-0"
                      title="管理策を削除"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">管理策が未登録です</p>
            )}
          </div>

          {/* Residual Risk */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-600">残留リスク</h4>
              <button onClick={onResidualRisk}
                className="text-xs text-blue-600 hover:text-blue-700 hover:underline">
                {item.residualRisk ? "残留リスクを編集" : "残留リスクを設定"}
              </button>
            </div>
            {item.residualRisk ? (
              <div className="bg-white rounded-lg px-3 py-2 border border-slate-100 flex items-center gap-4 text-sm">
                <span className="text-slate-500 text-xs">発生可能性: {item.residualRisk.likelihood}</span>
                <span className="text-slate-500 text-xs">影響度: {item.residualRisk.impact}</span>
                <span className="text-slate-500 text-xs">残留リスク値:</span>
                <RiskLevelBadge value={item.residualRisk.riskValue} />
                {item.residualRisk.accepted ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">受容済</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">未受容</span>
                )}
                {item.residualRisk.justification && (
                  <span className="text-xs text-slate-400 truncate flex-1">{item.residualRisk.justification}</span>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">残留リスクが未設定です</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button onClick={onEdit}
              className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200">
              編集
            </button>
            <button onClick={onDelete}
              className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200">
              削除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export default function RiskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [assessment, setAssessment] = useState<RiskAssessmentDetail | null>(null);
  const [businessProcesses, setBusinessProcesses] = useState<BusinessProcessOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RiskItem | null>(null);
  const [addMeasureItemId, setAddMeasureItemId] = useState<string | null>(null);
  const [editingMeasure, setEditingMeasure] = useState<ControlMeasure | null>(null);
  const [deleteMeasureConfirm, setDeleteMeasureConfirm] = useState<string | null>(null);
  const [residualRiskItem, setResidualRiskItem] = useState<RiskItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchAssessment = useCallback(async () => {
    try {
      const res = await fetch(`/api/risk/assessments/${id}`);
      if (res.status === 404) {
        setError("リスク評価が見つかりません");
        return;
      }
      if (!res.ok) {
        setError("データの取得に失敗しました");
        return;
      }
      const data = await res.json();
      setAssessment(data);
      setError("");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  useEffect(() => {
    fetch("/api/register/processes")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Array<{ id: string; name: string }>) =>
        setBusinessProcesses(data.map((bp) => ({ id: bp.id, name: bp.name })))
      )
      .catch(() => setBusinessProcesses([]));
  }, []);

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/risk/assessments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchAssessment();
    } catch {
      // silently fail
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/risk/items/${itemId}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchAssessment();
      }
    } catch {
      // silently fail
    }
  };

  const handleDeleteMeasure = async (measureId: string) => {
    try {
      const res = await fetch(`/api/risk/measures/${measureId}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteMeasureConfirm(null);
        fetchAssessment();
      }
    } catch {
      // silently fail
    }
  };

  const handleDeleteAssessment = async () => {
    if (!confirm("このリスク評価を削除しますか？関連するリスクアイテム・管理策・残留リスクもすべて削除されます。")) return;
    try {
      const res = await fetch(`/api/risk/assessments/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/risk");
    } catch {
      // silently fail
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-slate-400 text-sm">読み込み中...</div>;
  }

  if (error || !assessment) {
    return (
      <div>
        <PageHeader title="リスク評価詳細" />
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-500 mb-4">{error || "リスク評価が見つかりません"}</p>
          <Link href="/risk" className="text-sm text-blue-600 hover:underline">リスク管理一覧に戻る</Link>
        </div>
      </div>
    );
  }

  const nextStatuses = STATUS_TRANSITIONS[assessment.status] ?? [];
  const totalItems = assessment.items.length;
  const highRiskItems = assessment.items.filter((i) => i.riskValue >= 6).length;
  const treatedItems = assessment.items.filter((i) => i.status === "TREATED").length;
  const acceptedResidualCount = assessment.items.filter((i) => i.residualRisk?.accepted).length;

  return (
    <div>
      <PageHeader
        title={assessment.title}
        description={`${assessment.fiscalYear}年度 リスク評価`}
        badge={STATUS_LABELS[assessment.status]?.label ?? assessment.status}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/risk" className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              一覧に戻る
            </Link>
            <button onClick={() => setEditModalOpen(true)}
              className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200">
              編集
            </button>
            {nextStatuses.map((ns) => (
              <button key={ns} onClick={() => handleStatusChange(ns)}
                className="px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                {STATUS_LABELS[ns]?.label ?? ns}にする
              </button>
            ))}
            <button onClick={handleDeleteAssessment}
              className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200">
              削除
            </button>
          </div>
        }
      />

      {/* Assessment info */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-xs text-slate-500 block mb-0.5">対象範囲</span>
            <span className="text-slate-800">{assessment.targetScope || "-"}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block mb-0.5">評価者</span>
            <span className="text-slate-800">{assessment.assessedBy?.name ?? "-"}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block mb-0.5">承認者</span>
            <span className="text-slate-800">
              {assessment.approvedBy?.name ?? "-"}
              {assessment.approvedAt && (
                <span className="text-xs text-slate-400 ml-1">
                  ({new Date(assessment.approvedAt).toLocaleDateString("ja-JP")})
                </span>
              )}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block mb-0.5">最終更新</span>
            <span className="text-slate-800">{new Date(assessment.updatedAt).toLocaleDateString("ja-JP")}</span>
          </div>
        </div>
        {assessment.description && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500 block mb-0.5">説明</span>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{assessment.description}</p>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard label="リスクアイテム数" value={totalItems} color="blue" />
        <SummaryCard label="高リスク (6以上)" value={highRiskItems} color="red" />
        <SummaryCard label="対応済" value={treatedItems} color="green" />
        <SummaryCard label="残留リスク受容済" value={acceptedResidualCount} color="purple" />
      </div>

      {/* Heatmap */}
      {totalItems > 0 && (
        <div className="mb-6">
          <Heatmap items={assessment.items} />
        </div>
      )}

      {/* Risk Items */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">リスクアイテム一覧</h2>
          <button onClick={() => setAddItemModalOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            + リスクアイテム追加
          </button>
        </div>

        {totalItems === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200">
            <EmptyState icon="📋" title="リスクアイテムがありません" description="「+ リスクアイテム追加」から追加してください。" />
          </div>
        ) : (
          <div className="space-y-2">
            {assessment.items.map((item, i) => (
              <RiskItemCard
                key={item.id}
                item={item}
                index={i}
                onEdit={() => setEditingItem(item)}
                onDelete={() => setDeleteConfirm(item.id)}
                onAddMeasure={() => setAddMeasureItemId(item.id)}
                onEditMeasure={(measure) => setEditingMeasure(measure)}
                onDeleteMeasure={(measureId) => setDeleteMeasureConfirm(measureId)}
                onResidualRisk={() => setResidualRiskItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {editModalOpen && assessment && (
        <EditAssessmentModal open onClose={() => setEditModalOpen(false)} assessment={assessment} onUpdated={fetchAssessment} />
      )}
      {addItemModalOpen && (
        <AddRiskItemModal open onClose={() => setAddItemModalOpen(false)} assessmentId={id} businessProcesses={businessProcesses} onCreated={fetchAssessment} />
      )}
      {editingItem && (
        <EditRiskItemModal open onClose={() => setEditingItem(null)} item={editingItem} businessProcesses={businessProcesses} onUpdated={fetchAssessment} />
      )}
      {addMeasureItemId && (
        <AddMeasureModal open onClose={() => setAddMeasureItemId(null)} riskItemId={addMeasureItemId} onCreated={fetchAssessment} />
      )}
      {editingMeasure && (
        <EditMeasureModal open onClose={() => setEditingMeasure(null)} measure={editingMeasure} onUpdated={fetchAssessment} />
      )}
      {residualRiskItem && (
        <ResidualRiskModal
          open
          onClose={() => setResidualRiskItem(null)}
          riskItemId={residualRiskItem.id}
          existing={residualRiskItem.residualRisk}
          onSaved={fetchAssessment}
        />
      )}

      {/* Delete measure confirmation */}
      {deleteMeasureConfirm && (
        <Modal open onClose={() => setDeleteMeasureConfirm(null)} title="管理策の削除">
          <p className="text-sm text-slate-600 mb-4">この管理策を削除しますか？</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteMeasureConfirm(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
            <button onClick={() => handleDeleteMeasure(deleteMeasureConfirm)}
              className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">削除する</button>
          </div>
        </Modal>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <Modal open onClose={() => setDeleteConfirm(null)} title="リスクアイテムの削除">
          <p className="text-sm text-slate-600 mb-4">このリスクアイテムを削除しますか？関連する管理策・残留リスクも削除されます。</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
            <button onClick={() => handleDeleteItem(deleteConfirm)}
              className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">削除する</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
