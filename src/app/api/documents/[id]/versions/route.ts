import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createDocumentVersionSchema } from "@/lib/validations/documents";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // テナント分離: 親documentのorganizationIdを検証
    const document = await prisma.pMSDocument.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const result = parseBody(createDocumentVersionSchema, body);
    if (!result.success) return result.error;
    const { versionNumber, changeNote, effectiveDate, filePath, fileName, fileSize } = result.data;

    const version = await prisma.$transaction(async (tx) => {
      const ver = await tx.pMSDocumentVersion.create({
        data: {
          documentId: id,
          versionNumber,
          changeNote: changeNote ?? null,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
          filePath: filePath ?? null,
          fileName: fileName ?? null,
          fileSize: fileSize ?? null,
          createdById: session.user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "PMSDocumentVersion",
          entityId: ver.id,
          details: JSON.stringify({ documentId: id, versionNumber }),
        },
      });

      return ver;
    });

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    console.error("POST /api/documents/[id]/versions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
