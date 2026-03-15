import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateIncidentActionSchema } from "@/lib/validations/incidents";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const existing = await prisma.incidentAction.findFirst({
      where: {
        id,
        incident: { organizationId: session.user.organizationId },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "アクションが見つかりません" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(updateIncidentActionSchema, body);
    if (!parsed.success) return parsed.error;
    const { status, title, description, dueDate } = parsed.data;

    const action = await prisma.$transaction(async (tx) => {
      const updated = await tx.incidentAction.update({
        where: { id },
        data: {
          ...(status !== undefined ? { status } : {}),
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
          // COMPLETED時にperformedAtを自動設定
          ...(status === "COMPLETED" ? { performedAt: new Date(), performedById: session.user.id } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "IncidentAction",
          entityId: id,
          details: JSON.stringify({ status, title }),
        },
      });
      return updated;
    });

    return NextResponse.json(action);
  } catch (error) {
    console.error("PUT /api/incidents/actions/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
