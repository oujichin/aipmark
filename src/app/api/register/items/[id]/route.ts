import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    dataCategories: JSON.parse(item.dataCategories),
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

  const updated = await prisma.registerItem.update({
    where: { id },
    data: {
      ...body,
      dataCategories: body.dataCategories ? JSON.stringify(body.dataCategories) : undefined,
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
