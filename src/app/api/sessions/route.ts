import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createDiscoverySession, startDiscovery } from "@/lib/session-orchestrator";

// POST /api/sessions — セッション作成 + Discovery開始
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { companyName, companyUrl, files } = body as {
    companyName: string;
    companyUrl: string;
    files: { name: string; description: string; path: string }[];
  };

  if (!companyName) {
    return NextResponse.json({ error: "companyName is required" }, { status: 400 });
  }

  // Company upsert
  let company = await prisma.company.findFirst({ where: { name: companyName } });
  if (!company) {
    company = await prisma.company.create({
      data: { name: companyName, url: companyUrl },
    });
  }

  const sessionId = await createDiscoverySession(
    company.id,
    companyName,
    companyUrl ?? "",
    files ?? []
  );

  // バックグラウンドでDiscovery開始（SSEストリーム処理）
  startDiscovery(sessionId, companyName, companyUrl ?? "", files ?? []).catch(err => {
    console.error("[Discovery Error]", err);
    // エラー時はDBのステータスを更新
    prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: "idle" },
    }).catch(console.error);
  });

  return NextResponse.json({ sessionId, companyId: company.id });
}

// GET /api/sessions — セッション一覧
export async function GET() {
  const sessions = await prisma.agentSession.findMany({
    include: { company: true, questions: { where: { status: "pending" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(sessions);
}
