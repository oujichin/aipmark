import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateDecisionSchema } from "@/lib/validations/reviews";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.managementReviewDecision.findUnique({
      where: { id },
      include: { review: { select: { organizationId: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.review.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parseBody(updateDecisionSchema, body);
    if (!parsed.success) return parsed.error;
    const { decisionTitle, decisionDetail, improvementInstructions, responsibleId, dueDate, status, followUpNotes } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.managementReviewDecision.update({
        where: { id },
        data: {
          ...(decisionTitle !== undefined ? { decisionTitle } : {}),
          ...(decisionDetail !== undefined ? { decisionDetail } : {}),
          ...(improvementInstructions !== undefined ? { improvementInstructions } : {}),
          ...(responsibleId !== undefined ? { responsibleId } : {}),
          ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(followUpNotes !== undefined ? { followUpNotes } : {}),
          ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "ManagementReviewDecision",
          entityId: id,
          details: JSON.stringify({ fields: Object.keys(body) }),
        },
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/reviews/decisions/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
