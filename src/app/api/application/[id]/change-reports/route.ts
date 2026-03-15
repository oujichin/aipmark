import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createChangeReportSchema } from "@/lib/validations/application";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const pkg = await prisma.applicationPackage.findUnique({ where: { id } });
    if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (pkg.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parseBody(createChangeReportSchema, body);
    if (!parsed.success) return parsed.error;
    const { changeCategory, changeTitle, changeDetail, aiSummary, previousValue, currentValue, changedAt } = parsed.data;

    const report = await prisma.$transaction(async (tx) => {
      const created = await tx.changeReport.create({
        data: {
          packageId: id,
          changeCategory,
          changeTitle,
          changeDetail: changeDetail ?? null,
          aiSummary: aiSummary ?? null,
          previousValue: previousValue ?? null,
          currentValue: currentValue ?? null,
          changedAt: changedAt ? new Date(changedAt) : null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "ChangeReport",
          entityId: created.id,
          details: JSON.stringify({ changeCategory, changeTitle, packageId: id }),
        },
      });

      return created;
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("POST /api/application/[id]/change-reports error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
