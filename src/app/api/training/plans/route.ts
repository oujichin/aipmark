import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createTrainingPlanSchema } from "@/lib/validations/training";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user;

    const { searchParams } = new URL(req.url);
    const fiscalYear = searchParams.get("fiscalYear");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
    };
    if (fiscalYear) where.fiscalYear = parseInt(fiscalYear, 10);
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.trainingPlan.findMany({
        where,
        include: {
          sessions: {
            include: {
              _count: { select: { results: true } },
            },
          },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { sessions: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.trainingPlan.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/training/plans error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireRole("DEPT_MANAGER");
    if (error) return error;
    const user = session.user;

    const body = await req.json();
    const parsed = parseBody(createTrainingPlanSchema, body);
    if (!parsed.success) return parsed.error;
    const { fiscalYear, title, description, targetDetails } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const plan = await tx.trainingPlan.create({
        data: {
          organizationId: user.organizationId,
          fiscalYear,
          title,
          description: (description as string | null) || null,
          targetDetails: targetDetails ? (typeof targetDetails === "string" ? targetDetails : JSON.stringify(targetDetails)) : null,
          createdById: user.id,
        },
        include: { sessions: true },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "CREATE",
          entityType: "TrainingPlan",
          entityId: plan.id,
          details: JSON.stringify({ title, fiscalYear }),
        },
      });
      return plan;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/training/plans error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
