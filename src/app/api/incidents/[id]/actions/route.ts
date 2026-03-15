import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createIncidentActionSchema } from "@/lib/validations/incidents";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const incident = await prisma.incidentCase.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!incident) {
      return NextResponse.json({ error: "インシデントが見つかりません" }, { status: 404 });
    }

    const actions = await prisma.incidentAction.findMany({
      where: { incidentId: id },
      include: { performedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(actions);
  } catch (error) {
    console.error("GET /api/incidents/[id]/actions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const incident = await prisma.incidentCase.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!incident) {
      return NextResponse.json({ error: "インシデントが見つかりません" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(createIncidentActionSchema, body);
    if (!parsed.success) return parsed.error;
    const { actionType, title, description, dueDate } = parsed.data;

    const action = await prisma.$transaction(async (tx) => {
      const created = await tx.incidentAction.create({
        data: {
          incidentId: id,
          actionType,
          title,
          description: description ?? null,
          performedById: session.user.id,
          dueDate: dueDate ? new Date(dueDate) : null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "IncidentAction",
          entityId: created.id,
          details: JSON.stringify({ incidentId: id, actionType, title }),
        },
      });

      return created;
    });

    return NextResponse.json(action, { status: 201 });
  } catch (error) {
    console.error("POST /api/incidents/[id]/actions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
