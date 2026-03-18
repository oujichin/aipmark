"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

// ──────────────────────────────────────
// 型定義
// ──────────────────────────────────────

interface VendorEvaluationSummary {
  id: string;
  fiscalYear: number;
  rating: string | null;
  overallScore: number | null;
  status: string;
}

interface Vendor {
  id: string;
  name: string;
  vendorType: string;
  description: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  hasPmark: boolean;
  pmarkNumber: string | null;
  hasIsms: boolean;
  ismsNumber: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  renewalDate: string | null;
  dataHandled: string | null;
  overallRating: string;
  nextEvaluationDue: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  evaluations: VendorEvaluationSummary[];
  _count: { questionnaires: number; evaluations: number };
}

interface VendorQuestionnaire {
  id: string;
  vendorId: string;
  sentAt: string | null;
  dueDate: string | null;
  respondedAt: string | null;
  questions: string | null;
  answers: string | null;
  status: string;
  createdAt: string;
}

interface VendorEvaluation {
  id: string;
  vendorId: string;
  fiscalYear: number;
  scores: string | null;
  overallScore: number | null;
  rating: string | null;
  findings: string | null;
  status: string;
  evaluatedBy?: { id: string; name: string } | null;
  approvedBy?: { id: string; name: string } | null;
  approvedAt: string | null;
  createdAt: string;
}

interface VendorDetail extends Omit<Vendor, "evaluations"> {
  questionnaires: VendorQuestionnaire[];
  evaluations: VendorEvaluation[];
}

interface FormData {
  name: string;
  vendorType: string;
  description: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  hasPmark: boolean;
  pmarkNumber: string;
  hasIsms: boolean;
  ismsNumber: string;
  contractStartDate: string;
  contractEndDate: string;
  dataHandled: string;
}

export interface VendorsClientProps {
  initialVendors: Vendor[];
}

// ──────────────────────────────────────
// 定数
// ──────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "ACTIVE", label: "有効" },
  { value: "PENDING_REVIEW", label: "レビュー待ち" },
  { value: "SUSPENDED", label: "一時停止" },
  { value: "TERMINATED", label: "終了" },
] as const;

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "有効", cls: "bg-green-100 text-green-700 border-green-200" },
  PENDING_REVIEW: { label: "レビュー待ち", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  SUSPENDED: { label: "一時停止", cls: "bg-red-100 text-red-700 border-red-200" },
  TERMINATED: { label: "終了", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const VENDOR_TYPE_LABEL: Record<string, string> = {
  OUTSOURCE: "業務委託",
  SAAS: "SaaS",
  CLOUD: "クラウド",
  SUBCONTRACT: "再委託",
  OTHER: "その他",
};

const RATING_BADGE: Record<string, { label: string; cls: string }> = {
  A: { label: "A", cls: "bg-green-100 text-green-700" },
  B: { label: "B", cls: "bg-blue-100 text-blue-700" },
  C: { label: "C", cls: "bg-amber-100 text-amber-700" },
  D: { label: "D", cls: "bg-red-100 text-red-700" },
  UNRATED: { label: "未評価", cls: "bg-slate-100 text-slate-500" },
};

const QUESTIONNAIRE_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "下書き", cls: "bg-slate-100 text-slate-600" },
  SENT: { label: "送付済", cls: "bg-blue-100 text-blue-700" },
  RESPONDED: { label: "回答済", cls: "bg-amber-100 text-amber-700" },
  EVALUATED: { label: "評価完了", cls: "bg-green-100 text-green-700" },
};

const EVAL_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "下書き", cls: "bg-slate-100 text-slate-600" },
  COMPLETED: { label: "完了", cls: "bg-blue-100 text-blue-700" },
  APPROVED: { label: "承認済", cls: "bg-green-100 text-green-700" },
};

const INITIAL_FORM: FormData = {
  name: "",
  vendorType: "OUTSOURCE",
  description: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  hasPmark: false,
  pmarkNumber: "",
  hasIsms: false,
  ismsNumber: "",
  contractStartDate: "",
  contractEndDate: "",
  dataHandled: "",
};

// ──────────────────────────────────────
// ヘルパー
// ──────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ja-JP");
}

function isExpiringSoon(dateStr: string | null, daysThreshold = 30): boolean {
  if (!dateStr) return false;
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff > 0 && diff < daysThreshold * 86400000;
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now();
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().split("T")[0];
}

// ──────────────────────────────────────
// 質問票タブ
// ──────────────────────────────────────

function QuestionnaireTab({ vendor, onRefresh }: { vendor: VendorDetail; onRefresh: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [questions, setQuestions] = useState('[\n  { "q": "", "type": "yes_no" }\n]');
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    setSubmitting(true);
    const res = await fetch(`/api/vendors/${vendor.id}/questionnaires`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions, dueDate: dueDate ? new Date(dueDate).toISOString() : undefined }),
    });
    if (res.ok) {
      setShowCreate(false);
      setQuestions('[\n  { "q": "", "type": "yes_no" }\n]');
      setDueDate("");
      onRefresh();
    }
    setSubmitting(false);
  };

  const handleStatusChange = async (qId: string, newStatus: string, answers?: string) => {
    const body: Record<string, string> = { status: newStatus };
    if (answers) body.answers = answers;
    await fetch(`/api/vendors/questionnaires/${qId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    onRefresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-700">質問票一覧</h3>
        <button
          onClick={() => setShowCreate(true)}
          className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + 質問票作成
        </button>
      </div>

      {vendor.questionnaires.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">質問票がありません</p>
      ) : (
        <div className="space-y-2">
          {vendor.questionnaires.map((q) => {
            const st = QUESTIONNAIRE_STATUS[q.status] ?? QUESTIONNAIRE_STATUS.DRAFT;
            return (
              <div key={q.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                  <span className="text-xs text-slate-400">{formatDate(q.createdAt)}</span>
                </div>
                {q.dueDate && (
                  <div className="text-xs text-slate-500 mb-1">回答期限: {formatDate(q.dueDate)}</div>
                )}
                {q.sentAt && <div className="text-xs text-slate-500">送付日: {formatDate(q.sentAt)}</div>}
                {q.respondedAt && <div className="text-xs text-slate-500">回答日: {formatDate(q.respondedAt)}</div>}

                <div className="flex gap-1 mt-2">
                  {q.status === "DRAFT" && (
                    <button onClick={() => handleStatusChange(q.id, "SENT")} className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">送付</button>
                  )}
                  {q.status === "SENT" && (
                    <button onClick={() => handleStatusChange(q.id, "RESPONDED", '[]')} className="text-xs px-2 py-1 bg-amber-50 text-amber-600 rounded hover:bg-amber-100">回答登録</button>
                  )}
                  {q.status === "RESPONDED" && (
                    <button onClick={() => handleStatusChange(q.id, "EVALUATED")} className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100">評価完了</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">質問票作成</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">質問項目 (JSON)</label>
                <textarea
                  value={questions}
                  onChange={(e) => setQuestions(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono h-32"
                  placeholder='[{"q": "質問文", "type": "yes_no"}]'
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">回答期限</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
              <button onClick={handleCreate} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {submitting ? "作成中..." : "作成"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────
// 評価タブ
// ──────────────────────────────────────

function EvaluationTab({ vendor, onRefresh }: { vendor: VendorDetail; onRefresh: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [evalForm, setEvalForm] = useState({
    fiscalYear: new Date().getFullYear(),
    scores: '{"organizational": 3, "human": 3, "physical": 3, "technical": 3}',
    overallScore: 60,
    rating: "B",
    findings: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    setSubmitting(true);
    const res = await fetch(`/api/vendors/${vendor.id}/evaluations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fiscalYear: evalForm.fiscalYear,
        scores: evalForm.scores,
        overallScore: evalForm.overallScore,
        rating: evalForm.rating,
        findings: evalForm.findings || undefined,
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      onRefresh();
    }
    setSubmitting(false);
  };

  const handleApprove = async (evalId: string) => {
    await fetch(`/api/vendors/evaluations/${evalId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    onRefresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-700">評価履歴</h3>
        <button onClick={() => setShowCreate(true)} className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + 評価登録
        </button>
      </div>

      {vendor.evaluations.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">評価がありません</p>
      ) : (
        <div className="space-y-2">
          {vendor.evaluations.map((ev) => {
            const st = EVAL_STATUS[ev.status] ?? EVAL_STATUS.DRAFT;
            const rb = ev.rating ? (RATING_BADGE[ev.rating] ?? RATING_BADGE.UNRATED) : RATING_BADGE.UNRATED;
            return (
              <div key={ev.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{ev.fiscalYear}年度</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${rb.cls}`}>{rb.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{ev.overallScore ?? "-"}点</span>
                </div>
                {ev.findings && <p className="text-xs text-slate-500 mt-1">{ev.findings}</p>}
                {ev.evaluatedBy && <div className="text-xs text-slate-400 mt-1">評価者: {ev.evaluatedBy.name}</div>}
                {ev.approvedBy && <div className="text-xs text-slate-400">承認者: {ev.approvedBy.name} ({formatDate(ev.approvedAt)})</div>}
                {ev.status !== "APPROVED" && (
                  <button onClick={() => handleApprove(ev.id)} className="text-xs px-2 py-1 mt-2 bg-green-50 text-green-600 rounded hover:bg-green-100">承認</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">委託先評価登録</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">評価年度</label>
                  <input type="number" value={evalForm.fiscalYear} onChange={(e) => setEvalForm({ ...evalForm, fiscalYear: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">格付け</label>
                  <select value={evalForm.rating} onChange={(e) => setEvalForm({ ...evalForm, rating: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">総合点</label>
                <input type="number" value={evalForm.overallScore} onChange={(e) => setEvalForm({ ...evalForm, overallScore: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" min={0} max={100} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">評価スコア (JSON)</label>
                <textarea value={evalForm.scores} onChange={(e) => setEvalForm({ ...evalForm, scores: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono h-20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">所見</label>
                <textarea value={evalForm.findings} onChange={(e) => setEvalForm({ ...evalForm, findings: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={3} placeholder="評価に関する所見を入力" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
              <button onClick={handleCreate} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {submitting ? "登録中..." : "登録"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────
// 委託先詳細パネル
// ──────────────────────────────────────

function VendorDetailPanel({ vendorId, onClose }: { vendorId: string; onClose: () => void }) {
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"info" | "questionnaires" | "evaluations">("info");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<FormData>(INITIAL_FORM);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/vendors/${vendorId}`);
    if (res.ok) {
      const data = await res.json();
      setVendor(data);
    }
    setLoading(false);
  }, [vendorId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const startEdit = () => {
    if (!vendor) return;
    setEditForm({
      name: vendor.name,
      vendorType: vendor.vendorType,
      description: vendor.description ?? "",
      contactName: vendor.contactName ?? "",
      contactEmail: vendor.contactEmail ?? "",
      contactPhone: vendor.contactPhone ?? "",
      hasPmark: vendor.hasPmark,
      pmarkNumber: vendor.pmarkNumber ?? "",
      hasIsms: vendor.hasIsms,
      ismsNumber: vendor.ismsNumber ?? "",
      contractStartDate: toDateInputValue(vendor.contractStartDate),
      contractEndDate: toDateInputValue(vendor.contractEndDate),
      dataHandled: vendor.dataHandled ?? "",
    });
    setEditing(true);
  };

  const handleUpdate = async () => {
    const res = await fetch(`/api/vendors/${vendorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        contractStartDate: editForm.contractStartDate || undefined,
        contractEndDate: editForm.contractEndDate || undefined,
      }),
    });
    if (res.ok) {
      setEditing(false);
      fetchDetail();
    }
  };

  const tabs = [
    { key: "info" as const, label: "基本情報" },
    { key: "questionnaires" as const, label: "質問票" },
    { key: "evaluations" as const, label: "評価" },
  ];

  return (
    <div className="fixed inset-0 bg-black/30 flex items-start justify-end z-50">
      <div className="w-[620px] h-full bg-white shadow-xl overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">{vendor?.name ?? "読み込み中..."}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-sm text-slate-400">読み込み中...</div>
          ) : vendor ? (
            <>
              {/* タブ */}
              <div className="flex gap-1 mb-4 border-b border-slate-200 pb-2">
                {tabs.map((t) => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${activeTab === t.key ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* 再評価期限アラート */}
              {vendor.nextEvaluationDue && (isExpiringSoon(vendor.nextEvaluationDue) || isExpired(vendor.nextEvaluationDue)) && (
                <div className={`mb-4 p-2 rounded-lg text-xs ${isExpired(vendor.nextEvaluationDue) ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                  {isExpired(vendor.nextEvaluationDue) ? "再評価期限を超過しています" : "再評価期限が近づいています"}: {formatDate(vendor.nextEvaluationDue)}
                </div>
              )}

              {/* 基本情報タブ */}
              {activeTab === "info" && !editing && (
                <div className="space-y-3">
                  <button onClick={startEdit} className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 mb-2">編集</button>
                  <InfoRow label="種別" value={VENDOR_TYPE_LABEL[vendor.vendorType] ?? vendor.vendorType} />
                  <InfoRow label="ステータス" value={STATUS_BADGE[vendor.status]?.label ?? vendor.status} />
                  <InfoRow label="委託内容" value={vendor.description} />
                  <InfoRow label="担当者" value={vendor.contactName} />
                  <InfoRow label="Email" value={vendor.contactEmail} />
                  <InfoRow label="電話" value={vendor.contactPhone} />
                  <InfoRow label="Pマーク" value={vendor.hasPmark ? `取得 (${vendor.pmarkNumber ?? ""})` : "なし"} />
                  <InfoRow label="ISMS" value={vendor.hasIsms ? `取得 (${vendor.ismsNumber ?? ""})` : "なし"} />
                  <InfoRow label="契約開始" value={formatDate(vendor.contractStartDate)} />
                  <InfoRow label="契約終了" value={formatDate(vendor.contractEndDate)} />
                  <InfoRow label="取扱データ" value={vendor.dataHandled} />
                </div>
              )}

              {/* 基本情報編集 */}
              {activeTab === "info" && editing && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">委託先名</label>
                    <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">担当者</label>
                      <input type="text" value={editForm.contactName} onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                      <input type="email" value={editForm.contactEmail} onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">契約開始</label>
                      <input type="date" value={editForm.contractStartDate} onChange={(e) => setEditForm({ ...editForm, contractStartDate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">契約終了</label>
                      <input type="date" value={editForm.contractEndDate} onChange={(e) => setEditForm({ ...editForm, contractEndDate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">取扱データ</label>
                    <textarea value={editForm.dataHandled} onChange={(e) => setEditForm({ ...editForm, dataHandled: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={2} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleUpdate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">保存</button>
                    <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
                  </div>
                </div>
              )}

              {/* 質問票タブ */}
              {activeTab === "questionnaires" && <QuestionnaireTab vendor={vendor} onRefresh={fetchDetail} />}

              {/* 評価タブ */}
              {activeTab === "evaluations" && <EvaluationTab vendor={vendor} onRefresh={fetchDetail} />}
            </>
          ) : (
            <p className="text-sm text-red-500">委託先が見つかりません</p>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex">
      <span className="text-xs text-slate-500 w-24 shrink-0">{label}</span>
      <span className="text-sm text-slate-700">{value || "-"}</span>
    </div>
  );
}

// ──────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────

export default function VendorsClient({ initialVendors }: VendorsClientProps) {
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/vendors?${params.toString()}`);
      if (!res.ok) throw new Error("読み込みに失敗しました");
      const raw = await res.json();
      const data: Vendor[] = Array.isArray(raw) ? raw : raw.items ?? [];
      setVendors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (statusFilter !== "") {
      fetchVendors();
    }
  }, [statusFilter, fetchVendors]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setError("委託先名は必須です");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          contractStartDate: form.contractStartDate || undefined,
          contractEndDate: form.contractEndDate || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "登録に失敗しました");
      }
      setShowModal(false);
      setForm(INITIAL_FORM);
      await fetchVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？関連する評価・質問票も削除されます。`)) return;
    try {
      const res = await fetch(`/api/vendors/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除に失敗しました");
      await fetchVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  return (
    <div>
      <PageHeader
        title="委託先管理"
        description="個人情報を取り扱う委託先の評価・管理を行います。"
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + 委託先登録
          </button>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {/* ステータスフィルタ */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-slate-500">ステータス:</span>
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === opt.value
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 契約期限アラート */}
      {vendors.some((v) => isExpiringSoon(v.contractEndDate) || isExpired(v.contractEndDate)) && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <span className="font-medium">契約期限アラート:</span>
          {vendors
            .filter((v) => isExpiringSoon(v.contractEndDate) || isExpired(v.contractEndDate))
            .map((v) => (
              <span key={v.id} className="ml-2">
                {isExpired(v.contractEndDate) ? (
                  <span className="text-red-600 font-medium">{v.name}（期限切れ: {formatDate(v.contractEndDate)}）</span>
                ) : (
                  <span className="text-amber-700">{v.name}（{formatDate(v.contractEndDate)}まで）</span>
                )}
              </span>
            ))}
        </div>
      )}

      {/* 再評価期限アラート */}
      {vendors.some((v) => isExpiringSoon(v.nextEvaluationDue) || isExpired(v.nextEvaluationDue)) && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
          <span className="font-medium">再評価期限アラート:</span>
          {vendors
            .filter((v) => isExpiringSoon(v.nextEvaluationDue) || isExpired(v.nextEvaluationDue))
            .map((v) => (
              <span key={v.id} className="ml-2">
                {isExpired(v.nextEvaluationDue) ? (
                  <span className="text-red-600 font-medium">{v.name}（超過: {formatDate(v.nextEvaluationDue)}）</span>
                ) : (
                  <span className="text-purple-700">{v.name}（{formatDate(v.nextEvaluationDue)}まで）</span>
                )}
              </span>
            ))}
        </div>
      )}

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-7 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <div className="col-span-2">委託先名</div>
          <div>種別</div>
          <div>認証</div>
          <div>評価</div>
          <div>契約期限</div>
          <div>操作</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : vendors.length === 0 ? (
          <EmptyState
            icon="🏢"
            title="委託先が登録されていません"
            description="個人情報の取り扱いを委託している事業者を登録・評価管理します。"
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {vendors.map((vendor) => {
              const statusBadge = STATUS_BADGE[vendor.status] ?? STATUS_BADGE["ACTIVE"];
              const ratingBadge = RATING_BADGE[vendor.overallRating] ?? RATING_BADGE["UNRATED"];
              const latestEval = vendor.evaluations?.[0];

              return (
                <div key={vendor.id}
                  className="grid grid-cols-7 gap-4 px-4 py-3 items-center hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedVendorId(vendor.id)}
                >
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-900">{vendor.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${statusBadge.cls}`}>
                        {statusBadge.label}
                      </span>
                    </div>
                    {vendor.description && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{vendor.description}</p>
                    )}
                  </div>

                  <div className="text-sm text-slate-600">
                    {VENDOR_TYPE_LABEL[vendor.vendorType] ?? vendor.vendorType}
                  </div>

                  <div className="flex flex-col gap-1">
                    {vendor.hasPmark && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium w-fit">Pマーク</span>
                    )}
                    {vendor.hasIsms && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium w-fit">ISMS</span>
                    )}
                    {!vendor.hasPmark && !vendor.hasIsms && (
                      <span className="text-xs text-slate-400">なし</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${ratingBadge.cls}`}>
                      {ratingBadge.label}
                    </span>
                    {latestEval && (
                      <span className="text-xs text-slate-400">{latestEval.fiscalYear}年度</span>
                    )}
                  </div>

                  <div>
                    <span className={`text-sm ${
                      isExpired(vendor.contractEndDate) ? "text-red-600 font-medium"
                        : isExpiringSoon(vendor.contractEndDate) ? "text-amber-600 font-medium"
                        : "text-slate-600"
                    }`}>
                      {formatDate(vendor.contractEndDate)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedVendorId(vendor.id)}
                      className="text-xs px-2 py-1 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      詳細
                    </button>
                    <button
                      onClick={() => handleDelete(vendor.id, vendor.name)}
                      className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 委託先詳細パネル */}
      {selectedVendorId && (
        <VendorDetailPanel vendorId={selectedVendorId} onClose={() => { setSelectedVendorId(null); fetchVendors(); }} />
      )}

      {/* 新規登録モーダル */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">委託先を登録</h2>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">委託先名 <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="例: 株式会社〇〇" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">委託種別</label>
                <select value={form.vendorType} onChange={(e) => setForm({ ...form, vendorType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                  <option value="OUTSOURCE">業務委託</option><option value="SAAS">SaaS</option><option value="CLOUD">クラウド</option><option value="SUBCONTRACT">再委託</option><option value="OTHER">その他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">委託内容</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" rows={2} placeholder="委託する個人情報の取り扱い概要" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">担当者名</label>
                  <input type="text" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">連絡先Email</label>
                  <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="hasPmark" checked={form.hasPmark} onChange={(e) => setForm({ ...form, hasPmark: e.target.checked })} className="rounded border-slate-300" />
                  <label htmlFor="hasPmark" className="text-sm text-slate-700">Pマーク取得</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="hasIsms" checked={form.hasIsms} onChange={(e) => setForm({ ...form, hasIsms: e.target.checked })} className="rounded border-slate-300" />
                  <label htmlFor="hasIsms" className="text-sm text-slate-700">ISMS取得</label>
                </div>
              </div>
              {form.hasPmark && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pマーク番号</label>
                  <input type="text" value={form.pmarkNumber} onChange={(e) => setForm({ ...form, pmarkNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
              )}
              {form.hasIsms && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ISMS番号</label>
                  <input type="text" value={form.ismsNumber} onChange={(e) => setForm({ ...form, ismsNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">契約開始日</label>
                  <input type="date" value={form.contractStartDate} onChange={(e) => setForm({ ...form, contractStartDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">契約終了日</label>
                  <input type="date" value={form.contractEndDate} onChange={(e) => setForm({ ...form, contractEndDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">取り扱い個人情報</label>
                <textarea value={form.dataHandled} onChange={(e) => setForm({ ...form, dataHandled: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" rows={2} placeholder="委託先に提供する個人情報の種類" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); setForm(INITIAL_FORM); setError(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={submitting}
              >
                キャンセル
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? "登録中..." : "登録"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
