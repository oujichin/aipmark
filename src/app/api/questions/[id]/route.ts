import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAnswersToAgent } from "@/lib/session-orchestrator";

// PATCH /api/questions/[id] — 質問に回答
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { answer, answeredBy } = body as { answer: string; answeredBy?: string };

  if (!answer) {
    return NextResponse.json({ error: "answer is required" }, { status: 400 });
  }

  const question = await prisma.question.update({
    where: { id },
    data: {
      answer,
      answeredBy: answeredBy ?? "user",
      answeredAt: new Date(),
      status: "answered",
    },
  });

  // 同じセッションの全pending質問が回答済みか確認
  const pendingCount = await prisma.question.count({
    where: { sessionId: question.sessionId, status: "pending" },
  });

  // 全質問回答済みならAgentに回答を送信
  if (pendingCount === 0) {
    await sendAnswersToAgent(question.sessionId);
  }

  return NextResponse.json({ question, remainingQuestions: pendingCount });
}
