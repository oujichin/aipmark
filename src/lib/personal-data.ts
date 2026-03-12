export interface MasterRecord {
  code: string;
  name: string;
  description?: string | null;
  isSensitive?: boolean;
}

export interface DataFieldMasterRecord extends MasterRecord {
  categoryHint?: string | null;
  isSpecificPerson?: boolean;
}

export const DATA_CATEGORY_SEED: MasterRecord[] = [
  { code: "GENERAL", name: "一般個人情報", description: "通常の個人情報。氏名、連絡先、取引情報など。", isSensitive: false },
  { code: "SENSITIVE", name: "要配慮個人情報", description: "健康情報、病歴など、取得・利用に特段の配慮が必要な情報。", isSensitive: true },
  { code: "SPECIFIC", name: "特定個人情報", description: "個人番号を含む個人情報。", isSensitive: true },
  { code: "ENTRUSTED", name: "委託元預託個人情報", description: "委託元から預託された個人情報。", isSensitive: false },
];

export const DATA_FIELD_DEFINITION_SEED: DataFieldMasterRecord[] = [
  { code: "FULL_NAME", name: "氏名", categoryHint: "IDENTITY" },
  { code: "ADDRESS", name: "住所", categoryHint: "CONTACT" },
  { code: "PHONE_NUMBER", name: "電話番号", categoryHint: "CONTACT" },
  { code: "EMAIL_ADDRESS", name: "メールアドレス", categoryHint: "CONTACT" },
  { code: "COMPANY_INFO", name: "会社名・部署名", categoryHint: "BUSINESS" },
  { code: "PURCHASE_HISTORY", name: "購買履歴", categoryHint: "TRANSACTION" },
  { code: "BILLING_ADDRESS", name: "請求先住所", categoryHint: "CONTACT" },
  { code: "DATE_OF_BIRTH", name: "生年月日", categoryHint: "IDENTITY" },
  { code: "MY_NUMBER", name: "マイナンバー", categoryHint: "IDENTITY", isSensitive: true, isSpecificPerson: true },
  { code: "SALARY_INFO", name: "給与情報", categoryHint: "HR" },
  { code: "HEALTH_CHECK_RESULT", name: "健康診断結果", categoryHint: "HR", isSensitive: true },
  { code: "RESUME", name: "履歴書", categoryHint: "RECRUITMENT" },
  { code: "WORK_HISTORY", name: "職務経歴", categoryHint: "RECRUITMENT" },
  { code: "ACCOUNT_INFO", name: "口座情報", categoryHint: "FINANCE" },
  { code: "EMERGENCY_CONTACT", name: "緊急連絡先", categoryHint: "HR" },
  { code: "FACE_IMAGE", name: "顔画像", categoryHint: "IDENTITY" },
];

export interface PersonalDataMasterMaps {
  categoriesByCode: Map<string, MasterRecord>;
  fieldsByCode: Map<string, DataFieldMasterRecord>;
}

export function buildPersonalDataMasterMaps(
  categories: MasterRecord[],
  fields: DataFieldMasterRecord[]
): PersonalDataMasterMaps {
  return {
    categoriesByCode: new Map(categories.map((item) => [item.code, item])),
    fieldsByCode: new Map(fields.map((item) => [item.code, item])),
  };
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function formatCodes(codes: string[], master: Map<string, MasterRecord | DataFieldMasterRecord>): string {
  return codes.map((code) => master.get(code)?.name ?? code).join("、");
}
