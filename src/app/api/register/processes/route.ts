import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createBusinessProcessSchema } from "@/lib/validations/company";

export async function GET() {
  try {
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
  } catch (error) {
    console.error("GET /api/register/processes error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = parseBody(createBusinessProcessSchema, body);
    if (!parsed.success) return parsed.error;
    const { name, description, departmentId } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const process = await tx.businessProcess.create({
        data: {
          name,
          description: description ?? "",
          departmentId,
          organizationId: session.user.organizationId,
        },
        include: { department: true },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "BusinessProcess",
          entityId: process.id,
          details: JSON.stringify({ name }),
        },
      });

      return process;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/register/processes error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
