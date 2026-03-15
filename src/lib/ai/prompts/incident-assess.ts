export function buildIncidentAssessPrompt(input: {
  title: string;
  description: string;
  category: string;
  affectedCount: number | null;
  containsSensitive: boolean;
  containsMyNumber: boolean;
  dataTypes: string | null;
}): string {
  const categoryLabels: Record<string, string> = {
    LEAKAGE: "漏えい",
    LOSS: "紛失",
    DAMAGE: "毀損",
    UNAUTHORIZED_ACCESS: "不正アクセス",
    MISDIRECTION: "誤送付・誤配信",
    THEFT: "盗難",
    OTHER: "その他",
  };

  return `あなたはJIS Q 15001および個人情報保護法に精通したインシデント対応専門家です。
以下の事故報告内容に基づいて、深刻度と法定報告の要否を評価してください。

## 事故情報
- タイトル: ${input.title}
- 内容: ${input.description}
- 事故区分: ${categoryLabels[input.category] ?? input.category}
- 影響件数: ${input.affectedCount !== null ? `${input.affectedCount}件` : "不明"}
- 要配慮個人情報を含む: ${input.containsSensitive ? "はい" : "いいえ"}
- マイナンバーを含む: ${input.containsMyNumber ? "はい" : "いいえ"}
- 関連データ種別: ${input.dataTypes ?? "不明"}

## 法定報告の判断基準（個人情報保護法）
速報義務（概ね3〜5日以内）が発生するのは以下のいずれかに該当する場合:
1. 要配慮個人情報が含まれる場合
2. 不正アクセス等による漏えいの場合
3. 財産的被害が生じるおそれがある場合
4. 影響を受ける本人の数が1,000人を超える場合

## 出力形式（JSON）
以下の形式のJSONのみを返してください:

{
  "suggestedSeverity": "LOW | MEDIUM | HIGH | CRITICAL",
  "requiresSpeedReport": true または false,
  "reasoning": "判断の理由（2〜3文程度）",
  "suggestedActions": ["推奨対応アクション1", "推奨対応アクション2", ...]
}

suggestedActionsには具体的かつ実施可能な対応アクションを3〜5個提案してください。`;
}
