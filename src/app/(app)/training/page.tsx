"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

// ---------- Types ----------
interface TrainingSession {
  id: string;
  title: string;
  sessionDate: string | null;
  facilitator: string | null;
  location: string | null;
  materialNote: string | null;
  status: string;
  _count?: { results: number };
  results?: TrainingResult[];
  quizQuestions?: QuizQuestion[];
}

interface TrainingPlan {
  id: string;
  fiscalYear: number;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string } | null;
  sessions: TrainingSession[];
  _count: { sessions: number };
}

interface TrainingResult {
  id: string;
  userId: string;
  attended: boolean;
  quizScore: number | null;
  quizMaxScore: number | null;
  passed: boolean | null;
  status: string;
  user: { id: string; name: string; email: string };
}

interface QuizQuestion {
  id: string;
  questionText: string;
  questionType: string;
  options: string;
  correctAnswer: string;
  points: number;
  sortOrder: number;
}

// ---------- Constants ----------
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "下書き", color: "bg-slate-100 text-slate-600" },
  SCHEDULED: { label: "予定", color: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "実施中", color: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "完了", color: "bg-green-100 text-green-700" },
};

const SESSION_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: "予定", color: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "実施中", color: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "完了", color: "bg-green-100 text-green-700" },
};

const FISCAL_YEARS = [2023, 2024, 2025, 2026];
const MONTHS = ["4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月"];

// ---------- Sub-Components ----------
function StatusBadge({ status, labels }: { status: string; labels: Record<string, { label: string; color: string }> }) {
  const st = labels[status] ?? { label: status, color: "bg-slate-100 text-slate-500" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>
      {st.label}
    </span>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

// ---------- Main Page ----------
export default function TrainingPage() {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TrainingPlan | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);

  // ---------- Fetch ----------
  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterYear) params.set("fiscalYear", String(filterYear));
    if (filterStatus) params.set("status", filterStatus);

    const res = await fetch(`/api/training/plans?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setPlans(Array.isArray(data) ? data : data.items ?? []);
    }
    setLoading(false);
  }, [filterYear, filterStatus]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  // ---------- Fetch plan detail ----------
  const fetchPlanDetail = async (id: string) => {
    const res = await fetch(`/api/training/plans/${id}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedPlan(data);
    }
  };

  // ---------- Summary ----------
  const totalSessions = plans.reduce((s, p) => s + p.sessions.length, 0);
  const completedSessions = plans.reduce(
    (s, p) => s + p.sessions.filter((ss) => ss.status === "COMPLETED").length,
    0
  );
  const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // Calendar helper: get month index (0=4月, 11=3月) from session date
  function getMonthIndex(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const month = new Date(dateStr).getMonth() + 1; // 1-12
    // Fiscal year: 4=0, 5=1, ..., 12=8, 1=9, 2=10, 3=11
    if (month >= 4) return month - 4;
    return month + 8;
  }

  return (
    <div>
      <PageHeader
        title="教育管理"
        description="個人情報保護に関する教育・研修の計画・実施・記録を管理します。"
        actions={
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            onClick={() => setShowCreateModal(true)}
          >
            + 教育計画追加
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard label="教育計画数" value={plans.length} />
        <SummaryCard label="セッション数" value={totalSessions} />
        <SummaryCard label="完了セッション" value={completedSessions} />
        <SummaryCard label="実施率" value={`${completionRate}%`} sub={`${completedSessions}/${totalSessions}`} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <select
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">全年度</option>
          {FISCAL_YEARS.map((y) => (
            <option key={y} value={y}>{y}年度</option>
          ))}
        </select>
        <select
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">全ステータス</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="text-sm font-medium text-slate-600 mb-3">
          年間教育計画カレンダー（{filterYear || "全年度"}）
        </div>
        <div className="grid grid-cols-12 gap-1">
          {MONTHS.map((month, idx) => {
            const sessionsInMonth = plans.flatMap((p) =>
              p.sessions.filter((s) => getMonthIndex(s.sessionDate) === idx)
            );
            return (
              <div key={month} className="text-center">
                <div className="text-xs text-slate-400 mb-1">{month}</div>
                <div
                  className={`h-12 rounded-lg border flex items-center justify-center text-xs font-medium ${
                    sessionsInMonth.length > 0
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-slate-50 border-slate-100 text-slate-300"
                  }`}
                >
                  {sessionsInMonth.length > 0 ? sessionsInMonth.length : ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plan List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <div className="col-span-2">研修名</div>
          <div>年度</div>
          <div>セッション</div>
          <div>ステータス</div>
          <div>操作</div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">読み込み中...</div>
        ) : plans.length === 0 ? (
          <EmptyState
            icon="🎓"
            title="教育計画がありません"
            description="年間の教育研修計画を登録して、実施状況を管理できます。"
          />
        ) : (
          plans.map((plan) => (
            <div
              key={plan.id}
              className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors items-center"
            >
              <div className="col-span-2">
                <div className="font-medium text-slate-900 text-sm">{plan.title}</div>
                {plan.description && (
                  <div className="text-xs text-slate-400 mt-0.5 truncate">{plan.description}</div>
                )}
              </div>
              <div className="text-sm text-slate-600">{plan.fiscalYear}年度</div>
              <div className="text-sm text-slate-600">{plan._count.sessions}件</div>
              <div>
                <StatusBadge status={plan.status} labels={STATUS_LABELS} />
              </div>
              <div className="flex gap-2">
                <button
                  className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                  onClick={() => fetchPlanDetail(plan.id)}
                >
                  詳細
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Plan Detail Panel */}
      {selectedPlan && (
        <PlanDetailPanel
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onSessionClick={(s) => {
            setSelectedSession(s);
          }}
          onAddSession={() => setShowSessionModal(true)}
          onRefresh={() => fetchPlanDetail(selectedPlan.id)}
        />
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}

      {/* Create Plan Modal */}
      {showCreateModal && (
        <CreatePlanModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchPlans();
          }}
        />
      )}

      {/* Add Session Modal */}
      {showSessionModal && selectedPlan && (
        <AddSessionModal
          planId={selectedPlan.id}
          onClose={() => setShowSessionModal(false)}
          onCreated={() => {
            setShowSessionModal(false);
            fetchPlanDetail(selectedPlan.id);
          }}
        />
      )}
    </div>
  );
}

// =========================================================
// Plan Detail Panel
// =========================================================
function PlanDetailPanel({
  plan,
  onClose,
  onSessionClick,
  onAddSession,
  onRefresh,
}: {
  plan: TrainingPlan & { sessions: TrainingSession[] };
  onClose: () => void;
  onSessionClick: (s: TrainingSession) => void;
  onAddSession: () => void;
  onRefresh: () => void;
}) {
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState(plan.status);

  const updateStatus = async () => {
    await fetch(`/api/training/plans/${plan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setEditingStatus(false);
    onRefresh();
  };

  // Calculate attendance stats from sessions with results
  const allResults = plan.sessions.flatMap((s) => s.results ?? []);
  const attendedCount = allResults.filter((r) => r.attended).length;
  const attendanceRate = allResults.length > 0 ? Math.round((attendedCount / allResults.length) * 100) : 0;
  const passedCount = allResults.filter((r) => r.passed).length;
  const testedCount = allResults.filter((r) => r.quizScore !== null).length;
  const passRate = testedCount > 0 ? Math.round((passedCount / testedCount) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-start justify-end z-50">
      <div className="w-[600px] h-full bg-white shadow-xl overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900">{plan.title}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">
              &times;
            </button>
          </div>

          {/* Plan info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="text-xs text-slate-500">年度</div>
              <div className="text-sm font-medium">{plan.fiscalYear}年度</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">ステータス</div>
              {editingStatus ? (
                <div className="flex gap-2 items-center">
                  <select
                    className="text-sm border border-slate-200 rounded px-2 py-1"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <button className="text-xs text-blue-600 hover:underline" onClick={updateStatus}>保存</button>
                  <button className="text-xs text-slate-400 hover:underline" onClick={() => setEditingStatus(false)}>取消</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <StatusBadge status={plan.status} labels={STATUS_LABELS} />
                  <button className="text-xs text-slate-400 hover:text-blue-600" onClick={() => setEditingStatus(true)}>変更</button>
                </div>
              )}
            </div>
            <div className="col-span-2">
              <div className="text-xs text-slate-500">説明</div>
              <div className="text-sm text-slate-700">{plan.description || "---"}</div>
            </div>
          </div>

          {/* Progress Summary */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-blue-600">受講率</div>
              <div className="text-xl font-bold text-blue-800">{attendanceRate}%</div>
              <div className="text-xs text-blue-500">{attendedCount}/{allResults.length}名</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-xs text-green-600">合格率</div>
              <div className="text-xl font-bold text-green-800">{passRate}%</div>
              <div className="text-xs text-green-500">{passedCount}/{testedCount}名</div>
            </div>
          </div>

          {/* Sessions */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-700">セッション一覧</h3>
            <button
              className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              onClick={onAddSession}
            >
              + セッション追加
            </button>
          </div>

          {plan.sessions.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-8">セッションがありません</div>
          ) : (
            <div className="space-y-2">
              {plan.sessions.map((session) => (
                <div
                  key={session.id}
                  className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onSessionClick(session)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-sm text-slate-900">{session.title}</div>
                    <StatusBadge status={session.status} labels={SESSION_STATUS_LABELS} />
                  </div>
                  <div className="flex gap-4 text-xs text-slate-500">
                    {session.sessionDate && (
                      <span>{new Date(session.sessionDate).toLocaleDateString("ja-JP")}</span>
                    )}
                    {session.location && <span>{session.location}</span>}
                    {session.facilitator && <span>講師: {session.facilitator}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================
// Session Detail Modal
// =========================================================
function SessionDetailModal({
  session: initialSession,
  onClose,
}: {
  session: TrainingSession;
  onClose: () => void;
}) {
  const [session, setSession] = useState(initialSession);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [editingResult, setEditingResult] = useState<TrainingResult | null>(null);

  const results = session.results ?? [];
  const quizQuestions = session.quizQuestions ?? [];

  const attendedCount = results.filter((r) => r.attended).length;
  const attendanceRate = results.length > 0 ? Math.round((attendedCount / results.length) * 100) : 0;
  const testedCount = results.filter((r) => r.quizScore !== null).length;
  const passedCount = results.filter((r) => r.passed).length;
  const passRate = testedCount > 0 ? Math.round((passedCount / testedCount) * 100) : 0;

  const refreshSession = async () => {
    const res = await fetch(`/api/training/sessions/${session.id}`);
    if (res.ok) {
      const data = await res.json();
      setSession(data);
    }
  };

  // 受講結果追加
  const handleAddResult = async (form: { userId: string; attended: boolean; quizScore: string; quizMaxScore: string; passed: boolean }) => {
    const resultItem: Record<string, unknown> = {
      userId: form.userId,
      attended: form.attended,
      passed: form.passed,
    };
    if (form.quizScore !== "") resultItem.quizScore = parseInt(form.quizScore, 10);
    if (form.quizMaxScore !== "") resultItem.quizMaxScore = parseInt(form.quizMaxScore, 10);

    const res = await fetch(`/api/training/sessions/${session.id}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results: [resultItem] }),
    });
    if (res.ok) {
      setShowResultModal(false);
      refreshSession();
    }
  };

  // 受講結果更新
  const handleUpdateResult = async (resultId: string, form: { attended: boolean; quizScore: string; quizMaxScore: string; passed: boolean }) => {
    const body: Record<string, unknown> = {
      attended: form.attended,
      passed: form.passed,
    };
    if (form.quizScore !== "") {
      body.quizScore = parseInt(form.quizScore, 10);
    } else {
      body.quizScore = null;
    }
    if (form.quizMaxScore !== "") {
      body.quizMaxScore = parseInt(form.quizMaxScore, 10);
    } else {
      body.quizMaxScore = null;
    }

    await fetch(`/api/training/results/${resultId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditingResult(null);
    refreshSession();
  };

  // クイズ追加
  const handleAddQuiz = async (form: { questionText: string; questionType: string; options: string; correctAnswer: string; points: number; sortOrder: number }) => {
    await fetch(`/api/training/sessions/${session.id}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowQuizModal(false);
    refreshSession();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[750px] max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">{session.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
          <div><div className="text-xs text-slate-500">日時</div><div>{session.sessionDate ? new Date(session.sessionDate).toLocaleDateString("ja-JP") : "未定"}</div></div>
          <div><div className="text-xs text-slate-500">場所</div><div>{session.location || "未定"}</div></div>
          <div><div className="text-xs text-slate-500">講師</div><div>{session.facilitator || "未定"}</div></div>
        </div>

        {/* 集計 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-blue-50 rounded-lg p-2">
            <div className="text-xs text-blue-600">受講率</div>
            <div className="text-lg font-bold text-blue-800">{attendanceRate}% <span className="text-xs font-normal">({attendedCount}/{results.length})</span></div>
          </div>
          <div className="bg-green-50 rounded-lg p-2">
            <div className="text-xs text-green-600">合格率</div>
            <div className="text-lg font-bold text-green-800">{passRate}% <span className="text-xs font-normal">({passedCount}/{testedCount})</span></div>
          </div>
        </div>

        {session.materialNote && (
          <div className="mb-4">
            <div className="text-xs text-slate-500 mb-1">教材・ノート</div>
            <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{session.materialNote}</div>
          </div>
        )}

        {/* 受講状況 */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-700">受講状況 ({results.length}名)</h3>
          <button onClick={() => setShowResultModal(true)} className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ 受講結果追加</button>
        </div>
        {results.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">受講記録がありません</div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium">氏名</th>
                  <th className="text-center px-3 py-2 text-xs text-slate-500 font-medium">出席</th>
                  <th className="text-center px-3 py-2 text-xs text-slate-500 font-medium">テスト</th>
                  <th className="text-center px-3 py-2 text-xs text-slate-500 font-medium">合否</th>
                  <th className="text-center px-3 py-2 text-xs text-slate-500 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{r.user.name}</td>
                    <td className="text-center px-3 py-2">
                      {r.attended ? <span className="text-green-600 font-medium">出席</span> : <span className="text-slate-400">未出席</span>}
                    </td>
                    <td className="text-center px-3 py-2">
                      {r.quizScore !== null ? `${r.quizScore}/${r.quizMaxScore ?? "?"}` : "---"}
                    </td>
                    <td className="text-center px-3 py-2">
                      {r.passed === true && <span className="text-green-600 font-medium">合格</span>}
                      {r.passed === false && <span className="text-red-600 font-medium">不合格</span>}
                      {r.passed === null && <span className="text-slate-400">---</span>}
                    </td>
                    <td className="text-center px-3 py-2">
                      <button onClick={() => setEditingResult(r)} className="text-xs text-blue-600 hover:underline">編集</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* クイズ問題 */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-700">クイズ問題 ({quizQuestions.length}問)</h3>
          <button onClick={() => setShowQuizModal(true)} className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ クイズ追加</button>
        </div>
        {quizQuestions.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-4">クイズ問題がありません</div>
        ) : (
          <div className="space-y-2">
            {quizQuestions.map((q, i) => (
              <div key={q.id} className="bg-slate-50 rounded-lg p-3">
                <div className="text-sm font-medium text-slate-800 mb-1">Q{i + 1}. {q.questionText}</div>
                <div className="text-xs text-slate-500">配点: {q.points}点 / タイプ: {q.questionType}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 受講結果追加モーダル */}
      {showResultModal && (
        <ResultFormModal onClose={() => setShowResultModal(false)} onSubmit={handleAddResult} />
      )}

      {/* 受講結果編集モーダル */}
      {editingResult && (
        <ResultFormModal
          initial={editingResult}
          onClose={() => setEditingResult(null)}
          onSubmit={(form) => handleUpdateResult(editingResult.id, form)}
        />
      )}

      {/* クイズ追加モーダル */}
      {showQuizModal && (
        <QuizFormModal onClose={() => setShowQuizModal(false)} onSubmit={handleAddQuiz} />
      )}
    </div>
  );
}

// =========================================================
// 受講結果フォームモーダル
// =========================================================
function ResultFormModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: TrainingResult;
  onClose: () => void;
  onSubmit: (form: { userId: string; attended: boolean; quizScore: string; quizMaxScore: string; passed: boolean }) => void;
}) {
  const [userId, setUserId] = useState(initial?.userId ?? "");
  const [attended, setAttended] = useState(initial?.attended ?? false);
  const [quizScore, setQuizScore] = useState(initial?.quizScore?.toString() ?? "");
  const [quizMaxScore, setQuizMaxScore] = useState(initial?.quizMaxScore?.toString() ?? "");
  const [passed, setPassed] = useState(initial?.passed ?? false);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-[400px] p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">{initial ? "受講結果編集" : "受講結果追加"}</h3>
        <div className="space-y-3">
          {!initial && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ユーザーID *</label>
              <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="user-xxxxx" />
            </div>
          )}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={attended} onChange={(e) => setAttended(e.target.checked)} className="rounded" />
              出席
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={passed} onChange={(e) => setPassed(e.target.checked)} className="rounded" />
              合格
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">テスト点数</label>
              <input type="number" value={quizScore} onChange={(e) => setQuizScore(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">満点</label>
              <input type="number" value={quizMaxScore} onChange={(e) => setQuizMaxScore(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
          <button onClick={() => onSubmit({ userId, attended, quizScore, quizMaxScore, passed })}
            disabled={!initial && !userId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {initial ? "更新" : "追加"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// クイズ追加モーダル
// =========================================================
function QuizFormModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (form: { questionText: string; questionType: string; options: string; correctAnswer: string; points: number; sortOrder: number }) => void;
}) {
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState("SINGLE_CHOICE");
  const [options, setOptions] = useState('["選択肢A", "選択肢B", "選択肢C"]');
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [points, setPoints] = useState(1);
  const [sortOrder, setSortOrder] = useState(0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-[500px] p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">クイズ問題追加</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">問題文 *</label>
            <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" rows={3} placeholder="問題文を入力" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">問題形式</label>
              <select value={questionType} onChange={(e) => setQuestionType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="SINGLE_CHOICE">単一選択</option>
                <option value="MULTI_CHOICE">複数選択</option>
                <option value="TRUE_FALSE">正誤</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">配点</label>
              <input type="number" value={points} onChange={(e) => setPoints(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" min={1} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">選択肢 (JSON配列)</label>
            <textarea value={options} onChange={(e) => setOptions(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">正答</label>
              <input type="text" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="正解の選択肢" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">表示順</label>
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
          <button onClick={() => onSubmit({ questionText, questionType, options, correctAnswer, points, sortOrder })}
            disabled={!questionText}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">追加</button>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// Create Plan Modal
// =========================================================
function CreatePlanModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [fiscalYear, setFiscalYear] = useState(2025);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/training/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, fiscalYear, description: description || undefined }),
    });

    if (res.ok) {
      onCreated();
    } else {
      const data = await res.json();
      setError(data.error || "作成に失敗しました");
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[500px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">教育計画作成</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">タイトル *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 2025年度 個人情報保護教育"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">年度 *</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
            >
              {FISCAL_YEARS.map((y) => (
                <option key={y} value={y}>{y}年度</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">説明</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="教育計画の概要を記入してください"
            />
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting || !title}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "作成中..." : "作成"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =========================================================
// Add Session Modal
// =========================================================
function AddSessionModal({
  planId,
  onClose,
  onCreated,
}: {
  planId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [facilitator, setFacilitator] = useState("");
  const [location, setLocation] = useState("");
  const [materialNote, setMaterialNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch(`/api/training/plans/${planId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        sessionDate: sessionDate ? new Date(sessionDate).toISOString() : undefined,
        facilitator: facilitator || undefined,
        location: location || undefined,
        materialNote: materialNote || undefined,
      }),
    });

    if (res.ok) {
      onCreated();
    } else {
      const data = await res.json();
      setError(data.error || "作成に失敗しました");
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[500px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">セッション追加</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">セッション名 *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 第1回 個人情報保護研修"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">日時</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">講師</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              value={facilitator}
              onChange={(e) => setFacilitator(e.target.value)}
              placeholder="講師名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">場所</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="例: 会議室A / オンライン"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">教材・ノート</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              rows={2}
              value={materialNote}
              onChange={(e) => setMaterialNote(e.target.value)}
              placeholder="使用する教材やメモ"
            />
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting || !title}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "追加中..." : "追加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
