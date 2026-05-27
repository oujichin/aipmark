export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <a href="/" className="text-lg font-bold text-gray-900">AIPmark</a>
        <span className="text-sm text-gray-500">Pマーク取得支援AI</span>
      </header>
      <main className="max-w-6xl mx-auto py-6 px-4">
        {children}
      </main>
    </div>
  );
}
