import { z } from "zod";

export const companyResearchSchema = z.object({
  companyName: z.string().min(1, "companyNameは必須").max(200),
  websiteUrl: z.string().max(500).nullable().optional(),
  industry: z.string().max(200).nullable().optional(),
});

export const riskSuggestionsSchema = z.object({
  businessProcessId: z.string().min(1, "businessProcessIdは必須"),
  assessmentId: z.string().min(1, "assessmentIdは必須"),
});

export const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).min(1),
});

export const auditChecklistSchema = z.object({
  auditPlanId: z.string().min(1, "auditPlanIdは必須"),
  scope: z.string().max(2000).optional(),
});

export const incidentAssessAiSchema = z.object({
  incidentId: z.string().min(1, "incidentIdは必須"),
});

export const trainingMaterialSchema = z.object({
  sessionId: z.string().min(1, "sessionIdは必須"),
  topic: z.string().min(1, "topicは必須").max(500),
  questionCount: z.number().int().min(1).max(20).optional(),
});

export const reviewSummarySchema = z.object({
  reviewId: z.string().min(1, "reviewIdは必須"),
  fiscalYear: z.number().int().min(2020).max(2100),
});

export const suggestProcessesSchema = z.object({
  profile: z.object({
    industry: z.string().nullable().optional(),
    mainBusiness: z.string().nullable().optional(),
    employeeCount: z.string().nullable().optional(),
    aiProfileSummary: z.string().nullable().optional(),
  }),
});

export const interviewHypothesesSchema = z.object({
  companyName: z.string().min(1),
  profile: z.object({
    companyOverview: z.string().optional(),
    industryType: z.string().optional(),
    dataSubjectsEst: z.string().optional(),
    systemsEst: z.string().optional(),
  }),
  processName: z.string().min(1),
  processDescription: z.string().min(1),
});

export const registerCandidatesSchema = z.object({
  processName: z.string().min(1),
  processDescription: z.string().min(1),
  hearingAnswers: z.record(z.string(), z.string()),
  hypotheses: z.array(z.object({ topic: z.string(), answer: z.string().optional() })).optional(),
});

export const researchProfileSchema = z.object({
  companyName: z.string().min(1),
  industry: z.string().optional(),
  sources: z.array(z.object({
    sourceType: z.string(),
    title: z.string(),
    snippet: z.string().optional(),
  })).optional(),
});

// AI出力バリデーション
export const riskSuggestionOutputSchema = z.object({
  suggestions: z.array(z.object({
    lifecycleStage: z.string(),
    description: z.string(),
    threatSource: z.string().optional(),
    vulnerability: z.string().optional(),
    likelihood: z.number().optional(),
    impact: z.number().optional(),
  })),
});

export const auditChecklistOutputSchema = z.array(z.object({
  category: z.string(),
  question: z.string(),
  responseType: z.string(),
}));

export const incidentAssessOutputSchema = z.object({
  suggestedSeverity: z.string(),
  requiresSpeedReport: z.boolean(),
  reasoning: z.string(),
  suggestedActions: z.array(z.string()),
});

export const reviewSummaryOutputSchema = z.object({
  riskSummary: z.string(),
  trainingSummary: z.string(),
  vendorSummary: z.string(),
  auditSummary: z.string(),
  incidentSummary: z.string(),
});
