# AIPmark5 MVP 実装計画

## 概要
プライバシーマーク管理システムの顧客デモ用MVP。ローカル単体動作。

## 技術スタック
- **フレームワーク**: Next.js 15 (App Router)
- **DB**: SQLite + Prisma
- **UI**: Tailwind CSS v4（独自コンポーネント）
- **AI**: Google Gemini API (@google/generative-ai, gemini-2.0-flash)
- **Excel出力**: ExcelJS
- **認証**: NextAuth v4 (Credentials)

## フェーズ構成

### フェーズ0: 基盤 ✅完了
- [x] Next.js 15 + TypeScript プロジェクト作成
- [x] Prisma + SQLite セットアップ
- [x] 基本ファイル構造
- [x] デモユーザー3名 (個人情報管理者・部門担当者・トップマネジメント)
- [x] Tailwind CSS v4 導入
- [x] 基本レイアウト（サイドバーナビ + ヘッダー）
- [x] ログイン画面（デモアカウントクイックログイン付き）

### フェーズ1: シェル画面 ✅完了
- [x] サイドバーナビ全構成（全リンク動作）
- [x] M-03〜M-09 シェル画面（リスト骨格・空状態・「実装予定」バッジ）
- [x] 設定画面（組織情報・ユーザー一覧）

### フェーズ2: WF-01 台帳整備フロー ✅完了
- [x] 業務プロセス登録 CRUD
- [x] ヒアリング仮説・優先質問生成（AI統合済み）
- [x] ヒアリング入力フォーム（3ステップUI）
- [x] 推定値を含む台帳候補生成（CONFIRMED/INFERRED/UNCONFIRMED）
- [x] 台帳候補精査・編集（確定状況ステータス管理）
- [x] 承認申請・承認/差戻しフロー（バージョンロック含む）
- [x] Excelエクスポート (ExcelJS、推定行を黄色ハイライト)
- [ ] エビデンスファイルアップロード（UI骨格あり、実際のアップロード未実装）
- [ ] 事前調査プロファイル画面 `/register/research`（APIは実装済み）

### フェーズ3: M-10 AI支援 ✅ほぼ完了
- [x] Claude APIクライアント設定 (claude-sonnet-4-6)
- [x] PIIマスキング処理
- [x] 企業・業界プロファイル推定 API (AF-074) `/api/ai/research-profile`
- [x] ヒアリング仮説・優先質問生成 (AF-075) `/api/ai/interview-hypotheses`
- [x] 台帳候補生成 (AF-025) `/api/ai/register-candidates`
- [x] AIチャット対話 `/ai-support` (AF-031)
- [x] AI利用ログ記録 (AiUsageLog)
- [ ] リスク候補生成 (AF-026)
- [ ] ファイル要約 (AF-023)
- [ ] 変更影響サマリー (AF-028)

### フェーズ4: ダッシュボード ✅完了
- [x] タスクサマリーカード（4件: 総数・承認申請中・承認済み・差戻し）
- [x] 台帳整備進捗バー表示（業務プロセス別）
- [x] 直近の活動ログ（監査ログ10件）
- [x] ロール別表示（PRIVACY_OFFICER / DEPT_STAFF / TOP_MANAGEMENT）
- [x] AIサジェスト表示

## 現在の状態：デモ動作可能

### 動作確認できること
- 3種デモアカウントでログイン、ロール切替
- WF-01通し操作（プロセス登録→ヒアリング→AI候補生成→台帳追加→承認→Excel）
- AIチャットで実際のClaudeレスポンス
- AI台帳候補生成（CONFIRMED/INFERRED/UNCONFIRMED付き）
- 全シェル画面にエラーなく遷移
- ダッシュボードでロール別に表示切替

## セットアップ

```bash
npm install
npx prisma db push
npx tsx prisma/seed.ts   # デモデータ投入
npm run dev              # → http://localhost:3000
```

## 環境変数 (.env.local)

```
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET="aipmark5-demo-secret-key-2024"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_API_KEY="your-key-here"   ← 要設定
```

## デモユーザー

| 名前 | メール | ロール | パスワード |
|------|--------|--------|----------|
| 田中 花子 | tanaka@demo.jp | 個人情報管理者 | demo1234 |
| 鈴木 一郎 | suzuki@demo.jp | 部門担当者 | demo1234 |
| 佐藤 社長 | sato@demo.jp | トップマネジメント | demo1234 |

## 残タスク（優先度順）

1. **エビデンスファイルアップロード** — `/api/register/items/[id]/evidence` + UIフォーム
2. **事前調査プロファイル画面** — `/register/research` ページ（APIは実装済み）
3. **リスク候補生成** — `/api/ai/risk-candidates` + シェルページと連動
4. **ファイル要約** — アップロードファイルをClaudeで要約 (AF-023)

## MVPで追加した主要データモデル（修正計画反映済み）
- `ResearchProfile`: 会社/業界の事前調査結果と推定プロファイル ✅スキーマ実装
- `ResearchSource`: Webサイト、求人票、ニュース、公開資料などの調査ソース ✅スキーマ実装
- `InterviewHypothesis`: ヒアリング前に作る確認論点、優先度、確信度 ✅スキーマ実装
- `RegisterItem.confirmationStatus`: `CONFIRMED` / `INFERRED` / `UNCONFIRMED` ✅実装
- `RegisterItem.inferenceBasis`: 推定根拠のソース・仮説参照 ✅実装
