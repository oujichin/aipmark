import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createAuditFindingSchema } from "@/lib/validations/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const plan = await prisma.auditPlan.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!plan) {
      return NextResponse.json({ error: "監査計画が見つかりません" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(createAuditFindingSchema, body);
    if (!parsed.success) return parsed.error;
    const { severity, title, description, jisClause } = parsed.data;

    const finding = await prisma.$transaction(async (tx) => {
      const created = await tx.auditFinding.create({
        data: {
          auditPlanId: id,
          severity: severity ?? "MINOR",
          title,
          description,
          jisClause: jisClause ?? null,
          status: "OPEN",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "AuditFinding",
          entityId: created.id,
          details: JSON.stringify({ title, severity }),
        },
      });

      return created;
    });

    return NextResponse.json(finding, { status: 201 });
  } catch (error) {
    console.error("POST /api/audit/plans/[id]/findings error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
