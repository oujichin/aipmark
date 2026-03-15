import { PrismaClient } from "@prisma/client";

const TEST_DATABASE_URL = "file:./prisma/test.db";

let _prisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient({
      datasources: { db: { url: TEST_DATABASE_URL } },
    });
  }
  return _prisma;
}

// テスト用のデモ組織・ユーザーを作成
export async function seedTestData(prisma: PrismaClient) {
  const org = await prisma.organization.upsert({
    where: { code: "test-org" },
    update: {},
    create: {
      id: "org-test",
      name: "テスト株式会社",
      code: "test-org",
      industry: "情報通信業",
    },
  });

  const dept = await prisma.department.upsert({
    where: { id: "dept-test-soumu" },
    update: {},
    create: {
      id: "dept-test-soumu",
      name: "総務部",
      code: "SOUMU",
      organizationId: org.id,
    },
  });

  const deptSales = await prisma.department.upsert({
    where: { id: "dept-test-sales" },
    update: {},
    create: {
      id: "dept-test-sales",
      name: "営業部",
      code: "SALES",
      organizationId: org.id,
    },
  });

  const officer = await prisma.user.upsert({
    where: { email: "officer@test.jp" },
    update: {},
    create: {
      id: "user-officer",
      email: "officer@test.jp",
      name: "テスト管理者",
      role: "PRIVACY_OFFICER",
      departmentId: dept.id,
      organizationId: org.id,
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@test.jp" },
    update: {},
    create: {
      id: "user-staff",
      email: "staff@test.jp",
      name: "テスト担当者",
      role: "DEPT_STAFF",
      departmentId: deptSales.id,
      organizationId: org.id,
    },
  });

  const topMgmt = await prisma.user.upsert({
    where: { email: "top@test.jp" },
    update: {},
    create: {
      id: "user-top",
      email: "top@test.jp",
      name: "テスト社長",
      role: "TOP_MANAGEMENT",
      departmentId: dept.id,
      organizationId: org.id,
    },
  });

  const bp = await prisma.businessProcess.upsert({
    where: { id: "bp-test-customer" },
    update: {},
    create: {
      id: "bp-test-customer",
      name: "顧客情報管理",
      description: "CRMで顧客連絡先・契約情報を管理",
      departmentId: deptSales.id,
      organizationId: org.id,
    },
  });

  return { org, dept, deptSales, officer, staff, topMgmt, bp };
}

// 全テーブルクリア（テスト間の独立性確保）
export async function cleanTestData(prisma: PrismaClient) {
  // 依存関係の逆順で削除
  const tables = [
    "ManagementReviewParticipant",
    "ManagementReviewDecision",
    "ManagementReviewAgenda",
    "ManagementReview",
    "ChangeReport",
    "ApplicationPackageItem",
    "ApplicationPackage",
    "IncidentAction",
    "IncidentCase",
    "CorrectiveAction",
    "AuditFinding",
    "AuditChecklistItem",
    "AuditPlanAuditor",
    "AuditPlanDepartment",
    "AuditPlan",
    "VendorQuestionnaire",
    "VendorEvaluation",
    "Vendor",
    "QuizQuestion",
    "TrainingResult",
    "TrainingSession",
    "TrainingPlan",
    "PMSDocumentVersion",
    "PMSDocument",
    "ResidualRisk",
    "ControlMeasure",
    "RiskItem",
    "RiskAssessment",
    "RegisterExportPackage",
    "EvidenceRecord",
    "RegisterItem",
    "Hearing",
    "InterviewHypothesis",
    "ResearchSource",
    "ResearchProfile",
    "AiUsageLog",
    "AuditLog",
    "BusinessProcess",
    "User",
    "Department",
    "Organization",
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
    } catch {
      // テーブルが存在しない場合はスキップ
    }
  }
}
