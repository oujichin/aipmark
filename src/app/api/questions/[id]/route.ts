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

  const appliedBasicProfile = await applyBasicProfileAnswer(question);

  // 同じセッションの全pending質問が回答済みか確認
  const pendingCount = await prisma.question.count({
    where: { sessionId: question.sessionId, status: "pending" },
  });

  // 全質問回答済み、または基本情報ヒアリングの未回答がなくなったらAgentに回答を返す。
  // 業務別の深掘り質問が残っていても、会社基本情報の整理は次工程へ進める必要がある。
  const pendingQuestions = await prisma.question.findMany({
    where: { sessionId: question.sessionId, status: "pending" },
    select: { relatedFields: true, context: true, questionText: true },
  });
  const pendingBasicProfileCount = pendingQuestions.filter(isBasicProfileQuestion).length;

  let agentDeliveryError: string | null = null;
  if (pendingCount === 0 || (appliedBasicProfile && pendingBasicProfileCount === 0)) {
    try {
      await sendAnswersToAgent(question.sessionId);
    } catch (error) {
      console.error("[Question] Failed to send answers to agent:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("waiting on responses to events") || message.includes("only `user.tool_confirmation`")) {
        agentDeliveryError = "AIが直前のツール結果を待っているため、回答の即時反映ができませんでした。回答は保存済みです。少し待ってから「不足チェック」または「自動運転」ボタンを再度押すと反映されます。";
      } else {
        agentDeliveryError = "AIへの回答送信が一時的に失敗しました。回答は保存済みです。画面を再読み込みしてから再操作してください。";
      }
    }
  }

  return NextResponse.json({
    question,
    remainingQuestions: pendingCount,
    remainingBasicProfileQuestions: pendingBasicProfileCount,
    agentDeliveryError,
  });
}

async function applyBasicProfileAnswer(question: {
  sessionId: string;
  relatedFields: string | null;
  context: string | null;
  questionText: string;
  answer: string | null;
}): Promise<boolean> {
  if (!question.answer || !isBasicProfileQuestion(question)) return false;

  const fields = getProfileFields(question);
  const field = fields[0];
  if (!field) return false;

  const session = await prisma.agentSession.findUnique({
    where: { id: question.sessionId },
    select: { companyId: true, company: { select: { name: true } } },
  });
  if (!session) return false;

  const answer = question.answer.trim();
  const data: Record<string, unknown> = {};
  const companyData: Record<string, unknown> = {};

  if (field === "representative") {
    data.representative = answer;
    data.representativeStatus = "confirmed";
  } else if (field === "address") {
    data.address = answer;
    data.addressStatus = "confirmed";
  } else if (field === "established") {
    data.established = answer;
    data.establishedStatus = answer === "不明" ? "unconfirmed" : "confirmed";
  } else if (field === "businessDescription") {
    data.businessDescription = answer;
    data.businessDescriptionStatus = "confirmed";
    data.mainServices = JSON.stringify(splitServices(answer));
  } else if (field === "employees") {
    data.employeesTotal = parseFirstNumber(answer);
    data.employeesStatus = data.employeesTotal ? "confirmed" : "estimated";
    if (data.employeesTotal) companyData.employeeCount = String(data.employeesTotal);
  } else if (field === "locations") {
    data.locations = JSON.stringify(parseLocations(answer));
    data.locationsStatus = "confirmed";
  } else {
    return false;
  }

  await prisma.companyProfile.upsert({
    where: { companyId: session.companyId },
    create: {
      companyId: session.companyId,
      ...data,
    },
    update: data,
  });

  if (Object.keys(companyData).length > 0) {
    await prisma.company.update({
      where: { id: session.companyId },
      data: companyData,
    });
  }

  return true;
}

const PROFILE_FIELD_ALIASES: Record<string, string> = {
  representative: "representative",
  representative_name: "representative",
  ceo: "representative",
  address: "address",
  headquarters_address: "address",
  head_office_address: "address",
  established: "established",
  establishment_date: "established",
  founded: "established",
  businessDescription: "businessDescription",
  business_description: "businessDescription",
  business: "businessDescription",
  services: "businessDescription",
  employees: "employees",
  employee_count: "employees",
  employeeCount: "employees",
  staff_count: "employees",
  locations: "locations",
  offices: "locations",
  office_count: "locations",
  sites: "locations",
};

function isBasicProfileQuestion(question: {
  relatedFields: string | null;
  context: string | null;
  questionText: string;
}) {
  if (getProfileFields(question).length > 0) return true;
  const text = `${question.context ?? ""}\n${question.questionText}`;
  return /基本情報|会社基本情報|様式1|審査申請書/.test(text) &&
    /従業員数|所在地|拠点|事業所|代表者|設立|事業内容/.test(question.questionText);
}

function getProfileFields(question: { relatedFields: string | null; questionText: string }) {
  const parsed = parseRelatedFields(question.relatedFields);
  const mapped = parsed
    .map(field => PROFILE_FIELD_ALIASES[field] ?? field)
    .filter(field => ["representative", "address", "established", "businessDescription", "employees", "locations"].includes(field));

  if (mapped.length > 0) return mapped;

  if (/従業員|社員|スタッフ|雇用区分/.test(question.questionText)) return ["employees"];
  if (/拠点|事業所|オフィス|所在地/.test(question.questionText)) return ["locations"];
  if (/代表者|代表取締役/.test(question.questionText)) return ["representative"];
  if (/設立|創業/.test(question.questionText)) return ["established"];
  if (/主な事業内容|事業内容/.test(question.questionText)) return ["businessDescription"];
  return [];
}

function parseRelatedFields(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return value.split(/,|、/).map(v => v.trim()).filter(Boolean);
  }
}

function parseFirstNumber(value: string) {
  const normalized = value.replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  const match = normalized.match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

function parseLocations(value: string) {
  return value
    .split(/\n|、|,/)
    .map(v => v.trim())
    .filter(Boolean)
    .map((v, index) => ({ name: index === 0 ? "本社" : `拠点${index + 1}`, address: v }));
}

function splitServices(value: string) {
  return value
    .split(/\n|、|,|・/)
    .map(v => v.trim())
    .filter(Boolean)
    .slice(0, 10);
}
