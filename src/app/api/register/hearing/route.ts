import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { createHearingSchema } from "@/lib/validations/company";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const processId = searchParams.get("processId");

    // Verify process belongs to user's organization if processId is specified
    if (processId) {
      const process = await prisma.businessProcess.findFirst({
        where: { id: processId, organizationId: session.user.organizationId },
      });
      if (!process) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const hearings = await prisma.hearing.findMany({
      where: processId
        ? { businessProcessId: processId }
        : { businessProcess: { organizationId: session.user.organizationId } },
      include: { businessProcess: true },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(
      hearings.map((hearing) => ({
        ...hearing,
        answers: JSON.parse(hearing.answers),
        aiCandidates: hearing.aiCandidates ? JSON.parse(hearing.aiCandidates) : null,
      }))
    );
  } catch (error) {
    console.error("GET /api/register/hearing error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = parseBody(createHearingSchema, body);
    if (!parsed.success) return parsed.error;
    const { businessProcessId, answers, status, aiCandidates } = parsed.data;

    // Verify process belongs to user's organization
    const process = await prisma.businessProcess.findFirst({
      where: { id: businessProcessId, organizationId: session.user.organizationId },
    });
    if (!process) {
      return NextResponse.json({ error: "指定された業務プロセスが見つかりません" }, { status: 404 });
    }

    // Upsert: one hearing per process
    const existing = await prisma.hearing.findFirst({
      where: { businessProcessId },
    });

    const hearing = await prisma.$transaction(async (tx) => {
      let result;
      if (existing) {
        result = await tx.hearing.update({
          where: { id: existing.id },
          data: {
            answers: JSON.stringify(answers),
            aiCandidates: aiCandidates ? JSON.stringify(aiCandidates) : existing.aiCandidates,
            status: status ?? existing.status,
            submittedById: status === "SUBMITTED" ? session.user.id : existing.submittedById,
          },
        });
      } else {
        result = await tx.hearing.create({
          data: {
            businessProcessId,
            answers: JSON.stringify(answers),
            aiCandidates: aiCandidates ? JSON.stringify(aiCandidates) : null,
            status: status ?? "DRAFT",
            submittedById: status === "SUBMITTED" ? session.user.id : null,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: existing ? "UPDATE" : "CREATE",
          entityType: "Hearing",
          entityId: result.id,
          details: JSON.stringify({ businessProcessId, status: status ?? (existing ? existing.status : "DRAFT") }),
        },
      });

      return result;
    });

    return NextResponse.json({
      ...hearing,
      answers: JSON.parse(hearing.answers),
      aiCandidates: hearing.aiCandidates ? JSON.parse(hearing.aiCandidates) : null,
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/register/hearing error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
