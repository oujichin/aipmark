# AIPmark5

プライバシーマーク運用を支援する Next.js ベースのデモ/MVP アプリケーションです。  
ローカル PC 上で SQLite を使って単体起動できます。

## 動作環境

- Node.js 20 以上推奨
- npm

## セットアップ

1. リポジトリを clone
2. 依存関係をインストール
3. 環境変数ファイルを作成
4. Prisma でローカル DB を作成
5. seed データを投入
6. 開発サーバーを起動

```bash
git clone https://github.com/oujichin/aipmark.git
cd aipmark
npm install
cp .env.example .env.local
npx prisma db push
npm run db:seed
npm run dev
```

ブラウザで `http://localhost:3000` を開いてください。

Windows PowerShell の場合は `cp` の代わりに次を使ってください。

```powershell
Copy-Item .env.example .env.local
```

## 環境変数

`.env.local` には少なくとも次の値を設定してください。

```env
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET="replace-with-a-random-secret"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_API_KEY="your-google-api-key"
```

補足:

- `NEXTAUTH_SECRET` は任意のランダム文字列に置き換えてください
- `GOOGLE_API_KEY` を設定しないと AI 機能は使えません
- AI 機能を使わない画面でも、ログインと基本的な台帳操作のために DB 初期化は必要です

## デモログイン

seed 実行後、以下のデモユーザーでログインできます。

| 名前 | メールアドレス | パスワード | ロール |
| --- | --- | --- | --- |
| 田中 花子 | tanaka@demo.jp | demo1234 | 個人情報管理者 |
| 鈴木 一郎 | suzuki@demo.jp | demo1234 | 部門担当者 |
| 佐藤 社長 | sato@demo.jp | demo1234 | トップマネジメント |

## 主な技術構成

- Next.js 15
- React 19
- TypeScript
- Prisma
- SQLite
- NextAuth
- Gemini API

## 初回起動でやっていること

`npx prisma db push`

- Prisma スキーマから SQLite のローカル DB を作成します

`npm run db:seed`

- 組織、部門、デモユーザー、業務プロセス、台帳サンプル
- 個人情報区分マスタ
- 個人情報項目マスタ

を投入します。

## よく使うコマンド

```bash
npm run dev
npm run build
npm run db:generate
npm run db:push
npm run db:seed
```

## トラブルシュート

### ログインできない

- `.env.local` の `NEXTAUTH_SECRET` と `NEXTAUTH_URL` を確認してください
- `npm run db:seed` が完了しているか確認してください

### 画面は開くがデータがない

- `npx prisma db push`
- `npm run db:seed`

を再実行してください。

### AI 機能が失敗する

- `GOOGLE_API_KEY` が正しく設定されているか確認してください
- API キー未設定でも、AI 依存でない一部画面は動作します

## 公開対象に含めていないもの

以下はリポジトリに含めていません。

- `.env.local`
- `.env`
- ローカル SQLite 実 DB ファイル
- Claude Code / Codex 用のローカル指示ファイル
