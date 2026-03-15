import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createDataCategorySchema } from "@/lib/validations/company";

function canManage(role: string) {
  return ["PRIVACY_OFFICER", "GLOBAL_ADMIN"].includes(role);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // DataCategory はテナント共通のマスタデータ（organizationId を持たない）
    // JIS Q 15001 に基づく個人情報区分の定義であり、全組織で共有される
    const items = await prisma.dataCategory.findMany({
      orderBy: [{ isSensitive: "desc" }, { code: "asc" }],
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/master/data-categories error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManage(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const parsed = parseBody(createDataCategorySchema, body);
    if (!parsed.success) return parsed.error;
    const { code, name, description, isSensitive } = parsed.data;

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.dataCategory.create({
        data: {
          code,
          name,
          description: description ?? null,
          isSensitive: isSensitive ?? false,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "DataCategory",
          entityId: created.code,
          details: JSON.stringify({ code, name }),
        },
      });

      return created;
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/master/data-categories error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
