import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateVendorEvaluationSchema } from "@/lib/validations/vendors";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;

    const existing = await prisma.vendorEvaluation.findFirst({
      where: {
        id,
        vendor: { organizationId: session.user.organizationId },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "評価が見つかりません" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(updateVendorEvaluationSchema, body);
    if (!parsed.success) return parsed.error;
    const { scores, overallScore, rating, findings, status } = parsed.data;

    const isApproving = status === "APPROVED" && existing.status !== "APPROVED";

    const evaluation = await prisma.$transaction(async (tx) => {
      const result = await tx.vendorEvaluation.update({
        where: { id },
        data: {
          ...(scores !== undefined ? { scores } : {}),
          ...(overallScore !== undefined ? { overallScore } : {}),
          ...(rating !== undefined ? { rating } : {}),
          ...(findings !== undefined ? { findings } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(isApproving
            ? { approvedById: session.user.id, approvedAt: new Date() }
            : {}),
        },
      });

      // 承認時にベンダーのoverallRatingも更新
      if (isApproving && rating) {
        await tx.vendor.update({
          where: { id: result.vendorId },
          data: { overallRating: rating },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: isApproving ? "APPROVE" : "UPDATE",
          entityType: "VendorEvaluation",
          entityId: result.id,
          details: JSON.stringify({ updatedFields: Object.keys(body) }),
        },
      });

      return result;
    });

    return NextResponse.json(evaluation);
  } catch (error) {
    console.error("PUT /api/vendors/evaluations/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
