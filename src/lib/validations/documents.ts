import { z } from "zod";

export const createDocumentSchema = z.object({
  title: z.string().min(1, "タイトルは必須").max(500),
  type: z.string().min(1, "文書種別は必須").max(100),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(200).nullable().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(200).nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  type: z.string().max(100).optional(),
});

export const createDocumentVersionSchema = z.object({
  versionNumber: z.string().min(1, "バージョン番号は必須").max(50),
  changeNote: z.string().max(2000).nullable().optional(),
  effectiveDate: z.string().nullable().optional(),
  filePath: z.string().max(1000).nullable().optional(),
  fileName: z.string().max(500).nullable().optional(),
  fileSize: z.number().nullable().optional(),
});

export const updateDocumentVersionSchema = z.object({
  action: z.enum(["approve"]).optional(),
  changeNote: z.string().max(2000).nullable().optional(),
  effectiveDate: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "APPROVED", "SUPERSEDED"]).optional(),
});
