import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGeminiClient, MODEL } from "@/lib/ai/gemini-client";
import { buildRiskSuggestionsPrompt } from "@/lib/ai/prompts/risk-suggestions";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { riskSuggestionsSchema } from "@/lib/validations/ai";

interface RiskSuggestion {
  lifecycleStage: string;
  description: string;
  threatSource: string;
  vulnerability: string;
  likelihood: number;
  impact: number;
}

function getMockSuggestions(): RiskSuggestion[] {
  return [
    {
      lifecycleStage: "ACQUISITION",
      description: "Webフォームからの個人情報取得時にSSL未対応による通信傍受リスク",
      threatSource: "外部攻撃者",
      vulnerability: "暗号化通信の未実装",
      likelihood: 2,
      impact: 3,
    },
    {
      lifecycleStage: "USE",
      description: "業務目的外での個人情報の利用",
      threatSource: "内部者の不注意・故意",
      vulnerability: "利用目的の周知不足",
      likelihood: 1,
      impact: 2,
    },
    {
      lifecycleStage: "STORAGE",
      description: "個人情報を含むファイルの暗号化なし保管",
      threatSource: "不正アクセス",
      vulnerability: "データ暗号化の未実施",
      likelihood: 2,
      impact: 2,
    },
    {
      lifecycleStage: "PROVISION",
      description: "第三者提供時の本人同意確認漏れ",
      threatSource: "手続き不備",
      vulnerability: "同意管理プロセスの未整備",
      likelihood: 1,
      impact: 3,
    },
    {
      lifecycleStage: "ENTRUSTMENT",
      description: "委託先での個人情報の不適切な取扱い",
      threatSource: "委託先の管理不備",
      vulnerability: "委託先監督の不十分",
      likelihood: 2,
      impact: 2,
    },
    {
      lifecycleStage: "DISPOSAL",
      description: "不要となった個人情報の廃棄漏れ",
      threatSource: "内部者の不注意",
      vulnerability: "廃棄手順の未整備",
      likelihood: 2,
      impact: 1,
    },
  ];
}

export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = parseBody(riskSuggestionsSchema, body);
  if (!parsed.success) return parsed.error;
  const { businessProcessId, assessmentId } = parsed.data;

  const [businessProcess, existingRiskCount] = await Promise.all([
    prisma.businessProcess.findFirst({
      where: { id: businessProcessId, organizationId: session.user.organizationId },
    }),
    prisma.riskItem.count({
      where: { riskAssessmentId: assessmentId, businessProcessId },
    }),
  ]);

  if (!businessProcess) {
    return NextResponse.json({ error: "業務プロセスが見つかりません" }, { status: 404 });
  }

  const prompt = buildRiskSuggestionsPrompt({
    processName: businessProcess.name,
    processDescription: businessProcess.description,
    existingRiskCount,
  });

  const start = Date.now();
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("JSONが見つかりませんでした");
    const suggestions: RiskSuggestion[] = JSON.parse(jsonMatch[0]);

    const usage = result.response.usageMetadata;
    await prisma.aiUsageLog.create({
      data: {
        userId: session.user.id,
        feature: "RISK_SUGGESTIONS",
        inputTokens: usage?.promptTokenCount ?? null,
        outputTokens: usage?.candidatesTokenCount ?? null,
        durationMs: Date.now() - start,
      },
    });

    return NextResponse.json({ suggestions });
  } catch (err) {
    // Gemini APIキー未設定時のフォールバック
    if (err instanceof Error && err.message.includes("GOOGLE_API_KEY")) {
      return NextResponse.json({ suggestions: getMockSuggestions() });
    }
    const msg = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  } catch (error) {
    console.error("POST /api/ai/risk-suggestions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
