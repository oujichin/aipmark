import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const processes = await prisma.businessProcess.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      department: true,
      _count: { select: { registerItems: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(processes);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, departmentId } = body;

  if (!name || !departmentId) {
    return NextResponse.json({ error: "name と departmentId は必須です" }, { status: 400 });
  }

  const process = await prisma.businessProcess.create({
    data: {
      name,
      description: description ?? "",
      departmentId,
      organizationId: session.user.organizationId,
    },
    include: { department: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entityType: "BusinessProcess",
      entityId: process.id,
      details: JSON.stringify({ name }),
    },
  });

  return NextResponse.json(process, { status: 201 });
}
