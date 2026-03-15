import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createEvidenceSchema } from "@/lib/validations/evidence";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = session.user.organizationId;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const registerItemId = searchParams.get("registerItemId");
    const vendorId = searchParams.get("vendorId");
    const incidentId = searchParams.get("incidentId");
    const riskItemId = searchParams.get("riskItemId");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
    const skip = (page - 1) * limit;

    const where = {
      uploadedBy: { organizationId: orgId },
      ...(type ? { type } : {}),
      ...(registerItemId ? { registerItemId } : {}),
      ...(vendorId ? { vendorId } : {}),
      ...(incidentId ? { incidentId } : {}),
      ...(riskItemId ? { riskItemId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.evidenceRecord.findMany({
        where,
        include: {
          registerItem: { select: { id: true, dataSubject: true } },
          uploadedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.evidenceRecord.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error("GET /api/evidence error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = parseBody(createEvidenceSchema, body);
    if (!parsed.success) return parsed.error;
    const {
      title,
      type,
      description,
      filePath,
      fileName,
      fileSize,
      mimeType,
      evidenceDate,
      retentionUntil,
      registerItemId,
      riskItemId,
      vendorId,
      incidentId,
      auditFindingId,
      correctiveActionId,
    } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const evidence = await tx.evidenceRecord.create({
        data: {
          title,
          type,
          description: description ?? null,
          filePath: filePath ?? null,
          fileName: fileName ?? null,
          fileSize: fileSize ?? null,
          mimeType: mimeType ?? null,
          evidenceDate: evidenceDate ? new Date(evidenceDate) : null,
          retentionUntil: retentionUntil ? new Date(retentionUntil) : null,
          registerItemId: registerItemId ?? null,
          riskItemId: riskItemId ?? null,
          vendorId: vendorId ?? null,
          incidentId: incidentId ?? null,
          auditFindingId: auditFindingId ?? null,
          correctiveActionId: correctiveActionId ?? null,
          uploadedById: session.user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "EvidenceRecord",
          entityId: evidence.id,
          details: JSON.stringify({ title, type }),
        },
      });
      return evidence;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/evidence error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
