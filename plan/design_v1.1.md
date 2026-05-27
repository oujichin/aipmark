# AIpmark MVP 詳細設計書
## Managed Agent ベース Pマーク取得支援エージェントシステム

> **Version**: 1.1 (2026-04-13)
> **変更履歴**:
> - v1.1: レビュー反映。DB正規化（エージェント出力フラット→バックエンドNormalizer方式）、
>   証跡の構造化（Evidence エンティティ + Webスナップショット保存）、
>   質問停止条件・再質問ルール追加、コスト3パターン化、セキュリティ対策強化
> - v1.0: 初版

---

## 1. MVP スコープ定義

### ゴール
「個人情報管理台帳」と「リスク分析シート」を、最小限の人間介入で完成させる。

### MVPで作るもの
1. **Discovery セッション**: 企業資料 + Web調査から業務プロセス・個人情報取扱いを自動抽出
2. **確認依頼生成**: 不足情報を「担当者が答えやすい質問」に変換して提示
3. **台帳・リスク分析ドラフト生成**: 回答をもとに文書を自動起案
4. **確認・確定UI**: 各項目の「確定/AI推定/未確認/根拠不足」ステータス管理

### MVPで作らないもの
- 安全管理規程・委託先管理票・教育計画の自動生成（Phase 2）
- 運用フェーズの変更検知（Phase 3）
- マルチエージェント・オーケストレーション（1エージェントで回す）
- 複数企業テナント管理（最初は1社PoC）

---

## 2. システムアーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  フロントエンド（Next.js）                                │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────────────┐  │
│  │ AI進捗    │ │ 確認依頼     │ │ 成果物ビュー          │  │
│  │ ダッシュ   │ │ チャットUI   │ │ 台帳/リスク分析閲覧   │  │
│  └──────────┘ └──────────────┘ └──────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │ REST + SSE
┌────────────────────▼────────────────────────────────────┐
│  バックエンド（Node.js / Python）                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ セッションオーケストレーター                        │   │
│  │ - Managed Agent セッション管理                     │   │
│  │ - SSEイベント受信・解釈・DB格納                     │   │
│  │ - custom tool コールバック処理                      │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ データレイヤー                                     │   │
│  │ - DynamoDB / PostgreSQL                           │   │
│  │ - S3（アップロードファイル、生成文書）                │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │ Anthropic API
┌────────────────────▼────────────────────────────────────┐
│  Claude Managed Agents                                   │
│  ┌────────────┐ ┌──────────┐ ┌────────────────────────┐ │
│  │ Agent定義   │ │ 環境設定  │ │ セッション              │ │
│  │ system     │ │ network: │ │ - ファイルマウント       │ │
│  │ skills     │ │  unrestr. │ │ - SSEストリーム         │ │
│  │ tools      │ │          │ │ - custom tool呼出       │ │
│  └────────────┘ └──────────┘ └────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 責務分担の原則

| 責務 | 担当 | 理由 |
|------|------|------|
| ファイル読解・情報抽出 | Managed Agent | サンドボックス内でExcel/Word/PDFを安全に処理 |
| Web調査（HP・フォーム・プライバシーポリシー） | Managed Agent | web_search + web_fetch で自律取得 |
| ギャップ分析・質問生成 | Managed Agent | PMS知識をsystem promptとskillで制御 |
| 台帳・リスク分析の草案作成 | Managed Agent | xlsx/docxスキルでファイル生成 |
| 企業テナント・進捗管理 | 自前バックエンド | プロダクトの基幹データ |
| findings の名寄せ・正規化 | 自前バックエンド（Normalizer） | エージェント出力はフラット、正規化はコード側の責務 |
| 文書バージョン管理 | 自前バックエンド | 承認履歴・差分管理はプロダクト資産 |
| 各フィールドの確定ステータス | 自前バックエンド | 監査対応の根幹 |
| confirmed のバリデーション | 自前バックエンド | Evidence紐づけ必須チェック |
| 証跡（Evidence）管理 | 自前バックエンド | フィールド単位の根拠保全、Webスナップショット保存 |
| フィールド変更履歴 | 自前バックエンド（FieldChangeLog） | 「誰がいつ何を変えたか」の監査証跡 |
| Web監査ログ | 自前バックエンド | エージェントのアクセス先記録 |
| 再質問カウント管理 | 自前バックエンド | 同一フィールド最大2回ルールの強制 |
| 確認依頼の提示・回答受付 | 自前バックエンド → Agent | custom toolで双方向連携 |

---

## 3. Managed Agent 設計

### 3.1 Agent 定義

```json
{
  "name": "pmark-discovery-agent",
  "model": "claude-sonnet-4-6",
  "system": "<SYSTEM_PROMPT は下記参照>",
  "tools": [
    {
      "type": "agent_toolset_20260401",
      "default_config": {
        "permission_policy": { "type": "always_allow" }
      }
    },
    {
      "type": "custom",
      "name": "report_findings",
      "description": "業務プロセスから抽出した個人情報取扱いの発見事項をバックエンドに報告する。1つの業務プロセスにつき1回呼ぶ。呼ぶと自前DBに構造化データとして格納される。",
      "input_schema": {
        "type": "object",
        "properties": {
          "business_process": {
            "type": "object",
            "properties": {
              "name": { "type": "string", "description": "業務プロセス名（例: 顧客情報管理）" },
              "department": { "type": "string", "description": "所管部署" },
              "description": { "type": "string", "description": "業務概要" }
            },
            "required": ["name", "department", "description"]
          },
          "personal_info_items": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "data_category": { "type": "string", "description": "個人情報の種類（例: 氏名、メールアドレス、履歴書）" },
                "data_subjects": { "type": "string", "description": "データ主体（例: 顧客、従業員、応募者）" },
                "purpose": { "type": "string", "description": "利用目的" },
                "storage_location": { "type": "string", "description": "保管場所（例: CRM, Google Drive, 紙）" },
                "third_party_sharing": { "type": "string", "description": "第三者提供の有無と相手先" },
                "retention_period": { "type": "string", "description": "保管期間" },
                "confidence": {
                  "type": "string",
                  "enum": ["confirmed", "estimated", "unconfirmed", "insufficient_evidence"],
                  "description": "確信度。confirmed=資料から確認済み, estimated=文脈から推定, unconfirmed=未確認（要質問）, insufficient_evidence=根拠不足"
                },
                "evidence": {
                  "type": "object",
                  "description": "根拠情報。confirmedの場合は必須。",
                  "properties": {
                    "source_type": {
                      "type": "string",
                      "enum": ["file", "web", "questionnaire"],
                      "description": "根拠の種類"
                    },
                    "source_ref": {
                      "type": "string",
                      "description": "ファイル名またはURL"
                    },
                    "detail": {
                      "type": "string",
                      "description": "該当箇所の説明（例: 3ページ目「退職者の個人情報は退職後5年間保管する」、フォームのname属性一覧）"
                    },
                    "captured_at": {
                      "type": "string",
                      "description": "情報取得日時（ISO 8601形式）"
                    }
                  },
                  "required": ["source_type", "source_ref"]
                }
              },
              "required": ["data_category", "data_subjects", "purpose", "confidence"]
            }
          }
        },
        "required": ["business_process", "personal_info_items"]
      }
    },
    {
      "type": "custom",
      "name": "report_risk_assessment",
      "description": "特定した個人情報に対するリスク評価をバックエンドに報告する。report_findingsで報告した業務プロセスに紐づくリスクを評価する。",
      "input_schema": {
        "type": "object",
        "properties": {
          "business_process_name": { "type": "string" },
          "risks": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "threat": { "type": "string", "description": "脅威（例: 不正アクセス、誤送信、紛失）" },
                "vulnerability": { "type": "string", "description": "脆弱性（例: パスワード管理不備、暗号化未実施）" },
                "likelihood": { "type": "string", "enum": ["high", "medium", "low"] },
                "impact": { "type": "string", "enum": ["high", "medium", "low"] },
                "current_measures": { "type": "string", "description": "現在の対策（判明している場合）" },
                "recommended_measures": { "type": "string", "description": "推奨追加対策" },
                "confidence": {
                  "type": "string",
                  "enum": ["confirmed", "estimated", "unconfirmed", "insufficient_evidence"]
                },
                "evidence": {
                  "type": "object",
                  "properties": {
                    "source_type": { "type": "string", "enum": ["file", "web", "questionnaire"] },
                    "source_ref": { "type": "string" },
                    "detail": { "type": "string" }
                  }
                }
              },
              "required": ["threat", "vulnerability", "likelihood", "impact", "confidence"]
            }
          }
        },
        "required": ["business_process_name", "risks"]
      }
    },
    {
      "type": "custom",
      "name": "generate_questions",
      "description": "人間への確認が必要な質問をバックエンドに送信する。質問は担当者が答えやすい平易な言葉で書き、可能な限り選択肢形式にする。一度に3〜5問まで。",
      "input_schema": {
        "type": "object",
        "properties": {
          "context": { "type": "string", "description": "この質問群の背景説明（担当者向け）" },
          "questions": {
            "type": "array",
            "maxItems": 5,
            "items": {
              "type": "object",
              "properties": {
                "id": { "type": "string", "description": "質問ID（例: q_recruit_retention）" },
                "question_text": { "type": "string", "description": "質問文。監査用語ではなく業務担当者が理解できる言葉で書く" },
                "question_type": {
                  "type": "string",
                  "enum": ["single_choice", "multiple_choice", "yes_no", "free_text"],
                  "description": "回答形式"
                },
                "options": {
                  "type": "array",
                  "items": { "type": "string" },
                  "description": "選択肢（single_choice/multiple_choiceの場合必須）"
                },
                "related_process": { "type": "string", "description": "関連する業務プロセス名" },
                "related_fields": {
                  "type": "array",
                  "items": { "type": "string" },
                  "description": "この回答が埋める台帳フィールド名のリスト（1回答→複数文書波及を実現）"
                },
                "priority": { "type": "string", "enum": ["critical", "important", "nice_to_have"] }
              },
              "required": ["id", "question_text", "question_type", "related_process", "priority"]
            }
          }
        },
        "required": ["context", "questions"]
      }
    },
    {
      "type": "custom",
      "name": "generate_document_draft",
      "description": "台帳やリスク分析シートの草案を生成完了した際にバックエンドに通知する。実際のファイルはManaged Agentのサンドボックス内の /mnt/session/outputs/ に書き出す。",
      "input_schema": {
        "type": "object",
        "properties": {
          "document_type": {
            "type": "string",
            "enum": ["personal_info_registry", "risk_analysis", "business_process_list"],
            "description": "文書種類"
          },
          "file_path": { "type": "string", "description": "サンドボックス内のファイルパス" },
          "file_format": { "type": "string", "enum": ["xlsx", "docx", "csv"] },
          "summary": { "type": "string", "description": "文書の概要（何が含まれ、何が未確定か）" },
          "unconfirmed_count": { "type": "integer", "description": "未確定フィールド数" },
          "total_fields": { "type": "integer", "description": "総フィールド数" }
        },
        "required": ["document_type", "file_path", "file_format", "summary", "unconfirmed_count", "total_fields"]
      }
    }
  ],
  "skills": [
    { "type": "anthropic", "skill_id": "xlsx" },
    { "type": "anthropic", "skill_id": "docx" },
    { "type": "anthropic", "skill_id": "pdf" },
    { "type": "custom", "skill_id": "skill_pmark_knowledge", "version": "latest" }
  ]
}
```

### 3.2 System Prompt（claude.md相当）

```markdown
# あなたは「Pマーク取得支援エージェント」です

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
以下の **必須確認項目** がすべて confirmed または estimated でなければ、
Phase 3（ドラフト生成）に進んではならない:
- 各業務プロセスの **利用目的**（台帳の必須カラム、本人同意の根拠に直結）
- 個人情報の **取得方法**（同意取得手段の確認に必須）
- **第三者提供の有無と提供先**（提供がある場合、本人同意または法的根拠が必要）
- **委託先の有無と委託内容**（委託先管理義務の発生条件）
- **要配慮個人情報の取扱い有無**（取り扱う場合、追加の安全管理措置が必要）

上記が unconfirmed のまま残っている場合は、追加質問を生成してから再度判定する。

#### estimated のまま草案に含めてよい項目
- 保管期間（業種慣行から推定可能な場合）
- アクセス権者の範囲（部署単位の推定は許容）
- 廃棄方法（一般的な方法の推定は許容）
- 件数規模（概算の推定は許容）

#### 再質問ルール
- 同一フィールドに対する質問は **最大2回** まで
- 1回目の回答が曖昧な場合、2回目はより具体的な選択肢を提示する
- 2回聞いても明確な回答が得られない場合は **insufficient_evidence** フラグを立て、
  ドラフトに「【要確認】」マーク付きで含める
- insufficient_evidence の項目は generate_questions の代わりに、
  ドラフト文書内にコメントとして「この項目は担当者確認が必要です。
  理由: ○○」を記載し、人間によるエスカレーション対象とする

## 作業フロー

### Phase 1: Discovery（ファイル読み込み + Web調査）
1. マウントされたファイルをすべて読み込む
2. 企業HPを調査する（プライバシーポリシー、フォーム、採用ページ等）
3. 見つかった業務プロセスごとに report_findings を呼ぶ
4. 各業務プロセスに対して report_risk_assessment を呼ぶ

### Phase 2: Gap分析 + 質問生成
1. confidence が unconfirmed / insufficient_evidence の項目を集約
2. **必須確認項目チェック**: 利用目的、取得方法、第三者提供、委託先、要配慮個人情報
   - 必須確認項目が unconfirmed なら、必ず質問を生成する
3. 質問の優先度をつける:
   - critical: 必須確認項目で根拠がない
   - important: リスク分析に影響するが推定可能
   - nice_to_have: あると精度が上がるが後回し可能
4. critical + important だけを generate_questions で送信
5. 質問数は全体で15問以内を目標とする
6. **再質問判定**: 回答が返ってきた後、必須確認項目がまだ unconfirmed なら
   再質問を生成（同一フィールド最大2回まで）。2回超はinsufficient_evidenceに移行

### Phase 3: 文書ドラフト生成
1. 個人情報管理台帳（xlsx）を生成 → /mnt/session/outputs/ に書き出し
2. リスク分析シート（xlsx）を生成 → /mnt/session/outputs/ に書き出し
3. generate_document_draft で完了通知

## 個人情報管理台帳のスキーマ
台帳は以下のカラム構成で作成する:

| カラム | 説明 | 例 |
|--------|------|-----|
| 業務プロセス | 個人情報を取り扱う業務 | 顧客情報管理 |
| 個人情報の種類 | 取り扱うデータ項目 | 氏名、住所、電話番号、メールアドレス |
| データ主体 | 誰の個人情報か | 顧客 |
| 件数規模 | おおよその件数 | 約5,000件 |
| 利用目的 | なぜ収集するか | 商品の発送、アフターサービス |
| 取得方法 | どう取得するか | 申込フォーム、名刺交換 |
| 保管場所 | どこに保管するか | CRM（Salesforce）、社内ファイルサーバー |
| アクセス権者 | 誰がアクセスできるか | 営業部全員、システム管理者 |
| 保管期間 | いつまで保管するか | 取引終了後5年 |
| 廃棄方法 | どう廃棄するか | システムから削除、紙はシュレッダー |
| 第三者提供 | 外部に提供するか | 配送業者に氏名・住所を提供 |
| 委託先 | 処理を委託しているか | ○○データセンター（サーバー運用） |
| 確信度 | confirmed/estimated/unconfirmed/insufficient_evidence | |
| 根拠種別 | file/web/questionnaire | |
| 根拠参照 | 確認に使った資料名またはURL | 就業規則.docx / https://example.com/privacy |
| 根拠詳細 | 該当箇所の具体的な記載 | 3ページ目「退職後5年間保管する」 |
| 根拠取得日時 | 情報を取得した日時 | 2026-04-13T10:30:00Z |

## リスク分析シートのスキーマ

| カラム | 説明 |
|--------|------|
| 業務プロセス | 対象の業務 |
| 個人情報の種類 | 対象のデータ |
| 脅威 | 何が起きうるか |
| 脆弱性 | なぜ起きうるか |
| 発生可能性 | high / medium / low |
| 影響度 | high / medium / low |
| リスク値 | 発生可能性 × 影響度 |
| 現状の対策 | 既に実施している対策 |
| 残留リスク | 対策後の評価 |
| 追加対策（推奨） | エージェントが推奨する対策 |
| 確信度 | confirmed/estimated/unconfirmed/insufficient_evidence |
| 根拠種別 | file/web/questionnaire |
| 根拠参照 | 確認に使った資料名またはURL |
| 根拠詳細 | 該当箇所の具体的な記載 |

## Web調査の具体的手順

### プライバシーポリシーの確認ポイント
- 利用目的の記載は具体的か（「事業活動のため」のような曖昧な記載はNG）
- 第三者提供に関する記載があるか
- 開示等の請求手続きが記載されているか
- Cookie・アクセスログに関する記載があるか
- 問い合わせ窓口が明記されているか

### フォームの確認ポイント
- どの個人情報項目を収集しているか（name属性やlabel要素を確認）
- 必須/任意の区分があるか
- SSL/TLS暗号化されているか（URLがhttps://か）
- 同意チェックボックスがあるか
- プライバシーポリシーへのリンクがあるか

### 採用ページの確認ポイント
- 応募フォームで収集する情報（履歴書、職務経歴書、写真等）
- 応募者データの取扱いに関する記載
- 利用している求人プラットフォーム

## 禁止事項
- 根拠なく confidence: confirmed をつけない
- 業種や企業規模から「たぶんこうだろう」で重要項目を埋めない（estimatedでフラグを立てる）
- 20問以上の質問を一度に生成しない
- 「安全管理措置」「組織的対策」「技術的対策」のような審査用語で質問しない
- **必須確認項目（利用目的、取得方法、第三者提供、委託先、要配慮個人情報）が
  unconfirmed のままPhase 3に進んではならない**
- 同一フィールドに対して3回以上質問してはならない（2回聞いて不明ならinsufficient_evidence）
- evidence の detail を空にしたまま confirmed をつけてはならない
```

### 3.3 Custom Skill: `pmark_knowledge`

```
pmark-knowledge-skill/
├── SKILL.md
├── REQUIREMENTS.md          # JIS Q 15001 要求事項の要約
├── AUDIT_CHECKLIST.md        # 審査で頻出する指摘事項リスト
├── TEMPLATES/
│   ├── registry_template.md  # 個人情報管理台帳のテンプレート説明
│   └── risk_template.md      # リスク分析シートのテンプレート説明
└── scripts/
    └── validate_registry.py  # 台帳の整合性チェックスクリプト
```

#### SKILL.md

```yaml
---
name: pmark-knowledge
description: >
  Pマーク（プライバシーマーク）取得支援のための専門知識スキル。
  JIS Q 15001の要求事項、審査での頻出指摘事項、PMS文書テンプレートの
  構造と記載ルールを提供する。個人情報管理台帳やリスク分析シートを
  作成・検証する際に使用する。
---

# Pマーク専門知識スキル

## このスキルの使い方
- 台帳やリスク分析を作成する前に、REQUIREMENTS.md で要件を確認する
- 草案完成後に scripts/validate_registry.py で整合性チェックを行う
- 質問生成時に AUDIT_CHECKLIST.md で「審査で聞かれやすいポイント」を参照する

## 重要な審査観点
Pマーク審査では以下が特に重要:
1. 個人情報の特定が網羅的か（漏れがないか）
2. 利用目的が具体的か（曖昧な表現はNG）
3. リスク分析が形骸化していないか（実態に即しているか）
4. 台帳とリスク分析の整合性（台帳にある情報がリスク分析でもカバーされているか）
5. 委託先の管理が適切か

## テンプレートの使い方
TEMPLATES/ 配下にテンプレート説明がある。
xlsx スキルと組み合わせて実際のExcelファイルを生成すること。

## 検証スクリプト
`python scripts/validate_registry.py <台帳ファイルパス> <リスク分析ファイルパス>`
- 台帳に記載されたすべての業務プロセスがリスク分析にも存在するか
- 確信度が unconfirmed / insufficient_evidence の項目がないか
- 利用目的が空白の行がないか
を検証し、結果をJSON形式で返す。
```

#### REQUIREMENTS.md（抜粋）

```markdown
# JIS Q 15001 主要要求事項（Pマーク審査対応）

## 個人情報の特定（A.3.3.1）
組織が取り扱う個人情報を特定しなければならない。
- 業務プロセスごとに、取り扱う個人情報を洗い出す
- 個人情報の種類、データ主体、件数、利用目的を明確にする
- 台帳として文書化する

### よくある不備
- 「社内の業務で使う情報」のような曖昧な特定
- Webサイトから取得するCookie・IPアドレスの見落とし
- 採用応募者、退職者の情報の見落とし
- 委託先から預かる個人情報の見落とし

## リスクの認識、分析及び対策（A.3.3.3）
特定した個人情報について、漏えい・滅失・き損のリスクを分析する。
- 脅威（何が起きうるか）と脆弱性（なぜ起きうるか）を対で評価
- 発生可能性と影響度からリスク値を算出
- 現状の対策で残留リスクが受容可能か評価

### よくある不備
- すべてのリスクが「中」になっている（実態を反映していない）
- 対策が「注意する」「気をつける」のような曖昧な記載
- 電子データのリスクだけで紙媒体のリスクが抜けている

## 利用目的の特定（A.3.4.2.1）
個人情報の利用目的をできる限り具体的に特定する。
- 「事業活動のため」はNG → 「商品の発送および配送状況のご連絡のため」
- 本人に通知または公表する利用目的と台帳の記載が一致すること

（以下、委託先管理、教育、内部監査等の要件が続く）

## 必須確認項目（confirmed 必須、estimated 不可）
以下の項目は台帳の根幹であり、estimatedのまま草案を完成させてはならない。
Agentは必ずこれらについて confirmed 根拠を取得するか、
unconfirmed として質問を生成しなければならない。

1. **各業務プロセスの利用目的** - 本人同意の根拠に直結。プライバシーポリシーの
   記載と台帳の記載が一致していなければならない。
2. **個人情報の取得方法** - 同意取得手段（フォーム、書面、口頭）の確認に必須。
3. **第三者提供の有無と提供先** - 提供がある場合、本人同意または法的根拠が必要。
4. **委託先の有無と委託内容** - 委託先管理義務の発生条件。
5. **要配慮個人情報の取扱い有無** - 病歴、犯罪歴、信条等。取り扱う場合は
   追加の安全管理措置と本人の明示的同意が必要。

## estimated のまま草案に含めてよい項目
- 保管期間（業種慣行から推定可能な場合。例: 税法上の保管義務7年）
- アクセス権者の範囲（部署単位の推定は許容。例: 「営業部」）
- 廃棄方法（一般的な方法の推定は許容。例: 「システムから削除」）
- 件数規模（概算の推定は許容。例: 「約1,000件」）
- 保管場所の詳細（「クラウドサービス」レベルの推定は許容）

## 再質問ルール
- 同一フィールドに対する質問は最大2回まで
- 2回聞いても不明な場合は insufficient_evidence に移行し、
  ドラフト文書に「【要確認】」マーク付きで含める
- insufficient_evidence の項目はコンサルタントによるエスカレーション対象
```

### 3.4 Environment 設定

```json
{
  "name": "pmark-agent-env",
  "config": {
    "type": "cloud",
    "networking": { "type": "unrestricted" }
  }
}
```

networking を `unrestricted` にする理由:
- 企業HPへのweb_fetch（プライバシーポリシー、フォーム確認）
- web_search（企業情報、SaaS仕様、業界情報の調査）
が必須なため。

---

## 4. セッションワークフロー

### 4.1 全体フロー

```
ユーザーがファイルアップロード + 企業HP URLを入力
        │
        ▼
[バックエンド] Files APIでファイルをアップロード
        │
        ▼
[バックエンド] セッション作成（ファイルをresourcesとしてマウント）
        │
        ▼
[バックエンド] user.message イベント送信:
  「以下の企業の個人情報取扱い実態を調査してください。
    企業HP: https://example.co.jp
    アップロードファイルは /workspace/ にマウント済みです。
    Phase 1 → Phase 2 → Phase 3 の順で進めてください。」
        │
        ▼
[Managed Agent] Phase 1: Discovery
  ├── ファイル読み込み（bash + read ツール）
  ├── web_fetch: 企業HP各ページ確認
  ├── web_search: 企業名 + 関連情報
  ├── report_findings × N回（custom tool → バックエンドへ）
  └── report_risk_assessment × N回（custom tool → バックエンドへ）
        │
        ▼
[Managed Agent] Phase 2: Gap分析 + 質問生成
  ├── unconfirmed / insufficient_evidence を集約
  ├── generate_questions（custom tool → バックエンドへ）
  └── session.status_idle（質問回答待ち）
        │
        ▼
[バックエンド] 質問をフロントエンドに表示
[ユーザー] 質問に回答
        │
        ▼
[バックエンド] user.message イベント送信:
  「担当者から以下の回答を得ました:
    Q: 履歴書は選考終了後に削除しますか？
    A: 選考終了後3ヶ月で削除する
    Q: オフィスへの入退室はICカードで管理されていますか？
    A: はい、全員ICカード必須
    ...
    この回答を反映してPhase 3に進んでください。」
        │
        ▼
[Managed Agent] Phase 3: 文書ドラフト生成
  ├── 回答を反映してfindingsを更新
  ├── xlsx スキルで個人情報管理台帳を生成
  ├── xlsx スキルでリスク分析シートを生成
  ├── validate_registry.py で整合性チェック
  ├── generate_document_draft × 2回（custom tool）
  └── session.status_idle
        │
        ▼
[バックエンド] /mnt/session/outputs/ からファイルをダウンロード
[バックエンド] S3に保存、DBにメタデータ格納
[フロントエンド] 成果物ビューに表示
```

### 4.2 セッション作成の実装

```typescript
// 1. ファイルアップロード
const uploadedFiles = await Promise.all(
  customerFiles.map(file =>
    anthropic.beta.files.upload({
      file: fs.createReadStream(file.path),
      purpose: "agent",
    })
  )
);

// 2. セッション作成（ファイルをマウント）
const session = await anthropic.beta.sessions.create({
  agent: PMARK_AGENT_ID,
  environment_id: PMARK_ENV_ID,
  title: `${companyName} - Pマーク調査`,
  resources: uploadedFiles.map((f, i) => ({
    type: "file",
    file_id: f.id,
    mount_path: `/workspace/${customerFiles[i].name}`,
  })),
});

// 3. 初回メッセージ送信
await anthropic.beta.sessions.events.create(session.id, {
  events: [{
    type: "user.message",
    content: [{
      type: "text",
      text: buildInitialPrompt(companyName, companyUrl, fileList),
    }],
  }],
});

// 4. SSEストリーム受信
const stream = await anthropic.beta.sessions.events.stream(session.id);
for await (const event of stream) {
  switch (event.type) {
    case "agent.tool_use":
      if (event.name === "report_findings") {
        await db.saveFindings(session.id, event.input);
        // custom tool なのでバックエンドが結果を返す
        await anthropic.beta.sessions.events.create(session.id, {
          events: [{
            type: "tool_result",
            tool_use_id: event.id,
            content: [{ type: "text", text: "保存完了。次の業務プロセスを調査してください。" }],
          }],
        });
      }
      if (event.name === "generate_questions") {
        await db.saveQuestions(session.id, event.input);
        // 質問を保存し、ユーザーに提示待ちにする
        await anthropic.beta.sessions.events.create(session.id, {
          events: [{
            type: "tool_result",
            tool_use_id: event.id,
            content: [{ type: "text", text: "質問を担当者に送信しました。回答を待っています。" }],
          }],
        });
      }
      // ... 他のcustom toolも同様
      break;
    case "session.status_idle":
      await handleSessionIdle(session.id);
      break;
  }
}
```

### 4.3 初回プロンプトのテンプレート

```typescript
function buildInitialPrompt(
  companyName: string,
  companyUrl: string,
  files: { name: string; description: string }[]
): string {
  return `
## 調査対象企業
- 企業名: ${companyName}
- 企業HP: ${companyUrl}

## アップロードされたファイル
${files.map(f => `- /workspace/${f.name}（${f.description}）`).join("\n")}

## 作業指示
上記の企業について、Pマーク取得に必要な個人情報取扱い実態の調査を開始してください。

### Step 1: ファイルの読み込み
/workspace/ 配下のすべてのファイルを読み込み、
個人情報の取扱いに関連する記載を抽出してください。

### Step 2: Webサイトの調査
まず ${companyUrl} のトップページを読み込み、事業概要を把握してください。
次にトップページ上のリンクをたどって以下のページを探してください:
- プライバシーポリシー
- 問い合わせフォーム
- 採用ページ
- サービスページ（申込フォーム等）
- Cookie設定・バナーの有無

**重要: URLを推測しないこと。必ずトップページのリンクから辿ること。リンクが見つからない場合は web_search を使用すること。**

また web_search で「${companyName} 個人情報」「${companyName} プライバシー」等を
検索し、外部から把握できる情報も収集してください。

### Step 3: 発見事項の報告
業務プロセスごとに report_findings ツールで報告し、
続けて report_risk_assessment でリスク評価を報告してください。

### Step 4: 質問生成
確認が必要な項目について generate_questions で質問を生成してください。
質問は critical → important の優先度順で、合計15問以内を目標としてくださã 1〜2 が完了したら、一度止まって回答を待ってください。
  `.trim();
}
```

---

## 5. データモデル（自前バックエンド）

### 設計方針: エージェント出力はフラット、バックエンドで正規化

エージェントの report_findings は業務プロセス単位でフラットなJSONを出力する。
これをそのまま保存するのではなく、バックエンドの **Normalizer** が受け取り、
以下の正規化されたエンティティã

エージェントに正規化を要求しない理由:
- エージェントに「既存レコードIDを参照しろ」と言うと出力精度が落ちる
- 名寄せロジック（"メールアドレス" = "Eメール" = "email"）はコード側で制御すべき
- custom tool のスキーマをシンプルに保つことでエージェントの安定性を確保する

### エンティティ関連図

```
Company (企業)
│
├── BusinessProcess (業務プロセス)
│     PK: bp_id
│    ent, description
│     created_by_session, created_at
│
├── PersonalInfoItem (個人情報項目) ← 名寄せされた実体
│     PK: pii_id
│     canonical_name: "メールアドレス"  ← 正規化名
│     aliases: ["Eメール", "email", "メアド"]
│     is_sensitive: boolean (要配慮個人情報フラグ)
│
├── DataSubject (データ主体)
│     PK: ds_id
│     name: "顧客" | "従業員" | "応募者" | "取引先担当者" | ...
│
├── StorageLocation (場所)
│     PK: sl_id
│     name: "Salesforce CRM"
│     type: "cloud_saas" | "on_premise" | "paper" | "external_service"
│
├── ThirdParty (第三者提供先・委託先)
│     PK: tp_id
│     name, role: "third_party" | "subcontractor"
│     contract_status: "confirmed" | "unconfirmed"
│
├─── BusinessProcess_PII (業務×個人情報 リレーション) ← 核テーブル
│     PK: bp_pii_id
│     FK: bp_id, pii_id, ds_id
│     purpose: "商品の発送およびアãスのため"
│     acquisition_method: "申込フォーム"
│     storage_location_id: FK → StorageLocation
│     access_subjects: ["営業部", "システム管理者"]
│     retention_period: "取引終了後5年"
│     disposal_method: "システムから削除"
│     third_party_ids: [FK → ThirdParty]
│     volume_estimate: "約5,000件"
│     ┌── フィールド単位の状態管理 ──────────────────┐
│     │ purpose_status:    cod | estimated | ... │
│     │ retention_status:  confirmed | estimated | ... │
│     │ storage_status:    confirmed | estimated | ... │
│     │ ... (各フィールドに _status サフィックス)       │
│     └───────────────────────────────────────────────┘
│
├── Evidence (証跡) ← フィールド単位で紐づく
│     PK: ev_id
│     FK: bp_pii_id (またはrisk_id)
│     target_field: "retention_period"  ← どのフィールドの根拠か
│     source_type: "file" | "web" | "questionnaire"
│     source_ref: "就業規則.docx"
│     detail: "3ページ目「退職者の個人情報は退職後5年間保管する」"
│     captured_at: timestamp
│     snapshot_s3_key: "evidence/web/2026-04-13/example.com_privacy.html"
│     created_by: "agent" | "human"
│
├── RiskAssessment (リスク評価)
│     PK: risk_id
│     FK: bp_pii_id
│     thrulnerability
│     likelihood: high | medium | low
│     impact: high | medium | low
│     risk_score: computed
│     current_measures, recommended_measures
│     confidence: enum
│     evidence_ids: [FK → Evidence]
│
├── Question (確認依頼)
│     PK: q_id
│     FK: session_id
│     question_text, question_type, options
│     related_bp_pii_ids: [FK → BusinessProcess_PII]
│     related_fields: ["retention_period", "disposal_method"]
│     priority: critical | importanhave
│     status: pending | answered | skipped | escalated
│     answer: string
│     answered_at: timestamp
│     answered_by: string
│     ask_count: integer  ← 同一フィールドへの質問回数（再質問制御用）
│
├── Document (生成文書)
│     PK: doc_id
│     type: personal_info_registry | risk_analysis
│     version: integer
│     s3_key: string
│     generated_at: timestamp
│     confirmed_count, estimated_count, unconfirmed_count, total_fields
│     oved_by: string (null = 未承認)
│     approved_at: timestamp
│
├── FieldChangeLog (フィールド変更履歴)
│     PK: log_id
│     FK: bp_pii_id
│     field_name: "retention_period"
│     old_value, new_value
│     old_status, new_status
│     changed_by: "agent" | "human:田中花子"
│     changed_at: timestamp
│     trigger: "discovery" | "question_answer" | "manual_edit" | "re_discovery"
│
└── AgentSession (エージェントセッション)
      PK: session_id
thropic_session_id: string
      status: running | idle | waiting_for_answers | completed
      phase: discovery | gap_analysis | drafting | review
      web_access_log: [{ url, method, timestamp }]  ← 監査ログ
```

### Normalizer の処理フロー

```
report_findings 受信
    │
    ▼
[1] BusinessProcess の upsert（name + department で一意判定）
    │
    ▼
[2] 各 personal_info_item について:
    ├── PersonalInfoItem の名寄せ（canonical_name マッチング）
    â¥なら新規作成、既知なら既存IDを使用
    ├── DataSubject の名寄せ
    ├── StorageLocation の名寄せ
    ├── ThirdParty の名寄せ
    │
    ▼
[3] BusinessProcess_PII リレーション作成
    ├── 各フィールドに _status を設定（agent の confidence をマッピング）
    │
    ▼
[4] Evidence レコード作成
    ├── agent の evidence オブジェクトから生成
    ├── source_type == "web" の場合、S3にスナッã ▼
[5] FieldChangeLog に初回登録を記録
```

### Web証跡のスナップショット保存

SSEストリームで `agent.tool_use` の `web_fetch` を検知した際、
バックエンドが以下を自動保存する:

```typescript
// SSEハンドラ内
if (event.type === "agent.tool_use" && event.name === "web_fetch") {
  const url = event.input.url;
  // web_fetchの結果がtool_resultとして返ってきた時点でS3に保存
  await s3.putObject({
    Bucket: EVIDENCE_BUCKET,
    Key: `ce/web/${sessionId}/${Date.now()}_${encodeURIComponent(url)}.html`,
    Body: toolResultContent,
    Metadata: { url, captured_at: new Date().toISOString(), session_id: sessionId }
  });
  // 監査ログにも記録
  await db.appendWebAccessLog(sessionId, { url, method: "web_fetch", timestamp: new Date() });
}
```

### フィールドの4状態管理

BusinessProcess_PII の各フィールドは以下の状態を持つ:

| 状態 | 意味 | UIでの表示 | 操作 |
|------|------|-----------|------|
| co| 資料から確認済み（Evidence必須） | ✅ 緑 | 根拠リンク表示 |
| estimated | AI推定（Evidence任意） | 🔶 黄 | 「確定する」ボタン |
| unconfirmed | 要確認（質問生成済み） | ❓ 赤 | 確認質問へリンク |
| insufficient_evidence | 根拠不足（再質問上限到達） | ⚠️ グレー | 追加資料アップロード or 手動入力 |

**confirmed の要件**: Evidence テーブルに `source_type` + `source_ref` + `detail` が
すべて埋まったã»¶紐づいていること。Evidence なしの confirmed は
バックエンドのバリデーションで reject する。

---

## 6. フロントエンド設計（2層UI）

### Layer 1: AIワークスペース（メイン画面）

```
┌─────────────────────────────────────────────┐
│  [企業名] のPマーク整備状況                     │
├───────────────────â────────────────────┤
│                                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│  │整備率 │ │自動作成│ │要確認 │ │高リスク│      │
│  │ 68%  │ │ 2文書 │ │ 5件  │ │ 2件  │       │
│  └──────┘ └──────┘ └──────┘ └──────┘       │
│                                       │
│  ── AIの作業状況 ──────────────────────       │
│  ✅ 社内規定3ファイルを読み込みました            │
│  ✅ Webサイトのプライバシーポリシーを確認しました   │
│  ✅ 8つの業務プロセスを特定しました              │
│  🔄 リスク分析を作成中...                      │
│                                             │
│  ── あã────────       │
│  ┌─────────────────────────────────────┐    │
│  │ 🏢 採用活動について                    │    │
│  │                                     │    │
│  │ Q. 履歴書は選考終了後に削除しますか？    │    │
│  │    それとも一定期間保管しますか？         │    │
│  │                                     │    │
│  │選考終了後すぐに削除する             │    │
│  │  ○ 選考終了後、一定期間保管してから削除   │    │
│  │  ○ 保管し続ける（削除しない）            │    │
│  │                                     │    │
│  │  [回答する]                           │    │
│  └─────────────────────────────────────┘    │
│                                           生成された文書 ──────────────────────     │
│  📄 個人情報管理台帳（ドラフト）               │
│     整備率 72% / 未確定 8項目  [確認する →]    │
│  📄 リスク分析シート（ドラフト）               │
│     整備率 65% / 未確定 12項目 [確認する →]    │
│                                             │
└──────────────────────────â──────────┘
```

### Layer 2: 成果物ビュー（文書の確認・確定）

```
┌─────────────────────────────────────────────┐
│  個人情報管理台帳  v1.2（ドラフト）              │
│  整備率: 72% ┃ 確定: 28 ┃ AI推定: 8 ┃ 未確認: 3 │
├──────────────────────────────────────â───┤
│                                             │
│  フィルタ: [すべて] [未確定のみ] [高リスクのみ]   │
│                                             │
│  ┌─ 顧客情報管理 ─────────────────────────┐ │
│  │ データ: 氏名、住所、電話、メール  ✅確定   │ │
│  │ 目的: 商品発送、アフターサービス   ✅確定   │ │
│  │ 保管: CRM（Salesforce）           │ │
│  │       → 根拠: HP問い合わせフォーム          │ │
│  │       [これで確定する] [修正する]           │ │
│  │ 期間: 取引終了後5年              ❓未確認  │ │
│  │       → 質問 #4 の回答待ち                │ │
│  └─────────────────────────────────────────┘ │
│                                             │
│  ┌─ 採用活動 ────────────────────────┐ │
│  │ データ: 履歴書、職務経歴書        ✅確定   │ │
│  │ 目的: 採用選考                   ✅確定   │ │
│  │ 保管: 人事システム               🔶推定   │ │
│  │ 期間: 選考終了後3ヶ月で削除       ✅確定   │ │
│  │       → 根拠: 質問 #1 への回答            │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  [Excelでダウンロード] [全項目を一括確定]       │
└─────────────────────────────────────────────┘
```

---

## 7. Web調査の具体設計

### 7.1 エージェントが自律的に確認するもの

| 調査対象 | 確認方法 | 得られる情報 |
|---------|---------|-----------プライバシーポリシー | web_fetch → テキスト解析 | 利用目的一覧、第三者提供先、Cookie方針、問い合わせ窓口 |
| 問い合わせフォーム | web_fetch → HTML解析 | 収集項目（input name/label）、SSL状態、同意チェック有無 |
| 採用ページ | web_fetch + web_search | 応募フォーム収集項目、利用求人サービス |
| サービス申込フォーム | web_fetch → HTML解析 | 会員登録で収集する項目、決済情報の取扱い |
| Cookie / アクセス解析 | web_fetch → script/meta解析 | GA、GTM、Facebook Pixel等の埋め込み有無 |
| 会社概要ページ | web_fetch | 事業内容、拠点、従業員数、グループ会社 |
| 外部SaaSの個人情報取扱い | web_search | 利用SaaSのセキュリティ認証、データ保管リージョン |

### 7.2 Web調査で「推定」に留めるもの

| 項目 | 理由 |
|------|------|
| フォームのバックエンド処理 | HTMLからは受け取り先しかã®アクセス権限設定 | 外からは見えない |
| 紙媒体の個人情報（名刺、紙の申込書等） | Webには出ない |
| 社内システム間のデータフロー | 内部情報 |
| 委託先との契約内容 | 非公開 |

---

## 8. 実装ロードマップ

### Week 1-2: 基盤
- [ ] Anthropic API でAgent定義・Environment作成
- [ ] Custom Skill (pmark_knowledge) のSKILL.md + REQUIREMENTS.md 作成・アップロード
- [ ] バックエンドのセッション管理・custom toolコールバック実装
- [ ] DB設計: 正規化エンティティ（BusinessProcess, PersonalInfoItem, Evidence等）の作成
- [ ] Normalizer 実装: report_findings のフラット出力 → 正規化エンティティへの変換

### Week 3-4: Discovery フロー
- [ ] ファイルアップロード → Files API → セッション作成のE2E
- [ ] SSEストリーム受信 → report_findings → Normalizer → DB格納
- [ ] Web証跡スナップショット保存（web_fetch検知 → S3保 Web監査ログ記録（web_fetch/web_search → AgentSession.web_access_log）
- [ ] Web調査（プライバシーポリシー、フォーム）の動作検証
- [ ] 実際の企業資料でDiscovery精度を検証（パートナーコンサルと評価）

### Week 5-6: 質問・回答フロー
- [ ] generate_questions → フロントエンド表示 → 回答 → user.message 送信
- [ ] 質問の選択肢UI実装
- [ ] 回答の波及処理（related_fields → 複数エンティティ更新 + Field [ ] 再質問カウント管理（ask_count）と停止条件の実装
- [ ] confirmed バリデーション（Evidence紐づけ必須チェック）

### Week 7-8: 文書生成 + UI
- [ ] xlsx スキルでの台帳・リスク分析シート生成
- [ ] validate_registry.py による整合性チェック
- [ ] 成果物ビュー（4状態表示、確定操作）
- [ ] パートナーコンサルによる生成文書レビュー → フィードバック反映

---

## 9. コスト見積もり

### Manageds のランニングコスト（企業タイプ別3パターン）

| 項目 | 単価 | ベスト（情報整備済み） | 標準（普通の中小企業） | ワースト（資料散在企業） |
|------|------|---------------------|---------------------|----------------------|
| セッション時間 | $0.08/時間 | 1.5h = $0.12 | 4h = $0.32 | 10h = $0.80 |
| 入力トークン | $3/MTok | 100K = $0.30 | 300K = $0.90 | 800K = $2.40 |
| 出力トークン | $15/MTok | 30K = $0.45 | 80K = $1.20 | 200K = $3.00 |
| Web search | $10/1000回 | 10回 = $0.10 | 30回 = $0.30 | 60回 = $0.60 |
| 質問往復（追加セッション） | - | 1往復 = $0.50 | 3往復 = $1.50 | 6往復 = $3.00 |
| **1社あたり合計** | | **〜$2** | **〜$5** | **〜$10** |

**パターン別の想定**:
- **ベスト（情報整備済み企業）**: 社内規程が整備済み、プライバシーポリシーも詳細、
  資料が少数のWord/PDFに集約。質問は5問以下で済む。
- **標準（普通の中小企業ï則・組織図はある、プライバシーポリシーは簡易、
  資料はExcel/Word混在で10ファイル程度。質問10〜15問。
- **ワースト（資料散在企業）**: 規程が古い・不完全、プライバシーポリシーが形骸化、
  資料が20ファイル以上でフォーマットばらばら。質問15問超、再質問多発。

### 開発・インフラコスト
- バックエンド: ECS Fargate or Lambda（既存のこがねAI基盤と共用可能）
- DB: DynamoDBï10）
- S3: ファイル保管 + Web証跡スナップショット（月$1〜3）
- フロントエンド: Vercel or CloudFront + S3

---

## 10. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| Managed Agents がbeta中に仕様変更 | API互換性が崩れる | custom tool のインターフェースを安定させ、Agent側の変更を吸収できる設計に |
| Web調査でJSレンダリングが必要なページ | 情報取得できない | web_fetchで取れないåtimatedにして質問に回す。MVPでは完璧を目指さない |
| エージェントの抽出精度が低い | 台帳の品質不足 | パートナーコンサルによる定期評価。SKILL.md の改善サイクルを回す |
| 企業の資料が極端に少ない | Discoveryで得られる情報が少ない | 質問数の上限を緩和して対話で補う。最低限必要な資料リストを事前に提示 |
| Pマークの顧客データをAnthropic基盤に送信 | セキュリティ懸念 キュリティ対策」参照 |
| エージェントがconfirmedを過信 | 根拠なき確定 | バックエンドでEvidence必須バリデーション。confirmed にはEvidence紐づけを強制 |
| 再質問ループ | 担当者疲弊 | 同一フィールド最大2回ルール + insufficient_evidence への自動移行 |

### セキュリティ対策

**ネットワークアクセス制御**:
- MVP: `networking: unrestricted` で開発・検証
- 商用化時: `networking: allowlist` に移行。許å®:
  - 調査対象企業のドメイン（セッション作成時に動的設定）
  - 主要検索エンジン（web_search用）
  - 既知のSaaS公開情報ページ（Salesforce, freee 等のセキュリティページ）

**監査ログ**:
- エージェントの全 web_fetch / web_search 呼び出しをバックエンドで記録
- 記録項目: URL, HTTPメソッド, タイムスタンプ, セッションID
- AgentSession.web_access_log に格納し、後から「何を見に行ったか」をè¡の保全**:
- web_fetch の取得内容をS3にスナップショットとして保存
- confirmed の根拠がWebの場合、「取得時点のHTML」が証拠として残る
- スナップショットの保持期間: 最低3年（Pマーク更新サイクル2年 + 余裕）

**アップロードファイルの取扱い**:
- 顧客への説明資料を準備（どのデータがAnthropicに送信されるか明示）
- MVPではファイル全体を送信。商用化時は以下を検討:
  - 個人名・具体的番号のマスキング処理（エージェント投入前）
  - Anthropicのデータ保持ポリシー（ZDR非対応の認識を顧客に共有）
  - 必要に応じてBedrock経由での実行（顧客のVPC内処理）に切替


