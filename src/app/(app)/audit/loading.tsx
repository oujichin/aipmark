export default function AuditLoading() {
  return (
    <div>
      {/* PageHeader スケルトン */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-7 w-48 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="h-9 w-36 bg-slate-200 rounded-lg animate-pulse" />
      </div>

      {/* サマリーカード 4列 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { color: "bg-blue-50 border-blue-200" },
          { color: "bg-orange-50 border-orange-200" },
          { color: "bg-purple-50 border-purple-200" },
          { color: "bg-green-50 border-green-200" },
        ].map((card, i) => (
          <div
            key={i}
            className={`rounded-xl border px-4 py-3 ${card.color}`}
          >
            <div className="h-3 w-20 bg-slate-200 rounded animate-pulse mb-2" />
            <div className="h-7 w-12 bg-slate-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* 左右2分割: 監査計画テーブル + 是正処置テーブル */}
      <div className="grid grid-cols-2 gap-6">
        {/* 監査計画テーブル */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* ヘッダー */}
            <div className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50">
              <div className="h-3 w-14 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-10 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-12 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
            </div>
            {/* 行 x5 */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-slate-50 last:border-0"
              >
                <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-12 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-8 bg-slate-200 rounded animate-pulse" />
                <div className="h-5 w-14 bg-slate-200 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* 是正処置テーブル */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
            <div className="h-6 w-20 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* ヘッダー */}
            <div className="grid grid-cols-3 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50">
              <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-10 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-10 bg-slate-200 rounded animate-pulse" />
            </div>
            {/* 行 x5 */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-3 gap-4 px-4 py-3 border-b border-slate-50 last:border-0"
              >
                <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
                <div className="h-5 w-14 bg-slate-200 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
