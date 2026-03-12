import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function DocumentsPage() {
  const folders = [
    { name: "規程・ポリシー", icon: "📄", count: 0 },
    { name: "同意書・フォーム", icon: "📋", count: 0 },
    { name: "研修資料", icon: "📚", count: 0 },
    { name: "監査記録", icon: "🔍", count: 0 },
    { name: "インシデント報告", icon: "🚨", count: 0 },
    { name: "その他", icon: "📁", count: 0 },
  ];

  return (
    <div>
      <PageHeader
        title="文書・エビデンス管理"
        description="PMS関連文書・証跡ファイルを一元管理します。"
        badge="実装予定"
        actions={
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium opacity-50 cursor-not-allowed" disabled>
            + 文書アップロード
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {folders.map((folder) => (
          <div
            key={folder.name}
            className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 hover:border-slate-300 transition-colors cursor-not-allowed opacity-60"
          >
            <span className="text-2xl">{folder.icon}</span>
            <div>
              <div className="text-sm font-medium text-slate-700">{folder.name}</div>
              <div className="text-xs text-slate-400">{folder.count}件</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <EmptyState
          icon="📁"
          title="文書がありません"
          description="文書・エビデンスをアップロードして一元管理できます。"
        />
      </div>
    </div>
  );
}
