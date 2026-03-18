"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────

interface UserRef {
  id: string;
  name: string;
}

interface ChecklistItem {
  id: string;
  category: string | null;
  question: string;
  responseType: string;
  result: string | null;
  evidenceNote: string | null;
  comment: string | null;
  sortOrder: number;
}

interface CorrectiveAction {
  id: string;
  title: string;
  source: string;
  status: string;
  rootCause: string | null;
  actionPlan: string | null;
  dueDate: string | null;
  responsibleId: string | null;
  implementedAt: string | null;
  implementNote: string | null;
  verifiedAt: string | null;
  verifiedById: string | null;
  verifyNote: string | null;
  horizontalDeployment: string | null;
  approvedAt: string | null;
  approvedById: string | null;
}

interface Finding {
  id: string;
  severity: string;
  title: string;
  description: string;
  jisClause: string | null;
  rootCauseTitle: string | null;
  status: string;
  closedAt: string | null;
  createdAt: string;
  correctiveAction: CorrectiveAction | null;
}

interface AuditPlanDetail {
  id: string;
  fiscalYear: number;
  title: string;
  scope: string | null;
  criteria: string | null;
  status: string;
  scheduledDate: string | null;
  completedDate: string | null;
  createdAt: string;
  leadAuditor: UserRef | null;
  targetDepts: { id: string; department: { id: string; name: string } }[];
  auditors: { id: string; user: UserRef }[];
  checklistItems: ChecklistItem[];
  findings: Finding[];
}

// ─── Constants ───────────────────────────────────────────────────────

const PLAN_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "下書き", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  PLANNED: { label: "計画済", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  IN_PROGRESS: { label: "実施中", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  COMPLETED: { label: "完了", cls: "bg-green-100 text-green-700 border-green-200" },
  REPORTED: { label: "報告済", cls: "bg-purple-100 text-purple-700 border-purple-200" },
};

const PLAN_STATUS_ORDER = ["DRAFT", "PLANNED", "IN_PROGRESS", "COMPLETED", "REPORTED"];

const SEVERITY_MAP: Record<string, { label: string; cls: string }> = {
  CRITICAL: { label: "重大", cls: "bg-red-500 text-white" },
  MAJOR: { label: "重要", cls: "bg-orange-500 text-white" },
  MINOR: { label: "軽微", cls: "bg-yellow-400 text-yellow-900" },
  OBSERVATION: { label: "観察事項", cls: "bg-slate-200 text-slate-700" },
};

const FINDING_STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "未対応", cls: "bg-red-100 text-red-700 border-red-200" },
  CORRECTIVE_ACTION: { label: "是正中", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  CLOSED: { label: "完了", cls: "bg-green-100 text-green-700 border-green-200" },
};

const CORRECTIVE_STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "未着手", cls: "bg-red-100 text-red-700 border-red-200" },
  IN_PROGRESS: { label: "対応中", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  IMPLEMENTED: { label: "実施済", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  VERIFIED: { label: "検証済", cls: "bg-green-100 text-green-700 border-green-200" },
  CLOSED: { label: "完了", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

const CORRECTIVE_NEXT_STATUS: Record<string, string> = {
  OPEN: "IN_PROGRESS",
  IN_PROGRESS: "IMPLEMENTED",
  IMPLEMENTED: "VERIFIED",
  VERIFIED: "CLOSED",
};

type TabKey = "checklist" | "findings" | "corrective";

// ─── Badge Components ────────────────────────────────────────────────

function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cls}`}>
      {label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const info = SEVERITY_MAP[severity] ?? SEVERITY_MAP.OBSERVATION;
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${info.cls}`}>{info.label}</span>;
}

// ─── Props ───────────────────────────────────────────────────────────

interface AuditDetailClientProps {
  initialPlan: AuditPlanDetail;
}

// ─── Main Component ──────────────────────────────────────────────────

export default function AuditDetailClient({ initialPlan }: AuditDetailClientProps) {
  const [plan, setPlan] = useState<AuditPlanDetail>(initialPlan);
  const [activeTab, setActiveTab] = useState<TabKey>("checklist");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --- Modal states ---
  const [showChecklistForm, setShowChecklistForm] = useState(false);
  const [showFindingForm, setShowFindingForm] = useState(false);
  const [showCorrectiveForm, setShowCorrectiveForm] = useState<string | null>(null); // findingId
  const [editingChecklist, setEditingChecklist] = useState<string | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit/plans/${plan.id}`);
      if (res.ok) {
        setPlan(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [plan.id]);

  // ─── Plan Status Update ────────────────────────────────────────────

  const handleStatusChange = async (newStatus: string) => {
    setError("");
    const res = await fetch(`/api/audit/plans/${plan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setPlan(prev => ({ ...prev, status: newStatus }));
    } else {
      const data = await res.json();
      setError(data.error || "ステータス更新に失敗しました");
    }
  };

  // ─── Summary ───────────────────────────────────────────────────────

  const checklistTotal = plan.checklistItems.length;
  const checklistDone = plan.checklistItems.filter(c => c.result !== null).length;
  const findingsTotal = plan.findings.length;
  const findingsClosed = plan.findings.filter(f => f.status === "CLOSED").length;

  const planBadge = PLAN_STATUS[plan.status] ?? PLAN_STATUS.DRAFT;

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "checklist", label: "チェックリスト", count: checklistTotal },
    { key: "findings", label: "指摘事項", count: findingsTotal },
    { key: "corrective", label: "是正処置", count: plan.findings.filter(f => f.correctiveAction).length },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/audit" className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block">
          ← 監査一覧に戻る
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-3">
              {plan.title}
              <Badge label={planBadge.label} cls={planBadge.cls} />
            </h1>
            <div className="flex gap-4 mt-2 text-sm text-slate-500">
              <span>{plan.fiscalYear}年度</span>
              {plan.scheduledDate && (
                <span>予定: {new Date(plan.scheduledDate).toLocaleDateString("ja-JP")}</span>
              )}
              {plan.leadAuditor && <span>主任監査員: {plan.leadAuditor.name}</span>}
            </div>
            {plan.scope && <p className="text-sm text-slate-600 mt-1">範囲: {plan.scope}</p>}
            {plan.targetDepts.length > 0 && (
              <div className="flex gap-1 mt-2">
                {plan.targetDepts.map(td => (
                  <span key={td.id} className="text-xs px-2 py-0.5 bg-slate-100 rounded-full text-slate-600">
                    {td.department.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={plan.status}
              onChange={e => handleStatusChange(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              {PLAN_STATUS_ORDER.map(s => (
                <option key={s} value={s}>{PLAN_STATUS[s].label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg mb-4">{error}</div>
      )}

      {/* Progress Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div className="text-xs text-blue-600 font-medium mb-1">チェックリスト進捗</div>
          <div className="text-2xl font-bold text-blue-800">{checklistDone}/{checklistTotal}</div>
          {checklistTotal > 0 && (
            <div className="w-full bg-blue-200 rounded-full h-1.5 mt-2">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all"
                style={{ width: `${Math.round((checklistDone / checklistTotal) * 100)}%` }}
              />
            </div>
          )}
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <div className="text-xs text-orange-600 font-medium mb-1">指摘事項</div>
          <div className="text-2xl font-bold text-orange-800">{findingsTotal}件</div>
          <div className="text-xs text-orange-600 mt-1">完了: {findingsClosed}件</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <div className="text-xs text-green-600 font-medium mb-1">是正完了率</div>
          <div className="text-2xl font-bold text-green-800">
            {findingsTotal > 0 ? Math.round((findingsClosed / findingsTotal) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-4">
        <div className="flex gap-0">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">読み込み中...</div>
      ) : (
        <>
          {activeTab === "checklist" && (
            <ChecklistSection
              planId={plan.id}
              items={plan.checklistItems}
              editingId={editingChecklist}
              onEditStart={setEditingChecklist}
              onEditEnd={() => setEditingChecklist(null)}
              showForm={showChecklistForm}
              onToggleForm={() => setShowChecklistForm(v => !v)}
              onRefetch={refetch}
            />
          )}
          {activeTab === "findings" && (
            <FindingsSection
              planId={plan.id}
              findings={plan.findings}
              expandedId={expandedFinding}
              onToggleExpand={(id) => setExpandedFinding(prev => prev === id ? null : id)}
              showForm={showFindingForm}
              onToggleForm={() => setShowFindingForm(v => !v)}
              showCorrectiveForm={showCorrectiveForm}
              onShowCorrectiveForm={setShowCorrectiveForm}
              onRefetch={refetch}
            />
          )}
          {activeTab === "corrective" && (
            <CorrectiveTraceSection findings={plan.findings} onRefetch={refetch} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Checklist Section ───────────────────────────────────────────────

interface ChecklistSectionProps {
  planId: string;
  items: ChecklistItem[];
  editingId: string | null;
  onEditStart: (id: string) => void;
  onEditEnd: () => void;
  showForm: boolean;
  onToggleForm: () => void;
  onRefetch: () => Promise<void>;
}

function ChecklistSection({
  planId, items, editingId, onEditStart, onEditEnd, showForm, onToggleForm, onRefetch,
}: ChecklistSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700">チェックリスト項目</h2>
        <button
          onClick={onToggleForm}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? "閉じる" : "+ 項目追加"}
        </button>
      </div>

      {showForm && (
        <AddChecklistForm planId={planId} nextOrder={items.length} onCreated={() => { onToggleForm(); onRefetch(); }} />
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {items.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            チェックリスト項目がありません。「+ 項目追加」から作成してください。
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <div key={item.id}>
                {editingId === item.id ? (
                  <EditChecklistRow item={item} onSaved={() => { onEditEnd(); onRefetch(); }} onCancel={onEditEnd} />
                ) : (
                  <div
                    className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => onEditStart(item.id)}
                  >
                    <div className="w-8 text-center text-xs text-slate-400 font-mono">{idx + 1}</div>
                    {item.category && (
                      <span className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-500 shrink-0">
                        {item.category}
                      </span>
                    )}
                    <div className="flex-1 text-slate-800">{item.question}</div>
                    <div className="w-20 text-center">
                      {item.result === null ? (
                        <span className="text-xs text-slate-300">未実施</span>
                      ) : item.result === "YES" ? (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">適合</span>
                      ) : item.result === "NO" ? (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">不適合</span>
                      ) : item.result === "NA" ? (
                        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-medium">N/A</span>
                      ) : (
                        <span className="text-xs text-slate-600">{item.result}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Checklist Form ──────────────────────────────────────────────

function AddChecklistForm({ planId, nextOrder, onCreated }: { planId: string; nextOrder: number; onCreated: () => void }) {
  const [category, setCategory] = useState("");
  const [question, setQuestion] = useState("");
  const [responseType, setResponseType] = useState("YES_NO");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) { setError("質問は必須です"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/audit/plans/${planId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category.trim() || null,
          question: question.trim(),
          responseType,
          sortOrder: nextOrder,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "作成に失敗しました");
        return;
      }
      onCreated();
    } catch { setError("通信エラー"); } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-3 space-y-3">
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-4 gap-3">
        <input
          type="text"
          value={category}
          onChange={e => setCategory(e.target.value)}
          placeholder="カテゴリ（例: A.3.4.3）"
          className="col-span-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="質問内容 *"
          className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <select
          value={responseType}
          onChange={e => setResponseType(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        >
          <option value="YES_NO">適合/不適合</option>
          <option value="RATING">評点</option>
          <option value="TEXT">テキスト</option>
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button type="submit" disabled={submitting} className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {submitting ? "追加中..." : "追加"}
        </button>
      </div>
    </form>
  );
}

// ─── Edit Checklist Row ──────────────────────────────────────────────

function EditChecklistRow({ item, onSaved, onCancel }: { item: ChecklistItem; onSaved: () => void; onCancel: () => void }) {
  const [result, setResult] = useState(item.result ?? "");
  const [evidenceNote, setEvidenceNote] = useState(item.evidenceNote ?? "");
  const [comment, setComment] = useState(item.comment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/audit/checklist/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result: result || null,
          evidenceNote: evidenceNote || null,
          comment: comment || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "更新に失敗しました");
        return;
      }
      onSaved();
    } catch { setError("通信エラー"); } finally { setSubmitting(false); }
  };

  return (
    <div className="bg-blue-50 px-4 py-3 space-y-2">
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="text-sm font-medium text-slate-800">
        {item.category && <span className="text-xs text-slate-500 mr-2">[{item.category}]</span>}
        {item.question}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">結果</label>
          {item.responseType === "YES_NO" ? (
            <div className="flex gap-2">
              {[
                { value: "YES", label: "適合", cls: "bg-green-100 border-green-300 text-green-700" },
                { value: "NO", label: "不適合", cls: "bg-red-100 border-red-300 text-red-700" },
                { value: "NA", label: "N/A", cls: "bg-slate-100 border-slate-300 text-slate-600" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setResult(opt.value)}
                  className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
                    result === opt.value ? opt.cls : "bg-white border-slate-200 text-slate-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="text"
              value={result}
              onChange={e => setResult(e.target.value)}
              placeholder={item.responseType === "RATING" ? "評点" : "結果"}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            />
          )}
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">証拠メモ</label>
          <input
            type="text"
            value={evidenceNote}
            onChange={e => setEvidenceNote(e.target.value)}
            placeholder="確認した証拠"
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">コメント</label>
          <input
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="補足コメント"
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700">キャンセル</button>
        <button
          onClick={handleSave}
          disabled={submitting}
          className="px-4 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}

// ─── Findings Section ────────────────────────────────────────────────

interface FindingsSectionProps {
  planId: string;
  findings: Finding[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  showForm: boolean;
  onToggleForm: () => void;
  showCorrectiveForm: string | null;
  onShowCorrectiveForm: (id: string | null) => void;
  onRefetch: () => Promise<void>;
}

function FindingsSection({
  planId, findings, expandedId, onToggleExpand,
  showForm, onToggleForm, showCorrectiveForm, onShowCorrectiveForm, onRefetch,
}: FindingsSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700">指摘事項</h2>
        <button
          onClick={onToggleForm}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? "閉じる" : "+ 指摘登録"}
        </button>
      </div>

      {showForm && (
        <AddFindingForm planId={planId} onCreated={() => { onToggleForm(); onRefetch(); }} />
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {findings.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            指摘事項がありません。「+ 指摘登録」から作成してください。
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {findings.map(finding => {
              const isExpanded = expandedId === finding.id;
              const badge = FINDING_STATUS[finding.status] ?? FINDING_STATUS.OPEN;
              return (
                <div key={finding.id}>
                  <div
                    className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => onToggleExpand(finding.id)}
                  >
                    <span className="text-slate-400 text-xs">{isExpanded ? "▼" : "▶"}</span>
                    <SeverityBadge severity={finding.severity} />
                    <div className="flex-1 font-medium text-slate-800">{finding.title}</div>
                    {finding.jisClause && (
                      <span className="text-xs text-slate-400">{finding.jisClause}</span>
                    )}
                    <Badge label={badge.label} cls={badge.cls} />
                    {finding.correctiveAction ? (
                      <span className="text-xs text-green-600">是正あり</span>
                    ) : (
                      <span className="text-xs text-slate-300">是正なし</span>
                    )}
                  </div>
                  {isExpanded && (
                    <FindingDetail
                      finding={finding}
                      showCorrectiveForm={showCorrectiveForm === finding.id}
                      onShowCorrectiveForm={() => onShowCorrectiveForm(showCorrectiveForm === finding.id ? null : finding.id)}
                      onRefetch={onRefetch}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Finding Form ────────────────────────────────────────────────

function AddFindingForm({ planId, onCreated }: { planId: string; onCreated: () => void }) {
  const [severity, setSeverity] = useState("MINOR");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [jisClause, setJisClause] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) { setError("タイトルと内容は必須です"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/audit/plans/${planId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          severity,
          title: title.trim(),
          description: description.trim(),
          jisClause: jisClause.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "作成に失敗しました");
        return;
      }
      onCreated();
    } catch { setError("通信エラー"); } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-3 space-y-3">
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-4 gap-3">
        <select
          value={severity}
          onChange={e => setSeverity(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        >
          <option value="CRITICAL">重大</option>
          <option value="MAJOR">重要</option>
          <option value="MINOR">軽微</option>
          <option value="OBSERVATION">観察事項</option>
        </select>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="指摘タイトル *"
          className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <input
          type="text"
          value={jisClause}
          onChange={e => setJisClause(e.target.value)}
          placeholder="JIS条項（例: A.3.4.3）"
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
      </div>
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="指摘内容の詳細 *"
        rows={3}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
      />
      <div className="flex justify-end gap-2">
        <button type="submit" disabled={submitting} className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {submitting ? "登録中..." : "登録"}
        </button>
      </div>
    </form>
  );
}

// ─── Finding Detail (expanded) ───────────────────────────────────────

function FindingDetail({
  finding, showCorrectiveForm, onShowCorrectiveForm, onRefetch,
}: {
  finding: Finding;
  showCorrectiveForm: boolean;
  onShowCorrectiveForm: () => void;
  onRefetch: () => Promise<void>;
}) {
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleFindingStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await fetch(`/api/audit/findings/${finding.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus === "CLOSED" ? { closedAt: new Date().toISOString() } : {}),
        }),
      });
      await onRefetch();
    } finally {
      setUpdatingStatus(false);
    }
  };

  const ca = finding.correctiveAction;

  return (
    <div className="bg-slate-50 px-6 py-4 space-y-4 border-t border-slate-100">
      {/* Description */}
      <div>
        <div className="text-xs font-medium text-slate-500 mb-1">指摘内容</div>
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{finding.description}</p>
      </div>

      <div className="flex gap-4">
        {finding.jisClause && (
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">JIS条項</div>
            <div className="text-sm text-slate-700">{finding.jisClause}</div>
          </div>
        )}
        <div>
          <div className="text-xs font-medium text-slate-500 mb-1">ステータス変更</div>
          <div className="flex gap-2">
            {(["OPEN", "CORRECTIVE_ACTION", "CLOSED"] as const).map(s => {
              const info = FINDING_STATUS[s];
              return (
                <button
                  key={s}
                  onClick={() => handleFindingStatusChange(s)}
                  disabled={updatingStatus || finding.status === s}
                  className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors disabled:opacity-50 ${
                    finding.status === s ? info.cls : "bg-white border-slate-200 text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  {info.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Corrective Action */}
      {ca ? (
        <CorrectiveActionCard action={ca} onRefetch={onRefetch} />
      ) : (
        <div>
          <button
            onClick={onShowCorrectiveForm}
            className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
          >
            {showCorrectiveForm ? "閉じる" : "+ 是正処置を登録"}
          </button>
          {showCorrectiveForm && (
            <AddCorrectiveForm findingId={finding.id} findingTitle={finding.title} onCreated={onRefetch} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Corrective Action Form ──────────────────────────────────────

function AddCorrectiveForm({ findingId, findingTitle, onCreated }: { findingId: string; findingTitle: string; onCreated: () => Promise<void> }) {
  const [title, setTitle] = useState(`${findingTitle}への是正処置`);
  const [rootCause, setRootCause] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("タイトルは必須です"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/audit/corrective", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "AUDIT",
          auditFindingId: findingId,
          title: title.trim(),
          rootCause: rootCause.trim() || null,
          actionPlan: actionPlan.trim() || null,
          dueDate: dueDate || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "作成に失敗しました");
        return;
      }
      // Also update finding status to CORRECTIVE_ACTION
      await fetch(`/api/audit/findings/${findingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CORRECTIVE_ACTION" }),
      });
      await onCreated();
    } catch { setError("通信エラー"); } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-purple-50 border border-purple-200 rounded-xl p-4 mt-3 space-y-3">
      {error && <div className="text-sm text-red-600">{error}</div>}
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="是正処置のタイトル *"
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
      />
      <div className="grid grid-cols-2 gap-3">
        <textarea
          value={rootCause}
          onChange={e => setRootCause(e.target.value)}
          placeholder="原因分析"
          rows={2}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <textarea
          value={actionPlan}
          onChange={e => setActionPlan(e.target.value)}
          placeholder="是正計画"
          rows={2}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-500">期限:</label>
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
        />
        <div className="flex-1" />
        <button type="submit" disabled={submitting} className="px-4 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
          {submitting ? "作成中..." : "是正処置を作成"}
        </button>
      </div>
    </form>
  );
}

// ─── Corrective Action Card ──────────────────────────────────────────

function CorrectiveActionCard({ action, onRefetch }: { action: CorrectiveAction; onRefetch: () => Promise<void> }) {
  const [advancing, setAdvancing] = useState(false);
  const badge = CORRECTIVE_STATUS[action.status] ?? CORRECTIVE_STATUS.OPEN;
  const nextStatus = CORRECTIVE_NEXT_STATUS[action.status];

  const handleAdvance = async () => {
    if (!nextStatus) return;
    setAdvancing(true);
    try {
      await fetch(`/api/audit/corrective/${action.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      await onRefetch();
    } finally {
      setAdvancing(false);
    }
  };

  // Status step indicator
  const steps = ["OPEN", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED", "CLOSED"];
  const currentIdx = steps.indexOf(action.status);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">是正処置:</span>
          <span className="text-sm font-medium text-slate-800">{action.title}</span>
        </div>
        <Badge label={badge.label} cls={badge.cls} />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => {
          const info = CORRECTIVE_STATUS[s];
          const isActive = i <= currentIdx;
          return (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div
                className={`h-2 flex-1 rounded-full transition-colors ${
                  isActive ? "bg-blue-500" : "bg-slate-200"
                }`}
              />
              {i < steps.length - 1 && <div className="w-0" />}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400">
        {steps.map(s => (
          <span key={s}>{CORRECTIVE_STATUS[s].label}</span>
        ))}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {action.rootCause && (
          <div>
            <div className="text-xs text-slate-500">原因分析</div>
            <div className="text-slate-700">{action.rootCause}</div>
          </div>
        )}
        {action.actionPlan && (
          <div>
            <div className="text-xs text-slate-500">是正計画</div>
            <div className="text-slate-700">{action.actionPlan}</div>
          </div>
        )}
        {action.dueDate && (
          <div>
            <div className="text-xs text-slate-500">期限</div>
            <div className="text-slate-700">{new Date(action.dueDate).toLocaleDateString("ja-JP")}</div>
          </div>
        )}
        {action.implementedAt && (
          <div>
            <div className="text-xs text-slate-500">実施日</div>
            <div className="text-slate-700">{new Date(action.implementedAt).toLocaleDateString("ja-JP")}</div>
          </div>
        )}
        {action.implementNote && (
          <div className="col-span-2">
            <div className="text-xs text-slate-500">実施メモ</div>
            <div className="text-slate-700">{action.implementNote}</div>
          </div>
        )}
        {action.verifiedAt && (
          <div>
            <div className="text-xs text-slate-500">検証日</div>
            <div className="text-slate-700">{new Date(action.verifiedAt).toLocaleDateString("ja-JP")}</div>
          </div>
        )}
        {action.verifyNote && (
          <div>
            <div className="text-xs text-slate-500">検証メモ</div>
            <div className="text-slate-700">{action.verifyNote}</div>
          </div>
        )}
        {action.horizontalDeployment && (
          <div className="col-span-2">
            <div className="text-xs text-slate-500">水平展開</div>
            <div className="text-slate-700">{action.horizontalDeployment}</div>
          </div>
        )}
      </div>

      {/* Advance button */}
      {nextStatus && (
        <div className="flex justify-end">
          <button
            onClick={handleAdvance}
            disabled={advancing}
            className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {advancing ? "更新中..." : `→ ${CORRECTIVE_STATUS[nextStatus].label}に進める`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Corrective Trace Section (Tab 3) ────────────────────────────────

function CorrectiveTraceSection({ findings, onRefetch }: { findings: Finding[]; onRefetch: () => Promise<void> }) {
  const withCorrective = findings.filter(f => f.correctiveAction);

  if (withCorrective.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        是正処置が登録されている指摘事項がありません。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-700">
        トレーサビリティ: 指摘 → 是正 → 検証 → 完了
      </h2>
      {withCorrective.map(finding => {
        const ca = finding.correctiveAction!;
        const findingBadge = FINDING_STATUS[finding.status] ?? FINDING_STATUS.OPEN;

        return (
          <div key={finding.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            {/* Finding summary */}
            <div className="flex items-center gap-3">
              <SeverityBadge severity={finding.severity} />
              <span className="text-sm font-medium text-slate-800 flex-1">{finding.title}</span>
              <Badge label={findingBadge.label} cls={findingBadge.cls} />
            </div>

            {/* Corrective action details */}
            <CorrectiveActionCard action={ca} onRefetch={onRefetch} />
          </div>
        );
      })}
    </div>
  );
}
