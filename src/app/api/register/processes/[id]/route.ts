import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateBusinessProcessSchema } from "@/lib/validations/company";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // テナント分離チェック: department経由でorganizationIdを確認
    const existing = await prisma.businessProcess.findFirst({
      where: { id },
      include: { department: true },
    });
    if (!existing || existing.department.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(updateBusinessProcessSchema, body);
    if (!parsed.success) return parsed.error;
    const { name, description, departmentId, status } = parsed.data;

    const process = await prisma.$transaction(async (tx) => {
      const updated = await tx.businessProcess.update({
        where: { id },
        data: { name, description, departmentId, status },
        include: { department: true },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "BusinessProcess",
          entityId: id,
          details: JSON.stringify({ name, status }),
        },
      });
      return updated;
    });

    return NextResponse.json(process);
  } catch (error) {
    console.error("PUT /api/register/processes/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // テナント分離チェック: department経由でorganizationIdを確認
    const existing = await prisma.businessProcess.findFirst({
      where: { id },
      include: { department: true },
    });
    if (!existing || existing.department.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.businessProcess.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "DELETE",
          entityType: "BusinessProcess",
          entityId: id,
          details: JSON.stringify({ name: existing.name }),
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/register/processes/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
