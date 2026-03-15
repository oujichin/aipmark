import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

// API handlers
import {
  GET as getPackages,
  POST as createPackage,
} from "../route";
import {
  GET as getPackage,
  PUT as updatePackage,
} from "../[id]/route";
import { POST as createItem } from "../[id]/items/route";
import { PUT as updateItem } from "../items/[id]/route";
import { POST as createChangeReport } from "../[id]/change-reports/route";
import { PUT as updateChangeReport } from "../change-reports/[id]/route";

// Mock next-auth
import { vi } from "vitest";
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { getServerSession } from "next-auth";

const prisma = new PrismaClient();

const TEST_ORG_ID = "test-org-app";
const TEST_USER_ID = "test-user-app";
const TEST_DEPT_ID = "test-dept-app";

function mockSession() {
  (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: {
      id: TEST_USER_ID,
      organizationId: TEST_ORG_ID,
      role: "PRIVACY_OFFICER",
    },
  });
}

function makeRequest(url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

describe("Application Package API", () => {
  beforeAll(async () => {
    await prisma.organization.upsert({
      where: { id: TEST_ORG_ID },
      update: {},
      create: { id: TEST_ORG_ID, name: "テスト組織（申請）", code: "TEST-APP" },
    });
    await prisma.department.upsert({
      where: { id: TEST_DEPT_ID },
      update: {},
      create: {
        id: TEST_DEPT_ID,
        name: "テスト部署（申請）",
        code: "APP-DEPT",
        organizationId: TEST_ORG_ID,
      },
    });
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        email: "app-test@demo.jp",
        name: "申請テストユーザー",
        role: "PRIVACY_OFFICER",
        organizationId: TEST_ORG_ID,
        departmentId: TEST_DEPT_ID,
      },
    });
  });

  afterAll(async () => {
    await prisma.changeReport.deleteMany({
      where: { package: { organizationId: TEST_ORG_ID } },
    });
    await prisma.applicationPackageItem.deleteMany({
      where: { package: { organizationId: TEST_ORG_ID } },
    });
    await prisma.applicationPackage.deleteMany({
      where: { organizationId: TEST_ORG_ID },
    });
    await prisma.auditLog.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
    await prisma.department.deleteMany({ where: { id: TEST_DEPT_ID } });
    await prisma.organization.deleteMany({ where: { id: TEST_ORG_ID } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockSession();
  });

  let packageId: string;
  let itemId: string;
  let changeReportId: string;

  // ─── POST /api/application ───────────────────────────────────
  describe("POST /api/application — パッケージ作成", () => {
    it("正常にパッケージを作成できる", async () => {
      const req = makeRequest("/api/application", {
        method: "POST",
        body: JSON.stringify({
          fiscalYear: 2025,
          applicationType: "RENEWAL",
        }),
      });

      const res = await createPackage(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.fiscalYear).toBe(2025);
      expect(data.applicationType).toBe("RENEWAL");
      expect(data.status).toBe("DRAFT");
      expect(data.organizationId).toBe(TEST_ORG_ID);
      packageId = data.id;
    });

    it("fiscalYear未指定で400を返す", async () => {
      const req = makeRequest("/api/application", {
        method: "POST",
        body: JSON.stringify({ applicationType: "NEW" }),
      });

      const res = await createPackage(req);
      expect(res.status).toBe(400);
    });

    it("未認証の場合401を返す", async () => {
      (getServerSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const req = makeRequest("/api/application", {
        method: "POST",
        body: JSON.stringify({ fiscalYear: 2025 }),
      });

      const res = await createPackage(req);
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/application ────────────────────────────────────
  describe("GET /api/application — パッケージ一覧取得", () => {
    it("organizationIdでフィルタされた一覧を取得できる", async () => {
      const req = makeRequest("/api/application");
      const res = await getPackages(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThanOrEqual(1);
      expect(data.items[0].organizationId).toBe(TEST_ORG_ID);
      expect(data.items[0]._count).toBeDefined();
      expect(data.total).toBeGreaterThanOrEqual(1);
      expect(data.page).toBe(1);
    });
  });

  // ─── GET /api/application/[id] ──────────────────────────────
  describe("GET /api/application/[id] — パッケージ詳細取得", () => {
    it("正常に詳細を取得できる", async () => {
      const req = makeRequest(`/api/application/${packageId}`);
      const params = Promise.resolve({ id: packageId });
      const res = await getPackage(req, { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(packageId);
      expect(data.items).toBeDefined();
      expect(data.changeReports).toBeDefined();
    });

    it("存在しないIDの場合404を返す", async () => {
      const req = makeRequest("/api/application/nonexistent-id");
      const params = Promise.resolve({ id: "nonexistent-id" });
      const res = await getPackage(req, { params });
      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/application/[id] テナント分離 ─────────────────
  describe("GET /api/application/[id] テナント分離", () => {
    it("他テナントのorganizationIdでは404を返す", async () => {
      const otherOrgId = "test-org-app-other";
      await prisma.organization.upsert({
        where: { id: otherOrgId },
        update: {},
        create: { id: otherOrgId, name: "他テナント組織（申請）", code: "TEST-APP-OTHER" },
      });
      const otherPkg = await prisma.applicationPackage.create({
        data: {
          organizationId: otherOrgId,
          fiscalYear: 2025,
        },
      });

      const req = makeRequest(`/api/application/${otherPkg.id}`);
      const params = Promise.resolve({ id: otherPkg.id });
      const res = await getPackage(req, { params });
      expect(res.status).toBe(404);

      // クリーンアップ
      await prisma.applicationPackage.delete({ where: { id: otherPkg.id } });
      await prisma.organization.delete({ where: { id: otherOrgId } });
    });
  });

  // ─── PUT /api/application/[id] ──────────────────────────────
  describe("PUT /api/application/[id] — パッケージ更新", () => {
    it("正常に更新できる", async () => {
      const req = makeRequest(`/api/application/${packageId}`, {
        method: "PUT",
        body: JSON.stringify({
          status: "REVIEWING",
          pmarkNumber: "12345678",
        }),
      });
      const params = Promise.resolve({ id: packageId });
      const res = await updatePackage(req, { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("REVIEWING");
      expect(data.pmarkNumber).toBe("12345678");
    });
  });

  // ─── POST /api/application/[id]/items ───────────────────────
  describe("POST /api/application/[id]/items — アイテム追加", () => {
    it("正常にアイテムを追加できる", async () => {
      const req = makeRequest(`/api/application/${packageId}/items`, {
        method: "POST",
        body: JSON.stringify({
          itemType: "REGISTER_EXPORT",
          title: "個人情報管理台帳エクスポート",
        }),
      });
      const params = Promise.resolve({ id: packageId });
      const res = await createItem(req, { params });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.packageId).toBe(packageId);
      expect(data.itemType).toBe("REGISTER_EXPORT");
      expect(data.title).toBe("個人情報管理台帳エクスポート");
      expect(data.status).toBe("PENDING");
      itemId = data.id;
    });

    it("itemType未指定で400を返す", async () => {
      const req = makeRequest(`/api/application/${packageId}/items`, {
        method: "POST",
        body: JSON.stringify({ title: "テスト" }),
      });
      const params = Promise.resolve({ id: packageId });
      const res = await createItem(req, { params });
      expect(res.status).toBe(400);
    });

    it("title未指定で400を返す", async () => {
      const req = makeRequest(`/api/application/${packageId}/items`, {
        method: "POST",
        body: JSON.stringify({ itemType: "OTHER" }),
      });
      const params = Promise.resolve({ id: packageId });
      const res = await createItem(req, { params });
      expect(res.status).toBe(400);
    });
  });

  // ─── PUT /api/application/items/[id] ────────────────────────
  describe("PUT /api/application/items/[id] — アイテム更新", () => {
    it("正常に更新できる", async () => {
      const req = makeRequest(`/api/application/items/${itemId}`, {
        method: "PUT",
        body: JSON.stringify({
          status: "GENERATED",
          fileName: "register_export.xlsx",
          filePath: "/exports/register_export.xlsx",
          fileSize: 10240,
        }),
      });
      const params = Promise.resolve({ id: itemId });
      const res = await updateItem(req, { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("GENERATED");
      expect(data.fileName).toBe("register_export.xlsx");
      expect(data.fileSize).toBe(10240);
    });
  });

  // ─── POST /api/application/[id]/change-reports ──────────────
  describe("POST /api/application/[id]/change-reports — 変更報告追加", () => {
    it("正常に変更報告を追加できる", async () => {
      const req = makeRequest(`/api/application/${packageId}/change-reports`, {
        method: "POST",
        body: JSON.stringify({
          changeCategory: "ORGANIZATION",
          changeTitle: "組織体制の変更",
          changeDetail: "個人情報保護管理者が交代しました",
          previousValue: "山田太郎",
          currentValue: "鈴木花子",
        }),
      });
      const params = Promise.resolve({ id: packageId });
      const res = await createChangeReport(req, { params });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.packageId).toBe(packageId);
      expect(data.changeCategory).toBe("ORGANIZATION");
      expect(data.changeTitle).toBe("組織体制の変更");
      changeReportId = data.id;
    });

    it("changeCategory未指定で400を返す", async () => {
      const req = makeRequest(`/api/application/${packageId}/change-reports`, {
        method: "POST",
        body: JSON.stringify({ changeTitle: "テスト" }),
      });
      const params = Promise.resolve({ id: packageId });
      const res = await createChangeReport(req, { params });
      expect(res.status).toBe(400);
    });

    it("changeTitle未指定で400を返す", async () => {
      const req = makeRequest(`/api/application/${packageId}/change-reports`, {
        method: "POST",
        body: JSON.stringify({ changeCategory: "SYSTEM" }),
      });
      const params = Promise.resolve({ id: packageId });
      const res = await createChangeReport(req, { params });
      expect(res.status).toBe(400);
    });
  });

  // ─── PUT /api/application/change-reports/[id] ───────────────
  describe("PUT /api/application/change-reports/[id] — 変更報告更新", () => {
    it("正常に更新できる", async () => {
      const req = makeRequest(`/api/application/change-reports/${changeReportId}`, {
        method: "PUT",
        body: JSON.stringify({
          changeDetail: "個人情報保護管理者が2025年4月1日付で交代",
          aiSummary: "管理者交代に伴う体制変更",
        }),
      });
      const params = Promise.resolve({ id: changeReportId });
      const res = await updateChangeReport(req, { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.changeDetail).toBe("個人情報保護管理者が2025年4月1日付で交代");
      expect(data.aiSummary).toBe("管理者交代に伴う体制変更");
    });
  });
});
