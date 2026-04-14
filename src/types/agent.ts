// ════════════════════════════════════════════════════════════════════
// Managed Agent custom tool のスキーマ型定義
// ════════════════════════════════════════════════════════════════════

export type ConfidenceLevel = "confirmed" | "estimated" | "unconfirmed" | "insufficient_evidence";
export type FieldStatus = ConfidenceLevel;
export type QuestionType = "single_choice" | "multiple_choice" | "yes_no" | "free_text";
export type Priority = "critical" | "important" | "nice_to_have";
export type SessionStatus = "running" | "idle" | "waiting_for_answers" | "completed";
export type SessionPhase = "discovery" | "gap_analysis" | "drafting" | "review";

// report_findings の入力
export interface ReportFindingsInput {
  business_process: {
    name: string;
    department: string;
    description: string;
  };
  personal_info_items: PersonalInfoItemInput[];
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

// report_risk_assessment の入力
export interface ReportRiskAssessmentInput {
  business_process_name: string;
  risks: RiskInput[];
}

export interface RiskInput {
  threat: string;
  vulnerability: string;
  likelihood: "high" | "medium" | "low";
  impact: "high" | "medium" | "low";
  current_measures?: string;
  recommended_measures?: string;
  confidence: ConfidenceLevel;
  evidence?: EvidenceInput;
}

// generate_questions の入力
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

// generate_document_draft の入力
export interface GenerateDocumentDraftInput {
  document_type: "personal_info_registry" | "risk_analysis" | "business_process_list";
  file_path: string;
  file_format: "xlsx" | "docx" | "csv";
  summary: string;
  unconfirmed_count: number;
  total_fields: number;
}
