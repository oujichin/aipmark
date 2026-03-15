import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { assessIncidentSchema } from "@/lib/validations/incidents";

type RouteContext = { params: Promise<{ id: string }> };

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const existing = await prisma.incidentCase.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "インシデントが見つかりません" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(assessIncidentSchema, body);
    if (!parsed.success) return parsed.error;
    const { severity, affectedCount } = parsed.data;

    const isHighOrCritical = severity === "HIGH" || severity === "CRITICAL";
    const discoveredDate = existing.discoveredDate ?? new Date();

    // 法定報告要否と期限の自動計算
    const requiresSpeedReport = isHighOrCritical;
    const speedReportDeadline = isHighOrCritical ? addDays(discoveredDate, 5) : null;
    const requiresFullReport = isHighOrCritical;

    // マイナンバー含む場合は60日、それ以外は30日
    const fullReportDays = existing.containsMyNumber ? 60 : 30;
    const fullReportDeadline = isHighOrCritical ? addDays(discoveredDate, fullReportDays) : null;

    const incident = await prisma.$transaction(async (tx) => {
      const updated = await tx.incidentCase.update({
        where: { id },
        data: {
          severity,
          ...(affectedCount !== undefined ? { affectedCount } : {}),
          requiresSpeedReport,
          speedReportDeadline,
          requiresFullReport,
          fullReportDeadline,
          status: "ASSESSING",
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "ASSESS",
          entityType: "IncidentCase",
          entityId: id,
          details: JSON.stringify({ severity, requiresSpeedReport, requiresFullReport }),
        },
      });
      return updated;
    });

    return NextResponse.json(incident);
  } catch (error) {
    console.error("POST /api/incidents/[id]/assess error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
