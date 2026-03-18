import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ResearchClient from "./research-client";

export default async function ResearchPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const organizationId = session.user.organizationId;

  const profileRows = await prisma.researchProfile.findMany({
    where: { organizationId },
    include: {
      researchSources: { orderBy: { createdAt: "asc" } },
      interviewHypotheses: { orderBy: { priority: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Serialize Date objects for client component
  const profiles = profileRows.map((p) => ({
    id: p.id,
    companyOverview: p.companyOverview,
    industryType: p.industryType,
    employeeCount: p.employeeCount,
    mainServices: p.mainServices,
    dataSubjectsEst: p.dataSubjectsEst,
    systemsEst: p.systemsEst,
    rawNotes: p.rawNotes,
    aiSummary: p.aiSummary,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    researchSources: p.researchSources.map((s) => ({
      id: s.id,
      sourceType: s.sourceType,
      url: s.url,
      title: s.title,
      snippet: s.snippet,
      relevanceNote: s.relevanceNote,
      createdAt: s.createdAt.toISOString(),
    })),
    interviewHypotheses: p.interviewHypotheses.map((h) => ({
      id: h.id,
      topic: h.topic,
      question: h.question,
      hypothesis: h.hypothesis,
      confidenceLevel: h.confidenceLevel,
      priority: h.priority,
      basis: h.basis,
      answered: h.answered,
      answer: h.answer,
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt.toISOString(),
    })),
  }));

  return <ResearchClient initialProfiles={profiles} />;
}
