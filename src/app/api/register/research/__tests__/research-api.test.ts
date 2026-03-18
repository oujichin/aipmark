import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { seedTestData, cleanTestData } from "@/test/helpers";

const testPrisma = new PrismaClient({
  datasources: { db: { url: "file:./prisma/test.db" } },
});

vi.mock("next-auth", () => ({
  getServerSession: () =>
    Promise.resolve({
      user: {
        id: "user-officer",
        email: "officer@test.jp",
        name: "テスト管理者",
        role: "PRIVACY_OFFICER",
        organizationId: "org-test",
      },
    }),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: testPrisma,
}));

const { GET, POST, PUT } = await import("../route");

function createRequest(
  body?: Record<string, unknown>,
  method: string = "POST"
): NextRequest {
  if (method === "GET") {
    return new NextRequest("http://localhost:3000/api/register/research", {
      method: "GET",
    });
  }
  return new NextRequest("http://localhost:3000/api/register/research", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

let testData: Awaited<ReturnType<typeof seedTestData>>;

beforeAll(async () => {
  await cleanTestData(testPrisma);
  testData = await seedTestData(testPrisma);
});

afterAll(async () => {
  await cleanTestData(testPrisma);
  await testPrisma.$disconnect();
});

beforeEach(async () => {
  // テスト間でResearchProfile関連をクリア
  await testPrisma.interviewHypothesis.deleteMany();
  await testPrisma.researchSource.deleteMany();
  await testPrisma.researchProfile.deleteMany();
});

// ════════════════════════════════════════════════════════════════════
// GET /api/register/research
// ════════════════════════════════════════════════════════════════════
describe("GET /api/register/research", () => {
  it("空の場合は空配列を返す", async () => {
    const req = createRequest(undefined, "GET");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([]);
  });

  it("プロファイル一覧をソース・仮説付きで返す", async () => {
    // テストデータ作成
    await testPrisma.researchProfile.create({
      data: {
        id: "rp-test-1",
        organizationId: "org-test",
        companyOverview: "テスト企業の概要",
        industryType: "情報通信業",
        employeeCount: "50名",
        status: "DRAFT",
        researchSources: {
          create: [
            {
              sourceType: "Website",
              url: "https://example.com",
              title: "テスト企業公式サイト",
              snippet: "テスト企業の公式サイトです",
            },
          ],
        },
        interviewHypotheses: {
          create: [
            {
              topic: "個人情報管理",
              question: "顧客情報はどのシステムで管理していますか？",
              hypothesis: "CRMで管理していると推定",
              confidenceLevel: "MEDIUM",
              priority: 1,
            },
          ],
        },
      },
    });

    const req = createRequest(undefined, "GET");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0].companyOverview).toBe("テスト企業の概要");
    expect(json[0].researchSources).toHaveLength(1);
    expect(json[0].researchSources[0].title).toBe("テスト企業公式サイト");
    expect(json[0].interviewHypotheses).toHaveLength(1);
    expect(json[0].interviewHypotheses[0].topic).toBe("個人情報管理");
  });
});

// ════════════════════════════════════════════════════════════════════
// POST /api/register/research
// ════════════════════════════════════════════════════════════════════
describe("POST /api/register/research", () => {
  it("正常系: プロファイルを作成できる", async () => {
    const req = createRequest({
      companyOverview: "新規テスト企業",
      industryType: "製造業",
      employeeCount: "100名",
      mainServices: "金属加工",
      dataSubjectsEst: "従業員、取引先",
      systemsEst: "勤怠管理、CRM",
      sources: [
        {
          sourceType: "Website",
          url: "https://example-mfg.com",
          title: "公式サイト",
        },
      ],
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.companyOverview).toBe("新規テスト企業");
    expect(json.industryType).toBe("製造業");
    expect(json.status).toBe("DRAFT");
    expect(json.researchSources).toHaveLength(1);
    expect(json.researchSources[0].sourceType).toBe("Website");

    // 監査ログが記録されている
    const log = await testPrisma.auditLog.findFirst({
      where: { entityId: json.id, entityType: "ResearchProfile" },
    });
    expect(log).toBeTruthy();
    expect(log?.action).toBe("CREATE");
  });

  it("ソースなしでも作成できる", async () => {
    const req = createRequest({
      companyOverview: "最小限のプロファイル",
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.companyOverview).toBe("最小限のプロファイル");
    expect(json.researchSources).toHaveLength(0);
  });

  it("ステータスを指定して作成できる", async () => {
    const req = createRequest({
      companyOverview: "確定済み企業",
      status: "CONFIRMED",
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.status).toBe("CONFIRMED");
  });
});

// ════════════════════════════════════════════════════════════════════
// PUT /api/register/research
// ════════════════════════════════════════════════════════════════════
describe("PUT /api/register/research", () => {
  let profileId: string;

  beforeEach(async () => {
    const profile = await testPrisma.researchProfile.create({
      data: {
        organizationId: "org-test",
        companyOverview: "更新前の概要",
        industryType: "小売業",
        status: "DRAFT",
      },
    });
    profileId = profile.id;
  });

  it("正常系: プロファイルを更新できる", async () => {
    const req = createRequest({
      id: profileId,
      companyOverview: "更新後の概要",
      industryType: "情報通信業",
      status: "IN_PROGRESS",
    });
    const res = await PUT(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.companyOverview).toBe("更新後の概要");
    expect(json.industryType).toBe("情報通信業");
    expect(json.status).toBe("IN_PROGRESS");
  });

  it("仮説を一括更新できる", async () => {
    const req = createRequest({
      id: profileId,
      hypotheses: [
        {
          topic: "データ管理",
          question: "どのデータベースを使用していますか？",
          hypothesis: "MySQLを使用していると推定",
          confidenceLevel: "HIGH",
          priority: 1,
        },
        {
          topic: "アクセス制御",
          question: "アクセス権限はどう管理していますか？",
          confidenceLevel: "LOW",
          priority: 2,
        },
      ],
    });
    const res = await PUT(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.interviewHypotheses).toHaveLength(2);
    expect(json.interviewHypotheses[0].topic).toBe("データ管理");
    expect(json.interviewHypotheses[0].confidenceLevel).toBe("HIGH");
  });

  it("存在しないIDで404", async () => {
    const req = createRequest({
      id: "non-existent-id",
      companyOverview: "存在しない",
    });
    const res = await PUT(req);
    expect(res.status).toBe(404);
  });

  it("バリデーション: idが欠落で400", async () => {
    const req = createRequest({
      companyOverview: "IDなし",
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});
