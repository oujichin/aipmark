import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/personal-data";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const item = await prisma.registerItem.findUnique({
    where: { id },
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
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.registerItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status === "LOCKED") {
    return NextResponse.json({ error: "ロック済みの台帳は編集できません" }, { status: 403 });
  }

  if (body.dataCategoryCodes !== undefined) {
    if (!Array.isArray(body.dataCategoryCodes) || body.dataCategoryCodes.length === 0) {
      return NextResponse.json({ error: "個人情報区分を1件以上選択してください" }, { status: 400 });
    }
    const categoryCount = await prisma.dataCategory.count({
      where: { code: { in: body.dataCategoryCodes } },
    });
    if (categoryCount !== body.dataCategoryCodes.length) {
      return NextResponse.json({ error: "未定義の個人情報区分が含まれています" }, { status: 400 });
    }
  }

  if (body.dataFieldCodes !== undefined) {
    if (!Array.isArray(body.dataFieldCodes) || body.dataFieldCodes.length === 0) {
      return NextResponse.json({ error: "個人情報項目を1件以上選択してください" }, { status: 400 });
    }
    const fieldCount = await prisma.dataFieldDefinition.count({
      where: { code: { in: body.dataFieldCodes } },
    });
    if (fieldCount !== body.dataFieldCodes.length) {
      return NextResponse.json({ error: "未定義の個人情報項目が含まれています" }, { status: 400 });
    }
  }

  const updated = await prisma.registerItem.update({
    where: { id },
    data: {
      ...body,
      dataCategoryCodes: body.dataCategoryCodes ? JSON.stringify(body.dataCategoryCodes) : undefined,
      dataFieldCodes: body.dataFieldCodes ? JSON.stringify(body.dataFieldCodes) : undefined,
    },
    include: { businessProcess: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE",
      entityType: "RegisterItem",
      entityId: id,
      details: JSON.stringify({ fields: Object.keys(body) }),
    },
  });

  return NextResponse.json(updated);
}
