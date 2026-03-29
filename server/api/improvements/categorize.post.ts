import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import { generateStructuredJson } from "~~/server/utils/ai-generator";

interface CategoryResult {
  index: number;
  category: "missing_docs" | "unclear_docs" | "new_feature";
  priority: "high" | "medium" | "low";
}

const validCategories = ["missing_docs", "unclear_docs", "new_feature"] as const;
const validPriorities = ["high", "medium", "low"] as const;

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }
  const db = getAdminFirestore();

  // 自動生成された未分類の改善要望を取得
  // chat/send.post.ts で自動作成時は category: "missing_docs" + summary が「ボットが回答に自信がありません」で始まる
  const snapshot = await db
    .collection("improvementRequests")
    .where("groupId", "==", groupId)
    .where("category", "==", "missing_docs")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  // 自動生成されたもののみフィルタ
  const docs = snapshot.docs.filter((d) => {
    const summary = d.data().summary as string;
    return summary.startsWith("ボットが回答に自信がありません");
  });

  if (docs.length === 0) {
    return { categorized: 0 };
  }

  // Gemini で一括分類
  const systemPrompt = `あなたはサポートシステムの改善要望を分類する専門家です。
各要望の内容を分析し、カテゴリと優先度を判定してください。

カテゴリ（必ず以下のいずれかを選択）：
- missing_docs: ドキュメントや情報が不足している
- unclear_docs: 既存のドキュメントが不明瞭・わかりにくい
- new_feature: 新しい機能やサービスのリクエスト

優先度（必ず以下のいずれかを選択）：
- high: 多くのユーザーに影響する、または業務に重大な支障がある
- medium: 一定のユーザーに影響する
- low: 影響が限定的

JSON配列形式で出力してください:
[{ "index": 0, "category": "カテゴリ", "priority": "優先度" }, ...]`;

  const itemsText = docs.map((d, i) => `[${i}] ${d.data().summary}`).join("\n");

  const results = await generateStructuredJson<CategoryResult[]>(
    systemPrompt,
    `以下の改善要望を分類してください：\n\n${itemsText}`,
  );

  // 結果を適用
  const batch = db.batch();
  const now = new Date().toISOString();
  let categorized = 0;

  for (const result of results) {
    if (
      result.index < 0 ||
      result.index >= docs.length ||
      !validCategories.includes(result.category as (typeof validCategories)[number]) ||
      !validPriorities.includes(result.priority as (typeof validPriorities)[number])
    ) {
      continue;
    }

    batch.update(docs[result.index].ref, {
      category: result.category,
      priority: result.priority,
      updatedAt: now,
    });
    categorized++;
  }

  if (categorized > 0) {
    await batch.commit();
  }

  return { categorized };
});
