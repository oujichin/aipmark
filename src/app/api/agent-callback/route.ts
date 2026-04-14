import { NextRequest, NextResponse } from "next/server";

// POST /api/agent-callback — Anthropic Managed Agent からのWebhookコールバック
// (将来的にWebhookが必要になった場合のエンドポイント)
export async function POST(request: NextRequest) {
  const body = await request.json();

  // TODO: Webhook signature検証

  console.log("[agent-callback] received:", JSON.stringify(body).slice(0, 200));

  return NextResponse.json({ status: "ok" });
}
