import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createVendorSchema } from "@/lib/validations/vendors";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const vendorType = searchParams.get("vendorType");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const skip = (page - 1) * limit;

    const where = {
      organizationId: session.user.organizationId,
      ...(status ? { status } : {}),
      ...(vendorType ? { vendorType } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: {
          evaluations: {
            orderBy: { fiscalYear: "desc" as const },
            take: 1,
          },
          _count: {
            select: { questionnaires: true, evaluations: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.vendor.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/vendors error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireRole("PRIVACY_OFFICER");
    if (error) return error;

    const body = await req.json();
    const parsed = parseBody(createVendorSchema, body);
    if (!parsed.success) return parsed.error;
    const {
      name,
      vendorType,
      description,
      contactName,
      contactEmail,
      contactPhone,
      hasPmark,
      pmarkNumber,
      hasIsms,
      ismsNumber,
      contractStartDate,
      contractEndDate,
      renewalDate,
      dataHandled,
      status: vendorStatus,
    } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.create({
        data: {
          name: name.trim(),
          vendorType: vendorType ?? "OUTSOURCE",
          description: description ?? null,
          contactName: contactName ?? null,
          contactEmail: contactEmail ?? null,
          contactPhone: contactPhone ?? null,
          hasPmark: hasPmark ?? false,
          pmarkNumber: pmarkNumber ?? null,
          hasIsms: hasIsms ?? false,
          ismsNumber: ismsNumber ?? null,
          contractStartDate: contractStartDate ? new Date(contractStartDate) : null,
          contractEndDate: contractEndDate ? new Date(contractEndDate) : null,
          renewalDate: renewalDate ? new Date(renewalDate) : null,
          dataHandled: dataHandled ?? null,
          status: vendorStatus ?? "ACTIVE",
          organizationId: session.user.organizationId,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "Vendor",
          entityId: vendor.id,
          details: JSON.stringify({ name: vendor.name, vendorType: vendor.vendorType }),
        },
      });
      return vendor;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/vendors error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
