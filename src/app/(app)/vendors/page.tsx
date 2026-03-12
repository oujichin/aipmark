import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function VendorsPage() {
  return (
    <div>
      <PageHeader
        title="ベンダー管理"
        description="個人情報を取り扱う委託先ベンダーの評価・管理を行います。"
        badge="実装予定"
        actions={
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium opacity-50 cursor-not-allowed" disabled>
            + ベンダー登録
          </button>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <div className="col-span-2">ベンダー名</div>
          <div>委託内容</div>
          <div>評価ステータス</div>
          <div>契約満了日</div>
          <div>操作</div>
        </div>
        <EmptyState
          icon="🏢"
          title="ベンダー情報がありません"
          description="個人情報の取り扱いを委託しているベンダーを登録・評価管理します。"
        />
      </div>
    </div>
  );
}
