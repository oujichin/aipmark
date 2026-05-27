import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TEMPLATE_USAGE_RULES } from "@/lib/source-documents";
import { unblockAndSendUserMessage, isWaitingForToolResultsError } from "@/lib/session-orchestrator";

// GET /api/sessions/[id]/chat?bpId=xxx — 業務別チャット履歴を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bpId = request.nextUrl.searchParams.get("bpId");

  const messages = await prisma.chatMessage.findMany({
    where: {
      sessionId: id,
      businessProcessId: bpId || null,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ messages });
}

// POST /api/sessions/[id]/chat — 業務別AIチャットでメッセージ送信
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { message, businessProcessId, action } = body as {
    message: string;
    businessProcessId: string | null;
    action?: string;
  };

  if (!message && action !== "save") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const session = await prisma.agentSession.findUniqueOrThrow({
    where: { id },
    include: { company: true },
  });

  if (!session.anthropicSessionId) {
    return NextResponse.json({ error: "No agent session" }, { status: 400 });
  }

  // ユーザーメッセージをDBに保存（saveアクション時はスキップ）
  if (action !== "save") {
    await prisma.chatMessage.create({
      data: {
        sessionId: id,
        businessProcessId,
        role: "user",
        content: message ?? "",
      },
    });
  }

  // 業務の情報を取得
  let bpContext = "";
  let bpName = "";
  if (businessProcessId) {
    const bp = await prisma.businessProcess.findUnique({
      where: { id: businessProcessId },
      include: {
        children: true,
        bpPiis: {
          include: {
            personalInfoItem: true,
            dataSubject: true,
            storageLocation: true,
            thirdParties: { include: { thirdParty: true } },
          },
        },
      },
    });
    if (bp) {
      bpName = bp.name;
      bpContext = `\n\n【対話中の業務】${bp.name}（${bp.department ?? "部門不明"}）\n${bp.description ?? ""}`;
      if (bp.children.length > 0) {
        bpContext += `\nサブ業務: ${bp.children.map(c => c.name).join(", ")}`;
      }
      if (bp.bpPiis.length > 0) {
        bpContext += `\n既に特定された個人情報: ${bp.bpPiis.map(p => p.personalInfoItem.canonicalName).join(", ")}`;
      }
    }
  }

  // 全体プール（他業務の情報）を要約して付与
  const allBps = await prisma.businessProcess.findMany({
    where: { companyId: session.companyId },
    include: {
      bpPiis: { include: { personalInfoItem: true } },
      children: { select: { name: true } },
    },
  });
  const poolSummary = allBps.map(bp => {
    const piis = bp.bpPiis.map(p => p.personalInfoItem.canonicalName).join(", ");
    const childNames = bp.children.map(c => c.name).join(", ");
    return `- ${bp.name}${childNames ? ` [${childNames}]` : ""}${piis ? `: ${piis}` : ""}`;
  }).join("\n");

  // 直近のチャット履歴も付与（コンテキスト維持）
  const recentChat = await prisma.chatMessage.findMany({
    where: { sessionId: id, businessProcessId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const chatHistory = recentChat.reverse().map(m =>
    `${m.role === "user" ? "ユーザー" : "AI"}: ${m.content}`
  ).join("\n");

  let text: string;

  if (action === "save") {
    // チャット終了時の強制保存: 対話で得た情報をすべてツールで保存させる
    text = `【重要: 対話内容の保存 — ツール呼び出し必須】

report_detailed_findings ツールを呼んでください。report_findings ではありません。

${TEMPLATE_USAGE_RULES}

business_process_name は正確に「${bpName}」としてください（名前を変えないこと）。

対話で判明した個人情報を personal_info_details 配列として含めてください。
各要素には info_name, data_category, classification, acquisition_method, storage_location, storage_method, manager, accessible_persons, retention_period, disposal_method を含めます。
ユーザーが明示的に確認した情報は status: "confirmed"、AIの推測は status: "estimated" としてください。

テキストでの返答は不要です。ツールの呼び出しだけを行ってください。

対話で得た情報:
${chatHistory}`;
  } else {
    text = `【業務別対話モード】
ユーザーが業務について対話しています。以下のルールに従ってください:

${TEMPLATE_USAGE_RULES}

1. この業務の具体的な内容・フロー・タスクを理解することが最優先
2. 業務が複合的なら、サブ業務に分割を提案する（report_findingsで追加）
3. タスクまで理解できたら、そこから個人情報を予測して確認を求める
4. チェックリスト的な質問は禁止。業務理解から自然に導き出す
5. 1回の応答で質問は1〜2個まで。回答を待ってから次の質問を組み立てる
6. 個人情報の詳細が確認できたら、その場で report_detailed_findings を呼んで保存すること
${bpContext}

【全業務の概要（参照用）】
${poolSummary}

${chatHistory ? `【これまでの対話】\n${chatHistory}\n` : ""}
ユーザーの発言: ${message}`;
  }

  const anthropicSessionId = session.anthropicSessionId;

  try {
    await unblockAndSendUserMessage(anthropicSessionId, text);
  } catch (e) {
    if (isWaitingForToolResultsError(e)) {
      console.error("[Chat] Failed to send message after recovery:", e);
      return NextResponse.json(
        { error: "Agent is still finishing a previous tool action. Please try again in a few seconds." },
        { status: 409 }
      );
    }
    console.error("[Chat] Failed to send message:", e);
    return NextResponse.json(
      { error: "Failed to send message to agent" },
      { status: 502 }
    );
  }

  // DB状態更新
  await prisma.agentSession.update({
    where: { id },
    data: { status: "running" },
  });

  // バックグラウンドでストリーム処理（agent.messageをキャプチャしてChatMessageに保存）
  const { processStreamAfterMessage } = await import("@/lib/session-orchestrator");
  processStreamAfterMessage(id, session.companyId, anthropicSessionId, businessProcessId).catch(err => {
    console.error("[Chat Stream Error]", err);
  });

  return NextResponse.json({ status: "message_sent" });
}

