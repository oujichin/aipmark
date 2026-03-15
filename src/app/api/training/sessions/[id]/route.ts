import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateTrainingSessionSchema } from "@/lib/validations/training";

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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as SessionUser;
    const { id } = await context.params;

    const trainingSession = await prisma.trainingSession.findFirst({
      where: {
        id,
        trainingPlan: { organizationId: user.organizationId },
      },
      include: {
        results: { include: { user: { select: { id: true, name: true, email: true } } } },
        quizQuestions: { orderBy: { sortOrder: "asc" } },
        trainingPlan: { select: { id: true, title: true, organizationId: true } },
      },
    });

    if (!trainingSession) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(trainingSession);
  } catch (error) {
    console.error("GET /api/training/sessions/[id] error:", error);
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

    const existing = await prisma.trainingSession.findFirst({
      where: {
        id,
        trainingPlan: { organizationId: user.organizationId },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(updateTrainingSessionSchema, body);
    if (!parsed.success) return parsed.error;
    const { title, sessionDate, facilitator, location, materialNote, status } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.trainingSession.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title: title as string } : {}),
          ...(sessionDate !== undefined ? { sessionDate: sessionDate ? new Date(sessionDate as string) : null } : {}),
          ...(facilitator !== undefined ? { facilitator: facilitator as string | null } : {}),
          ...(location !== undefined ? { location: location as string | null } : {}),
          ...(materialNote !== undefined ? { materialNote: materialNote as string | null } : {}),
          ...(status !== undefined ? { status: status as string } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "UPDATE",
          entityType: "TrainingSession",
          entityId: id,
          details: JSON.stringify({ fields: Object.keys(body) }),
        },
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/training/sessions/[id] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
