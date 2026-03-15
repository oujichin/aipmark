import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateRiskItemSchema } from "@/lib/validations/risk";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const item = await prisma.riskItem.findUnique({
      where: { id },
      include: {
        measures: { orderBy: { createdAt: "asc" } },
        residualRisk: true,
        riskAssessment: true,
        businessProcess: true,
        registerItem: true,
      },
    });

    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (item.riskAssessment.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("GET /api/risk/items/[id] error:", error);
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
    const existing = await prisma.riskItem.findUnique({
      where: { id },
      include: { riskAssessment: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.riskAssessment.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const result = parseBody(updateRiskItemSchema, body);
    if (!result.success) return result.error;
    const {
      lifecycleStage,
      description,
      threatSource,
      vulnerability,
      likelihood,
      impact,
      status,
      registerItemId,
      businessProcessId,
    } = result.data;

    // Auto-calculate riskValue when likelihood or impact changes
    const newLikelihood = likelihood ?? existing.likelihood;
    const newImpact = impact ?? existing.impact;
    const riskValue = newLikelihood * newImpact;

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.riskItem.update({
        where: { id },
        data: {
          ...(lifecycleStage !== undefined ? { lifecycleStage } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(threatSource !== undefined ? { threatSource } : {}),
          ...(vulnerability !== undefined ? { vulnerability } : {}),
          ...(likelihood !== undefined ? { likelihood } : {}),
          ...(impact !== undefined ? { impact } : {}),
          riskValue,
          ...(status !== undefined ? { status } : {}),
          ...(registerItemId !== undefined ? { registerItemId } : {}),
          ...(businessProcessId !== undefined ? { businessProcessId } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "RiskItem",
          entityId: id,
          details: JSON.stringify({ fields: Object.keys(body) }),
        },
      });

      return item;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/risk/items/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.riskItem.findUnique({
      where: { id },
      include: { riskAssessment: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.riskAssessment.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.riskItem.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "DELETE",
          entityType: "RiskItem",
          entityId: id,
          details: JSON.stringify({ description: existing.description }),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/risk/items/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
