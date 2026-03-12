import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function RiskPage() {
  return (
    <div>
      <PageHeader
        title="リスク管理"
        description="個人情報に関するリスクの識別・評価・対応策を管理します。"
        badge="実装予定"
        actions={
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium opacity-50 cursor-not-allowed" disabled>
            + 新規リスク追加
          </button>
        }
      />

      {/* Table skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <div className="col-span-2">リスク内容</div>
          <div>対象業務</div>
          <div>深刻度</div>
          <div>対応状況</div>
          <div>更新日</div>
        </div>
        <EmptyState
          icon="🛡"
          title="リスク情報がありません"
          description="個人データ台帳が整備されると、リスク候補がAIによって自動提案されます。"
        />
      </div>
    </div>
  );
}
