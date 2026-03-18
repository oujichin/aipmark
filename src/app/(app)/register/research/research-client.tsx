"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

// ────────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────────
interface ResearchSource {
  id: string;
  sourceType: string;
  url: string | null;
  title: string;
  snippet: string | null;
  relevanceNote: string | null;
  createdAt: string;
}

interface InterviewHypothesis {
  id: string;
  topic: string;
  question: string;
  hypothesis: string | null;
  confidenceLevel: string;
  priority: number;
  basis: string | null;
  answered: boolean;
  answer: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ResearchProfile {
  id: string;
  companyOverview: string | null;
  industryType: string | null;
  employeeCount: string | null;
  mainServices: string | null;
  dataSubjectsEst: string | null;
  systemsEst: string | null;
  rawNotes: string | null;
  aiSummary: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  researchSources: ResearchSource[];
  interviewHypotheses: InterviewHypothesis[];
}

interface SourceDraft {
  sourceType: string;
  url: string;
  title: string;
  snippet: string;
  relevanceNote: string;
}

interface HypothesisDraft {
  topic: string;
  question: string;
  hypothesis: string;
  confidenceLevel: string;
  priority: number;
  basis: string;
}

interface ProfileForm {
  companyOverview: string;
  industryType: string;
  employeeCount: string;
  mainServices: string;
  dataSubjectsEst: string;
  systemsEst: string;
  rawNotes: string;
  status: string;
}

type ViewMode = "list" | "create" | "detail";

// ────────────────────────────────────────────────────────────────
// 定数
// ────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "下書き", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  IN_PROGRESS: { label: "調査中", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  CONFIRMED: { label: "確定", cls: "bg-green-100 text-green-700 border-green-200" },
};

const CONFIDENCE_CONFIG: Record<string, { label: string; cls: string }> = {
  HIGH: { label: "高", cls: "bg-green-100 text-green-700" },
  MEDIUM: { label: "中", cls: "bg-yellow-100 text-yellow-700" },
  LOW: { label: "低", cls: "bg-slate-100 text-slate-500" },
};

const SOURCE_TYPES = [
  "Webサイト",
  "採用ページ",
  "プレスリリース",
  "決算資料",
  "業界レポート",
  "その他",
];

const EMPTY_SOURCE: SourceDraft = {
  sourceType: "Webサイト",
  url: "",
  title: "",
  snippet: "",
  relevanceNote: "",
};

const EMPTY_FORM: ProfileForm = {
  companyOverview: "",
  industryType: "",
  employeeCount: "",
  mainServices: "",
  dataSubjectsEst: "",
  systemsEst: "",
  rawNotes: "",
  status: "DRAFT",
};

// ────────────────────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────────────────────
export default function ResearchClient({
  initialProfiles,
}: {
  initialProfiles: ResearchProfile[];
}) {
  const [profiles, setProfiles] = useState<ResearchProfile[]>(initialProfiles);
  const [view, setView] = useState<ViewMode>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  // 新規作成フォーム
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [sources, setSources] = useState<SourceDraft[]>([]);
  const [saving, setSaving] = useState(false);

  // 詳細画面
  const [editForm, setEditForm] = useState<ProfileForm>(EMPTY_FORM);
  const [editHypotheses, setEditHypotheses] = useState<HypothesisDraft[]>([]);
  const [addingSource, setAddingSource] = useState(false);
  const [newSource, setNewSource] = useState<SourceDraft>(EMPTY_SOURCE);
  const [aiLoading, setAiLoading] = useState(false);

  const selectedProfile = profiles.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(t);
  }, [message]);

  function showMessage(text: string, type: "success" | "error" = "success") {
    setMessage(text);
    setMessageType(type);
  }

  // ── データ再読み込み ──
  async function reloadProfiles() {
    const res = await fetch("/api/register/research");
    if (res.ok) {
      const data = await res.json();
      setProfiles(data);
    }
  }

  // ── 新規作成 ──
  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch("/api/register/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          companyOverview: form.companyOverview || null,
          industryType: form.industryType || null,
          employeeCount: form.employeeCount || null,
          mainServices: form.mainServices || null,
          dataSubjectsEst: form.dataSubjectsEst || null,
          systemsEst: form.systemsEst || null,
          rawNotes: form.rawNotes || null,
          sources: sources.filter((s) => s.title.trim()),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "作成に失敗しました" }));
        showMessage(err.error ?? "作成に失敗しました", "error");
        return;
      }
      const created = await res.json();
      setProfiles((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setSources([]);
      showMessage("調査プロファイルを作成しました");
      openDetail(created.id);
    } catch {
      showMessage("作成に失敗しました", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── 詳細画面を開く ──
  function openDetail(id: string) {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    setSelectedId(id);
    setEditForm({
      companyOverview: p.companyOverview ?? "",
      industryType: p.industryType ?? "",
      employeeCount: p.employeeCount ?? "",
      mainServices: p.mainServices ?? "",
      dataSubjectsEst: p.dataSubjectsEst ?? "",
      systemsEst: p.systemsEst ?? "",
      rawNotes: p.rawNotes ?? "",
      status: p.status,
    });
    setEditHypotheses(
      p.interviewHypotheses.map((h) => ({
        topic: h.topic,
        question: h.question,
        hypothesis: h.hypothesis ?? "",
        confidenceLevel: h.confidenceLevel,
        priority: h.priority,
        basis: h.basis ?? "",
      }))
    );
    setView("detail");
  }

  // ── プロファイル更新 ──
  async function handleUpdate() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/register/research", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedId,
          companyOverview: editForm.companyOverview || null,
          industryType: editForm.industryType || null,
          employeeCount: editForm.employeeCount || null,
          mainServices: editForm.mainServices || null,
          dataSubjectsEst: editForm.dataSubjectsEst || null,
          systemsEst: editForm.systemsEst || null,
          rawNotes: editForm.rawNotes || null,
          status: editForm.status,
          hypotheses: editHypotheses.filter((h) => h.topic.trim() && h.question.trim()),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "更新に失敗しました" }));
        showMessage(err.error ?? "更新に失敗しました", "error");
        return;
      }
      await reloadProfiles();
      showMessage("プロファイルを更新しました");
    } catch {
      showMessage("更新に失敗しました", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── ソース追加 ──
  async function handleAddSource() {
    if (!selectedId || !newSource.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/register/research", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedId,
          newSources: [{
            sourceType: newSource.sourceType,
            url: newSource.url || undefined,
            title: newSource.title,
            snippet: newSource.snippet || undefined,
            relevanceNote: newSource.relevanceNote || undefined,
          }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "ソース追加に失敗しました" }));
        showMessage(err.error ?? "ソース追加に失敗しました", "error");
        return;
      }
      await reloadProfiles();
      showMessage("ソースを追加しました");
      setAddingSource(false);
      setNewSource(EMPTY_SOURCE);
    } catch {
      showMessage("ソース追加に失敗しました", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── AI要約生成 ──
  async function handleAiSummarize() {
    if (!selectedProfile) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/research-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: selectedProfile.companyOverview ?? "不明",
          industry: selectedProfile.industryType ?? undefined,
          sources: selectedProfile.researchSources.map((s) => ({
            sourceType: s.sourceType,
            title: s.title,
            snippet: s.snippet ?? undefined,
          })),
        }),
      });
      if (!res.ok) {
        showMessage("AI要約の生成に失敗しました", "error");
        return;
      }
      const data = await res.json();
      if (data.profile) {
        // AI結果をフォームに反映
        setEditForm((prev) => ({
          ...prev,
          companyOverview: data.profile.companyOverview ?? prev.companyOverview,
          industryType: data.profile.industryType ?? prev.industryType,
          employeeCount: data.profile.employeeCount ?? prev.employeeCount,
          mainServices: data.profile.mainServices ?? prev.mainServices,
          dataSubjectsEst: data.profile.dataSubjectsEst ?? prev.dataSubjectsEst,
          systemsEst: data.profile.systemsEst ?? prev.systemsEst,
        }));
        // aiSummaryもPUTで保存
        await fetch("/api/register/research", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selectedId,
            aiSummary: data.profile.aiSummary ?? null,
          }),
        });
        await reloadProfiles();
        showMessage("AI要約を生成し反映しました");
      }
    } catch {
      showMessage("AI要約の生成に失敗しました", "error");
    } finally {
      setAiLoading(false);
    }
  }

  // ── 仮説を追加 ──
  function addHypothesis() {
    setEditHypotheses((prev) => [
      ...prev,
      {
        topic: "",
        question: "",
        hypothesis: "",
        confidenceLevel: "LOW",
        priority: prev.length + 1,
        basis: "",
      },
    ]);
  }

  function removeHypothesis(index: number) {
    setEditHypotheses((prev) => prev.filter((_, i) => i !== index));
  }

  function updateHypothesis(index: number, field: keyof HypothesisDraft, value: string | number) {
    setEditHypotheses((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: value } : h))
    );
  }

  // ────────────────────────────────────────────────────────────────
  // 通知バナー
  // ────────────────────────────────────────────────────────────────
  const messageBanner = message ? (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
        messageType === "success"
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </div>
  ) : null;

  // ────────────────────────────────────────────────────────────────
  // 一覧ビュー
  // ────────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div>
        <PageHeader
          title="事前調査プロファイル"
          description="ヒアリング・台帳整備の前提となる企業情報と調査結果を管理します。"
          actions={
            <button
              onClick={() => {
                setForm(EMPTY_FORM);
                setSources([]);
                setView("create");
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + 新規プロファイル
            </button>
          }
        />
        {messageBanner}

        {profiles.length === 0 ? (
          <EmptyState
            title="調査プロファイルがありません"
            description="「新規プロファイル」から事前調査を開始してください。企業の公開情報や業務実態の仮説を整理できます。"
            icon="🔍"
          />
        ) : (
          <div className="space-y-3">
            {profiles.map((p) => {
              const st = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.DRAFT;
              return (
                <button
                  key={p.id}
                  onClick={() => openDetail(p.id)}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-800 truncate">
                          {p.companyOverview
                            ? p.companyOverview.slice(0, 60) + (p.companyOverview.length > 60 ? "..." : "")
                            : "（未入力）"}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        {p.industryType && <span>{p.industryType}</span>}
                        {p.employeeCount && <span>{p.employeeCount}</span>}
                        <span>ソース: {p.researchSources.length}件</span>
                        <span>仮説: {p.interviewHypotheses.length}件</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 shrink-0 ml-4">
                      {new Date(p.updatedAt).toLocaleDateString("ja-JP")}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // 新規作成ビュー
  // ────────────────────────────────────────────────────────────────
  if (view === "create") {
    return (
      <div>
        <PageHeader
          title="調査プロファイル新規作成"
          description="対象企業の基本情報と調査ソースを登録します。"
        />
        {messageBanner}

        <div className="space-y-6">
          {/* 基本情報 */}
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">企業基本情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">会社概要</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  placeholder="事業内容の概要を入力..."
                  value={form.companyOverview}
                  onChange={(e) => setForm({ ...form, companyOverview: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">業種</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 情報通信業"
                  value={form.industryType}
                  onChange={(e) => setForm({ ...form, industryType: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">従業員規模</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 50〜100名"
                  value={form.employeeCount}
                  onChange={(e) => setForm({ ...form, employeeCount: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">主なサービス・製品</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                  placeholder="主要なサービスや製品を入力..."
                  value={form.mainServices}
                  onChange={(e) => setForm({ ...form, mainServices: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">想定データ主体</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 顧客、従業員、取引先担当者"
                  value={form.dataSubjectsEst}
                  onChange={(e) => setForm({ ...form, dataSubjectsEst: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">想定システム</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: CRM、勤怠管理、メール"
                  value={form.systemsEst}
                  onChange={(e) => setForm({ ...form, systemsEst: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">メモ</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                  placeholder="自由メモ（任意）..."
                  value={form.rawNotes}
                  onChange={(e) => setForm({ ...form, rawNotes: e.target.value })}
                />
              </div>
            </div>
          </section>

          {/* 調査ソース */}
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-800">調査ソース</h2>
              <button
                onClick={() => setSources([...sources, { ...EMPTY_SOURCE }])}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                + ソース追加
              </button>
            </div>
            {sources.length === 0 ? (
              <p className="text-xs text-slate-400">まだソースが登録されていません。</p>
            ) : (
              <div className="space-y-4">
                {sources.map((s, i) => (
                  <div key={i} className="border border-slate-100 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={s.sourceType}
                        onChange={(e) => {
                          const next = [...sources];
                          next[i] = { ...next[i], sourceType: e.target.value };
                          setSources(next);
                        }}
                      >
                        {SOURCE_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="タイトル"
                        value={s.title}
                        onChange={(e) => {
                          const next = [...sources];
                          next[i] = { ...next[i], title: e.target.value };
                          setSources(next);
                        }}
                      />
                      <button
                        onClick={() => setSources(sources.filter((_, j) => j !== i))}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        削除
                      </button>
                    </div>
                    <input
                      type="url"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="URL（任意）"
                      value={s.url}
                      onChange={(e) => {
                        const next = [...sources];
                        next[i] = { ...next[i], url: e.target.value };
                        setSources(next);
                      }}
                    />
                    <textarea
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={2}
                      placeholder="要約・抜粋（任意）"
                      value={s.snippet}
                      onChange={(e) => {
                        const next = [...sources];
                        next[i] = { ...next[i], snippet: e.target.value };
                        setSources(next);
                      }}
                    />
                    <input
                      type="text"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="関連メモ（任意）"
                      value={s.relevanceNote}
                      onChange={(e) => {
                        const next = [...sources];
                        next[i] = { ...next[i], relevanceNote: e.target.value };
                        setSources(next);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* アクション */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setView("list")}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← 一覧に戻る
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "作成中..." : "プロファイルを作成"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // 詳細・編集ビュー
  // ────────────────────────────────────────────────────────────────
  // selectedProfileをリロード後にも追従
  const currentProfile = profiles.find((p) => p.id === selectedId) ?? null;

  return (
    <div>
      <PageHeader
        title="調査プロファイル詳細"
        description="企業情報の編集、調査ソース管理、ヒアリング仮説の確認・編集を行います。"
        actions={
          <div className="flex items-center gap-2">
            <select
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
            >
              <option value="DRAFT">下書き</option>
              <option value="IN_PROGRESS">調査中</option>
              <option value="CONFIRMED">確定</option>
            </select>
            <button
              onClick={handleAiSummarize}
              disabled={aiLoading}
              className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {aiLoading ? "AI分析中..." : "AI要約生成"}
            </button>
          </div>
        }
      />
      {messageBanner}

      <div className="space-y-6">
        {/* AI要約 */}
        {currentProfile?.aiSummary && (
          <section className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-amber-800 mb-2">AI要約</h2>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{currentProfile.aiSummary}</p>
          </section>
        )}

        {/* 基本情報編集 */}
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">企業基本情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">会社概要</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                value={editForm.companyOverview}
                onChange={(e) => setEditForm({ ...editForm, companyOverview: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">業種</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editForm.industryType}
                onChange={(e) => setEditForm({ ...editForm, industryType: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">従業員規模</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editForm.employeeCount}
                onChange={(e) => setEditForm({ ...editForm, employeeCount: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">主なサービス・製品</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                value={editForm.mainServices}
                onChange={(e) => setEditForm({ ...editForm, mainServices: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">想定データ主体</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editForm.dataSubjectsEst}
                onChange={(e) => setEditForm({ ...editForm, dataSubjectsEst: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">想定システム</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editForm.systemsEst}
                onChange={(e) => setEditForm({ ...editForm, systemsEst: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">メモ</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                value={editForm.rawNotes}
                onChange={(e) => setEditForm({ ...editForm, rawNotes: e.target.value })}
              />
            </div>
          </div>
        </section>

        {/* 調査ソース一覧 */}
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-800">
              調査ソース ({currentProfile?.researchSources.length ?? 0}件)
            </h2>
            <button
              onClick={() => {
                setAddingSource(true);
                setNewSource({ ...EMPTY_SOURCE });
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              + ソース追加
            </button>
          </div>

          {addingSource && (
            <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-3 mb-4 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={newSource.sourceType}
                  onChange={(e) => setNewSource({ ...newSource, sourceType: e.target.value })}
                >
                  {SOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input
                  type="text"
                  className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="タイトル *"
                  value={newSource.title}
                  onChange={(e) => setNewSource({ ...newSource, title: e.target.value })}
                />
              </div>
              <input
                type="url"
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="URL（任意）"
                value={newSource.url}
                onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
              />
              <textarea
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                placeholder="要約・抜粋（任意）"
                value={newSource.snippet}
                onChange={(e) => setNewSource({ ...newSource, snippet: e.target.value })}
              />
              <input
                type="text"
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="関連メモ（任意）"
                value={newSource.relevanceNote}
                onChange={(e) => setNewSource({ ...newSource, relevanceNote: e.target.value })}
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setAddingSource(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddSource}
                  disabled={!newSource.title.trim()}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  追加
                </button>
              </div>
            </div>
          )}

          {(!currentProfile || currentProfile.researchSources.length === 0) ? (
            <p className="text-xs text-slate-400">まだソースが登録されていません。</p>
          ) : (
            <div className="space-y-2">
              {currentProfile.researchSources.map((s) => (
                <div key={s.id} className="border border-slate-100 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {s.sourceType}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{s.title}</span>
                  </div>
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline break-all"
                    >
                      {s.url}
                    </a>
                  )}
                  {s.snippet && (
                    <p className="text-xs text-slate-500 mt-1">{s.snippet}</p>
                  )}
                  {s.relevanceNote && (
                    <p className="text-xs text-slate-400 mt-1 italic">{s.relevanceNote}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ヒアリング仮説 */}
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-800">
              ヒアリング仮説 ({editHypotheses.length}件)
            </h2>
            <button
              onClick={addHypothesis}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              + 仮説追加
            </button>
          </div>

          {editHypotheses.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-slate-400 mb-2">仮説がまだありません。</p>
              <p className="text-xs text-slate-400">AI要約生成後、自動で仮説が追加されるか、手動で追加できます。</p>
            </div>
          ) : (
            <div className="space-y-4">
              {editHypotheses.map((h, i) => (
                <div key={i} className="border border-slate-100 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono">#{i + 1}</span>
                    <select
                      className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={h.confidenceLevel}
                      onChange={(e) => updateHypothesis(i, "confidenceLevel", e.target.value)}
                    >
                      <option value="HIGH">確信度: 高</option>
                      <option value="MEDIUM">確信度: 中</option>
                      <option value="LOW">確信度: 低</option>
                    </select>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        CONFIDENCE_CONFIG[h.confidenceLevel]?.cls ?? "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {CONFIDENCE_CONFIG[h.confidenceLevel]?.label ?? h.confidenceLevel}
                    </span>
                    <input
                      type="number"
                      className="w-16 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="優先度"
                      value={h.priority}
                      onChange={(e) => updateHypothesis(i, "priority", parseInt(e.target.value) || 1)}
                    />
                    <div className="flex-1" />
                    <button
                      onClick={() => removeHypothesis(i)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      削除
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">確認論点</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="例: 個人情報管理体制"
                      value={h.topic}
                      onChange={(e) => updateHypothesis(i, "topic", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">ヒアリング質問</label>
                    <textarea
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={2}
                      placeholder="具体的な質問を入力..."
                      value={h.question}
                      onChange={(e) => updateHypothesis(i, "question", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">仮説</label>
                    <textarea
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={2}
                      placeholder="仮説の内容..."
                      value={h.hypothesis}
                      onChange={(e) => updateHypothesis(i, "hypothesis", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">根拠</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="仮説の根拠（任意）"
                      value={h.basis}
                      onChange={(e) => updateHypothesis(i, "basis", e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* アクション */}
        <div className="flex items-center justify-between pb-8">
          <button
            onClick={() => {
              setView("list");
              setSelectedId(null);
            }}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← 一覧に戻る
          </button>
          <div className="flex items-center gap-3">
            <a
              href={`/register/hearing`}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              ヒアリングへ進む →
            </a>
            <button
              onClick={handleUpdate}
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "保存中..." : "プロファイルを保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
