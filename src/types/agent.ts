// ════════════════════════════════════════════════════════════════════
// Managed Agent custom tool のスキーマ型定義 (v1.2)
// ════════════════════════════════════════════════════════════════════

export type ConfidenceLevel = "confirmed" | "estimated" | "unconfirmed" | "insufficient_evidence";
export type FieldStatus = ConfidenceLevel;
export type QuestionType = "single_choice" | "multiple_choice" | "yes_no" | "free_text";
export type Priority = "critical" | "important" | "nice_to_have";
export type SessionStatus = "running" | "idle" | "waiting_for_answers" | "completed";
export type SessionPhase =
  | "phase0_company_profile"
  | "phase1_discovery"
  | "phase2_deep_dive"
  | "phase3_risk_pms"
  | "phase4_export"
  | "completed";
export type Classification = "K1" | "K2" | "D1" | "D2";
export type MediaType = "data" | "paper" | "both";

// ────────────────────────────────────────────────────────────────────
// report_company_profile (Phase 0 — 新規)
// ────────────────────────────────────────────────────────────────────

export interface ReportCompanyProfileInput {
  company_name: string;
  representative?: string;
  address?: string;
  established?: string;
  business_description: string;
  employees?: {
    total?: number;
    full_time?: number;
    contract?: number;
    part_time?: number;
    temporary?: number;
  };
  locations?: { name: string; address: string }[];
  group_companies?: string[];
  main_services?: string[];
  evidence?: EvidenceInput;
}

// ────────────────────────────────────────────────────────────────────
// report_findings (Phase 1 — 粒度変更: 1業務ずつ即時報告)
// ────────────────────────────────────────────────────────────────────

export interface ReportFindingsInput {
  business_process: {
    name: string;
    department: string;
    description: string;
  };
  personal_info_items?: PersonalInfoItemInput[];
}

export interface PersonalInfoItemInput {
  data_category: string;
  data_subjects: string;
  purpose: string;
  storage_location?: string;
  third_party_sharing?: string;
  retention_period?: string;
  acquisition_method?: string;
  disposal_method?: string;
  volume_estimate?: string;
  access_subjects?: string;
  confidence: ConfidenceLevel;
  evidence?: EvidenceInput;
}

export interface EvidenceInput {
  source_type: "file" | "web" | "questionnaire";
  source_ref: string;
  detail?: string;
  captured_at?: string;
}

// ────────────────────────────────────────────────────────────────────
// report_detailed_findings (Phase 2 — 新規: 業務深掘り結果)
// ────────────────────────────────────────────────────────────────────

export interface ReportDetailedFindingsInput {
  business_process_name: string;
  personal_info_details: DetailedPersonalInfoInput[];
}

export interface DetailedPersonalInfoInput {
  category: string;
  info_name: string;
  classification?: Classification;
  acquisition_method?: string;
  volume?: string;
  purpose: string;
  info_items?: string;
  media_type?: MediaType;
  storage_location?: string;
  storage_method?: string;
  usage_period?: string;
  retention_period?: string;
  disclosure_target?: boolean;
  manager?: string;
  accessible_persons?: string;
  outsourcing?: string;
  third_party_provision?: string;
  disposal_method?: string;
  remarks?: string;
  confidence: ConfidenceLevel;
  evidence?: EvidenceInput;
}

// ────────────────────────────────────────────────────────────────────
// report_risk_assessment (変更なし)
// ────────────────────────────────────────────────────────────────────

export interface ReportRiskAssessmentInput {
  business_process_name: string;
  risks: RiskInput[];
}

export interface RiskInput {
  target_info_name?: string;
  threat: string;
  vulnerability: string;
  likelihood: "high" | "medium" | "low";
  impact: "high" | "medium" | "low";
  current_measures?: string;
  recommended_measures?: string;
  confidence: ConfidenceLevel;
  evidence?: EvidenceInput;
}

// ────────────────────────────────────────────────────────────────────
// generate_questions (タイミング変更: 空欄の必須項目に限定)
// ────────────────────────────────────────────────────────────────────

export interface GenerateQuestionsInput {
  context: string;
  questions: QuestionInput[];
}

export interface QuestionInput {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options?: string[];
  related_process: string;
  related_fields: string[];
  priority: Priority;
}

// ────────────────────────────────────────────────────────────────────
// export_registry (Phase 4 — 新規: generate_document_draft を置換)
// ────────────────────────────────────────────────────────────────────

export type ExportDocumentType =
  | "personal_info_registry"
  | "risk_analysis"
  | "business_process_list"
  | "form_1_1"
  | "form_4"
  | "form_6";

export interface ExportRegistryInput {
  document_type: ExportDocumentType;
  file_path: string;
  include_unconfirmed?: boolean;
}
