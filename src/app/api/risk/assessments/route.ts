import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createRiskAssessmentSchema } from "@/lib/validations/risk";

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
      prisma.riskAssessment.findMany({
        where,
        include: {
          _count: { select: { items: true } },
          assessedBy: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.riskAssessment.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/risk/assessments error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireRole("PRIVACY_OFFICER");
    if (error) return error;

    const body = await req.json();
    const parsed = parseBody(createRiskAssessmentSchema, body);
    if (!parsed.success) return parsed.error;
    const { title, fiscalYear, description, targetScope, businessProcessId } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const assessment = await tx.riskAssessment.create({
        data: {
          organizationId: session.user.organizationId,
          title,
          fiscalYear,
          description: description ?? null,
          targetScope: targetScope ?? null,
          businessProcessId: businessProcessId ?? null,
          assessedById: session.user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "RiskAssessment",
          entityId: assessment.id,
          details: JSON.stringify({ title }),
        },
      });
      return assessment;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/risk/assessments error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
