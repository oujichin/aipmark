import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const processId = searchParams.get("processId");

  const hearings = await prisma.hearing.findMany({
    where: processId ? { businessProcessId: processId } : {},
    include: { businessProcess: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(hearings);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { businessProcessId, answers, status } = body;

  // Upsert: one hearing per process
  const existing = await prisma.hearing.findFirst({
    where: { businessProcessId },
  });

  let hearing;
  if (existing) {
    hearing = await prisma.hearing.update({
      where: { id: existing.id },
      data: {
        answers: JSON.stringify(answers),
        status: status ?? existing.status,
        submittedById: status === "SUBMITTED" ? session.user.id : existing.submittedById,
      },
    });
  } else {
    hearing = await prisma.hearing.create({
      data: {
        businessProcessId,
        answers: JSON.stringify(answers),
        status: status ?? "DRAFT",
        submittedById: status === "SUBMITTED" ? session.user.id : null,
      },
    });
  }

  return NextResponse.json(hearing, { status: 201 });
}
