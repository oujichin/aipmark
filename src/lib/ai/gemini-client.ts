import { GoogleGenerativeAI } from "@google/generative-ai";

let _client: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!_client) {
    if (!process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY === "your-key-here") {
      throw new Error("GOOGLE_API_KEY が設定されていません。.env.local を確認してください。");
    }
    _client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  }
  return _client;
}

export const MODEL = "gemini-2.0-flash";
