import { z } from "zod";

export const createTrainingPlanSchema = z.object({
  title: z.string().min(1, "タイトルは必須").max(500),
  fiscalYear: z.number().int().min(2020).max(2100),
  description: z.string().max(2000).nullable().optional(),
  targetDetails: z.union([z.string(), z.record(z.string(), z.unknown())]).nullable().optional(),
});

export const updateTrainingPlanSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  targetDetails: z.union([z.string(), z.record(z.string(), z.unknown())]).nullable().optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "IN_PROGRESS", "COMPLETED"]).optional(),
  fiscalYear: z.number().int().min(2020).max(2100).optional(),
  approvedById: z.string().nullable().optional(),
});

export const createTrainingSessionSchema = z.object({
  title: z.string().min(1, "セッションタイトルは必須").max(500),
  sessionDate: z.string().nullable().optional(),
  facilitator: z.string().max(200).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  materialNote: z.string().max(2000).nullable().optional(),
});

export const updateTrainingSessionSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  sessionDate: z.string().nullable().optional(),
  facilitator: z.string().max(200).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  materialNote: z.string().max(2000).nullable().optional(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED"]).optional(),
});

const trainingResultItemSchema = z.object({
  userId: z.string().min(1),
  attended: z.boolean(),
  quizScore: z.number().optional(),
  quizMaxScore: z.number().optional(),
  passed: z.boolean().optional(),
});

export const createTrainingResultsSchema = z.object({
  results: z.array(trainingResultItemSchema).min(1, "受講結果を1件以上指定してください"),
});

export const updateTrainingResultSchema = z.object({
  attended: z.boolean().optional(),
  quizScore: z.number().nullable().optional(),
  quizMaxScore: z.number().nullable().optional(),
  passed: z.boolean().optional(),
  status: z.enum(["PENDING", "ATTENDED", "QUIZ_DONE", "COMPLETED"]).optional(),
  completedAt: z.string().nullable().optional(),
});

export const createQuizQuestionSchema = z.object({
  questionText: z.string().min(1, "問題文は必須").max(2000),
  questionType: z.enum(["SINGLE_CHOICE", "MULTI_CHOICE", "TRUE_FALSE"]).optional(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
  points: z.number().int().min(0).optional(),
  sortOrder: z.number().int().optional(),
});
