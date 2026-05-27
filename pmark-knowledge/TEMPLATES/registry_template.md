# Registry Template (個人情報管理台帳)

Generate xlsx with the following columns using the xlsx skill.

## Columns

| Column (Japanese header) | Width | Description | Example |
|--------------------------|-------|-------------|---------|
| No. | 5 | Sequential number | 1 |
| 業務プロセス | 20 | Business process | 顧客情報管理 |
| 個人情報の種類 | 25 | Data items | 氏名、住所、電話番号、メールアドレス |
| データ主体 | 12 | Data subjects | 顧客 |
| 件数規模 | 12 | Approximate volume | 約5,000件 |
| 利用目的 | 30 | Purpose of use | 商品の発送、アフターサービス |
| 取得方法 | 15 | Acquisition method | 申込フォーム、名刺交換 |
| 保管場所 | 20 | Storage location | CRM（Salesforce）、社内ファイルサーバー |
| アクセス権者 | 15 | Access scope | 営業部全員、システム管理者 |
| 保管期間 | 15 | Retention period | 取引終了後5年 |
| 廃棄方法 | 15 | Disposal method | システムから削除、紙はシュレッダー |
| 第三者提供 | 20 | Third-party sharing | 配送業者に氏名・住所を提供 |
| 委託先 | 20 | Subcontractor | ○○データセンター（サーバー運用） |
| 要配慮個人情報 | 10 | Sensitive info flag | なし / あり（健康診断結果） |
| 確信度 | 12 | Confidence | confirmed / estimated / unconfirmed / insufficient_evidence |
| 根拠種別 | 10 | Evidence type | file / web / questionnaire |
| 根拠参照 | 25 | Evidence ref | https://example.com/privacy |
| 根拠詳細 | 30 | Evidence detail | プライバシーポリシー「商品発送のため」 |
| 根拠取得日時 | 18 | Captured at | 2026-04-13T10:30:00Z |

## Formatting

- Header: background #4472C4, white text, bold
- confirmed rows: no fill
- estimated rows: fill #FFF2CC (light yellow)
- unconfirmed rows: fill #FCE4EC (light red)
- insufficient_evidence rows: fill #F5F5F5 (light grey), add cell comment "【要確認】理由: ..."
- Sensitive info = あり: bold row
