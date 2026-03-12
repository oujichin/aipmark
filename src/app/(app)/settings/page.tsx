import { PageHeader } from "@/components/ui/page-header";
import { DEMO_USERS, ROLE_LABELS } from "@/lib/auth";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="管理者設定"
        description="組織情報・ユーザー管理・システム設定を行います。"
      />

      <div className="grid grid-cols-2 gap-6">
        {/* Organization Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">組織情報</h2>
          <dl className="space-y-3">
            {[
              { label: "組織名", value: "デモ株式会社" },
              { label: "組織コード", value: "org-demo" },
              { label: "業種", value: "情報通信業（デモ）" },
              { label: "Pマーク番号", value: "未登録" },
            ].map((item) => (
              <div key={item.label} className="flex gap-4">
                <dt className="text-xs text-slate-500 w-28 shrink-0 pt-0.5">{item.label}</dt>
                <dd className="text-sm text-slate-800">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* User List */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">ユーザー一覧（デモ）</h2>
          <div className="space-y-3">
            {DEMO_USERS.map((user) => (
              <div key={user.email} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600">
                  {user.name[0]}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-800">{user.name}</div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* System Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">システム情報</h2>
          <dl className="space-y-3">
            {[
              { label: "バージョン", value: "0.1.0 (MVP デモ版)" },
              { label: "データベース", value: "SQLite (ローカル)" },
              { label: "AIエンジン", value: "Gemini 2.0 Flash (Google)" },
              { label: "フレームワーク", value: "Next.js 15 (App Router)" },
            ].map((item) => (
              <div key={item.label} className="flex gap-4">
                <dt className="text-xs text-slate-500 w-28 shrink-0 pt-0.5">{item.label}</dt>
                <dd className="text-sm text-slate-800">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
