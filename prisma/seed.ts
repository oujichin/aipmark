import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding demo data...");

  // Organization
  const org = await prisma.organization.upsert({
    where: { code: "org-demo" },
    update: {},
    create: {
      id: "org-demo",
      name: "デモ株式会社",
      code: "org-demo",
      industry: "情報通信業",
    },
  });

  // Departments
  const deptGeneral = await prisma.department.upsert({
    where: { id: "dept-general" },
    update: {},
    create: {
      id: "dept-general",
      name: "総務部",
      code: "GEN",
      organizationId: org.id,
    },
  });

  const deptSales = await prisma.department.upsert({
    where: { id: "dept-sales" },
    update: {},
    create: {
      id: "dept-sales",
      name: "営業部",
      code: "SALES",
      organizationId: org.id,
    },
  });

  const deptManagement = await prisma.department.upsert({
    where: { id: "dept-management" },
    update: {},
    create: {
      id: "dept-management",
      name: "経営管理部",
      code: "MGMT",
      organizationId: org.id,
    },
  });

  const deptSystem = await prisma.department.upsert({
    where: { id: "dept-system" },
    update: {},
    create: {
      id: "dept-system",
      name: "システム部",
      code: "SYS",
      organizationId: org.id,
    },
  });

  // Users
  await prisma.user.upsert({
    where: { id: "user-privacy-officer" },
    update: {},
    create: {
      id: "user-privacy-officer",
      email: "tanaka@demo.jp",
      name: "田中 花子",
      role: "PRIVACY_OFFICER",
      organizationId: org.id,
      departmentId: deptGeneral.id,
    },
  });

  await prisma.user.upsert({
    where: { id: "user-dept-staff" },
    update: {},
    create: {
      id: "user-dept-staff",
      email: "suzuki@demo.jp",
      name: "鈴木 一郎",
      role: "DEPT_STAFF",
      organizationId: org.id,
      departmentId: deptSales.id,
    },
  });

  await prisma.user.upsert({
    where: { id: "user-top-management" },
    update: {},
    create: {
      id: "user-top-management",
      email: "sato@demo.jp",
      name: "佐藤 社長",
      role: "TOP_MANAGEMENT",
      organizationId: org.id,
      departmentId: deptManagement.id,
    },
  });

  // Business Processes
  const bp1 = await prisma.businessProcess.upsert({
    where: { id: "bp-customer-mgmt" },
    update: {},
    create: {
      id: "bp-customer-mgmt",
      name: "顧客情報管理",
      description: "顧客の連絡先・契約情報・購買履歴を管理し、営業・CS活動に活用するプロセス。CRMシステムと社内共有ドライブで管理。",
      departmentId: deptSales.id,
      organizationId: org.id,
    },
  });

  const bp2 = await prisma.businessProcess.upsert({
    where: { id: "bp-employee-hr" },
    update: {},
    create: {
      id: "bp-employee-hr",
      name: "従業員人事管理",
      description: "採用・雇用・評価・給与計算・退職処理等の人事業務。人事システムおよび給与計算ソフトを利用。",
      departmentId: deptGeneral.id,
      organizationId: org.id,
    },
  });

  const bp3 = await prisma.businessProcess.upsert({
    where: { id: "bp-recruitment" },
    update: {},
    create: {
      id: "bp-recruitment",
      name: "採用活動",
      description: "求人広告掲載、応募者情報収集・選考・内定処理。採用管理ツールおよびメール、郵送にて対応。",
      departmentId: deptGeneral.id,
      organizationId: org.id,
    },
  });

  // Sample RegisterItems for bp1 (approved/locked)
  const item1 = await prisma.registerItem.upsert({
    where: { id: "ri-customer-contact" },
    update: {},
    create: {
      id: "ri-customer-contact",
      businessProcessId: bp1.id,
      dataSubject: "顧客（法人担当者・個人顧客）",
      dataCategories: JSON.stringify(["氏名", "メールアドレス", "電話番号", "会社名・部署名"]),
      purpose: "営業活動・契約管理・問い合わせ対応",
      legalBasis: "契約の履行（個人情報保護法17条）",
      retentionPeriod: "契約終了後5年",
      storageLocation: "CRMシステム（クラウド）・社内共有ドライブ",
      thirdPartyProvision: "NONE",
      confirmationStatus: "CONFIRMED",
      status: "LOCKED",
      version: 2,
      approvedById: "user-privacy-officer",
      approvedAt: new Date("2025-01-15"),
      lockedAt: new Date("2025-01-15"),
    },
  });

  const item2 = await prisma.registerItem.upsert({
    where: { id: "ri-customer-purchase" },
    update: {},
    create: {
      id: "ri-customer-purchase",
      businessProcessId: bp1.id,
      dataSubject: "顧客（個人顧客）",
      dataCategories: JSON.stringify(["氏名", "購買履歴", "請求先住所"]),
      purpose: "受注処理・請求・アフターサービス",
      legalBasis: "契約の履行",
      retentionPeriod: "契約終了後7年（税法上の要件）",
      storageLocation: "基幹システム（オンプレミス）",
      thirdPartyProvision: "NONE",
      confirmationStatus: "CONFIRMED",
      status: "APPROVED",
      version: 1,
      approvedById: "user-privacy-officer",
      approvedAt: new Date("2025-02-01"),
    },
  });

  // Sample inferred item (new workflow)
  await prisma.registerItem.upsert({
    where: { id: "ri-employee-basic" },
    update: {},
    create: {
      id: "ri-employee-basic",
      businessProcessId: bp2.id,
      dataSubject: "従業員・役員",
      dataCategories: JSON.stringify(["氏名", "住所", "生年月日", "マイナンバー", "給与情報", "健康診断結果"]),
      purpose: "雇用管理・給与計算・社会保険手続き",
      legalBasis: "法令に基づく義務（労働基準法・社会保険法等）",
      retentionPeriod: "退職後10年",
      storageLocation: "人事システム・給与計算ソフト（オンプレミス）",
      thirdPartyProvision: "DOMESTIC",
      confirmationStatus: "INFERRED",
      inferenceBasis: "業種・規模から推定。ヒアリングで確認要。",
      status: "REVIEWING",
      version: 1,
    },
  });

  // AuditLog (sample activity)
  await prisma.auditLog.createMany({
    data: [
      {
        userId: "user-privacy-officer",
        action: "APPROVE",
        entityType: "RegisterItem",
        entityId: item1.id,
        details: JSON.stringify({ message: "台帳v2を承認・バージョンロック" }),
        createdAt: new Date("2025-01-15T10:30:00"),
      },
      {
        userId: "user-dept-staff",
        action: "SUBMIT",
        entityType: "RegisterItem",
        entityId: item2.id,
        details: JSON.stringify({ message: "台帳を承認申請" }),
        createdAt: new Date("2025-01-28T14:15:00"),
      },
      {
        userId: "user-privacy-officer",
        action: "AI_GENERATE",
        entityType: "RegisterItem",
        entityId: "ri-employee-basic",
        details: JSON.stringify({ message: "AI台帳候補生成 (従業員人事管理)" }),
        createdAt: new Date("2025-02-10T09:00:00"),
      },
    ],
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
