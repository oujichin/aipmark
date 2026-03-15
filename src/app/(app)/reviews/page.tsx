"use client";

import { useState, useEffect, useCallback } from "react";

// ── 型定義 ──────────────────────────────────────────────────────────

interface ReviewUser {
  id: string;
  name: string;
  email?: string;
}

interface ManagementReview {
  id: string;
  fiscalYear: number;
  reviewDate: string | null;
  status: string;
  minutes: string | null;
  externalIssues: string | null;
  internalIssues: string | null;
  stakeholderFeedback: string | null;
  riskSummary: string | null;
  trainingSummary: string | null;
  vendorSummary: string | null;
  auditSummary: string | null;
  incidentSummary: string | null;
  correctiveActionSummary: string | null;
  chairperson: ReviewUser | null;
  _count?: { agendas: number; decisions: number; participants: number };
  agendas?: Agenda[];
  decisions?: Decision[];
  participants?: Participant[];
  approvedBy?: ReviewUser | null;
  createdAt: string;
  updatedAt: string;
}

interface Agenda {
  id: string;
  agendaNumber: number;
  title: string;
  description: string | null;
  sortOrder: number;
}

interface Decision {
  id: string;
  decisionTitle: string;
  decisionDetail: string | null;
  improvementInstructions: string | null;
  responsibleId: string | null;
  responsible: ReviewUser | null;
  dueDate: string | null;
  status: string;
  followUpNotes: string | null;
  completedAt: string | null;
}

interface Participant {
  id: string;
  userId: string;
  user: ReviewUser;
  role: string;
  attendanceConfirmed: boolean;
}

interface OrgUser {
  id: string;
  name: string;
  email: string;
}

// ── ステータス表示 ──────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "下書き", color: "bg-slate-100 text-slate-700" },
  PREPARED: { label: "準備完了", color: "bg-blue-100 text-blue-700" },
  IN_REVIEW: { label: "レビュー中", color: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "承認済", color: "bg-green-100 text-green-700" },
  LOCKED: { label: "確定", color: "bg-purple-100 text-purple-700" },
};

const DECISION_STATUS_MAP: Record<string, { label: string; color: string }> = {
  OPEN: { label: "未着手", color: "bg-slate-100 text-slate-700" },
  IN_PROGRESS: { label: "対応中", color: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "完了", color: "bg-green-100 text-green-700" },
  CARRIED_FORWARD: { label: "繰越", color: "bg-orange-100 text-orange-700" },
};

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; color: string }> }) {
  const s = map[status] ?? { label: status, color: "bg-slate-100 text-slate-600" };
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${s.color}`}>{s.label}</span>;
}

// ── メインコンポーネント ──────────────────────────────────────────

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ManagementReview[]>([]);
  const [selectedReview, setSelectedReview] = useState<ManagementReview | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規作成フォーム
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFiscalYear, setNewFiscalYear] = useState(new Date().getFullYear());

  // 議題追加フォーム
  const [showAgendaForm, setShowAgendaForm] = useState(false);
  const [agendaTitle, setAgendaTitle] = useState("");
  const [agendaNumber, setAgendaNumber] = useState(1);
  const [agendaDescription, setAgendaDescription] = useState("");

  // 決定事項追加フォーム
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionDetail, setDecisionDetail] = useState("");
  const [decisionResponsibleId, setDecisionResponsibleId] = useState("");

  // 参加者追加フォーム
  const [showParticipantForm, setShowParticipantForm] = useState(false);
  const [participantUserId, setParticipantUserId] = useState("");
  const [participantRole, setParticipantRole] = useState("ATTENDEE");

  // ── データ取得 ──

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/reviews");
      if (!res.ok) throw new Error("レビュー一覧の取得に失敗しました");
      const data: ManagementReview[] = await res.json();
      setReviews(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReviewDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/reviews/${id}`);
      if (!res.ok) throw new Error("レビュー詳細の取得に失敗しました");
      const data: ManagementReview = await res.json();
      setSelectedReview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data: OrgUser[] = await res.json();
        setUsers(data);
      }
    } catch {
      // ユーザー取得失敗は致命的ではない
    }
  }, []);

  useEffect(() => {
    fetchReviews();
    fetchUsers();
  }, [fetchReviews, fetchUsers]);

  // ── アクション ──

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscalYear: newFiscalYear }),
      });
      if (!res.ok) throw new Error("作成に失敗しました");
      setShowCreateForm(false);
      await fetchReviews();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedReview) return;
    try {
      const res = await fetch(`/api/reviews/${selectedReview.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("更新に失敗しました");
      await fetchReviewDetail(selectedReview.id);
      await fetchReviews();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
  };

  const handleAddAgenda = async () => {
    if (!selectedReview) return;
    try {
      const res = await fetch(`/api/reviews/${selectedReview.id}/agendas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agendaNumber,
          title: agendaTitle,
          description: agendaDescription || null,
          sortOrder: agendaNumber,
        }),
      });
      if (!res.ok) throw new Error("議題の追加に失敗しました");
      setShowAgendaForm(false);
      setAgendaTitle("");
      setAgendaDescription("");
      await fetchReviewDetail(selectedReview.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
  };

  const handleAddDecision = async () => {
    if (!selectedReview) return;
    try {
      const res = await fetch(`/api/reviews/${selectedReview.id}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisionTitle,
          decisionDetail: decisionDetail || null,
          responsibleId: decisionResponsibleId || null,
        }),
      });
      if (!res.ok) throw new Error("決定事項の追加に失敗しました");
      setShowDecisionForm(false);
      setDecisionTitle("");
      setDecisionDetail("");
      setDecisionResponsibleId("");
      await fetchReviewDetail(selectedReview.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
  };

  const handleUpdateDecisionStatus = async (decId: string, status: string) => {
    try {
      const res = await fetch(`/api/reviews/decisions/${decId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("決定事項の更新に失敗しました");
      if (selectedReview) await fetchReviewDetail(selectedReview.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
  };

  const handleAddParticipant = async () => {
    if (!selectedReview) return;
    try {
      const res = await fetch(`/api/reviews/${selectedReview.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: participantUserId,
          role: participantRole,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "参加者の追加に失敗しました");
      }
      setShowParticipantForm(false);
      setParticipantUserId("");
      setParticipantRole("ATTENDEE");
      await fetchReviewDetail(selectedReview.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    if (!selectedReview) return;
    try {
      const res = await fetch(`/api/reviews/participants/${participantId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("参加者の削除に失敗しました");
      await fetchReviewDetail(selectedReview.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
  };

  // ── 描画 ──

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">マネジメントレビュー</h1>
          <p className="text-sm text-slate-500 mt-1">
            個人情報保護マネジメントシステムのレビュー管理（M-11）
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          新規レビュー作成
        </button>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 ml-2">
            &times;
          </button>
        </div>
      )}

      {/* 新規作成フォーム */}
      {showCreateForm && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-slate-900">新規マネジメントレビュー作成</h3>
          <div>
            <label className="block text-sm text-slate-600 mb-1">対象年度</label>
            <input
              type="number"
              value={newFiscalYear}
              onChange={(e) => setNewFiscalYear(parseInt(e.target.value, 10))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-32"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              作成
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-200"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 一覧 */}
        <div className="lg:col-span-1 space-y-2">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider">レビュー一覧</h2>
          {reviews.length === 0 ? (
            <div className="text-sm text-slate-400 bg-white border border-slate-200 rounded-lg p-4">
              レビューがありません
            </div>
          ) : (
            reviews.map((r) => (
              <button
                key={r.id}
                onClick={() => fetchReviewDetail(r.id)}
                className={`w-full text-left bg-white border rounded-lg p-3 hover:border-blue-300 transition-colors ${
                  selectedReview?.id === r.id ? "border-blue-500 ring-1 ring-blue-200" : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-900">{r.fiscalYear}年度</span>
                  <StatusBadge status={r.status} map={STATUS_MAP} />
                </div>
                <div className="text-xs text-slate-500">
                  議題: {r._count?.agendas ?? 0} / 決定事項: {r._count?.decisions ?? 0} / 参加者: {r._count?.participants ?? 0}
                </div>
                {r.chairperson && (
                  <div className="text-xs text-slate-400 mt-1">議長: {r.chairperson.name}</div>
                )}
              </button>
            ))
          )}
        </div>

        {/* 詳細 */}
        <div className="lg:col-span-2 space-y-4">
          {selectedReview ? (
            <>
              {/* レビュー概要 */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-slate-900">
                    {selectedReview.fiscalYear}年度 マネジメントレビュー
                  </h2>
                  <StatusBadge status={selectedReview.status} map={STATUS_MAP} />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {selectedReview.status === "DRAFT" && (
                    <button
                      onClick={() => handleUpdateStatus("PREPARED")}
                      className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                    >
                      準備完了にする
                    </button>
                  )}
                  {selectedReview.status === "PREPARED" && (
                    <button
                      onClick={() => handleUpdateStatus("IN_REVIEW")}
                      className="text-xs bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-lg hover:bg-yellow-100"
                    >
                      レビュー開始
                    </button>
                  )}
                  {selectedReview.status === "IN_REVIEW" && (
                    <button
                      onClick={() => handleUpdateStatus("APPROVED")}
                      className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-100"
                    >
                      承認する
                    </button>
                  )}
                  {selectedReview.status === "APPROVED" && (
                    <button
                      onClick={() => handleUpdateStatus("LOCKED")}
                      className="text-xs bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-100"
                    >
                      確定（ロック）
                    </button>
                  )}
                </div>
              </div>

              {/* 議題セクション */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-slate-900">議題</h3>
                  <button
                    onClick={() => {
                      setAgendaNumber((selectedReview.agendas?.length ?? 0) + 1);
                      setShowAgendaForm(true);
                    }}
                    className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200"
                  >
                    議題を追加
                  </button>
                </div>

                {showAgendaForm && (
                  <div className="border border-slate-200 rounded-lg p-3 mb-3 space-y-2 bg-slate-50">
                    <div className="flex gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">番号</label>
                        <input
                          type="number"
                          value={agendaNumber}
                          onChange={(e) => setAgendaNumber(parseInt(e.target.value, 10))}
                          className="border border-slate-300 rounded px-2 py-1 text-sm w-20"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">タイトル</label>
                        <input
                          type="text"
                          value={agendaTitle}
                          onChange={(e) => setAgendaTitle(e.target.value)}
                          className="border border-slate-300 rounded px-2 py-1 text-sm w-full"
                          placeholder="議題タイトル"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">説明</label>
                      <textarea
                        value={agendaDescription}
                        onChange={(e) => setAgendaDescription(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-sm w-full"
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleAddAgenda} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">追加</button>
                      <button onClick={() => setShowAgendaForm(false)} className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded hover:bg-slate-300">キャンセル</button>
                    </div>
                  </div>
                )}

                {selectedReview.agendas && selectedReview.agendas.length > 0 ? (
                  <div className="space-y-2">
                    {selectedReview.agendas.map((a) => (
                      <div key={a.id} className="border border-slate-100 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
                            #{a.agendaNumber}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-slate-900">{a.title}</div>
                            {a.description && <div className="text-xs text-slate-500 mt-1">{a.description}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">議題はまだありません</div>
                )}
              </div>

              {/* 決定事項セクション */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-slate-900">決定事項</h3>
                  <button
                    onClick={() => setShowDecisionForm(true)}
                    className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200"
                  >
                    決定事項を追加
                  </button>
                </div>

                {showDecisionForm && (
                  <div className="border border-slate-200 rounded-lg p-3 mb-3 space-y-2 bg-slate-50">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">タイトル</label>
                      <input
                        type="text"
                        value={decisionTitle}
                        onChange={(e) => setDecisionTitle(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-sm w-full"
                        placeholder="決定事項タイトル"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">詳細</label>
                      <textarea
                        value={decisionDetail}
                        onChange={(e) => setDecisionDetail(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-sm w-full"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">担当者</label>
                      <select
                        value={decisionResponsibleId}
                        onChange={(e) => setDecisionResponsibleId(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-sm w-full"
                      >
                        <option value="">未指定</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleAddDecision} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">追加</button>
                      <button onClick={() => setShowDecisionForm(false)} className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded hover:bg-slate-300">キャンセル</button>
                    </div>
                  </div>
                )}

                {selectedReview.decisions && selectedReview.decisions.length > 0 ? (
                  <div className="space-y-2">
                    {selectedReview.decisions.map((d) => (
                      <div key={d.id} className="border border-slate-100 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-900">{d.decisionTitle}</span>
                          <StatusBadge status={d.status} map={DECISION_STATUS_MAP} />
                        </div>
                        {d.decisionDetail && <div className="text-xs text-slate-500 mb-2">{d.decisionDetail}</div>}
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          {d.responsible && <span>担当: {d.responsible.name}</span>}
                          {d.dueDate && <span>期限: {new Date(d.dueDate).toLocaleDateString("ja-JP")}</span>}
                        </div>
                        <div className="flex gap-1 mt-2">
                          {d.status !== "COMPLETED" && (
                            <button
                              onClick={() => handleUpdateDecisionStatus(d.id, d.status === "OPEN" ? "IN_PROGRESS" : "COMPLETED")}
                              className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100"
                            >
                              {d.status === "OPEN" ? "着手" : "完了"}
                            </button>
                          )}
                          {d.status !== "CARRIED_FORWARD" && d.status !== "COMPLETED" && (
                            <button
                              onClick={() => handleUpdateDecisionStatus(d.id, "CARRIED_FORWARD")}
                              className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded hover:bg-orange-100"
                            >
                              繰越
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">決定事項はまだありません</div>
                )}
              </div>

              {/* 参加者セクション */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-slate-900">参加者</h3>
                  <button
                    onClick={() => setShowParticipantForm(true)}
                    className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200"
                  >
                    参加者を追加
                  </button>
                </div>

                {showParticipantForm && (
                  <div className="border border-slate-200 rounded-lg p-3 mb-3 space-y-2 bg-slate-50">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">ユーザー</label>
                      <select
                        value={participantUserId}
                        onChange={(e) => setParticipantUserId(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-sm w-full"
                      >
                        <option value="">選択してください</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">役割</label>
                      <select
                        value={participantRole}
                        onChange={(e) => setParticipantRole(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-sm w-full"
                      >
                        <option value="ATTENDEE">出席者</option>
                        <option value="CHAIRPERSON">議長</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleAddParticipant} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">追加</button>
                      <button onClick={() => setShowParticipantForm(false)} className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded hover:bg-slate-300">キャンセル</button>
                    </div>
                  </div>
                )}

                {selectedReview.participants && selectedReview.participants.length > 0 ? (
                  <div className="space-y-1">
                    {selectedReview.participants.map((p) => (
                      <div key={p.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-900">{p.user.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            p.role === "CHAIRPERSON" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                          }`}>
                            {p.role === "CHAIRPERSON" ? "議長" : "出席者"}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveParticipant(p.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">参加者はまだいません</div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-400">
              左のリストからレビューを選択してください
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
