import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().min(1, "nameは必須").max(200),
  code: z.string().max(50).optional(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().max(200).optional(),
  code: z.string().max(50).optional(),
});

export const createBusinessProcessSchema = z.object({
  name: z.string().min(1, "nameは必須").max(500),
  description: z.string().max(2000).optional(),
  departmentId: z.string().min(1, "departmentIdは必須"),
});

export const updateBusinessProcessSchema = z.object({
  name: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  departmentId: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const createRegisterItemSchema = z.object({
  businessProcessId: z.string().min(1),
  dataSubject: z.string().min(1, "dataSubjectは必須"),
  dataCategoryCodes: z.array(z.string()).min(1, "個人情報区分を1件以上選択してください"),
  dataFieldCodes: z.array(z.string()).min(1, "個人情報項目を1件以上選択してください"),
  purpose: z.string().min(1, "purposeは必須"),
  legalBasis: z.string().min(1, "legalBasisは必須"),
  retentionPeriod: z.string().min(1, "retentionPeriodは必須"),
  storageLocation: z.string().min(1, "storageLocationは必須"),
  thirdPartyProvision: z.string().optional(),
  confirmationStatus: z.string().optional(),
  inferenceBasis: z.string().nullable().optional(),
});

export const createHearingSchema = z.object({
  businessProcessId: z.string().min(1),
  answers: z.unknown(),
  status: z.enum(["DRAFT", "SUBMITTED"]).optional(),
  aiCandidates: z.unknown().nullable().optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  industry: z.string().max(200).nullable().optional(),
  mainBusiness: z.string().max(500).nullable().optional(),
  employeeCount: z.string().max(50).nullable().optional(),
  establishedYear: z.string().max(10).nullable().optional(),
  capital: z.string().max(50).nullable().optional(),
  representative: z.string().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  websiteUrl: z.string().max(500).nullable().optional(),
  pmarkNumber: z.string().max(50).nullable().optional(),
  pmarkExpiry: z.string().nullable().optional(),
  certifyingBody: z.string().max(200).nullable().optional(),
  _updateAiCache: z.boolean().optional(),
  aiProfileSummary: z.string().nullable().optional(),
  aiResearchSources: z.unknown().nullable().optional(),
  aiResearchedAt: z.string().nullable().optional(),
});

export const updateRegisterItemSchema = z.object({
  businessProcessId: z.string().min(1).optional(),
  dataSubject: z.string().min(1).optional(),
  dataCategoryCodes: z.array(z.string()).min(1, "個人情報区分を1件以上選択してください").optional(),
  dataFieldCodes: z.array(z.string()).min(1, "個人情報項目を1件以上選択してください").optional(),
  purpose: z.string().min(1).optional(),
  legalBasis: z.string().min(1).optional(),
  retentionPeriod: z.string().min(1).optional(),
  storageLocation: z.string().min(1).optional(),
  thirdPartyProvision: z.string().optional(),
  confirmationStatus: z.string().optional(),
  inferenceBasis: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
});

export const createDataCategorySchema = z.object({
  code: z.string().min(1, "codeは必須").max(50),
  name: z.string().min(1, "nameは必須").max(200),
  description: z.string().max(2000).nullable().optional(),
  isSensitive: z.boolean().optional(),
});

export const createDataFieldSchema = z.object({
  code: z.string().min(1, "codeは必須").max(50),
  name: z.string().min(1, "nameは必須").max(200),
  description: z.string().max(2000).nullable().optional(),
  categoryHint: z.string().max(200).nullable().optional(),
  isSensitive: z.boolean().optional(),
  isSpecificPerson: z.boolean().optional(),
});

export const approveRegisterItemSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "REQUEST_APPROVAL"]),
  comment: z.string().max(2000).optional(),
});

export const updateDataCategorySchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  isSensitive: z.boolean().optional(),
});

export const updateDataFieldSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  categoryHint: z.string().max(200).nullable().optional(),
  isSensitive: z.boolean().optional(),
  isSpecificPerson: z.boolean().optional(),
});

const researchSourceSchema = z.object({
  sourceType: z.string().min(1).max(100),
  url: z.string().max(2000).optional(),
  title: z.string().min(1).max(500),
  snippet: z.string().max(5000).optional(),
  relevanceNote: z.string().max(2000).optional(),
});

const interviewHypothesisSchema = z.object({
  topic: z.string().min(1).max(500),
  question: z.string().min(1).max(2000),
  hypothesis: z.string().max(5000).optional(),
  confidenceLevel: z.string().max(50).optional(),
  priority: z.number().int().optional(),
  basis: z.string().max(5000).optional(),
});

export const createResearchProfileSchema = z.object({
  companyOverview: z.string().max(5000).nullable().optional(),
  industryType: z.string().max(200).nullable().optional(),
  employeeCount: z.string().max(50).nullable().optional(),
  mainServices: z.string().max(2000).nullable().optional(),
  dataSubjectsEst: z.string().max(2000).nullable().optional(),
  systemsEst: z.string().max(2000).nullable().optional(),
  rawNotes: z.string().max(10000).nullable().optional(),
  aiSummary: z.string().max(10000).nullable().optional(),
  status: z.string().max(50).optional(),
  sources: z.array(researchSourceSchema).optional(),
});

export const updateResearchProfileSchema = z.object({
  id: z.string().min(1, "idは必須"),
  companyOverview: z.string().max(5000).nullable().optional(),
  industryType: z.string().max(200).nullable().optional(),
  employeeCount: z.string().max(50).nullable().optional(),
  mainServices: z.string().max(2000).nullable().optional(),
  dataSubjectsEst: z.string().max(2000).nullable().optional(),
  systemsEst: z.string().max(2000).nullable().optional(),
  rawNotes: z.string().max(10000).nullable().optional(),
  aiSummary: z.string().max(10000).nullable().optional(),
  status: z.string().max(50).optional(),
  hypotheses: z.array(interviewHypothesisSchema).optional(),
  newSources: z.array(researchSourceSchema).optional(),
});
