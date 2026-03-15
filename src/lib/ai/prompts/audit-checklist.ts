export function buildAuditChecklistPrompt(input: {
  auditTitle: string;
  scope: string;
  targetDepartments: string[];
}): string {
  const deptList = input.targetDepartments.length > 0
    ? input.targetDepartments.join("、")
    : "（全部門）";

  return `あなたはJIS Q 15001に精通した内部監査専門家です。
以下の監査計画に基づいて、監査チェックリストを生成してください。

## 監査計画
- タイトル: ${input.auditTitle}
- 監査範囲: ${input.scope}
- 対象部門: ${deptList}

## JIS Q 15001 主要条項カテゴリ
以下のカテゴリをバランスよくカバーしてください:
- 個人情報保護方針
- 組織・体制
- 個人情報の特定・台帳管理
- リスクアセスメント
- 安全管理措置（組織的・人的・物理的・技術的）
- 従業者の教育
- 委託先の管理
- 個人情報の取得・利用・提供
- 本人関与（開示・訂正・利用停止等）
- 苦情・相談対応
- 事故対応
- 内部監査・マネジメントレビュー

## 出力形式（JSON配列）
以下の形式のJSONのみを返してください:

[
  {
    "category": "JIS条項カテゴリ名",
    "question": "監査質問（具体的で回答しやすい形式）",
    "responseType": "YES_NO | RATING | TEXT"
  }
]

チェック項目は15〜25項目程度とし、YES_NOを中心に、必要に応じてRATINGやTEXTも混ぜてください。`;
}
