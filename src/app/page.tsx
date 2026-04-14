"use client";

import { useState, useRef } from "react";

export default function Home() {
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleStart() {
    if (!companyName) return;
    setIsStarting(true);
    try {
      // 1. ファイルアップロード
      let uploadedFiles: { name: string; path: string; description: string }[] = [];
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach(f => formData.append("files", f));
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
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
        body: JSON.stringify({ companyName, companyUrl, files: uploadedFiles }),
      });
      const data = await res.json();
      window.location.href = `/dashboard?sessionId=${data.sessionId}`;
    } catch (e) {
      console.error(e);
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
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          AIPmark
        </h1>
        <p className="text-gray-500 mb-8">
          Pマーク取得支援AIエージェント
        </p>

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

          <button
            onClick={handleStart}
            disabled={!companyName || isStarting}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isStarting ? "調査を開始中..." : "AI調査を開始"}
          </button>
        </div>
      </div>
    </main>
  );
}
