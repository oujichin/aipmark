"use client";

import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const EXAMPLE_PROMPTS = [
  "この業務プロセスにはどんなリスクがありますか？",
  "JIS Q 15001の「法的根拠」とはどういう意味ですか？",
  "個人情報の保存期間はどう決めればよいですか？",
  "委託先への個人情報提供時に必要な手続きを教えてください。",
  "台帳整備で最初に何をすればよいですか？",
];

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${isUser ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
        {isUser ? "U" : "✨"}
      </div>
      <div className={`max-w-2xl rounded-2xl px-4 py-3 text-sm ${isUser ? "bg-blue-600 text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"}`}>
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}

export default function AISupportPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "こんにちは！AIPmark5のAIアシスタントです。プライバシーマーク管理に関するご質問にお答えします。\n\n台帳整備・リスク管理・JIS Q 15001の解釈・Pマーク申請準備など、お気軽にご質問ください。",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return;
    setError("");

    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setMessages([...newMessages, { role: "assistant", content: data.content }]);
      }
    } catch {
      setError("通信エラーが発生しました。");
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white text-sm">✨</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">AI支援</h1>
            <p className="text-xs text-slate-500">Gemini 2.0 Flash (Google) によるPMS支援アシスタント</p>
          </div>
          <div className="ml-auto flex gap-2">
            <a href="/register/hearing" className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium">
              台帳候補生成
            </a>
            <a href="/risk" className="text-xs px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
              リスク候補生成
            </a>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-slate-50">
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm">✨</div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {error}
            {error.includes("GOOGLE_API_KEY") && (
              <p className="mt-1 text-xs">→ .env.local に GOOGLE_API_KEY を設定してください。</p>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Example prompts */}
      {messages.length <= 1 && (
        <div className="px-6 py-3 bg-white border-t border-slate-100">
          <p className="text-xs text-slate-400 mb-2">例示プロンプト:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="text-xs px-3 py-1.5 border border-slate-200 rounded-full hover:bg-slate-50 text-slate-600 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 bg-white border-t border-slate-200 shrink-0">
        <div className="flex gap-3">
          <textarea
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
            placeholder="メッセージを入力... (Shift+Enter で送信)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            送信
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5 text-right">Shift+Enter で送信 · 個人情報は自動でマスク処理されます · Gemini 2.0 Flash</p>
      </div>
    </div>
  );
}
