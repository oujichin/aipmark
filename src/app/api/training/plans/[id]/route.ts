import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateTrainingPlanSchema } from "@/lib/validations/training";

interface SessionUser {
  id: string;
  organizationId: string;
  role: string;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;
    const user = session.user;
    const { id } = await context.params;

    const plan = await prisma.trainingPlan.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        sessions: {
          include: {
            results: { include: { user: { select: { id: true, name: true, email: true } } } },
            quizQuestions: { orderBy: { sortOrder: "asc" } },
          },
          orderBy: { sessionDate: "asc" },
        },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error("GET /api/training/plans/[id] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as SessionUser;
    const { id } = await context.params;

    const existing = await prisma.trainingPlan.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(updateTrainingPlanSchema, body);
    if (!parsed.success) return parsed.error;
    const { title, description, targetDetails, status, fiscalYear, approvedById } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const plan = await tx.trainingPlan.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title: title as string } : {}),
          ...(description !== undefined ? { description: description as string } : {}),
          ...(targetDetails !== undefined ? { targetDetails: typeof targetDetails === "string" ? targetDetails : JSON.stringify(targetDetails) } : {}),
          ...(status !== undefined ? { status: status as string } : {}),
          ...(fiscalYear !== undefined ? { fiscalYear: fiscalYear as number } : {}),
          ...(approvedById !== undefined ? { approvedById: approvedById as string, approvedAt: new Date() } : {}),
        },
        include: { sessions: true },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "UPDATE",
          entityType: "TrainingPlan",
          entityId: id,
          details: JSON.stringify({ fields: Object.keys(body) }),
        },
      });

      return plan;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/training/plans/[id] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as SessionUser;
    const { id } = await context.params;

    const existing = await prisma.trainingPlan.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.trainingPlan.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "DELETE",
          entityType: "TrainingPlan",
          entityId: id,
          details: JSON.stringify({ title: existing.title }),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/training/plans/[id] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
