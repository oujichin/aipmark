import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function canManage(role: string) {
  return ["PRIVACY_OFFICER", "GLOBAL_ADMIN"].includes(role);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.dataFieldDefinition.findMany({
    orderBy: [{ isSensitive: "desc" }, { code: "asc" }],
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManage(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const item = await prisma.dataFieldDefinition.create({
    data: {
      code: body.code,
      name: body.name,
      description: body.description ?? null,
      categoryHint: body.categoryHint ?? null,
      isSensitive: Boolean(body.isSensitive),
      isSpecificPerson: Boolean(body.isSpecificPerson),
    },
  });

  return NextResponse.json(item, { status: 201 });
}
