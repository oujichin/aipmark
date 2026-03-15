/**
 * 指定したキーのうち、値が undefined でないものだけを含むオブジェクトを返す。
 * Prisma の update で「送られたフィールドだけ更新する」パターンを簡潔に書ける。
 */
export function pickDefined<T extends Record<string, unknown>>(
  data: T,
  keys: (keyof T)[],
): Partial<T> {
  const result: Partial<T> = {};
  for (const key of keys) {
    if (data[key] !== undefined) {
      result[key] = data[key];
    }
  }
  return result;
}
