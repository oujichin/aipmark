import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createParticipantSchema } from "@/lib/validations/reviews";

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
    const parsed = parseBody(createParticipantSchema, body);
    if (!parsed.success) return parsed.error;
    const { userId, role } = parsed.data;

    // Check for duplicate
    const existing = await prisma.managementReviewParticipant.findUnique({
      where: { reviewId_userId: { reviewId: id, userId } },
    });
    if (existing) {
      return NextResponse.json({ error: "この参加者は既に追加されています" }, { status: 409 });
    }

    const participant = await prisma.$transaction(async (tx) => {
      const created = await tx.managementReviewParticipant.create({
        data: {
          reviewId: id,
          userId,
          role: role ?? "ATTENDEE",
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "ManagementReviewParticipant",
          entityId: created.id,
          details: JSON.stringify({ reviewId: id, userId }),
        },
      });

      return created;
    });

    return NextResponse.json(participant, { status: 201 });
  } catch (error) {
    console.error("POST /api/reviews/[id]/participants error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
