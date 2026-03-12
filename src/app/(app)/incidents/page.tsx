import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function IncidentsPage() {
  return (
    <div>
      <PageHeader
        title="インシデント対応"
        description="個人情報に関するインシデントの報告・対応・再発防止策を管理します。"
        badge="実装予定"
        actions={
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium opacity-50 cursor-not-allowed" disabled>
            + インシデント報告
          </button>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <div className="col-span-2">インシデント内容</div>
          <div>発生日</div>
          <div>深刻度</div>
          <div>対応期限</div>
          <div>ステータス</div>
        </div>
        <EmptyState
          icon="🚨"
          title="インシデントがありません"
          description="個人情報に関するインシデントが発生した場合、速やかに報告・対応を行います。"
        />
      </div>
    </div>
  );
}
