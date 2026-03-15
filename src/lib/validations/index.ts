import { NextResponse } from "next/server";
import { z } from "zod";

export function parseBody<T>(schema: z.ZodType<T>, data: unknown):
  { success: true; data: T } | { success: false; error: NextResponse } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const message = result.error.issues
    .map((issue: z.ZodIssue) => `${issue.path.join(".")}: ${issue.message}`)
    .join(", ");
  return { success: false, error: NextResponse.json({ error: message }, { status: 400 }) };
}
