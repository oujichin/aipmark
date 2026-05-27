# AIpmark MVP 詳細設計書 v1.2（差分）

> **Version**: 1.2 (2026-04-14)
> **変更内容**: フロー再設計。「台帳生成が早すぎる」問題を修正。
> 情報収集→構造化→段階的表示→ヒアリング深掘り→最後に帳票出力、の順に変更。
> Progressive disclosure（順次表示）の導入。台帳はオンデマンド出力に格下げ。
> v1.1と変わらない部分（Agent定義のJSON構造、Environment設定、
> Normalizer処理フロー、Evidence管理、セキュリティ対策等）は省略。

---

## 1. MVP スコープ定義（v1.2 改訂）

### ゴールの再定義

~~「個人情報管理台帳とリスク分析シートを完成させる」~~

**「企業の個人情報取扱い実態を構造化し、担当者と共有・確認しきる」**

台帳・リスク分析シートは、構造化データからのエクスポート処理。
ユーザーが「出して」と言ったら一瞬で出力できる状態を作ることがゴール。
台帳そのものを作ることがゴールではない。

### MVPで作るもの（優先順）
1. **段階的Discovery**: 企業資料 + Web調査から、業務→個人情報の順に段階的に抽出
2. **リアルタイム構造化ビュー**: 発見した内容を順次画面に表示（全部揃うまで待たない）
3. **対話的ヒアリング**: 構造化ビューを見ながら担当者と深掘り
4. **帳票エクスポート**: 確認が済んだらオンデマンドで台帳・リスク分析を出力

---

## 2. 全体フロー（v1.2 改訂）

### Pマーク取得支援の業務フロー

```
Phase 0: 基本情報収集
  HP・顧客データ確認 → ヒアリング → 基本情報整理（会社・従業員）
  ┃
  ┃ ← ここで様式1-①, 1-③, 2, 3, 5 に必要な情報も同時収集
  ▼
Phase 1: 業務の洗い出し
  個人情報を取り扱う業務を洗い出し → 順次画面に表示
  ┃
  ┃ ← 担当者が画面を見ながら「これも追加」「これは違う」とフィードバック
  ▼
Phase 2: 業務ごとの深掘り
  各業務で扱う個人情報を詳細特定 → 順次画面に追加表示
  ┃
  ┃ ← 様式4（個人情報を取扱う業務の概要）レベルまで深掘り
  ┃ ← 不足情報はヒアリングで補完
  ▼
Phase 3: 必要PMS文書の洗い出し
  個人情報保護方針 → 個人情報保護規程 → 各種PMS文書
  ┃
  ┃ ← Phase 2の結果から自動判定
  ▼
Phase 4: 帳票エクスポート（オンデマンド）
  ユーザーの指示で個人情報管理台帳・リスク分析シート等を出力
  ┃
  ┃ ← 様式6, 7, 8, 1-② の申請書類もここで生成
  ▼
  申請書提出
```

### v1.1 との最大の違い

| | v1.1 | v1.2 |
|---|---|---|
| ゴール | 台帳とリスク分析のドラフト完成 | 個人情報取扱い実態の構造化完了 |
| 台帳の位置づけ | Phase 3 のメイン成果物 | Phase 4 のオンデマンド出力 |
| 表示タイミング | Discovery完了後にまとめて | 発見するたびに順次表示 |
| ヒアリング | Discoveryの後に一括 | 表示を見ながら随時 |
| 様式1-8 | 対象外 | 情報収集の対象に含む |

---

## 3. Phase設計（v1.2 新規）

### Phase 0: 基本情報収集

**エージェントがやること**:
- 企業HPをweb_fetchで確認（会社概要、事業内容、拠点、従業員規模）
- web_searchで企業の公開情報を収集
- アップロードされた資料（組織図、就業規則等）を読み込み
- 以下を構造化して report_company_profile で報告:
  - 会社名、代表者名、所在地、設立年、事業内容
  - 従業員数（正社員、契約社員、パート、派遣の内訳）
  - 拠点一覧
  - グループ会社の有無
  - 主要な事業・サービス

**UIに即時表示する内容**:
```
┌─────────────────────────────────────────────┐
│ 🏢 基本情報                                   │
│                                             │
│ 株式会社サンプル                               │
│ 設立: 2015年 / 従業員: 42名（正社員30、パート12）│
│ 拠点: 本社（福岡市）、東京営業所                 │
│ 事業: Webマーケティング支援、広告運用代行         │
│                                             │
│ ✅ HPから確認  🔶 要確認: 派遣社員の有無         │
│                                             │
│ [修正する] [確認する]                          │
└─────────────────────────────────────────────┘
```

**様式との対応**:
- 様式1-①（事業者の概要）: 会社名、所在地、代表者、事業内容、従業員数
- 様式1-③（個人情報保護体制）: 管理者、教育実施者 → ヒアリングで確認
- 様式2（個人情報保護方針）: Phase 3 で自動起案
- 様式3（内部規程等の一覧）: Phase 3 の結果から自動生成
- 様式5（教育の実施）: ヒアリングで確認

### Phase 1: 業務の洗い出し

**エージェントがやること**:
- 資料とWebから個人情報を取り扱う業務を特定
- 業務ごとに「概要」「所管部署」「関連するシステム/書類」を抽出
- **見つかった業務から順に** report_findings で報告（全部揃うのを待たない）

**重要: 段階的報告（Progressive Reporting）**

v1.1 では全業務を調査してから一括報告だったが、v1.2 では **1業務見つかるごとに即報告**。

system prompt への追加指示:
```
業務プロセスを1つ特定するごとに、即座に report_findings を呼んでください。
すべての業務を調査し終えてからまとめて報告するのではなく、
発見順に1つずつ報告してください。
ユーザーはリアルタイムで画面に表示される結果を見ています。
```

**UIでの段階的表示**:
```
┌─────────────────────────────────────────────┐
│ 📋 個人情報を取り扱う業務（5件発見 / 調査中...） │
│                                             │
│ ┌─ 1. 顧客情報管理 ──────────────── ✅ 確認済 │
│ │ 営業部 / CRMシステム利用                    │
│ │ 顧客の連絡先・契約情報を管理                  │
│ └───────────────────────────────────────────┘│
│ ┌─ 2. 採用活動 ────────────────── 🔶 AI推定  │
│ │ 総務部 / 採用管理ツール利用                   │
│ │ 応募者の履歴書・選考情報を管理                 │
│ │ [確認する] [修正する] [削除する]              │
│ └───────────────────────────────────────────┘│
│ ┌─ 3. マーケティング ─────────── 🔶 AI推定    │
│ │ システム部 / メール配信サービス利用             │
│ │ 見込み客のメールアドレス・行動履歴を管理        │
│ │ [確認する] [修正する] [削除する]              │
│ └───────────────────────────────────────────┘│
│                                             │
│ 🔄 AIが調査中... Webサイトのフォームを確認しています │
│                                             │
│ [+ 業務を手動追加]                             │
└─────────────────────────────────────────────┘
```

### Phase 2: 業務ごとの深掘り

Phase 1 で業務一覧が揃った（または担当者が「これで全部」と確認した）後、
各業務について個人情報の詳細を深掘りする。

**エージェントがやること**:
- 各業務で取り扱う個人情報の項目を具体的に列挙
- 入手方法、利用目的、記録媒体、保管場所、保管方法、利用期間、保管期間、
  開示対象、管理者、アクセス可能者、委託、提供、廃棄方法を特定
- これも **1業務の深掘りが終わるごとに** report_detailed_findings で報告

**UIでの表示（業務を展開すると詳細が見える）**:
```
┌─ 1. 顧客情報管理 ──────────────────── ✅ 確認済 ┐
│                                                │
│ ┌─ 個人情報 ────────────────────────────────┐  │
│ │ 📄 顧客連絡先                              │  │
│ │   項目: 氏名、住所、電話番号、メールアドレス   │  │
│ │   入手: 申込フォーム（本人から直接入手）       │  │
│ │   目的: 商品発送、アフターサービス            │  │
│ │   媒体: データ / 保管: CRM（Salesforce）     │  │
│ │   保管方法: アクセス制限 / 管理者: 営業部長   │  │
│ │   アクセス: 営業部全員                       │  │
│ │   保管期間: 取引終了後5年 🔶要確認           │  │
│ │   廃棄: システムから削除                     │  │
│ │   委託: なし / 第三者提供: 配送業者に氏名住所 │  │
│ │   [確認] [修正]                             │  │
│ ├────────────────────────────────────────────┤  │
│ │ 📄 問い合わせ内容                           │  │
│ │   項目: 氏名、メールアドレス、問い合わせ内容   │  │
│ │   入手: 問い合わせフォーム ✅HP確認済          │  │
│ │   ...                                      │  │
│ └────────────────────────────────────────────┘  │
│                                                │
│ [この業務の個人情報を追加]                        │
└────────────────────────────────────────────────┘
```

**ヒアリングはこの画面を見ながら行う**:

表示された内容を担当者が見て、
- 「保管期間が空欄だけど、うちは取引終了後3年」→ 即反映
- 「この業務は委託先にデータ渡してるよ」→ 追加
- 「この個人情報、もう1種類あるよ」→ 追加

エージェントが質問を投げるのではなく、**画面に表示された構造を見て担当者が補完する**
という方向に変える。エージェントからの質問は「空欄で、かつ必須確認項目」に限定。

### Phase 3: PMS文書の洗い出し（Phase 2完了後）

Phase 2 の構造化データから自動判定:
- どの安全管理措置が必要か
- 委託先管理が必要か（委託先が1件以上あれば必要）
- 開示等の請求対応手続きが必要か
- 教育計画の対象範囲

ここでは文書の「一覧」を出すだけ。文書本体の自動生成は Phase 2 以降。

### Phase 4: 帳票エクスポート（オンデマンド）

ユーザーが「台帳を出力して」と言ったときに、構造化データから帳票を生成。

**個人情報管理台帳のカラム構成（実際の審査様式準拠）**:

| No | 分類 | 業務 | 個人情報名 | 類型 | 個人情報入手方法 | 件数 | 利用目的 | 個人情報の項目 | 記録媒体 | 保管場所 | 保管方法 | 利用期間 | 保管期間 | 開示対象 | 管理者 | アクセス可能者 | 委託 | 提供 | 廃棄方法 | 備考 |
|----|------|------|-----------|------|----------------|------|---------|-------------|---------|---------|---------|---------|---------|---------|--------|-------------|------|------|---------|------|

**v1.1 の台帳スキーマとの違い**:
- 「分類」カラムを追加（採用情報、顧客情報、従業員情報 等の大分類）
- 「業務」カラムを追加（どの業務プロセスで取り扱うか）
- 「個人情報名」が v1.1 の「個人情報の種類」に対応
- 「類型」を追加（K1:個人情報 / D1:個人データ 等のJIS区分）
- 「記録媒体」を追加（データ/紙/その他）
- 「保管方法」を追加（施錠管理、アクセス制限、暗号化 等）
- 「利用期間」と「保管期間」を分離
- 「開示対象」を追加（開示等の請求対象かどうか）

台帳は **DBの構造化データからの変換（ビュー）** であり、独立した成果物ではない。
帳票テンプレートは Custom Skill に持たせ、xlsx スキルで出力する。

---

## 4. Custom Tool 変更（v1.2 差分）

### 変更点一覧

| ツール | 変更 |
|--------|------|
| report_findings | 呼び出し粒度を変更（1業務ずつ即時報告） |
| report_company_profile | **新規追加**: Phase 0 の基本情報報告用 |
| report_detailed_findings | **新規追加**: Phase 2 の業務深掘り結果報告用 |
| generate_questions | 呼び出しタイミングを変更（空欄の必須項目に限定） |
| generate_document_draft | **削除** → export_registry に置換 |
| export_registry | **新規追加**: オンデマンド帳票出力用 |
| report_risk_assessment | 変更なし（ただし Phase 2 完了後に呼ぶ） |

### 新規: report_company_profile

```json
{
  "type": "custom",
  "name": "report_company_profile",
  "description": "Phase 0で収集した企業基本情報をバックエンドに報告する。最初に1回だけ呼ぶ。様式1-①の情報に対応。",
  "input_schema": {
    "type": "object",
    "properties": {
      "company_name": { "type": "string" },
      "representative": { "type": "string", "description": "代表者名" },
      "address": { "type": "string", "description": "本社所在地" },
      "established": { "type": "string", "description": "設立年" },
      "business_description": { "type": "string", "description": "事業内容" },
      "employees": {
        "type": "object",
        "properties": {
          "total": { "type": "integer" },
          "full_time": { "type": "integer" },
          "contract": { "type": "integer" },
          "part_time": { "type": "integer" },
          "temporary": { "type": "integer" }
        }
      },
      "locations": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "address": { "type": "string" }
          }
        }
      },
      "group_companies": { "type": "array", "items": { "type": "string" } },
      "main_services": { "type": "array", "items": { "type": "string" } },
      "evidence": {
        "type": "object",
        "properties": {
          "source_type": { "type": "string", "enum": ["file", "web", "questionnaire"] },
          "source_ref": { "type": "string" },
          "detail": { "type": "string" }
        }
      }
    },
    "required": ["company_name", "business_description"]
  }
}
```

### 新規: report_detailed_findings

```json
{
  "type": "custom",
  "name": "report_detailed_findings",
  "description": "Phase 2で1つの業務プロセスの深掘り結果を報告する。report_findingsで報告済みの業務について、個人情報の詳細（台帳カラムレベル）を報告する。1業務の深掘りが終わるたびに呼ぶ。",
  "input_schema": {
    "type": "object",
    "properties": {
      "business_process_name": { "type": "string" },
      "personal_info_details": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "category": { "type": "string", "description": "分類（例: 採用情報、顧客情報）" },
            "info_name": { "type": "string", "description": "個人情報名（例: 履歴書・職務経歴書）" },
            "classification": {
              "type": "string",
              "enum": ["K1", "K2", "D1", "D2"],
              "description": "類型。K1=個人情報, K2=特定個人情報, D1=個人データ, D2=保有個人データ"
            },
            "acquisition_method": { "type": "string", "description": "入手方法（例: 本人から直接入手）" },
            "volume": { "type": "string", "description": "件数（例: 0件/年, 2人分/累計）" },
            "purpose": { "type": "string", "description": "利用目的" },
            "info_items": { "type": "string", "description": "個人情報の項目（例: 氏名、住所、電話番号）" },
            "media_type": {
              "type": "string",
              "enum": ["data", "paper", "both"],
              "description": "記録媒体"
            },
            "storage_location": { "type": "string", "description": "保管場所" },
            "storage_method": { "type": "string", "description": "保管方法（例: 施錠、アクセス制限）" },
            "usage_period": { "type": "string", "description": "利用期間" },
            "retention_period": { "type": "string", "description": "保管期間" },
            "disclosure_target": { "type": "boolean", "description": "開示等の請求対象か" },
            "manager": { "type": "string", "description": "管理者" },
            "accessible_persons": { "type": "string", "description": "アクセス可能者" },
            "outsourcing": { "type": "string", "description": "委託の有無と委託先" },
            "third_party_provision": { "type": "string", "description": "第三者提供の有無と提供先" },
            "disposal_method": { "type": "string", "description": "廃棄方法" },
            "remarks": { "type": "string", "description": "備考" },
            "confidence": {
              "type": "string",
              "enum": ["confirmed", "estimated", "unconfirmed", "insufficient_evidence"]
            },
            "evidence": {
              "type": "object",
              "properties": {
                "source_type": { "type": "string", "enum": ["file", "web", "questionnaire"] },
                "source_ref": { "type": "string" },
                "detail": { "type": "string" },
                "captured_at": { "type": "string" }
              }
            }
          },
          "required": ["category", "info_name", "purpose", "confidence"]
        }
      }
    },
    "required": ["business_process_name", "personal_info_details"]
  }
}
```

### 新規: export_registry（generate_document_draft を置換）

```json
{
  "type": "custom",
  "name": "export_registry",
  "description": "ユーザーの指示を受けて、構造化済みデータから個人情報管理台帳やリスク分析シートをExcel形式で出力する。Phase 4でのみ使用。ユーザーが明示的に出力を要求するまで呼ばない。",
  "input_schema": {
    "type": "object",
    "properties": {
      "document_type": {
        "type": "string",
        "enum": [
          "personal_info_registry",
          "risk_analysis",
          "business_process_list",
          "form_1_1",
          "form_4",
          "form_6"
        ],
        "description": "出力する文書種類"
      },
      "file_path": { "type": "string", "description": "出力先パス" },
      "include_unconfirmed": {
        "type": "boolean",
        "description": "未確認項目も含めて出力するか（含める場合は備考に「未確認」と記載）"
      }
    },
    "required": ["document_type", "file_path"]
  }
}
```

---

## 5. System Prompt 変更（v1.2 差分）

### 作業フローの全面改訂

v1.1 の Phase 1-3 を以下に置換:

```markdown
## 作業フロー

### Phase 0: 基本情報収集
1. 企業HPをweb_fetchで確認（会社概要、事業内容、拠点情報）
2. アップロードされた資料から会社の基本情報を抽出
3. report_company_profile を呼んで基本情報を報告
4. 様式1-①に必要な情報（代表者名、所在地、従業員数等）も同時に収集

### Phase 1: 業務の洗い出し（段階的報告）
1. 資料とWebから個人情報を取り扱う業務を特定
2. **1つ見つかるたびに即座に report_findings を呼ぶ**
   - 全部揃うのを待たない。発見順に1件ずつ報告する
   - ユーザーは画面にリアルタイムで表示される結果を見ている
3. 以下の観点で業務を洗い出す:
   - 社内の人事・労務（採用、給与、退職）
   - 顧客対応（問い合わせ、契約、アフターサービス）
   - マーケティング（メルマガ、広告、イベント）
   - Webサイト運営（フォーム、Cookie、アクセス解析）
   - 委託・外注管理
   - 取引先管理
4. 業務一覧を報告し終えたら、「以上で業務の洗い出しが完了しました。
   追加や修正があれば教えてください」とユーザーに確認を求める

### Phase 2: 業務ごとの深掘り（段階的報告）
ユーザーが「OK」または追加業務の指示を出したら、各業務を深掘り:
1. 各業務で取り扱う個人情報を台帳カラムレベルで詳細に特定
2. **1業務の深掘りが終わるたびに report_detailed_findings を呼ぶ**
3. 深掘り時の確認ポイント:
   - 個人情報名と具体的な項目（氏名、住所等）
   - 類型（K1/K2/D1/D2）
   - 入手方法（本人から直接 / 第三者から / 公開情報から）
   - 記録媒体（データ / 紙 / 両方）
   - 保管場所と保管方法
   - 管理者とアクセス可能者
4. 必須確認項目（利用目的、取得方法、第三者提供、委託先、要配慮個人情報）が
   unconfirmed の場合のみ、generate_questions で質問を生成する
5. 画面に表示された内容を見て担当者が自発的に修正・追加することを期待する
   → エージェントからの質問は最小限に抑える

### Phase 3: リスク評価 + PMS文書洗い出し
Phase 2 完了後:
1. 各業務×個人情報に対して report_risk_assessment を呼ぶ
2. 構造化データから必要なPMS文書の一覧を特定

### Phase 4: 帳票エクスポート（ユーザー指示待ち）
**ユーザーが明示的に要求するまで帳票は生成しない。**
要求されたら:
1. export_registry を呼んで台帳やリスク分析シートを出力
2. 様式4, 6, 7, 8 等の申請書類も同様に出力可能

## 禁止事項（追加）
- Phase 2 完了前に台帳の生成を提案してはならない
- ユーザーが要求していないのに帳票を出力してはならない
- 「台帳を作成しました」ではなく「情報の整理が完了しました。
  台帳として出力する場合はお知らせください」と伝える
```

---

## 6. データモデル変更（v1.2 差分）

### 新規エンティティ: CompanyProfile

```
CompanyProfile (企業基本情報) ← Phase 0 で生成
  PK: company_id
  company_name, representative, address, established
  business_description
  employees: { total, full_time, contract, part_time, temporary }
  locations: [{ name, address }]
  group_companies: [string]
  main_services: [string]
  各フィールドに _status (confirmed/estimated/...) + evidence_id
```

### BusinessProcess_PII の拡張カラム

v1.1 のカラムに以下を追加:

| 追加カラム | 型 | 説明 |
|-----------|-----|------|
| category | string | 分類（採用情報、顧客情報、従業員情報等） |
| info_name | string | 個人情報名（台帳の表示名） |
| classification | enum | 類型（K1, K2, D1, D2） |
| media_type | enum | 記録媒体（data, paper, both） |
| storage_method | string | 保管方法（施錠管理、アクセス制限等） |
| usage_period | string | 利用期間 |
| disclosure_target | boolean | 開示対象フラグ |
| manager | string | 管理者名 |
| accessible_persons | string | アクセス可能者 |
| remarks | string | 備考 |

### 台帳エクスポートのマッピング

構造化DB → 台帳カラムへのマッピング:

| 台帳カラム | DBソース |
|-----------|---------|
| No | 自動連番 |
| 分類 | BusinessProcess_PII.category |
| 業務 | BusinessProcess.name |
| 個人情報名 | BusinessProcess_PII.info_name |
| 類型 | BusinessProcess_PII.classification |
| 個人情報入手方法 | BusinessProcess_PII.acquisition_method |
| 件数 | BusinessProcess_PII.volume_estimate |
| 利用目的 | BusinessProcess_PII.purpose |
| 個人情報の項目 | PersonalInfoItem.canonical_name (JOIN) |
| 記録媒体 | BusinessProcess_PII.media_type |
| 保管場所 | StorageLocation.name (JOIN) |
| 保管方法 | BusinessProcess_PII.storage_method |
| 利用期間 | BusinessProcess_PII.usage_period |
| 保管期間 | BusinessProcess_PII.retention_period |
| 開示対象 | BusinessProcess_PII.disclosure_target → ○/- |
| 管理者 | BusinessProcess_PII.manager |
| アクセス可能者 | BusinessProcess_PII.accessible_persons |
| 委託 | ThirdParty (role=subcontractor) → ○/- |
| 提供 | ThirdParty (role=third_party) → ○/- |
| 廃棄方法 | BusinessProcess_PII.disposal_method |
| 備考 | BusinessProcess_PII.remarks + 未確認項目の注記 |

---

## 7. フロントエンド設計（v1.2 改訂）

### 設計思想の変更

v1.1: 「AIの進捗」と「確認依頼」の2レイヤー
v1.2: **「構造化ビュー」が主役。AIは裏方、構造化ビューがインターフェース**

ユーザーが見るのは「AIの作業状況」ではなく「自分の会社の個人情報取扱い実態」。
AIの存在は最小限に。画面は「自社の情報マップ」として機能する。

### メイン画面: 構造化ビュー

```
┌─────────────────────────────────────────────────┐
│ 株式会社サンプル ─ 個人情報取扱い状況               │
│ 整備率 58% ┃ 確定 24 ┃ 推定 12 ┃ 未確認 8 ┃ 不足 3  │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🏢 基本情報 ──────────────────── [展開 ▼]        │
│   従業員42名 / 拠点2箇所 / Webマーケ事業 ✅       │
│                                                 │
│ ── 業務と個人情報 ──────── 7業務 / 調査完了 ──    │
│                                                 │
│ ▼ 採用情報（3件の個人情報）                        │
│  ┌────────────────────────────────────────────┐ │
│  │ 📄 履歴書・職務経歴書  [K1]                   │ │
│  │ 入手: 本人から直接 / 媒体: 紙+データ           │ │
│  │ 目的: 採用選考 ✅                             │ │
│  │ 保管: 総務 引き出し+PC / 施錠+アクセス制限      │ │
│  │ 期間: 採否決定まで→採否決定後1ヶ月 ✅          │ │
│  │ 管理: 祝井 / アクセス: 総務 ✅                 │ │
│  │ 廃棄: シュレッダー ✅                          │ │
│  │ 備考: 採用者分は従業者情報に移動、               │ │
│  │       不採用者分は破棄する ✅                   │ │
│  └────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────┐ │
│  │ 📄 応募者同意書  [K1]                         │ │
│  │ 入手: 本人から直接 / 媒体: 紙                  │ │
│  │ 目的: 採用選考時同意確認 ✅                     │ │
│  │ 保管: 紙 引き出し / 施錠 🔶推定                │ │
│  │ ...                                         │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│ ▶ 顧客情報（4件の個人情報）                        │
│ ▶ 従業員情報（5件の個人情報）                       │
│ ▶ マーケティング（2件の個人情報）                    │
│ ▶ Webサイト運営（2件の個人情報）                     │
│ ▶ 取引先管理（1件の個人情報）                       │
│ ▶ 委託先管理（1件の個人情報）                       │
│                                                 │
│ ── 未確認事項（5件） ──────────────────────       │
│ ❓ マーケティング: メール配信の同意取得方法           │
│ ❓ Webサイト: Cookie同意バナーの設置有無             │
│ ❓ 取引先管理: 名刺情報の保管期間                    │
│ ❓ 従業員情報: マイナンバーの保管方法                 │
│ ❓ 委託先: 委託契約書の締結状況                      │
│                                                 │
│ ── 操作 ───────────────────────────────────     │
│ [+ 業務を追加] [台帳をExcelで出力] [リスク分析を出力] │
└─────────────────────────────────────────────────┘
```

### Progressive Display（段階的表示）の実装

SSEストリームから report_findings / report_detailed_findings の
custom tool呼び出しを検知するたびに、フロントエンドを更新:

```typescript
// フロントエンド側のSSE受信ハンドラ
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.tool_name) {
    case "report_company_profile":
      // Phase 0: 基本情報カードをアニメーション付きで追加
      dispatch({ type: "ADD_COMPANY_PROFILE", payload: data.result });
      break;
    
    case "report_findings":
      // Phase 1: 業務カードを1枚ずつスライドインで追加
      dispatch({ type: "ADD_BUSINESS_PROCESS", payload: data.result });
      break;
    
    case "report_detailed_findings":
      // Phase 2: 既存の業務カードに詳細を展開表示
      dispatch({ type: "EXPAND_BUSINESS_DETAILS", payload: data.result });
      break;
    
    case "report_risk_assessment":
      // Phase 3: リスクバッジを各個人情報カードに付与
      dispatch({ type: "ADD_RISK_BADGE", payload: data.result });
      break;
    
    case "agent_status":
      // 「Webサイトを調査中...」等の状況表示を更新
      dispatch({ type: "UPDATE_AGENT_STATUS", payload: data.message });
      break;
  }
};
```

### 台帳出力ボタンの挙動

「台帳をExcelで出力」ボタンは以下の条件で有効化:
- Phase 2 の深掘りが全業務で完了している
- 必須確認項目に unconfirmed が残っていない（insufficient_evidence は許容）

ボタン押下時:
1. バックエンドが Managed Agent セッションに user.message を送信:
   「個人情報管理台帳をExcel形式で出力してください」
2. エージェントが export_registry を呼ぶ
3. xlsx スキルで台帳を生成 → /mnt/session/outputs/ に保存
4. バックエンドがダウンロードリンクを生成してフロントに返す

---

## 8. 実装ロードマップ（v1.2 改訂）

### Week 1-2: 基盤 + Phase 0
- [ ] Agent定義（report_company_profile, report_findings 含む）
- [ ] Environment + Session 作成
- [ ] Phase 0: 基本情報収集 → CompanyProfile 表示のE2E
- [ ] Progressive Display の基盤実装（SSE → フロントリアルタイム更新）

### Week 3-4: Phase 1 + 構造化ビュー
- [ ] Phase 1: 業務洗い出し → report_findings → カード順次追加
- [ ] 構造化ビューの実装（業務カード、展開/折りたたみ）
- [ ] ユーザーによる業務の追加・修正・削除操作
- [ ] パートナーコンサルによるPhase 1 精度検証

### Week 5-6: Phase 2 + ヒアリング
- [ ] report_detailed_findings → 詳細カラム表示
- [ ] 必須確認項目の質問生成（unconfirmedのみ）
- [ ] ユーザーによるフィールド直接編集
- [ ] Evidence紐づけ + confirmedバリデーション

### Week 7-8: Phase 3-4 + 帳票出力
- [ ] リスク評価 → リスクバッジ表示
- [ ] PMS文書一覧の自動判定
- [ ] export_registry → xlsx生成 → ダウンロード
- [ ] 台帳カラムマッピングの検証（パートナーコンサルと）