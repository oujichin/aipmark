import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/documents?companyId=xxx — 生成文書一覧
export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");

  const where = companyId ? { companyId } : {};
  const documents = await prisma.document.findMany({
    where,
    orderBy: { generatedAt: "desc" },
    include: { company: true },
  });

  return NextResponse.json(documents);
}
