import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { buildPersonalDataMasterMaps, formatCodes, parseJsonArray } from "@/lib/personal-data";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "下書き",
  REVIEWING: "精査中",
  PENDING_APPROVAL: "承認申請中",
  APPROVED: "承認済み",
  REJECTED: "差戻し",
  LOCKED: "確定（ロック）",
};

const CONFIRMATION_LABELS: Record<string, string> = {
  CONFIRMED: "確定",
  INFERRED: "推定",
  UNCONFIRMED: "未確認",
};

const THIRD_PARTY_LABELS: Record<string, string> = {
  NONE: "提供なし",
  DOMESTIC: "国内提供あり",
  OVERSEAS: "第三国提供あり",
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const processId = searchParams.get("processId");

  const items = await prisma.registerItem.findMany({
    where: {
      ...(processId ? { businessProcessId: processId } : {}),
      businessProcess: { organizationId: session.user.organizationId },
    },
    include: {
      businessProcess: { include: { department: true } },
    },
    orderBy: [{ businessProcessId: "asc" }, { createdAt: "asc" }],
  });
  const [categories, fields] = await Promise.all([
    prisma.dataCategory.findMany(),
    prisma.dataFieldDefinition.findMany(),
  ]);
  const { categoriesByCode, fieldsByCode } = buildPersonalDataMasterMaps(categories, fields);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AIPmark5";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("個人情報取扱台帳", {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  // Header style
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E40AF" },
  };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  const borderStyle: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFD1D5DB" } };
  const allBorders = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };

  // Title row
  sheet.mergeCells("A1:M1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "個人情報取扱台帳";
  titleCell.font = { bold: true, size: 14, color: { argb: "FF1E40AF" } };
  titleCell.alignment = { horizontal: "center" };
  sheet.getRow(1).height = 28;

  // Column headers
  const headers = [
    "No.", "部門", "業務プロセス", "データ主体",
    "個人情報区分", "個人情報項目", "取得・利用目的", "法的根拠",
    "保存期間", "保存場所・システム", "第三者提供",
    "確定状況", "ステータス",
  ];

  const colWidths = [6, 16, 22, 18, 18, 30, 28, 22, 14, 24, 14, 10, 14];

  headers.forEach((h, i) => {
    const cell = sheet.getCell(2, i + 1);
    cell.value = h;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = allBorders;
    sheet.getColumn(i + 1).width = colWidths[i];
  });
  sheet.getRow(2).height = 32;

  // Data rows
  items.forEach((item, idx) => {
    const row = sheet.getRow(idx + 3);
    const categoryLabels = formatCodes(parseJsonArray(item.dataCategoryCodes), categoriesByCode);
    const fieldLabels = formatCodes(parseJsonArray(item.dataFieldCodes), fieldsByCode);

    const values = [
      idx + 1,
      item.businessProcess.department.name,
      item.businessProcess.name,
      item.dataSubject,
      categoryLabels,
      fieldLabels,
      item.purpose,
      item.legalBasis,
      item.retentionPeriod,
      item.storageLocation,
      THIRD_PARTY_LABELS[item.thirdPartyProvision] ?? item.thirdPartyProvision,
      CONFIRMATION_LABELS[item.confirmationStatus] ?? item.confirmationStatus,
      STATUS_LABELS[item.status] ?? item.status,
    ];

    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = allBorders;
      cell.font = { size: 9 };

      // Color INFERRED rows
      if (item.confirmationStatus === "INFERRED") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
      } else if (item.confirmationStatus === "UNCONFIRMED") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
      }
    });
    row.height = 40;
  });

  // Export package record
  await prisma.registerExportPackage.create({
    data: {
      registerItemId: items[0]?.id ?? "none",
      fileName: `個人情報取扱台帳_${new Date().toISOString().slice(0, 10)}.xlsx`,
      filePath: "memory",
      generatedById: session.user.id,
    },
  }).catch(() => {}); // ignore if no items

  const buffer = await workbook.xlsx.writeBuffer();

  const filename = `個人情報取扱台帳_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
