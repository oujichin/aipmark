import { z } from "zod";

export const createIncidentSchema = z.object({
  title: z.string().min(1, "タイトルは必須").max(500),
  description: z.string().min(1, "説明は必須").max(5000),
  category: z.enum(["LEAKAGE", "LOSS", "DAMAGE", "UNAUTHORIZED_ACCESS", "MISDIRECTION", "THEFT", "OTHER"]).optional(),
  incidentDate: z.string().nullable().optional(),
  discoveredDate: z.string().nullable().optional(),
  containsSensitive: z.boolean().optional(),
  containsMyNumber: z.boolean().optional(),
});

export const updateIncidentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  category: z.enum(["LEAKAGE", "LOSS", "DAMAGE", "UNAUTHORIZED_ACCESS", "MISDIRECTION", "THEFT", "OTHER"]).optional(),
  incidentDate: z.string().nullable().optional(),
  discoveredDate: z.string().nullable().optional(),
  affectedCount: z.number().int().nullable().optional(),
  affectedScope: z.string().max(2000).nullable().optional(),
  dataTypes: z.unknown().optional(),
  containsSensitive: z.boolean().optional(),
  containsMyNumber: z.boolean().optional(),
  assignedToId: z.string().nullable().optional(),
  status: z.enum(["REPORTED", "ASSESSING", "RESPONDING", "CORRECTING", "CLOSED"]).optional(),
});

export const createIncidentActionSchema = z.object({
  actionType: z.enum(["INITIAL_RESPONSE", "SPEED_REPORT", "NOTIFICATION", "INVESTIGATION", "FULL_REPORT", "PREVENTION", "OTHER"]),
  title: z.string().min(1, "titleは必須").max(500),
  description: z.string().max(5000).nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export const updateIncidentActionSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
  title: z.string().max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export const assessIncidentSchema = z.object({
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  affectedCount: z.number().int().nullable().optional(),
});

export const closeIncidentSchema = z.object({
  closureNote: z.string().max(5000).nullable().optional(),
});
