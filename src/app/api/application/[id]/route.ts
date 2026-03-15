import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateApplicationPackageSchema } from "@/lib/validations/application";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id } = await params;
    const pkg = await prisma.applicationPackage.findFirst({
      where: { id, organizationId: session.user.organizationId },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        changeReports: { orderBy: { createdAt: "asc" } },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(pkg);
  } catch (error) {
    console.error("GET /api/application/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.applicationPackage.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parseBody(updateApplicationPackageSchema, body);
    if (!parsed.success) return parsed.error;
    const {
      applicationType,
      fiscalYear,
      snapshotDate,
      pmarkNumber,
      currentExpiry,
      certifyingBody,
      status,
      approvedById,
    } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.applicationPackage.update({
        where: { id },
        data: {
          ...(applicationType !== undefined ? { applicationType } : {}),
          ...(fiscalYear !== undefined ? { fiscalYear } : {}),
          ...(snapshotDate !== undefined ? { snapshotDate: snapshotDate ? new Date(snapshotDate) : null } : {}),
          ...(pmarkNumber !== undefined ? { pmarkNumber } : {}),
          ...(currentExpiry !== undefined ? { currentExpiry: currentExpiry ? new Date(currentExpiry) : null } : {}),
          ...(certifyingBody !== undefined ? { certifyingBody } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(approvedById !== undefined ? { approvedById } : {}),
          ...(status === "APPROVED" ? { approvedAt: new Date() } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "ApplicationPackage",
          entityId: id,
          details: JSON.stringify({ fields: Object.keys(body) }),
        },
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/application/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
