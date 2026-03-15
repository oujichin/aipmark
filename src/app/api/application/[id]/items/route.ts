import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createApplicationItemSchema } from "@/lib/validations/application";

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
    const parsed = parseBody(createApplicationItemSchema, body);
    if (!parsed.success) return parsed.error;
    const { itemType, title, filePath, fileName, fileSize, sourceDataIds } = parsed.data;

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.applicationPackageItem.create({
        data: {
          packageId: id,
          itemType,
          title,
          filePath: filePath ?? null,
          fileName: fileName ?? null,
          fileSize: fileSize ?? null,
          sourceDataIds: sourceDataIds ? JSON.stringify(sourceDataIds) : null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "ApplicationPackageItem",
          entityId: created.id,
          details: JSON.stringify({ itemType, title, packageId: id }),
        },
      });

      return created;
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/application/[id]/items error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
