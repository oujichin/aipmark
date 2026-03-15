import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const evidence = await prisma.evidenceRecord.findFirst({
      where: {
        id,
        uploadedBy: { organizationId: session.user.organizationId },
      },
      include: {
        registerItem: { select: { id: true, dataSubject: true } },
        uploadedBy: { select: { id: true, name: true } },
        riskItem: { select: { id: true, description: true } },
        vendor: { select: { id: true, name: true } },
        incident: { select: { id: true, title: true } },
        auditFinding: { select: { id: true, title: true } },
        correctiveAction: { select: { id: true, title: true } },
      },
    });

    if (!evidence) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(evidence);
  } catch (error) {
    console.error("GET /api/evidence/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const evidence = await prisma.evidenceRecord.findFirst({
      where: {
        id,
        uploadedBy: { organizationId: session.user.organizationId },
      },
    });
    if (!evidence) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.evidenceRecord.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "DELETE",
          entityType: "EvidenceRecord",
          entityId: id,
          details: JSON.stringify({ title: evidence.title }),
        },
      });
    });

    return NextResponse.json({ message: "削除しました" });
  } catch (error) {
    console.error("DELETE /api/evidence/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
