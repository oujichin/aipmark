import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateDocumentVersionSchema } from "@/lib/validations/documents";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const result = parseBody(updateDocumentVersionSchema, body);
    if (!result.success) return result.error;
    const { action, changeNote, effectiveDate, status } = result.data;

    // テナント分離: documentリレーション経由でorganizationId検証
    const version = await prisma.pMSDocumentVersion.findFirst({
      where: {
        id,
        document: { organizationId: session.user.organizationId },
      },
    });

    if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (action === "approve") {
      // 承認にはPRIVACY_OFFICER以上の権限が必要
      const roleCheck = await requireRole("PRIVACY_OFFICER");
      if (roleCheck.error) return roleCheck.error;

      if (version.status === "APPROVED") {
        return NextResponse.json({ error: "既に承認済みです" }, { status: 400 });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const ver = await tx.pMSDocumentVersion.update({
          where: { id },
          data: {
            status: "APPROVED",
            approvedById: session.user.id,
            approvedAt: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: "APPROVE",
            entityType: "PMSDocumentVersion",
            entityId: id,
            details: JSON.stringify({ documentId: version.documentId, versionNumber: version.versionNumber }),
          },
        });

        return ver;
      });

      return NextResponse.json(updated);
    }

    // 汎用更新（changeNote, effectiveDateなど）
    const updated = await prisma.$transaction(async (tx) => {
      const ver = await tx.pMSDocumentVersion.update({
        where: { id },
        data: {
          ...(changeNote !== undefined ? { changeNote } : {}),
          ...(effectiveDate !== undefined ? { effectiveDate: new Date(effectiveDate as string) } : {}),
          ...(status !== undefined ? { status } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "PMSDocumentVersion",
          entityId: id,
          details: JSON.stringify({ fields: Object.keys(body) }),
        },
      });

      return ver;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/documents/versions/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
