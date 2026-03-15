import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateChecklistItemSchema } from "@/lib/validations/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const existing = await prisma.auditChecklistItem.findFirst({
      where: {
        id,
        auditPlan: { organizationId: session.user.organizationId },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "チェックリスト項目が見つかりません" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(updateChecklistItemSchema, body);
    if (!parsed.success) return parsed.error;
    const { result, evidenceNote, comment, category, question, responseType, sortOrder } = parsed.data;

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.auditChecklistItem.update({
        where: { id },
        data: {
          ...(result !== undefined ? { result } : {}),
          ...(evidenceNote !== undefined ? { evidenceNote } : {}),
          ...(comment !== undefined ? { comment } : {}),
          ...(category !== undefined ? { category } : {}),
          ...(question !== undefined ? { question } : {}),
          ...(responseType !== undefined ? { responseType } : {}),
          ...(sortOrder !== undefined ? { sortOrder } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "AuditChecklistItem",
          entityId: id,
          details: JSON.stringify({ result, category }),
        },
      });
      return updated;
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("PUT /api/audit/checklist/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
