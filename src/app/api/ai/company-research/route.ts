import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGeminiClient, MODEL } from "@/lib/ai/gemini-client";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { companyResearchSchema } from "@/lib/validations/ai";
import { sanitize } from "@/lib/validations/sanitize";

export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = parseBody(companyResearchSchema, body);
  if (!parsed.success) return parsed.error;

  const companyName = sanitize(parsed.data.companyName, 200);
  const websiteUrl = parsed.data.websiteUrl ? sanitize(parsed.data.websiteUrl, 500) : undefined;
  const industry = parsed.data.industry ? sanitize(parsed.data.industry, 200) : undefined;

  const prompt = `あなたはプライバシーマーク（JIS Q 15001）対応の個人情報保護コンサルタントです。
以下の会社について Google 検索で調査し、個人情報保護マネジメントの観点から会社プロファイルを作成してください。

## 調査対象
- 会社名: ${companyName}
${websiteUrl ? `- WebサイトURL: ${websiteUrl}` : ""}
${industry ? `- 業種（参考）: ${industry}` : ""}

## 調査・出力内容
以下のJSON形式のみで返答してください（余分なテキスト不要）:

{
  "name": "正式な会社名",
  "industry": "業種（例：情報通信業、製造業、小売業）",
  "mainBusiness": "主要事業内容（2〜4文）",
  "employeeCount": "従業員規模の推定（例：50〜200名規模）",
  "establishedYear": "設立年（分かれば）",
  "capital": "資本金（分かれば）",
  "representative": "代表者名（分かれば）",
  "address": "本社所在地（分かれば）",
  "websiteUrl": "公式WebサイトURL",
  "aiProfileSummary": "個人情報保護の観点からの事業概要サマリー（3〜5文）。どのような個人情報を取り扱いそうか、データ主体は誰か、どんなシステムを使っていそうかを含めること。",
  "suggestedProcesses": [
    {
      "name": "業務プロセス名",
      "description": "このプロセスで取り扱う個人情報の説明（1〜2文）",
      "dataSubjects": ["データ主体1", "データ主体2"],
      "confidence": "HIGH | MEDIUM | LOW",
      "basis": "この業務プロセスを推定した根拠（調査結果のどの情報から）"
    }
  ]
}

suggestedProcesses には、この会社が個人情報を取り扱う可能性が高い業務プロセスを5〜10件提案してください。`;

  const start = Date.now();
  try {
    const genAI = getGeminiClient();
    // Use Google Search grounding for real web research
    const model = genAI.getGenerativeModel({
      model: MODEL,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ googleSearch: {} } as any],
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract grounding sources
    const groundingMeta = result.response.candidates?.[0]?.groundingMetadata;
    const sources = groundingMeta?.groundingChunks
      ?.filter((c: { web?: { uri?: string; title?: string } }) => c.web)
      .map((c: { web?: { uri?: string; title?: string } }) => ({
        title: c.web?.title ?? "",
        url: c.web?.uri ?? "",
      })) ?? [];

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AIからのJSON応答が見つかりませんでした");

    const profile = JSON.parse(jsonMatch[0]);
    const { suggestedProcesses, ...orgFields } = profile;

    // AI出力バリデーション: フィールドの型と長さを検証
    const truncStr = (val: unknown, maxLen: number): string | undefined => {
      if (val === null || val === undefined) return undefined;
      if (typeof val !== "string") return undefined;
      return val.slice(0, maxLen) || undefined;
    };

    const validatedOrgFields = {
      aiProfileSummary: truncStr(orgFields.aiProfileSummary, 2000),
      industry: truncStr(orgFields.industry, 200),
      mainBusiness: truncStr(orgFields.mainBusiness, 1000),
      employeeCount: truncStr(orgFields.employeeCount, 200),
      establishedYear: truncStr(orgFields.establishedYear, 50),
      capital: truncStr(orgFields.capital, 200),
      representative: truncStr(orgFields.representative, 200),
      address: truncStr(orgFields.address, 500),
      websiteUrl: truncStr(orgFields.websiteUrl, 500),
    };

    // Save AI research results to organization
    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        aiProfileSummary: validatedOrgFields.aiProfileSummary,
        aiResearchSources: JSON.stringify(sources).slice(0, 5000),
        aiResearchedAt: new Date(),
        // Auto-fill empty fields
        industry: validatedOrgFields.industry,
        mainBusiness: validatedOrgFields.mainBusiness,
        employeeCount: validatedOrgFields.employeeCount,
        establishedYear: validatedOrgFields.establishedYear,
        capital: validatedOrgFields.capital,
        representative: validatedOrgFields.representative,
        address: validatedOrgFields.address,
        websiteUrl: validatedOrgFields.websiteUrl,
      },
    });

    await prisma.aiUsageLog.create({
      data: {
        userId: session.user.id,
        feature: "RESEARCH_PROFILE",
        inputTokens: result.response.usageMetadata?.promptTokenCount ?? null,
        outputTokens: result.response.usageMetadata?.candidatesTokenCount ?? null,
        durationMs: Date.now() - start,
      },
    });

    return NextResponse.json({
      profile: orgFields,
      suggestedProcesses: suggestedProcesses ?? [],
      sources,
      rawText: text,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  } catch (error) {
    console.error("POST /api/ai/company-research error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
