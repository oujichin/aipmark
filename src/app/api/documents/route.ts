import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createDocumentSchema } from "@/lib/validations/documents";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const skip = (page - 1) * limit;

    const where = {
      organizationId: session.user.organizationId,
      ...(type ? { type } : {}),
      ...(category ? { category } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.pMSDocument.findMany({
        where,
        include: {
          _count: { select: { versions: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.pMSDocument.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/documents error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = parseBody(createDocumentSchema, body);
    if (!parsed.success) return parsed.error;
    const { title, type, description, category } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const document = await tx.pMSDocument.create({
        data: {
          organizationId: session.user.organizationId,
          title,
          type,
          description: description ?? null,
          category: category ?? null,
        },
        include: {
          versions: true,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "PMSDocument",
          entityId: document.id,
          details: JSON.stringify({ title, type }),
        },
      });
      return document;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/documents error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
