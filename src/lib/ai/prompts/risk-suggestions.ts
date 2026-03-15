export function buildRiskSuggestionsPrompt(input: {
  processName: string;
  processDescription: string;
  existingRiskCount: number;
}): string {
  return `あなたはJIS Q 15001に精通したリスクアセスメント専門家です。
以下の業務プロセス情報をもとに、個人情報のライフサイクル段階別にリスク候補を生成してください。

## 業務プロセス
- プロセス名: ${input.processName}
- 説明: ${input.processDescription}
- 既存リスクアイテム数: ${input.existingRiskCount}件

## ライフサイクル段階
以下の6段階すべてについて、少なくとも1つずつリスクを提案してください:
- ACQUISITION（取得）
- USE（利用）
- STORAGE（保管）
- PROVISION（提供）
- ENTRUSTMENT（委託）
- DISPOSAL（廃棄）

## 出力形式（JSON配列）
以下の形式のJSONのみを返してください:

[
  {
    "lifecycleStage": "ACQUISITION | USE | STORAGE | PROVISION | ENTRUSTMENT | DISPOSAL",
    "description": "リスクの説明",
    "threatSource": "脅威源（例：内部者の不注意、外部攻撃者）",
    "vulnerability": "脆弱性（例：教育不足、アクセス制御の不備）",
    "likelihood": 1〜3の整数（1:低 2:中 3:高）,
    "impact": 1〜3の整数（1:低 2:中 3:高）
  }
]

実務的かつ具体的なリスクを提案してください。一般論ではなく、この業務プロセスに特有のリスクを重視してください。`;
}
