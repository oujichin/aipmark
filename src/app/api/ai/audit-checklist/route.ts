import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGeminiClient, MODEL } from "@/lib/ai/gemini-client";
import { buildAuditChecklistPrompt } from "@/lib/ai/prompts/audit-checklist";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations";
import { auditChecklistSchema } from "@/lib/validations/ai";

interface ChecklistItem {
  category: string;
  question: string;
  responseType: string;
}

function getMockChecklist(): ChecklistItem[] {
  return [
    { category: "個人情報保護方針", question: "個人情報保護方針は公表されていますか？", responseType: "YES_NO" },
    { category: "組織・体制", question: "個人情報保護管理者は任命されていますか？", responseType: "YES_NO" },
    { category: "リスクアセスメント", question: "年度内にリスクアセスメントを実施しましたか？", responseType: "YES_NO" },
    { category: "安全管理措置", question: "組織的安全管理措置の整備状況を評価してください", responseType: "RATING" },
    { category: "従業者の教育", question: "全従業者に対する教育を実施しましたか？", responseType: "YES_NO" },
    { category: "委託先の管理", question: "委託先の選定基準は明確化されていますか？", responseType: "YES_NO" },
    { category: "事故対応", question: "事故対応手順書は整備されていますか？", responseType: "YES_NO" },
    { category: "内部監査・マネジメントレビュー", question: "前回の是正事項の対応状況を説明してください", responseType: "TEXT" },
  ];
}

export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = parseBody(auditChecklistSchema, body);
  if (!parsed.success) return parsed.error;
  const { auditPlanId, scope } = parsed.data;

  const auditPlan = await prisma.auditPlan.findFirst({
    where: { id: auditPlanId, organizationId: session.user.organizationId },
    include: {
      targetDepts: { include: { department: true } },
    },
  });

  if (!auditPlan) {
    return NextResponse.json({ error: "監査計画が見つかりません" }, { status: 404 });
  }

  const prompt = buildAuditChecklistPrompt({
    auditTitle: auditPlan.title,
    scope: scope ?? auditPlan.scope ?? "全般",
    targetDepartments: auditPlan.targetDepts.map((d) => d.department.name),
  });

  const start = Date.now();
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("JSONが見つかりませんでした");
    const items: ChecklistItem[] = JSON.parse(jsonMatch[0]);

    const usage = result.response.usageMetadata;
    await prisma.aiUsageLog.create({
      data: {
        userId: session.user.id,
        feature: "AUDIT_CHECKLIST",
        inputTokens: usage?.promptTokenCount ?? null,
        outputTokens: usage?.candidatesTokenCount ?? null,
        durationMs: Date.now() - start,
      },
    });

    return NextResponse.json({ items });
  } catch (err) {
    if (err instanceof Error && err.message.includes("GOOGLE_API_KEY")) {
      return NextResponse.json({ items: getMockChecklist() });
    }
    const msg = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  } catch (error) {
    console.error("POST /api/ai/audit-checklist error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
