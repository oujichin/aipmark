export function buildRegisterCandidatesPrompt(input: {
  processName: string;
  processDescription: string;
  hearingAnswers: Record<string, string>;
  hypotheses?: Array<{ topic: string; answer?: string }>;
  dataCategories: Array<{ code: string; name: string; description?: string | null }>;
  dataFields: Array<{ code: string; name: string; description?: string | null }>;
}): string {
  const answersText = Object.entries(input.hearingAnswers)
    .map(([q, a]) => `Q: ${q}\nA: ${a}`)
    .join("\n\n");

  const hypothesesText = input.hypotheses && input.hypotheses.length > 0
    ? input.hypotheses.map((h) => `- ${h.topic}: ${h.answer ?? "（未回答）"}`).join("\n")
    : "（なし）";
  const categoriesText = input.dataCategories
    .map((item) => `- ${item.code}: ${item.name}${item.description ? ` (${item.description})` : ""}`)
    .join("\n");
  const fieldsText = input.dataFields
    .map((item) => `- ${item.code}: ${item.name}${item.description ? ` (${item.description})` : ""}`)
    .join("\n");

  return `あなたはJIS Q 15001に精通した個人情報保護コンサルタントです。
以下の業務プロセス情報とヒアリング回答をもとに、個人情報取扱台帳の候補項目を生成してください。

## 業務プロセス
- プロセス名: ${input.processName}
- 説明: ${input.processDescription}

## ヒアリング回答
${answersText}

## 事前仮説の確認状況
${hypothesesText}

## 個人情報区分マスタ
以下のコードのみ使用してください。新しい区分を作らないでください。
${categoriesText}

## 個人情報項目マスタ
以下のコードのみ使用してください。新しい項目を作らないでください。
${fieldsText}

## 出力形式（JSON配列）
以下の形式のJSONのみを返してください。dataCategoryCodes と dataFieldCodes は必ず上記マスタのコード配列にしてください。confirmationStatusはヒアリング回答で明確に確認できた場合はCONFIRMED、推定の場合はINFERRED、不明な場合はUNCONFIRMEDとしてください：

[
  {
    "dataSubject": "データ主体（例：顧客、従業員）",
    "dataCategoryCodes": ["GENERAL"],
    "dataFieldCodes": ["FULL_NAME", "EMAIL_ADDRESS"],
    "purpose": "取得・利用目的",
    "legalBasis": "法的根拠（例：契約の履行、法令に基づく義務）",
    "retentionPeriod": "保存期間（例：3年間）",
    "storageLocation": "保存場所・システム名",
    "thirdPartyProvision": "NONE | DOMESTIC | OVERSEAS",
    "confirmationStatus": "CONFIRMED | INFERRED | UNCONFIRMED",
    "inferenceBasis": "推定の場合はその根拠"
  }
]`;
}
