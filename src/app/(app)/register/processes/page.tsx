"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

interface Department { id: string; name: string; }
interface Process {
  id: string;
  name: string;
  description: string;
  department: Department;
  status: string;
  _count: { registerItems: number };
}

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", departmentId: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/register/processes").then((r) => r.json()),
      fetch("/api/register/departments").then((r) => r.json()),
    ]).then(([procs, depts]) => {
      setProcesses(procs);
      setDepartments(depts);
      setLoading(false);
    });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/register/processes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const created = await res.json();
      setProcesses((prev) => [...prev, created]);
      setForm({ name: "", description: "", departmentId: "" });
      setShowForm(false);
    }
    setSaving(false);
  }

  return (
    <div>
      <PageHeader
        title="業務プロセス管理"
        description="個人情報を取り扱う業務プロセスを登録します。各プロセスに対してヒアリングと台帳整備を行います。"
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + 業務プロセス追加
          </button>
        }
      />

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">業務プロセス追加</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">プロセス名 *</label>
                <input
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例：顧客情報管理"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">説明</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="このプロセスで取り扱う個人情報の概要を記載..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">担当部門 *</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  required
                >
                  <option value="">部門を選択...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "保存中..." : "追加"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process list */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">読み込み中...</div>
      ) : processes.length === 0 ? (
        <EmptyState icon="⚙" title="業務プロセスが未登録です" description="「業務プロセス追加」ボタンから登録してください。" />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {processes.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-sm font-semibold text-slate-800">{p.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      {p.department.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      台帳 {p._count.registerItems}件
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{p.description}</p>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <Link
                    href={`/register/hearing?processId=${p.id}`}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                  >
                    ヒアリング
                  </Link>
                  <Link
                    href={`/register/items?processId=${p.id}`}
                    className="text-xs px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    台帳
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Next steps hint */}
      {processes.length > 0 && (
        <div className="mt-6 bg-blue-50 rounded-xl border border-blue-100 p-4">
          <p className="text-sm text-blue-700 font-medium mb-1">次のステップ</p>
          <p className="text-xs text-blue-600">
            業務プロセスを選択して「ヒアリング」をクリックすると、AI支援付きのヒアリング・台帳候補生成フローに進めます。
          </p>
        </div>
      )}
    </div>
  );
}
