"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

// ──────────────────────────────────────
// 型定義
// ──────────────────────────────────────

interface VendorEvaluationSummary {
  id: string;
  fiscalYear: number;
  rating: string | null;
  overallScore: number | null;
  status: string;
}

interface Vendor {
  id: string;
  name: string;
  vendorType: string;
  description: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  hasPmark: boolean;
  pmarkNumber: string | null;
  hasIsms: boolean;
  ismsNumber: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  renewalDate: string | null;
  dataHandled: string | null;
  overallRating: string;
  nextEvaluationDue: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  evaluations: VendorEvaluationSummary[];
  _count: { questionnaires: number; evaluations: number };
}

interface FormData {
  name: string;
  vendorType: string;
  description: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  hasPmark: boolean;
  pmarkNumber: string;
  hasIsms: boolean;
  ismsNumber: string;
  contractStartDate: string;
  contractEndDate: string;
  dataHandled: string;
}

export interface VendorsClientProps {
  initialVendors: Vendor[];
}

// ──────────────────────────────────────
// 定数
// ──────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "ACTIVE", label: "有効" },
  { value: "PENDING_REVIEW", label: "レビュー待ち" },
  { value: "SUSPENDED", label: "一時停止" },
  { value: "TERMINATED", label: "終了" },
] as const;

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "有効", cls: "bg-green-100 text-green-700 border-green-200" },
  PENDING_REVIEW: { label: "レビュー待ち", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  SUSPENDED: { label: "一時停止", cls: "bg-red-100 text-red-700 border-red-200" },
  TERMINATED: { label: "終了", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const VENDOR_TYPE_LABEL: Record<string, string> = {
  OUTSOURCE: "業務委託",
  SAAS: "SaaS",
  CLOUD: "クラウド",
  SUBCONTRACT: "再委託",
  OTHER: "その他",
};

const RATING_BADGE: Record<string, { label: string; cls: string }> = {
  A: { label: "A", cls: "bg-green-100 text-green-700" },
  B: { label: "B", cls: "bg-blue-100 text-blue-700" },
  C: { label: "C", cls: "bg-amber-100 text-amber-700" },
  D: { label: "D", cls: "bg-red-100 text-red-700" },
  UNRATED: { label: "未評価", cls: "bg-slate-100 text-slate-500" },
};

const INITIAL_FORM: FormData = {
  name: "",
  vendorType: "OUTSOURCE",
  description: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  hasPmark: false,
  pmarkNumber: "",
  hasIsms: false,
  ismsNumber: "",
  contractStartDate: "",
  contractEndDate: "",
  dataHandled: "",
};

// ──────────────────────────────────────
// ヘルパー
// ──────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ja-JP");
}

function isExpiringSoon(dateStr: string | null, daysThreshold = 30): boolean {
  if (!dateStr) return false;
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff > 0 && diff < daysThreshold * 86400000;
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now();
}

// ──────────────────────────────────────
// コンポーネント
// ──────────────────────────────────────

export default function VendorsClient({ initialVendors }: VendorsClientProps) {
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/vendors?${params.toString()}`);
      if (!res.ok) throw new Error("読み込みに失敗しました");
      const raw = await res.json();
      const data: Vendor[] = Array.isArray(raw) ? raw : raw.items ?? [];
      setVendors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // statusFilterが変わった時だけfetchする（初回はinitialVendorsを使う）
  useEffect(() => {
    if (statusFilter !== "") {
      fetchVendors();
    }
  }, [statusFilter, fetchVendors]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setError("委託先名は必須です");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          contractStartDate: form.contractStartDate || undefined,
          contractEndDate: form.contractEndDate || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "登録に失敗しました");
      }
      setShowModal(false);
      setForm(INITIAL_FORM);
      await fetchVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？関連する評価・質問票も削除されます。`)) return;
    try {
      const res = await fetch(`/api/vendors/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除に失敗しました");
      await fetchVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  return (
    <div>
      <PageHeader
        title="委託先管理"
        description="個人情報を取り扱う委託先の評価・管理を行います。"
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + 委託先登録
          </button>
        }
      />

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            &times;
          </button>
        </div>
      )}

      {/* ステータスフィルタ */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-slate-500">ステータス:</span>
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === opt.value
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 契約期限アラート */}
      {vendors.some((v) => isExpiringSoon(v.contractEndDate) || isExpired(v.contractEndDate)) && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <span className="font-medium">契約期限アラート:</span>
          {vendors
            .filter((v) => isExpiringSoon(v.contractEndDate) || isExpired(v.contractEndDate))
            .map((v) => (
              <span key={v.id} className="ml-2">
                {isExpired(v.contractEndDate) ? (
                  <span className="text-red-600 font-medium">{v.name}（期限切れ: {formatDate(v.contractEndDate)}）</span>
                ) : (
                  <span className="text-amber-700">{v.name}（{formatDate(v.contractEndDate)}まで）</span>
                )}
              </span>
            ))}
        </div>
      )}

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-7 gap-4 px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <div className="col-span-2">委託先名</div>
          <div>種別</div>
          <div>認証</div>
          <div>評価</div>
          <div>契約期限</div>
          <div>操作</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : vendors.length === 0 ? (
          <EmptyState
            icon="🏢"
            title="委託先が登録されていません"
            description="個人情報の取り扱いを委託している事業者を登録・評価管理します。"
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {vendors.map((vendor) => {
              const statusBadge = STATUS_BADGE[vendor.status] ?? STATUS_BADGE["ACTIVE"];
              const ratingBadge = RATING_BADGE[vendor.overallRating] ?? RATING_BADGE["UNRATED"];
              const latestEval = vendor.evaluations?.[0];

              return (
                <div key={vendor.id} className="grid grid-cols-7 gap-4 px-4 py-3 items-center hover:bg-slate-50 transition-colors">
                  {/* 委託先名 + ステータス */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-900">{vendor.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${statusBadge.cls}`}>
                        {statusBadge.label}
                      </span>
                    </div>
                    {vendor.description && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{vendor.description}</p>
                    )}
                  </div>

                  {/* 種別 */}
                  <div className="text-sm text-slate-600">
                    {VENDOR_TYPE_LABEL[vendor.vendorType] ?? vendor.vendorType}
                  </div>

                  {/* 認証バッジ */}
                  <div className="flex flex-col gap-1">
                    {vendor.hasPmark && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium w-fit">
                        Pマーク
                      </span>
                    )}
                    {vendor.hasIsms && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium w-fit">
                        ISMS
                      </span>
                    )}
                    {!vendor.hasPmark && !vendor.hasIsms && (
                      <span className="text-xs text-slate-400">なし</span>
                    )}
                  </div>

                  {/* 評価レーティング */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${ratingBadge.cls}`}>
                      {ratingBadge.label}
                    </span>
                    {latestEval && (
                      <span className="text-xs text-slate-400">
                        {latestEval.fiscalYear}年度
                      </span>
                    )}
                  </div>

                  {/* 契約期限 */}
                  <div>
                    <span
                      className={`text-sm ${
                        isExpired(vendor.contractEndDate)
                          ? "text-red-600 font-medium"
                          : isExpiringSoon(vendor.contractEndDate)
                            ? "text-amber-600 font-medium"
                            : "text-slate-600"
                      }`}
                    >
                      {formatDate(vendor.contractEndDate)}
                    </span>
                  </div>

                  {/* 操作 */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(vendor.id, vendor.name)}
                      className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 新規登録モーダル */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">委託先を登録</h2>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* 委託先名 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  委託先名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="例: 株式会社〇〇"
                />
              </div>

              {/* 委託種別 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">委託種別</label>
                <select
                  value={form.vendorType}
                  onChange={(e) => setForm({ ...form, vendorType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="OUTSOURCE">業務委託</option>
                  <option value="SAAS">SaaS</option>
                  <option value="CLOUD">クラウド</option>
                  <option value="SUBCONTRACT">再委託</option>
                  <option value="OTHER">その他</option>
                </select>
              </div>

              {/* 概要 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">委託内容</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  rows={2}
                  placeholder="委託する個人情報の取り扱い概要"
                />
              </div>

              {/* 担当者情報 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">担当者名</label>
                  <input
                    type="text"
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">連絡先Email</label>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* 認証情報 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasPmark"
                    checked={form.hasPmark}
                    onChange={(e) => setForm({ ...form, hasPmark: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <label htmlFor="hasPmark" className="text-sm text-slate-700">Pマーク取得</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasIsms"
                    checked={form.hasIsms}
                    onChange={(e) => setForm({ ...form, hasIsms: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <label htmlFor="hasIsms" className="text-sm text-slate-700">ISMS取得</label>
                </div>
              </div>

              {form.hasPmark && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pマーク番号</label>
                  <input
                    type="text"
                    value={form.pmarkNumber}
                    onChange={(e) => setForm({ ...form, pmarkNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              )}

              {form.hasIsms && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ISMS番号</label>
                  <input
                    type="text"
                    value={form.ismsNumber}
                    onChange={(e) => setForm({ ...form, ismsNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              )}

              {/* 契約期間 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">契約開始日</label>
                  <input
                    type="date"
                    value={form.contractStartDate}
                    onChange={(e) => setForm({ ...form, contractStartDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">契約終了日</label>
                  <input
                    type="date"
                    value={form.contractEndDate}
                    onChange={(e) => setForm({ ...form, contractEndDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* 取り扱い個人情報 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">取り扱い個人情報</label>
                <textarea
                  value={form.dataHandled}
                  onChange={(e) => setForm({ ...form, dataHandled: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  rows={2}
                  placeholder="委託先に提供する個人情報の種類"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); setForm(INITIAL_FORM); setError(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={submitting}
              >
                キャンセル
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? "登録中..." : "登録"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
