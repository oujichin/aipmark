import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createReviewSchema } from "@/lib/validations/reviews";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const fiscalYear = searchParams.get("fiscalYear");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const skip = (page - 1) * limit;

    const where = {
      organizationId: session.user.organizationId,
      ...(status ? { status } : {}),
      ...(fiscalYear ? { fiscalYear: parseInt(fiscalYear, 10) } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.managementReview.findMany({
        where,
        include: {
          _count: { select: { agendas: true, decisions: true, participants: true } },
          chairperson: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.managementReview.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/reviews error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireRole("PRIVACY_OFFICER");
    if (error) return error;

    const body = await req.json();
    const parsed = parseBody(createReviewSchema, body);
    if (!parsed.success) return parsed.error;
    const { fiscalYear, reviewDate, chairpersonId } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const review = await tx.managementReview.create({
        data: {
          organizationId: session.user.organizationId,
          fiscalYear,
          reviewDate: reviewDate ? new Date(reviewDate) : null,
          chairpersonId: chairpersonId ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "ManagementReview",
          entityId: review.id,
          details: JSON.stringify({ fiscalYear }),
        },
      });
      return review;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/reviews error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
