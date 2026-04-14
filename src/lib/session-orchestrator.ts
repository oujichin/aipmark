import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";
import { normalizeFindings, normalizeRiskAssessment } from "./normalizer";
import type {
  ReportFindingsInput,
  ReportRiskAssessmentInput,
  GenerateQuestionsInput,
  GenerateDocumentDraftInput,
} from "@/types/agent";

// ════════════════════════════════════════════════════════════════════
// セッションオーケストレーター
// Anthropic SDK 経由で Managed Agent を操作
// ════════════════════════════════════════════════════════════════════

const client = new Anthropic();
const PMARK_AGENT_ID = process.env.PMARK_AGENT_ID ?? "";
const PMARK_ENV_ID = process.env.PMARK_ENV_ID ?? "";

interface FileInfo {
  name: string;
  description: string;
  path: string;
}

/**
 * 新しいAgentセッションを作成し、Discovery を開始する
 */
export async function createDiscoverySession(
  companyId: string,
  companyName: string,
  companyUrl: string,
  files: FileInfo[]
): Promise<string> {
  // DB にセッション作成
  const dbSession = await prisma.agentSession.create({
    data: {
      companyId,
      status: "running",
      phase: "discovery",
    },
  });

  // Managed Agent セッション作成
  const session = await client.beta.sessions.create({
    agent: PMARK_AGENT_ID,
    environment_id: PMARK_ENV_ID,
    title: `${companyName} - Pマーク調査`,
  });

  await prisma.agentSession.update({
    where: { id: dbSession.id },
    data: { anthropicSessionId: session.id },
  });

  return dbSession.id;
}

/**
 * セッションにメッセージを送信し、SSEストリームを処理する
 */
export async function startDiscovery(
  sessionId: string,
  companyName: string,
  companyUrl: string,
  files: FileInfo[]
) {
  const dbSession = await prisma.agentSession.findUniqueOrThrow({
    where: { id: sessionId },
  });

  if (!dbSession.anthropicSessionId) {
    throw new Error("Anthropic session not yet created");
  }

  const anthropicSessionId = dbSession.anthropicSessionId;
  const initialPrompt = buildInitialPrompt(companyName, companyUrl, files);

  // 初回メッセージ送信
  await client.beta.sessions.events.send(anthropicSessionId, {
    events: [{
      type: "user.message",
      content: [{ type: "text", text: initialPrompt }],
    }],
  });

  // SSEストリームを開いてイベント処理ループ
  await processStreamLoop(sessionId, dbSession.companyId, anthropicSessionId);
}

/**
 * ストリーム処理ループ — requires_action の場合は tool result 送信後に再ストリーム
 */
async function processStreamLoop(
  sessionId: string,
  companyId: string,
  anthropicSessionId: string,
) {
  while (true) {
    const stream = await client.beta.sessions.events.stream(anthropicSessionId);
    let shouldContinue = false;

    for await (const event of stream) {
      const ev = event as unknown as Record<string, unknown>;
      await handleEvent(sessionId, companyId, anthropicSessionId, ev);

      if (ev.type === "session.status_idle") {
        const stopReason = ev.stop_reason as Record<string, unknown> | undefined;

        if (stopReason?.type === "requires_action") {
          // custom tool result 待ち — handleEvent で既に送信済みなので再ストリーム
          shouldContinue = true;
        } else {
          // end_turn or retries_exhausted — 完了
          shouldContinue = false;
        }
        break;
      }
    }

    if (!shouldContinue) break;
  }
}

/**
 * SSEイベントを処理する
 */
async function handleEvent(
  sessionId: string,
  companyId: string,
  anthropicSessionId: string,
  event: Record<string, unknown>
) {
  const eventType = event.type as string;
  const eventName = event.name as string | undefined;
  const eventId = event.id as string | undefined;
  const eventInput = event.input;

  switch (eventType) {
    case "agent.tool_use":
    case "agent.custom_tool_use": {
      // Web証跡の記録
      if (eventName === "web_fetch" || eventName === "web_search") {
        await appendWebAccessLog(sessionId, eventInput as Record<string, unknown>);
      }

      // Custom tool コールバック
      if (eventName === "report_findings") {
        const result = await normalizeFindings(
          companyId,
          sessionId,
          eventInput as ReportFindingsInput
        );
        await client.beta.sessions.events.send(anthropicSessionId, {
          events: [{
            type: "user.custom_tool_result",
            custom_tool_use_id: eventId!,
            content: [{ type: "text", text: `Saved. BP: ${result.businessProcessId}, items: ${result.bpPiiIds.length}. Continue to next business process.` }],
          }],
        });
      }

      if (eventName === "report_risk_assessment") {
        const result = await normalizeRiskAssessment(
          companyId,
          eventInput as ReportRiskAssessmentInput
        );
        await client.beta.sessions.events.send(anthropicSessionId, {
          events: [{
            type: "user.custom_tool_result",
            custom_tool_use_id: eventId!,
            content: [{ type: "text", text: `Risk assessment saved (${result.riskIds.length} risks).` }],
          }],
        });
      }

      if (eventName === "generate_questions") {
        await saveQuestions(sessionId, eventInput as GenerateQuestionsInput);
        await prisma.agentSession.update({
          where: { id: sessionId },
          data: { status: "waiting_for_answers", phase: "gap_analysis" },
        });
        await client.beta.sessions.events.send(anthropicSessionId, {
          events: [{
            type: "user.custom_tool_result",
            custom_tool_use_id: eventId!,
            content: [{ type: "text", text: "Questions sent to user. Waiting for answers." }],
          }],
        });
      }

      if (eventName === "generate_document_draft") {
        await saveDocumentDraft(
          companyId,
          eventInput as GenerateDocumentDraftInput
        );
        await client.beta.sessions.events.send(anthropicSessionId, {
          events: [{
            type: "user.custom_tool_result",
            custom_tool_use_id: eventId!,
            content: [{ type: "text", text: "Document draft saved." }],
          }],
        });
      }
      break;
    }

    case "session.status_idle": {
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: { status: "idle" },
      });
      break;
    }
  }
}

// ════════════════════════════════════════════════════════════════════
// 公開ヘルパー
// ════════════════════════════════════════════════════════════════════

export async function sendAnswersToAgent(sessionId: string) {
  const session = await prisma.agentSession.findUniqueOrThrow({
    where: { id: sessionId },
  });
  if (!session.anthropicSessionId) throw new Error("No anthropic session");

  const answeredQuestions = await prisma.question.findMany({
    where: { sessionId, status: "answered" },
    orderBy: { createdAt: "asc" },
  });

  if (answeredQuestions.length === 0) return;

  const qaText = answeredQuestions
    .map(q => `Q: ${q.questionText}\nA: ${q.answer}`)
    .join("\n\n");

  await client.beta.sessions.events.send(session.anthropicSessionId, {
    events: [{
      type: "user.message",
      content: [{ type: "text", text: `User answers:\n\n${qaText}\n\nReflect these answers and proceed to Phase 3.` }],
    }],
  });

  await prisma.agentSession.update({
    where: { id: sessionId },
    data: { status: "running", phase: "drafting" },
  });

  // ストリーム処理ループ
  await processStreamLoop(sessionId, session.companyId, session.anthropicSessionId);
}

// ════════════════════════════════════════════════════════════════════
// 内部ヘルパー
// ════════════════════════════════════════════════════════════════════

async function saveQuestions(sessionId: string, input: GenerateQuestionsInput) {
  for (const q of input.questions) {
    await prisma.question.create({
      data: {
        sessionId,
        questionText: q.question_text,
        questionType: q.question_type,
        options: q.options ? JSON.stringify(q.options) : null,
        relatedFields: JSON.stringify(q.related_fields),
        priority: q.priority,
        context: input.context,
      },
    });
  }
}

async function saveDocumentDraft(companyId: string, input: GenerateDocumentDraftInput) {
  await prisma.document.create({
    data: {
      companyId,
      type: input.document_type,
      filePath: input.file_path,
      fileFormat: input.file_format,
      summary: input.summary,
      unconfirmedCount: input.unconfirmed_count,
      totalFields: input.total_fields,
      confirmedCount: input.total_fields - input.unconfirmed_count,
    },
  });
}

async function appendWebAccessLog(
  sessionId: string,
  input: Record<string, unknown>
) {
  const session = await prisma.agentSession.findUniqueOrThrow({
    where: { id: sessionId },
  });
  const log = JSON.parse(session.webAccessLog);
  log.push({
    url: input.url ?? input.query ?? "",
    method: input.url ? "web_fetch" : "web_search",
    timestamp: new Date().toISOString(),
  });
  await prisma.agentSession.update({
    where: { id: sessionId },
    data: { webAccessLog: JSON.stringify(log) },
  });
}

function buildInitialPrompt(
  companyName: string,
  companyUrl: string,
  files: FileInfo[]
): string {
  const fileList = files.length > 0
    ? files.map(f => `- /workspace/${f.name} (${f.description})`).join("\n")
    : "No files uploaded.";

  return `## Target Company
- Name: ${companyName}
- Website: ${companyUrl}

## Uploaded Files
${fileList}

## Instructions
Investigate this company's personal data handling for P-Mark acquisition.

### Step 1: Read files
Read all files under /workspace/ and extract personal data handling information.

### Step 2: Web research
Start from the top page (${companyUrl}) and read it thoroughly.
Then follow links found on the top page to locate:
- Privacy policy
- Contact form
- Recruitment page
- Service pages (application forms etc.)
- Cookie banners

IMPORTANT: Do NOT guess URLs. Always start from the top page and navigate via links found on that page. If you cannot find a link to a specific page, use web_search instead of guessing URL paths.

Also web_search for "${companyName} personal information", "${companyName} privacy" etc.

### Step 3: Report findings
Call report_findings per business process, then report_risk_assessment for each.

### Step 4: Generate questions
Call generate_questions for items needing confirmation. Target: 15 questions max, critical first.

After Steps 1-2, stop and wait for answers.`;
}
