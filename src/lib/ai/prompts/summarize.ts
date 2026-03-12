export function buildSummarizePrompt(content: string, context?: string): string {
  return `以下のテキストを個人情報保護マネジメントの観点から要約してください。
${context ? `\n## コンテキスト\n${context}\n` : ""}
## 対象テキスト
${content}

## 出力
以下の形式で回答してください：
1. **概要**（2〜3文）
2. **個人情報に関連するポイント**（箇条書き）
3. **対応が必要な事項**（あれば）`;
}
