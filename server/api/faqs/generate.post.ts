import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import { generateStructuredJson } from "~~/server/utils/ai-generator";
import { generateEmbedding } from "~~/server/utils/embeddings";
import type { Faq } from "~~/shared/types/models";

interface GeneratedFaqs {
  faqs: { question: string; answer: string }[];
}

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }
  const body = await readBody<{ serviceId: string }>(event);

  if (!body.serviceId) {
    throw createError({ statusCode: 400, statusMessage: "serviceId は必須です" });
  }

  const db = getAdminFirestore();

  // 1. 対象サービスの直近会話を取得（最大20件）
  const conversationsSnap = await db
    .collection("conversations")
    .where("groupId", "==", groupId)
    .where("serviceId", "==", body.serviceId)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  if (conversationsSnap.empty) {
    throw createError({ statusCode: 400, statusMessage: "対象サービスに会話データがありません" });
  }

  // 2. 各会話からQ&Aペアを収集
  const qaPairs: { question: string; answer: string }[] = [];

  for (const convDoc of conversationsSnap.docs) {
    const messagesSnap = await convDoc.ref.collection("messages").orderBy("createdAt", "asc").get();

    const messages = messagesSnap.docs.map((d) => d.data());

    for (let i = 0; i < messages.length - 1; i++) {
      const msg = messages[i];
      const next = messages[i + 1];
      if (
        msg.role === "user" &&
        next.role === "assistant" &&
        next.confidence != null &&
        next.confidence > 0.6
      ) {
        qaPairs.push({
          question: msg.content,
          answer: next.content,
        });
      }
    }
  }

  if (qaPairs.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "FAQ生成に十分な高確信度の回答データがありません",
    });
  }

  // 3. Gemini でFAQを生成
  const systemPrompt = `あなたはFAQ生成のエキスパートです。
以下のQ&Aペアを分析し、よくある質問（FAQ）としてまとめてください。

ルール:
- 類似した質問はまとめて1つのFAQにしてください
- 質問は簡潔で汎用的な表現にしてください
- 回答は正確かつ分かりやすい日本語で記載してください
- 最大10件のFAQを生成してください
- JSON形式で出力してください: { "faqs": [{ "question": "...", "answer": "..." }] }`;

  const qaText = qaPairs
    .slice(0, 50) // 最大50ペアに制限
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`)
    .join("\n\n");

  const generated = await generateStructuredJson<GeneratedFaqs>(systemPrompt, qaText);

  if (!generated.faqs || generated.faqs.length === 0) {
    return [];
  }

  // 4. 各FAQのembeddingを生成して保存
  const now = new Date().toISOString();
  const createdFaqs: Faq[] = [];

  for (const item of generated.faqs) {
    if (!item.question?.trim() || !item.answer?.trim()) continue;

    const embedding = await generateEmbedding(item.question);
    const docRef = db.collection("faqs").doc();

    const faqData = {
      organizationId: user.organizationId,
      groupId,
      serviceId: body.serviceId,
      question: item.question.trim(),
      answer: item.answer.trim(),
      frequency: 0,
      isPublished: false,
      embedding: FieldValue.vector(embedding),
      generatedFrom: "auto" as const,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(faqData);
    createdFaqs.push({ id: docRef.id, ...faqData, embedding } as unknown as Faq);
  }

  return createdFaqs;
});
