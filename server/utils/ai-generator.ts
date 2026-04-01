import { getGenerativeModel } from "./vertex-ai";

/**
 * Geminiに構造化JSONレスポンスを要求する共通ヘルパー
 * FAQ自動生成、レポート生成、改善要望分類で共通利用
 */
export async function generateStructuredJson<T>(
  systemPrompt: string,
  userMessage: string,
): Promise<T> {
  const model = getGenerativeModel();

  const result = await model.generateContent({
    systemInstruction: { role: "system" as const, parts: [{ text: systemPrompt }] },
    contents: [
      {
        role: "user" as const,
        parts: [{ text: userMessage }],
      },
    ],
  });

  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // JSON部分を抽出（```json ブロック or 直接 JSON）
  const jsonMatch =
    responseText.match(/```json\s*\n?([\s\S]*?)\n?\s*```/) || responseText.match(/(\{[\s\S]*\})/);

  if (!jsonMatch || !jsonMatch[1]) {
    throw createError({
      statusCode: 500,
      statusMessage: "AIからの応答をJSON形式で解析できませんでした",
    });
  }

  try {
    return JSON.parse(jsonMatch[1]) as T;
  } catch (err) {
    console.error("[ai-generator] JSON parse failed:", err);
    throw createError({
      statusCode: 500,
      statusMessage: "AIからの応答のJSON解析に失敗しました",
    });
  }
}
