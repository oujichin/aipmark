import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_SOURCE_DOCUMENTS_PATH, scanSourceDocuments } from "@/lib/source-documents";

export async function GET() {
  return scan(DEFAULT_SOURCE_DOCUMENTS_PATH);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  return scan(body.folderPath || DEFAULT_SOURCE_DOCUMENTS_PATH);
}

async function scan(folderPath: string) {
  try {
    const documents = await scanSourceDocuments(folderPath);
    const categories = documents.reduce<Record<string, number>>((acc, doc) => {
      acc[doc.category] = (acc[doc.category] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      folderPath,
      total: documents.length,
      categories,
      documents,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "資料フォルダの読み取りに失敗しました" },
      { status: 400 },
    );
  }
}
