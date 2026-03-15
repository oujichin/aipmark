import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateIncidentSchema } from "@/lib/validations/incidents";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id } = await context.params;

    const incident = await prisma.incidentCase.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        reportedBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        actions: {
          include: { performedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!incident) {
      return NextResponse.json({ error: "インシデントが見つかりません" }, { status: 404 });
    }

    return NextResponse.json(incident);
  } catch (error) {
    console.error("GET /api/incidents/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id } = await context.params;

    const existing = await prisma.incidentCase.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "インシデントが見つかりません" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(updateIncidentSchema, body);
    if (!parsed.success) return parsed.error;
    const {
      title,
      description,
      category,
      incidentDate,
      discoveredDate,
      affectedCount,
      affectedScope,
      dataTypes,
      containsSensitive,
      containsMyNumber,
      assignedToId,
      status,
    } = parsed.data;

    const incident = await prisma.$transaction(async (tx) => {
      const updated = await tx.incidentCase.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(category !== undefined ? { category } : {}),
          ...(incidentDate !== undefined ? { incidentDate: incidentDate ? new Date(incidentDate) : null } : {}),
          ...(discoveredDate !== undefined ? { discoveredDate: discoveredDate ? new Date(discoveredDate) : null } : {}),
          ...(affectedCount !== undefined ? { affectedCount } : {}),
          ...(affectedScope !== undefined ? { affectedScope } : {}),
          ...(dataTypes !== undefined ? { dataTypes: JSON.stringify(dataTypes) } : {}),
          ...(containsSensitive !== undefined ? { containsSensitive } : {}),
          ...(containsMyNumber !== undefined ? { containsMyNumber } : {}),
          ...(assignedToId !== undefined ? { assignedToId } : {}),
          ...(status !== undefined ? { status } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "IncidentCase",
          entityId: id,
          details: JSON.stringify({ updatedFields: Object.keys(body) }),
        },
      });

      return updated;
    });

    return NextResponse.json(incident);
  } catch (err) {
    console.error("PUT /api/incidents/[id] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
