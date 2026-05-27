"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { QuestionCard } from "@/components/question-card";
import { StatusBadge } from "@/components/status-badge";

// ════════════════════════════════════════════════════════════════════
// 型定義 (v1.2)
// ════════════════════════════════════════════════════════════════════

interface CompanyProfile {
  representative: string | null;
  address: string | null;
  established: string | null;
  businessDescription: string | null;
  employees: {
    total: number | null;
    fullTime: number | null;
    contract: number | null;
    partTime: number | null;
    temporary: number | null;
  };
  locations: { name: string; address: string }[];
  mainServices: string[];
  statuses: Record<string, string>;
}

interface RegistryItem {
  id: string;
  dataCategory: string;
  dataSubject: string | null;
  purpose: string | null;
  purposeStatus: string;
  acquisitionMethod: string | null;
  acquisitionMethodStatus: string;
  storageLocation: string | null;
  storageStatus: string;
  retentionPeriod: string | null;
  retentionPeriodStatus: string;
  disposalMethod: string | null;
  disposalMethodStatus: string;
  thirdPartyStatus: string;
  category: string | null;
  categoryStatus: string;
  infoName: string | null;
  infoNameStatus: string;
  classification: string | null;
  classificationStatus: string;
  mediaType: string | null;
  mediaTypeStatus: string;
  storageMethod: string | null;
  storageMethodStatus: string;
  usagePeriod: string | null;
  usagePeriodStatus: string;
  disclosureTarget: boolean | null;
  disclosureTargetStatus: string;
  manager: string | null;
  managerStatus: string;
  accessiblePersons: string | null;
  accessiblePersonsStatus: string;
  remarks: string | null;
  volumeEstimate: string | null;
  thirdParties: { name: string; role: string | null }[];
  evidences: { id: string; targetField: string; sourceType: string; sourceRef: string; detail: string | null }[];
  isSensitive: boolean;
}

interface RegistryProcess {
  id: string;
  name: string;
  department: string | null;
  description: string | null;
  parentId: string | null;
  items: RegistryItem[];
  children: RegistryProcess[];
}

interface ChatMsg {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface Risk {
  id: string;
  businessProcess: string;
  threat: string;
  vulnerability: string;
  likelihood: string;
  impact: string;
  riskScore: number | null;
  currentMeasures: string | null;
  recommendedMeasures: string | null;
  confidence: string;
}

interface UnconfirmedItem {
  businessProcess: string;
  infoName: string;
  field: string;
}

interface EstimatedItem {
  businessProcess: string;
  infoName: string;
  field: string;
  value: string;
}

interface AutonomyStep {
  id: string;
  label: string;
  status: "pending" | "running" | "needs_human" | "done";
  detail: string;
}

interface Question {
  id: string;
  questionText: string;
  questionType: string;
  options: string | null;
  relatedProcess: string | null;
  priority: string;
  context: string | null;
  status: string;
  answer: string | null;
}

interface SessionData {
  session: {
    id: string;
    status: string;
    phase: string;
    updatedAt: string;
    company: { name: string; url: string | null };
    questions: Question[];
  };
  companyProfile: CompanyProfile | null;
  stats: {
    businessProcessCount: number;
    completionRate: number;
    confirmed: number;
    estimated: number;
    unconfirmed: number;
    insufficientEvidence: number;
    riskCount: number;
    highRiskCount: number;
    documentCount: number;
    pendingQuestions: number;
  };
  autonomy: {
    mode: string;
    steps: AutonomyStep[];
    nextAction: string;
  };
  registry: RegistryProcess[];
  risks: Risk[];
  unconfirmedItems: UnconfirmedItem[];
  estimatedItems: EstimatedItem[];
  agentMessages: ChatMsg[];
}

const PHASE_LABELS: Record<string, string> = {
  phase0_company_profile: "基本情報収集中",
  phase1_discovery: "業務の洗い出し中",
  phase2_deep_dive: "業務の深掘り中",
  phase3_risk_pms: "リスク評価・PMS文書洗い出し中",
  phase4_export: "帳票出力中",
  completed: "完了",
};

const STATUS_LABELS: Record<string, string> = {
  running: "実行中",
  idle: "待機中",
  waiting_for_answers: "回答待ち",
  completed: "完了",
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  K1: "個人情報",
  K2: "特定個人情報",
  D1: "個人データ",
  D2: "保有個人データ",
};

const FIELD_LABELS: Record<string, string> = {
  purpose: "利用目的",
  acquisitionMethod: "取得方法",
  retentionPeriod: "保管期間",
  disposalMethod: "廃棄方法",
  manager: "管理者",
};

// ════════════════════════════════════════════════════════════════════
// メインコンポーネント
// ════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center mt-20"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [agentMessage, setAgentMessage] = useState<string | null>(null);
  const expandBpParam = searchParams.get("expandBp");
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(
    () => expandBpParam ? new Set(expandBpParam.split(",")) : new Set()
  );
  const [sendingMessage, setSendingMessage] = useState(false);
  const [addingProcess, setAddingProcess] = useState(false);
  const [newProcessName, setNewProcessName] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [chatBpId, setChatBpId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [agentReplies, setAgentReplies] = useState<ChatMsg[]>([]);
  const [showAgentReplies, setShowAgentReplies] = useState(true);
  const [answerNotice, setAnswerNotice] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error ?? `セッション取得に失敗しました (${res.status})`);
      }
      const json = await res.json();
      setData(json);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "セッション情報を取得できませんでした");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // SSE接続
  useEffect(() => {
    if (!sessionId) return;

    const es = new EventSource(`/api/sessions/${sessionId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      let parsed: { type?: string; tool_name?: string; message?: string; result?: { businessProcessId?: string; text?: string } };
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      if (parsed.type === "connected") return;

      // ツール結果を受信したらデータを再取得
      if (parsed.tool_name === "agent_status") {
        setAgentMessage(parsed.message ?? null);
      } else if (parsed.tool_name === "agent_message") {
        const msgBpId = parsed.result?.businessProcessId ?? null;
        const text = parsed.result?.text ?? "";
        const entry: ChatMsg = {
          id: `sse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: "assistant",
          content: text,
          createdAt: new Date().toISOString(),
        };
        if (msgBpId) {
          // 業務別チャット用
          setChatMessages(prev => [...prev, entry]);
        } else {
          // 会社全体宛のAI応答 → メイン画面の通知パネルへ
          setAgentReplies(prev => [...prev, entry].slice(-10));
          setShowAgentReplies(true);
        }
        fetchData();
      } else {
        // report_findings, report_detailed_findings 等の結果
        fetchData();
      }
    };

    es.onerror = () => {
      setAgentMessage("リアルタイム接続が一時的に切れました。自動更新で再取得します。");
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [sessionId, fetchData]);

  // 初回読み込み + ポーリング（SSEのフォールバック）
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // サーバ側のagentMessagesでローカル状態を同期（再読み込み・別タブ・SSEロスト時の補完）
  useEffect(() => {
    if (!data?.agentMessages) return;
    setAgentReplies(prev => {
      const merged = [...data.agentMessages];
      const ids = new Set(merged.map(m => m.id));
      for (const m of prev) {
        if (m.id.startsWith("sse-") && !ids.has(m.id)) merged.push(m);
      }
      return merged.slice(-10);
    });
  }, [data?.agentMessages]);

  if (!sessionId) {
    return <p className="text-gray-500 text-center mt-12">セッションIDが指定されていません</p>;
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center mt-20">
        {loadError ? (
          <div className="bg-white border border-red-200 rounded-lg p-5 text-center max-w-md">
            <p className="text-sm font-medium text-red-700">セッション情報を取得できません</p>
            <p className="text-xs text-gray-500 mt-2">{loadError}</p>
            <button
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              再読み込み
            </button>
          </div>
        ) : (
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        )}
      </div>
    );
  }

  const { session, companyProfile, stats, autonomy, registry, risks, unconfirmedItems, estimatedItems } = data;
  const pendingQuestions = session.questions.filter(q => q.status === "pending");
  const globalQuestions = pendingQuestions.filter(q => !q.relatedProcess);
  const profileMissingItems = getMissingProfileItems(companyProfile);
  const questionsByProcess = new Map<string, Question[]>();
  for (const q of pendingQuestions) {
    if (q.relatedProcess) {
      const list = questionsByProcess.get(q.relatedProcess) ?? [];
      list.push(q);
      questionsByProcess.set(q.relatedProcess, list);
    }
  }
  const isRunning = session.status === "running";
  const isPossiblyStale = isRunning && Date.now() - new Date(session.updatedAt).getTime() > 150_000;
  const canExport = !isRunning && stats.businessProcessCount > 0 &&
    (session.phase === "phase3_risk_pms" || session.phase === "phase4_export" || session.phase === "completed");
  const guidance = getDashboardGuidance({
    isRunning,
    profileMissingItems,
    globalQuestionCount: globalQuestions.length,
    pendingQuestionCount: pendingQuestions.length,
    businessProcessCount: stats.businessProcessCount,
    riskCount: stats.riskCount,
    canExport,
  });
  const applicationSteps = getApplicationSteps({
    profileMissingItems,
    businessProcessCount: stats.businessProcessCount,
    registryItemCount: registry.reduce((sum, bp) => sum + bp.items.length, 0),
    riskCount: stats.riskCount,
    pendingQuestionCount: pendingQuestions.length,
    canExport,
  });

  function toggleProcess(id: string) {
    setExpandedProcesses(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleExport(type: string) {
    await fetch(`/api/sessions/${sessionId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentType: type }),
    });
    fetchData();
  }

  async function sendMessage(action: string, message?: string) {
    setSendingMessage(true);
    await fetch(`/api/sessions/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, message }),
    });
    setSendingMessage(false);
    fetchData();
  }

  function startChatPolling(bpId: string) {
    if (chatPollRef.current) clearInterval(chatPollRef.current);
    chatPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/chat?bpId=${bpId}`);
        const data = await res.json();
        setChatMessages(data.messages ?? []);
      } catch { /* ignore */ }
    }, 3000);
  }

  function stopChatPolling() {
    if (chatPollRef.current) {
      clearInterval(chatPollRef.current);
      chatPollRef.current = null;
    }
  }

  async function openChat(bpId: string) {
    setChatBpId(bpId);
    setChatMessages([]);
    setChatInput("");
    setChatLoading(true);

    // 既存メッセージを取得
    try {
      const res = await fetch(`/api/sessions/${sessionId}/chat?bpId=${bpId}`);
      const data = await res.json();
      const msgs = data.messages ?? [];
      setChatMessages(msgs);

      // 履歴が空なら、AIに最初の質問をさせる
      if (msgs.length === 0) {
        setChatSending(true);
        const bp = registry.find(b => b.id === bpId);
        await fetch(`/api/sessions/${sessionId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `この業務「${bp?.name ?? ""}」について深掘りを開始してください。まず、この業務の具体的な内容について質問してください。`,
            businessProcessId: bpId,
          }),
        });
        setChatSending(false);
      }
    } catch { /* ignore */ }
    setChatLoading(false);

    // ポーリング開始（SSEだけでは不安定なため）
    startChatPolling(bpId);
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || !chatBpId) return;
    const msg = chatInput.trim();
    const bpId = chatBpId;
    setChatInput("");
    // optimistic UI
    setChatMessages(prev => [...prev, {
      id: `local-${Date.now()}`,
      role: "user",
      content: msg,
      createdAt: new Date().toISOString(),
    }]);
    setChatSending(true);
    await fetch(`/api/sessions/${sessionId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg, businessProcessId: bpId }),
    });
    setChatSending(false);
    // ポーリング再開（応答を待つ）
    startChatPolling(bpId);
  }

  async function handleAddProcess() {
    if (!newProcessName) return;
    await sendMessage("add_business_process", newProcessName);
    setNewProcessName("");
    setAddingProcess(false);
  }

  return (
    <div className="space-y-6">
      {/* ── ヘッダー ── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {session.company.name} — Pマーク申請準備
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            ヒアリング内容をもとに、申請書・個人情報管理台帳・PMS文書を順番に作ります。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={session.status} label={STATUS_LABELS[session.status] ?? session.status} />
          <span className="text-sm text-gray-500">{PHASE_LABELS[session.phase] ?? session.phase}</span>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <span>一時的に最新状態を取得できませんでした: {loadError}</span>
          <button onClick={fetchData} className="text-orange-900 font-medium underline flex-shrink-0">
            再取得
          </button>
        </div>
      )}

      {answerNotice && (
        <div className="flex items-start justify-between gap-3 text-sm text-orange-900 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
          <span>{answerNotice}</span>
          <button onClick={() => setAnswerNotice(null)} className="text-orange-700 hover:underline flex-shrink-0">
            閉じる
          </button>
        </div>
      )}

      {/* ── 次の作業ガイド ── */}
      <section className="bg-white rounded-lg border border-blue-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div>
            <p className="text-xs font-semibold text-blue-700">次にやること</p>
            <h2 className="text-lg font-semibold text-gray-950 mt-1">{guidance.title}</h2>
            <p className="text-sm text-gray-700 mt-2 max-w-2xl">{guidance.detail}</p>
            <p className="text-xs text-gray-500 mt-2">この入力は {guidance.purpose}</p>
          </div>
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:w-56">
            <button
              onClick={() => sendMessage(guidance.action)}
              disabled={sendingMessage || isRunning}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {sendingMessage ? "送信中..." : isRunning ? "AI実行中" : guidance.button}
            </button>
            {guidance.secondaryAction && (
              <button
                onClick={() => sendMessage(guidance.secondaryAction!)}
                disabled={sendingMessage || isRunning}
                className="px-4 py-2.5 bg-white text-gray-800 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {guidance.secondaryButton}
              </button>
            )}
          </div>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>申請準備の進捗</span>
            <span>{stats.completionRate}% 整備済み</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, stats.completionRate)}%` }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mt-4">
            {applicationSteps.map(step => (
              <div key={step.label} className={`border rounded-lg p-3 ${step.done ? "bg-green-50 border-green-200" : step.current ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900">{step.label}</span>
                  <span className={`text-xs ${step.done ? "text-green-700" : step.current ? "text-blue-700" : "text-gray-400"}`}>
                    {step.done ? "完了" : step.current ? "作業中" : "未着手"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">{step.detail}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4 text-xs">
            <MetricPill label="確定" value={`${stats.confirmed}`} tone="green" />
            <MetricPill label="推定" value={`${stats.estimated}`} tone="yellow" />
            <MetricPill label="未確認" value={`${stats.unconfirmed}`} tone="orange" />
            <MetricPill label="確認依頼" value={`${pendingQuestions.length}`} tone="orange" />
            <MetricPill label="リスク" value={`${risks.length}`} tone="gray" />
          </div>
        </div>
      </section>

      {/* ── AIからの返信 ── */}
      {agentReplies.length > 0 && showAgentReplies && (
        <section className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="text-xs font-semibold text-amber-800">AIからの返信</p>
              <p className="text-xs text-amber-700 mt-0.5">
                不足チェックや自動運転中にAIが返したテキスト（最新{agentReplies.length}件）。出力可否や残課題はここに表示されます。
              </p>
            </div>
            <button
              onClick={() => setShowAgentReplies(false)}
              className="text-xs text-amber-700 hover:underline flex-shrink-0"
            >
              閉じる
            </button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {agentReplies.slice().reverse().map(m => (
              <div key={m.id} className="bg-white border border-amber-100 rounded p-3 text-sm text-gray-800 whitespace-pre-wrap">
                <div className="text-[10px] text-gray-400 mb-1">{new Date(m.createdAt).toLocaleString("ja-JP")}</div>
                {m.content}
              </div>
            ))}
          </div>
        </section>
      )}
      {agentReplies.length > 0 && !showAgentReplies && (
        <button
          onClick={() => setShowAgentReplies(true)}
          className="text-xs text-amber-700 hover:underline"
        >
          AIからの返信を再表示 ({agentReplies.length}件)
        </button>
      )}

      <details className="bg-white rounded-lg border border-gray-200 p-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">詳細なAI処理状況を表示</summary>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
          {autonomy.steps.map(step => (
            <div key={step.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-900">{step.label}</span>
                <AutonomyStatus status={step.status} />
              </div>
              <p className="text-xs text-gray-500 mt-2">{step.detail}</p>
            </div>
          ))}
        </div>
      </details>

      {/* ── エージェント状況 + stuck検出 ── */}
      {isRunning && (
        <div className={`flex items-center justify-between text-sm rounded-lg px-4 py-2 border ${
          isPossiblyStale
            ? "text-orange-800 bg-orange-50 border-orange-200"
            : "text-blue-700 bg-blue-50 border-blue-200"
        }`}>
          <div className="flex items-center gap-2">
            <span className={`animate-spin h-4 w-4 border-2 border-t-transparent rounded-full flex-shrink-0 ${
              isPossiblyStale ? "border-orange-500" : "border-blue-500"
            }`} />
            {isPossiblyStale
              ? "AI処理の完了待ちが長引いています。保存済みデータを確認して、必要なら待機状態へ戻してください。"
              : agentMessage ?? `AIが処理中です... 現在 ${stats.businessProcessCount}業務、${risks.length}件のリスクを保存済みです。`}
          </div>
          <button
            onClick={async () => {
              await fetch(`/api/sessions/${sessionId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "idle" }),
              });
              fetchData();
            }}
            className="text-xs text-blue-600 hover:underline ml-4 flex-shrink-0"
          >
            処理が止まった場合はここをクリック
          </button>
        </div>
      )}

      {/* ── 申請フローの先頭: 基本情報ヒアリング ── */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900">基本情報整理</h2>
            <p className="text-sm text-gray-600 mt-1">
              申請書・台帳・PMS文書を作る前に、会社情報、従業員数、拠点、事業内容を確認します。
              前回の続きでも、この工程から不足分を埋めます。
            </p>
          </div>
          <button
            onClick={() => sendMessage("start_basic_hearing")}
            disabled={sendingMessage || isRunning}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex-shrink-0"
          >
            {sendingMessage ? "送信中..." : isRunning ? "AI実行中" : "AIにヒアリングさせる"}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-sm">
          <FlowCheckpoint label="1" title="HP等の顧客データ確認" detail="会社概要、問い合わせ、採用、取引フォームを確認" />
          <FlowCheckpoint label="2" title="ヒアリング" detail="代表者、所在地、従業員、拠点、事業内容を確認" />
          <FlowCheckpoint label="3" title="基本情報整理" detail="様式1-①などの申請書類に使える形へ整理" />
        </div>
        {profileMissingItems.length > 0 && (
          <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 p-3">
            <p className="text-xs font-medium text-blue-900">未整理の基本情報</p>
            <p className="text-xs text-blue-800 mt-1">
              次のアクション: 「AIにヒアリングさせる」を押すと、公開情報を再確認したうえで不足項目だけ質問します。
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {profileMissingItems.map(item => (
                <span key={item} className="px-2 py-1 rounded bg-white border border-blue-100 text-xs text-blue-900">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── 基本情報（Phase 0） ── */}
      {companyProfile && (
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold text-gray-900">基本情報</h2>
              {profileMissingItems.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  未取得項目は申請書の会社基本情報に使います。公開情報で再確認し、足りない項目だけヒアリングします。
                </p>
              )}
            </div>
            {profileMissingItems.length > 0 && (
              <button
                onClick={() => sendMessage("start_basic_hearing")}
                disabled={sendingMessage || isRunning}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex-shrink-0"
              >
                {sendingMessage ? "送信中..." : isRunning ? "AI実行中" : "不足基本情報を確認"}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <ProfileField label="代表者" value={companyProfile.representative} status={companyProfile.statuses.representative} />
            <ProfileField label="所在地" value={companyProfile.address} status={companyProfile.statuses.address} />
            <ProfileField label="設立" value={companyProfile.established} status={companyProfile.statuses.established} />
            <ProfileField label="事業内容" value={companyProfile.businessDescription} status={companyProfile.statuses.businessDescription} />
            <ProfileField
              label="従業員数"
              value={companyProfile.employees.total != null
                ? `${companyProfile.employees.total}名（正社員${companyProfile.employees.fullTime ?? "?"}、契約${companyProfile.employees.contract ?? "?"}、パート${companyProfile.employees.partTime ?? "?"}、派遣${companyProfile.employees.temporary ?? "?"}）`
                : null}
              status={companyProfile.statuses.employees}
            />
            <ProfileField
              label="拠点"
              value={companyProfile.locations.length > 0
                ? companyProfile.locations.map(l => `${l.name}（${l.address}）`).join("、")
                : null}
              status={companyProfile.statuses.locations}
            />
            {companyProfile.mainServices.length > 0 && (
              <div className="col-span-2">
                <span className="text-gray-500">主要サービス: </span>
                <span className="text-gray-900">{companyProfile.mainServices.join("、")}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 回答が必要な確認依頼 ── */}
      {pendingQuestions.length > 0 && (
        <section className="bg-white rounded-lg border border-orange-200 p-5">
          <h2 className="font-semibold text-orange-800 mb-3">
            回答が必要な確認依頼（{pendingQuestions.length}件）
          </h2>
          <p className="text-xs text-orange-700 mb-3">
            ここに表示される回答は、基本情報、個人情報管理台帳、リスク分析の未確定項目に反映されます。
          </p>
          <div className="space-y-4">
            {pendingQuestions.map(q => (
              <QuestionCard key={q.id} question={q} onAnswered={(info) => { if (info?.agentDeliveryError) setAnswerNotice(info.agentDeliveryError); fetchData(); }} />
            ))}
          </div>
        </section>
      )}

      {/* ── 業務と個人情報（カテゴリ別カードビュー） ── */}
      {registry.length > 0 && (() => {
        // department でカテゴリ分け
        const categoryMap = new Map<string, RegistryProcess[]>();
        for (const bp of registry) {
          const cat = bp.department || "未分類";
          const list = categoryMap.get(cat) ?? [];
          list.push(bp);
          categoryMap.set(cat, list);
        }
        const categories = Array.from(categoryMap.entries()).sort((a, b) => {
          if (a[0] === "未分類") return 1;
          if (b[0] === "未分類") return -1;
          return b[1].length - a[1].length; // 件数多い順
        });

        function toggleCategory(cat: string) {
          setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
          });
        }

        return (
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-1">
              業務と個人情報
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              {stats.businessProcessCount}業務 / {categories.length}カテゴリ
              {isRunning && session.phase === "phase1_discovery" ? " / 調査中..." : ""}
            </p>

            <div className="space-y-3">
              {categories.map(([catName, bps]) => {
                const isCatExpanded = expandedCategories.has(catName);
                const totalItems = bps.reduce((sum, bp) => sum + bp.items.length, 0);

                return (
                  <div key={catName} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* カテゴリヘッダー */}
                    <button
                      onClick={() => toggleCategory(catName)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm">{isCatExpanded ? "▼" : "▶"}</span>
                        <div>
                          <span className="font-semibold text-gray-800">{catName}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            {bps.length}業務 / {totalItems}件の個人情報
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ProcessStatusSummary items={bps.flatMap(bp => bp.items)} />
                      </div>
                    </button>

                    {/* カテゴリ展開: カードグリッド */}
                    {isCatExpanded && (
                      <div className="p-4 bg-white">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {bps.map(bp => {
                            const isExpanded = expandedProcesses.has(bp.id);
                            const bpQuestions = questionsByProcess.get(bp.name) ?? [];
                            return (
                              <div
                                key={bp.id}
                                className={`border rounded-xl transition-all ${
                                  isExpanded
                                    ? "col-span-1 md:col-span-2 xl:col-span-3 border-blue-200 bg-blue-50/30"
                                    : "border-gray-200 hover:border-blue-300 hover:shadow-sm bg-white"
                                }`}
                              >
                                {/* カードヘッダー */}
                                <div className="p-4">
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <button
                                      onClick={() => toggleProcess(bp.id)}
                                      className="text-left flex-1 min-w-0"
                                    >
                                      <h4 className="font-medium text-gray-900 text-sm leading-tight">
                                        {bp.name}
                                      </h4>
                                    </button>
                                    <div className="flex gap-2 flex-shrink-0">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); toggleProcess(bp.id); }}
                                        className="px-2.5 py-1 bg-white text-gray-700 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 transition"
                                      >
                                        {isExpanded ? "詳細を閉じる" : "詳細を開く"}
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); openChat(bp.id); }}
                                        className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 transition"
                                      >
                                        AIと対話
                                      </button>
                                    </div>
                                  </div>
                                  {bp.description && (
                                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">{bp.description}</p>
                                  )}
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-400">{bp.items.length}件の個人情報</span>
                                    <ProcessStatusSummary items={bp.items} />
                                  </div>
                                  {!isExpanded && bp.items.some(item => hasReviewableField(item)) && (
                                    <p className="text-xs text-amber-700 mt-2">
                                      詳細を開くと、AI推定値を確認・修正できます。
                                    </p>
                                  )}
                                </div>

                                {/* 業務別の質問 */}
                                {bpQuestions.length > 0 && (
                                  <div className="border-t border-orange-100 bg-orange-50 p-3 space-y-3">
                                    <p className="text-xs font-medium text-orange-700">
                                      確認中（{bpQuestions.length}件）
                                    </p>
                                    {bpQuestions.map(q => (
                                      <QuestionCard key={q.id} question={q} onAnswered={(info) => { if (info?.agentDeliveryError) setAnswerNotice(info.agentDeliveryError); fetchData(); }} />
                                    ))}
                                  </div>
                                )}

                                {/* 展開時: 個人情報カード */}
                                {isExpanded && (
                                  <div className="border-t border-gray-100 p-4 space-y-3">
                                    {bp.items.map(item => (
                                      <PersonalInfoCard key={item.id} item={item} onUpdated={fetchData} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 業務追加ボタン */}
              {!isRunning && (
                <div className="mt-3">
                  {addingProcess ? (
                    <div className="flex gap-2">
                      <input
                        value={newProcessName}
                        onChange={e => setNewProcessName(e.target.value)}
                        placeholder="業務名（例: 委託先管理、イベント運営）"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        autoFocus
                        onKeyDown={e => { if (e.key === "Enter") handleAddProcess(); }}
                      />
                      <button onClick={handleAddProcess} disabled={!newProcessName || sendingMessage} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">追加</button>
                      <button onClick={() => setAddingProcess(false)} className="px-3 py-2 text-gray-500 text-sm">取消</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingProcess(true)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      + 業務を手動追加
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Phase遷移ボタン */}
            {!isRunning && session.phase === "phase1_discovery" && (
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => sendMessage("autopilot_to_risk")}
                  disabled={sendingMessage}
                  className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition"
                >
                  {sendingMessage ? "送信中..." : "リスク分析まで自動実行"}
                </button>
                <button
                  onClick={() => sendMessage("proceed_to_phase2")}
                  disabled={sendingMessage}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition"
                >
                  {sendingMessage ? "送信中..." : "業務の深掘りへ進む（Phase 2）"}
                </button>
              </div>
            )}
            {!isRunning && session.phase === "phase2_deep_dive" && pendingQuestions.length === 0 && (
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => sendMessage("autopilot_to_risk")}
                  disabled={sendingMessage}
                  className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition"
                >
                  {sendingMessage ? "送信中..." : "残りを自動でリスク分析まで進める"}
                </button>
                <button
                  onClick={() => sendMessage("proceed_to_phase3")}
                  disabled={sendingMessage}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition"
                >
                  {sendingMessage ? "送信中..." : "リスク評価へ進む（Phase 3）"}
                </button>
              </div>
            )}
          </section>
        );
      })()}

      {/* ── 未確認事項 ── */}
      {unconfirmedItems.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">
            未確認事項（{unconfirmedItems.length}件）
          </h2>
          <div className="space-y-1 text-sm">
            {unconfirmedItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-gray-600">
                <span className="text-orange-500">&#10067;</span>
                <span>{item.businessProcess}: {item.infoName}の{FIELD_LABELS[item.field] ?? item.field}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── AI推定内容 ── */}
      {estimatedItems.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">
            AI推定内容（{estimatedItems.length}件）
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            推定フィールドは、AIが公開情報・資料・業界知見から仮入力した値です。正しければ各業務カード内で確認、違えば修正してください。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-3">業務</th>
                  <th className="py-2 pr-3">個人情報</th>
                  <th className="py-2 pr-3">項目</th>
                  <th className="py-2">推定値</th>
                </tr>
              </thead>
              <tbody>
                {estimatedItems.slice(0, 30).map((item, i) => (
                  <tr key={`${item.businessProcess}-${item.infoName}-${item.field}-${i}`} className="border-b border-gray-50">
                    <td className="py-2 pr-3 font-medium text-gray-900">{item.businessProcess}</td>
                    <td className="py-2 pr-3 text-gray-700">{item.infoName}</td>
                    <td className="py-2 pr-3 text-gray-600">{FIELD_LABELS[item.field] ?? item.field}</td>
                    <td className="py-2 text-gray-700">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {estimatedItems.length > 30 && (
            <p className="text-xs text-gray-500 mt-2">先頭30件を表示しています。全件は業務カードを展開して確認できます。</p>
          )}
        </section>
      )}

      {/* ── リスク分析 ── */}
      {risks.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">リスク分析</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="pb-2 pr-3">スコア</th>
                  <th className="pb-2 pr-3">業務プロセス</th>
                  <th className="pb-2 pr-3">脅威</th>
                  <th className="pb-2 pr-3">現状の対策</th>
                  <th className="pb-2">推奨対策</th>
                </tr>
              </thead>
              <tbody>
                {risks.map(r => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-3"><RiskScoreBadge score={r.riskScore} /></td>
                    <td className="py-2 pr-3 font-medium text-gray-900">{r.businessProcess}</td>
                    <td className="py-2 pr-3 text-gray-700">{r.threat}</td>
                    <td className="py-2 pr-3 text-gray-600 max-w-48 truncate">{r.currentMeasures ?? "—"}</td>
                    <td className="py-2 text-gray-600 max-w-56 truncate">{r.recommendedMeasures ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 書類出力ボタン ── */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="font-semibold text-gray-900">書類出力</h2>
            <p className="text-xs text-gray-500 mt-1">
              出力ボタンを押すと、AIがテンプレート構成に沿って今回データで新規ドラフトを生成します。出力前に不足チェックをしたい場合は、上の「次にやること」ボタンを使ってください。
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={() => handleExport("application_form")}
            disabled={!canExport || sendingMessage}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="様式1系をはじめとした審査申請書を出力します"
          >
            審査申請書を出力
          </button>
          <button
            onClick={() => handleExport("personal_info_registry")}
            disabled={!canExport || sendingMessage}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            個人情報管理台帳を出力
          </button>
          <button
            onClick={() => handleExport("pms_documents")}
            disabled={!canExport || sendingMessage}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="個人情報保護方針、規程、教育・監査・マネジメントレビュー等のPMS文書一式"
          >
            PMS文書一式を出力
          </button>
          <button
            onClick={() => handleExport("risk_analysis")}
            disabled={!canExport || sendingMessage}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            リスク分析を出力
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => handleExport("amendment_review_package")}
            disabled={!canExport || sendingMessage}
            className="px-3 py-1.5 bg-white text-gray-800 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="補正審査用の差分・指摘対応ドラフト"
          >
            補正審査準備資料を出力
          </button>
          <button
            onClick={() => handleExport("evidence_bundle")}
            disabled={!canExport || sendingMessage}
            className="px-3 py-1.5 bg-white text-gray-800 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="証跡一式（教育記録、監査記録、廃棄記録 等）"
          >
            証跡パッケージを出力
          </button>
        </div>
        {!canExport && (
          <p className="text-xs text-orange-600 mt-3">
            台帳項目とリスク分析が揃ってからボタンが有効になります。
          </p>
        )}
      </section>

      {/* ── チャットモーダル ── */}
      {chatBpId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-xl shadow-2xl flex flex-col" style={{ maxHeight: "80vh" }}>
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {registry.find(b => b.id === chatBpId)?.name ?? "業務"} との対話
                </h3>
                <p className="text-xs text-gray-500">AIが業務内容を深掘りします</p>
              </div>
              <button
                onClick={async () => {
                  const closingBpId = chatBpId;
                  setChatBpId(null);
                  stopChatPolling();
                  // DB反映を待ってからfetch
                  await new Promise(r => setTimeout(r, 500));
                  await fetchData();
                  // チャットで深掘りした業務を自動展開
                  if (closingBpId) {
                    setExpandedProcesses(prev => new Set(prev).add(closingBpId));
                  }
                }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* メッセージ一覧 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {chatLoading && <p className="text-xs text-gray-400">読み込み中...</p>}
              {chatMessages.map(m => (
                <div
                  key={m.id}
                  className={`text-sm rounded-lg p-3 max-w-[85%] whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-blue-100 text-blue-900 ml-auto"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {chatSending && (
                <div className="bg-gray-100 text-gray-500 text-sm rounded-lg p-3 max-w-[85%] animate-pulse">
                  考え中...
                </div>
              )}
            </div>

            {/* 保存して閉じる */}
            {chatMessages.length >= 2 && (
              <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
                <button
                  onClick={async () => {
                    const bpId = chatBpId;
                    setChatSending(true);
                    // Agentにreport_detailed_findingsを強制呼び出しさせる
                    await fetch(`/api/sessions/${sessionId}/chat`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ businessProcessId: bpId, action: "save" }),
                    });
                    // Agentのツール実行完了をポーリングで待つ
                    for (let i = 0; i < 20; i++) {
                      await new Promise(r => setTimeout(r, 1000));
                      const res = await fetch(`/api/sessions/${sessionId}`);
                      const json = await res.json();
                      if (json.session.status === "idle") break;
                    }
                    setChatSending(false);
                    stopChatPolling();
                    setChatBpId(null);
                    // 確実に最新データを表示するためリロード（対話した業務を展開状態で）
                    const url = new URL(window.location.href);
                    if (bpId) url.searchParams.set("expandBp", bpId);
                    window.location.href = url.toString();
                  }}
                  disabled={chatSending}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition"
                >
                  {chatSending ? "保存中..." : "対話内容を台帳に保存して閉じる"}
                </button>
              </div>
            )}

            {/* 入力欄 */}
            <div className="border-t border-gray-200 p-3 flex gap-2">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                placeholder="回答を入力..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={chatSending}
                autoFocus
              />
              <button
                onClick={sendChatMessage}
                disabled={chatSending || !chatInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition"
              >
                送信
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// サブコンポーネント
// ════════════════════════════════════════════════════════════════════

function ProfileField({ label, value, status }: { label: string; value: string | null; status: string }) {
  return (
    <div className="flex items-start gap-1">
      <span className="text-gray-500 flex-shrink-0">{label}:</span>
      <span className="text-gray-900">{value ?? <span className="text-gray-300">未取得</span>}</span>
      <ConfidenceIcon status={status} />
    </div>
  );
}

function getMissingProfileItems(profile: CompanyProfile | null) {
  if (!profile) {
    return ["代表者", "所在地", "設立", "事業内容", "従業員数", "拠点"];
  }
  const missing: string[] = [];
  if (!profile.representative) missing.push("代表者");
  if (!profile.address) missing.push("所在地");
  if (!profile.established) missing.push("設立");
  if (!profile.businessDescription) missing.push("事業内容");
  if (profile.employees.total == null) missing.push("従業員数");
  if (profile.locations.length === 0) missing.push("拠点");
  return missing;
}

function FlowCheckpoint({ label, title, detail }: { label: string; title: string; detail: string }) {
  return (
    <div className="border border-blue-100 rounded-lg bg-blue-50 p-3">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center flex-shrink-0">
          {label}
        </span>
        <h3 className="font-medium text-blue-950">{title}</h3>
      </div>
      <p className="text-xs text-blue-900 mt-2">{detail}</p>
    </div>
  );
}

function getDashboardGuidance(input: {
  isRunning: boolean;
  profileMissingItems: string[];
  globalQuestionCount: number;
  pendingQuestionCount: number;
  businessProcessCount: number;
  riskCount: number;
  canExport: boolean;
}) {
  if (input.isRunning) {
    return {
      title: "AIが処理中です",
      detail: "しばらく待つと、ヒアリング質問、台帳候補、リスク分析のいずれかが更新されます。",
      purpose: "申請書・台帳・PMS文書の材料を構造化するために使われます。",
      button: "処理中",
      action: "autopilot_to_risk",
    };
  }
  if (input.pendingQuestionCount > 0) {
    return {
      title: "確認依頼に回答してください",
      detail: `${input.pendingQuestionCount}件の確認待ちがあります。回答すると、基本情報・台帳・リスク分析に反映して次工程へ進めます。`,
      purpose: "AIが公開情報だけでは確定できなかった項目を、審査書類に使える確定情報へ変えるためです。",
      button: "AIに次の確認を整理させる",
      action: "autopilot_to_risk",
    };
  }
  if (input.profileMissingItems.length > 0) {
    return {
      title: "まず会社・従業員情報を確認してください",
      detail: `未整理: ${input.profileMissingItems.join("、")}。ここが埋まると、様式1系とPMS体制の土台が作れます。`,
      purpose: "審査申請書の基本情報、個人情報保護体制、従業員向け教育・監査計画の前提になります。",
      button: "基本情報ヒアリングを開始",
      action: "start_basic_hearing",
      secondaryButton: "台帳作成へ進める",
      secondaryAction: "autopilot_to_risk",
    };
  }
  if (input.businessProcessCount === 0) {
    return {
      title: "個人情報を扱う業務を洗い出してください",
      detail: "営業、問い合わせ、採用、契約、経理、委託先管理など、個人情報が発生する業務をAIと整理します。",
      purpose: "様式4、個人情報管理台帳、必要なPMS文書一覧の元データになります。",
      button: "業務洗い出しを開始",
      action: "autopilot_to_risk",
    };
  }
  if (input.riskCount === 0) {
    return {
      title: "台帳候補からリスク分析へ進めてください",
      detail: "登録済みの業務と個人情報をもとに、リスク分析表と安全管理措置の候補を作ります。",
      purpose: "リスク分析表、個人情報保護規程、安全管理措置の説明に使われます。",
      button: "リスク分析まで自動実行",
      action: "autopilot_to_risk",
    };
  }
  if (input.canExport) {
    return {
      title: "書類出力の準備ができています",
      detail: "下部の出力ボタンから「審査申請書」「個人情報管理台帳」「PMS文書一式」「リスク分析」をそれぞれ出力できます。出力前にAIに不足点を洗い出させたい場合は右のボタンを押してください。",
      purpose: "審査申請書、個人情報管理台帳、PMS文書、補正審査準備資料のドラフトになります。",
      button: "出力前にAIへ不足チェック",
      action: "check_missing_for_export",
    };
  }
  return {
    title: "不足分をAIに整理させてください",
    detail: "現在の入力内容から、次に足りない台帳項目、リスク、PMS文書を洗い出します。",
    purpose: "申請書類一式をフロー通りに完成させるための不足確認に使われます。",
    button: "不足分を整理",
    action: "autopilot_to_risk",
  };
}

function getApplicationSteps(input: {
  profileMissingItems: string[];
  businessProcessCount: number;
  registryItemCount: number;
  riskCount: number;
  pendingQuestionCount: number;
  canExport: boolean;
}) {
  const profileDone = input.profileMissingItems.length === 0;
  const processDone = input.businessProcessCount > 0;
  const registryDone = input.registryItemCount > 0;
  const riskDone = input.riskCount > 0;
  return [
    { label: "基本情報", done: profileDone, current: !profileDone, detail: profileDone ? "会社・従業員情報を整理済み" : "最初に確認する項目です" },
    { label: "業務洗い出し", done: processDone, current: profileDone && !processDone, detail: `${input.businessProcessCount}業務` },
    { label: "台帳", done: registryDone, current: processDone && !registryDone, detail: `${input.registryItemCount}件の取扱い` },
    { label: "リスク分析", done: riskDone, current: registryDone && !riskDone, detail: `${input.riskCount}件のリスク` },
    { label: "書類作成", done: input.canExport, current: riskDone && !input.canExport, detail: input.pendingQuestionCount > 0 ? `${input.pendingQuestionCount}件確認待ち` : "出力準備" },
  ];
}

function MetricPill({ label, value, tone }: { label: string; value: string; tone: "green" | "yellow" | "orange" | "gray" }) {
  const classes = {
    green: "bg-green-50 text-green-700 border-green-200",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <div className={`border rounded-lg px-3 py-2 ${classes[tone]}`}>
      <div className="font-semibold">{value}</div>
      <div>{label}</div>
    </div>
  );
}

function PersonalInfoCard({ item, onUpdated }: { item: RegistryItem; onUpdated: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  async function handleSave(fieldName: string) {
    if (!editValue) return;
    await fetch(`/api/fields/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldName, value: editValue, status: "confirmed", changedBy: "human" }),
    });
    setEditing(null);
    setEditValue("");
    onUpdated();
  }

  async function handleConfirm(fieldName: string) {
    await fetch(`/api/fields/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldName, status: "confirmed", changedBy: "human" }),
    });
    onUpdated();
  }

  const displayName = item.infoName ?? item.dataCategory;
  const classification = item.classification ? `[${item.classification}]` : "";

  const fields: { label: string; value: string | null; status: string; fieldName: string }[] = [
    { label: "入手方法", value: item.acquisitionMethod, status: item.acquisitionMethodStatus, fieldName: "acquisitionMethod" },
    { label: "利用目的", value: item.purpose, status: item.purposeStatus, fieldName: "purpose" },
    { label: "媒体", value: item.mediaType === "data" ? "データ" : item.mediaType === "paper" ? "紙" : item.mediaType === "both" ? "データ+紙" : null, status: item.mediaTypeStatus, fieldName: "mediaType" },
    { label: "保管場所", value: item.storageLocation, status: item.storageStatus, fieldName: "storage" },
    { label: "保管方法", value: item.storageMethod, status: item.storageMethodStatus, fieldName: "storageMethod" },
    { label: "利用期間", value: item.usagePeriod, status: item.usagePeriodStatus, fieldName: "usagePeriod" },
    { label: "保管期間", value: item.retentionPeriod, status: item.retentionPeriodStatus, fieldName: "retentionPeriod" },
    { label: "管理者", value: item.manager, status: item.managerStatus, fieldName: "manager" },
    { label: "アクセス", value: item.accessiblePersons, status: item.accessiblePersonsStatus, fieldName: "accessiblePersons" },
    { label: "廃棄", value: item.disposalMethod, status: item.disposalMethodStatus, fieldName: "disposalMethod" },
  ];

  // 委託・提供
  const subcontractors = item.thirdParties.filter(t => t.role === "subcontractor");
  const providers = item.thirdParties.filter(t => t.role === "third_party");

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-gray-900">{displayName}</span>
        {classification && (
          <span className="text-xs text-blue-600 font-mono">{classification}</span>
        )}
        {item.isSensitive && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">要配慮</span>
        )}
        {item.category && (
          <span className="text-xs text-gray-400">{item.category}</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs">
        {fields.map(f => (
          <div key={f.fieldName} className="flex items-center gap-1">
            <span className="text-gray-500 w-16 flex-shrink-0">{f.label}:</span>
            {editing === f.fieldName ? (
              <span className="flex gap-1 flex-1">
                <input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="flex-1 px-1.5 py-0.5 border border-gray-300 rounded text-xs"
                  autoFocus
                />
                <button onClick={() => handleSave(f.fieldName)} className="text-blue-600">保存</button>
                <button onClick={() => setEditing(null)} className="text-gray-400">取消</button>
              </span>
            ) : (
              <>
                <span className="text-gray-900 flex-1">{f.value ?? <span className="text-gray-300">—</span>}</span>
                <ConfidenceIcon status={f.status} />
                {f.status === "estimated" && (
                  <button onClick={() => handleConfirm(f.fieldName)} className="text-green-600 hover:underline">確認</button>
                )}
                {(f.status === "estimated" || f.status === "unconfirmed") && (
                  <button onClick={() => { setEditing(f.fieldName); setEditValue(f.value ?? ""); }} className="text-blue-600 hover:underline">修正</button>
                )}
              </>
            )}
          </div>
        ))}

        {/* 委託・提供 */}
        <div className="flex items-center gap-1">
          <span className="text-gray-500 w-16 flex-shrink-0">委託:</span>
          <span className="text-gray-900">{subcontractors.length > 0 ? subcontractors.map(t => t.name).join(", ") : "なし"}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500 w-16 flex-shrink-0">提供:</span>
          <span className="text-gray-900">{providers.length > 0 ? providers.map(t => t.name).join(", ") : "なし"}</span>
        </div>
      </div>

      {item.remarks && (
        <p className="text-xs text-gray-500 mt-2">備考: {item.remarks}</p>
      )}

      {/* 根拠 */}
      {item.evidences.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-400 mb-0.5">根拠:</p>
          {item.evidences.map(ev => (
            <p key={ev.id} className="text-xs text-gray-500">
              [{ev.sourceType}] {ev.sourceRef}
              {ev.detail && ` — ${ev.detail}`}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function ProcessStatusSummary({ items }: { items: RegistryItem[] }) {
  let confirmed = 0, estimated = 0, unconfirmed = 0;
  for (const item of items) {
    const statuses = [item.purposeStatus, item.acquisitionMethodStatus, item.storageStatus, item.retentionPeriodStatus, item.disposalMethodStatus];
    for (const s of statuses) {
      if (s === "confirmed") confirmed++;
      else if (s === "estimated") estimated++;
      else unconfirmed++;
    }
  }
  return (
    <div className="flex gap-2 text-xs">
      {confirmed > 0 && <span className="text-green-600">{confirmed} 確定</span>}
      {estimated > 0 && <span className="text-yellow-600">{estimated} 推定</span>}
      {unconfirmed > 0 && <span className="text-orange-600">{unconfirmed} 未確認</span>}
    </div>
  );
}

function hasReviewableField(item: RegistryItem) {
  return [
    item.acquisitionMethodStatus,
    item.purposeStatus,
    item.mediaTypeStatus,
    item.storageStatus,
    item.storageMethodStatus,
    item.usagePeriodStatus,
    item.retentionPeriodStatus,
    item.managerStatus,
    item.accessiblePersonsStatus,
    item.disposalMethodStatus,
  ].some(status => status === "estimated" || status === "unconfirmed");
}

function ConfidenceIcon({ status }: { status: string }) {
  if (status === "confirmed") return <span className="text-green-500 text-xs" title="確認済">&#10003;</span>;
  if (status === "estimated") return <span className="text-yellow-500 text-xs" title="AI推定">&#9671;</span>;
  if (status === "unconfirmed") return <span className="text-orange-500 text-xs" title="未確認">&#9679;</span>;
  return <span className="text-red-500 text-xs" title="証跡不足">&#10071;</span>;
}

function AutonomyStatus({ status }: { status: AutonomyStep["status"] }) {
  const labels: Record<AutonomyStep["status"], string> = {
    pending: "待機",
    running: "実行中",
    needs_human: "確認待ち",
    done: "完了",
  };
  const classes: Record<AutonomyStep["status"], string> = {
    pending: "bg-gray-100 text-gray-500",
    running: "bg-blue-100 text-blue-700",
    needs_human: "bg-orange-100 text-orange-700",
    done: "bg-green-100 text-green-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${classes[status]}`}>
      {labels[status]}
    </span>
  );
}

function RiskScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-400">—</span>;
  let className = "bg-green-100 text-green-800";
  if (score >= 9) className = "bg-red-100 text-red-800";
  else if (score >= 6) className = "bg-orange-100 text-orange-800";
  else if (score >= 4) className = "bg-yellow-100 text-yellow-800";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${className}`}>
      {score}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════
// (BusinessProcessQuestionnaire removed — questions now driven by agent
//  and displayed per-business-process in the registry view)
// ════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface BPQuestionnaireProps {
  registry: RegistryProcess[];
  phase: string;
  onSubmit: (action: string, message?: string) => Promise<void>;
  sending: boolean;
}

/** 業務データから具体的な質問を自動生成 */
function generateQuestionsForProcess(bp: RegistryProcess, phase: string): { id: string; question: string; placeholder: string }[] {
  const qs: { id: string; question: string; placeholder: string }[] = [];

  if (phase === "phase1_discovery") {
    // Phase 1: 業務の確認・補完
    // 取得経路の深掘り
    for (const item of bp.items) {
      const method = item.acquisitionMethod?.toLowerCase() ?? "";
      if (method.includes("web") || method.includes("フォーム")) {
        qs.push({
          id: `${bp.id}_${item.id}_other_channels`,
          question: `「${bp.name}」の${item.dataCategory}はWebフォーム以外（電話・メール・FAX・対面等）でも受け取ることはありますか？`,
          placeholder: "例: 電話でも受け付けており、担当者がExcelに手入力している",
        });
      }
      if (!item.acquisitionMethod) {
        qs.push({
          id: `${bp.id}_${item.id}_how`,
          question: `「${bp.name}」で${item.dataCategory}はどのように入手していますか？`,
          placeholder: "例: 本人から直接メールで受領 / 取引先から提供される",
        });
      }
    }

    // 保管場所
    const noStorage = bp.items.filter(i => !i.storageLocation);
    if (noStorage.length > 0) {
      qs.push({
        id: `${bp.id}_storage`,
        question: `「${bp.name}」の情報はどこに保管していますか？`,
        placeholder: "例: Salesforce / 社内ファイルサーバー / 紙ファイル（施錠キャビネット）",
      });
    }

    // 委託先
    const noThirdParty = bp.items.filter(i => i.thirdParties.length === 0);
    if (noThirdParty.length > 0) {
      qs.push({
        id: `${bp.id}_outsource`,
        question: `「${bp.name}」で外部の委託先（クラウドサービス、業務委託先等）にデータを渡すことはありますか？`,
        placeholder: "例: 配送業者に氏名・住所を渡している / メール配信はMailchimpを利用",
      });
    }

    // 紙の有無
    const allDigital = bp.items.every(i => i.mediaType === "data" || !i.mediaType);
    if (allDigital) {
      qs.push({
        id: `${bp.id}_paper`,
        question: `「${bp.name}」で紙の書類（申込書、契約書、名刺等）を扱うことはありますか？`,
        placeholder: "例: 契約書は紙で署名後、スキャンしてデータ保管 / 名刺は箱に保管",
      });
    }

    // 削除・廃棄
    const noDisposal = bp.items.filter(i => !i.disposalMethod);
    if (noDisposal.length > 0) {
      qs.push({
        id: `${bp.id}_disposal`,
        question: `「${bp.name}」で不要になった情報はどのように廃棄していますか？`,
        placeholder: "例: 案件終了後にシステムから削除 / 紙はシュレッダー / 特に決まっていない",
      });
    }
  }

  if (phase === "phase2_deep_dive") {
    // Phase 2: より詳細な深掘り
    for (const item of bp.items) {
      if (!item.manager) {
        qs.push({
          id: `${bp.id}_${item.id}_manager`,
          question: `「${bp.name}」の${item.infoName ?? item.dataCategory}の管理責任者は誰ですか？`,
          placeholder: "例: 営業部長 / 総務課長",
        });
      }
      if (!item.accessiblePersons) {
        qs.push({
          id: `${bp.id}_${item.id}_access`,
          question: `「${bp.name}」の${item.infoName ?? item.dataCategory}にアクセスできるのは誰ですか？`,
          placeholder: "例: 営業部全員 / 担当者のみ / 全社員",
        });
      }
      if (!item.retentionPeriod) {
        qs.push({
          id: `${bp.id}_${item.id}_retention`,
          question: `「${bp.name}」の${item.infoName ?? item.dataCategory}の保管期間は決まっていますか？`,
          placeholder: "例: 取引終了後3年 / 退職後5年 / 特に決まっていない",
        });
      }
    }
  }

  // 質問がなければ「問題なし」のデフォルト質問
  if (qs.length === 0) {
    qs.push({
      id: `${bp.id}_ok`,
      question: `「${bp.name}」の内容に追加・修正はありますか？`,
      placeholder: "特になければ空欄でOK",
    });
  }

  return qs;
}

function BusinessProcessQuestionnaire({ registry, phase, onSubmit, sending }: BPQuestionnaireProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [currentBpIndex, setCurrentBpIndex] = useState(0);

  const currentBp = registry[currentBpIndex];
  if (!currentBp) return null;

  const questions = generateQuestionsForProcess(currentBp, phase);
  const isLastBp = currentBpIndex >= registry.length - 1;
  const nextAction = phase === "phase1_discovery" ? "proceed_to_phase2" : "proceed_to_phase3";
  const nextPhaseLabel = phase === "phase1_discovery" ? "深掘りへ進む（Phase 2）" : "リスク評価へ進む（Phase 3）";

  // 全質問が回答済みかスキップ済みか
  const allHandled = questions.every(q => (answers[q.id] !== undefined && answers[q.id] !== "") || skipped.has(q.id));

  function handleNext() {
    if (isLastBp) {
      // 全業務完了 → フィードバックをまとめてエージェントに送信
      const feedbackParts: string[] = [];
      for (const bp of registry) {
        const bpQs = generateQuestionsForProcess(bp, phase);
        for (const q of bpQs) {
          const a = answers[q.id];
          if (a && a.trim()) {
            feedbackParts.push(`【${bp.name}】${q.question}\n→ ${a}`);
          }
        }
      }
      const feedback = feedbackParts.length > 0 ? feedbackParts.join("\n\n") : undefined;
      onSubmit(nextAction, feedback);
    } else {
      setCurrentBpIndex(prev => prev + 1);
    }
  }

  return (
    <section className="bg-white rounded-lg border border-blue-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-blue-800">
          {phase === "phase1_discovery" ? "業務の確認" : "詳細の確認"}
        </h2>
        <span className="text-xs text-gray-500">
          {currentBpIndex + 1} / {registry.length} 業務
        </span>
      </div>

      {/* プログレスバー */}
      <div className="w-full h-1.5 bg-gray-200 rounded-full mb-4">
        <div
          className="h-1.5 bg-blue-500 rounded-full transition-all"
          style={{ width: `${((currentBpIndex + 1) / registry.length) * 100}%` }}
        />
      </div>

      {/* 業務サマリー */}
      <div className="bg-blue-50 rounded-lg p-3 mb-4">
        <p className="font-medium text-gray-900">{currentBp.name}</p>
        {currentBp.department && <p className="text-xs text-gray-500">{currentBp.department}</p>}
        {currentBp.description && <p className="text-sm text-gray-600 mt-1">{currentBp.description}</p>}
        <div className="flex flex-wrap gap-1 mt-2">
          {currentBp.items.map(item => (
            <span key={item.id} className="text-xs bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-700">
              {item.infoName ?? item.dataCategory}
            </span>
          ))}
        </div>
      </div>

      {/* 質問リスト */}
      <div className="space-y-3">
        {questions.map(q => (
          <div key={q.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
            <p className="text-sm font-medium text-gray-800 mb-2">{q.question}</p>
            <div className="flex gap-2">
              <input
                value={answers[q.id] ?? ""}
                onChange={e => {
                  setAnswers(prev => ({ ...prev, [q.id]: e.target.value }));
                  setSkipped(prev => { const next = new Set(prev); next.delete(q.id); return next; });
                }}
                placeholder={q.placeholder}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => setSkipped(prev => new Set(prev).add(q.id))}
                className={`px-3 py-2 rounded-lg text-xs border transition flex-shrink-0 ${
                  skipped.has(q.id)
                    ? "bg-gray-200 border-gray-400 text-gray-700"
                    : "border-gray-300 text-gray-500 hover:bg-gray-100"
                }`}
              >
                {skipped.has(q.id) ? "特になし" : "なし"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ナビゲーション */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setCurrentBpIndex(prev => Math.max(0, prev - 1))}
          disabled={currentBpIndex === 0}
          className="text-sm text-gray-500 hover:text-gray-700 disabled:invisible"
        >
          ← 前の業務
        </button>
        <button
          onClick={handleNext}
          disabled={sending || !allHandled}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {sending ? "送信中..." : isLastBp ? nextPhaseLabel : `次の業務へ →`}
        </button>
      </div>
    </section>
  );
}
