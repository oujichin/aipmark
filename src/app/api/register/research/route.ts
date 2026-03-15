import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createResearchProfileSchema, updateResearchProfileSchema } from "@/lib/validations/company";

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profiles = await prisma.researchProfile.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        researchSources: { orderBy: { createdAt: "asc" } },
        interviewHypotheses: { orderBy: { priority: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(profiles);
  } catch (error) {
    console.error("GET /api/register/research error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = parseBody(createResearchProfileSchema, body);
    if (!parsed.success) return parsed.error;
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
    } = parsed.data;

    const profile = await prisma.$transaction(async (tx) => {
      const created = await tx.researchProfile.create({
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
                create: sources.map((s) => ({
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

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "ResearchProfile",
          entityId: created.id,
          details: JSON.stringify({ status: status ?? "DRAFT" }),
        },
      });

      return created;
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("POST /api/register/research error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = parseBody(updateResearchProfileSchema, body);
    if (!parsed.success) return parsed.error;
    const { id, hypotheses, ...profileData } = parsed.data;

    // テナント分離チェック
    const existing = await prisma.researchProfile.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const profile = await prisma.$transaction(async (tx) => {
      const updated = await tx.researchProfile.update({
        where: { id },
        data: {
          ...profileData,
          ...(hypotheses
            ? {
                interviewHypotheses: {
                  deleteMany: {},
                  create: hypotheses.map((h) => ({
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

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "ResearchProfile",
          entityId: id,
          details: JSON.stringify({ fields: Object.keys(profileData) }),
        },
      });

      return updated;
    });

    return NextResponse.json(profile);
  } catch (error) {
    console.error("PUT /api/register/research error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
