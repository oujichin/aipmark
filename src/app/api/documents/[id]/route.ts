import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateDocumentSchema } from "@/lib/validations/documents";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const document = await prisma.pMSDocument.findFirst({
      where: { id, organizationId: session.user.organizationId },
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
          include: {
            createdBy: { select: { id: true, name: true } },
            approvedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(document);
  } catch (error) {
    console.error("GET /api/documents/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const result = parseBody(updateDocumentSchema, body);
    if (!result.success) return result.error;

    const existing = await prisma.pMSDocument.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { title, description, category, status, type } = result.data;

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.pMSDocument.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(category !== undefined ? { category } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(type !== undefined ? { type } : {}),
        },
        include: {
          versions: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "PMSDocument",
          entityId: id,
          details: JSON.stringify({ fields: Object.keys(body) }),
        },
      });

      return doc;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/documents/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
