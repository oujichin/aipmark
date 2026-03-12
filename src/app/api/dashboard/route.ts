import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.user.organizationId;

  const [
    processCount,
    totalItems,
    pendingApproval,
    approved,
    rejected,
    recentLogs,
    processes,
  ] = await Promise.all([
    prisma.businessProcess.count({ where: { organizationId: orgId } }),
    prisma.registerItem.count({ where: { businessProcess: { organizationId: orgId } } }),
    prisma.registerItem.count({
      where: { businessProcess: { organizationId: orgId }, status: "PENDING_APPROVAL" },
    }),
    prisma.registerItem.count({
      where: { businessProcess: { organizationId: orgId }, status: { in: ["APPROVED", "LOCKED"] } },
    }),
    prisma.registerItem.count({
      where: { businessProcess: { organizationId: orgId }, status: "REJECTED" },
    }),
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { user: true },
    }),
    prisma.businessProcess.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { registerItems: true } },
        registerItems: { select: { status: true } },
      },
    }),
  ]);

  const processProgress = processes.map((p) => {
    const items = p.registerItems;
    const lockedOrApproved = items.filter((i) => ["LOCKED", "APPROVED"].includes(i.status)).length;
    const total = items.length;
    return {
      id: p.id,
      name: p.name,
      total,
      approved: lockedOrApproved,
      pending: items.filter((i) => i.status === "PENDING_APPROVAL").length,
      draft: items.filter((i) => ["DRAFT", "REVIEWING"].includes(i.status)).length,
      progress: total > 0 ? Math.round((lockedOrApproved / total) * 100) : 0,
    };
  });

  return NextResponse.json({
    stats: { processCount, totalItems, pendingApproval, approved, rejected },
    processProgress,
    recentLogs: recentLogs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      userName: l.user?.name ?? "システム",
      details: l.details,
      createdAt: l.createdAt,
    })),
  });
}
