import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createCorrectiveActionSchema } from "@/lib/validations/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const skip = (page - 1) * limit;

    const where = {
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      OR: [
        { auditFinding: { auditPlan: { organizationId: session.user.organizationId } } },
        { incident: { organizationId: session.user.organizationId } },
        { responsible: { organizationId: session.user.organizationId } },
      ],
    };

    const [items, total] = await Promise.all([
      prisma.correctiveAction.findMany({
        where,
        include: {
          auditFinding: { select: { id: true, title: true, severity: true, auditPlan: { select: { id: true, title: true } } } },
          responsible: { select: { id: true, name: true } },
          verifiedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.correctiveAction.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/audit/corrective error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireRole("PRIVACY_OFFICER");
    if (error) return error;

    const body = await req.json();
    const parsed = parseBody(createCorrectiveActionSchema, body);
    if (!parsed.success) return parsed.error;
    const {
      source,
      auditFindingId,
      incidentId,
      title,
      rootCause,
      actionPlan,
      responsibleId,
      dueDate,
    } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const action = await tx.correctiveAction.create({
        data: {
          source: source ?? "AUDIT",
          auditFindingId: auditFindingId ?? null,
          incidentId: incidentId ?? null,
          title,
          rootCause: rootCause ?? null,
          actionPlan: actionPlan ?? null,
          responsibleId: responsibleId ?? null,
          dueDate: dueDate ? new Date(dueDate) : null,
          status: "OPEN",
        },
        include: {
          auditFinding: true,
          responsible: { select: { id: true, name: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "CorrectiveAction",
          entityId: action.id,
          details: JSON.stringify({ title, source }),
        },
      });
      return action;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/audit/corrective error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
