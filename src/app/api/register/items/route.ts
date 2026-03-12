import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const processId = searchParams.get("processId");
  const status = searchParams.get("status");

  const items = await prisma.registerItem.findMany({
    where: {
      ...(processId ? { businessProcessId: processId } : {}),
      ...(status ? { status } : {}),
      businessProcess: { organizationId: session.user.organizationId },
    },
    include: {
      businessProcess: { include: { department: true } },
      _count: { select: { evidenceRecords: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    businessProcessId,
    dataSubject,
    dataCategories,
    purpose,
    legalBasis,
    retentionPeriod,
    storageLocation,
    thirdPartyProvision,
    confirmationStatus,
    inferenceBasis,
  } = body;

  const item = await prisma.registerItem.create({
    data: {
      businessProcessId,
      dataSubject,
      dataCategories: JSON.stringify(dataCategories),
      purpose,
      legalBasis,
      retentionPeriod,
      storageLocation,
      thirdPartyProvision: thirdPartyProvision ?? "NONE",
      confirmationStatus: confirmationStatus ?? "UNCONFIRMED",
      inferenceBasis,
    },
    include: { businessProcess: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entityType: "RegisterItem",
      entityId: item.id,
      details: JSON.stringify({ dataSubject }),
    },
  });

  return NextResponse.json(item, { status: 201 });
}
