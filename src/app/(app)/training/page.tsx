import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function TrainingPage() {
  const months = ["4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月"];

  return (
    <div>
      <PageHeader
        title="教育管理"
        description="個人情報保護に関する教育・研修の計画・実施・記録を管理します。"
        badge="実装予定"
        actions={
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium opacity-50 cursor-not-allowed" disabled>
            + 教育計画追加
          </button>
        }
      />

      {/* Year calendar skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="text-sm font-medium text-slate-600 mb-3">年間教育計画カレンダー（2025年度）</div>
        <div className="grid grid-cols-12 gap-1">
          {months.map((month) => (
            <div key={month} className="text-center">
              <div className="text-xs text-slate-400 mb-1">{month}</div>
              <div className="h-12 bg-slate-50 rounded-lg border border-slate-100" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <div className="col-span-2">研修名</div>
          <div>対象者</div>
          <div>実施予定日</div>
          <div>実施状況</div>
        </div>
        <EmptyState
          icon="🎓"
          title="教育計画がありません"
          description="年間の教育研修計画を登録して、実施状況を管理できます。"
        />
      </div>
    </div>
  );
}
