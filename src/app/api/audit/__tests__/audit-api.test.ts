import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: "file:./prisma/test.db" } },
});

// next-auth mock
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));
vi.mock("@/lib/prisma", () => ({
  prisma,
}));

import { getServerSession } from "next-auth";

const mockedGetServerSession = vi.mocked(getServerSession);

// Test fixtures
const ORG_ID = "org-audit-test";
const DEPT_A_ID = "dept-audit-a";
const DEPT_B_ID = "dept-audit-b";
const USER_A_ID = "user-audit-a"; // belongs to dept-A
const USER_B_ID = "user-audit-b"; // belongs to dept-B

function mockSession(userId = USER_A_ID, orgId = ORG_ID) {
  mockedGetServerSession.mockResolvedValue({
    user: { id: userId, role: "PRIVACY_OFFICER", organizationId: orgId, name: "Test", email: "test@test.jp" },
    expires: "2099-01-01",
  });
}

function makeRequest(url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${url}`), init);
}

function jsonBody(body: Record<string, unknown>): { method: string; headers: Record<string, string>; body: string } {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function putBody(body: Record<string, unknown>): { method: string; headers: Record<string, string>; body: string } {
  return {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

beforeAll(async () => {
  // seed test data
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = OFF");

  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: "監査テスト組織", code: "AUDIT-TEST" },
  });
  await prisma.department.upsert({
    where: { id: DEPT_A_ID },
    update: {},
    create: { id: DEPT_A_ID, name: "総務部", code: "GENERAL", organizationId: ORG_ID },
  });
  await prisma.department.upsert({
    where: { id: DEPT_B_ID },
    update: {},
    create: { id: DEPT_B_ID, name: "営業部", code: "SALES", organizationId: ORG_ID },
  });
  await prisma.user.upsert({
    where: { id: USER_A_ID },
    update: {},
    create: {
      id: USER_A_ID,
      email: "audit-a@test.jp",
      name: "監査員A",
      role: "AUDITOR",
      departmentId: DEPT_A_ID,
      organizationId: ORG_ID,
    },
  });
  await prisma.user.upsert({
    where: { id: USER_B_ID },
    update: {},
    create: {
      id: USER_B_ID,
      email: "audit-b@test.jp",
      name: "監査員B",
      role: "AUDITOR",
      departmentId: DEPT_B_ID,
      organizationId: ORG_ID,
    },
  });

  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");
});

afterAll(async () => {
  // cleanup
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = OFF");
  await prisma.correctiveAction.deleteMany({});
  await prisma.auditFinding.deleteMany({});
  await prisma.auditChecklistItem.deleteMany({});
  await prisma.auditPlanAuditor.deleteMany({});
  await prisma.auditPlanDepartment.deleteMany({});
  await prisma.auditPlan.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.user.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.department.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.organization.deleteMany({ where: { id: ORG_ID } });
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  await prisma.$disconnect();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSession();
});

// ─── Helpers for dynamic imports ───────────────────────────────────────
async function plansRoute() {
  return import("../plans/route");
}
async function planDetailRoute() {
  return import("../plans/[id]/route");
}
async function checklistRoute() {
  return import("../plans/[id]/checklist/route");
}
async function checklistItemRoute() {
  return import("../checklist/[id]/route");
}
async function findingsRoute() {
  return import("../plans/[id]/findings/route");
}
async function findingDetailRoute() {
  return import("../findings/[id]/route");
}
async function correctiveRoute() {
  return import("../corrective/route");
}
async function correctiveDetailRoute() {
  return import("../corrective/[id]/route");
}

// Track created IDs
let planId: string;
let checklistItemId: string;
let findingId: string;
let correctiveId: string;

describe("M-07 監査・是正管理 API", () => {
  // RBAC: DEPT_STAFFはPOSTできない
  it("DEPT_STAFFが監査計画をPOSTすると403を返す", async () => {
    mockedGetServerSession.mockResolvedValueOnce({
      user: { id: USER_A_ID, role: "DEPT_STAFF", organizationId: ORG_ID, name: "Test", email: "test@test.jp" },
      expires: "2099-01-01",
    });

    const { POST } = await plansRoute();
    const req = makeRequest("/api/audit/plans", jsonBody({
      fiscalYear: 2025,
      title: "権限テスト",
      targetDeptIds: [DEPT_B_ID],
      auditorIds: [USER_A_ID],
    }));
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  // 1. POST /api/audit/plans
  it("監査計画を作成できる", async () => {
    const { POST } = await plansRoute();
    const req = makeRequest("/api/audit/plans", jsonBody({
      fiscalYear: 2025,
      title: "2025年度内部監査",
      targetDeptIds: [DEPT_B_ID],
      auditorIds: [USER_A_ID],
      scope: "PMS全体",
    }));
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.title).toBe("2025年度内部監査");
    expect(data.fiscalYear).toBe(2025);
    planId = data.id;
  });

  // 2. GET /api/audit/plans
  it("計画一覧を取得できる", async () => {
    const { GET } = await plansRoute();
    const req = makeRequest("/api/audit/plans");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("items");
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data).toHaveProperty("total");
  });

  // 3. GET /api/audit/plans/[id]
  it("計画詳細を取得できる（チェックリスト・指摘・是正含む）", async () => {
    const { GET } = await planDetailRoute();
    const req = makeRequest(`/api/audit/plans/${planId}`);
    const res = await GET(req, { params: Promise.resolve({ id: planId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(planId);
    expect(data).toHaveProperty("checklistItems");
    expect(data).toHaveProperty("findings");
    expect(data).toHaveProperty("targetDepts");
    expect(data).toHaveProperty("auditors");
  });

  // 4. PUT /api/audit/plans/[id]
  it("計画を更新できる", async () => {
    const { PUT } = await planDetailRoute();
    const req = makeRequest(`/api/audit/plans/${planId}`, putBody({
      status: "PLANNED",
      scope: "PMS全体（更新）",
    }));
    const res = await PUT(req, { params: Promise.resolve({ id: planId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("PLANNED");
    expect(data.scope).toBe("PMS全体（更新）");
  });

  // 5. POST /api/audit/plans/[id]/checklist
  it("チェックリスト項目を追加できる", async () => {
    const { POST } = await checklistRoute();
    const req = makeRequest(`/api/audit/plans/${planId}/checklist`, jsonBody({
      category: "A.3.4.3.2",
      question: "個人情報の取得手続きは適切か",
      responseType: "YES_NO",
    }));
    const res = await POST(req, { params: Promise.resolve({ id: planId }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.question).toBe("個人情報の取得手続きは適切か");
    checklistItemId = data.id;
  });

  // 6. PUT /api/audit/checklist/[id]
  it("チェック結果を記入できる", async () => {
    const { PUT } = await checklistItemRoute();
    const req = makeRequest(`/api/audit/checklist/${checklistItemId}`, putBody({
      result: "YES",
      evidenceNote: "取得同意書を確認",
      comment: "問題なし",
    }));
    const res = await PUT(req, { params: Promise.resolve({ id: checklistItemId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toBe("YES");
    expect(data.evidenceNote).toBe("取得同意書を確認");
  });

  // 7. POST /api/audit/plans/[id]/findings
  it("指摘事項を作成できる（severity: MAJOR）", async () => {
    const { POST } = await findingsRoute();
    const req = makeRequest(`/api/audit/plans/${planId}/findings`, jsonBody({
      severity: "MAJOR",
      title: "同意書の保管期間未設定",
      description: "同意書の保管期間が規程に定められていない",
      jisClause: "A.3.4.3.2",
    }));
    const res = await POST(req, { params: Promise.resolve({ id: planId }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.severity).toBe("MAJOR");
    expect(data.title).toBe("同意書の保管期間未設定");
    findingId = data.id;
  });

  // 8. PUT /api/audit/findings/[id]
  it("指摘事項を更新できる", async () => {
    const { PUT } = await findingDetailRoute();
    const req = makeRequest(`/api/audit/findings/${findingId}`, putBody({
      status: "CORRECTIVE_ACTION",
      rootCauseTitle: "規程の見直し漏れ",
    }));
    const res = await PUT(req, { params: Promise.resolve({ id: findingId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("CORRECTIVE_ACTION");
    expect(data.rootCauseTitle).toBe("規程の見直し漏れ");
  });

  // 9. POST /api/audit/corrective — 是正処置起票（AUDIT source）
  it("是正処置を起票できる（source: AUDIT）", async () => {
    const { POST } = await correctiveRoute();
    const req = makeRequest("/api/audit/corrective", jsonBody({
      source: "AUDIT",
      auditFindingId: findingId,
      title: "同意書保管期間の規程化",
      rootCause: "規程見直しスケジュールの欠如",
      actionPlan: "保管期間ルールを規程に追記",
      responsibleId: USER_B_ID,
      dueDate: "2025-06-30",
    }));
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.source).toBe("AUDIT");
    expect(data.title).toBe("同意書保管期間の規程化");
    expect(data.status).toBe("OPEN");
    correctiveId = data.id;
  });

  // 10. PUT /api/audit/corrective/[id] — ステータス遷移テスト
  it("是正処置のステータスを OPEN → IN_PROGRESS に遷移できる", async () => {
    const { PUT } = await correctiveDetailRoute();
    const req = makeRequest(`/api/audit/corrective/${correctiveId}`, putBody({
      status: "IN_PROGRESS",
    }));
    const res = await PUT(req, { params: Promise.resolve({ id: correctiveId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("IN_PROGRESS");
  });

  it("是正処置のステータスを IN_PROGRESS → IMPLEMENTED に遷移できる", async () => {
    const { PUT } = await correctiveDetailRoute();
    const req = makeRequest(`/api/audit/corrective/${correctiveId}`, putBody({
      status: "IMPLEMENTED",
      implementNote: "規程改訂版v2.1にて対応",
    }));
    const res = await PUT(req, { params: Promise.resolve({ id: correctiveId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("IMPLEMENTED");
    expect(data.implementNote).toBe("規程改訂版v2.1にて対応");
  });

  it("是正処置のステータスを IMPLEMENTED → VERIFIED に遷移できる", async () => {
    const { PUT } = await correctiveDetailRoute();
    const req = makeRequest(`/api/audit/corrective/${correctiveId}`, putBody({
      status: "VERIFIED",
      verifiedById: USER_A_ID,
      verifyNote: "規程改訂を確認",
    }));
    const res = await PUT(req, { params: Promise.resolve({ id: correctiveId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("VERIFIED");
  });

  it("是正処置のステータスを VERIFIED → CLOSED に遷移できる", async () => {
    const { PUT } = await correctiveDetailRoute();
    const req = makeRequest(`/api/audit/corrective/${correctiveId}`, putBody({
      status: "CLOSED",
      approvedById: USER_A_ID,
    }));
    const res = await PUT(req, { params: Promise.resolve({ id: correctiveId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("CLOSED");
  });

  it("不正なステータス遷移は拒否される（OPEN → VERIFIED）", async () => {
    // 新規是正を作って不正遷移をテスト
    const { POST } = await correctiveRoute();
    const createReq = makeRequest("/api/audit/corrective", jsonBody({
      source: "INCIDENT",
      title: "遷移テスト用",
      actionPlan: "テスト",
      responsibleId: USER_A_ID,
    }));
    const createRes = await POST(createReq);
    const created = await createRes.json();

    const { PUT } = await correctiveDetailRoute();
    const req = makeRequest(`/api/audit/corrective/${created.id}`, putBody({
      status: "VERIFIED",
    }));
    const res = await PUT(req, { params: Promise.resolve({ id: created.id }) });
    expect(res.status).toBe(400);
    const errData = await res.json();
    expect(errData.error).toContain("ステータス遷移");
  });

  // 11. 職務分離バリデーション
  it("監査員が自部門を監査できない", async () => {
    // USER_A belongs to DEPT_A, trying to audit DEPT_A
    const { POST } = await plansRoute();
    const req = makeRequest("/api/audit/plans", jsonBody({
      fiscalYear: 2025,
      title: "自部門監査テスト",
      targetDeptIds: [DEPT_A_ID],
      auditorIds: [USER_A_ID],
    }));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("自部門");
  });

  // GET /api/audit/corrective — 是正処置一覧
  it("是正処置一覧を取得できる", async () => {
    const { GET } = await correctiveRoute();
    const req = makeRequest("/api/audit/corrective");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("items");
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data).toHaveProperty("total");
  });

  // GET /api/audit/findings/[id]
  it("指摘詳細を取得できる", async () => {
    const { GET } = await findingDetailRoute();
    const req = makeRequest(`/api/audit/findings/${findingId}`);
    const res = await GET(req, { params: Promise.resolve({ id: findingId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(findingId);
    expect(data).toHaveProperty("auditPlan");
  });

  // 未認証テスト
  it("未認証の場合は401を返す", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    const { GET } = await plansRoute();
    const req = makeRequest("/api/audit/plans");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
