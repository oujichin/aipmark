import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import IncidentsClient from "./incidents-client";

export default async function IncidentsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const incidents = await prisma.incidentCase.findMany({
    where: {
      organizationId: session.user.organizationId,
    },
    include: {
      reportedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { actions: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Date -> string にシリアライズ
  const serialized = JSON.parse(JSON.stringify(incidents));

  return <IncidentsClient initialIncidents={serialized} />;
}
