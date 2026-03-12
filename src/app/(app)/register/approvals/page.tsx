import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  REJECTED: "bg-red-100 text-red-600",
};

export default async function ApprovalsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const pendingItems = await prisma.registerItem.findMany({
    where: {
      status: { in: ["PENDING_APPROVAL", "REJECTED"] },
      businessProcess: { organizationId: session.user.organizationId },
    },
    include: { businessProcess: { include: { department: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="承認一覧"
        description="承認申請中・差戻し対応が必要な台帳アイテムの一覧です。"
      />

      {pendingItems.length === 0 ? (
        <EmptyState icon="✅" title="対応待ちの申請はありません" description="承認申請が来ると、ここに表示されます。" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">データ主体</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">業務プロセス</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">部門</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">ステータス</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">更新日時</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {pendingItems.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{item.dataSubject}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{item.businessProcess.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{item.businessProcess.department.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] ?? "bg-slate-100 text-slate-500"}`}>
                      {item.status === "PENDING_APPROVAL" ? "承認申請中" : "差戻し"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(item.updatedAt).toLocaleDateString("ja-JP")}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/register/items/${item.id}`} className="text-xs text-blue-600 hover:text-blue-700 hover:underline">
                      確認・承認
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
