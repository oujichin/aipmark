import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId") ?? session.user.organizationId;

  const profiles = await prisma.researchProfile.findMany({
    where: { organizationId: orgId },
    include: {
      researchSources: { orderBy: { createdAt: "asc" } },
      interviewHypotheses: { orderBy: { priority: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    companyOverview,
    industryType,
    employeeCount,
    mainServices,
    dataSubjectsEst,
    systemsEst,
    rawNotes,
    aiSummary,
    status,
    sources,
  } = body;

  const profile = await prisma.researchProfile.create({
    data: {
      organizationId: session.user.organizationId,
      companyOverview,
      industryType,
      employeeCount,
      mainServices,
      dataSubjectsEst,
      systemsEst,
      rawNotes,
      aiSummary,
      status: status ?? "DRAFT",
      researchSources: sources
        ? {
            create: sources.map((s: { sourceType: string; url?: string; title: string; snippet?: string; relevanceNote?: string }) => ({
              sourceType: s.sourceType,
              url: s.url,
              title: s.title,
              snippet: s.snippet,
              relevanceNote: s.relevanceNote,
            })),
          }
        : undefined,
    },
    include: {
      researchSources: true,
      interviewHypotheses: true,
    },
  });

  return NextResponse.json(profile, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, hypotheses, ...profileData } = body;

  const profile = await prisma.researchProfile.update({
    where: { id },
    data: {
      ...profileData,
      ...(hypotheses
        ? {
            interviewHypotheses: {
              deleteMany: {},
              create: hypotheses.map((h: {
                topic: string;
                question: string;
                hypothesis?: string;
                confidenceLevel?: string;
                priority?: number;
                basis?: string;
              }) => ({
                topic: h.topic,
                question: h.question,
                hypothesis: h.hypothesis,
                confidenceLevel: h.confidenceLevel ?? "LOW",
                priority: h.priority ?? 3,
                basis: h.basis,
              })),
            },
          }
        : {}),
    },
    include: {
      researchSources: true,
      interviewHypotheses: { orderBy: { priority: "asc" } },
    },
  });

  return NextResponse.json(profile);
}
