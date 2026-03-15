import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateVendorQuestionnaireSchema } from "@/lib/validations/vendors";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;

    const existing = await prisma.vendorQuestionnaire.findFirst({
      where: {
        id,
        vendor: { organizationId: session.user.organizationId },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "質問票が見つかりません" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(updateVendorQuestionnaireSchema, body);
    if (!parsed.success) return parsed.error;
    const { questions, answers, dueDate, status } = parsed.data;

    // ステータス遷移に応じたタイムスタンプ設定
    const isSending = status === "SENT" && existing.status !== "SENT";
    const isResponding = status === "RESPONDED" && existing.status !== "RESPONDED";

    const questionnaire = await prisma.$transaction(async (tx) => {
      const result = await tx.vendorQuestionnaire.update({
        where: { id },
        data: {
          ...(questions !== undefined ? { questions } : {}),
          ...(answers !== undefined ? { answers } : {}),
          ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(isSending ? { sentAt: new Date() } : {}),
          ...(isResponding ? { respondedAt: new Date() } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "VendorQuestionnaire",
          entityId: result.id,
          details: JSON.stringify({ status, updatedFields: Object.keys(body) }),
        },
      });

      return result;
    });

    return NextResponse.json(questionnaire);
  } catch (error) {
    console.error("PUT /api/vendors/questionnaires/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
