import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function AuditPage() {
  return (
    <div>
      <PageHeader
        title="内部監査・是正処置"
        description="内部監査の計画・実施・是正処置の管理を行います。"
        badge="実装予定"
      />

      <div className="grid grid-cols-2 gap-6">
        {/* Audit Plans */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">監査計画</h2>
            <button className="text-xs text-blue-600 hover:text-blue-700 opacity-50 cursor-not-allowed" disabled>
              + 新規追加
            </button>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-3 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500">
              <div>監査名</div>
              <div>予定日</div>
              <div>ステータス</div>
            </div>
            <EmptyState
              icon="🔍"
              title="監査計画なし"
              description="内部監査の計画を登録します。"
            />
          </div>
        </div>

        {/* Corrective Actions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">是正処置</h2>
            <button className="text-xs text-blue-600 hover:text-blue-700 opacity-50 cursor-not-allowed" disabled>
              + 新規追加
            </button>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-3 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500">
              <div>不適合内容</div>
              <div>期限</div>
              <div>進捗</div>
            </div>
            <EmptyState
              icon="✅"
              title="是正処置なし"
              description="監査で発見した不適合に対する是正処置を管理します。"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
