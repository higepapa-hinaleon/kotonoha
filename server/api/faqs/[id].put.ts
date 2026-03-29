import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import { generateEmbedding } from "~~/server/utils/embeddings";
import type { Faq } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user: _user, groupId } = await verifyGroupAdmin(event);
  const id = getRouterParam(event, "id");
  const body = await readBody<Partial<Faq>>(event);

  if (!id) throw createError({ statusCode: 400, statusMessage: "IDが必要です" });

  const db = getAdminFirestore();
  const docRef = db.collection("faqs").doc(id);
  const doc = await docRef.get();

  if (!doc.exists) throw createError({ statusCode: 404, statusMessage: "FAQが見つかりません" });

  const existing = doc.data() as Omit<Faq, "id">;
  if (existing.groupId !== groupId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.question !== undefined) updates.question = body.question;
  if (body.answer !== undefined) updates.answer = body.answer;
  if (body.isPublished !== undefined) updates.isPublished = body.isPublished;

  // 質問が変更された場合、エンベディングを再生成
  if (body.question !== undefined && body.question !== existing.question) {
    const embedding = await generateEmbedding(body.question);
    updates.embedding = FieldValue.vector(embedding);
  }

  await docRef.update(updates);
  return { id, ...existing, ...updates } as Faq;
});
