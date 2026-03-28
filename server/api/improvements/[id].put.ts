import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import { storeFeedbackEmbedding, removeFeedbackEmbedding } from "~~/server/utils/rag";
import type { ImprovementUpdateRequest } from "~~/shared/types/api";
import type { ImprovementRequest } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  const id = getRouterParam(event, "id");
  const body = await readBody<ImprovementUpdateRequest>(event);

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "IDが必要です" });
  }

  const db = getAdminFirestore();
  const docRef = db.collection("improvementRequests").doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw createError({ statusCode: 404, statusMessage: "改善要望が見つかりません" });
  }

  const existing = doc.data() as Omit<ImprovementRequest, "id">;
  if (existing.groupId !== groupId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.category !== undefined) updates.category = body.category;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.status !== undefined) updates.status = body.status;
  if (body.adminNote !== undefined) updates.adminNote = body.adminNote;
  if (body.correctedAnswer !== undefined) updates.correctedAnswer = body.correctedAnswer;

  await docRef.update(updates);

  const merged = { id, ...existing, ...updates } as ImprovementRequest;

  const finalStatus = merged.status;
  const finalCorrectedAnswer = merged.correctedAnswer;

  // 親会話のステータスを同期（resolved → closed、それ以外 → escalated に戻す）
  if (finalStatus === "resolved" && finalCorrectedAnswer?.trim()) {
    try {
      await db.collection("conversations").doc(existing.conversationId).update({
        status: "closed",
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[feedback] Failed to update conversation status:", err);
    }
  } else if (finalStatus !== "resolved" && existing.status === "resolved") {
    try {
      await db.collection("conversations").doc(existing.conversationId).update({
        status: "escalated",
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[feedback] Failed to revert conversation status:", err);
    }
  }

  // フィードバック RAG: 訂正回答をベクトル化して保存（ステータスが resolved かつ correctedAnswer あり）
  if (finalStatus === "resolved" && finalCorrectedAnswer?.trim()) {
    // originalQuestion を優先、なければ summary から質問を抽出（後方互換）
    let question = merged.originalQuestion?.trim();
    if (!question) {
      const match = merged.summary.match(/^.+?\(確信度:\s*[0-9.]+\):\s*(.+)$/s);
      question = match ? match[1].trim() : merged.summary;
    }

    try {
      await storeFeedbackEmbedding({
        improvementId: id,
        organizationId: existing.organizationId,
        groupId: existing.groupId,
        serviceId: existing.serviceId,
        question,
        correctedAnswer: finalCorrectedAnswer,
      });
    } catch (err) {
      console.error("[feedback-rag] Failed to store embedding:", err);
    }
  } else if (finalStatus !== "resolved") {
    // resolved でなくなった場合は削除
    try {
      await removeFeedbackEmbedding(id);
    } catch (err) {
      console.error("[feedback-rag] Failed to remove embedding:", err);
    }
  }

  return merged;
});
