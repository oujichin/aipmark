import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { closeIncidentSchema } from "@/lib/validations/incidents";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const existing = await prisma.incidentCase.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "インシデントが見つかりません" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(closeIncidentSchema, body);
    if (!parsed.success) return parsed.error;
    const { closureNote } = parsed.data;

    const incident = await prisma.$transaction(async (tx) => {
      const updated = await tx.incidentCase.update({
        where: { id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CLOSE",
          entityType: "IncidentCase",
          entityId: id,
          details: JSON.stringify({ closureNote: closureNote ?? null }),
        },
      });
      return updated;
    });

    return NextResponse.json(incident);
  } catch (error) {
    console.error("PUT /api/incidents/[id]/close error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
