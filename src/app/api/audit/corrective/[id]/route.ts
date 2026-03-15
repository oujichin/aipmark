import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateCorrectiveActionSchema } from "@/lib/validations/audit";

type RouteContext = { params: Promise<{ id: string }> };

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["IMPLEMENTED"],
  IMPLEMENTED: ["VERIFIED"],
  VERIFIED: ["CLOSED"],
  CLOSED: [],
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const orgId = session.user.organizationId;

    const action = await prisma.correctiveAction.findFirst({
      where: {
        id,
        OR: [
          { auditFinding: { auditPlan: { organizationId: orgId } } },
          { incident: { organizationId: orgId } },
          { responsible: { organizationId: orgId } },
        ],
      },
      include: {
        auditFinding: {
          include: { auditPlan: { select: { id: true, title: true } } },
        },
        incident: { select: { id: true, title: true } },
        responsible: { select: { id: true, name: true } },
        verifiedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        evidenceRecords: true,
      },
    });

    if (!action) {
      return NextResponse.json({ error: "是正処置が見つかりません" }, { status: 404 });
    }

    return NextResponse.json(action);
  } catch (error) {
    console.error("GET /api/audit/corrective/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const orgId = session.user.organizationId;

    const existing = await prisma.correctiveAction.findFirst({
      where: {
        id,
        OR: [
          { auditFinding: { auditPlan: { organizationId: orgId } } },
          { incident: { organizationId: orgId } },
          { responsible: { organizationId: orgId } },
        ],
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "是正処置が見つかりません" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(updateCorrectiveActionSchema, body);
    if (!parsed.success) return parsed.error;
    const {
      status,
      title,
      rootCause,
      actionPlan,
      responsibleId,
      dueDate,
      implementNote,
      verifiedById,
      verifyNote,
      horizontalDeployment,
      approvedById,
    } = parsed.data;

    // Validate status transition
    if (status !== undefined && status !== existing.status) {
      const allowed = VALID_TRANSITIONS[existing.status];
      if (!allowed || !allowed.includes(status)) {
        return NextResponse.json(
          { error: `ステータス遷移が不正です（${existing.status} → ${status}）。許可: ${(allowed ?? []).join(", ") || "なし"}` },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (title !== undefined) updateData.title = title;
    if (rootCause !== undefined) updateData.rootCause = rootCause;
    if (actionPlan !== undefined) updateData.actionPlan = actionPlan;
    if (responsibleId !== undefined) updateData.responsibleId = responsibleId;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (implementNote !== undefined) updateData.implementNote = implementNote;
    if (verifiedById !== undefined) updateData.verifiedById = verifiedById;
    if (verifyNote !== undefined) updateData.verifyNote = verifyNote;
    if (horizontalDeployment !== undefined) updateData.horizontalDeployment = horizontalDeployment;
    if (approvedById !== undefined) updateData.approvedById = approvedById;

    // Auto-set timestamps based on status
    if (status === "IMPLEMENTED") updateData.implementedAt = new Date();
    if (status === "VERIFIED") updateData.verifiedAt = new Date();
    if (status === "CLOSED") updateData.approvedAt = new Date();

    const action = await prisma.$transaction(async (tx) => {
      const updated = await tx.correctiveAction.update({
        where: { id },
        data: updateData,
        include: {
          auditFinding: true,
          responsible: { select: { id: true, name: true } },
          verifiedBy: { select: { id: true, name: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "CorrectiveAction",
          entityId: id,
          details: JSON.stringify({ status, title }),
        },
      });
      return updated;
    });

    return NextResponse.json(action);
  } catch (error) {
    console.error("PUT /api/audit/corrective/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
