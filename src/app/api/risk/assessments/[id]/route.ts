import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateRiskAssessmentSchema } from "@/lib/validations/risk";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id } = await params;
    const assessment = await prisma.riskAssessment.findFirst({
      where: { id, organizationId: session.user.organizationId },
      include: {
        items: {
          include: {
            measures: true,
            residualRisk: true,
            businessProcess: true,
            registerItem: true,
          },
          orderBy: { createdAt: "asc" },
        },
        assessedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    if (!assessment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(assessment);
  } catch (error) {
    console.error("GET /api/risk/assessments/[id] error:", error);
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
    const existing = await prisma.riskAssessment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const result = parseBody(updateRiskAssessmentSchema, body);
    if (!result.success) return result.error;
    const { title, description, targetScope, status, fiscalYear, businessProcessId, approvedById } = result.data;

    const updated = await prisma.$transaction(async (tx) => {
      const assessment = await tx.riskAssessment.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(targetScope !== undefined ? { targetScope } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(fiscalYear !== undefined ? { fiscalYear } : {}),
          ...(businessProcessId !== undefined ? { businessProcessId } : {}),
          ...(approvedById !== undefined ? { approvedById } : {}),
          ...(status === "APPROVED" ? { approvedAt: new Date() } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "RiskAssessment",
          entityId: id,
          details: JSON.stringify({ fields: Object.keys(body) }),
        },
      });

      return assessment;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/risk/assessments/[id] error:", error);
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
    const existing = await prisma.riskAssessment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.riskAssessment.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "DELETE",
          entityType: "RiskAssessment",
          entityId: id,
          details: JSON.stringify({ title: existing.title }),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/risk/assessments/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
