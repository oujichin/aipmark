import { z } from "zod";

export const createEvidenceSchema = z.object({
  title: z.string().min(1, "タイトルは必須").max(500),
  type: z.string().min(1, "エビデンス種別は必須").max(100),
  description: z.string().max(2000).nullable().optional(),
  filePath: z.string().max(1000).nullable().optional(),
  fileName: z.string().max(500).nullable().optional(),
  fileSize: z.number().nullable().optional(),
  mimeType: z.string().max(200).nullable().optional(),
  evidenceDate: z.string().nullable().optional(),
  retentionUntil: z.string().nullable().optional(),
  registerItemId: z.string().nullable().optional(),
  riskItemId: z.string().nullable().optional(),
  vendorId: z.string().nullable().optional(),
  incidentId: z.string().nullable().optional(),
  auditFindingId: z.string().nullable().optional(),
  correctiveActionId: z.string().nullable().optional(),
}).refine(
  (data) =>
    data.registerItemId || data.riskItemId || data.vendorId ||
    data.incidentId || data.auditFindingId || data.correctiveActionId,
  { message: "紐付け先を少なくとも1つ指定してください" }
);
