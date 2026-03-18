import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateControlMeasureSchema } from "@/lib/validations/risk";

async function findMeasureWithAuth(id: string, organizationId: string) {
  const measure = await prisma.controlMeasure.findUnique({
    where: { id },
    include: { riskItem: { include: { riskAssessment: true } } },
  });
  if (!measure) return { measure: null, error: "not_found" as const };
  if (measure.riskItem.riskAssessment.organizationId !== organizationId) {
    return { measure: null, error: "forbidden" as const };
  }
  return { measure, error: null };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { measure, error } = await findMeasureWithAuth(id, session.user.organizationId);
    if (error === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (error === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json(measure);
  } catch (error) {
    console.error("GET /api/risk/measures/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { measure: existing, error } = await findMeasureWithAuth(id, session.user.organizationId);
    if (error === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (error === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const result = parseBody(updateControlMeasureSchema, body);
    if (!result.success) return result.error;
    const { category, description, responsible, status } = result.data;

    // Auto-set implementedAt when status changes to IMPLEMENTED
    let implementedAt: Date | undefined;
    if (status === "IMPLEMENTED" && existing!.status !== "IMPLEMENTED") {
      implementedAt = new Date();
    }

    const updated = await prisma.$transaction(async (tx) => {
      const measure = await tx.controlMeasure.update({
        where: { id },
        data: {
          ...(category !== undefined ? { category } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(responsible !== undefined ? { responsible } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(implementedAt !== undefined ? { implementedAt } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "ControlMeasure",
          entityId: id,
          details: JSON.stringify({ fields: Object.keys(body) }),
        },
      });

      return measure;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/risk/measures/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { measure: existing, error } = await findMeasureWithAuth(id, session.user.organizationId);
    if (error === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (error === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.$transaction(async (tx) => {
      await tx.controlMeasure.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "DELETE",
          entityType: "ControlMeasure",
          entityId: id,
          details: JSON.stringify({ description: existing!.description }),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/risk/measures/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
