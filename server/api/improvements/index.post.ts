import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import { storeFeedbackEmbedding } from "~~/server/utils/rag";
import type { ImprovementRequest } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  const body = await readBody<{
    conversationId: string;
    serviceId: string;
    summary?: string;
    correctedAnswer?: string;
    adminNote?: string;
    originalQuestion?: string;
  }>(event);

  if (!body.conversationId || !body.serviceId) {
    throw createError({ statusCode: 400, statusMessage: "conversationId と serviceId は必須です" });
  }

  const db = getAdminFirestore();

  // conversationId と serviceId が同一グループに属することを確認
  const [convDoc, serviceDoc] = await Promise.all([
    db.collection("conversations").doc(body.conversationId).get(),
    db.collection("services").doc(body.serviceId).get(),
  ]);
  if (!convDoc.exists || convDoc.data()?.groupId !== groupId) {
    throw createError({ statusCode: 400, statusMessage: "指定された会話が見つかりません" });
  }
  if (!serviceDoc.exists || serviceDoc.data()?.groupId !== groupId) {
    throw createError({ statusCode: 400, statusMessage: "指定されたサービスが見つかりません" });
  }
  const now = new Date().toISOString();

  const summary = body.summary || "管理者によるフィードバック";
  const hasCorrection = !!body.correctedAnswer?.trim();

  const docRef = db.collection("improvementRequests").doc();
  const originalQuestion = body.originalQuestion?.trim();
  const data: Omit<ImprovementRequest, "id"> = {
    organizationId: user.organizationId,
    groupId,
    serviceId: body.serviceId,
    conversationId: body.conversationId,
    category: "other",
    summary,
    ...(originalQuestion ? { originalQuestion } : {}),
    priority: "medium",
    status: hasCorrection ? "resolved" : "open",
    adminNote: body.adminNote || "",
    correctedAnswer: body.correctedAnswer || "",
    createdAt: now,
    updatedAt: now,
  };

  await docRef.set(data);

  // 訂正回答ありの場合、親会話を closed に更新
  if (hasCorrection) {
    try {
      await db.collection("conversations").doc(body.conversationId).update({ status: "closed", updatedAt: now });
    } catch (err) {
      console.error("[feedback] Failed to update conversation status:", err);
    }
  }

  // フィードバック RAG: 訂正回答をベクトル化して保存
  if (hasCorrection) {
    try {
      await storeFeedbackEmbedding({
        improvementId: docRef.id,
        organizationId: user.organizationId,
        groupId,
        serviceId: body.serviceId,
        question: originalQuestion || summary,
        correctedAnswer: body.correctedAnswer!,
      });
    } catch (err) {
      console.error("[feedback-rag] Failed to store embedding:", err);
    }
  }

  return { id: docRef.id, ...data } as ImprovementRequest;
});
