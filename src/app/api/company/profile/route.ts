import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateOrganizationSchema } from "@/lib/validations/company";

export async function GET() {
  try {
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
  } catch (error) {
    console.error("GET /api/company/profile error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = parseBody(updateOrganizationSchema, body);
    if (!parsed.success) return parsed.error;

    const { _updateAiCache, aiProfileSummary, aiResearchSources, aiResearchedAt, ...editableFields } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: session.user.organizationId },
        data: {
          ...editableFields,
          pmarkExpiry: editableFields.pmarkExpiry ? new Date(editableFields.pmarkExpiry) : editableFields.pmarkExpiry,
          // Allow explicit AI cache updates when passed as a dedicated field
          ...(_updateAiCache ? {
            aiProfileSummary,
            aiResearchSources: aiResearchSources ? JSON.stringify(aiResearchSources) : undefined,
            aiResearchedAt: aiResearchedAt ? new Date(aiResearchedAt) : new Date(),
          } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "Organization",
          entityId: updated.id,
          details: JSON.stringify({ fields: Object.keys(editableFields) }),
        },
      });

      return updated;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("PUT /api/company/profile error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
