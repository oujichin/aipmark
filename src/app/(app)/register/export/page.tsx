import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";

export default async function ExportPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const processes = await prisma.businessProcess.findMany({
    where: { organizationId: session.user.organizationId },
    include: { _count: { select: { registerItems: true } } },
  });

  const totalItems = await prisma.registerItem.count({
    where: { businessProcess: { organizationId: session.user.organizationId } },
  });

  return (
    <div>
      <PageHeader
        title="Excelエクスポート"
        description="個人情報取扱台帳をExcel形式でダウンロードします。"
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">業務プロセス数</div>
          <div className="text-2xl font-bold text-slate-800">{processes.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">台帳アイテム数</div>
          <div className="text-2xl font-bold text-slate-800">{totalItems}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 mb-1">エクスポート形式</div>
          <div className="text-2xl font-bold text-green-600">Excel</div>
        </div>
      </div>

      {/* Export options */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">エクスポート設定</h2>

        {/* All items */}
        <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:border-slate-200 transition-colors">
          <div>
            <p className="text-sm font-medium text-slate-800">全台帳アイテム</p>
            <p className="text-xs text-slate-500 mt-0.5">全業務プロセスの台帳を1シートにまとめてエクスポート</p>
          </div>
          <a
            href="/api/register/export"
            download
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            ダウンロード
          </a>
        </div>

        {/* Per process */}
        {processes.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:border-slate-200 transition-colors">
            <div>
              <p className="text-sm font-medium text-slate-800">{p.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{p._count.registerItems}件の台帳アイテム</p>
            </div>
            <a
              href={`/api/register/export?processId=${p.id}`}
              download
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              ダウンロード
            </a>
          </div>
        ))}
      </div>

      <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-4">
        <p className="text-xs text-amber-700">
          <strong>注意:</strong> 推定（INFERRED）・未確認（UNCONFIRMED）のアイテムは黄色でハイライト表示されます。
          Pマーク申請前に全項目を「確定」ステータスにすることを推奨します。
        </p>
      </div>
    </div>
  );
}
