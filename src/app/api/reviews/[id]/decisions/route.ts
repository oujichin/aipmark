import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createDecisionSchema } from "@/lib/validations/reviews";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const review = await prisma.managementReview.findUnique({ where: { id } });
    if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (review.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parseBody(createDecisionSchema, body);
    if (!parsed.success) return parsed.error;
    const { decisionTitle, decisionDetail, improvementInstructions, responsibleId, dueDate } = parsed.data;

    const decision = await prisma.$transaction(async (tx) => {
      const created = await tx.managementReviewDecision.create({
        data: {
          reviewId: id,
          decisionTitle,
          decisionDetail: decisionDetail ?? null,
          improvementInstructions: improvementInstructions ?? null,
          responsibleId: responsibleId ?? null,
          dueDate: dueDate ? new Date(dueDate) : null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "ManagementReviewDecision",
          entityId: created.id,
          details: JSON.stringify({ reviewId: id, decisionTitle }),
        },
      });

      return created;
    });

    return NextResponse.json(decision, { status: 201 });
  } catch (error) {
    console.error("POST /api/reviews/[id]/decisions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
