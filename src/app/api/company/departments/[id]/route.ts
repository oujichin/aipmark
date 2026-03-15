import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateDepartmentSchema } from "@/lib/validations/company";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // テナント分離チェック
    const department = await prisma.department.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!department) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = parseBody(updateDepartmentSchema, body);
    if (!parsed.success) return parsed.error;

    const dept = await prisma.$transaction(async (tx) => {
      const updated = await tx.department.update({
        where: { id },
        data: { name: parsed.data.name, code: parsed.data.code },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "Department",
          entityId: id,
          details: JSON.stringify({ name: parsed.data.name }),
        },
      });
      return updated;
    });

    return NextResponse.json(dept);
  } catch (error) {
    console.error("PUT /api/company/departments/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // テナント分離チェック
    const department = await prisma.department.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!department) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Check if in use
    const count = await prisma.businessProcess.count({ where: { departmentId: id } });
    if (count > 0) {
      return NextResponse.json({ error: `この部門には${count}件の業務プロセスが紐づいています。先に移動してください。` }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.department.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "DELETE",
          entityType: "Department",
          entityId: id,
          details: JSON.stringify({ name: department.name }),
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/company/departments/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
