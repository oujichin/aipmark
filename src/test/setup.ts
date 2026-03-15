// テスト環境の基本設定
process.env.DATABASE_URL = "file:./prisma/test.db";
process.env.NEXTAUTH_SECRET = "test-secret";
process.env.NEXTAUTH_URL = "http://localhost:3000";
