import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";
import {
  normalizeFindings,
  normalizeRiskAssessment,
  normalizeCompanyProfile,
  normalizeDetailedFindings,
  saveExportRegistry,
} from "./normalizer";
import type {
  ReportFindingsInput,
  ReportRiskAssessmentInput,
  GenerateQuestionsInput,
  ReportCompanyProfileInput,
  ReportDetailedFindingsInput,
  ExportRegistryInput,
} from "@/types/agent";
import { buildDefaultTemplateLibraryBrief, buildSourceMaterialBrief, TEMPLATE_USAGE_RULES } from "./source-documents";

// ════════════════════════════════════════════════════════════════════
// セッションオーケストレーター (v1.2)
// Anthropic SDK 経由で Managed Agent を操作
// ════════════════════════════════════════════════════════════════════

const client = new Anthropic();
const PMARK_AGENT_ID = process.env.PMARK_AGENT_ID ?? "";
const PMARK_ENV_ID = process.env.PMARK_ENV_ID ?? "";

// SSEイベントをフロントエンドに転送するためのコールバック型
export type SSECallback = (event: {
  tool_name: string;
  result: unknown;
  message?: string;
}) => void;

// セッションごとのSSEコールバック管理
const sseCallbacks = new Map<string, Set<SSECallback>>();

export function subscribeSSE(sessionId: string, callback: SSECallback): () => void {
  if (!sseCallbacks.has(sessionId)) {
    sseCallbacks.set(sessionId, new Set());
  }
  sseCallbacks.get(sessionId)!.add(callback);
  return () => {
    sseCallbacks.get(sessionId)?.delete(callback);
  };
}

function emitSSE(sessionId: string, toolName: string, result: unknown, message?: string) {
  const callbacks = sseCallbacks.get(sessionId);
  if (callbacks) {
    for (const cb of callbacks) {
      cb({ tool_name: toolName, result, message });
    }
  }
}

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
  // 既存データに基づいてphaseを自動判定
  const initialPhase = await detectCurrentPhase(companyId, "");

  const dbSession = await prisma.agentSession.create({
    data: {
      companyId,
      status: "running",
      phase: initialPhase,
    },
  });

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

  // 既存の業務一覧を取得（セッション跨ぎ対応）
  const existingBps = await prisma.businessProcess.findMany({
    where: { companyId: dbSession.companyId },
    select: { name: true, department: true, description: true },
  });
  const initialPrompt = await buildInitialPrompt(companyName, companyUrl, files, existingBps);

  await client.beta.sessions.events.send(anthropicSessionId, {
    events: [{
      type: "user.message",
      content: [{ type: "text", text: initialPrompt }],
    }],
  });

  await processStreamLoop(sessionId, dbSession.companyId, anthropicSessionId);
}

/**
 * ストリーム処理ループ — requires_action の場合は tool result 送信後に再ストリーム
 */
async function processStreamLoop(
  sessionId: string,
  companyId: string,
  anthropicSessionId: string,
  chatBusinessProcessId?: string | null,
) {
  const STREAM_TIMEOUT_MS = 120_000; // 2分タイムアウト

  try {
    while (true) {
      let stream;
      try {
        stream = await client.beta.sessions.events.stream(anthropicSessionId);
      } catch (e) {
        console.error("[Stream] Failed to open stream:", e);
        break;
      }

      let shouldContinue = false;
      let lastEventTime = Date.now();

      // タイムアウト監視
      const timeoutChecker = setInterval(() => {
        if (Date.now() - lastEventTime > STREAM_TIMEOUT_MS) {
          console.warn("[Stream] Timeout — no events for 2 minutes, aborting");
          clearInterval(timeoutChecker);
          // ストリームをabortするためにエラーをスローする方法がないので、
          // フラグで脱出する（次のイベントで検出）
        }
      }, 10_000);

      try {
        for await (const event of stream) {
          lastEventTime = Date.now();
          const ev = event as unknown as Record<string, unknown>;
          console.log("[Stream Event]", ev.type, ev.name ?? "", JSON.stringify(ev).slice(0, 300));

          try {
            await handleEvent(sessionId, companyId, anthropicSessionId, ev, chatBusinessProcessId);
          } catch (e) {
            console.error("[Stream] handleEvent error:", e);
            // custom tool呼び出しでエラーが起きた場合、tool resultを返さないと
            // エージェントがrequires_actionで永久に止まるため、エラーを返す
            const evId = ev.id as string | undefined;
            const evType2 = ev.type as string;
            if (evId && (evType2.includes("tool_use") || evType2.includes("custom_tool"))) {
              try {
                await client.beta.sessions.events.send(anthropicSessionId, {
                  events: [{
                    type: "user.custom_tool_result",
                    custom_tool_use_id: evId,
                    content: [{ type: "text", text: `Error processing tool call: ${(e as Error).message}. Please retry with correct input format.` }],
                  }],
                });
              } catch (sendErr) {
                console.error("[Stream] Failed to send error tool result:", sendErr);
              }
            }
          }

          // idle/完了検出: 多様なイベント名パターン
          const evType = ev.type as string;

          // パターン1: session idle
          if (evType.includes("idle") || evType.includes("status_idle")) {
            const stopReason = (ev.stop_reason ?? ev.stopReason ?? ev.data) as Record<string, unknown> | string | undefined;
            const stopType = typeof stopReason === "string" ? stopReason
              : (stopReason?.type ?? stopReason?.stop_reason);

            shouldContinue = stopType === "requires_action";
            break;
          }

          // パターン2: turn complete
          if (evType.includes("turn") && (evType.includes("complete") || evType.includes("end"))) {
            shouldContinue = !!(ev.requires_action);
            break;
          }

          // パターン3: error
          if (evType.includes("error")) {
            console.error("[Stream] Agent error event:", JSON.stringify(ev));
            shouldContinue = false;
            break;
          }

          // タイムアウト検出
          if (Date.now() - lastEventTime > STREAM_TIMEOUT_MS) {
            console.warn("[Stream] Breaking due to timeout");
            shouldContinue = false;
            break;
          }
        }
      } finally {
        clearInterval(timeoutChecker);
      }

      if (!shouldContinue) break;
    }
  } catch (e) {
    console.error("[Stream Loop] Unexpected error:", e);
  } finally {
    // 実際のDB状態からphaseを自動判定してidle更新
    const phase = await detectCurrentPhase(companyId, sessionId);
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: "idle", phase },
    }).catch(e => console.error("[Stream Loop] Failed to update status:", e));
    await ensureBasicHearingFallback(sessionId, companyId, phase);
    console.log("[Stream Loop] Set idle, phase:", phase);
    emitSSE(sessionId, "agent_status", null, "エージェントが待機中です");
  }
}

/**
 * SSEイベントを処理する
 */
async function handleEvent(
  sessionId: string,
  companyId: string,
  anthropicSessionId: string,
  event: Record<string, unknown>,
  chatBusinessProcessId?: string | null,
) {
  const eventType = event.type as string;
  const eventName = event.name as string | undefined;
  const eventId = event.id as string | undefined;
  const eventInput = event.input;

  switch (eventType) {
    case "agent.tool_use":
    case "agent.custom_tool_use":
    case "agent_tool_use":
    case "agent_custom_tool_use":
    case "custom_tool_use":
    case "tool_use": {
      // Web証跡の記録
      if (eventName === "web_fetch" || eventName === "web_search") {
        await appendWebAccessLog(sessionId, eventInput as Record<string, unknown>);
        emitSSE(sessionId, "agent_status", null,
          eventName === "web_fetch"
            ? `Webページを読み込み中...`
            : `Web検索中...`
        );
      }

      // ── Phase 0: report_company_profile ──
      if (eventName === "report_company_profile") {
        const result = await normalizeCompanyProfile(
          companyId,
          eventInput as ReportCompanyProfileInput
        );
        await prisma.agentSession.update({
          where: { id: sessionId },
          data: { phase: "phase1_discovery" },
        });
        emitSSE(sessionId, "report_company_profile", eventInput);
        await client.beta.sessions.events.send(anthropicSessionId, {
          events: [{
            type: "user.custom_tool_result",
            custom_tool_use_id: eventId!,
            content: [{ type: "text", text: `Company profile saved (${result.profileId}). Proceed to Phase 1: discover ALL business processes (regardless of personal data). Report each business process immediately as you find it. personal_info_items can be empty [].` }],
          }],
        });
      }

      // ── Phase 1: report_findings ──
      if (eventName === "report_findings") {
        const result = await normalizeFindings(
          companyId,
          sessionId,
          eventInput as ReportFindingsInput
        );
        emitSSE(sessionId, "report_findings", eventInput);
        await client.beta.sessions.events.send(anthropicSessionId, {
          events: [{
            type: "user.custom_tool_result",
            custom_tool_use_id: eventId!,
            content: [{ type: "text", text: `Saved. BP: ${result.businessProcessId}, items: ${result.bpPiiIds.length}. Continue discovering ALL business processes (not just personal-data-related ones). Report each one immediately. personal_info_items can be empty [].` }],
          }],
        });
      }

      // ── Phase 2: report_detailed_findings ──
      if (eventName === "report_detailed_findings") {
        const result = await normalizeDetailedFindings(
          companyId,
          eventInput as ReportDetailedFindingsInput
        );
        await prisma.agentSession.update({
          where: { id: sessionId },
          data: { phase: "phase2_deep_dive" },
        });
        emitSSE(sessionId, "report_detailed_findings", eventInput);
        await client.beta.sessions.events.send(anthropicSessionId, {
          events: [{
            type: "user.custom_tool_result",
            custom_tool_use_id: eventId!,
            content: [{ type: "text", text: `Detailed findings saved (${result.bpPiiIds.length} items updated). Continue with next business process deep-dive.` }],
          }],
        });
      }

      // ── Phase 3: report_risk_assessment ──
      if (eventName === "report_risk_assessment") {
        const result = await normalizeRiskAssessment(
          companyId,
          eventInput as ReportRiskAssessmentInput
        );
        await prisma.agentSession.update({
          where: { id: sessionId },
          data: { phase: "phase3_risk_pms" },
        });
        emitSSE(sessionId, "report_risk_assessment", eventInput);
        await client.beta.sessions.events.send(anthropicSessionId, {
          events: [{
            type: "user.custom_tool_result",
            custom_tool_use_id: eventId!,
            content: [{ type: "text", text: `Risk assessment saved (${result.riskIds.length} risks). Continue with next business process or proceed to PMS document identification.` }],
          }],
        });
      }

      // ── generate_questions ──
      if (eventName === "generate_questions") {
        if (chatBusinessProcessId) {
          // チャットモード: generate_questionsは使わず、テキストで直接質問すべき
          await client.beta.sessions.events.send(anthropicSessionId, {
            events: [{
              type: "user.custom_tool_result",
              custom_tool_use_id: eventId!,
              content: [{ type: "text", text: "ERROR: In chat mode, do NOT use generate_questions. Instead, ask your question directly as a text message. The user is in a live chat conversation with you." }],
            }],
          });
        } else {
          await saveQuestions(sessionId, eventInput as GenerateQuestionsInput);
        const currentSession = await prisma.agentSession.findUnique({ where: { id: sessionId } });
        const shouldKeepRunning = currentSession?.status === "running";
        if (!shouldKeepRunning) {
          await prisma.agentSession.update({
            where: { id: sessionId },
            data: { status: "waiting_for_answers" },
          });
        }
        emitSSE(sessionId, "generate_questions", eventInput);
        await client.beta.sessions.events.send(anthropicSessionId, {
          events: [{
            type: "user.custom_tool_result",
            custom_tool_use_id: eventId!,
            content: [{
              type: "text",
              text: shouldKeepRunning
                ? "Human checkpoints saved. Continue the autopilot run with estimated data where needed, and proceed through risk assessment."
                : "Questions sent to user. Waiting for answers.",
            }],
          }],
        });
        }
      }

      // ── Phase 4: export_registry ──
      if (eventName === "export_registry") {
        const result = await saveExportRegistry(
          companyId,
          eventInput as ExportRegistryInput
        );
        await prisma.agentSession.update({
          where: { id: sessionId },
          data: { phase: "phase4_export" },
        });
        emitSSE(sessionId, "export_registry", eventInput);
        await client.beta.sessions.events.send(anthropicSessionId, {
          events: [{
            type: "user.custom_tool_result",
            custom_tool_use_id: eventId!,
            content: [{ type: "text", text: `Document exported (${result.documentId}).` }],
          }],
        });
      }
      break;
    }

    case "agent.message":
    case "agent_message": {
      const content = event.content as Array<{ type: string; text?: string }> | undefined;
      const text = content?.filter(c => c.type === "text").map(c => c.text).join("\n") ?? "";
      if (text) {
        emitSSE(sessionId, "agent_message", { text, businessProcessId: chatBusinessProcessId ?? null });
        // チャット履歴に保存
        await prisma.chatMessage.create({
          data: {
            sessionId,
            businessProcessId: chatBusinessProcessId ?? null,
            role: "assistant",
            content: text,
          },
        });

        if (!chatBusinessProcessId && looksLikeUnstructuredCompletion(text)) {
          emitSSE(sessionId, "agent_status", null, "AIレポートを構造化データとして保存し直しています...");
          await client.beta.sessions.events.send(anthropicSessionId, {
            events: [{
              type: "user.message",
              content: [{
                type: "text",
                text: `今の返答は画面に反映されません。テキストの完了レポートではなく、DB更新用custom toolを必ず呼んでください。

直前のレポート内容を、次の順で構造化保存してください。
1. 会社基本情報が未保存なら report_company_profile
2. 各業務プロセスを report_findings
3. 各業務の個人情報取扱いを report_detailed_findings
4. 各業務・各個人情報のリスクを report_risk_assessment

重要:
- 追加の説明文や完了レポートは不要です。
- report_risk_assessment の各riskには target_info_name を入れてください。
- 推定値でよいので confidence: "estimated" として保存してください。
- 保存toolを呼ばずに文章だけで完了してはいけません。`,
              }],
            }],
          });
        }
      }
      break;
    }

    case "session.status_idle":
    case "session_status_idle":
    case "status_idle": {
      // idle更新はprocessStreamLoopのfinallyで行うため、ここではSSEのみ
      emitSSE(sessionId, "agent_status", null, "エージェントが待機中です");
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
  const messageText = `User answers:\n\n${qaText}\n\nReflect these answers, update the structured data, and continue with deep-dive analysis.`;

  const anthropicSessionId = session.anthropicSessionId;
  await unblockAndSendUserMessage(anthropicSessionId, messageText);

  await prisma.agentSession.update({
    where: { id: sessionId },
    data: { status: "running" },
  });

  await processStreamLoop(sessionId, session.companyId, anthropicSessionId);
}

async function interruptIfBusy(anthropicSessionId: string) {
  try {
    const agentSession = await client.beta.sessions.retrieve(anthropicSessionId);
    if (agentSession.status === "running") {
      await client.beta.sessions.events.send(anthropicSessionId, {
        events: [{ type: "user.interrupt" }],
      });
      for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const check = await client.beta.sessions.retrieve(anthropicSessionId);
        if (check.status !== "running") break;
      }
    }
  } catch (e) {
    console.warn("[Orchestrator] interruptIfBusy failed:", e);
  }
}

async function sendUserMessageText(anthropicSessionId: string, text: string) {
  await client.beta.sessions.events.send(anthropicSessionId, {
    events: [{
      type: "user.message",
      content: [{ type: "text", text }],
    }],
  });
}

export function isWaitingForToolResultsError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("waiting on responses to events") ||
    message.includes("only `user.tool_confirmation`") ||
    message.includes("only `user.custom_tool_result`");
}

/**
 * `requires_action` 状態でハングしているセッションを解放する。
 * 直近の `session.status_idle` から保留中の event_id を取得し、
 * カスタムツールなら `user.custom_tool_result`、組込/MCPツールなら
 * `user.tool_confirmation: deny` を返してアンブロックする。
 */
export async function clearPendingToolEvents(anthropicSessionId: string): Promise<number> {
  const recent: Array<Record<string, unknown>> = [];
  try {
    for await (const event of client.beta.sessions.events.list(anthropicSessionId, {
      order: "desc",
      limit: 50,
    })) {
      recent.push(event as unknown as Record<string, unknown>);
      if (recent.length >= 50) break;
    }
  } catch (e) {
    console.warn("[Orchestrator] clearPendingToolEvents: failed to list events:", e);
    return 0;
  }

  const latestIdle = recent.find(e => {
    if (e.type !== "session.status_idle") return false;
    const stop = (e.stop_reason ?? (e as Record<string, unknown>).stopReason) as
      | Record<string, unknown>
      | undefined;
    return stop?.type === "requires_action";
  });
  if (!latestIdle) return 0;

  const stopReason = (latestIdle.stop_reason ?? (latestIdle as Record<string, unknown>).stopReason) as
    | Record<string, unknown>
    | undefined;
  const pendingIds = (stopReason?.event_ids ?? []) as string[];
  if (pendingIds.length === 0) return 0;

  const typeById = new Map<string, string>();
  for (const e of recent) {
    if (typeof e.id === "string" && typeof e.type === "string") {
      typeById.set(e.id, e.type);
    }
  }

  let resolved = 0;
  for (const id of pendingIds) {
    const eventType = typeById.get(id);
    try {
      if (eventType === "agent.tool_use" || eventType === "agent.mcp_tool_use") {
        await client.beta.sessions.events.send(anthropicSessionId, {
          events: [{
            type: "user.tool_confirmation",
            tool_use_id: id,
            result: "deny",
            deny_message: "User has interrupted to send a new request. Process the next user message instead.",
          }],
        });
      } else {
        await client.beta.sessions.events.send(anthropicSessionId, {
          events: [{
            type: "user.custom_tool_result",
            custom_tool_use_id: id,
            content: [{
              type: "text",
              text: "User has interrupted to send a new request. The previous tool call was not processed. Process the next user message instead.",
            }],
            is_error: true,
          }],
        });
      }
      resolved += 1;
    } catch (e) {
      console.warn(`[Orchestrator] clearPendingToolEvents: failed to resolve ${id} (${eventType ?? "unknown"}):`, e);
    }
  }
  return resolved;
}

/**
 * 自動リカバリ付きのユーザーメッセージ送信。
 * `requires_action` でハングしている場合は保留イベントを解放してから再送する。
 */
export async function unblockAndSendUserMessage(anthropicSessionId: string, text: string): Promise<void> {
  await interruptIfBusy(anthropicSessionId);
  try {
    await sendUserMessageText(anthropicSessionId, text);
    return;
  } catch (e) {
    if (!isWaitingForToolResultsError(e)) throw e;
  }

  // 保留中の tool_use イベントを解放してから再送
  const resolved = await clearPendingToolEvents(anthropicSessionId);
  if (resolved > 0) {
    // 状態遷移を少し待つ
    await new Promise(resolve => setTimeout(resolve, 300));
  } else {
    // フォールバック: 互換のため interrupt を試す
    try {
      await client.beta.sessions.events.send(anthropicSessionId, {
        events: [{ type: "user.interrupt" }],
      });
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  await sendUserMessageText(anthropicSessionId, text);
}

/**
 * メッセージ送信後のストリーム処理（message API から呼ばれる）
 */
export async function processStreamAfterMessage(
  sessionId: string,
  companyId: string,
  anthropicSessionId: string,
  chatBusinessProcessId?: string | null,
) {
  await processStreamLoop(sessionId, companyId, anthropicSessionId, chatBusinessProcessId);
}

/**
 * ユーザーの指示でエクスポートを実行する
 */
export async function requestExport(sessionId: string, documentType: string) {
  const session = await prisma.agentSession.findUniqueOrThrow({
    where: { id: sessionId },
  });
  if (!session.anthropicSessionId) throw new Error("No anthropic session");
  const anthropicSessionId = session.anthropicSessionId;
  const templateBrief = await buildDefaultTemplateLibraryBrief();
  const messageText = `ユーザーが「${documentType}」の出力を要求しました。

${TEMPLATE_USAGE_RULES}

## Template Library
${templateBrief}

現在のDBにある対象会社データを使って、テンプレートの構成・記載粒度に沿った新規書類として export_registry を呼んで出力してください。過去資料の会社情報を今回データへ流用してはいけません。`;

  await unblockAndSendUserMessage(anthropicSessionId, messageText);

  await prisma.agentSession.update({
    where: { id: sessionId },
    data: { status: "running", phase: "phase4_export" },
  });

  await processStreamLoop(sessionId, session.companyId, anthropicSessionId);
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
        relatedProcess: q.related_process || null,
        relatedFields: JSON.stringify(q.related_fields),
        priority: q.priority,
        context: input.context,
      },
    });
  }
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

function looksLikeUnstructuredCompletion(text: string): boolean {
  const normalized = text.toLowerCase();
  const completionSignals = [
    "phase 0",
    "phase 0〜3",
    "phase 0-3",
    "完了レポート",
    "調査完了",
    "リスク一覧",
    "リスク分析",
  ];
  const hasCompletionSignal = completionSignals.some(signal => normalized.includes(signal.toLowerCase()));
  const hasStructuredSaveSignal = normalized.includes("report_findings") ||
    normalized.includes("report_detailed_findings") ||
    normalized.includes("report_risk_assessment");
  return hasCompletionSignal && !hasStructuredSaveSignal;
}

async function ensureBasicHearingFallback(sessionId: string, companyId: string, phase: string) {
  if (phase !== "phase0_company_profile") return;

  const existingPending = await prisma.question.findMany({
    where: { sessionId, status: "pending" },
    select: { context: true },
  });
  if (existingPending.some(q => q.context?.startsWith("基本情報ヒアリング:"))) return;

  const profile = await prisma.companyProfile.findUnique({ where: { companyId } });
  const specs = [
    ["representative", "代表者名を教えてください。", "様式1-①、個人情報保護体制、トップインタビュー準備に使います。", !profile?.representative],
    ["address", "本社所在地を教えてください。", "申請書の会社情報、適用範囲、拠点管理に使います。", !profile?.address],
    ["businessDescription", "主な事業内容を教えてください。", "取扱業務の洗い出し、様式4、個人情報管理台帳の前提に使います。", !profile?.businessDescription],
    ["employees", "従業員数を教えてください。分かれば雇用区分別の内訳も入力してください。", "教育計画、監査計画、体制図、申請書の従業員情報に使います。", profile?.employeesTotal == null],
    ["locations", "事業所・拠点を教えてください。", "PMSの適用範囲、現地審査、保管場所確認に使います。", !profile || JSON.parse(profile.locations || "[]").length === 0],
    ["established", "設立年月日または設立年を教えてください。", "申請書の会社基本情報に使います。", !profile?.established],
  ] as const;

  for (const [field, questionText, purpose, missing] of specs) {
    if (!missing) continue;
    await prisma.question.create({
      data: {
        sessionId,
        questionText,
        questionType: "free_text",
        options: null,
        relatedProcess: null,
        relatedFields: JSON.stringify([field]),
        priority: field === "established" ? "nice_to_have" : "critical",
        context: `基本情報ヒアリング: 公開情報で確認できなかったため質問します。${purpose}`,
      },
    });
  }

  const pendingCount = await prisma.question.count({ where: { sessionId, status: "pending" } });
  if (pendingCount > 0) {
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: "waiting_for_answers" },
    });
  }
}

/**
 * DBの実データからphaseを自動判定する
 * tool呼び出しの有無ではなく、実際にどこまでデータが揃っているかで判定
 */
async function detectCurrentPhase(companyId: string, sessionId: string): Promise<string> {
  // ドキュメント（export）があれば phase4
  const docCount = await prisma.document.count({ where: { companyId } });
  if (docCount > 0) return "phase4_export";

  // リスク評価があれば phase3
  const riskCount = await prisma.riskAssessment.count({
    where: { bpPii: { businessProcess: { companyId } } },
  });
  if (riskCount > 0) return "phase3_risk_pms";

  // 詳細フィールド（infoName, category等）が埋まっているBpPIIがあれば phase2完了
  const detailedCount = await prisma.businessProcessPII.count({
    where: {
      businessProcess: { companyId },
      infoName: { not: null },
    },
  });
  if (detailedCount > 0) return "phase2_deep_dive";

  // 業務プロセスがあれば phase1完了
  const bpCount = await prisma.businessProcess.count({ where: { companyId } });
  if (bpCount > 0) return "phase1_discovery";

  // CompanyProfileがあれば phase0完了 → phase1へ
  const profile = await prisma.companyProfile.findUnique({ where: { companyId } });
  if (profile) return "phase1_discovery";

  return "phase0_company_profile";
}

async function buildInitialPrompt(
  companyName: string,
  companyUrl: string,
  files: FileInfo[],
  existingBps: { name: string; department: string | null; description: string | null }[] = []
): Promise<string> {
  const fileList = files.length > 0
    ? buildSourceMaterialBrief(files)
    : await buildDefaultTemplateLibraryBrief();

  const hasExistingData = existingBps.length > 0;

  const existingDataSection = hasExistingData
    ? `\n## 既存データ（前回セッションからの引き継ぎ）
この企業には既に ${existingBps.length} 件の業務プロセスが登録されています:
${existingBps.map(bp => `- ${bp.name}${bp.department ? `（${bp.department}）` : ""}`).join("\n")}

**重要**: 既存データを消さず、現在の到達点から業務フローを継続してください。
- 未登録の業務だけ report_findings で追加する
- 台帳項目が未整備なら report_detailed_findings で埋める
- リスク分析が未整備なら report_risk_assessment を呼ぶ
- PMS文書・申請書類の作成に進める状態まで、不足工程を順に進める
- ユーザーの明示指示がない限り、既存データを過去テンプレートの会社情報で上書きしてはならない\n`
    : "";

  return `## Target Company
- Name: ${companyName}
- Website: ${companyUrl}

## Template Library / Uploaded Files
${fileList}
${existingDataSection}
## 本ツールの目的
このセッションのゴールは、単なる文書生成ではありません。対象会社について、会社HP・ヒアリング・ユーザー入力からPMSの運用実態をゼロから構築し、その副産物として審査申請書、個人情報管理台帳、PMS文書一覧、個人情報保護方針、個人情報保護規程、リスク分析表、教育・監査・マネジメントレビュー関連文書、様式A/B/Cへの指摘対応案を作れる状態にすることです。

${TEMPLATE_USAGE_RULES}

## 作業フロー

### Phase 0: 基本情報収集
1. 企業HPをweb_fetchで確認（会社概要、事業内容、拠点情報）
2. 対象会社固有の資料があれば会社の基本情報を抽出する。テンプレート資料から会社情報を抽出してはならない
3. report_company_profile を呼んで基本情報を報告
4. 様式1-①に必要な情報（代表者名、所在地、従業員数等）も同時に収集

### Phase 1: 業務の洗い出し（段階的報告）
1. 対象会社HP・ヒアリング・今回入力から企業の**全業務プロセス**を洗い出す（個人情報の有無は問わない）
2. **1つ見つかるたびに即座に report_findings を呼ぶ**
   - personal_info_items は空配列 [] でよい（この段階では個人情報の特定は不要）
   - 全部揃うのを待たない。発見順に1件ずつ報告する
   - ユーザーは画面にリアルタイムで表示される結果を見ている
3. 以下の観点で業務を洗い出す:
   - **主要事業・売上の源泉となる業務**（例: 制作、施工、販売、コンサル、開発等）
   - 営業・マーケティング（顧客獲得、提案、広告、イベント）
   - 顧客対応（問い合わせ、契約、アフターサービス）
   - 社内管理（人事・労務、経理、総務、IT管理）
   - Webサイト運営（フォーム、Cookie、アクセス解析）
   - 委託・外注管理、取引先管理
4. 業務一覧を報告し終えたら、ユーザー確認待ちで停止せず、Phase 2へ進む

### Phase 2: 業務の深掘り（自動運転）
Phase 1完了後、ユーザー対話を待たず、公開情報・資料・業界知見から合理的な仮説を立てて report_detailed_findings を呼ぶ。
通常の対話モードでユーザーから個別業務のメッセージを受けた場合だけ、会話しながら深掘りする。

対話モードでメッセージが来たら、以下の手順で深掘りする:

**Step 1: 業務の具体的な内容を理解する**
- 「この業務では具体的にどのようなことをされていますか？」
- 複数の活動が含まれる場合 → サブ業務に分割を提案する
- 分割する場合は report_findings を呼んで新しい業務プロセスを追加する

**Step 2: 業務フロー・タスクの分解**
- 「一連の流れを教えてください（例: 受注→ヒアリング→制作→確認→納品→請求）」
- タスク単位まで掘り下げる

**Step 3: タスクから個人情報を予測**
- フローが明確になれば、どのタスクで誰の何の情報を扱うか予測できる
- 予測した個人情報を提示し、「合っていますか？」と確認するだけでよい

**Step 4: 台帳データを更新**
- 十分な情報が集まったら report_detailed_findings を呼ぶ
- 予測で埋められる項目はAIが estimated として埋める

**重要な原則:**
- テキストメッセージで対話する（generate_questions は使わない）
- 1回の応答で質問は1〜2個まで
- データは流動的: 業務の分割・統合は随時可能（report_findings で追加可能）
- チェックリスト的な質問は禁止。業務理解から自然に導き出す
- 他業務で得た情報（全体プール）も参照してよい
- 確証が足りない項目は estimated / unconfirmed として前へ進め、重要な確認点だけ generate_questions にする
- generate_questions を呼んでも作業を止めず、可能な範囲でリスク分析まで続ける

### Phase 3: リスク評価 + PMS文書洗い出し
Phase 2 完了後:
1. 各業務×個人情報に対して report_risk_assessment を呼ぶ。各riskには可能な限り target_info_name を入れる
2. 構造化データから今回新規に必要なPMS文書の一覧を特定
3. テンプレート資料の構成と照合し、今回新規作成すべき文書、今回データで書き換える文書、追加ヒアリングが必要な文書を切り分ける

### Phase 4: 帳票エクスポート（ユーザー指示待ち）
**ユーザーが明示的に要求するまで帳票は生成しない。**
要求されたら:
1. export_registry を呼んで台帳やリスク分析シートを出力
2. 様式1-①、1-②、1-③、2、3、4、5、6、7、8 等の申請書類も同様に出力可能
3. テンプレートに沿った新規ドラフト、対象会社データに基づく変更説明、審査指摘への対応案、トップインタビュー想定問答、安全管理措置の確認事項も出力対象にする

## Web調査の注意事項
- トップページ (${companyUrl}) から開始し、リンクをたどる
- URL推測禁止: 必ずトップページのリンクから辿る。見つからない場合はweb_search
- web_search キーワード: "${companyName} 個人情報", "${companyName} プライバシー" 等

## 禁止事項
- Phase 2 完了前に帳票出力を提案してはならない
- ユーザーが要求していないのに帳票を出力してはならない
- 「台帳を作成しました」ではなく「情報の整理が完了しました。台帳として出力する場合はお知らせください」と伝える

## 重要: 段階的報告（Progressive Reporting）
業務プロセスを1つ特定するごとに、即座に report_findings を呼んでください。
すべての業務を調査し終えてからまとめて報告するのではなく、
発見順に1つずつ報告してください。個人情報が未特定でも業務プロセスだけで報告してください。
ユーザーはリアルタイムで画面に表示される結果を見ています。

## 重要: テキスト完了報告の禁止
画面はDBの構造化データだけを表示します。
Phase 0〜3の結果を文章でまとめても、フロント画面は更新されません。
必ず report_company_profile / report_findings / report_detailed_findings / report_risk_assessment を呼び、DBに保存してください。
custom toolを呼ぶ前に「完了レポート」を出してはいけません。

まず Phase 0 から開始し、Phase 3 のリスク分析まで自動で進めてください。`;
}
