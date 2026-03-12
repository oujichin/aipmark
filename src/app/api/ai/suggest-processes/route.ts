import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGeminiClient, MODEL } from "@/lib/ai/gemini-client";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { profile } = body; // { industry, mainBusiness, employeeCount, aiProfileSummary }

  const prompt = `プライバシーマーク（JIS Q 15001）の観点から、以下の会社プロファイルに基づいて、
個人情報を取り扱う業務プロセスを提案してください。

## 会社プロファイル
- 業種: ${profile.industry ?? "不明"}
- 主要事業: ${profile.mainBusiness ?? "不明"}
- 従業員規模: ${profile.employeeCount ?? "不明"}
- 概要: ${profile.aiProfileSummary ?? ""}

## 出力形式（JSON配列のみ）
[
  {
    "name": "業務プロセス名（例：顧客情報管理、採用活動、従業員人事管理）",
    "description": "このプロセスで取り扱う個人情報の概要（1〜2文）",
    "dataSubjects": ["データ主体（例：顧客、従業員）"],
    "confidence": "HIGH | MEDIUM | LOW",
    "basis": "提案の根拠"
  }
]

5〜10件提案し、確信度の高い順に並べてください。`;

  const start = Date.now();
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("JSONが見つかりませんでした");

    const processes = JSON.parse(jsonMatch[0]);

    await prisma.aiUsageLog.create({
      data: {
        userId: session.user.id,
        feature: "RESEARCH_PROFILE",
        inputTokens: result.response.usageMetadata?.promptTokenCount ?? null,
        outputTokens: result.response.usageMetadata?.candidatesTokenCount ?? null,
        durationMs: Date.now() - start,
      },
    });

    return NextResponse.json({ processes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
