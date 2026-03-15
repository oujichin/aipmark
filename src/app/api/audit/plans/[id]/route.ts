import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateAuditPlanSchema } from "@/lib/validations/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const plan = await prisma.auditPlan.findFirst({
      where: { id, organizationId: session.user.organizationId },
      include: {
        leadAuditor: { select: { id: true, name: true } },
        targetDepts: { include: { department: { select: { id: true, name: true } } } },
        auditors: { include: { user: { select: { id: true, name: true, departmentId: true } } } },
        checklistItems: { orderBy: { sortOrder: "asc" } },
        findings: {
          include: {
            correctiveAction: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "監査計画が見つかりません" }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error("GET /api/audit/plans/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const existing = await prisma.auditPlan.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "監査計画が見つかりません" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(updateAuditPlanSchema, body);
    if (!parsed.success) return parsed.error;
    const { title, scope, criteria, status, leadAuditorId, scheduledDate, completedDate } = parsed.data;

    const plan = await prisma.$transaction(async (tx) => {
      const updated = await tx.auditPlan.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(scope !== undefined ? { scope } : {}),
          ...(criteria !== undefined ? { criteria } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(leadAuditorId !== undefined ? { leadAuditorId } : {}),
          ...(scheduledDate !== undefined ? { scheduledDate: scheduledDate ? new Date(scheduledDate) : null } : {}),
          ...(completedDate !== undefined ? { completedDate: completedDate ? new Date(completedDate) : null } : {}),
        },
        include: {
          targetDepts: { include: { department: true } },
          auditors: { include: { user: true } },
          checklistItems: true,
          findings: true,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "AuditPlan",
          entityId: id,
          details: JSON.stringify({ title, status }),
        },
      });
      return updated;
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error("PUT /api/audit/plans/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
