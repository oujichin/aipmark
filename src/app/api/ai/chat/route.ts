import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGeminiClient, MODEL } from "@/lib/ai/gemini-client";
import { maskPII } from "@/lib/ai/pii-masker";
import { buildSystemPrompt } from "@/lib/ai/prompts/chat";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { messages } = body; // Array of {role, content}

  const [processCount, itemCount, approvedCount] = await Promise.all([
    prisma.businessProcess.count({ where: { organizationId: session.user.organizationId } }),
    prisma.registerItem.count({ where: { businessProcess: { organizationId: session.user.organizationId } } }),
    prisma.registerItem.count({
      where: {
        businessProcess: { organizationId: session.user.organizationId },
        status: { in: ["APPROVED", "LOCKED"] },
      },
    }),
  ]);

  const systemPrompt = buildSystemPrompt({
    organizationName: "デモ株式会社",
    processCount,
    itemCount,
    approvedCount,
  });

  const start = Date.now();
  try {
    const genAI = getGeminiClient();
    const geminiModel = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: systemPrompt,
    });

    // Gemini uses "model" instead of "assistant"
    const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: maskPII(m.content).masked }],
    }));

    const lastMessage = messages[messages.length - 1];
    const chat = geminiModel.startChat({ history });
    const result = await chat.sendMessage(maskPII(lastMessage.content).masked);
    const text = result.response.text();

    const usage = result.response.usageMetadata;
    await prisma.aiUsageLog.create({
      data: {
        userId: session.user.id,
        feature: "CHAT",
        inputTokens: usage?.promptTokenCount ?? null,
        outputTokens: usage?.candidatesTokenCount ?? null,
        durationMs: Date.now() - start,
      },
    });

    return NextResponse.json({ content: text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
