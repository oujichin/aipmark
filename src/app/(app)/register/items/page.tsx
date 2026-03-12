"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

interface RegisterItem {
  id: string;
  dataSubject: string;
  dataCategories: string;
  purpose: string;
  status: string;
  confirmationStatus: string;
  version: number;
  updatedAt: string;
  businessProcess: { name: string; department: { name: string } };
  _count: { evidenceRecords: number };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "下書き", color: "bg-slate-100 text-slate-500" },
  REVIEWING: { label: "精査中", color: "bg-blue-100 text-blue-600" },
  PENDING_APPROVAL: { label: "承認申請中", color: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "承認済み", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "差戻し", color: "bg-red-100 text-red-600" },
  LOCKED: { label: "確定", color: "bg-purple-100 text-purple-700" },
};

const CONFIRM_LABELS: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: "確定", color: "bg-green-100 text-green-700" },
  INFERRED: { label: "推定", color: "bg-yellow-100 text-yellow-700" },
  UNCONFIRMED: { label: "未確認", color: "bg-slate-100 text-slate-400" },
};

function ItemsContent() {
  const searchParams = useSearchParams();
  const processId = searchParams.get("processId");

  const [items, setItems] = useState<RegisterItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = processId
      ? `/api/register/items?processId=${processId}`
      : "/api/register/items";
    fetch(url)
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoading(false); });
  }, [processId]);

  const parseCategories = (cats: string) => {
    try { return (JSON.parse(cats) as string[]).join("、"); }
    catch { return cats; }
  };

  return (
    <div>
      <PageHeader
        title="台帳一覧"
        description="登録済みの個人情報取扱台帳アイテムを管理します。"
        actions={
          <div className="flex gap-2">
            <Link
              href="/register/export"
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
            >
              Excelエクスポート
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">読み込み中...</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="📋"
          title="台帳アイテムがありません"
          description="ヒアリングフローからAI候補を生成して台帳に追加してください。"
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-8">No.</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">データ主体</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">個人情報カテゴリ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">業務プロセス</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">確定状況</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">ステータス</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const st = STATUS_LABELS[item.status];
                const cs = CONFIRM_LABELS[item.confirmationStatus];
                return (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.dataSubject}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs max-w-48 truncate">
                      {parseCategories(item.dataCategories)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <div>{item.businessProcess.name}</div>
                      <div className="text-slate-400">{item.businessProcess.department.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cs?.color ?? "bg-slate-100 text-slate-500"}`}>
                        {cs?.label ?? item.confirmationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st?.color ?? "bg-slate-100 text-slate-500"}`}>
                        {st?.label ?? item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/register/items/${item.id}`}
                        className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        詳細・編集
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ItemsPage() {
  return (
    <Suspense fallback={<div className="text-slate-400 text-sm py-8 text-center">読み込み中...</div>}>
      <ItemsContent />
    </Suspense>
  );
}
