import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/fields/[id] — フィールド値の更新・確定
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { fieldName, value, status, changedBy } = body as {
    fieldName: string;
    value?: string;
    status?: string;
    changedBy?: string;
  };

  if (!fieldName) {
    return NextResponse.json({ error: "fieldName is required" }, { status: 400 });
  }

  const bpPii = await prisma.businessProcessPII.findUniqueOrThrow({ where: { id } });
  const statusField = `${fieldName}Status` as keyof typeof bpPii;

  // confirmed にする場合、Evidence が紐づいていることを検証
  if (status === "confirmed") {
    const evidenceCount = await prisma.evidence.count({
      where: { bpPiiId: id, targetField: fieldName },
    });
    if (evidenceCount === 0) {
      return NextResponse.json(
        { error: "confirmed にはEvidence（根拠）の紐づけが必要です" },
        { status: 422 }
      );
    }
  }

  // 変更ログ記録
  const oldValue = bpPii[fieldName as keyof typeof bpPii] as string | null;
  const oldStatus = bpPii[statusField] as string | null;

  await prisma.fieldChangeLog.create({
    data: {
      bpPiiId: id,
      fieldName,
      oldValue: oldValue ?? undefined,
      newValue: value ?? undefined,
      oldStatus: oldStatus ?? undefined,
      newStatus: status ?? undefined,
      changedBy: changedBy ?? "human",
      trigger: "manual_edit",
    },
  });

  // フィールド更新
  const updateData: Record<string, unknown> = {};
  if (value !== undefined) updateData[fieldName] = value;
  if (status !== undefined) updateData[statusField as string] = status;

  const updated = await prisma.businessProcessPII.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}
