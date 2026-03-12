import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { action, comment } = body; // action: "APPROVE" | "REJECT" | "REQUEST_APPROVAL"

  const item = await prisma.registerItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let updateData: Record<string, unknown> = {};
  let auditAction = "";

  if (action === "REQUEST_APPROVAL") {
    updateData = { status: "PENDING_APPROVAL" };
    auditAction = "REQUEST_APPROVAL";
  } else if (action === "APPROVE") {
    if (!["PRIVACY_OFFICER", "TOP_MANAGEMENT"].includes(session.user.role)) {
      return NextResponse.json({ error: "承認権限がありません" }, { status: 403 });
    }
    const now = new Date();
    updateData = {
      status: "LOCKED",
      approvedById: session.user.id,
      approvedAt: now,
      lockedAt: now,
      version: item.version + 1,
    };
    auditAction = "APPROVE";
  } else if (action === "REJECT") {
    if (!["PRIVACY_OFFICER", "TOP_MANAGEMENT"].includes(session.user.role)) {
      return NextResponse.json({ error: "差戻し権限がありません" }, { status: 403 });
    }
    updateData = { status: "REJECTED", rejectionReason: comment ?? "" };
    auditAction = "REJECT";
  } else {
    return NextResponse.json({ error: "不明なアクション" }, { status: 400 });
  }

  const updated = await prisma.registerItem.update({ where: { id }, data: updateData });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: auditAction,
      entityType: "RegisterItem",
      entityId: id,
      details: JSON.stringify({ comment }),
    },
  });

  return NextResponse.json(updated);
}
