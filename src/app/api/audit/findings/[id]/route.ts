import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateAuditFindingSchema } from "@/lib/validations/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const finding = await prisma.auditFinding.findFirst({
      where: {
        id,
        auditPlan: { organizationId: session.user.organizationId },
      },
      include: {
        auditPlan: { select: { id: true, title: true, fiscalYear: true } },
        correctiveAction: true,
        evidenceRecords: true,
      },
    });

    if (!finding) {
      return NextResponse.json({ error: "指摘事項が見つかりません" }, { status: 404 });
    }

    return NextResponse.json(finding);
  } catch (error) {
    console.error("GET /api/audit/findings/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const existing = await prisma.auditFinding.findFirst({
      where: {
        id,
        auditPlan: { organizationId: session.user.organizationId },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "指摘事項が見つかりません" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(updateAuditFindingSchema, body);
    if (!parsed.success) return parsed.error;
    const { severity, title, description, jisClause, rootCauseTitle, status, closedAt } = parsed.data;

    const finding = await prisma.$transaction(async (tx) => {
      const updated = await tx.auditFinding.update({
        where: { id },
        data: {
          ...(severity !== undefined ? { severity } : {}),
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(jisClause !== undefined ? { jisClause } : {}),
          ...(rootCauseTitle !== undefined ? { rootCauseTitle } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(closedAt !== undefined ? { closedAt: closedAt ? new Date(closedAt) : null } : {}),
        },
        include: {
          correctiveAction: true,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "AuditFinding",
          entityId: id,
          details: JSON.stringify({ title, status }),
        },
      });
      return updated;
    });

    return NextResponse.json(finding);
  } catch (error) {
    console.error("PUT /api/audit/findings/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
