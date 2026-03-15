import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { updateVendorSchema } from "@/lib/validations/vendors";
import { pickDefined } from "@/lib/utils/pick-defined";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id } = await ctx.params;

    const vendor = await prisma.vendor.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        evaluations: {
          orderBy: { fiscalYear: "desc" },
          include: {
            evaluatedBy: { select: { id: true, name: true } },
            approvedBy: { select: { id: true, name: true } },
          },
        },
        questionnaires: {
          orderBy: { createdAt: "desc" },
        },
        evidenceRecords: true,
      },
    });

    if (!vendor) {
      return NextResponse.json({ error: "委託先が見つかりません" }, { status: 404 });
    }

    return NextResponse.json(vendor);
  } catch (error) {
    console.error("GET /api/vendors/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { id } = await ctx.params;

    const existing = await prisma.vendor.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "委託先が見つかりません" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parseBody(updateVendorSchema, body);
    if (!parsed.success) return parsed.error;
    const d = parsed.data;

    // pickDefined で単純コピーできるフィールドをまとめて抽出
    const simpleFields = pickDefined(d, [
      "vendorType", "description", "contactName", "contactEmail", "contactPhone",
      "hasPmark", "pmarkNumber", "hasIsms", "ismsNumber", "dataHandled", "overallRating",
    ]);

    const [vendor] = await prisma.$transaction([
      prisma.vendor.update({
        where: { id },
        data: {
          ...(d.name !== undefined ? { name: d.name.trim() } : {}),
          ...simpleFields,
          ...(d.contractStartDate !== undefined
            ? { contractStartDate: d.contractStartDate ? new Date(d.contractStartDate) : null }
            : {}),
          ...(d.contractEndDate !== undefined
            ? { contractEndDate: d.contractEndDate ? new Date(d.contractEndDate) : null }
            : {}),
          ...(d.renewalDate !== undefined
            ? { renewalDate: d.renewalDate ? new Date(d.renewalDate) : null }
            : {}),
          ...(d.nextEvaluationDue !== undefined
            ? { nextEvaluationDue: d.nextEvaluationDue ? new Date(d.nextEvaluationDue) : null }
            : {}),
          ...(d.status !== undefined ? { status: d.status } : {}),
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "Vendor",
          entityId: id,
          details: JSON.stringify({ updatedFields: Object.keys(body) }),
        },
      }),
    ]);

    return NextResponse.json(vendor);
  } catch (err) {
    console.error("PUT /api/vendors/[id] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const { error, session } = await requireRole("PRIVACY_OFFICER");
    if (error) return error;

    const { id } = await ctx.params;

    const existing = await prisma.vendor.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "委託先が見つかりません" }, { status: 404 });
    }

    // ソフト削除: statusをTERMINATEDに変更（トランザクション）
    const [vendor] = await prisma.$transaction([
      prisma.vendor.update({
        where: { id },
        data: { status: "TERMINATED" },
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "DELETE",
          entityType: "Vendor",
          entityId: id,
          details: JSON.stringify({ name: existing.name }),
        },
      }),
    ]);

    return NextResponse.json(vendor);
  } catch (error) {
    console.error("DELETE /api/vendors/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
