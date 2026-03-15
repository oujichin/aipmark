import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

type Role = "ADMIN" | "PRIVACY_OFFICER" | "DEPT_MANAGER" | "DEPT_STAFF" | "TOP_MANAGEMENT";

const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 100,
  PRIVACY_OFFICER: 80,
  TOP_MANAGEMENT: 70,
  DEPT_MANAGER: 50,
  DEPT_STAFF: 10,
};

interface AuthenticatedSession {
  user: {
    id: string;
    role: string;
    organizationId: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  expires: string;
}

interface RequireRoleSuccess {
  error: null;
  session: AuthenticatedSession;
}

interface RequireRoleError {
  error: NextResponse;
  session: null;
}

type RequireRoleResult = RequireRoleSuccess | RequireRoleError;

/**
 * 認証のみを要求するヘルパー（最低ロール = DEPT_STAFF）。
 * セッションが無い場合は 401 を返し、認証済みならセッションを返す。
 */
export async function requireAuth(): Promise<RequireRoleResult> {
  return requireRole("DEPT_STAFF");
}

export async function requireRole(minRole: Role): Promise<RequireRoleResult> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }

  const userLevel = ROLE_HIERARCHY[session.user.role as Role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole];

  if (userLevel < requiredLevel) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }

  return { error: null, session: session as AuthenticatedSession };
}
