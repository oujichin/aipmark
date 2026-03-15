import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGeminiClient, MODEL } from "@/lib/ai/gemini-client";
import { buildIncidentAssessPrompt } from "@/lib/ai/prompts/incident-assess";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { incidentAssessAiSchema } from "@/lib/validations/ai";

interface IncidentAssessResult {
  suggestedSeverity: string;
  requiresSpeedReport: boolean;
  reasoning: string;
  suggestedActions: string[];
}

function getMockAssessment(incident: {
  containsSensitive: boolean;
  containsMyNumber: boolean;
  affectedCount: number | null;
}): IncidentAssessResult {
  const isHigh =
    incident.containsSensitive ||
    incident.containsMyNumber ||
    (incident.affectedCount !== null && incident.affectedCount > 1000);

  return {
    suggestedSeverity: isHigh ? "HIGH" : "MEDIUM",
    requiresSpeedReport: isHigh,
    reasoning: isHigh
      ? "要配慮個人情報またはマイナンバーが含まれる、もしくは影響件数が1,000件を超えるため、速報義務が発生する可能性があります。"
      : "現時点の情報では速報義務の要件には該当しませんが、詳細調査の結果に応じて再評価が必要です。",
    suggestedActions: [
      "影響範囲の詳細調査を実施する",
      "関係者への通知を検討する",
      "再発防止策を策定する",
      "証拠の保全を行う",
      "個人情報保護委員会への報告要否を最終判断する",
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = parseBody(incidentAssessAiSchema, body);
  if (!parsed.success) return parsed.error;
  const { incidentId } = parsed.data;

  const incident = await prisma.incidentCase.findFirst({
    where: { id: incidentId, organizationId: session.user.organizationId },
  });

  if (!incident) {
    return NextResponse.json({ error: "インシデントが見つかりません" }, { status: 404 });
  }

  const prompt = buildIncidentAssessPrompt({
    title: incident.title,
    description: incident.description,
    category: incident.category,
    affectedCount: incident.affectedCount,
    containsSensitive: incident.containsSensitive,
    containsMyNumber: incident.containsMyNumber,
    dataTypes: incident.dataTypes,
  });

  const start = Date.now();
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSONが見つかりませんでした");
    const assessment: IncidentAssessResult = JSON.parse(jsonMatch[0]);

    const usage = result.response.usageMetadata;
    await prisma.aiUsageLog.create({
      data: {
        userId: session.user.id,
        feature: "INCIDENT_ASSESS",
        inputTokens: usage?.promptTokenCount ?? null,
        outputTokens: usage?.candidatesTokenCount ?? null,
        durationMs: Date.now() - start,
      },
    });

    return NextResponse.json(assessment);
  } catch (err) {
    if (err instanceof Error && err.message.includes("GOOGLE_API_KEY")) {
      return NextResponse.json(
        getMockAssessment({
          containsSensitive: incident.containsSensitive,
          containsMyNumber: incident.containsMyNumber,
          affectedCount: incident.affectedCount,
        })
      );
    }
    const msg = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  } catch (error) {
    console.error("POST /api/ai/incident-assess error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
