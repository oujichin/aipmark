import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createQuizQuestionSchema } from "@/lib/validations/training";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    // テナント分離: trainingSession -> trainingPlan -> organizationId
    const trainingSession = await prisma.trainingSession.findFirst({
      where: {
        id,
        trainingPlan: { organizationId: session.user.organizationId },
      },
    });
    if (!trainingSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const questions = await prisma.quizQuestion.findMany({
      where: { trainingSessionId: id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(questions);
  } catch (error) {
    console.error("GET /api/training/sessions/[id]/quiz error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    // テナント分離: trainingSession -> trainingPlan -> organizationId
    const trainingSession = await prisma.trainingSession.findFirst({
      where: {
        id,
        trainingPlan: { organizationId: session.user.organizationId },
      },
    });
    if (!trainingSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = parseBody(createQuizQuestionSchema, body);
    if (!parsed.success) return parsed.error;
    const { questionText, questionType, options, correctAnswer, points, sortOrder } = parsed.data;

    // Get current max sortOrder for auto-increment
    const maxSort = await prisma.quizQuestion.findFirst({
      where: { trainingSessionId: id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const question = await prisma.$transaction(async (tx) => {
      const created = await tx.quizQuestion.create({
        data: {
          trainingSessionId: id,
          questionText,
          questionType: questionType ?? "SINGLE_CHOICE",
          options: JSON.stringify(options ?? []),
          correctAnswer: JSON.stringify(correctAnswer ?? ""),
          points: points ?? 1,
          sortOrder: sortOrder ?? ((maxSort?.sortOrder ?? -1) + 1),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "QuizQuestion",
          entityId: created.id,
          details: JSON.stringify({ sessionId: id }),
        },
      });

      return created;
    });

    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    console.error("POST /api/training/sessions/[id]/quiz error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
