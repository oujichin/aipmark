/**
 * 入力テキストのサニタイズ: 制御文字除去・トリム・長さ制限
 * AI APIの入力テキストに使用する
 */
export function sanitize(input: string, maxLength = 200): string {
  return input
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim()
    .slice(0, maxLength);
}
