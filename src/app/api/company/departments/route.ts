import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createDepartmentSchema } from "@/lib/validations/company";

export async function GET() {
  try {
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
  } catch (error) {
    console.error("GET /api/company/departments error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = parseBody(createDepartmentSchema, body);
    if (!parsed.success) return parsed.error;
    const { name, code } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const dept = await tx.department.create({
        data: {
          name,
          code: code ?? name.slice(0, 4).toUpperCase(),
          organizationId: session.user.organizationId,
        },
        include: { _count: { select: { users: true, businessProcesses: true } } },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "Department",
          entityId: dept.id,
          details: JSON.stringify({ name }),
        },
      });

      return dept;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/company/departments error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
