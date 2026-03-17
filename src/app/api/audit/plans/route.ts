import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createAuditPlanSchema } from "@/lib/validations/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const skip = (page - 1) * limit;

    const where = {
      organizationId: session.user.organizationId,
      ...(status ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.auditPlan.findMany({
        where,
        include: {
          leadAuditor: { select: { id: true, name: true } },
          targetDepts: { include: { department: { select: { id: true, name: true } } } },
          auditors: { include: { user: { select: { id: true, name: true } } } },
          findings: {
            select: { id: true, title: true, severity: true, status: true, createdAt: true },
          },
          _count: { select: { findings: true, checklistItems: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditPlan.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/audit/plans error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireRole("PRIVACY_OFFICER");
    if (error) return error;

    const body = await req.json();
    const parsed = parseBody(createAuditPlanSchema, body);
    if (!parsed.success) return parsed.error;
    const { fiscalYear, title, targetDeptIds, auditorIds, scope, criteria, scheduledDate, leadAuditorId } = parsed.data;

    // 職務分離チェック: 監査員が対象部門に所属していないか
    if (Array.isArray(auditorIds) && auditorIds.length > 0 && Array.isArray(targetDeptIds) && targetDeptIds.length > 0) {
      const auditorUsers = await prisma.user.findMany({
        where: { id: { in: auditorIds as string[] } },
        select: { id: true, name: true, departmentId: true },
      });
      const targetDeptIdSet = new Set(targetDeptIds as string[]);
      const conflicts = auditorUsers.filter((u) => u.departmentId && targetDeptIdSet.has(u.departmentId));
      if (conflicts.length > 0) {
        const names = conflicts.map((c) => c.name).join(", ");
        return NextResponse.json(
          { error: `自部門を監査することはできません（該当: ${names}）` },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const plan = await tx.auditPlan.create({
        data: {
          organizationId: session.user.organizationId,
          fiscalYear,
          title,
          scope: scope ?? null,
          criteria: criteria ?? null,
          leadAuditorId: leadAuditorId ?? null,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          status: "DRAFT",
          targetDepts: Array.isArray(targetDeptIds) && targetDeptIds.length > 0
            ? { create: (targetDeptIds as string[]).map((deptId: string) => ({ departmentId: deptId })) }
            : undefined,
          auditors: Array.isArray(auditorIds) && auditorIds.length > 0
            ? { create: (auditorIds as string[]).map((userId: string) => ({ userId, role: "AUDITOR" })) }
            : undefined,
        },
        include: {
          targetDepts: { include: { department: true } },
          auditors: { include: { user: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "AuditPlan",
          entityId: plan.id,
          details: JSON.stringify({ title, fiscalYear }),
        },
      });
      return plan;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/audit/plans error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
