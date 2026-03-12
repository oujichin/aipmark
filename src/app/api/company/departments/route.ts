import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const departments = await prisma.department.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      _count: { select: { users: true, businessProcesses: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(departments);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, code } = body;

  if (!name) return NextResponse.json({ error: "name は必須です" }, { status: 400 });

  const dept = await prisma.department.create({
    data: {
      name,
      code: code ?? name.slice(0, 4).toUpperCase(),
      organizationId: session.user.organizationId,
    },
    include: { _count: { select: { users: true, businessProcesses: true } } },
  });

  return NextResponse.json(dept, { status: 201 });
}
