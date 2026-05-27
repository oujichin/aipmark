import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// POST /api/upload — ファイルアップロード（ローカル保存）
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), "uploads", Date.now().toString());
  await mkdir(uploadDir, { recursive: true });

  const uploaded: { name: string; path: string; size: number }[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(uploadDir, file.name);
    await writeFile(filePath, buffer);
    uploaded.push({
      name: file.name,
      path: filePath,
      size: file.size,
    });
  }

  return NextResponse.json({ files: uploaded });
}
