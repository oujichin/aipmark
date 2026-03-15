import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createRegisterItemSchema } from "@/lib/validations/company";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const processId = searchParams.get("processId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const skip = (page - 1) * limit;

    const where = {
      ...(processId ? { businessProcessId: processId } : {}),
      ...(status ? { status } : {}),
      businessProcess: { organizationId: session.user.organizationId },
    };

    const [items, total] = await Promise.all([
      prisma.registerItem.findMany({
        where,
        include: {
          businessProcess: { include: { department: true } },
          _count: { select: { evidenceRecords: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.registerItem.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/register/items error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = parseBody(createRegisterItemSchema, body);
    if (!parsed.success) return parsed.error;
    const {
      businessProcessId,
      dataSubject,
      dataCategoryCodes,
      dataFieldCodes,
      purpose,
      legalBasis,
      retentionPeriod,
      storageLocation,
      thirdPartyProvision,
      confirmationStatus,
      inferenceBasis,
    } = parsed.data;

    const [categoryCount, fieldCount] = await Promise.all([
      prisma.dataCategory.count({ where: { code: { in: dataCategoryCodes } } }),
      prisma.dataFieldDefinition.count({ where: { code: { in: dataFieldCodes } } }),
    ]);
    if (categoryCount !== dataCategoryCodes.length || fieldCount !== dataFieldCodes.length) {
      return NextResponse.json({ error: "個人情報区分または項目に未定義コードが含まれています" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.registerItem.create({
        data: {
          businessProcessId,
          dataSubject,
          dataCategoryCodes: JSON.stringify(dataCategoryCodes ?? []),
          dataFieldCodes: JSON.stringify(dataFieldCodes ?? []),
          purpose,
          legalBasis,
          retentionPeriod,
          storageLocation,
          thirdPartyProvision: thirdPartyProvision ?? "NONE",
          confirmationStatus: confirmationStatus ?? "UNCONFIRMED",
          inferenceBasis,
        },
        include: { businessProcess: true },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "RegisterItem",
          entityId: item.id,
          details: JSON.stringify({ dataSubject }),
        },
      });

      return item;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/register/items error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
