import { getGenerativeModel } from "./vertex-ai";
import { EXTERNAL_API_TIMEOUT_MS, CONTEXT_PREFIX_BATCH_SIZE } from "./constants";

/**
 * ドキュメント全文の要約を生成する（Contextual Retrieval用）
 * チャンク数が多い場合にコスト削減のため、全文をそのまま渡すのではなく要約を使う
 */
export async function generateDocumentSummary(
  fullText: string,
  documentTitle: string,
): Promise<string> {
  // テキストが短い場合はそのまま返す（要約不要）
  const maxDirectLength = 3000;
  if (fullText.length <= maxDirectLength) {
    return `タイトル: ${documentTitle}\n\n${fullText}`;
  }

  const model = getGenerativeModel();

  const prompt = `以下のドキュメントの内容を300文字以内で要約してください。
主要なトピック、セクション構成、対象者を含めてください。

## タイトル: ${documentTitle}

## 本文
${fullText.slice(0, 8000)}

## 要約（300文字以内）`;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Document summary generation timeout")),
          EXTERNAL_API_TIMEOUT_MS,
        );
      }),
    ]);
    clearTimeout(timeoutId);

    const summary = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return `タイトル: ${documentTitle}\n\n${summary.trim()}`;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("[context-generator] Failed to generate document summary:", error);
    return `タイトル: ${documentTitle}\n\n${fullText.slice(0, maxDirectLength)}`;
  }
}

/**
 * バッチ内の複数チャンクのプレフィックスを1回のGeminiコールで生成する
 * 番号付きの出力をパースして各チャンクのプレフィックスを返す
 */
async function generatePrefixesInSingleCall(
  documentSummary: string,
  chunkContents: string[],
): Promise<string[]> {
  const model = getGenerativeModel();

  // プロンプトサイズ防御: チャンク内容を切り詰め（プレフィックス生成には冒頭で十分）
  const maxChunkCharsForPrompt = 1000;
  const chunksSection = chunkContents
    .map((content, i) => `## テキスト${i + 1}\n${content.slice(0, maxChunkCharsForPrompt)}`)
    .join("\n\n");

  const prompt = `以下のドキュメントから抜粋された${chunkContents.length}個のテキストについて、それぞれのドキュメント全体の中での位置づけを日本語で1-2文で簡潔に説明してください。
「このセクションは〜」「この部分は〜」のような形式で、番号付きで回答してください。

## ドキュメント概要
${documentSummary}

${chunksSection}

## 回答（${chunkContents.length}個、番号付きで各1-2文）`;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Batch context generation timeout")),
          EXTERNAL_API_TIMEOUT_MS * 2, // バッチ処理のため余裕を持たせる
        );
      }),
    ]);
    clearTimeout(timeoutId);

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return parseBatchPrefixes(text, chunkContents.length);
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("[context-generator] Batch prefix generation failed:", error);
    return new Array(chunkContents.length).fill("");
  }
}

/**
 * 番号付きのGemini出力をパースして各チャンクのプレフィックスを抽出する
 * パース失敗時は空文字にフォールバック
 */
function parseBatchPrefixes(text: string, expectedCount: number): string[] {
  const results: string[] = new Array(expectedCount).fill("");

  // 「1. ...」「1: ...」「1） ...」「**1.** ...」などの番号付きパターンにマッチ
  const lines = text.split("\n").filter((l) => l.trim());
  const numberPattern = /^\s*\*{0,2}(\d+)\*{0,2}[.):）]\s*\*{0,2}\s*(.+)/;

  for (const line of lines) {
    const match = line.match(numberPattern);
    if (match) {
      const index = parseInt(match[1], 10) - 1; // 1-based → 0-based
      if (index >= 0 && index < expectedCount) {
        results[index] = match[2].trim();
      }
    }
  }

  const parsed = results.filter((r) => r).length;
  if (parsed < expectedCount) {
    console.warn(
      `[context-generator] Parsed ${parsed}/${expectedCount} prefixes from batch output`,
    );
  }

  return results;
}

/**
 * 複数チャンクの文脈プレフィックスをバッチ生成する
 * 複数チャンクを1回のGeminiコールにまとめてAPIコール数を削減する
 * 同時実行数を制限しつつ並行処理でスループットを確保する
 */
export async function generateContextPrefixBatch(
  documentSummary: string,
  chunkContents: string[],
): Promise<string[]> {
  const results: string[] = new Array(chunkContents.length).fill("");
  const batchSize = CONTEXT_PREFIX_BATCH_SIZE;
  const concurrency = 3;

  // バッチを分割
  const batches: { start: number; contents: string[] }[] = [];
  for (let i = 0; i < chunkContents.length; i += batchSize) {
    batches.push({ start: i, contents: chunkContents.slice(i, i + batchSize) });
  }

  // concurrency 個ずつ並行実行
  for (let i = 0; i < batches.length; i += concurrency) {
    const group = batches.slice(i, i + concurrency);
    const groupResults = await Promise.all(
      group.map((b) => generatePrefixesInSingleCall(documentSummary, b.contents)),
    );
    groupResults.forEach((batchResults, gi) => {
      const start = group[gi].start;
      batchResults.forEach((result, j) => {
        results[start + j] = result;
      });
    });
  }

  console.warn(
    `[context-generator] Generated ${results.filter((r) => r).length}/${chunkContents.length} context prefixes (${batches.length} API calls, concurrency=${concurrency})`,
  );

  return results;
}
