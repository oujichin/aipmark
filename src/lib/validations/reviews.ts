import { z } from "zod";

export const createReviewSchema = z.object({
  fiscalYear: z.number().int().min(2020, "fiscalYearは必須").max(2100),
  reviewDate: z.string().nullable().optional(),
  chairpersonId: z.string().nullable().optional(),
});

export const updateReviewSchema = z.object({
  fiscalYear: z.number().int().min(2020).max(2100).optional(),
  reviewDate: z.string().nullable().optional(),
  chairpersonId: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "PREPARED", "IN_REVIEW", "APPROVED", "LOCKED"]).optional(),
  riskSummary: z.string().max(10000).nullable().optional(),
  trainingSummary: z.string().max(10000).nullable().optional(),
  vendorSummary: z.string().max(10000).nullable().optional(),
  auditSummary: z.string().max(10000).nullable().optional(),
  incidentSummary: z.string().max(10000).nullable().optional(),
  correctiveActionSummary: z.string().max(10000).nullable().optional(),
  externalIssues: z.string().max(10000).nullable().optional(),
  internalIssues: z.string().max(10000).nullable().optional(),
  stakeholderFeedback: z.string().max(10000).nullable().optional(),
  minutes: z.string().max(50000).nullable().optional(),
  approvedById: z.string().nullable().optional(),
});

export const createAgendaSchema = z.object({
  agendaNumber: z.number().int().min(1, "agendaNumberは必須"),
  title: z.string().min(1, "titleは必須").max(500),
  description: z.string().max(5000).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const createDecisionSchema = z.object({
  decisionTitle: z.string().min(1, "decisionTitleは必須").max(500),
  decisionDetail: z.string().max(5000).nullable().optional(),
  improvementInstructions: z.string().max(5000).nullable().optional(),
  responsibleId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export const updateDecisionSchema = z.object({
  decisionTitle: z.string().max(500).optional(),
  decisionDetail: z.string().max(5000).nullable().optional(),
  improvementInstructions: z.string().max(5000).nullable().optional(),
  responsibleId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CARRIED_FORWARD"]).optional(),
  followUpNotes: z.string().max(10000).nullable().optional(),
});

export const createParticipantSchema = z.object({
  userId: z.string().min(1, "userIdは必須"),
  role: z.enum(["CHAIRPERSON", "ATTENDEE"]).optional(),
});
