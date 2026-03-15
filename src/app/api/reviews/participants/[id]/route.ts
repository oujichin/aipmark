import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.managementReviewParticipant.findUnique({
      where: { id },
      include: { review: { select: { organizationId: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.review.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.managementReviewParticipant.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "DELETE",
          entityType: "ManagementReviewParticipant",
          entityId: id,
          details: JSON.stringify({ reviewId: existing.reviewId, userId: existing.userId }),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/reviews/participants/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
