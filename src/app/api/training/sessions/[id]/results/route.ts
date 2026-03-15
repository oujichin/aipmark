import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createTrainingResultsSchema } from "@/lib/validations/training";

interface SessionUser {
  id: string;
  organizationId: string;
  role: string;
}

interface ResultInput {
  userId: string;
  attended: boolean;
  quizScore?: number;
  quizMaxScore?: number;
  passed?: boolean;
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
    });
    if (!trainingSession) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const results = await prisma.trainingResult.findMany({
      where: { trainingSessionId: id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("GET /api/training/sessions/[id]/results error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

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

    const trainingSession = await prisma.trainingSession.findFirst({
      where: {
        id,
        trainingPlan: { organizationId: user.organizationId },
      },
    });
    if (!trainingSession) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(createTrainingResultsSchema, body);
    if (!parsed.success) return parsed.error;
    const { results } = parsed.data;

    const created = await prisma.$transaction(async (tx) => {
      const upserted = await Promise.all(
        (results as ResultInput[]).map((r) =>
          tx.trainingResult.upsert({
            where: {
              trainingSessionId_userId: {
                trainingSessionId: id,
                userId: r.userId,
              },
            },
            update: {
              attended: r.attended,
              attendedAt: r.attended ? new Date() : null,
              quizScore: r.quizScore,
              quizMaxScore: r.quizMaxScore,
              passed: r.passed,
              status: r.attended ? "ATTENDED" : "PENDING",
            },
            create: {
              trainingSessionId: id,
              userId: r.userId,
              attended: r.attended,
              attendedAt: r.attended ? new Date() : null,
              quizScore: r.quizScore,
              quizMaxScore: r.quizMaxScore,
              passed: r.passed,
              status: r.attended ? "ATTENDED" : "PENDING",
            },
          })
        )
      );

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "CREATE",
          entityType: "TrainingResult",
          entityId: id,
          details: JSON.stringify({ count: upserted.length, sessionId: id }),
        },
      });

      return upserted;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/training/sessions/[id]/results error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
