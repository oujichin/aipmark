import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createTrainingSessionSchema } from "@/lib/validations/training";

interface SessionUser {
  id: string;
  organizationId: string;
  role: string;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
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

    const plan = await prisma.trainingPlan.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!plan) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(createTrainingSessionSchema, body);
    if (!parsed.success) return parsed.error;
    const { title, sessionDate, facilitator, location, materialNote } = parsed.data;

    const trainingSession = await prisma.$transaction(async (tx) => {
      const created = await tx.trainingSession.create({
        data: {
          trainingPlanId: id,
          title: title as string,
          sessionDate: sessionDate ? new Date(sessionDate as string) : null,
          facilitator: (facilitator as string) || null,
          location: (location as string) || null,
          materialNote: (materialNote as string) || null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "CREATE",
          entityType: "TrainingSession",
          entityId: created.id,
          details: JSON.stringify({ title, planId: id }),
        },
      });

      return created;
    });

    return NextResponse.json(trainingSession, { status: 201 });
  } catch (error) {
    console.error("POST /api/training/plans/[id]/sessions error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
