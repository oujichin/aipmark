"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

// ── 型定義 ──────────────────────────────────────────────

interface PMSDocumentVersion {
  id: string;
  versionNumber: string;
  changeNote: string | null;
  effectiveDate: string | null;
  fileName: string | null;
  status: string;
  createdAt: string;
  createdBy?: { id: string; name: string } | null;
  approvedBy?: { id: string; name: string } | null;
  approvedAt: string | null;
}

interface PMSDocument {
  id: string;
  type: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  versions?: PMSDocumentVersion[];
  _count?: { versions: number };
}

// ── 定数 ────────────────────────────────────────────────

const DOC_TYPES: Record<string, string> = {
  POLICY: "方針",
  PROCEDURE: "規程",
  TEMPLATE: "テンプレート",
  RECORD: "記録",
  GUIDELINE: "ガイドライン",
};

const DOC_CATEGORIES: Record<string, string> = {
  PMS_BASIC: "PMS基本",
  SECURITY: "安全管理",
  TRAINING: "教育",
  AUDIT: "監査",
  CONTRACT: "委託契約",
  OTHER: "その他",
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "下書き", color: "bg-slate-100 text-slate-600" },
  ACTIVE: { label: "有効", color: "bg-green-100 text-green-700" },
  ARCHIVED: { label: "保管", color: "bg-amber-100 text-amber-700" },
};

const VERSION_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "下書き", color: "bg-slate-100 text-slate-500" },
  APPROVED: { label: "承認済", color: "bg-green-100 text-green-700" },
  SUPERSEDED: { label: "旧版", color: "bg-amber-100 text-amber-600" },
};

// ── Props ───────────────────────────────────────────────

interface DocumentsClientProps {
  initialDocuments: PMSDocument[];
}

// ── メインコンポーネント ──────────────────────────────────

export default function DocumentsClient({ initialDocuments }: DocumentsClientProps) {
  const [documents, setDocuments] = useState<PMSDocument[]>(initialDocuments);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  // 詳細表示用
  const [selectedDoc, setSelectedDoc] = useState<PMSDocument | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 作成モーダル
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    type: "POLICY",
    description: "",
    category: "PMS_BASIC",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // バージョン追加
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionForm, setVersionForm] = useState({
    versionNumber: "",
    changeNote: "",
  });
  const [addingVersion, setAddingVersion] = useState(false);

  // ── データ取得（フィルタ変更時・更新時のみ） ───────────

  const fetchDocuments = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterCategory) params.set("category", filterCategory);
    const qs = params.toString();
    fetch(`/api/documents${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        setDocuments(Array.isArray(data) ? data : data.items ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filterType, filterCategory]);

  // フィルタ変更時のみrefetch（初回はサーバーデータを使用）
  useEffect(() => {
    if (filterType !== "" || filterCategory !== "") {
      fetchDocuments();
    }
  }, [filterType, filterCategory, fetchDocuments]);

  const fetchDetail = (id: string) => {
    setDetailLoading(true);
    fetch(`/api/documents/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setSelectedDoc(data);
        setDetailLoading(false);
      })
      .catch(() => setDetailLoading(false));
  };

  // ── 文書作成 ─────────────────────────────────────────

  const handleCreate = () => {
    setCreating(true);
    setCreateError("");
    fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json();
          throw new Error(err.error || "作成に失敗しました");
        }
        return r.json();
      })
      .then(() => {
        setShowCreateModal(false);
        setCreateForm({ title: "", type: "POLICY", description: "", category: "PMS_BASIC" });
        fetchDocuments();
      })
      .catch((e: Error) => {
        setCreateError(e.message);
      })
      .finally(() => setCreating(false));
  };

  // ── バージョン追加 ───────────────────────────────────

  const handleAddVersion = () => {
    if (!selectedDoc) return;
    setAddingVersion(true);
    fetch(`/api/documents/${selectedDoc.id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(versionForm),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("バージョン追加に失敗しました");
        return r.json();
      })
      .then(() => {
        setShowVersionModal(false);
        setVersionForm({ versionNumber: "", changeNote: "" });
        fetchDetail(selectedDoc.id);
      })
      .catch(() => {})
      .finally(() => setAddingVersion(false));
  };

  // ── バージョン承認 ───────────────────────────────────

  const handleApproveVersion = (versionId: string) => {
    fetch(`/api/documents/versions/${versionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("承認に失敗しました");
        return r.json();
      })
      .then(() => {
        if (selectedDoc) fetchDetail(selectedDoc.id);
      })
      .catch(() => {});
  };

  // ── 描画 ─────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="文書・エビデンス管理"
        description="PMS関連文書・証跡ファイルを一元管理します。"
        actions={
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            onClick={() => setShowCreateModal(true)}
          >
            + 文書を追加
          </button>
        }
      />

      {/* フィルタ */}
      <div className="flex gap-3 mb-4">
        <select
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">全種別</option>
          {Object.entries(DOC_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">全カテゴリ</option>
          {Object.entries(DOC_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* 一覧 or 詳細 */}
      {selectedDoc ? (
        /* ── 文書詳細 ── */
        <div>
          <button
            className="text-sm text-blue-600 hover:underline mb-4 inline-block"
            onClick={() => setSelectedDoc(null)}
          >
            &larr; 一覧に戻る
          </button>

          {detailLoading ? (
            <div className="text-center py-8 text-slate-400 text-sm">読み込み中...</div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedDoc.title}</h2>
                  <p className="text-sm text-slate-500 mt-1">{selectedDoc.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[selectedDoc.status]?.color ?? "bg-slate-100 text-slate-500"}`}>
                    {STATUS_BADGE[selectedDoc.status]?.label ?? selectedDoc.status}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                    {DOC_TYPES[selectedDoc.type] ?? selectedDoc.type}
                  </span>
                  {selectedDoc.category && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                      {DOC_CATEGORIES[selectedDoc.category] ?? selectedDoc.category}
                    </span>
                  )}
                </div>
              </div>

              {/* 版履歴 */}
              <div className="border-t border-slate-100 pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">版履歴</h3>
                  <button
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    onClick={() => setShowVersionModal(true)}
                  >
                    + バージョン追加
                  </button>
                </div>

                {selectedDoc.versions && selectedDoc.versions.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDoc.versions.map((ver) => {
                      const vs = VERSION_STATUS[ver.status];
                      return (
                        <div
                          key={ver.id}
                          className="flex items-center justify-between bg-slate-50 rounded-lg p-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono font-medium text-slate-700">
                              v{ver.versionNumber}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${vs?.color ?? "bg-slate-100 text-slate-500"}`}>
                              {vs?.label ?? ver.status}
                            </span>
                            {ver.changeNote && (
                              <span className="text-xs text-slate-500">{ver.changeNote}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {ver.createdBy && (
                              <span className="text-xs text-slate-400">{ver.createdBy.name}</span>
                            )}
                            <span className="text-xs text-slate-400">
                              {new Date(ver.createdAt).toLocaleDateString("ja-JP")}
                            </span>
                            {ver.status === "DRAFT" && (
                              <button
                                className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                onClick={() => handleApproveVersion(ver.id)}
                              >
                                承認
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 py-4 text-center">バージョンがありません</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">読み込み中...</div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon="📁"
            title="文書がありません"
            description="「+ 文書を追加」ボタンからPMS文書を登録してください。"
          />
        </div>
      ) : (
        /* ── 文書一覧テーブル ── */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-8">No.</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">タイトル</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">種別</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">カテゴリ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">ステータス</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">バージョン数</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">更新日</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, i) => {
                const st = STATUS_BADGE[doc.status];
                return (
                  <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{doc.title}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                        {DOC_TYPES[doc.type] ?? doc.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {doc.category ? (DOC_CATEGORIES[doc.category] ?? doc.category) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st?.color ?? "bg-slate-100 text-slate-500"}`}>
                        {st?.label ?? doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {doc._count?.versions ?? 0}件
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(doc.updatedAt).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        onClick={() => fetchDetail(doc.id)}
                      >
                        詳細
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 文書作成モーダル ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">文書を追加</h2>

            {createError && (
              <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {createError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">タイトル *</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="例: 個人情報保護方針"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">種別 *</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    value={createForm.type}
                    onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                  >
                    {Object.entries(DOC_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">カテゴリ</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                  >
                    {Object.entries(DOC_CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">説明</label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="文書の概要を入力してください"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                onClick={() => setShowCreateModal(false)}
              >
                キャンセル
              </button>
              <button
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                onClick={handleCreate}
                disabled={creating || !createForm.title}
              >
                {creating ? "作成中..." : "作成"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── バージョン追加モーダル ── */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowVersionModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">バージョンを追加</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">バージョン番号 *</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={versionForm.versionNumber}
                  onChange={(e) => setVersionForm({ ...versionForm, versionNumber: e.target.value })}
                  placeholder="例: 2.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">変更内容</label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                  value={versionForm.changeNote}
                  onChange={(e) => setVersionForm({ ...versionForm, changeNote: e.target.value })}
                  placeholder="変更内容を記載してください"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                onClick={() => setShowVersionModal(false)}
              >
                キャンセル
              </button>
              <button
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                onClick={handleAddVersion}
                disabled={addingVersion || !versionForm.versionNumber}
              >
                {addingVersion ? "追加中..." : "追加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
