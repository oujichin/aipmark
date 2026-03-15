import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateDataCategorySchema } from "@/lib/validations/company";

function canManage(role: string) {
  return ["PRIVACY_OFFICER", "GLOBAL_ADMIN"].includes(role);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManage(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { code } = await params;
    const body = await req.json();
    const parsed = parseBody(updateDataCategorySchema, body);
    if (!parsed.success) return parsed.error;

    if (parsed.data.code && parsed.data.code !== code) {
      const usage = await prisma.registerItem.count({
        where: { dataCategoryCodes: { contains: `"${code}"` } },
      });
      if (usage > 0) {
        return NextResponse.json({ error: "使用中の個人情報区分コードは変更できません" }, { status: 409 });
      }
    }

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.dataCategory.update({
        where: { code },
        data: {
          code: parsed.data.code,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          isSensitive: parsed.data.isSensitive !== undefined ? Boolean(parsed.data.isSensitive) : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "DataCategory",
          entityId: code,
          details: JSON.stringify({ code: parsed.data.code, name: parsed.data.name }),
        },
      });

      return updated;
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("PUT /api/master/data-categories/[code] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
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

    await prisma.$transaction(async (tx) => {
      await tx.dataCategory.delete({ where: { code } });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "DELETE",
          entityType: "DataCategory",
          entityId: code,
          details: JSON.stringify({ code }),
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/master/data-categories/[code] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
