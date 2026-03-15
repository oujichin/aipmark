import { z } from "zod";

export const createAuditPlanSchema = z.object({
  fiscalYear: z.number().int().min(2020).max(2100),
  title: z.string().min(1, "titleは必須").max(500),
  targetDeptIds: z.array(z.string()).optional(),
  auditorIds: z.array(z.string()).optional(),
  scope: z.string().max(2000).nullable().optional(),
  criteria: z.string().max(2000).nullable().optional(),
  scheduledDate: z.string().nullable().optional(),
  leadAuditorId: z.string().nullable().optional(),
});

export const updateAuditPlanSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  scope: z.string().max(2000).nullable().optional(),
  criteria: z.string().max(2000).nullable().optional(),
  status: z.enum(["DRAFT", "PLANNED", "IN_PROGRESS", "COMPLETED", "REPORTED"]).optional(),
  leadAuditorId: z.string().nullable().optional(),
  scheduledDate: z.string().nullable().optional(),
  completedDate: z.string().nullable().optional(),
});

export const createChecklistItemSchema = z.object({
  category: z.string().max(200).nullable().optional(),
  question: z.string().min(1, "questionは必須").max(2000),
  responseType: z.string().max(50).optional(),
  sortOrder: z.number().int().optional(),
});

export const updateChecklistItemSchema = z.object({
  result: z.string().max(50).nullable().optional(),
  evidenceNote: z.string().max(2000).nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
  category: z.string().max(200).nullable().optional(),
  question: z.string().max(2000).optional(),
  responseType: z.string().max(50).optional(),
  sortOrder: z.number().int().optional(),
});

export const createAuditFindingSchema = z.object({
  severity: z.enum(["MINOR", "MAJOR", "CRITICAL", "OBSERVATION"]).optional(),
  title: z.string().min(1, "titleは必須").max(500),
  description: z.string().min(1, "descriptionは必須").max(5000),
  jisClause: z.string().max(200).nullable().optional(),
});

export const updateAuditFindingSchema = z.object({
  severity: z.enum(["MINOR", "MAJOR", "CRITICAL", "OBSERVATION"]).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  jisClause: z.string().max(200).nullable().optional(),
  rootCauseTitle: z.string().max(500).nullable().optional(),
  status: z.enum(["OPEN", "CORRECTIVE_ACTION", "CLOSED"]).optional(),
  closedAt: z.string().nullable().optional(),
});

export const createCorrectiveActionSchema = z.object({
  source: z.enum(["AUDIT", "INCIDENT", "COMPLAINT", "OTHER"]).optional(),
  auditFindingId: z.string().nullable().optional(),
  incidentId: z.string().nullable().optional(),
  title: z.string().min(1, "titleは必須").max(500),
  rootCause: z.string().max(2000).nullable().optional(),
  actionPlan: z.string().max(5000).nullable().optional(),
  responsibleId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export const updateCorrectiveActionSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED", "CLOSED"]).optional(),
  title: z.string().max(500).optional(),
  rootCause: z.string().max(2000).nullable().optional(),
  actionPlan: z.string().max(5000).nullable().optional(),
  responsibleId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  implementNote: z.string().max(5000).nullable().optional(),
  verifiedById: z.string().nullable().optional(),
  verifyNote: z.string().max(5000).nullable().optional(),
  horizontalDeployment: z.string().max(5000).nullable().optional(),
  approvedById: z.string().nullable().optional(),
});
