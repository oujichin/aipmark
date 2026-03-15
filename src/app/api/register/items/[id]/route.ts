import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/personal-data";
import { parseBody } from "@/lib/validations";
import { updateRegisterItemSchema } from "@/lib/validations/company";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const item = await prisma.registerItem.findFirst({
      where: {
        id,
        businessProcess: { department: { organizationId: session.user.organizationId } },
      },
      include: {
        businessProcess: { include: { department: true } },
        evidenceRecords: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ...item,
      dataCategoryCodes: parseJsonArray(item.dataCategoryCodes),
      dataFieldCodes: parseJsonArray(item.dataFieldCodes),
    });
  } catch (error) {
    console.error("GET /api/register/items/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const parsed = parseBody(updateRegisterItemSchema, body);
    if (!parsed.success) return parsed.error;

    const existing = await prisma.registerItem.findFirst({
      where: {
        id,
        businessProcess: { department: { organizationId: session.user.organizationId } },
      },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.status === "LOCKED") {
      return NextResponse.json({ error: "ロック済みの台帳は編集できません" }, { status: 403 });
    }

    const data = parsed.data;

    if (data.dataCategoryCodes !== undefined) {
      const categoryCount = await prisma.dataCategory.count({
        where: { code: { in: data.dataCategoryCodes } },
      });
      if (categoryCount !== data.dataCategoryCodes.length) {
        return NextResponse.json({ error: "未定義の個人情報区分が含まれています" }, { status: 400 });
      }
    }

    if (data.dataFieldCodes !== undefined) {
      const fieldCount = await prisma.dataFieldDefinition.count({
        where: { code: { in: data.dataFieldCodes } },
      });
      if (fieldCount !== data.dataFieldCodes.length) {
        return NextResponse.json({ error: "未定義の個人情報項目が含まれています" }, { status: 400 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.registerItem.update({
        where: { id },
        data: {
          ...data,
          dataCategoryCodes: data.dataCategoryCodes ? JSON.stringify(data.dataCategoryCodes) : undefined,
          dataFieldCodes: data.dataFieldCodes ? JSON.stringify(data.dataFieldCodes) : undefined,
        },
        include: { businessProcess: true },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "RegisterItem",
          entityId: id,
          details: JSON.stringify({ fields: Object.keys(data) }),
        },
      });

      return updated;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("PUT /api/register/items/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
