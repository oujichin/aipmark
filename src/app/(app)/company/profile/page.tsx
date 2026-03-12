"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";

interface OrgProfile {
  id: string;
  name: string;
  code: string;
  industry?: string;
  mainBusiness?: string;
  employeeCount?: string;
  establishedYear?: string;
  capital?: string;
  representative?: string;
  address?: string;
  phone?: string;
  websiteUrl?: string;
  pmarkNumber?: string;
  pmarkExpiry?: string;
  certifyingBody?: string;
  aiProfileSummary?: string;
  aiResearchSources?: Array<{ title: string; url: string }>;
  aiResearchedAt?: string;
  _count?: { users: number; businessProcesses: number };
}

interface SuggestedProcess {
  name: string;
  description: string;
  dataSubjects: string[];
  confidence: string;
  basis: string;
  selected?: boolean;
}

interface Department {
  id: string;
  name: string;
  code: string;
  _count?: { users: number; businessProcesses: number };
}

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: "bg-green-100 text-green-700 border-green-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
  LOW: "bg-slate-100 text-slate-500 border-slate-200",
};
const CONFIDENCE_LABELS: Record<string, string> = { HIGH: "確信度：高", MEDIUM: "確信度：中", LOW: "確信度：低" };

export default function CompanyProfilePage() {
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Partial<OrgProfile>>({});
  const [editMode, setEditMode] = useState(false);

  // AI Research
  const [researchInput, setResearchInput] = useState({ companyName: "", websiteUrl: "" });
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState("");
  const [suggestedProcesses, setSuggestedProcesses] = useState<SuggestedProcess[]>([]);
  const [addingProcesses, setAddingProcesses] = useState(false);
  const [processesAdded, setProcessesAdded] = useState(false);

  // Departments
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: "", code: "" });
  const [savingDept, setSavingDept] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/company/profile").then((r) => r.json()),
      fetch("/api/company/departments").then((r) => r.json()),
    ]).then(([prof, depts]) => {
      setProfile(prof);
      setForm(prof);
      setResearchInput({ companyName: prof.name ?? "", websiteUrl: prof.websiteUrl ?? "" });
      setDepartments(depts);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/company/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const updated = await res.json();
      setProfile({ ...profile, ...updated });
      setSaved(true);
      setEditMode(false);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function handleAiResearch() {
    if (!researchInput.companyName) return;
    setResearching(true);
    setResearchError("");
    setSuggestedProcesses([]);
    setProcessesAdded(false);

    const res = await fetch("/api/ai/company-research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: researchInput.companyName,
        websiteUrl: researchInput.websiteUrl,
        industry: form.industry,
      }),
    });

    const data = await res.json();
    if (data.error) {
      setResearchError(data.error);
    } else {
      // Refresh profile (AI cache updated server-side)
      const refreshed = await fetch("/api/company/profile").then((r) => r.json());
      setProfile(refreshed);
      setForm(refreshed);
      // Set suggested processes with all selected by default
      setSuggestedProcesses((data.suggestedProcesses ?? []).map((p: SuggestedProcess) => ({ ...p, selected: true })));
    }
    setResearching(false);
  }

  async function handleAddProcesses() {
    const selected = suggestedProcesses.filter((p) => p.selected);
    if (selected.length === 0 || departments.length === 0) return;
    setAddingProcesses(true);

    // Use first department as default; user can reassign later
    const defaultDeptId = departments[0].id;

    for (const p of selected) {
      await fetch("/api/register/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name,
          description: `${p.description}（データ主体: ${p.dataSubjects.join("、")}）\n\n推定根拠: ${p.basis}`,
          departmentId: defaultDeptId,
        }),
      });
    }

    setProcessesAdded(true);
    setAddingProcesses(false);
  }

  async function handleAddDept(e: React.FormEvent) {
    e.preventDefault();
    setSavingDept(true);
    const res = await fetch("/api/company/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deptForm),
    });
    if (res.ok) {
      const created = await res.json();
      setDepartments((prev) => [...prev, created]);
      setDeptForm({ name: "", code: "" });
      setShowDeptForm(false);
    }
    setSavingDept(false);
  }

  async function handleDeleteDept(id: string) {
    const res = await fetch(`/api/company/departments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDepartments((prev) => prev.filter((d) => d.id !== id));
    } else {
      const err = await res.json();
      alert(err.error);
    }
  }

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">読み込み中...</div>;
  if (!profile) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="会社プロファイル"
        description="組織の基本情報を管理します。AI + Google検索で自動入力し、業務プロセスを自動提案できます。"
      />

      {/* ── AI Research Panel ─────────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-white text-sm">✨</span>
          </div>
          <div>
            <p className="text-sm font-bold text-blue-900">AI + Google検索で会社情報を自動入力</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Gemini が Google 検索で会社を調査し、基本情報の自動入力と業務プロセスの自動提案を行います。
            </p>
          </div>
        </div>

        <div className="flex gap-3 mb-3">
          <input
            className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="会社名 *"
            value={researchInput.companyName}
            onChange={(e) => setResearchInput({ ...researchInput, companyName: e.target.value })}
          />
          <input
            className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="WebサイトURL（任意）"
            value={researchInput.websiteUrl}
            onChange={(e) => setResearchInput({ ...researchInput, websiteUrl: e.target.value })}
          />
          <button
            onClick={handleAiResearch}
            disabled={researching || !researchInput.companyName}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0 transition-colors"
          >
            {researching ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                調査中...
              </span>
            ) : "Google検索で調査"}
          </button>
        </div>

        {researchError && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{researchError}</p>
        )}

        {/* AI Profile Summary */}
        {profile.aiProfileSummary && (
          <div className="mt-3 bg-white/70 rounded-xl p-3 border border-blue-100">
            <p className="text-xs font-medium text-blue-700 mb-1">
              AI調査サマリー
              {profile.aiResearchedAt && (
                <span className="text-blue-400 font-normal ml-2">
                  {new Date(profile.aiResearchedAt).toLocaleDateString("ja-JP")} 調査
                </span>
              )}
            </p>
            <p className="text-xs text-slate-700 leading-relaxed">{profile.aiProfileSummary}</p>
            {profile.aiResearchSources && profile.aiResearchSources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {profile.aiResearchSources.map((s, i) => (
                  s.url ? (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-700 underline bg-blue-50 px-2 py-0.5 rounded">
                      {s.title || s.url}
                    </a>
                  ) : null
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Suggested Processes ───────────────────────────────── */}
      {suggestedProcesses.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">業務プロセスの自動提案</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                AIが提案する個人情報を取り扱う業務プロセスです。チェックして一括追加できます。
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSuggestedProcesses((prev) => prev.map((p) => ({ ...p, selected: true })))}
                className="text-xs text-blue-600 hover:text-blue-700"
              >全選択</button>
              <span className="text-slate-200">|</span>
              <button
                onClick={() => setSuggestedProcesses((prev) => prev.map((p) => ({ ...p, selected: false })))}
                className="text-xs text-slate-400 hover:text-slate-600"
              >全解除</button>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {suggestedProcesses.map((p, i) => (
              <label key={i}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  p.selected ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-100"
                }`}
              >
                <input
                  type="checkbox"
                  checked={p.selected ?? true}
                  onChange={(e) => setSuggestedProcesses((prev) =>
                    prev.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x)
                  )}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800">{p.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${CONFIDENCE_COLORS[p.confidence] ?? CONFIDENCE_COLORS.LOW}`}>
                      {CONFIDENCE_LABELS[p.confidence] ?? p.confidence}
                    </span>
                    {p.dataSubjects.map((ds) => (
                      <span key={ds} className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{ds}</span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5 italic">根拠: {p.basis}</p>
                </div>
              </label>
            ))}
          </div>

          {processesAdded ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-sm text-green-700 font-medium">
                {suggestedProcesses.filter((p) => p.selected).length}件の業務プロセスを追加しました
              </p>
              <a href="/register/processes" className="text-xs text-green-600 hover:underline mt-1 block">
                → 業務プロセス一覧で確認する
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleAddProcesses}
                disabled={addingProcesses || suggestedProcesses.filter((p) => p.selected).length === 0 || departments.length === 0}
                className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {addingProcesses
                  ? "追加中..."
                  : `選択した${suggestedProcesses.filter((p) => p.selected).length}件を業務プロセスに追加`}
              </button>
              {departments.length === 0 && (
                <p className="text-xs text-red-500">先に部門を1件以上追加してください</p>
              )}
              <p className="text-xs text-slate-400">担当部門は後から変更できます</p>
            </div>
          )}
        </div>
      )}

      {/* ── Organization Info ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-slate-800">会社基本情報</h2>
          {!editMode ? (
            <button onClick={() => setEditMode(true)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              編集
            </button>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => { setEditMode(false); setForm(profile); }} className="text-xs text-slate-500">
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          )}
        </div>

        {saved && (
          <div className="mb-4 text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg">保存しました</div>
        )}

        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {[
            { key: "name", label: "法人名 *", required: true },
            { key: "industry", label: "業種" },
            { key: "mainBusiness", label: "主要事業内容", wide: true },
            { key: "employeeCount", label: "従業員規模" },
            { key: "establishedYear", label: "設立年" },
            { key: "capital", label: "資本金" },
            { key: "representative", label: "代表者名" },
            { key: "address", label: "所在地", wide: true },
            { key: "phone", label: "電話番号" },
            { key: "websiteUrl", label: "WebサイトURL" },
          ].map(({ key, label, wide, required }) => (
            <div key={key} className={wide ? "col-span-2" : ""}>
              <label className="block text-xs text-slate-500 mb-1">
                {label}{required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {editMode ? (
                key === "mainBusiness" ? (
                  <textarea
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2}
                    value={(form as unknown as Record<string, string>)[key] ?? ""}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                ) : (
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={(form as unknown as Record<string, string>)[key] ?? ""}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                )
              ) : (
                <p className={`text-sm ${(profile as unknown as Record<string, string>)[key] ? "text-slate-800" : "text-slate-300 italic"}`}>
                  {(profile as unknown as Record<string, string>)[key] || "未入力"}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100">
          <h3 className="text-xs font-semibold text-slate-600 mb-4">Pマーク管理情報</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: "pmarkNumber", label: "Pマーク番号" },
              { key: "certifyingBody", label: "審査機関" },
              { key: "pmarkExpiry", label: "有効期限", type: "date" },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-xs text-slate-500 mb-1">{label}</label>
                {editMode ? (
                  <input
                    type={type ?? "text"}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={(form as unknown as Record<string, string>)[key] ?? ""}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                ) : (
                  <p className={`text-sm ${(profile as unknown as Record<string, string>)[key] ? "text-slate-800" : "text-slate-300 italic"}`}>
                    {key === "pmarkExpiry" && (profile as unknown as Record<string, string>)[key]
                      ? new Date((profile as unknown as Record<string, string>)[key]).toLocaleDateString("ja-JP")
                      : (profile as unknown as Record<string, string>)[key] || "未入力"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Departments ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">部門管理</h2>
            <p className="text-xs text-slate-500 mt-0.5">{departments.length}部門登録済み</p>
          </div>
          <button
            onClick={() => setShowDeptForm(true)}
            className="text-xs px-3 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium"
          >
            + 部門追加
          </button>
        </div>

        {showDeptForm && (
          <form onSubmit={handleAddDept} className="flex gap-3 mb-4 p-3 bg-slate-50 rounded-xl">
            <input
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="部門名 *"
              value={deptForm.name}
              onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
              required
            />
            <input
              className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="コード"
              value={deptForm.code}
              onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
            />
            <button type="submit" disabled={savingDept}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              追加
            </button>
            <button type="button" onClick={() => setShowDeptForm(false)}
              className="px-3 py-2 text-slate-500 text-sm hover:text-slate-700">
              ✕
            </button>
          </form>
        )}

        <div className="grid grid-cols-2 gap-2">
          {departments.map((dept) => (
            <div key={dept.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 group">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                {dept.code?.slice(0, 3)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{dept.name}</p>
                <p className="text-xs text-slate-400">
                  業務プロセス {dept._count?.businessProcesses ?? 0}件
                </p>
              </div>
              <button
                onClick={() => handleDeleteDept(dept.id)}
                className="text-slate-200 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                title="削除"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
