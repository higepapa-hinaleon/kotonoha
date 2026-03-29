import { getGenerativeModel } from "./vertex-ai";
import type { RagResult } from "./rag";
import { buildContextFromResults } from "./rag";
import { DEFAULT_SYSTEM_PROMPT, EXTERNAL_API_TIMEOUT_MS } from "./constants";

export interface GeminiResponse {
  content: string;
  confidence: number;
}

/**
 * RAG結果をコンテキストとしてGeminiにチャットリクエストを送信する
 */
export async function generateChatResponse(
  userMessage: string,
  ragResults: RagResult[],
  options: {
    systemPrompt?: string;
    conversationHistory?: { role: "user" | "assistant"; content: string }[];
    feedbackContext?: string;
  } = {},
): Promise<GeminiResponse> {
  const model = getGenerativeModel();
  const context = buildContextFromResults(ragResults);

  const basePrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;

  // 確信度指示は常に付加（管理者プロンプトで上書きされないように分離）
  const confidenceInstruction = `

【重要：以下の指示は必ず守ってください】
回答の最後に、回答内容に対する自信度を0.0〜1.0のスケールで必ず示してください。
形式: [CONFIDENCE:0.85]
- ドキュメントに明確な情報がある場合: 0.7〜1.0
- 部分的な情報がある場合: 0.4〜0.7
- ほとんど情報がない場合: 0.0〜0.3`;

  // 訂正情報がある場合、優先参照の指示を追加
  const feedbackPriorityInstruction = options.feedbackContext
    ? `

【訂正情報について】
参考情報の中に、管理者が過去の誤回答を訂正した情報が含まれています。
訂正情報は管理者が検証済みの内容であるため、ドキュメント由来の情報と矛盾する場合は訂正情報を優先してください。`
    : "";

  const systemPrompt = basePrompt + confidenceInstruction + feedbackPriorityInstruction;

  // フィードバック情報をドキュメント参照と統合（訂正情報はサブヘッダーで区別）
  const combinedContext = options.feedbackContext
    ? context
      ? `${context}\n\n### 訂正情報\n${options.feedbackContext}`
      : `### 訂正情報\n${options.feedbackContext}`
    : context;

  const contextSection = combinedContext
    ? `\n\n## 参考情報\n${combinedContext}`
    : "\n\n## 参考情報\n(関連する情報が見つかりませんでした)";

  if (options.feedbackContext) {
    console.warn(`[gemini] Feedback context integrated (${options.feedbackContext.length} chars)`);
  }
  console.warn(
    `[gemini] Generating response with ${ragResults.length} RAG chunks, combined context length=${combinedContext.length} chars`,
  );

  // 会話履歴を構築
  const contents = [];

  // 過去の会話履歴
  if (options.conversationHistory) {
    for (const msg of options.conversationHistory) {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }
  }

  // 現在のユーザーメッセージ
  contents.push({
    role: "user" as const,
    parts: [{ text: `${userMessage}${contextSection}` }],
  });

  const result = await Promise.race([
    model.generateContent({
      systemInstruction: { role: "system" as const, parts: [{ text: systemPrompt }] },
      contents,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini API timeout")), EXTERNAL_API_TIMEOUT_MS),
    ),
  ]);

  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // 確信度を抽出
  const confidence = extractConfidence(responseText);

  // 確信度タグ・参照マーカーを除去した回答テキスト
  const cleanContent = responseText
    .replace(/\[CONFIDENCE:\s*[0-9.]+\]/g, "")
    .replace(/[（(]参照[\d,\s、]+[）)]/g, "")
    .trim();

  console.warn(
    `[gemini] Response generated: ${cleanContent.length} chars, confidence=${confidence}`,
  );

  return {
    content: cleanContent,
    confidence,
  };
}

/**
 * レスポンスから確信度を抽出する
 */
function extractConfidence(text: string): number {
  const match = text.match(/\[CONFIDENCE:\s*([0-9.]+)\]/);
  if (match) {
    const value = parseFloat(match[1]);
    if (!isNaN(value) && value >= 0 && value <= 1) {
      return value;
    }
  }
  // 確信度タグがない場合、コンテキストの有無で推定
  return 0.5;
}
