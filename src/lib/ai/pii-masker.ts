// PII masking before sending to Claude API
// Masks common Japanese PII patterns

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Email
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL]" },
  // Japanese phone numbers
  { pattern: /0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4}/g, replacement: "[TEL]" },
  // Japanese postal codes
  { pattern: /〒?\d{3}[-\s]?\d{4}/g, replacement: "[POSTAL]" },
  // Credit card-like numbers
  { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: "[CARD]" },
  // My Number (マイナンバー) - 12 digit number
  { pattern: /\b\d{12}\b/g, replacement: "[MYNUMBER]" },
];

export function maskPII(text: string): { masked: string; hasPII: boolean } {
  let masked = text;
  let hasPII = false;

  for (const { pattern, replacement } of PII_PATTERNS) {
    const before = masked;
    masked = masked.replace(pattern, replacement);
    if (masked !== before) hasPII = true;
  }

  return { masked, hasPII };
}
