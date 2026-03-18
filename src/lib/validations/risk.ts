import { z } from "zod";

export const createRiskAssessmentSchema = z.object({
  title: z.string().min(1, "titleは必須").max(200),
  fiscalYear: z.number().int().min(2020).max(2100),
  description: z.string().max(2000).nullable().optional(),
  targetScope: z.string().max(500).nullable().optional(),
  businessProcessId: z.string().nullable().optional(),
});

export const updateRiskAssessmentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  targetScope: z.string().max(500).nullable().optional(),
  status: z.enum(["DRAFT", "IN_PROGRESS", "COMPLETED", "APPROVED"]).optional(),
  fiscalYear: z.number().int().min(2020).max(2100).optional(),
  businessProcessId: z.string().nullable().optional(),
  approvedById: z.string().nullable().optional(),
});

export const createRiskItemSchema = z.object({
  lifecycleStage: z.enum(["ACQUISITION", "USE", "STORAGE", "PROVISION", "ENTRUSTMENT", "DISPOSAL"]),
  description: z.string().min(1, "descriptionは必須").max(2000),
  threatSource: z.string().max(500).nullable().optional(),
  vulnerability: z.string().max(500).nullable().optional(),
  likelihood: z.number().int().min(1).max(3).optional(),
  impact: z.number().int().min(1).max(3).optional(),
  registerItemId: z.string().nullable().optional(),
  businessProcessId: z.string().nullable().optional(),
});

export const updateRiskItemSchema = z.object({
  lifecycleStage: z.enum(["ACQUISITION", "USE", "STORAGE", "PROVISION", "ENTRUSTMENT", "DISPOSAL"]).optional(),
  description: z.string().min(1).max(2000).optional(),
  threatSource: z.string().max(500).nullable().optional(),
  vulnerability: z.string().max(500).nullable().optional(),
  likelihood: z.number().int().min(1).max(3).optional(),
  impact: z.number().int().min(1).max(3).optional(),
  status: z.enum(["IDENTIFIED", "ANALYZED", "TREATED"]).optional(),
  registerItemId: z.string().nullable().optional(),
  businessProcessId: z.string().nullable().optional(),
});

export const createControlMeasureSchema = z.object({
  category: z.enum(["ORGANIZATIONAL", "HUMAN", "PHYSICAL", "TECHNICAL"]),
  description: z.string().min(1, "descriptionは必須").max(2000),
  responsible: z.string().max(200).nullable().optional(),
  status: z.enum(["PLANNED", "IMPLEMENTED", "VERIFIED"]).optional(),
});

export const updateControlMeasureSchema = z.object({
  category: z.enum(["ORGANIZATIONAL", "HUMAN", "PHYSICAL", "TECHNICAL"]).optional(),
  description: z.string().min(1).max(2000).optional(),
  responsible: z.string().max(200).nullable().optional(),
  status: z.enum(["PLANNED", "IMPLEMENTED", "VERIFIED"]).optional(),
});

export const createResidualRiskSchema = z.object({
  likelihood: z.number().int().min(1).max(3).optional(),
  impact: z.number().int().min(1).max(3).optional(),
  accepted: z.boolean().optional(),
  justification: z.string().max(2000).nullable().optional(),
});

export const updateResidualRiskSchema = z.object({
  likelihood: z.number().int().min(1).max(3).optional(),
  impact: z.number().int().min(1).max(3).optional(),
  accepted: z.boolean().optional(),
  justification: z.string().max(2000).nullable().optional(),
});
