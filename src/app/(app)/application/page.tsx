"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

// ─── 型定義 ────────────────────────────────────────────────────
interface ApplicationPackage {
  id: string;
  organizationId: string;
  applicationType: string;
  fiscalYear: number;
  snapshotDate: string | null;
  pmarkNumber: string | null;
  currentExpiry: string | null;
  certifyingBody: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string } | null;
  _count: { items: number; changeReports: number };
}

interface PackageItem {
  id: string;
  packageId: string;
  itemType: string;
  title: string;
  filePath: string | null;
  fileName: string | null;
  fileSize: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface ChangeReport {
  id: string;
  packageId: string;
  changeCategory: string;
  changeTitle: string;
  changeDetail: string | null;
  aiSummary: string | null;
  previousValue: string | null;
  currentValue: string | null;
  changedAt: string | null;
  createdAt: string;
}

interface PackageDetail extends ApplicationPackage {
  items: PackageItem[];
  changeReports: ChangeReport[];
  approvedBy: { id: string; name: string } | null;
}

// ─── 定数 ──────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "下書き", color: "bg-slate-100 text-slate-600" },
  GENERATING: { label: "生成中", color: "bg-yellow-100 text-yellow-700" },
  READY: { label: "準備完了", color: "bg-blue-100 text-blue-700" },
  REVIEWING: { label: "レビュー中", color: "bg-orange-100 text-orange-700" },
  APPROVED: { label: "承認済", color: "bg-green-100 text-green-700" },
  SUBMITTED: { label: "提出済", color: "bg-purple-100 text-purple-700" },
};

const TYPE_LABELS: Record<string, string> = {
  NEW: "新規申請",
  RENEWAL: "更新申請",
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  REGISTER_EXPORT: "台帳エクスポート",
  RISK_REPORT: "リスク分析報告書",
  TRAINING_SUMMARY: "教育実施サマリー",
  AUDIT_SUMMARY: "監査サマリー",
  REVIEW_SUMMARY: "レビューサマリー",
  DOCUMENT_LIST: "文書一覧",
  CHANGE_REPORT: "変更報告書",
  OTHER: "その他",
};

const ITEM_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "未着手", color: "bg-slate-100 text-slate-600" },
  GENERATING: { label: "生成中", color: "bg-yellow-100 text-yellow-700" },
  GENERATED: { label: "生成済", color: "bg-green-100 text-green-700" },
  ERROR: { label: "エラー", color: "bg-red-100 text-red-700" },
};

const CHANGE_CATEGORY_LABELS: Record<string, string> = {
  ORGANIZATION: "組織",
  BUSINESS: "事業",
  REGISTER: "台帳",
  RISK: "リスク",
  DOCUMENT: "文書",
  PERSONNEL: "人事",
  SYSTEM: "システム",
};

// ─── ステータスバッジ ──────────────────────────────────────────
function StatusBadge({ status, labels }: { status: string; labels: Record<string, { label: string; color: string }> }) {
  const info = labels[status] ?? { label: status, color: "bg-slate-100 text-slate-600" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.color}`}>
      {info.label}
    </span>
  );
}

// ─── メインコンポーネント ──────────────────────────────────────
export default function ApplicationPage() {
  const [packages, setPackages] = useState<ApplicationPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<PackageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // モーダル状態
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);

  // フォーム状態
  const [createForm, setCreateForm] = useState({ fiscalYear: new Date().getFullYear(), applicationType: "RENEWAL" });
  const [itemForm, setItemForm] = useState({ itemType: "REGISTER_EXPORT", title: "" });
  const [changeForm, setChangeForm] = useState({ changeCategory: "ORGANIZATION", changeTitle: "", changeDetail: "", previousValue: "", currentValue: "" });

  // ─── データ取得 ────────────────────────────────────────────
  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/application");
      if (!res.ok) throw new Error("取得に失敗しました");
      const data: ApplicationPackage[] = await res.json();
      setPackages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/application/${id}`);
      if (!res.ok) throw new Error("詳細の取得に失敗しました");
      const data: PackageDetail = await res.json();
      setSelectedPkg(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  // ─── パッケージ作成 ────────────────────────────────────────
  const handleCreatePackage = async () => {
    try {
      const res = await fetch("/api/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? "作成に失敗しました");
      }
      setShowCreateModal(false);
      setCreateForm({ fiscalYear: new Date().getFullYear(), applicationType: "RENEWAL" });
      await fetchPackages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  // ─── アイテム追加 ──────────────────────────────────────────
  const handleAddItem = async () => {
    if (!selectedPkg) return;
    try {
      const res = await fetch(`/api/application/${selectedPkg.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemForm),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? "追加に失敗しました");
      }
      setShowItemModal(false);
      setItemForm({ itemType: "REGISTER_EXPORT", title: "" });
      await fetchDetail(selectedPkg.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  // ─── 変更報告追加 ──────────────────────────────────────────
  const handleAddChangeReport = async () => {
    if (!selectedPkg) return;
    try {
      const res = await fetch(`/api/application/${selectedPkg.id}/change-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changeForm),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? "追加に失敗しました");
      }
      setShowChangeModal(false);
      setChangeForm({ changeCategory: "ORGANIZATION", changeTitle: "", changeDetail: "", previousValue: "", currentValue: "" });
      await fetchDetail(selectedPkg.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  // ─── ステータス更新 ────────────────────────────────────────
  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedPkg) return;
    try {
      const res = await fetch(`/api/application/${selectedPkg.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("更新に失敗しました");
      await fetchDetail(selectedPkg.id);
      await fetchPackages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  // ─── 一覧ビュー ───────────────────────────────────────────
  if (selectedPkg) {
    return (
      <div>
        <div className="mb-4">
          <button
            onClick={() => setSelectedPkg(null)}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            ← 一覧に戻る
          </button>
        </div>

        <PageHeader
          title={`${selectedPkg.fiscalYear}年度 ${TYPE_LABELS[selectedPkg.applicationType] ?? selectedPkg.applicationType}`}
          description={`Pマーク番号: ${selectedPkg.pmarkNumber ?? "未設定"} / 認証機関: ${selectedPkg.certifyingBody ?? "未設定"}`}
          actions={
            <div className="flex items-center gap-2">
              <StatusBadge status={selectedPkg.status} labels={STATUS_LABELS} />
              {selectedPkg.status === "DRAFT" && (
                <button
                  onClick={() => handleUpdateStatus("REVIEWING")}
                  className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
                >
                  レビュー開始
                </button>
              )}
              {selectedPkg.status === "REVIEWING" && (
                <button
                  onClick={() => handleUpdateStatus("APPROVED")}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  承認
                </button>
              )}
              {selectedPkg.status === "APPROVED" && (
                <button
                  onClick={() => handleUpdateStatus("SUBMITTED")}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                >
                  提出済にする
                </button>
              )}
            </div>
          }
        />

        {/* 概要カード */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500 mb-1">Pマーク番号</div>
            <div className="text-lg font-bold text-slate-700">{selectedPkg.pmarkNumber ?? "未登録"}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500 mb-1">有効期限</div>
            <div className="text-lg font-bold text-slate-700">
              {selectedPkg.currentExpiry ? new Date(selectedPkg.currentExpiry).toLocaleDateString("ja-JP") : "未設定"}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500 mb-1">添付アイテム数</div>
            <div className="text-lg font-bold text-slate-700">{selectedPkg.items.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500 mb-1">変更報告数</div>
            <div className="text-lg font-bold text-slate-700">{selectedPkg.changeReports.length}</div>
          </div>
        </div>

        {/* アイテム一覧 */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">申請アイテム</h2>
            <button
              onClick={() => setShowItemModal(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
            >
              + アイテム追加
            </button>
          </div>
          {selectedPkg.items.length === 0 ? (
            <EmptyState
              icon="📄"
              title="アイテムがありません"
              description="台帳エクスポートやリスク報告書などのアイテムを追加してください。"
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">種別</th>
                  <th className="px-4 py-2 text-left">タイトル</th>
                  <th className="px-4 py-2 text-left">ファイル名</th>
                  <th className="px-4 py-2 text-left">サイズ</th>
                  <th className="px-4 py-2 text-left">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {selectedPkg.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs">
                        {ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.title}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{item.fileName ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {item.fileSize ? `${(item.fileSize / 1024).toFixed(1)} KB` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} labels={ITEM_STATUS_LABELS} />
                      {item.errorMessage && (
                        <span className="ml-2 text-xs text-red-500">{item.errorMessage}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 変更報告一覧 */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">変更報告</h2>
            <button
              onClick={() => setShowChangeModal(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
            >
              + 変更報告追加
            </button>
          </div>
          {selectedPkg.changeReports.length === 0 ? (
            <EmptyState
              icon="📋"
              title="変更報告がありません"
              description="前回審査からの変更点を記録してください。"
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">カテゴリ</th>
                  <th className="px-4 py-2 text-left">変更タイトル</th>
                  <th className="px-4 py-2 text-left">変更前</th>
                  <th className="px-4 py-2 text-left">変更後</th>
                  <th className="px-4 py-2 text-left">登録日</th>
                </tr>
              </thead>
              <tbody>
                {selectedPkg.changeReports.map((cr) => (
                  <tr key={cr.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs">
                        {CHANGE_CATEGORY_LABELS[cr.changeCategory] ?? cr.changeCategory}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {cr.changeTitle}
                      {cr.changeDetail && (
                        <p className="text-xs text-slate-400 mt-0.5">{cr.changeDetail}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{cr.previousValue ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{cr.currentValue ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(cr.createdAt).toLocaleDateString("ja-JP")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* アイテム追加モーダル */}
        {showItemModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
              <h3 className="text-lg font-bold text-slate-900 mb-4">アイテム追加</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">種別</label>
                  <select
                    value={itemForm.itemType}
                    onChange={(e) => setItemForm({ ...itemForm, itemType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {Object.entries(ITEM_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">タイトル</label>
                  <input
                    type="text"
                    value={itemForm.title}
                    onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="例: 個人情報管理台帳エクスポート"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddItem}
                  disabled={!itemForm.title}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 変更報告追加モーダル */}
        {showChangeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
              <h3 className="text-lg font-bold text-slate-900 mb-4">変更報告追加</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">カテゴリ</label>
                  <select
                    value={changeForm.changeCategory}
                    onChange={(e) => setChangeForm({ ...changeForm, changeCategory: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {Object.entries(CHANGE_CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">変更タイトル</label>
                  <input
                    type="text"
                    value={changeForm.changeTitle}
                    onChange={(e) => setChangeForm({ ...changeForm, changeTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="例: 個人情報保護管理者の変更"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">変更詳細</label>
                  <textarea
                    value={changeForm.changeDetail}
                    onChange={(e) => setChangeForm({ ...changeForm, changeDetail: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    rows={2}
                    placeholder="変更の詳細を記述"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">変更前</label>
                    <input
                      type="text"
                      value={changeForm.previousValue}
                      onChange={(e) => setChangeForm({ ...changeForm, previousValue: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">変更後</label>
                    <input
                      type="text"
                      value={changeForm.currentValue}
                      onChange={(e) => setChangeForm({ ...changeForm, currentValue: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowChangeModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddChangeReport}
                  disabled={!changeForm.changeTitle}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm">{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                ×
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── 一覧ビュー ───────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="申請・更新管理"
        description="プライバシーマークの新規申請・更新申請パッケージを生成・管理します。"
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + 申請パッケージ作成
          </button>
        }
      />

      {/* 統計カード */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">パッケージ総数</div>
          <div className="text-lg font-bold text-slate-700">{packages.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">下書き</div>
          <div className="text-lg font-bold text-slate-700">
            {packages.filter((p) => p.status === "DRAFT").length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">レビュー中</div>
          <div className="text-lg font-bold text-orange-600">
            {packages.filter((p) => p.status === "REVIEWING").length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">提出済</div>
          <div className="text-lg font-bold text-green-600">
            {packages.filter((p) => p.status === "SUBMITTED").length}
          </div>
        </div>
      </div>

      {/* パッケージ一覧 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <div className="col-span-2">パッケージ</div>
          <div>種別</div>
          <div>アイテム / 変更報告</div>
          <div>更新日</div>
          <div>ステータス</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-sm text-slate-400">読み込み中...</div>
          </div>
        ) : packages.length === 0 ? (
          <EmptyState
            icon="📝"
            title="申請パッケージがありません"
            description="「+ 申請パッケージ作成」ボタンからパッケージを作成してください。"
          />
        ) : (
          packages.map((pkg) => (
            <div
              key={pkg.id}
              onClick={() => fetchDetail(pkg.id)}
              className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
            >
              <div className="col-span-2">
                <div className="text-sm font-medium text-slate-700">
                  {pkg.fiscalYear}年度 {TYPE_LABELS[pkg.applicationType] ?? pkg.applicationType}
                </div>
                <div className="text-xs text-slate-400">
                  作成者: {pkg.createdBy?.name ?? "不明"}
                </div>
              </div>
              <div className="text-sm text-slate-600 flex items-center">
                {TYPE_LABELS[pkg.applicationType] ?? pkg.applicationType}
              </div>
              <div className="text-sm text-slate-600 flex items-center">
                {pkg._count.items} / {pkg._count.changeReports}
              </div>
              <div className="text-sm text-slate-500 flex items-center">
                {new Date(pkg.updatedAt).toLocaleDateString("ja-JP")}
              </div>
              <div className="flex items-center">
                <StatusBadge status={pkg.status} labels={STATUS_LABELS} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* パッケージ作成モーダル */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">申請パッケージ作成</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">年度</label>
                <input
                  type="number"
                  value={createForm.fiscalYear}
                  onChange={(e) => setCreateForm({ ...createForm, fiscalYear: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">申請種別</label>
                <select
                  value={createForm.applicationType}
                  onChange={(e) => setCreateForm({ ...createForm, applicationType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="RENEWAL">更新申請</option>
                  <option value="NEW">新規申請</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreatePackage}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                作成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
