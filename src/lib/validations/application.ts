import { z } from "zod";

export const createApplicationPackageSchema = z.object({
  fiscalYear: z.number().int().min(2020, "fiscalYearは必須").max(2100),
  applicationType: z.string().max(100).optional(),
  pmarkNumber: z.string().max(50).nullable().optional(),
  currentExpiry: z.string().nullable().optional(),
  certifyingBody: z.string().max(500).nullable().optional(),
});

export const updateApplicationPackageSchema = z.object({
  applicationType: z.string().max(100).optional(),
  fiscalYear: z.number().int().min(2020).max(2100).optional(),
  snapshotDate: z.string().nullable().optional(),
  pmarkNumber: z.string().max(50).nullable().optional(),
  currentExpiry: z.string().nullable().optional(),
  certifyingBody: z.string().max(500).nullable().optional(),
  status: z.enum(["DRAFT", "GENERATING", "READY", "REVIEWING", "APPROVED", "SUBMITTED"]).optional(),
  approvedById: z.string().nullable().optional(),
});

export const createApplicationItemSchema = z.object({
  itemType: z.string().min(1, "itemTypeは必須").max(100),
  title: z.string().min(1, "titleは必須").max(500),
  filePath: z.string().max(1000).nullable().optional(),
  fileName: z.string().max(500).nullable().optional(),
  fileSize: z.number().nullable().optional(),
  sourceDataIds: z.array(z.string()).nullable().optional(),
});

export const updateApplicationItemSchema = z.object({
  itemType: z.string().max(100).optional(),
  title: z.string().max(500).optional(),
  filePath: z.string().max(1000).nullable().optional(),
  fileName: z.string().max(500).nullable().optional(),
  fileSize: z.number().nullable().optional(),
  sourceDataIds: z.array(z.string()).nullable().optional(),
  status: z.enum(["PENDING", "GENERATING", "GENERATED", "ERROR"]).optional(),
  errorMessage: z.string().max(2000).nullable().optional(),
});

export const createChangeReportSchema = z.object({
  changeCategory: z.string().min(1, "changeCategoryは必須").max(200),
  changeTitle: z.string().min(1, "changeTitleは必須").max(500),
  changeDetail: z.string().max(5000).nullable().optional(),
  aiSummary: z.string().max(5000).nullable().optional(),
  previousValue: z.string().max(5000).nullable().optional(),
  currentValue: z.string().max(5000).nullable().optional(),
  changedAt: z.string().nullable().optional(),
});

export const updateChangeReportSchema = z.object({
  changeCategory: z.string().max(200).optional(),
  changeTitle: z.string().max(500).optional(),
  changeDetail: z.string().max(5000).nullable().optional(),
  aiSummary: z.string().max(5000).nullable().optional(),
  previousValue: z.string().max(5000).nullable().optional(),
  currentValue: z.string().max(5000).nullable().optional(),
  changedAt: z.string().nullable().optional(),
});
