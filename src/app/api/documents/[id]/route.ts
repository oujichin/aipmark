import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/documents/[id] — 文書詳細 + 紐づくフィールド情報
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
    include: { company: true },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // 紐づくフィールド情報を取得
  const bpPiis = await prisma.businessProcessPII.findMany({
    where: { businessProcess: { companyId: document.companyId } },
    include: {
      businessProcess: true,
      personalInfoItem: true,
      dataSubject: true,
      storageLocation: true,
      thirdParties: { include: { thirdParty: true } },
      evidences: true,
      riskAssessments: true,
    },
    orderBy: { businessProcess: { name: "asc" } },
  });

  return NextResponse.json({ document, fields: bpPiis });
}

// PATCH /api/documents/[id] — 承認
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const document = await prisma.document.update({
    where: { id },
    data: {
      approvedBy: body.approvedBy,
      approvedAt: new Date(),
    },
  });

  return NextResponse.json(document);
}
