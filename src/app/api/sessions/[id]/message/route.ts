import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildDefaultTemplateLibraryBrief, TEMPLATE_USAGE_RULES } from "@/lib/source-documents";
import { unblockAndSendUserMessage, isWaitingForToolResultsError } from "@/lib/session-orchestrator";

// POST /api/sessions/[id]/message — ユーザーからエージェントへのメッセージ送信
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { message, action } = body as { message?: string; action?: string };

  const session = await prisma.agentSession.findUniqueOrThrow({
    where: { id },
  });

  if (!session.anthropicSessionId) {
    return NextResponse.json({ error: "No agent session" }, { status: 400 });
  }

  const anthropicSessionId = session.anthropicSessionId;
  const templateBrief = await buildDefaultTemplateLibraryBrief();

  let text: string;

  switch (action) {
    case "start_basic_hearing":
      text = await buildBasicHearingPrompt(id, session.companyId, templateBrief);
      break;

    case "proceed_to_phase2":
      text = message
        ? `ユーザーからのフィードバック: ${message}\n\n業務一覧を確認しました。Phase 2に進んでください。まず会社全体について不明点を1〜2問確認（generate_questionsでrelated_processを空文字に）。その後、業務リストの順に1業務ずつ深掘りしてください。各業務について: (1)具体的な業務内容を質問 (2)業務フロー・タスクを分解 (3)タスクから個人情報を予測して確認 (4)report_detailed_findingsで報告。generate_questionsのrelated_processには必ず業務名を設定してください。`
        : "業務一覧を確認しました。Phase 2に進んでください。まず会社全体について不明点を1〜2問確認（generate_questionsでrelated_processを空文字に）。その後、業務リストの順に1業務ずつ深掘りしてください。各業務について: (1)具体的な業務内容を質問 (2)業務フロー・タスクを分解 (3)タスクから個人情報を予測して確認 (4)report_detailed_findingsで報告。generate_questionsのrelated_processには必ず業務名を設定してください。";
      break;

    case "proceed_to_phase3":
      text = `Phase 2の深掘りを確認しました。Phase 3（リスク評価 + PMS文書洗い出し）に進んでください。各業務×個人情報に対して report_risk_assessment を呼んでください。

${TEMPLATE_USAGE_RULES}

## Template Library
${templateBrief}

リスク分析後は、テンプレート構成に沿って今回新規に必要なPMS文書・申請書類・不足ヒアリング項目を洗い出してください。`;
      break;

    case "check_missing_for_export":
      text = `【書類出力前の不足チェック】

ユーザーは「審査申請書・個人情報管理台帳・PMS文書」をこの後ボタンから出力する予定です。
出力前に、現在のDBで申請書類作成に支障が出る不足点を洗い出し、必要な確認だけユーザーに返してください。

${TEMPLATE_USAGE_RULES}

## Template Library
${templateBrief}

必ず次の順序で実行してください:
1. 現在のCompanyProfile（代表者、住所、設立、事業内容、従業員、拠点）を確認し、申請書（様式1系）出力に必要な項目で空欄/estimated/unconfirmed のものを列挙する。
2. PersonalDataRegister と BusinessProcess を見て、台帳出力に必要な「取得方法・利用目的・媒体・保管場所・保管期間・廃棄方法・委託先・第三者提供」のうち未確定の項目を洗い出す。
3. RiskAssessmentが業務×個人情報の各組に対して存在するか確認し、欠けている組を洗い出す。
4. テンプレート構成（templates/pmark/01_申請書, 02_PMS文書）に照らして、まだ作っていない必須PMS文書（個人情報保護方針、規程、教育/監査/マネジメントレビュー、体制図 等）を列挙する。
5. 上記で「人間に聞かないと確定できない最重要項目」だけを generate_questions で質問にする。公開情報や合理的推定で埋まる項目は report_company_profile / report_findings / report_detailed_findings で埋める。
6. 最後にエージェントメッセージで「申請書出力可、台帳出力可、PMS文書出力可」の○×と、残課題を箇条書きで報告する。

重要:
- ユーザーは出力ボタンを別途押す。このアクションでは export_registry を呼ばない。
- 既に埋まっている項目を質問し直さない。
- 出力可否を必ず短く判定して返すこと。`;
      break;

    case "autopilot_to_risk":
      text = `【自動運転モード: 台帳作成からリスク分析までやり切る】

ユーザーは、補助チャットではなく、AIが主体的にPMS整備を進めるMVPを確認したいです。
現在のDB状態を前提に、次を最後まで実行してください。

${TEMPLATE_USAGE_RULES}

## Template Library
${templateBrief}

1. 会社サイト、今回入力、既存DBを確認し、未登録の業務プロセスがあれば report_findings で追加する。
2. 各業務について、公開情報・業界知見・既存情報から個人情報取扱いを推定し、report_detailed_findings で台帳項目を埋める。
3. 確定できない項目は confidence: "estimated" または "unconfirmed" とする。作業を止めない。
4. 法令・Pマーク審査上、人間確認が必要な重要不明点だけ generate_questions で確認依頼にする。細かな穴埋め質問で止めない。
5. 台帳項目が1件以上ある業務について、report_risk_assessment を必ず呼ぶ。各リスクには target_info_name を入れ、どの個人情報に対するリスクか分かるようにする。
6. テンプレート構成に沿って、今回作るべき審査申請書、個人情報管理台帳、PMS文書一覧、規程、教育・監査・マネジメントレビュー文書、不足文書を洗い出す。
7. 最後に、何を自動調査し、何を推定し、何を人間確認待ちにし、どこまで書類作成準備が進んだかを短く報告する。

重要:
- Phase 2をユーザー対話待ちにしない。AIが合理的に推定して台帳を前へ進める。
- generate_questions は作業停止ではなくHuman Checkpointとして使う。質問を作った後も、可能な範囲でリスク分析まで進める。
- 帳票exportはユーザーが出力要求するまで呼ばない。まず台帳データ、リスク分析データ、必要文書リストをDBに揃える。
- 過去テンプレート内の会社固有情報を今回データに混ぜない。`;
      break;

    case "add_business_process":
      text = `ユーザーが業務を追加しました: ${message}\nこの業務について report_findings で報告してください。`;
      break;

    case "feedback":
      text = `ユーザーからのフィードバック: ${message}

${TEMPLATE_USAGE_RULES}

この情報を対象会社の今回データとして反映し、必要に応じて構造化データを更新してください。前回の続きであっても、現在のDB状態から不足工程を判断して業務フロー通りに進めてください。`;
      break;

    default:
      if (!message) {
        return NextResponse.json({ error: "message is required" }, { status: 400 });
      }
      text = message;
      break;
  }

  try {
    await unblockAndSendUserMessage(anthropicSessionId, text);
  } catch (e) {
    if (isWaitingForToolResultsError(e)) {
      console.error("[Message] Failed to send message after recovery:", e);
      return NextResponse.json(
        { error: "Agent is still finishing a previous tool action. Please try again in a few seconds." },
        { status: 409 }
      );
    }
    console.error("[Message] Failed to send message:", e);
    return NextResponse.json(
      { error: "Failed to send message to agent. Please try again." },
      { status: 502 }
    );
  }

  // DB状態更新
  const phaseMap: Record<string, string> = {
    start_basic_hearing: "phase0_company_profile",
    proceed_to_phase2: "phase2_deep_dive",
    proceed_to_phase3: "phase3_risk_pms",
    autopilot_to_risk: "phase3_risk_pms",
    check_missing_for_export: "phase4_export",
  };
  await prisma.agentSession.update({
    where: { id },
    data: {
      status: "running",
      ...(phaseMap[action ?? ""] ? { phase: phaseMap[action!] } : {}),
    },
  });

  // バックグラウンドでストリーム処理
  const { processStreamAfterMessage } = await import("@/lib/session-orchestrator");
  processStreamAfterMessage(id, session.companyId, anthropicSessionId).catch(err => {
    console.error("[Message Stream Error]", err);
  });

  return NextResponse.json({ status: "message_sent" });
}

async function ensureBasicProfileQuestions(sessionId: string, companyId: string) {
  const profile = await prisma.companyProfile.findUnique({ where: { companyId } });
  const questionSpecs = [
    {
      field: "representative",
      questionText: "代表者名を教えてください。",
      context: "基本情報ヒアリング: 様式1-①、個人情報保護体制、トップインタビュー準備に使います。",
      missing: !profile?.representative,
      priority: "critical",
    },
    {
      field: "address",
      questionText: "本社所在地を教えてください。複数拠点がある場合は主たる所在地を入力してください。",
      context: "基本情報ヒアリング: 申請書の会社情報、適用範囲、拠点管理に使います。",
      missing: !profile?.address,
      priority: "critical",
    },
    {
      field: "businessDescription",
      questionText: "主な事業内容を教えてください。個人情報を扱う業務の洗い出しにも使うため、主要サービスが分かる粒度でお願いします。",
      context: "基本情報ヒアリング: 取扱業務の洗い出し、様式4、個人情報管理台帳の前提に使います。",
      missing: !profile?.businessDescription,
      priority: "critical",
    },
    {
      field: "employees",
      questionText: "従業員数を教えてください。分かれば正社員・契約・パート・派遣の内訳も入力してください。",
      context: "基本情報ヒアリング: 教育計画、監査計画、体制図、申請書の従業員情報に使います。",
      missing: profile?.employeesTotal == null,
      priority: "important",
    },
    {
      field: "locations",
      questionText: "事業所・拠点を教えてください。本社のみの場合は本社のみで構いません。",
      context: "基本情報ヒアリング: PMSの適用範囲、現地審査、個人情報の保管場所確認に使います。",
      missing: !profile || JSON.parse(profile.locations || "[]").length === 0,
      priority: "important",
    },
    {
      field: "established",
      questionText: "設立年月日または設立年を教えてください。不明なら「不明」と入力してください。",
      context: "基本情報ヒアリング: 申請書の会社基本情報に使います。",
      missing: !profile?.established,
      priority: "nice_to_have",
    },
  ];

  for (const spec of questionSpecs) {
    if (!spec.missing) continue;
    const existing = await prisma.question.findFirst({
      where: {
        sessionId,
        status: "pending",
        relatedFields: JSON.stringify([spec.field]),
        context: { startsWith: "基本情報ヒアリング:" },
      },
    });
    if (existing) continue;
    await prisma.question.create({
      data: {
        sessionId,
        questionText: spec.questionText,
        questionType: "free_text",
        options: null,
        relatedProcess: null,
        relatedFields: JSON.stringify([spec.field]),
        priority: spec.priority,
        context: spec.context,
      },
    });
  }
}

async function buildBasicHearingPrompt(sessionId: string, companyId: string, templateBrief: string) {
  const session = await prisma.agentSession.findUnique({
    where: { id: sessionId },
    include: {
      company: { include: { companyProfile: true } },
    },
  });
  const profile = session?.company.companyProfile;
  const missing: string[] = [];
  if (!profile?.representative) missing.push("代表者名");
  if (!profile?.address) missing.push("本社所在地");
  if (!profile?.established) missing.push("設立年月日");
  if (!profile?.businessDescription) missing.push("事業内容");
  if (profile?.employeesTotal == null) missing.push("従業員数・雇用区分別人数");
  if (!profile || JSON.parse(profile.locations || "[]").length === 0) missing.push("事業所・拠点");

  return `【Pマーク申請フロー開始: 公開情報確認 → 基本情報ヒアリング】

ユーザーは、添付フローの通り「ホームページ等の顧客データ確認 → ヒアリング → 基本情報整理（会社・従業員）」から始めたいです。
前回セッションの続きであっても、この工程を最初のチェックポイントとして扱ってください。

対象会社:
- 会社名: ${session?.company.name ?? ""}
- Webサイト: ${session?.company.url ?? "未登録"}

現在不足している基本情報:
${missing.length > 0 ? missing.map(item => `- ${item}`).join("\n") : "- なし。公開情報との整合だけ確認してください。"}

${TEMPLATE_USAGE_RULES}

## Template Library
${templateBrief}

必ず次の順番で実行してください:
1. 対象会社Webサイトが登録されていれば、web_fetch / web_search で会社概要、事業内容、拠点、問い合わせフォーム、採用情報、取引/申込フォーム、プライバシーポリシーを確認する。
2. 公開情報で分かった会社基本情報は report_company_profile で保存する。確証があるものは confirmed、推定は estimated にする。
3. 公開情報で分からない項目、または審査申請書に使うため人間確認が必要な項目だけ generate_questions で質問にする。
4. generate_questions の related_process は空文字、related_fields は必ず representative/address/established/businessDescription/employees/locations のいずれかにする。employee_count、offices、privacy_manager など別名は使わない。
5. 基本情報の質問を作る場合、context は必ず「基本情報ヒアリング:」で始め、質問は「なぜ必要か」が分かる文脈を含める。

重要:
- いきなり固定質問を大量に出さない。まず公開情報を確認する。
- 公開情報で確認できた値は、質問だけで済ませず必ず report_company_profile で保存する。質問は保存後に不足項目だけ作る。
- ただし、最後は必ず report_company_profile または generate_questions の少なくとも一方を呼び、画面が更新される状態にする。
- テキストだけで「調査しました」と返して終わらない。`;
}

