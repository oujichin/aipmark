import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Demo users (hardcoded for MVP)
export const DEMO_USERS = [
  {
    id: "user-privacy-officer",
    email: "tanaka@demo.jp",
    name: "田中 花子",
    role: "PRIVACY_OFFICER",
    password: "demo1234",
    organizationId: "org-demo",
    departmentId: "dept-general",
  },
  {
    id: "user-dept-staff",
    email: "suzuki@demo.jp",
    name: "鈴木 一郎",
    role: "DEPT_STAFF",
    password: "demo1234",
    organizationId: "org-demo",
    departmentId: "dept-sales",
  },
  {
    id: "user-top-management",
    email: "sato@demo.jp",
    name: "佐藤 社長",
    role: "TOP_MANAGEMENT",
    password: "demo1234",
    organizationId: "org-demo",
    departmentId: "dept-management",
  },
];

export const ROLE_LABELS: Record<string, string> = {
  PRIVACY_OFFICER: "個人情報管理者",
  DEPT_STAFF: "部門担当者",
  TOP_MANAGEMENT: "トップマネジメント",
  GLOBAL_ADMIN: "システム管理者",
  AUDITOR: "監査担当者",
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = DEMO_USERS.find(
          (u) =>
            u.email === credentials.email &&
            u.password === credentials.password
        );

        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as unknown as { role: string }).role;
        token.organizationId = (user as unknown as { organizationId: string }).organizationId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role: string }).role = token.role as string;
        (session.user as { organizationId: string }).organizationId = token.organizationId as string;
        (session.user as { id: string }).id = token.sub as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
