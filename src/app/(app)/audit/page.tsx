import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AuditClient from "./audit-client";

export default async function AuditPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const orgId = session.user.organizationId;

  const [plansResult, correctivesResult, departmentsResult, usersResult] = await Promise.all([
    prisma.auditPlan.findMany({
      where: { organizationId: orgId },
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
      take: 50,
    }),
    prisma.correctiveAction.findMany({
      where: {
        OR: [
          { auditFinding: { auditPlan: { organizationId: orgId } } },
          { incident: { organizationId: orgId } },
          { responsible: { organizationId: orgId } },
        ],
      },
      include: {
        auditFinding: { select: { id: true, title: true, severity: true, auditPlan: { select: { id: true, title: true } } } },
        responsible: { select: { id: true, name: true } },
        verifiedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.department.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, departmentId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Date -> string にシリアライズ（クライアントコンポーネントに渡すため）
  const initialPlans = JSON.parse(JSON.stringify(plansResult));
  const initialCorrectives = JSON.parse(JSON.stringify(correctivesResult));

  return (
    <AuditClient
      initialPlans={initialPlans}
      initialCorrectives={initialCorrectives}
      departments={departmentsResult}
      users={usersResult}
    />
  );
}
