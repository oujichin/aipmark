"use client";

import { useEffect, useState, useRef } from "react";

interface RecentSession {
  id: string;
  status: string;
  phase: string;
  createdAt: string;
  updatedAt: string;
  company: {
    name: string;
    url: string | null;
  };
  questions: { id: string }[];
}

interface SourceDocumentSummary {
  folderPath: string;
  total: number;
  categories: Record<string, number>;
}

export default function Home() {
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [startedSessionId, setStartedSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [sourceFolderPath, setSourceFolderPath] = useState("templates/pmark");
  const [useTemplateFolder, setUseTemplateFolder] = useState(true);
  const [sourceSummary, setSourceSummary] = useState<SourceDocumentSummary | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/sessions")
      .then(res => res.ok ? res.json() : [])
      .then(data => setRecentSessions(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => setRecentSessions([]));
  }, []);

  const scanSourceFolder = async (folderPath = sourceFolderPath) => {
    if (!folderPath) return;
    setSourceLoading(true);
    try {
      const res = await fetch("/api/source-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "資料フォルダを確認できませんでした");
      setSourceSummary(data);
    } catch {
      setSourceSummary(null);
    } finally {
      setSourceLoading(false);
    }
  };

  useEffect(() => {
    scanSourceFolder();
    // 初期表示時だけ既定フォルダを確認する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStart() {
    if (!companyName) return;
    setIsStarting(true);
    setErrorMessage(null);
    try {
      // 1. ファイルアップロード
      let uploadedFiles: { name: string; path: string; description: string }[] = [];
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach(f => formData.append("files", f));
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) throw new Error("ファイルアップロードに失敗しました");
        const uploadData = await uploadRes.json();
        uploadedFiles = uploadData.files.map((f: { name: string; path: string }) => ({
          ...f,
          description: f.name,
        }));
      }

      // 2. セッション作成
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          companyUrl,
          files: uploadedFiles,
          useSourceFolder: useTemplateFolder,
          sourceFolderPath,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error ?? "セッション作成に失敗しました");
      }
      const data = await res.json();
      if (!data.sessionId) throw new Error("セッションIDが返りませんでした");
      setStartedSessionId(data.sessionId);
      window.location.assign(`/dashboard?sessionId=${data.sessionId}`);
    } catch (e) {
      console.error(e);
      setErrorMessage(e instanceof Error ? e.message : "開始に失敗しました");
      setIsStarting(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...dropped]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">AIPmark</h1>
          <p className="text-gray-500 mt-1">
            過去申請資料をテンプレートにして、対象会社のPMSをAIエージェントとイチから構築します。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">作成ワークフロー</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <WorkflowColumn
                title="Pマーク審査申請"
                items={["HP等の顧客データ確認", "ヒアリング", "基本情報整理", "取扱業務の洗い出し", "個人情報管理台帳", "必要PMS文書の洗い出し", "申請書提出"]}
              />
              <WorkflowColumn
                title="PMS文書の評価"
                items={["様式A/B/Cの疑似審査", "保護規程の修正", "各種PMS文書の修正", "不足文書の作成", "審査機関の指摘対応"]}
              />
              <WorkflowColumn
                title="補正審査準備"
                items={["認定審査の流れ確認", "トップインタビュー想定問答", "安全管理措置の内容確認", "審査当日の準備"]}
              />
            </div>
          </section>

          <section className="bg-white rounded-lg border border-gray-200 p-5 row-span-2">
            <h2 className="font-semibold text-gray-900 mb-4">新しい調査を開始</h2>

        {recentSessions.length > 0 && (
          <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-800">前回の続き</p>
            </div>
            <div className="divide-y divide-gray-100">
              {recentSessions.map(session => (
                <a
                  key={session.id}
                  href={`/dashboard?sessionId=${session.id}`}
                  className="block px-3 py-3 hover:bg-blue-50 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{session.company.name}</p>
                      <p className="text-xs text-gray-500">
                        {phaseLabel(session.phase)} / {statusLabel(session.status)}
                        {session.questions.length > 0 ? ` / 確認待ち ${session.questions.length}件` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-blue-600 flex-shrink-0">開く</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              企業名
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="株式会社○○"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              企業HP URL
            </label>
            <input
              type="url"
              value={companyUrl}
              onChange={e => setCompanyUrl(e.target.value)}
              placeholder="https://example.co.jp"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              資料アップロード（任意）
            </label>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-400 text-sm cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
            >
              {files.length > 0 ? (
                <div className="space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-gray-700 text-xs">
                      <span>{f.name}</span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setFiles(prev => prev.filter((_, j) => j !== i));
                        }}
                        className="text-red-400 hover:text-red-600 ml-2"
                      >
                        x
                      </button>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 mt-2">クリックで追加</p>
                </div>
              ) : (
                <>
                  ドラッグ&ドロップ または クリックしてファイルを選択
                  <br />
                  <span className="text-xs">Excel, Word, PDF に対応</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xlsx,.xls,.docx,.doc,.pdf,.txt,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={useTemplateFolder}
                onChange={e => setUseTemplateFolder(e.target.checked)}
              />
              過去申請資料をテンプレートとして使う
            </label>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={sourceFolderPath}
                onChange={e => setSourceFolderPath(e.target.value)}
                className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => scanSourceFolder()}
                className="px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-white"
              >
                確認
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-600">
              {sourceLoading && "資料フォルダを確認中..."}
              {!sourceLoading && sourceSummary && (
                <div>
                  <p>{sourceSummary.total}件のテンプレート資料を検出しました。</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(sourceSummary.categories).map(([category, count]) => (
                      <span key={category} className="px-2 py-1 rounded bg-white border border-gray-200">
                        {category} {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {!sourceLoading && !sourceSummary && (
                <p className="text-orange-700">資料フォルダを確認できません。パスを確認してください。</p>
              )}
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!companyName || isStarting}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isStarting ? "調査を開始中..." : "AI調査を開始"}
          </button>

          {startedSessionId && (
            <a
              href={`/dashboard?sessionId=${startedSessionId}`}
              className="block text-center text-sm text-blue-600 hover:underline"
            >
              ダッシュボードを開く
            </a>
          )}

          {errorMessage && (
            <p className="text-sm text-red-600 text-center">{errorMessage}</p>
          )}
        </div>
          </section>

          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">テンプレートの扱い</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
              <InfoBlock title="構成だけ参照" text="過去の審査申請書、PMS文書、台帳、規程は章立て・項目・記載粒度の見本として使います。" />
              <InfoBlock title="事実は新規作成" text="会社名、業務、個人情報、委託先、リスク、証跡は対象会社HP・ヒアリング・今回入力から作ります。" />
              <InfoBlock title="文書を一式生成" text="申請様式、個人情報管理台帳、PMS文書一覧、規程、リスク分析、教育・監査記録を今回データで作成します。" />
              <InfoBlock title="補正まで追跡" text="様式A/B/Cの評価観点をテンプレートに、指摘対応・不足文書・トップインタビュー準備まで同じセッションで進めます。" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function WorkflowColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <h3 className="font-medium text-gray-900 mb-2">{title}</h3>
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={item} className="flex gap-2 text-gray-700">
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center flex-shrink-0">
              {index + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="border-l-2 border-blue-500 pl-3">
      <h3 className="font-medium text-gray-900">{title}</h3>
      <p className="text-gray-600 mt-1">{text}</p>
    </div>
  );
}

function phaseLabel(phase: string) {
  const labels: Record<string, string> = {
    phase0_company_profile: "基本情報収集中",
    phase1_discovery: "業務洗い出し",
    phase2_deep_dive: "台帳深掘り",
    phase3_risk_pms: "リスク分析",
    phase4_export: "帳票出力",
    completed: "完了",
  };
  return labels[phase] ?? phase;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    running: "実行中",
    idle: "待機中",
    waiting_for_answers: "回答待ち",
    completed: "完了",
  };
  return labels[status] ?? status;
}
