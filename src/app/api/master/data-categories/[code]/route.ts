import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function canManage(role: string) {
  return ["PRIVACY_OFFICER", "GLOBAL_ADMIN"].includes(role);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { code } = await params;
  const body = await req.json();
  if (body.code && body.code !== code) {
    const usage = await prisma.registerItem.count({
      where: { dataCategoryCodes: { contains: `"${code}"` } },
    });
    if (usage > 0) {
      return NextResponse.json({ error: "使用中の個人情報区分コードは変更できません" }, { status: 409 });
    }
  }

  const item = await prisma.dataCategory.update({
    where: { code },
    data: {
      code: body.code,
      name: body.name,
      description: body.description ?? null,
      isSensitive: Boolean(body.isSensitive),
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { code } = await params;
  const usage = await prisma.registerItem.count({
    where: { dataCategoryCodes: { contains: `"${code}"` } },
  });
  if (usage > 0) {
    return NextResponse.json({ error: "使用中の個人情報区分は削除できません" }, { status: 409 });
  }
  await prisma.dataCategory.delete({ where: { code } });
  return NextResponse.json({ ok: true });
}
