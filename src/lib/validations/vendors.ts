import { z } from "zod";

export const createVendorSchema = z.object({
  name: z.string().min(1, "委託先名は必須").max(500).transform(v => v.trim()),
  vendorType: z.string().max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
  contactName: z.string().max(200).nullable().optional(),
  contactEmail: z.string().max(500).nullable().optional(),
  contactPhone: z.string().max(50).nullable().optional(),
  hasPmark: z.boolean().optional(),
  pmarkNumber: z.string().max(50).nullable().optional(),
  hasIsms: z.boolean().optional(),
  ismsNumber: z.string().max(50).nullable().optional(),
  contractStartDate: z.string().nullable().optional(),
  contractEndDate: z.string().nullable().optional(),
  renewalDate: z.string().nullable().optional(),
  dataHandled: z.string().max(2000).nullable().optional(),
  status: z.enum(["ACTIVE", "PENDING_REVIEW", "SUSPENDED", "TERMINATED"]).optional(),
});

export const updateVendorSchema = z.object({
  name: z.string().min(1).max(500).transform(v => v.trim()).optional(),
  vendorType: z.string().max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
  contactName: z.string().max(200).nullable().optional(),
  contactEmail: z.string().max(500).nullable().optional(),
  contactPhone: z.string().max(50).nullable().optional(),
  hasPmark: z.boolean().optional(),
  pmarkNumber: z.string().max(50).nullable().optional(),
  hasIsms: z.boolean().optional(),
  ismsNumber: z.string().max(50).nullable().optional(),
  contractStartDate: z.string().nullable().optional(),
  contractEndDate: z.string().nullable().optional(),
  renewalDate: z.string().nullable().optional(),
  dataHandled: z.string().max(2000).nullable().optional(),
  overallRating: z.string().max(50).optional(),
  nextEvaluationDue: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "PENDING_REVIEW", "SUSPENDED", "TERMINATED"]).optional(),
});

export const createVendorEvaluationSchema = z.object({
  fiscalYear: z.number().int().min(2020, "年度は必須").max(2100),
  scores: z.string().nullable().optional(),
  overallScore: z.number().nullable().optional(),
  rating: z.string().max(50).nullable().optional(),
  findings: z.string().max(5000).nullable().optional(),
});

export const updateVendorEvaluationSchema = z.object({
  scores: z.string().nullable().optional(),
  overallScore: z.number().nullable().optional(),
  rating: z.string().max(50).nullable().optional(),
  findings: z.string().max(5000).nullable().optional(),
  status: z.enum(["DRAFT", "COMPLETED", "APPROVED"]).optional(),
});

export const createVendorQuestionnaireSchema = z.object({
  questions: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export const updateVendorQuestionnaireSchema = z.object({
  questions: z.string().nullable().optional(),
  answers: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "SENT", "RESPONDED", "EVALUATED"]).optional(),
});
