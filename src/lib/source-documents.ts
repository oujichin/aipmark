import { readdir, stat } from "fs/promises";
import path from "path";

export const DEFAULT_SOURCE_DOCUMENTS_PATH =
  path.join(process.cwd(), "templates", "pmark");

const SUPPORTED_EXTENSIONS = new Set([
  ".docx",
  ".doc",
  ".xlsx",
  ".xls",
  ".pdf",
  ".txt",
  ".csv",
  ".ppt",
  ".pptx",
]);

function toReadableFsPath(inputPath: string): string {
  if (process.platform === "win32") return inputPath;

  const windowsDrivePath = inputPath.match(/^([a-zA-Z]):\\(.*)$/);
  if (!windowsDrivePath) return inputPath;

  const drive = windowsDrivePath[1].toLowerCase();
  const rest = windowsDrivePath[2].replace(/\\/g, "/");
  return `/mnt/${drive}/${rest}`;
}

export interface SourceDocument {
  name: string;
  absolutePath: string;
  relativePath: string;
  category: string;
  extension: string;
  size: number;
  modifiedAt: string;
}

export interface ImportedTemplateDocument extends SourceDocument {
  importedPath: string;
  description: string;
}

function classifyDocument(relativePath: string, fileName: string): string {
  const target = `${relativePath}/${fileName}`;
  if (target.includes("04_審査報告書") || fileName.includes("様式A") || fileName.includes("様式B") || fileName.includes("様式C")) {
    return "審査評価・指摘対応";
  }
  if (target.includes("01_申請書") || fileName.includes("審査申請書")) return "審査申請書";
  if (target.includes("02_PMS文書") || fileName.includes("PMS文書")) return "PMS文書";
  if (fileName.includes("個人情報管理台帳")) return "個人情報管理台帳";
  if (fileName.includes("リスク分析")) return "リスク分析表";
  if (fileName.includes("規程") || fileName.includes("規方針") || fileName.includes("方針")) return "規程・方針";
  if (fileName.includes("法規")) return "法規等管理台帳";
  if (fileName.includes("教育")) return "教育関連";
  if (fileName.includes("監査")) return "監査関連";
  if (fileName.includes("マネジメントレビュー")) return "マネジメントレビュー";
  if (target.includes("03_当日の準備")) return "審査当日準備";
  if (target.includes("00_案内資料")) return "案内資料";
  if (target.includes("01_インプット資料")) return "インプット資料";
  return "参考資料";
}

async function walkDirectory(rootPath: string, currentPath: string): Promise<SourceDocument[]> {
  const entries = await readdir(currentPath, { withFileTypes: true });
  const documents: SourceDocument[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      documents.push(...await walkDirectory(rootPath, absolutePath));
      continue;
    }

    if (!entry.isFile()) continue;

    const extension = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) continue;

    const fileStat = await stat(absolutePath);
    const relativePath = path.relative(rootPath, absolutePath);
    documents.push({
      name: entry.name,
      absolutePath,
      relativePath,
      category: classifyDocument(relativePath, entry.name),
      extension: extension.replace(".", ""),
      size: fileStat.size,
      modifiedAt: fileStat.mtime.toISOString(),
    });
  }

  return documents.sort((a, b) => a.relativePath.localeCompare(b.relativePath, "ja"));
}

export async function scanSourceDocuments(folderPath: string): Promise<SourceDocument[]> {
  const resolved = path.resolve(toReadableFsPath(folderPath));
  const folderStat = await stat(resolved);
  if (!folderStat.isDirectory()) {
    throw new Error("指定されたパスはフォルダではありません");
  }
  return walkDirectory(resolved, resolved);
}

export async function importSourceDocuments(folderPath: string): Promise<ImportedTemplateDocument[]> {
  const documents = await scanSourceDocuments(folderPath);
  return documents.map(doc => ({
    ...doc,
    importedPath: doc.absolutePath,
    description: `テンプレート/${doc.category}: ${doc.relativePath}`,
  }));
}

export function buildSourceMaterialBrief(files: { name: string; description: string; path: string }[]): string {
  if (files.length === 0) return "No files uploaded.";

  const grouped = new Map<string, { name: string; path: string; description: string }[]>();
  for (const file of files) {
    const category = file.description.split(":")[0] || "参考資料";
    grouped.set(category, [...(grouped.get(category) ?? []), file]);
  }

  return [...grouped.entries()]
    .map(([category, categoryFiles]) => [
      `### ${category}`,
      ...categoryFiles.map(file => `- ${file.name}\n  - template_path: ${file.path}\n  - template_note: ${file.description}`),
    ].join("\n"))
    .join("\n\n");
}

export async function buildDefaultTemplateLibraryBrief(): Promise<string> {
  try {
    const files = await importSourceDocuments(DEFAULT_SOURCE_DOCUMENTS_PATH);
    if (files.length === 0) return "No template files found.";
    return buildSourceMaterialBrief(files.map(file => ({
      name: file.name,
      description: file.description,
      path: file.importedPath,
    })));
  } catch {
    return "No template files found.";
  }
}

export const TEMPLATE_USAGE_RULES = `## テンプレートライブラリの使用ルール
- テンプレートは申請書・PMS文書・台帳・規程・審査対応文書の章立て、項目、記載粒度、言い回しの見本として使う
- 過去資料に含まれる会社名、住所、担当者、従業員数、業務内容、委託先、リスク評価、審査指摘を今回データとして流用しない
- 今回企業の事実は、対象会社HP、ヒアリング、ユーザー回答、今回アップロードされた会社固有資料から新規に作る
- テンプレート参照は template_ref / template_path として扱い、対象会社の証跡 evidence.source_ref には入れない
- 前回セッションの続きでも、現在のDB状態から不足している工程を判断し、業務フローに沿って台帳、リスク分析、PMS文書、申請書類の作成へ進める`;
