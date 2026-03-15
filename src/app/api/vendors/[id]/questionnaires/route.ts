import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createVendorQuestionnaireSchema } from "@/lib/validations/vendors";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: vendorId } = await ctx.params;

    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, organizationId: session.user.organizationId },
    });

    if (!vendor) {
      return NextResponse.json({ error: "委託先が見つかりません" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(createVendorQuestionnaireSchema, body);
    if (!parsed.success) return parsed.error;
    const { questions, dueDate } = parsed.data;

    const questionnaire = await prisma.$transaction(async (tx) => {
      const created = await tx.vendorQuestionnaire.create({
        data: {
          vendorId,
          questions: questions ?? null,
          dueDate: dueDate ? new Date(dueDate) : null,
          status: "DRAFT",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "VendorQuestionnaire",
          entityId: created.id,
          details: JSON.stringify({ vendorId }),
        },
      });

      return created;
    });

    return NextResponse.json(questionnaire, { status: 201 });
  } catch (error) {
    console.error("POST /api/vendors/[id]/questionnaires error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
