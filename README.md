# AIPmark5

プライバシーマーク（Pマーク）新規取得を支援する Next.js ベースの MVP アプリケーションです。
Anthropic Managed Agents（claude-sonnet-4-6）が、企業ホームページの調査・アップロード資料の読込み・ユーザーへの質問を通して、個人情報台帳とリスク分析表の草案を作成します。

ローカル PC 上で SQLite を使って単体起動できます（認証なし／シングルユーザー前提）。

## 動作環境

- Node.js 20 以上推奨
- npm
- Anthropic API キー（Managed Agents が利用できるアカウント）

## セットアップ

1. リポジトリを clone
2. 依存関係をインストール
3. `.env` を作成し `ANTHROPIC_API_KEY` を設定
4. Prisma でローカル DB を作成
5. Managed Agent と Environment をセットアップ（`PMARK_AGENT_ID` / `PMARK_ENV_ID` を `.env` に書き込み）
6. 開発サーバーを起動

```bash
git clone https://github.com/oujichin/aipmark.git
cd aipmark
npm install
cp .env.example .env
# .env を編集して ANTHROPIC_API_KEY を設定
npx prisma migrate deploy
npx tsx scripts/setup-agent.ts
npm run dev
```

ブラウザで `http://localhost:3000` を開いてください。

Windows PowerShell の場合は `cp` の代わりに次を使ってください。

```powershell
Copy-Item .env.example .env
```

## 環境変数

`.env` には次の値を設定してください。

```env
DATABASE_URL="file:./prisma/dev.db"
ANTHROPIC_API_KEY="sk-ant-..."
PMARK_AGENT_ID=""   # setup-agent.ts 実行後に自動で書き込まれます
PMARK_ENV_ID=""     # setup-agent.ts 実行後に自動で書き込まれます
```

`scripts/setup-agent.ts` を実行すると、Anthropic API 上に Agent 定義と Environment を作成し、その ID を `.env` に追記します。`PMARK_AGENT_ID` / `PMARK_ENV_ID` が未設定だと、セッションを開始しても Agent が起動しません。

## 使い方

1. トップページ（`http://localhost:3000`）で対象企業名と URL を入力
2. （任意）会社固有の資料（規程・台帳・契約書など）をアップロード
3. （任意）参照テンプレートフォルダのパスを指定（既定は `templates/pmark`）
4. 「開始」を押すと Agent セッションが作成され、ダッシュボードに遷移
5. ダッシュボードで Agent からの質問に回答しつつ、台帳・リスク分析表が埋まっていく様子を確認

## 主な技術構成

- Next.js 15 / React 19 / TypeScript
- Prisma + SQLite
- Tailwind CSS v4
- Anthropic Managed Agents（`@anthropic-ai/sdk` v0.88）
- Zod
- Vitest（単体テスト）

## ディレクトリ概要

- `src/app/` — Next.js App Router（トップ、`/dashboard`、`/api/*`）
- `src/app/api/sessions/` — セッション作成・チャット・ストリーム・エクスポート API
- `src/app/api/agent-callback/` — Managed Agent からの Webhook 受け口
- `src/lib/session-orchestrator.ts` — Agent セッション管理・イベント処理の中核
- `prisma/schema.prisma` — `Company` / `BusinessProcess` / `Question` / `AgentSession` / `ChatMessage` ほか
- `prisma/migrations/` — マイグレーション履歴
- `scripts/setup-agent.ts` — Managed Agent と Environment を作成するスクリプト
- `scripts/pmark-agent.yaml` — Agent のシステムプロンプト・ツール定義
- `templates/pmark/` — Agent が `template_path` として参照する PMS テンプレートライブラリ
- `uploads/` — ユーザーアップロード資料の保存先（git 管理外）

## 日常の起動（セットアップ済みの場合）

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開くだけです。フロントエンド・バックエンド（API Routes）は Next.js が同一プロセスで起動します。

> **ポート変更したい場合**
> ```bash
> npm run dev -- -p 3001
> ```

## よく使うコマンド

```bash
npm run dev          # 開発サーバー起動（フロント + API 同時）
npm run build        # 本番ビルド
npm run start        # 本番モードで起動（build 後）
npm run typecheck    # TypeScript 型チェック
npm run test         # Vitest 実行（1 回）
npm run test:watch   # Vitest watch モード
npm run db:generate  # Prisma クライアント再生成
npm run db:migrate   # マイグレーションを作成して反映（開発用）
npm run db:push      # スキーマ変更を DB に反映（マイグレーション無しで強制反映）
```

## トラブルシュート

### セッション開始後に Agent が動かない

- `.env` の `ANTHROPIC_API_KEY` / `PMARK_AGENT_ID` / `PMARK_ENV_ID` を確認してください
- `npx tsx scripts/setup-agent.ts` を実行済みか確認してください

### 画面は開くがデータがない

- `npx prisma migrate deploy`（または `npx prisma db push`）を実行してから `npm run dev` を再起動してください
- DB ファイルは `prisma/prisma/dev.db` に作成されます

### マイグレーションエラー

- `prisma/patch-prisma-node22.js` は Node.js 22 系での既知問題に対応するためのパッチです。Node.js 20 系で動かない場合は Node のバージョンを確認してください

## 公開対象に含めていないもの

以下はリポジトリに含めていません。

- `.env` / `.env.local`
- ローカル SQLite 実 DB ファイル
- `uploads/` 配下のアップロード資料
- Claude Code / Codex 用のローカル指示ファイル
