"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    label: "ダッシュボード",
    href: "/dashboard",
    icon: "⊞",
  },
  {
    label: "会社プロファイル",
    href: "/company",
    icon: "🏛",
    badge: "実装済",
    children: [
      { label: "基本情報・AI調査", href: "/company/profile" },
    ],
  },
  {
    label: "個人データ台帳",
    href: "/register",
    icon: "📋",
    badge: "実装済",
    children: [
      { label: "業務プロセス", href: "/register/processes" },
      { label: "ヒアリング", href: "/register/hearing" },
      { label: "台帳一覧", href: "/register/items" },
      { label: "承認", href: "/register/approvals" },
      { label: "エクスポート", href: "/register/export" },
    ],
  },
  {
    label: "リスク管理",
    href: "/risk",
    icon: "⚠",
    badge: "予定",
  },
  {
    label: "文書・エビデンス",
    href: "/documents",
    icon: "📁",
    badge: "予定",
  },
  {
    label: "教育管理",
    href: "/training",
    icon: "🎓",
    badge: "予定",
  },
  {
    label: "ベンダー管理",
    href: "/vendors",
    icon: "🏢",
    badge: "予定",
  },
  {
    label: "内部監査・是正",
    href: "/audit",
    icon: "🔍",
    badge: "予定",
  },
  {
    label: "インシデント対応",
    href: "/incidents",
    icon: "🚨",
    badge: "予定",
  },
  {
    label: "申請・更新",
    href: "/application",
    icon: "📝",
    badge: "予定",
  },
  {
    label: "AI支援",
    href: "/ai-support",
    icon: "✨",
    badge: "実装済",
  },
  {
    label: "管理者設定",
    href: "/settings",
    icon: "⚙",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">P</span>
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">AIPmark5</div>
            <div className="text-xs text-slate-400">PMS管理システム</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const isParentActive = item.children && pathname.startsWith(item.href);

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors group ${
                  isActive && !item.children
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : isParentActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      item.badge === "実装済"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>

              {/* Sub-items */}
              {item.children && isParentActive && (
                <div className="ml-4 mt-0.5 space-y-0.5 pl-3 border-l border-slate-100">
                  {item.children.map((child) => {
                    const isChildActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`block px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          isChildActive
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        }`}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-100">
        <div className="text-xs text-slate-400 text-center">デモ版 v0.1.0</div>
      </div>
    </aside>
  );
}
