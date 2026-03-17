export default function AppLoading() {
  return (
    <div>
      {/* PageHeader スケルトン */}
      <div className="mb-6">
        <div className="h-7 w-48 bg-slate-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-80 bg-slate-200 rounded animate-pulse" />
      </div>

      {/* テーブルスケルトン */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* ヘッダー行 */}
        <div className="flex gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
        </div>

        {/* データ行 x5 */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 px-4 py-3 border-b border-slate-50 last:border-0"
          >
            <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
