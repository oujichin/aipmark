import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createRiskItemSchema } from "@/lib/validations/risk";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: riskAssessmentId } = await params;

    // Verify assessment exists and belongs to org
    const assessment = await prisma.riskAssessment.findUnique({
      where: { id: riskAssessmentId },
    });
    if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    if (assessment.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const result = parseBody(createRiskItemSchema, body);
    if (!result.success) return result.error;
    const {
      lifecycleStage,
      description,
      threatSource,
      vulnerability,
      likelihood,
      impact,
      registerItemId,
      businessProcessId,
    } = result.data;

    const lk = likelihood ?? 1;
    const imp = impact ?? 1;
    const riskValue = lk * imp;

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.riskItem.create({
        data: {
          riskAssessmentId,
          lifecycleStage,
          description,
          threatSource: threatSource ?? null,
          vulnerability: vulnerability ?? null,
          likelihood: lk,
          impact: imp,
          riskValue,
          registerItemId: registerItemId ?? null,
          businessProcessId: businessProcessId ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "RiskItem",
          entityId: created.id,
          details: JSON.stringify({ description, riskAssessmentId }),
        },
      });

      return created;
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/risk/assessments/[id]/items error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
