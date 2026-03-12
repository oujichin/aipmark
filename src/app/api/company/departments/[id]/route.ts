import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const dept = await prisma.department.update({
    where: { id },
    data: { name: body.name, code: body.code },
  });

  return NextResponse.json(dept);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Check if in use
  const count = await prisma.businessProcess.count({ where: { departmentId: id } });
  if (count > 0) {
    return NextResponse.json({ error: `この部門には${count}件の業務プロセスが紐づいています。先に移動してください。` }, { status: 400 });
  }

  await prisma.department.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
