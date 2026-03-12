"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { buildPersonalDataMasterMaps, formatCodes, type DataFieldMasterRecord, type MasterRecord } from "@/lib/personal-data";

interface RegisterItem {
  id: string;
  dataSubject: string;
  dataCategoryCodes: string[];
  dataFieldCodes: string[];
  purpose: string;
  legalBasis: string;
  retentionPeriod: string;
  storageLocation: string;
  thirdPartyProvision: string;
  confirmationStatus: string;
  inferenceBasis?: string;
  status: string;
  version: number;
  rejectionReason?: string;
  approvedAt?: string;
  lockedAt?: string;
  businessProcess: { name: string; department: { name: string } };
  evidenceRecords: Array<{ id: string; type: string; title: string; description?: string; aiSummary?: string; createdAt: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "下書き", REVIEWING: "精査中", PENDING_APPROVAL: "承認申請中",
  APPROVED: "承認済み", REJECTED: "差戻し", LOCKED: "確定（ロック）",
};
const CONFIRM_COLORS: Record<string, string> = {
  CONFIRMED: "bg-green-100 text-green-700",
  INFERRED: "bg-yellow-100 text-yellow-700",
  UNCONFIRMED: "bg-slate-100 text-slate-500",
};
const CONFIRM_LABELS: Record<string, string> = {
  CONFIRMED: "確定", INFERRED: "推定", UNCONFIRMED: "未確認",
};

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<RegisterItem | null>(null);
  const [categories, setCategories] = useState<MasterRecord[]>([]);
  const [fields, setFields] = useState<DataFieldMasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Partial<RegisterItem>>({});

  useEffect(() => {
    Promise.all([
      fetch(`/api/register/items/${id}`).then((r) => r.json()),
      fetch("/api/master/data-categories").then((r) => r.json()),
      fetch("/api/master/data-fields").then((r) => r.json()),
    ]).then(([data, categoryRows, fieldRows]) => {
      setItem(data);
      setForm(data);
      setCategories(categoryRows);
      setFields(fieldRows);
      setLoading(false);
    });
  }, [id]);

  async function handleAction(action: string, actionComment?: string) {
    setSubmitting(true);
    const res = await fetch(`/api/register/items/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment: actionComment }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItem((prev) => prev ? { ...prev, status: updated.status, approvedAt: updated.approvedAt, lockedAt: updated.lockedAt, rejectionReason: updated.rejectionReason } : null);
      setShowRejectForm(false);
      setComment("");
    } else {
      const err = await res.json();
      alert(err.error);
    }
    setSubmitting(false);
  }

  async function handleSave() {
    setSubmitting(true);
    const res = await fetch(`/api/register/items/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const updated = await res.json();
      const merged = {
        ...updated,
        dataCategoryCodes: updated.dataCategoryCodes,
        dataFieldCodes: updated.dataFieldCodes,
      };
      setItem((prev) => prev ? { ...prev, ...merged } : null);
      setForm(merged);
      setEditMode(false);
    }
    setSubmitting(false);
  }

  if (loading) return <div className="text-slate-400 text-sm py-8 text-center">読み込み中...</div>;
  if (!item) return <div className="text-slate-400 text-sm py-8 text-center">見つかりません</div>;

  const isLocked = item.status === "LOCKED";
  const { categoriesByCode, fieldsByCode } = buildPersonalDataMasterMaps(categories, fields);

  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
        <button onClick={() => router.push("/register/items")} className="hover:text-slate-600">← 台帳一覧</button>
        <span>/</span>
        <span className="text-slate-600">{item.dataSubject}</span>
      </div>

      <PageHeader
        title={item.dataSubject}
        description={`${item.businessProcess.name} / ${item.businessProcess.department.name}`}
        actions={
          <div className="flex gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${CONFIRM_COLORS[item.confirmationStatus]}`}>
              {CONFIRM_LABELS[item.confirmationStatus]}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-600">
              {STATUS_LABELS[item.status]}
            </span>
            <span className="text-xs text-slate-400 px-2 py-1">v{item.version}</span>
          </div>
        }
      />

      {item.status === "REJECTED" && item.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-red-800 mb-1">差戻しコメント</p>
          <p className="text-sm text-red-700">{item.rejectionReason}</p>
        </div>
      )}

      {/* Content */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">台帳内容</h2>
            {!isLocked && !editMode && (
              <button onClick={() => setEditMode(true)} className="text-xs text-blue-600 hover:text-blue-700">編集</button>
            )}
          </div>

          {editMode ? (
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "dataSubject", label: "データ主体" },
                { key: "purpose", label: "利用目的" },
                { key: "legalBasis", label: "法的根拠" },
                { key: "retentionPeriod", label: "保存期間" },
                { key: "storageLocation", label: "保存場所" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-slate-500 mb-1">{label}</label>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={(form as Record<string, string>)[key] ?? ""}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-2">個人情報区分</label>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3">
                  {categories.map((category) => {
                    const checked = (form.dataCategoryCodes ?? []).includes(category.code);
                    return (
                      <label key={category.code} className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setForm({
                            ...form,
                            dataCategoryCodes: e.target.checked
                              ? [...(form.dataCategoryCodes ?? []), category.code]
                              : (form.dataCategoryCodes ?? []).filter((code) => code !== category.code),
                          })}
                        />
                        <span>{category.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-2">個人情報項目</label>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 max-h-64 overflow-y-auto">
                  {fields.map((field) => {
                    const checked = (form.dataFieldCodes ?? []).includes(field.code);
                    return (
                      <label key={field.code} className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setForm({
                            ...form,
                            dataFieldCodes: e.target.checked
                              ? [...(form.dataFieldCodes ?? []), field.code]
                              : (form.dataFieldCodes ?? []).filter((code) => code !== field.code),
                          })}
                        />
                        <span>{field.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">第三者提供</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.thirdPartyProvision ?? "NONE"}
                  onChange={(e) => setForm({ ...form, thirdPartyProvision: e.target.value })}
                >
                  <option value="NONE">なし</option>
                  <option value="DOMESTIC">国内提供あり</option>
                  <option value="OVERSEAS">第三国提供あり</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">確定状況</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.confirmationStatus ?? "UNCONFIRMED"}
                  onChange={(e) => setForm({ ...form, confirmationStatus: e.target.value })}
                >
                  <option value="CONFIRMED">確定</option>
                  <option value="INFERRED">推定</option>
                  <option value="UNCONFIRMED">未確認</option>
                </select>
              </div>
              {form.confirmationStatus === "INFERRED" && (
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">推定根拠</label>
                  <textarea
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2}
                    value={form.inferenceBasis ?? ""}
                    onChange={(e) => setForm({ ...form, inferenceBasis: e.target.value })}
                  />
                </div>
              )}
              <div className="col-span-2 flex justify-end gap-3 pt-2">
                <button onClick={() => setEditMode(false)} className="text-sm text-slate-500">キャンセル</button>
                <button onClick={handleSave} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                { label: "データ主体", value: item.dataSubject },
                { label: "個人情報区分", value: formatCodes(item.dataCategoryCodes ?? [], categoriesByCode) },
                { label: "個人情報項目", value: formatCodes(item.dataFieldCodes ?? [], fieldsByCode) },
                { label: "利用目的", value: item.purpose },
                { label: "法的根拠", value: item.legalBasis },
                { label: "保存期間", value: item.retentionPeriod },
                { label: "保存場所", value: item.storageLocation },
                { label: "第三者提供", value: { NONE: "なし", DOMESTIC: "国内提供あり", OVERSEAS: "第三国提供あり" }[item.thirdPartyProvision] ?? item.thirdPartyProvision },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs text-slate-400 mb-0.5">{label}</dt>
                  <dd className="text-sm text-slate-800">{value}</dd>
                </div>
              ))}
              {item.inferenceBasis && (
                <div className="col-span-2">
                  <dt className="text-xs text-slate-400 mb-0.5">推定根拠</dt>
                  <dd className="text-sm text-slate-500 italic">{item.inferenceBasis}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {/* Evidence Records */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">エビデンス ({item.evidenceRecords.length}件)</h2>
          {item.evidenceRecords.length === 0 ? (
            <p className="text-xs text-slate-400">エビデンスが添付されていません</p>
          ) : (
            <div className="space-y-2">
              {item.evidenceRecords.map((ev) => (
                <div key={ev.id} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50">
                  <span className="text-base">📎</span>
                  <div>
                    <p className="text-xs font-medium text-slate-700">{ev.title}</p>
                    {ev.aiSummary && <p className="text-xs text-slate-500 mt-0.5">{ev.aiSummary}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approval Actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">承認ワークフロー</h2>
          <div className="space-y-3">
            {item.status === "DRAFT" || item.status === "REVIEWING" || item.status === "REJECTED" ? (
              <button
                onClick={() => handleAction("REQUEST_APPROVAL")}
                disabled={submitting}
                className="w-full py-2 px-4 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
              >
                承認申請する
              </button>
            ) : null}
            {item.status === "PENDING_APPROVAL" && (
              <>
                <button
                  onClick={() => handleAction("APPROVE")}
                  disabled={submitting}
                  className="w-full py-2 px-4 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  承認・バージョンロック
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={submitting}
                  className="w-full py-2 px-4 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                >
                  差戻し
                </button>
                {showRejectForm && (
                  <div>
                    <textarea
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-2"
                      rows={3}
                      placeholder="差戻しコメント..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <button
                      onClick={() => handleAction("REJECT", comment)}
                      disabled={submitting || !comment}
                      className="w-full py-2 px-4 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      差戻しを確定
                    </button>
                  </div>
                )}
              </>
            )}
            {isLocked && (
              <div className="text-center py-3">
                <p className="text-xs text-purple-600 font-medium">✓ 承認済み・バージョンロック</p>
                {item.approvedAt && (
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(item.approvedAt).toLocaleDateString("ja-JP")} 承認
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
