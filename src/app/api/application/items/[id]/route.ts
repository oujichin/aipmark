import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateApplicationItemSchema } from "@/lib/validations/application";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.applicationPackageItem.findUnique({
      where: { id },
      include: { package: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.package.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parseBody(updateApplicationItemSchema, body);
    if (!parsed.success) return parsed.error;
    const { itemType, title, filePath, fileName, fileSize, sourceDataIds, status, errorMessage } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.applicationPackageItem.update({
        where: { id },
        data: {
          ...(itemType !== undefined ? { itemType } : {}),
          ...(title !== undefined ? { title } : {}),
          ...(filePath !== undefined ? { filePath } : {}),
          ...(fileName !== undefined ? { fileName } : {}),
          ...(fileSize !== undefined ? { fileSize } : {}),
          ...(sourceDataIds !== undefined ? { sourceDataIds: JSON.stringify(sourceDataIds) } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(errorMessage !== undefined ? { errorMessage } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "ApplicationPackageItem",
          entityId: id,
          details: JSON.stringify({ fields: Object.keys(body) }),
        },
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/application/items/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
