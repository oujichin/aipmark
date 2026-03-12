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
    if (!["DRAFT", "REVIEWING", "REJECTED"].includes(item.status)) {
      return NextResponse.json({ error: "この状態の台帳は承認申請できません" }, { status: 409 });
    }
    updateData = {
      status: "PENDING_APPROVAL",
      rejectionReason: null,
    };
    auditAction = "REQUEST_APPROVAL";
  } else if (action === "APPROVE") {
    if (!["PRIVACY_OFFICER", "TOP_MANAGEMENT"].includes(session.user.role)) {
      return NextResponse.json({ error: "承認権限がありません" }, { status: 403 });
    }
    if (item.status !== "PENDING_APPROVAL") {
      return NextResponse.json({ error: "承認申請中の台帳のみ承認できます" }, { status: 409 });
    }
    const now = new Date();
    updateData = {
      status: "LOCKED",
      approvedById: session.user.id,
      approvedAt: now,
      lockedAt: now,
      version: item.version + 1,
      rejectionReason: null,
    };
    auditAction = "APPROVE";
  } else if (action === "REJECT") {
    if (!["PRIVACY_OFFICER", "TOP_MANAGEMENT"].includes(session.user.role)) {
      return NextResponse.json({ error: "差戻し権限がありません" }, { status: 403 });
    }
    if (item.status !== "PENDING_APPROVAL") {
      return NextResponse.json({ error: "承認申請中の台帳のみ差戻しできます" }, { status: 409 });
    }
    if (!comment?.trim()) {
      return NextResponse.json({ error: "差戻しコメントを入力してください" }, { status: 400 });
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
