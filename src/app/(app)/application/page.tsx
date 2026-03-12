import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function ApplicationPage() {
  return (
    <div>
      <PageHeader
        title="申請・更新管理"
        description="プライバシーマークの新規申請・更新申請パッケージを生成・管理します。"
        badge="実装予定"
        actions={
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium opacity-50 cursor-not-allowed" disabled>
            + 申請パッケージ生成
          </button>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "現在のPマーク番号", value: "未登録" },
          { label: "登録有効期限", value: "未設定" },
          { label: "次回更新期限", value: "未設定" },
          { label: "申請準備状況", value: "0%" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500 mb-1">{stat.label}</div>
            <div className="text-lg font-bold text-slate-400">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <div className="col-span-2">パッケージ名</div>
          <div>種別</div>
          <div>生成日</div>
          <div>ステータス</div>
        </div>
        <EmptyState
          icon="📝"
          title="申請パッケージがありません"
          description="台帳・リスク・教育記録が整備されると、申請パッケージを自動生成できます。"
        />
      </div>
    </div>
  );
}
