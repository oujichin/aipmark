"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { DEMO_USERS, ROLE_LABELS } from "@/lib/auth";
import type { DataFieldMasterRecord, MasterRecord } from "@/lib/personal-data";

type CategoryForm = {
  code: string;
  name: string;
  description: string;
  isSensitive: boolean;
};

type FieldForm = {
  code: string;
  name: string;
  description: string;
  categoryHint: string;
  isSensitive: boolean;
  isSpecificPerson: boolean;
};

const emptyCategoryForm: CategoryForm = {
  code: "",
  name: "",
  description: "",
  isSensitive: false,
};

const emptyFieldForm: FieldForm = {
  code: "",
  name: "",
  description: "",
  categoryHint: "",
  isSensitive: false,
  isSpecificPerson: false,
};

export default function SettingsPage() {
  const [categories, setCategories] = useState<MasterRecord[]>([]);
  const [fields, setFields] = useState<DataFieldMasterRecord[]>([]);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);
  const [fieldForm, setFieldForm] = useState<FieldForm>(emptyFieldForm);
  const [editingCategoryCode, setEditingCategoryCode] = useState<string | null>(null);
  const [editingFieldCode, setEditingFieldCode] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function loadMasters() {
    const [categoryRows, fieldRows] = await Promise.all([
      fetch("/api/master/data-categories").then((r) => r.json()),
      fetch("/api/master/data-fields").then((r) => r.json()),
    ]);
    setCategories(categoryRows);
    setFields(fieldRows);
  }

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function saveCategory() {
    const url = editingCategoryCode
      ? `/api/master/data-categories/${editingCategoryCode}`
      : "/api/master/data-categories";
    const method = editingCategoryCode ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(categoryForm),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "カテゴリ保存に失敗しました。" }));
      alert(data.error ?? "カテゴリ保存に失敗しました。");
      return;
    }

    await loadMasters();
    setCategoryForm(emptyCategoryForm);
    setEditingCategoryCode(null);
    setMessage("個人情報区分マスタを更新しました。");
  }

  async function saveField() {
    const url = editingFieldCode
      ? `/api/master/data-fields/${editingFieldCode}`
      : "/api/master/data-fields";
    const method = editingFieldCode ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fieldForm),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "項目保存に失敗しました。" }));
      alert(data.error ?? "項目保存に失敗しました。");
      return;
    }

    await loadMasters();
    setFieldForm(emptyFieldForm);
    setEditingFieldCode(null);
    setMessage("個人情報項目マスタを更新しました。");
  }

  async function deleteCategory(code: string) {
    const res = await fetch(`/api/master/data-categories/${code}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "カテゴリ削除に失敗しました。" }));
      alert(data.error ?? "カテゴリ削除に失敗しました。");
      return;
    }
    await loadMasters();
    setMessage("個人情報区分マスタを削除しました。");
  }

  async function deleteField(code: string) {
    const res = await fetch(`/api/master/data-fields/${code}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "項目削除に失敗しました。" }));
      alert(data.error ?? "項目削除に失敗しました。");
      return;
    }
    await loadMasters();
    setMessage("個人情報項目マスタを削除しました。");
  }

  return (
    <div>
      <PageHeader
        title="管理者設定"
        description="組織情報・ユーザー管理・個人情報マスタ管理を行います。"
      />

      {message && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">組織情報</h2>
          <dl className="space-y-3">
            {[
              { label: "組織名", value: "デモ株式会社" },
              { label: "組織コード", value: "org-demo" },
              { label: "業種", value: "情報通信業（デモ）" },
              { label: "Pマーク番号", value: "未登録" },
            ].map((item) => (
              <div key={item.label} className="flex gap-4">
                <dt className="text-xs text-slate-500 w-28 shrink-0 pt-0.5">{item.label}</dt>
                <dd className="text-sm text-slate-800">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">ユーザー一覧（デモ）</h2>
          <div className="space-y-3">
            {DEMO_USERS.map((user) => (
              <div key={user.email} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600">
                  {user.name[0]}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-800">{user.name}</div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 col-span-2">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">個人情報区分マスタ</h2>
              <p className="text-xs text-slate-500 mt-1">一般個人情報、要配慮個人情報、特定個人情報など、PMS上の区分を管理します。</p>
            </div>
            <span className="text-xs text-slate-400">変更は個人情報管理者/システム管理者のみ</span>
          </div>

          <div className="grid grid-cols-[1.2fr_0.8fr] gap-6">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">コード</th>
                    <th className="px-4 py-3 text-left">名称</th>
                    <th className="px-4 py-3 text-left">機微</th>
                    <th className="px-4 py-3 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((item) => (
                    <tr key={item.code} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.code}</td>
                      <td className="px-4 py-3 text-slate-800">
                        <div>{item.name}</div>
                        {item.description && <div className="text-xs text-slate-500 mt-1">{item.description}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{item.isSensitive ? "要配慮あり" : "通常"}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex gap-3">
                          <button
                            className="text-blue-600 hover:text-blue-700"
                            onClick={() => {
                              setEditingCategoryCode(item.code);
                              setCategoryForm({
                                code: item.code,
                                name: item.name,
                                description: item.description ?? "",
                                isSensitive: Boolean(item.isSensitive),
                              });
                            }}
                          >
                            編集
                          </button>
                          <button className="text-red-600 hover:text-red-700" onClick={() => deleteCategory(item.code)}>削除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">{editingCategoryCode ? "区分を編集" : "区分を追加"}</h3>
              <div className="space-y-3">
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="コード" value={categoryForm.code} onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value.toUpperCase() })} />
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="名称" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
                <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none" rows={3} placeholder="説明" value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={categoryForm.isSensitive} onChange={(e) => setCategoryForm({ ...categoryForm, isSensitive: e.target.checked })} />
                  要配慮区分として扱う
                </label>
                <div className="flex justify-end gap-3 pt-2">
                  {editingCategoryCode && <button className="text-sm text-slate-500" onClick={() => { setEditingCategoryCode(null); setCategoryForm(emptyCategoryForm); }}>キャンセル</button>}
                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={saveCategory}>保存</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 col-span-2">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">個人情報項目マスタ</h2>
              <p className="text-xs text-slate-500 mt-1">氏名、住所、メールアドレス、健康診断結果など、台帳に記載する具体項目を管理します。</p>
            </div>
            <span className="text-xs text-slate-400">AI候補生成と台帳編集で共通利用</span>
          </div>

          <div className="grid grid-cols-[1.2fr_0.8fr] gap-6">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">コード</th>
                    <th className="px-4 py-3 text-left">名称</th>
                    <th className="px-4 py-3 text-left">属性</th>
                    <th className="px-4 py-3 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((item) => (
                    <tr key={item.code} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.code}</td>
                      <td className="px-4 py-3 text-slate-800">
                        <div>{item.name}</div>
                        {item.description && <div className="text-xs text-slate-500 mt-1">{item.description}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {[item.categoryHint, item.isSensitive ? "要配慮" : "", item.isSpecificPerson ? "特定個人情報" : ""].filter(Boolean).join(" / ")}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex gap-3">
                          <button
                            className="text-blue-600 hover:text-blue-700"
                            onClick={() => {
                              setEditingFieldCode(item.code);
                              setFieldForm({
                                code: item.code,
                                name: item.name,
                                description: item.description ?? "",
                                categoryHint: item.categoryHint ?? "",
                                isSensitive: Boolean(item.isSensitive),
                                isSpecificPerson: Boolean(item.isSpecificPerson),
                              });
                            }}
                          >
                            編集
                          </button>
                          <button className="text-red-600 hover:text-red-700" onClick={() => deleteField(item.code)}>削除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">{editingFieldCode ? "項目を編集" : "項目を追加"}</h3>
              <div className="space-y-3">
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="コード" value={fieldForm.code} onChange={(e) => setFieldForm({ ...fieldForm, code: e.target.value.toUpperCase() })} />
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="名称" value={fieldForm.name} onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })} />
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="カテゴリヒント (例: CONTACT)" value={fieldForm.categoryHint} onChange={(e) => setFieldForm({ ...fieldForm, categoryHint: e.target.value.toUpperCase() })} />
                <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none" rows={3} placeholder="説明" value={fieldForm.description} onChange={(e) => setFieldForm({ ...fieldForm, description: e.target.value })} />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={fieldForm.isSensitive} onChange={(e) => setFieldForm({ ...fieldForm, isSensitive: e.target.checked })} />
                  要配慮個人情報に該当しうる
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={fieldForm.isSpecificPerson} onChange={(e) => setFieldForm({ ...fieldForm, isSpecificPerson: e.target.checked })} />
                  特定個人情報に該当する
                </label>
                <div className="flex justify-end gap-3 pt-2">
                  {editingFieldCode && <button className="text-sm text-slate-500" onClick={() => { setEditingFieldCode(null); setFieldForm(emptyFieldForm); }}>キャンセル</button>}
                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={saveField}>保存</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">システム情報</h2>
          <dl className="space-y-3">
            {[
              { label: "バージョン", value: "0.1.0 (MVP デモ版)" },
              { label: "データベース", value: "SQLite (ローカル)" },
              { label: "AIエンジン", value: "Gemini 2.0 Flash (Google)" },
              { label: "フレームワーク", value: "Next.js 15 (App Router)" },
            ].map((item) => (
              <div key={item.label} className="flex gap-4">
                <dt className="text-xs text-slate-500 w-28 shrink-0 pt-0.5">{item.label}</dt>
                <dd className="text-sm text-slate-800">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
