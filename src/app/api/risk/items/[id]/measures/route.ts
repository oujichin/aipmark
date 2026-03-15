import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createControlMeasureSchema } from "@/lib/validations/risk";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: riskItemId } = await params;

    // Verify risk item exists and belongs to org
    const riskItem = await prisma.riskItem.findUnique({
      where: { id: riskItemId },
      include: { riskAssessment: true },
    });
    if (!riskItem) return NextResponse.json({ error: "RiskItem not found" }, { status: 404 });
    if (riskItem.riskAssessment.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const result = parseBody(createControlMeasureSchema, body);
    if (!result.success) return result.error;
    const { category, description, responsible, status } = result.data;

    const measure = await prisma.$transaction(async (tx) => {
      const created = await tx.controlMeasure.create({
        data: {
          riskItemId,
          category,
          description,
          responsible: responsible ?? null,
          status: status ?? "PLANNED",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "ControlMeasure",
          entityId: created.id,
          details: JSON.stringify({ category, riskItemId }),
        },
      });

      return created;
    });

    return NextResponse.json(measure, { status: 201 });
  } catch (error) {
    console.error("POST /api/risk/items/[id]/measures error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
