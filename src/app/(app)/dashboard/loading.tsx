export default function DashboardLoading() {
  return (
    <div>
      {/* Welcome ヘッダー */}
      <div className="mb-6">
        <div className="h-7 w-40 bg-slate-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-slate-200 rounded animate-pulse" />
      </div>

      {/* サマリーカード 4列 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200 p-4"
          >
            <div className="h-3 w-24 bg-slate-200 rounded animate-pulse mb-2" />
            <div className="h-7 w-16 bg-slate-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* モジュール別ステータス 2x4 グリッド */}
      <div className="mb-6">
        <div className="h-4 w-36 bg-slate-200 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-5 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-slate-200 ml-auto animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 w-8 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 w-8 bg-slate-200 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 下部: テーブルスケルトン 2列 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 台帳整備進捗 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-12 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <div className="h-3 w-28 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full w-1/2 bg-slate-200 rounded-full animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ロール別タスク */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="h-4 w-28 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
              >
                <div className="h-6 w-6 bg-slate-200 rounded animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-28 bg-slate-200 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 活動ログ */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 col-span-2">
          <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0"
              >
                <div className="w-6 h-6 rounded-full bg-slate-200 animate-pulse shrink-0" />
                <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-48 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
