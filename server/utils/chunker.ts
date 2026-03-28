export interface TextChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
}

export interface ParentChildChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  parentContent: string;
  parentChunkIndex: number;
  sectionTitle?: string;
}

/**
 * テキストをチャンクに分割する
 * 段落境界を優先し、最大トークン数を超えないようにする
 */
export function splitTextIntoChunks(
  text: string,
  options: {
    maxTokens?: number;
    overlapTokens?: number;
  } = {},
): TextChunk[] {
  const maxTokens = options.maxTokens || 500;
  const overlapTokens = options.overlapTokens || 100;
  const chunks: TextChunk[] = [];

  // 空テキストの場合
  const trimmed = text.trim();
  if (!trimmed) return [];

  // 段落に分割（空行区切り）
  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim());

  let currentChunk = "";
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokenCount(paragraph);

    // 単一段落がmaxTokensを超える場合、文単位で分割
    if (paragraphTokens > maxTokens) {
      // 現在のバッファをフラッシュ
      if (currentChunk.trim()) {
        chunks.push(createChunk(currentChunk.trim(), chunkIndex++));
        currentChunk = getOverlapText(currentChunk, overlapTokens);
      }

      const sentences = splitIntoSentences(paragraph);
      for (const sentence of sentences) {
        const combined = currentChunk ? currentChunk + "\n" + sentence : sentence;
        if (estimateTokenCount(combined) > maxTokens && currentChunk.trim()) {
          chunks.push(createChunk(currentChunk.trim(), chunkIndex++));
          currentChunk = getOverlapText(currentChunk, overlapTokens) + "\n" + sentence;
        } else {
          currentChunk = combined;
        }
      }
    } else {
      const combined = currentChunk ? currentChunk + "\n\n" + paragraph : paragraph;
      if (estimateTokenCount(combined) > maxTokens && currentChunk.trim()) {
        chunks.push(createChunk(currentChunk.trim(), chunkIndex++));
        currentChunk = getOverlapText(currentChunk, overlapTokens) + "\n\n" + paragraph;
      } else {
        currentChunk = combined;
      }
    }
  }

  // 残りをフラッシュ
  if (currentChunk.trim()) {
    chunks.push(createChunk(currentChunk.trim(), chunkIndex));
  }

  return chunks;
}

function createChunk(content: string, chunkIndex: number): TextChunk {
  return {
    content,
    chunkIndex,
    tokenCount: estimateTokenCount(content),
  };
}

/**
 * トークン数の簡易推定
 * 日本語: 1文字 ≈ 1〜2トークン、英語: 1単語 ≈ 1.3トークン
 */
export function estimateTokenCount(text: string): number {
  // 日本語文字数
  const japaneseChars = (text.match(/[\u3000-\u9FFF\uF900-\uFAFF]/g) || []).length;
  // 英語単語数
  const englishWords = text
    .replace(/[\u3000-\u9FFF\uF900-\uFAFF]/g, "")
    .split(/\s+/)
    .filter((w) => w).length;

  return Math.ceil(japaneseChars * 1.5 + englishWords * 1.3);
}

/**
 * トークン予算から安全な文字数上限を算出する（estimateTokenCountの逆変換）
 * 最悪ケース（全て日本語: 1文字≈1.5トークン）を想定して保守的に切る
 */
export function estimateMaxChars(tokenBudget: number): number {
  return Math.floor(tokenBudget / 1.5);
}

/**
 * テキスト末尾からオーバーラップ分のテキストを取得
 */
function getOverlapText(text: string, overlapTokens: number): string {
  const sentences = splitIntoSentences(text);
  let overlap = "";

  for (let i = sentences.length - 1; i >= 0; i--) {
    const candidate = sentences[i] + (overlap ? "\n" + overlap : "");
    if (estimateTokenCount(candidate) > overlapTokens) break;
    overlap = candidate;
  }

  return overlap;
}

/**
 * テキストを文単位に分割（日本語の句点 + 英語のピリオド対応）
 */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[。.!?\n])\s*/)
    .map((s) => s.trim())
    .filter((s) => s);
}

/**
 * テキストからMarkdownヘッダーに基づくセクションタイトルを検出する
 */
export function detectSectionTitle(text: string): string | undefined {
  const lines = text.split("\n");
  for (const line of lines) {
    const match = line.match(/^#{1,3}\s+(.+)$/);
    if (match) return match[1].trim();
  }
  return undefined;
}

/**
 * 親子チャンク構造でテキストを分割する
 * 親チャンク（大）で文脈を保持し、子チャンク（小）で精密検索する
 */
export function splitTextIntoParentChildChunks(
  text: string,
  options: {
    parentMaxTokens?: number;
    childMaxTokens?: number;
    overlapTokens?: number;
  } = {},
): ParentChildChunk[] {
  const parentMaxTokens = options.parentMaxTokens || 800;
  const childMaxTokens = options.childMaxTokens || 250;
  const overlapTokens = options.overlapTokens || 50;

  // まず親チャンクに分割
  const parentChunks = splitTextIntoChunks(text, {
    maxTokens: parentMaxTokens,
    overlapTokens: 0, // 親チャンク間のオーバーラップは不要（子が担う）
  });

  const childChunks: ParentChildChunk[] = [];
  let globalChildIndex = 0;

  for (const parent of parentChunks) {
    // 親チャンクのセクションタイトルを検出
    const sectionTitle = detectSectionTitle(parent.content);

    // 親チャンクを子チャンクに細分化
    const children = splitTextIntoChunks(parent.content, {
      maxTokens: childMaxTokens,
      overlapTokens,
    });

    for (const child of children) {
      childChunks.push({
        content: child.content,
        chunkIndex: globalChildIndex++,
        tokenCount: child.tokenCount,
        parentContent: parent.content,
        parentChunkIndex: parent.chunkIndex,
        sectionTitle,
      });
    }
  }

  return childChunks;
}

/**
 * PDFのバイナリからテキストを抽出する
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = await import("pdf-parse").then((m) => m.default || m);
    const result = await pdfParse(buffer);
    return result.text;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`PDF解析に失敗しました: ${detail}`);
  }
}

/**
 * DOCXファイルからテキストを抽出する
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`DOCX解析に失敗しました: ${detail}`);
  }
}

/**
 * HTMLファイルからテキストを抽出する
 */
export async function extractTextFromHtml(buffer: Buffer): Promise<string> {
  try {
    const cheerio = await import("cheerio");
    const html = buffer.toString("utf-8");
    const $ = cheerio.load(html);

    // script, style タグを除去
    $("script, style, noscript").remove();

    // テキストを抽出（改行を保持）
    return $("body").text().replace(/\s+/g, " ").trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`HTML解析に失敗しました: ${detail}`);
  }
}

/**
 * RFC 4180準拠のCSVフィールドパーサー
 * 引用符内のカンマ・改行・エスケープ引用符を正しく処理する
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * CSVテキストを引用符状態を考慮してレコード（行）に分割する
 * RFC 4180準拠: フィールド内の改行・エスケープ引用符("")を正しく処理する
 */
function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // エスケープ引用符 ("") → そのまま保持
          current += '""';
          i++;
        } else {
          // 引用符閉じ
          current += '"';
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        current += '"';
        inQuotes = true;
      } else if (ch === "\r") {
        // \r は無視（\r\n の場合は \n で処理）
        continue;
      } else if (ch === "\n") {
        if (current.trim()) records.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }

  // 最終レコード
  if (current.trim()) records.push(current);

  return records;
}

/**
 * CSVファイルからテキストを抽出する
 * 各行をテキストブロックとして結合する
 */
export function extractTextFromCsv(buffer: Buffer): string {
  // BOM除去
  let text = buffer.toString("utf-8");
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const records = splitCsvRecords(text);

  if (records.length === 0) return "";

  // ヘッダー行を取得
  const headers = parseCsvLine(records[0]);

  // 各データ行をヘッダー付きテキストに変換
  const rows = records.slice(1).map((record) => {
    const values = parseCsvLine(record);
    return headers
      .map((header, i) => `${header}: ${values[i] || ""}`)
      .join(" / ");
  });

  return rows.join("\n\n");
}

/**
 * MIMEタイプに応じてテキストを抽出する
 */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case "application/pdf":
      return extractTextFromPdf(buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return extractTextFromDocx(buffer);
    case "text/html":
      return extractTextFromHtml(buffer);
    case "text/csv":
      return extractTextFromCsv(buffer);
    case "text/plain":
    case "text/markdown":
    case "application/json":
    case "application/octet-stream":
      return buffer.toString("utf-8");
    default:
      throw new Error(`未対応のファイル形式: ${mimeType}`);
  }
}
