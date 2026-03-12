export function buildResearchProfilePrompt(input: {
  companyName: string;
  industry?: string;
  sources: Array<{ sourceType: string; title: string; snippet?: string }>;
}): string {
  const sourceText = input.sources.length > 0
    ? input.sources.map((s) => `[${s.sourceType}] ${s.title}\n${s.snippet ?? ""}`).join("\n\n")
    : "（調査ソースなし）";

  return `あなたはプライバシーマーク（JIS Q 15001）対応の個人情報保護コンサルタントです。
以下の会社情報と調査ソースをもとに、この企業が保有していると推定される個人情報の概要プロファイルを作成してください。

## 企業情報
- 会社名: ${input.companyName}
- 業種: ${input.industry ?? "不明"}

## 調査ソース
${sourceText}

## 出力形式（JSON）
以下の形式でJSONのみを返してください：

{
  "companyOverview": "事業概要（2〜3文）",
  "industryType": "業種",
  "employeeCount": "従業員規模の推定（例：50〜200名規模）",
  "mainServices": "主要サービス・製品（箇条書き、配列）",
  "dataSubjectsEst": "推定されるデータ主体（例：顧客、従業員、求職者）",
  "systemsEst": "推定される保有システム・DB（例：CRM、給与システム）",
  "aiSummary": "個人情報保護の観点からの総合サマリー（3〜5文）"
}`;
}

export function buildInterviewHypothesesPrompt(input: {
  companyName: string;
  profile: {
    companyOverview?: string;
    industryType?: string;
    dataSubjectsEst?: string;
    systemsEst?: string;
  };
  processName: string;
  processDescription: string;
}): string {
  return `あなたはプライバシーマーク審査に精通した個人情報保護コンサルタントです。
以下の会社プロファイルと業務プロセス情報をもとに、ヒアリング前に確認すべき論点と質問を生成してください。

## 会社プロファイル
- 会社名: ${input.companyName}
- 業種: ${input.profile.industryType ?? "不明"}
- 概要: ${input.profile.companyOverview ?? "不明"}
- 推定データ主体: ${input.profile.dataSubjectsEst ?? "不明"}
- 推定システム: ${input.profile.systemsEst ?? "不明"}

## 対象業務プロセス
- プロセス名: ${input.processName}
- 説明: ${input.processDescription}

## 出力形式（JSON配列）
優先度の高い順に5〜8件、以下の形式のJSONのみを返してください：

[
  {
    "topic": "確認論点（短い見出し）",
    "question": "具体的な確認質問（担当者に聞く文章）",
    "hypothesis": "AIの仮説（〜と推定される、等）",
    "confidenceLevel": "HIGH | MEDIUM | LOW",
    "priority": 1,
    "basis": "仮説の根拠（会社プロファイルのどの情報から推定したか）"
  }
]`;
}
