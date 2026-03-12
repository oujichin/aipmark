"use client";

import { signOut } from "next-auth/react";
import { DEMO_USERS, ROLE_LABELS } from "@/lib/auth";
import { signIn } from "next-auth/react";

interface HeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    role: string;
  };
  roleLabel: string;
}

const ROLE_COLORS: Record<string, string> = {
  PRIVACY_OFFICER: "bg-blue-100 text-blue-700",
  DEPT_STAFF: "bg-green-100 text-green-700",
  TOP_MANAGEMENT: "bg-purple-100 text-purple-700",
  GLOBAL_ADMIN: "bg-red-100 text-red-700",
  AUDITOR: "bg-orange-100 text-orange-700",
};

export function Header({ user, roleLabel }: HeaderProps) {
  async function handleRoleSwitch(email: string) {
    await signIn("credentials", {
      email,
      password: "demo1234",
      redirect: true,
      callbackUrl: "/dashboard",
    });
  }

  const colorClass = ROLE_COLORS[user.role] ?? "bg-slate-100 text-slate-700";

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      {/* Left: Role badge */}
      <div className="flex items-center gap-3">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colorClass}`}>
          {roleLabel}
        </span>
        <span className="text-sm text-slate-600">{user.name}</span>
      </div>

      {/* Right: Role switcher + Logout */}
      <div className="flex items-center gap-3">
        {/* Role Switcher (Demo) */}
        <div className="relative group">
          <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors">
            <span>ロール切替</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
            <div className="px-3 py-2 text-xs text-slate-400 font-medium uppercase tracking-wide border-b border-slate-100 mb-1">
              デモアカウント切替
            </div>
            {DEMO_USERS.map((u) => (
              <button
                key={u.email}
                onClick={() => handleRoleSwitch(u.email)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 text-left"
              >
                <div className={`w-2 h-2 rounded-full ${u.email === user.email ? "bg-blue-500" : "bg-slate-200"}`} />
                <div>
                  <div className="font-medium text-slate-800 text-xs">{u.name}</div>
                  <div className="text-slate-400 text-xs">{ROLE_LABELS[u.role]}</div>
                </div>
                {u.email === user.email && (
                  <span className="ml-auto text-blue-500 text-xs">現在</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors border border-slate-200"
        >
          ログアウト
        </button>
      </div>
    </header>
  );
}
