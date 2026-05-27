/**
 * Managed Agent & Environment セットアップスクリプト
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/setup-agent.ts
 *
 * 実行すると Agent定義 と Environment を作成し、
 * .env に PMARK_AGENT_ID と PMARK_ENV_ID を書き込みます。
 */

import fs from "fs";
import path from "path";

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("ANTHROPIC_API_KEY が未設定です");
  process.exit(1);
}

const API_BASE = "https://api.anthropic.com/v1/beta";

const SYSTEM_PROMPT = `# あなたは「Pマーク取得支援エージェント」です

## ミッション
企業のPマーク（プライバシーマーク）新規取得を支援するため、
個人情報の取扱実態を調査し、PMS（個人情報保護マネジメントシステム）文書の
草案を作成します。

## 基本行動原則

### 1. 自分で調べられることは自分で調べる
- アップロードされたファイル（Excel, Word, PDF, テキスト）を徹底的に読む
- 企業のWebサイトをweb_fetchで確認する:
  - トップページ → 会社概要・事業内容の把握
  - プライバシーポリシー → 利用目的・第三者提供・Cookieの記載確認
  - 問い合わせフォーム → 収集している個人情報項目の確認
  - 採用ページ → 応募者個人情報の取扱い確認
  - 各サービスページ → 申込フォーム、会員登録フォームの有無確認
- web_searchで以下を調べる:
  - 企業名 + 「個人情報」「プライバシー」で関連情報
  - 利用しているSaaS（求人サービス、CRM等）の個人情報取扱い仕様
  - 業種固有のPマーク審査ポイント

### 2. 質問は最小限に、答えやすい形で
- 自分で判断できることを人間に聞かない
- 質問するときは「監査用語」ではなく「業務の言葉」で
- 悪い例: 「安全管理措置の物理的対策を教えてください」
- 良い例: 「オフィスに入るとき、ICカードや鍵は必要ですか？」
- 一度に5問以上投げない。3問が理想
- 選択肢を用意できる場合は必ず選択肢にする
- generate_questionsツールで質問を送信する

### 3. 確信度を常に明示する
すべての発見事項に以下のいずれかのラベルをつける:
- **confirmed**: 資料・Webサイトから直接確認できた
- **estimated**: 文脈・業種慣行から高い確度で推定できる
- **unconfirmed**: 推定はできるが確認が必要
- **insufficient_evidence**: 情報が不足しており推定もできない

### 4. 1回答→複数文書の波及を意識する
例えば「採用応募者の個人情報は選考終了後に削除する」という回答は、
- 個人情報管理台帳の「保管期間」列
- リスク分析の「採用活動」のリスク評価
- 安全管理規程の「保管期間に関する規定」
の3箇所に波及する。この関連を related_fields で明示する。

### 5. Phase移行の停止条件と再質問ルール

#### Phase 2 → Phase 3 への移行条件
以下の必須確認項目がすべて confirmed または estimated でなければ、Phase 3に進んではならない:
- 各業務プロセスの利用目的
- 個人情報の取得方法
- 第三者提供の有無と提供先
- 委託先の有無と委託内容
- 要配慮個人情報の取扱い有無

#### 再質問ルール
- 同一フィールドに対する質問は最大2回まで
- 2回聞いても不明な場合は insufficient_evidence に移行

## 作業フロー

### Phase 1: Discovery（ファイル読み込み + Web調査）
1. マウントされたファイルをすべて読み込む
2. 企業HPを調査する
3. 見つかった業務プロセスごとに report_findings を呼ぶ
4. 各業務プロセスに対して report_risk_assessment を呼ぶ

### Phase 2: Gap分析 + 質問生成
1. confidence が unconfirmed / insufficient_evidence の項目を集約
2. 必須確認項目チェック
3. 質問の優先度をつける
4. generate_questions で送信
5. 質問数は全体で15問以内を目標とする

### Phase 3: 文書ドラフト生成
1. 個人情報管理台帳（xlsx）を生成 → /mnt/session/outputs/ に書き出し
2. リスク分析シート（xlsx）を生成 → /mnt/session/outputs/ に書き出し
3. generate_document_draft で完了通知

## 禁止事項
- 根拠なく confidence: confirmed をつけない
- 業種や企業規模から「たぶんこうだろう」で重要項目を埋めない
- 20問以上の質問を一度に生成しない
- 審査用語で質問しない
- 必須確認項目が unconfirmed のままPhase 3に進んではならない
- 同一フィールドに対して3回以上質問してはならない
- evidence の detail を空にしたまま confirmed をつけてはならない`;

const CUSTOM_TOOLS = [
  {
    type: "custom",
    name: "report_findings",
    description: "業務プロセスから抽出した個人情報取扱いの発見事項をバックエンドに報告する。1つの業務プロセスにつき1回呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        business_process: {
          type: "object",
          properties: {
            name: { type: "string", description: "業務プロセス名" },
            department: { type: "string", description: "所管部署" },
            description: { type: "string", description: "業務概要" },
          },
          required: ["name", "department", "description"],
        },
        personal_info_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              data_category: { type: "string" },
              data_subjects: { type: "string" },
              purpose: { type: "string" },
              storage_location: { type: "string" },
              third_party_sharing: { type: "string" },
              retention_period: { type: "string" },
              acquisition_method: { type: "string" },
              disposal_method: { type: "string" },
              volume_estimate: { type: "string" },
              access_subjects: { type: "string" },
              confidence: { type: "string", enum: ["confirmed", "estimated", "unconfirmed", "insufficient_evidence"] },
              evidence: {
                type: "object",
                properties: {
                  source_type: { type: "string", enum: ["file", "web", "questionnaire"] },
                  source_ref: { type: "string" },
                  detail: { type: "string" },
                  captured_at: { type: "string" },
                },
                required: ["source_type", "source_ref"],
              },
            },
            required: ["data_category", "data_subjects", "purpose", "confidence"],
          },
        },
      },
      required: ["business_process", "personal_info_items"],
    },
  },
  {
    type: "custom",
    name: "report_risk_assessment",
    description: "特定した個人情報に対するリスク評価をバックエンドに報告する。",
    input_schema: {
      type: "object",
      properties: {
        business_process_name: { type: "string" },
        risks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              threat: { type: "string" },
              vulnerability: { type: "string" },
              likelihood: { type: "string", enum: ["high", "medium", "low"] },
              impact: { type: "string", enum: ["high", "medium", "low"] },
              current_measures: { type: "string" },
              recommended_measures: { type: "string" },
              confidence: { type: "string", enum: ["confirmed", "estimated", "unconfirmed", "insufficient_evidence"] },
              evidence: {
                type: "object",
                properties: {
                  source_type: { type: "string", enum: ["file", "web", "questionnaire"] },
                  source_ref: { type: "string" },
                  detail: { type: "string" },
                },
              },
            },
            required: ["threat", "vulnerability", "likelihood", "impact", "confidence"],
          },
        },
      },
      required: ["business_process_name", "risks"],
    },
  },
  {
    type: "custom",
    name: "generate_questions",
    description: "人間への確認が必要な質問をバックエンドに送信する。一度に3〜5問まで。",
    input_schema: {
      type: "object",
      properties: {
        context: { type: "string" },
        questions: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              question_text: { type: "string" },
              question_type: { type: "string", enum: ["single_choice", "multiple_choice", "yes_no", "free_text"] },
              options: { type: "array", items: { type: "string" } },
              related_process: { type: "string" },
              related_fields: { type: "array", items: { type: "string" } },
              priority: { type: "string", enum: ["critical", "important", "nice_to_have"] },
            },
            required: ["id", "question_text", "question_type", "related_process", "priority"],
          },
        },
      },
      required: ["context", "questions"],
    },
  },
  {
    type: "custom",
    name: "generate_document_draft",
    description: "台帳やリスク分析シートの草案を生成完了した際にバックエンドに通知する。",
    input_schema: {
      type: "object",
      properties: {
        document_type: { type: "string", enum: ["personal_info_registry", "risk_analysis", "business_process_list"] },
        file_path: { type: "string" },
        file_format: { type: "string", enum: ["xlsx", "docx", "csv"] },
        summary: { type: "string" },
        unconfirmed_count: { type: "integer" },
        total_fields: { type: "integer" },
      },
      required: ["document_type", "file_path", "file_format", "summary", "unconfirmed_count", "total_fields"],
    },
  },
];

async function apiCall(endpoint: string, body: unknown) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "x-api-key": API_KEY!,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "managed-agents-2025-04-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log("=== Managed Agent セットアップ開始 ===\n");

  // 1. Environment 作成
  console.log("1. Environment 作成中...");
  const env = await apiCall("/environments", {
    name: "pmark-agent-env",
    config: {
      type: "cloud",
      networking: { type: "unrestricted" },
    },
  });
  console.log(`   Environment ID: ${env.id}\n`);

  // 2. Agent 定義作成
  console.log("2. Agent 定義作成中...");
  const agent = await apiCall("/agents", {
    name: "pmark-discovery-agent",
    model: "claude-sonnet-4-6",
    system: SYSTEM_PROMPT,
    tools: [
      {
        type: "agent_toolset_20260401",
        default_config: {
          permission_policy: { type: "always_allow" },
        },
      },
      ...CUSTOM_TOOLS,
    ],
    skills: [
      { type: "anthropic", skill_id: "xlsx" },
      { type: "anthropic", skill_id: "docx" },
      { type: "anthropic", skill_id: "pdf" },
    ],
  });
  console.log(`   Agent ID: ${agent.id}\n`);

  // 3. .env に書き込み
  const envPath = path.resolve(__dirname, "../.env");
  let envContent = fs.readFileSync(envPath, "utf-8");
  envContent = envContent.replace(/^PMARK_AGENT_ID=.*$/m, `PMARK_AGENT_ID="${agent.id}"`);
  envContent = envContent.replace(/^PMARK_ENV_ID=.*$/m, `PMARK_ENV_ID="${env.id}"`);
  fs.writeFileSync(envPath, envContent);

  console.log("3. .env を更新しました\n");
  console.log("=== セットアップ完了 ===");
  console.log(`   PMARK_AGENT_ID=${agent.id}`);
  console.log(`   PMARK_ENV_ID=${env.id}`);
}

main().catch(err => {
  console.error("セットアップ失敗:", err.message);
  process.exit(1);
});
