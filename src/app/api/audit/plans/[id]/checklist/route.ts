import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createChecklistItemSchema } from "@/lib/validations/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const items = await prisma.auditChecklistItem.findMany({
      where: {
        auditPlanId: id,
        auditPlan: { organizationId: session.user.organizationId },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/audit/plans/[id]/checklist error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

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
    const parsed = parseBody(createChecklistItemSchema, body);
    if (!parsed.success) return parsed.error;
    const { category, question, responseType, sortOrder } = parsed.data;

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.auditChecklistItem.create({
        data: {
          auditPlanId: id,
          category: category ?? null,
          question,
          responseType: responseType ?? "YES_NO",
          sortOrder: sortOrder ?? 0,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "AuditChecklistItem",
          entityId: created.id,
          details: JSON.stringify({ question, auditPlanId: id }),
        },
      });
      return created;
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/audit/plans/[id]/checklist error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
