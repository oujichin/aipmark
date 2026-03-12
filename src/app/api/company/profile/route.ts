import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    include: {
      departments: { orderBy: { name: "asc" } },
      _count: { select: { users: true, businessProcesses: true } },
    },
  });

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...org,
    aiResearchSources: org.aiResearchSources ? JSON.parse(org.aiResearchSources) : [],
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Don't allow overwriting AI cache from this endpoint
  const { aiProfileSummary, aiResearchSources, aiResearchedAt, ...editableFields } = body;

  const updated = await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      ...editableFields,
      // Allow explicit AI cache updates when passed as a dedicated field
      ...(body._updateAiCache ? {
        aiProfileSummary,
        aiResearchSources: aiResearchSources ? JSON.stringify(aiResearchSources) : undefined,
        aiResearchedAt: aiResearchedAt ? new Date(aiResearchedAt) : new Date(),
      } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Organization",
      entityId: updated.id,
      details: JSON.stringify({ fields: Object.keys(editableFields) }),
    },
  });

  return NextResponse.json(updated);
}
