import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProfileClient from "./profile-client";

export default async function CompanyProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const organizationId = session.user.organizationId;

  const [org, departments] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: { select: { users: true, businessProcesses: true } },
      },
    }),
    prisma.department.findMany({
      where: { organizationId },
      include: {
        _count: { select: { users: true, businessProcesses: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!org) redirect("/login");

  const profile = {
    id: org.id,
    name: org.name,
    code: org.code,
    industry: org.industry ?? undefined,
    mainBusiness: org.mainBusiness ?? undefined,
    employeeCount: org.employeeCount ?? undefined,
    establishedYear: org.establishedYear ?? undefined,
    capital: org.capital ?? undefined,
    representative: org.representative ?? undefined,
    address: org.address ?? undefined,
    phone: org.phone ?? undefined,
    websiteUrl: org.websiteUrl ?? undefined,
    pmarkNumber: org.pmarkNumber ?? undefined,
    pmarkExpiry: org.pmarkExpiry ? org.pmarkExpiry.toISOString().split("T")[0] : undefined,
    certifyingBody: org.certifyingBody ?? undefined,
    aiProfileSummary: org.aiProfileSummary ?? undefined,
    aiResearchSources: org.aiResearchSources
      ? (JSON.parse(org.aiResearchSources) as Array<{ title: string; url: string }>)
      : undefined,
    aiResearchedAt: org.aiResearchedAt ? org.aiResearchedAt.toISOString() : undefined,
    _count: org._count,
  };

  const depts = departments.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    _count: d._count,
  }));

  return <ProfileClient initialProfile={profile} initialDepartments={depts} />;
}
