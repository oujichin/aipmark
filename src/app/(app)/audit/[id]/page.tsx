import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import AuditDetailClient from "./audit-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AuditDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;

  const plan = await prisma.auditPlan.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      leadAuditor: { select: { id: true, name: true } },
      targetDepts: { include: { department: { select: { id: true, name: true } } } },
      auditors: { include: { user: { select: { id: true, name: true } } } },
      checklistItems: { orderBy: { sortOrder: "asc" } },
      findings: {
        include: { correctiveAction: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!plan) notFound();

  const initialPlan = JSON.parse(JSON.stringify(plan));

  return <AuditDetailClient initialPlan={initialPlan} />;
}
