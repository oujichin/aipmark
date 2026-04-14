# Risk Analysis Template (リスク分析シート)

Generate xlsx with the following columns using the xlsx skill.

## Columns

| Column (Japanese header) | Width | Description | Example |
|--------------------------|-------|-------------|---------|
| No. | 5 | Sequential number | 1 |
| 業務プロセス | 20 | Business process | 顧客情報管理 |
| 個人情報の種類 | 20 | Data items | 氏名、住所、電話番号 |
| 脅威カテゴリ | 12 | Threat category | 人的 / 物理的 / 技術的 |
| 脅威 | 25 | Threat | 不正アクセスによる漏えい |
| 脆弱性 | 25 | Vulnerability | パスワードの複雑性要件が未設定 |
| 発生可能性 | 10 | Likelihood | high / medium / low |
| 影響度 | 10 | Impact | high / medium / low |
| リスク値 | 8 | Risk score (1-9) | 6 |
| 現状の対策 | 30 | Current measures | ファイアウォール、ウイルス対策ソフト導入済み |
| 残留リスク | 10 | Residual risk | high / medium / low |
| 追加対策（推奨） | 30 | Recommended measures | 多要素認証の導入 |
| 確信度 | 12 | Confidence | confirmed / estimated / etc. |
| 根拠種別 | 10 | Evidence type | file / web / questionnaire |
| 根拠参照 | 25 | Evidence ref | 情報セキュリティ規程.docx |
| 根拠詳細 | 30 | Evidence detail | 5章「アクセス制御」にFW導入記載あり |

## Risk Score Matrix

|  | Impact: high (3) | Impact: medium (2) | Impact: low (1) |
|--|--|--|--|
| **Likelihood: high (3)** | 9 (red) | 6 (orange) | 3 (yellow) |
| **Likelihood: medium (2)** | 6 (orange) | 4 (yellow) | 2 (green) |
| **Likelihood: low (1)** | 3 (yellow) | 2 (green) | 1 (green) |

## Formatting

- Header: background #C0504D, white text, bold
- Risk 7-9: cell fill #FF0000 (red), white text
- Risk 4-6: cell fill #FFC000 (orange)
- Risk 2-3: cell fill #FFFF00 (yellow)
- Risk 1: cell fill #92D050 (green)
- insufficient_evidence rows: cell comment "【要確認】理由: ..."

## Threat Categories

### Human (人的)
Misoperation, misdirected email, insider fraud, social engineering, inadequate training

### Physical (物理的)
Theft (PC, USB, paper), loss during transport, disaster (fire, flood, earthquake), unauthorized physical entry

### Technical (技術的)
Unauthorized access, malware/ransomware, vulnerability exploitation, network interception
