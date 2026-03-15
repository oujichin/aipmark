import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createApplicationPackageSchema } from "@/lib/validations/application";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const fiscalYear = searchParams.get("fiscalYear");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const skip = (page - 1) * limit;

    const where = {
      organizationId: session.user.organizationId,
      ...(status ? { status } : {}),
      ...(fiscalYear ? { fiscalYear: parseInt(fiscalYear, 10) } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.applicationPackage.findMany({
        where,
        include: {
          _count: { select: { items: true, changeReports: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.applicationPackage.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/application error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireRole("PRIVACY_OFFICER");
    if (error) return error;

    const body = await req.json();
    const parsed = parseBody(createApplicationPackageSchema, body);
    if (!parsed.success) return parsed.error;
    const { fiscalYear, applicationType, pmarkNumber, currentExpiry, certifyingBody } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const pkg = await tx.applicationPackage.create({
        data: {
          organizationId: session.user.organizationId,
          fiscalYear,
          applicationType: applicationType ?? "RENEWAL",
          pmarkNumber: pmarkNumber ?? null,
          currentExpiry: currentExpiry ? new Date(currentExpiry) : null,
          certifyingBody: certifyingBody ?? null,
          createdById: session.user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "ApplicationPackage",
          entityId: pkg.id,
          details: JSON.stringify({ fiscalYear, applicationType: applicationType ?? "RENEWAL" }),
        },
      });
      return pkg;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/application error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
