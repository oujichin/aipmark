import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGeminiClient, MODEL } from "@/lib/ai/gemini-client";
import { buildTrainingMaterialPrompt } from "@/lib/ai/prompts/training-material";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { trainingMaterialSchema } from "@/lib/validations/ai";

interface QuizQuestion {
  questionText: string;
  questionType: string;
  options: string[];
  correctAnswer: string | string[];
  points: number;
}

function getMockQuestions(count: number): QuizQuestion[] {
  const pool: QuizQuestion[] = [
    {
      questionText: "個人情報保護法において、「個人情報」に該当するものはどれですか？",
      questionType: "SINGLE_CHOICE",
      options: ["氏名", "企業の電話番号", "法人番号", "公開されている統計データ"],
      correctAnswer: "氏名",
      points: 1,
    },
    {
      questionText: "個人情報を第三者に提供する場合、原則として本人の同意が必要である",
      questionType: "TRUE_FALSE",
      options: ["TRUE", "FALSE"],
      correctAnswer: "TRUE",
      points: 1,
    },
    {
      questionText: "要配慮個人情報に該当するものをすべて選んでください",
      questionType: "MULTI_CHOICE",
      options: ["病歴", "犯罪の経歴", "趣味", "人種"],
      correctAnswer: ["病歴", "犯罪の経歴", "人種"],
      points: 2,
    },
    {
      questionText: "個人情報漏えい時の速報義務の期限として正しいものはどれですか？",
      questionType: "SINGLE_CHOICE",
      options: ["24時間以内", "概ね3〜5日以内", "1週間以内", "30日以内"],
      correctAnswer: "概ね3〜5日以内",
      points: 2,
    },
    {
      questionText: "プライバシーマークの有効期間は何年ですか？",
      questionType: "SINGLE_CHOICE",
      options: ["1年", "2年", "3年", "5年"],
      correctAnswer: "2年",
      points: 1,
    },
  ];
  return pool.slice(0, Math.min(count, pool.length));
}

export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = parseBody(trainingMaterialSchema, body);
  if (!parsed.success) return parsed.error;
  const { sessionId, topic, questionCount = 5 } = parsed.data;

  const trainingSession = await prisma.trainingSession.findFirst({
    where: {
      id: sessionId,
      trainingPlan: { organizationId: session.user.organizationId },
    },
  });

  if (!trainingSession) {
    return NextResponse.json({ error: "教育セッションが見つかりません" }, { status: 404 });
  }

  const prompt = buildTrainingMaterialPrompt({
    sessionTitle: trainingSession.title,
    topic,
    questionCount: Math.min(questionCount, 20),
  });

  const start = Date.now();
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("JSONが見つかりませんでした");
    const questions: QuizQuestion[] = JSON.parse(jsonMatch[0]);

    const usage = result.response.usageMetadata;
    await prisma.aiUsageLog.create({
      data: {
        userId: session.user.id,
        feature: "TRAINING_MATERIAL",
        inputTokens: usage?.promptTokenCount ?? null,
        outputTokens: usage?.candidatesTokenCount ?? null,
        durationMs: Date.now() - start,
      },
    });

    return NextResponse.json({ questions });
  } catch (err) {
    if (err instanceof Error && err.message.includes("GOOGLE_API_KEY")) {
      return NextResponse.json({ questions: getMockQuestions(questionCount) });
    }
    const msg = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  } catch (error) {
    console.error("POST /api/ai/training-material error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
