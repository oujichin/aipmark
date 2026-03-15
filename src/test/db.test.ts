import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

let prisma: InstanceType<typeof PrismaClient>;

beforeAll(async () => {
  prisma = new PrismaClient();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Database connection", () => {
  it("should connect to test database", async () => {
    const result = await prisma.$queryRaw`SELECT 1 as ok`;
    expect(result).toBeDefined();
  });

  it("should have all new tables available", async () => {
    // M-03 リスク管理
    const riskCount = await prisma.riskAssessment.count();
    expect(riskCount).toBe(0);

    // M-04 文書管理
    const docCount = await prisma.pMSDocument.count();
    expect(docCount).toBe(0);

    // M-05 教育管理
    const trainingCount = await prisma.trainingPlan.count();
    expect(trainingCount).toBe(0);

    // M-06 委託先管理
    const vendorCount = await prisma.vendor.count();
    expect(vendorCount).toBe(0);

    // M-07 監査・是正管理
    const auditCount = await prisma.auditPlan.count();
    expect(auditCount).toBe(0);

    // M-08 事故対応
    const incidentCount = await prisma.incidentCase.count();
    expect(incidentCount).toBe(0);

    // M-09 申請・更新
    const appCount = await prisma.applicationPackage.count();
    expect(appCount).toBe(0);

    // M-11 マネジメントレビュー
    const reviewCount = await prisma.managementReview.count();
    expect(reviewCount).toBe(0);
  });

  it("should create and read a risk assessment", async () => {
    // まずテスト用の組織を作成
    const org = await prisma.organization.create({
      data: { name: "テスト組織", code: "test-db-" + Date.now() },
    });

    const assessment = await prisma.riskAssessment.create({
      data: {
        organizationId: org.id,
        fiscalYear: 2025,
        title: "2025年度リスク評価",
      },
    });

    expect(assessment.id).toBeDefined();
    expect(assessment.title).toBe("2025年度リスク評価");
    expect(assessment.status).toBe("DRAFT");

    // クリーンアップ
    await prisma.riskAssessment.delete({ where: { id: assessment.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
