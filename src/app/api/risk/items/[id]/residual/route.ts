import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createResidualRiskSchema, updateResidualRiskSchema } from "@/lib/validations/risk";

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

    // Check for existing residual risk
    const existingResidual = await prisma.residualRisk.findUnique({
      where: { riskItemId },
    });
    if (existingResidual) {
      return NextResponse.json(
        { error: "残留リスクは既に設定されています。更新はPUTを使用してください" },
        { status: 409 }
      );
    }

    const body = await req.json();
    const result = parseBody(createResidualRiskSchema, body);
    if (!result.success) return result.error;
    const { likelihood, impact, accepted, justification } = result.data;

    const lk = likelihood ?? 1;
    const imp = impact ?? 1;
    const riskValue = lk * imp;

    const residual = await prisma.$transaction(async (tx) => {
      const created = await tx.residualRisk.create({
        data: {
          riskItemId,
          likelihood: lk,
          impact: imp,
          riskValue,
          accepted: accepted ?? false,
          justification: justification ?? null,
          ...(accepted ? { acceptedById: session.user.id, acceptedAt: new Date() } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "ResidualRisk",
          entityId: created.id,
          details: JSON.stringify({ riskItemId, riskValue }),
        },
      });

      return created;
    });

    return NextResponse.json(residual, { status: 201 });
  } catch (error) {
    console.error("POST /api/risk/items/[id]/residual error:", error);
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

    const existingResidual = await prisma.residualRisk.findUnique({
      where: { riskItemId },
    });
    if (!existingResidual) {
      return NextResponse.json({ error: "残留リスクが見つかりません" }, { status: 404 });
    }

    const body = await req.json();
    const result = parseBody(updateResidualRiskSchema, body);
    if (!result.success) return result.error;
    const { likelihood, impact, accepted, justification } = result.data;

    const newLikelihood = likelihood ?? existingResidual.likelihood;
    const newImpact = impact ?? existingResidual.impact;
    const riskValue = newLikelihood * newImpact;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.residualRisk.update({
        where: { riskItemId },
        data: {
          ...(likelihood !== undefined ? { likelihood } : {}),
          ...(impact !== undefined ? { impact } : {}),
          riskValue,
          ...(accepted !== undefined ? { accepted } : {}),
          ...(justification !== undefined ? { justification } : {}),
          ...(accepted === true ? { acceptedById: session.user.id, acceptedAt: new Date() } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "ResidualRisk",
          entityId: result.id,
          details: JSON.stringify({ fields: Object.keys(body) }),
        },
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/risk/items/[id]/residual error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
