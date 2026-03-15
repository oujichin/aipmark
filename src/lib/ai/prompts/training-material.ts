export function buildTrainingMaterialPrompt(input: {
  sessionTitle: string;
  topic: string;
  questionCount: number;
}): string {
  return `あなたはJIS Q 15001に精通した個人情報保護教育の専門家です。
以下のテーマに基づいて、教育用クイズ問題を生成してください。

## 教育セッション
- セッション名: ${input.sessionTitle}
- テーマ: ${input.topic}
- 問題数: ${input.questionCount}問

## 出力形式（JSON配列）
以下の形式のJSONのみを返してください:

[
  {
    "questionText": "問題文",
    "questionType": "SINGLE_CHOICE | MULTI_CHOICE | TRUE_FALSE",
    "options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
    "correctAnswer": "正解（SINGLE_CHOICEの場合は文字列、MULTI_CHOICEの場合は文字列配列、TRUE_FALSEの場合は\"TRUE\"または\"FALSE\"）",
    "points": 配点（1〜3の整数）
  }
]

## 問題作成のガイドライン
- 実務に即した具体的なシナリオベースの問題を含める
- 単純な知識確認だけでなく、判断力を問う問題も含める
- 難易度を段階的に上げる（易→中→難）
- SINGLE_CHOICEを中心に、TRUE_FALSEやMULTI_CHOICEも適度に混ぜる
- options は TRUE_FALSE の場合は ["TRUE", "FALSE"] とする
- 配点は難易度に応じて1〜3とする`;
}
