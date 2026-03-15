import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateTrainingResultSchema } from "@/lib/validations/training";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    // テナント分離: trainingResult -> trainingSession -> trainingPlan -> organizationId
    const existing = await prisma.trainingResult.findFirst({
      where: {
        id,
        trainingSession: {
          trainingPlan: { organizationId: session.user.organizationId },
        },
      },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = parseBody(updateTrainingResultSchema, body);
    if (!parsed.success) return parsed.error;
    const { attended, quizScore, quizMaxScore, passed, status, completedAt } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.trainingResult.update({
        where: { id },
        data: {
          ...(attended !== undefined ? { attended, attendedAt: attended ? new Date() : null } : {}),
          ...(quizScore !== undefined ? { quizScore } : {}),
          ...(quizMaxScore !== undefined ? { quizMaxScore } : {}),
          ...(passed !== undefined ? { passed } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(completedAt !== undefined ? { completedAt: completedAt ? new Date(completedAt) : null } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "TrainingResult",
          entityId: id,
          details: JSON.stringify({ fields: Object.keys(body) }),
        },
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/training/results/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
