export function buildReviewSummaryPrompt(input: {
  fiscalYear: number;
  riskStats: { total: number; highRisk: number; treated: number };
  trainingStats: { sessions: number; participants: number; avgScore: number | null };
  vendorStats: { total: number; evaluated: number; ratingBreakdown: Record<string, number> };
  auditStats: { plans: number; findings: number; corrected: number };
  incidentStats: { total: number; bySeverity: Record<string, number>; closed: number };
}): string {
  const ratingText = Object.entries(input.vendorStats.ratingBreakdown)
    .map(([k, v]) => `${k}: ${v}件`)
    .join("、");

  const severityText = Object.entries(input.incidentStats.bySeverity)
    .map(([k, v]) => `${k}: ${v}件`)
    .join("、");

  return `あなたはJIS Q 15001に精通した個人情報保護マネジメントの専門家です。
以下のデータに基づいて、マネジメントレビュー向けの各モジュールサマリーを生成してください。

## 対象年度: ${input.fiscalYear}年度

## リスク管理実績
- リスクアイテム総数: ${input.riskStats.total}件
- 高リスク（リスク値6以上）: ${input.riskStats.highRisk}件
- 対策実施済み: ${input.riskStats.treated}件

## 教育実績
- 教育セッション数: ${input.trainingStats.sessions}件
- 受講者数: ${input.trainingStats.participants}名
- 平均テストスコア: ${input.trainingStats.avgScore !== null ? `${input.trainingStats.avgScore}点` : "未実施"}

## 委託先管理実績
- 委託先総数: ${input.vendorStats.total}社
- 評価実施済み: ${input.vendorStats.evaluated}社
- 評価内訳: ${ratingText || "未評価"}

## 監査実績
- 監査計画数: ${input.auditStats.plans}件
- 指摘事項数: ${input.auditStats.findings}件
- 是正完了数: ${input.auditStats.corrected}件

## 事故対応実績
- 事故件数: ${input.incidentStats.total}件
- 深刻度別: ${severityText || "発生なし"}
- 対応完了: ${input.incidentStats.closed}件

## 出力形式（JSON）
以下の形式のJSONのみを返してください:

{
  "riskSummary": "リスク管理に関するサマリー（3〜5文）",
  "trainingSummary": "教育に関するサマリー（3〜5文）",
  "vendorSummary": "委託先管理に関するサマリー（3〜5文）",
  "auditSummary": "監査に関するサマリー（3〜5文）",
  "incidentSummary": "事故対応に関するサマリー（3〜5文）"
}

各サマリーには以下を含めてください:
1. 当期の実績概要
2. 良かった点・改善した点
3. 課題・改善提案`;
}
