"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { buildPersonalDataMasterMaps, formatCodes, type DataFieldMasterRecord, type MasterRecord } from "@/lib/personal-data";

interface Process { id: string; name: string; description: string; }
interface Hypothesis { id: string; topic: string; question: string; hypothesis?: string; confidenceLevel: string; priority: number; answered: boolean; answer?: string; }
interface Candidate {
  dataSubject: string;
  dataCategoryCodes: string[];
  dataFieldCodes: string[];
  purpose: string;
  legalBasis: string;
  retentionPeriod: string;
  storageLocation: string;
  thirdPartyProvision?: string;
  confirmationStatus?: string;
  inferenceBasis?: string;
}
interface HearingRecord {
  id: string;
  status: string;
  answers: {
    generalAnswers?: Record<string, string>;
    hypothesisAnswers?: Record<string, string>;
  } | Record<string, string>;
  aiCandidates?: Candidate[] | null;
}

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  HIGH: { label: "高", color: "bg-green-100 text-green-700" },
  MEDIUM: { label: "中", color: "bg-yellow-100 text-yellow-700" },
  LOW: { label: "低", color: "bg-slate-100 text-slate-500" },
};

const HEARING_QUESTIONS = [
  "このプロセスでは、どのような個人情報を取得・利用していますか？",
  "データ主体（情報を提供する人）は誰ですか？（顧客・従業員・取引先等）",
  "個人情報はどのシステム・ツール・媒体に保存していますか？",
  "個人情報を第三者（委託先含む）に提供することはありますか？",
  "情報の保存期間・廃棄ルールは設定されていますか？",
];

function HearingContent() {
  const searchParams = useSearchParams();
  const processId = searchParams.get("processId") ?? "";

  const [process, setProcess] = useState<Process | null>(null);
  const [categories, setCategories] = useState<MasterRecord[]>([]);
  const [fields, setFields] = useState<DataFieldMasterRecord[]>([]);
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hypothesisAnswers, setHypothesisAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"hypotheses" | "hearing" | "candidates">("hypotheses");
  const [generatingHypotheses, setGeneratingHypotheses] = useState(false);
  const [generatingCandidates, setGeneratingCandidates] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingSavedHearing, setLoadingSavedHearing] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!processId) return;
    Promise.all([
      fetch("/api/register/processes").then((r) => r.json()),
      fetch(`/api/register/hearing?processId=${processId}`).then((r) => r.json()),
      fetch("/api/master/data-categories").then((r) => r.json()),
      fetch("/api/master/data-fields").then((r) => r.json()),
    ])
      .then(([procs, hearingRows, categoryRows, fieldRows]: [Process[], HearingRecord[], MasterRecord[], DataFieldMasterRecord[]]) => {
        const p = procs.find((x) => x.id === processId);
        if (p) setProcess(p);
        setCategories(categoryRows);
        setFields(fieldRows);

        const existing = hearingRows[0];
        if (existing?.answers) {
          if (
            typeof existing.answers === "object" &&
            ("generalAnswers" in existing.answers || "hypothesisAnswers" in existing.answers)
          ) {
            setAnswers(
              typeof existing.answers.generalAnswers === "object" && existing.answers.generalAnswers
                ? existing.answers.generalAnswers
                : {}
            );
            setHypothesisAnswers(
              typeof existing.answers.hypothesisAnswers === "object" && existing.answers.hypothesisAnswers
                ? existing.answers.hypothesisAnswers
                : {}
            );
          } else {
            setAnswers(existing.answers as Record<string, string>);
          }
        }

        if (existing?.aiCandidates?.length) {
          setCandidates(existing.aiCandidates);
        }
      })
      .finally(() => setLoadingSavedHearing(false));
  }, [processId]);

  useEffect(() => {
    if (!saveMessage) return;
    const timeoutId = window.setTimeout(() => setSaveMessage(""), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [saveMessage]);

  async function persistHearing(status: "DRAFT" | "SUBMITTED", nextCandidates?: Candidate[]) {
    if (!process) return false;

    const res = await fetch("/api/register/hearing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessProcessId: process.id,
        status,
        answers: {
          generalAnswers: answers,
          hypothesisAnswers,
        },
        aiCandidates: nextCandidates,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "ヒアリングの保存に失敗しました。" }));
      throw new Error(data.error ?? "ヒアリングの保存に失敗しました。");
    }

    return true;
  }

  async function handleSaveDraft() {
    try {
      setSaving(true);
      await persistHearing("DRAFT");
      setSaveMessage("ヒアリング内容を保存しました。");
    } catch (error) {
      alert(error instanceof Error ? error.message : "ヒアリングの保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function generateHypotheses() {
    if (!process) return;
    setGeneratingHypotheses(true);
    try {
      const res = await fetch("/api/ai/interview-hypotheses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: "デモ株式会社",
          profile: { industryType: "情報通信業", companyOverview: "中規模のIT企業" },
          processName: process.name,
          processDescription: process.description,
        }),
      });
      const data = await res.json();
      if (data.hypotheses) {
        setHypotheses(data.hypotheses.map((h: Hypothesis, i: number) => ({ ...h, id: `hyp-${i}`, answered: false })));
      }
    } catch {
      alert("AI仮説生成に失敗しました。APIキーを確認してください。");
    }
    setGeneratingHypotheses(false);
  }

  async function generateCandidates() {
    if (!process) return;
    setGeneratingCandidates(true);
    try {
      const combinedAnswers: Record<string, string> = { ...answers };
      hypotheses.forEach((h) => {
        if (hypothesisAnswers[h.id]) {
          combinedAnswers[h.question] = hypothesisAnswers[h.id];
        }
      });

      const res = await fetch("/api/ai/register-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processName: process.name,
          processDescription: process.description,
          hearingAnswers: combinedAnswers,
          hypotheses: hypotheses.map((h) => ({ topic: h.topic, answer: hypothesisAnswers[h.id] })),
        }),
      });
      const data = await res.json();
      if (data.candidates) {
        setCandidates(data.candidates);
        await persistHearing("SUBMITTED", data.candidates);
        setSaveMessage("ヒアリング内容を保存し、台帳候補を生成しました。");
        setStep("candidates");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "AI台帳候補生成に失敗しました。");
    }
    setGeneratingCandidates(false);
  }

  async function saveToRegister() {
    if (!process) return;
    setSaving(true);
    for (const c of candidates) {
      await fetch("/api/register/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...c, businessProcessId: process.id }),
      });
    }
    setSaving(false);
    setSaved(true);
  }

  if (!processId) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-sm">業務プロセスを選択してください。</p>
        <a href="/register/processes" className="text-blue-600 text-sm hover:underline mt-2 block">
          → 業務プロセス一覧へ
        </a>
      </div>
    );
  }

  const { categoriesByCode, fieldsByCode } = buildPersonalDataMasterMaps(categories, fields);

  return (
    <div>
      <PageHeader
        title="ヒアリング・台帳候補生成"
        description={process ? `${process.name} のヒアリングを実施し、AI支援で台帳候補を生成します。` : ""}
      />

      {saveMessage && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {saveMessage}
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {(["hypotheses", "hearing", "candidates"] as const).map((s, i) => {
          const labels = ["① AI仮説確認", "② ヒアリング入力", "③ 台帳候補確認"];
          const isActive = step === s;
          const isDone = (step === "hearing" && s === "hypotheses") || (step === "candidates" && s !== "candidates");
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${isActive ? "bg-blue-600 text-white" : isDone ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                {labels[i]}
              </div>
              {i < 2 && <div className="w-6 h-px bg-slate-200" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: AI Hypotheses */}
      {step === "hypotheses" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-medium text-amber-800 mb-1">AI仮説生成について</p>
            <p className="text-xs text-amber-700">
              業務プロセスの説明をもとに、Gemini がヒアリング前に確認すべき論点と仮説を生成します。
              仮説に答えながらヒアリングを進めると、より精度の高い台帳候補が生成されます。
            </p>
          </div>

          {hypotheses.length === 0 ? (
            <div className="text-center py-8">
              <button
                onClick={generateHypotheses}
                disabled={generatingHypotheses || !process}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {generatingHypotheses ? "AI仮説を生成中..." : "✨ AI仮説を生成する"}
              </button>
              <p className="text-xs text-slate-400 mt-3">Gemini APIを使用します（数秒かかります）</p>
            </div>
          ) : (
            <div className="space-y-3">
              {hypotheses.map((h) => (
                <div key={h.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${CONFIDENCE_LABELS[h.confidenceLevel]?.color ?? "bg-slate-100 text-slate-500"}`}>
                      確信度:{CONFIDENCE_LABELS[h.confidenceLevel]?.label ?? h.confidenceLevel}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800 mb-1">{h.question}</p>
                      {h.hypothesis && (
                        <p className="text-xs text-slate-500 italic mb-2">AI仮説: {h.hypothesis}</p>
                      )}
                      <textarea
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        rows={2}
                        placeholder="仮説に対する確認結果を入力（任意）..."
                        value={hypothesisAnswers[h.id] ?? ""}
                        onChange={(e) => setHypothesisAnswers({ ...hypothesisAnswers, [h.id]: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex justify-end">
                <button
                  onClick={() => setStep("hearing")}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  次へ: ヒアリング入力 →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Hearing Questions */}
      {step === "hearing" && (
        <div className="space-y-4">
          {loadingSavedHearing && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
              保存済みヒアリングを読み込んでいます...
            </div>
          )}
          {HEARING_QUESTIONS.map((q) => (
            <div key={q} className="bg-white rounded-xl border border-slate-200 p-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">{q}</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                value={answers[q] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [q]: e.target.value })}
                placeholder="回答を入力..."
              />
            </div>
          ))}
          <div className="flex justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setStep("hypotheses")} className="text-sm text-slate-500 hover:text-slate-700">
                ← 戻る
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                {saving ? "保存中..." : "ヒアリングを保存"}
              </button>
            </div>
            <button
              onClick={generateCandidates}
              disabled={generatingCandidates}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {generatingCandidates ? "AI台帳候補を生成中..." : "✨ 保存して台帳候補を生成"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Candidates */}
      {step === "candidates" && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm font-medium text-green-800 mb-1">台帳候補が生成されました</p>
            <p className="text-xs text-green-700">内容を確認し、「台帳に追加」ボタンで正式な台帳に登録してください。登録後は台帳一覧で編集・承認申請が可能です。</p>
          </div>

          {candidates.map((c, i) => (
            <div key={i} className={`bg-white rounded-xl border p-4 ${c.confirmationStatus === "INFERRED" ? "border-yellow-200 bg-yellow-50/30" : "border-slate-200"}`}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-slate-800">{c.dataSubject}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  c.confirmationStatus === "CONFIRMED" ? "bg-green-100 text-green-700" :
                  c.confirmationStatus === "INFERRED" ? "bg-yellow-100 text-yellow-700" :
                  "bg-slate-100 text-slate-500"
                }`}>
                  {c.confirmationStatus === "CONFIRMED" ? "確定" : c.confirmationStatus === "INFERRED" ? "推定" : "未確認"}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div><dt className="text-slate-400 mb-0.5">個人情報区分</dt><dd className="text-slate-700">{formatCodes(c.dataCategoryCodes ?? [], categoriesByCode)}</dd></div>
                <div><dt className="text-slate-400 mb-0.5">個人情報項目</dt><dd className="text-slate-700">{formatCodes(c.dataFieldCodes ?? [], fieldsByCode)}</dd></div>
                <div><dt className="text-slate-400 mb-0.5">利用目的</dt><dd className="text-slate-700">{c.purpose}</dd></div>
                <div><dt className="text-slate-400 mb-0.5">法的根拠</dt><dd className="text-slate-700">{c.legalBasis}</dd></div>
                <div><dt className="text-slate-400 mb-0.5">保存期間</dt><dd className="text-slate-700">{c.retentionPeriod}</dd></div>
                <div><dt className="text-slate-400 mb-0.5">保存場所</dt><dd className="text-slate-700">{c.storageLocation}</dd></div>
                {c.inferenceBasis && <div className="col-span-2"><dt className="text-slate-400 mb-0.5">推定根拠</dt><dd className="text-slate-500 italic">{c.inferenceBasis}</dd></div>}
              </dl>
            </div>
          ))}

          {saved ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-sm text-green-700 font-medium">台帳に追加しました</p>
              <a href="/register/items" className="text-xs text-green-600 hover:underline mt-1 block">
                → 台帳一覧で確認する
              </a>
            </div>
          ) : (
            <div className="flex justify-between">
              <button onClick={() => setStep("hearing")} className="text-sm text-slate-500 hover:text-slate-700">
                ← ヒアリングに戻る
              </button>
              <button
                onClick={saveToRegister}
                disabled={saving}
                className="px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "保存中..." : "台帳に追加する"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HearingPage() {
  return (
    <Suspense fallback={<div className="text-slate-400 text-sm py-8 text-center">読み込み中...</div>}>
      <HearingContent />
    </Suspense>
  );
}
