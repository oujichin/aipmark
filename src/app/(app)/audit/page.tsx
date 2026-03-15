"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

// ─── Types ───────────────────────────────────────────────────────────

interface Department {
  id: string;
  name: string;
}

interface UserRef {
  id: string;
  name: string;
}

interface AuditPlanDepartment {
  id: string;
  department: Department;
}

interface AuditPlanAuditor {
  id: string;
  user: UserRef;
  role: string;
}

interface AuditPlan {
  id: string;
  fiscalYear: number;
  title: string;
  scope: string | null;
  status: string;
  scheduledDate: string | null;
  createdAt: string;
  targetDepts: AuditPlanDepartment[];
  auditors: AuditPlanAuditor[];
  _count: { findings: number; checklistItems: number };
}

interface AuditFinding {
  id: string;
  title: string;
  severity: string;
  status: string;
  auditPlan?: { id: string; title: string };
}

interface CorrectiveAction {
  id: string;
  title: string;
  source: string;
  status: string;
  dueDate: string | null;
  responsible: UserRef | null;
  auditFinding: { id: string; title: string; severity: string; auditPlan: { id: string; title: string } } | null;
}

// ─── Constants ───────────────────────────────────────────────────────

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "下書き", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  PLANNED: { label: "計画済", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  IN_PROGRESS: { label: "実施中", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  COMPLETED: { label: "完了", cls: "bg-green-100 text-green-700 border-green-200" },
  REPORTED: { label: "報告済", cls: "bg-purple-100 text-purple-700 border-purple-200" },
};

const CORRECTIVE_STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: "未着手", cls: "bg-red-100 text-red-700 border-red-200" },
  IN_PROGRESS: { label: "対応中", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  IMPLEMENTED: { label: "実施済", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  VERIFIED: { label: "検証済", cls: "bg-green-100 text-green-700 border-green-200" },
  CLOSED: { label: "完了", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500 text-white",
  MAJOR: "bg-orange-500 text-white",
  MINOR: "bg-yellow-400 text-yellow-900",
  OBSERVATION: "bg-slate-200 text-slate-700",
};

function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cls}`}>
      {label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls = SEVERITY_COLORS[severity] ?? "bg-slate-200 text-slate-700";
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${cls}`}>
      {severity}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function AuditPage() {
  const [plans, setPlans] = useState<AuditPlan[]>([]);
  const [correctives, setCorrectives] = useState<CorrectiveAction[]>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [correctiveFilter, setCorrectiveFilter] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, correctivesRes] = await Promise.all([
        fetch("/api/audit/plans"),
        fetch(`/api/audit/corrective${correctiveFilter ? `?status=${correctiveFilter}` : ""}`),
      ]);
      if (plansRes.ok) {
        const plansData: AuditPlan[] = await plansRes.json();
        setPlans(plansData);
      }
      if (correctivesRes.ok) {
        const correctivesData: CorrectiveAction[] = await correctivesRes.json();
        setCorrectives(correctivesData);
      }
    } finally {
      setLoading(false);
    }
  }, [correctiveFilter]);

  // Fetch findings from all plans
  const fetchFindings = useCallback(async (planList: AuditPlan[]) => {
    const allFindings: AuditFinding[] = [];
    for (const plan of planList) {
      const res = await fetch(`/api/audit/plans/${plan.id}`);
      if (res.ok) {
        const detail = await res.json();
        if (detail.findings) {
          for (const f of detail.findings) {
            allFindings.push({ ...f, auditPlan: { id: plan.id, title: plan.title } });
          }
        }
      }
    }
    setFindings(allFindings);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (plans.length > 0) {
      fetchFindings(plans);
    }
  }, [plans, fetchFindings]);

  // ─── Summary Stats ──────────────────────────────────────────────────
  const totalPlans = plans.length;
  const totalFindings = findings.length;
  const totalCorrectives = correctives.length;
  const closedCorrectives = correctives.filter((c) => c.status === "CLOSED").length;
  const completionRate = totalCorrectives > 0 ? Math.round((closedCorrectives / totalCorrectives) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="内部監査・是正処置"
        description="内部監査の計画・実施・是正処置の管理を行います。"
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 監査計画を作成
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard label="監査計画数" value={totalPlans} color="blue" />
        <SummaryCard label="指摘件数" value={totalFindings} color="orange" />
        <SummaryCard label="是正処置数" value={totalCorrectives} color="purple" />
        <SummaryCard label="是正完了率" value={`${completionRate}%`} color="green" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">読み込み中...</div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {/* 監査計画一覧 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700">監査計画</h2>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500">
                <div>監査名</div>
                <div>年度</div>
                <div>指摘数</div>
                <div>ステータス</div>
              </div>
              {plans.length === 0 ? (
                <EmptyState icon="🔍" title="監査計画なし" description="内部監査の計画を登録します。" />
              ) : (
                <div className="divide-y divide-slate-100">
                  {plans.map((plan) => {
                    const badge = STATUS_BADGES[plan.status] ?? STATUS_BADGES.DRAFT;
                    return (
                      <div key={plan.id} className="grid grid-cols-4 gap-4 px-4 py-3 text-sm hover:bg-slate-50 transition-colors">
                        <div className="font-medium text-slate-800 truncate">{plan.title}</div>
                        <div className="text-slate-600">{plan.fiscalYear}</div>
                        <div className="text-slate-600">{plan._count.findings}</div>
                        <div><Badge label={badge.label} cls={badge.cls} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 是正処置一覧 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700">是正処置</h2>
              <select
                className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-600"
                value={correctiveFilter}
                onChange={(e) => setCorrectiveFilter(e.target.value)}
              >
                <option value="">すべて</option>
                {Object.entries(CORRECTIVE_STATUS).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-3 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500">
                <div>不適合内容</div>
                <div>期限</div>
                <div>進捗</div>
              </div>
              {correctives.length === 0 ? (
                <EmptyState icon="✅" title="是正処置なし" description="監査で発見した不適合に対する是正処置を管理します。" />
              ) : (
                <div className="divide-y divide-slate-100">
                  {correctives.map((ca) => {
                    const badge = CORRECTIVE_STATUS[ca.status] ?? CORRECTIVE_STATUS.OPEN;
                    return (
                      <div key={ca.id} className="grid grid-cols-3 gap-4 px-4 py-3 text-sm hover:bg-slate-50 transition-colors">
                        <div className="font-medium text-slate-800 truncate">{ca.title}</div>
                        <div className="text-slate-600">{ca.dueDate ? new Date(ca.dueDate).toLocaleDateString("ja-JP") : "-"}</div>
                        <div><Badge label={badge.label} cls={badge.cls} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 指摘一覧 */}
      {!loading && findings.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">指摘事項</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500">
              <div>タイトル</div>
              <div>重要度</div>
              <div>監査計画</div>
              <div>ステータス</div>
            </div>
            <div className="divide-y divide-slate-100">
              {findings.map((f) => (
                <div key={f.id} className="grid grid-cols-4 gap-4 px-4 py-3 text-sm hover:bg-slate-50 transition-colors">
                  <div className="font-medium text-slate-800 truncate">{f.title}</div>
                  <div><SeverityBadge severity={f.severity} /></div>
                  <div className="text-slate-600 truncate">{f.auditPlan?.title ?? "-"}</div>
                  <div className="text-slate-600">{f.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 計画作成モーダル */}
      {showCreateModal && (
        <CreatePlanModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// ─── Summary Card ────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    orange: "bg-orange-50 border-orange-200 text-orange-800",
    purple: "bg-purple-50 border-purple-200 text-purple-800",
    green: "bg-green-50 border-green-200 text-green-800",
  };
  const cls = colorMap[color] ?? colorMap.blue;
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <div className="text-xs font-medium opacity-70 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

// ─── Create Plan Modal ───────────────────────────────────────────────

interface CreatePlanModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreatePlanModal({ onClose, onCreated }: CreatePlanModalProps) {
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("");
  const [targetDeptIds, setTargetDeptIds] = useState<string[]>([]);
  const [auditorIds, setAuditorIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserRef[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Fetch departments and users for selection
    Promise.all([
      fetch("/api/departments").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/users").then((r) => (r.ok ? r.json() : [])),
    ]).then(([depts, usrs]) => {
      setDepartments(Array.isArray(depts) ? depts : []);
      setUsers(Array.isArray(usrs) ? usrs : []);
    }).catch(() => {
      // API may not exist yet
    });
  }, []);

  const toggleDept = (id: string) => {
    setTargetDeptIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  const toggleAuditor = (id: string) => {
    setAuditorIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("監査名は必須です");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/audit/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiscalYear,
          title: title.trim(),
          scope: scope.trim() || undefined,
          targetDeptIds: targetDeptIds.length > 0 ? targetDeptIds : undefined,
          auditorIds: auditorIds.length > 0 ? auditorIds : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "作成に失敗しました");
        return;
      }
      onCreated();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">監査計画を作成</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">年度</label>
            <input
              type="number"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">監査名 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 2025年度内部監査"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">監査範囲</label>
            <textarea
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="例: PMS全体"
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {departments.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">対象部門</label>
              <div className="flex flex-wrap gap-2">
                {departments.map((dept) => (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => toggleDept(dept.id)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      targetDeptIds.includes(dept.id)
                        ? "bg-blue-100 border-blue-300 text-blue-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {dept.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {users.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">監査員</label>
              <div className="flex flex-wrap gap-2">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleAuditor(user.id)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      auditorIds.includes(user.id)
                        ? "bg-blue-100 border-blue-300 text-blue-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {user.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "作成中..." : "作成"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
