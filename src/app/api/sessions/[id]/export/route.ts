import { NextRequest, NextResponse } from "next/server";
import { requestExport } from "@/lib/session-orchestrator";

// POST /api/sessions/[id]/export — オンデマンド帳票エクスポート (v1.2 Phase 4)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { documentType } = body as { documentType: string };

  if (!documentType) {
    return NextResponse.json({ error: "documentType is required" }, { status: 400 });
  }

  requestExport(id, documentType).catch(err => {
    console.error("[Export Error]", err);
  });

  return NextResponse.json({ status: "export_started" });
}
