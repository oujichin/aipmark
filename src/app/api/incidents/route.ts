import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createIncidentSchema } from "@/lib/validations/incidents";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const severity = searchParams.get("severity");
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const skip = (page - 1) * limit;

    const where = {
      organizationId: session.user.organizationId,
      ...(status ? { status } : {}),
      ...(severity ? { severity } : {}),
      ...(category ? { category } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.incidentCase.findMany({
        where,
        include: {
          reportedBy: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
          _count: { select: { actions: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.incidentCase.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/incidents error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = parseBody(createIncidentSchema, body);
    if (!parsed.success) return parsed.error;
    const { title, description, category, incidentDate, discoveredDate, containsSensitive, containsMyNumber } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const incident = await tx.incidentCase.create({
        data: {
          organizationId: session.user.organizationId,
          reportedById: session.user.id,
          title,
          description,
          category: category ?? "OTHER",
          incidentDate: incidentDate ? new Date(incidentDate) : null,
          discoveredDate: discoveredDate ? new Date(discoveredDate) : null,
          containsSensitive: containsSensitive ?? false,
          containsMyNumber: containsMyNumber ?? false,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "IncidentCase",
          entityId: incident.id,
          details: JSON.stringify({ title, category }),
        },
      });
      return incident;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/incidents error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
