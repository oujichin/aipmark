import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateChangeReportSchema } from "@/lib/validations/application";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.changeReport.findUnique({
      where: { id },
      include: { package: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.package.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parseBody(updateChangeReportSchema, body);
    if (!parsed.success) return parsed.error;
    const { changeCategory, changeTitle, changeDetail, aiSummary, previousValue, currentValue, changedAt } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.changeReport.update({
        where: { id },
        data: {
          ...(changeCategory !== undefined ? { changeCategory } : {}),
          ...(changeTitle !== undefined ? { changeTitle } : {}),
          ...(changeDetail !== undefined ? { changeDetail } : {}),
          ...(aiSummary !== undefined ? { aiSummary } : {}),
          ...(previousValue !== undefined ? { previousValue } : {}),
          ...(currentValue !== undefined ? { currentValue } : {}),
          ...(changedAt !== undefined ? { changedAt: changedAt ? new Date(changedAt) : null } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "ChangeReport",
          entityId: id,
          details: JSON.stringify({ fields: Object.keys(body) }),
        },
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/application/change-reports/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
