import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateReviewSchema } from "@/lib/validations/reviews";
import { pickDefined } from "@/lib/utils/pick-defined";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id } = await params;
    const review = await prisma.managementReview.findFirst({
      where: { id, organizationId: session.user.organizationId },
      include: {
        agendas: { orderBy: { sortOrder: "asc" } },
        decisions: {
          include: { responsible: { select: { id: true, name: true } } },
        },
        participants: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        chairperson: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(review);
  } catch (error) {
    console.error("GET /api/reviews/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.managementReview.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parseBody(updateReviewSchema, body);
    if (!parsed.success) return parsed.error;
    const d = parsed.data;

    // pickDefined で単純コピーできるフィールドをまとめて抽出
    const simpleFields = pickDefined(d, [
      "fiscalYear", "chairpersonId", "status",
      "riskSummary", "trainingSummary", "vendorSummary",
      "auditSummary", "incidentSummary", "correctiveActionSummary",
      "externalIssues", "internalIssues", "stakeholderFeedback",
      "minutes", "approvedById",
    ]);

    const updated = await prisma.$transaction(async (tx) => {
      const review = await tx.managementReview.update({
        where: { id },
        data: {
          ...simpleFields,
          ...(d.reviewDate !== undefined ? { reviewDate: d.reviewDate ? new Date(d.reviewDate) : null } : {}),
          ...(d.status === "APPROVED" ? { approvedAt: new Date() } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "ManagementReview",
          entityId: id,
          details: JSON.stringify({ fields: Object.keys(body) }),
        },
      });

      return review;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/reviews/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
