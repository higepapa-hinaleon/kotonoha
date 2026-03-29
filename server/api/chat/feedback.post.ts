import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyAuthOptional, resolveExternalUser } from "~~/server/utils/auth";
import { checkRateLimit } from "~~/server/utils/rate-limiter";
import { FEEDBACK_RATE_LIMIT } from "~~/server/utils/constants";
import type { ChatFeedbackRequest } from "~~/shared/types/api";

const MAX_ID_LENGTH = 128;

export default defineEventHandler(async (event) => {
  const user = await verifyAuthOptional(event);
  const body = await readBody<ChatFeedbackRequest>(event);

  if (!body.conversationId || !body.messageId || !body.feedback) {
    throw createError({ statusCode: 400, statusMessage: "conversationId, messageId, feedback は必須です" });
  }
  if (body.feedback !== "positive" && body.feedback !== "negative") {
    throw createError({ statusCode: 400, statusMessage: "feedback は positive または negative を指定してください" });
  }
  if (body.conversationId.length > MAX_ID_LENGTH || body.messageId.length > MAX_ID_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: "無効なIDです" });
  }

  // レート制限
  const clientIp = getRequestIP(event) || "unknown";
  const rateLimitKey = user ? `feedback:user:${user.id}` : `feedback:ip:${clientIp}`;
  if (!checkRateLimit(rateLimitKey, FEEDBACK_RATE_LIMIT)) {
    throw createError({ statusCode: 429, statusMessage: "リクエストが多すぎます。しばらく待ってから再試行してください" });
  }

  const db = getAdminFirestore();

  // 会話の存在確認とアクセス権チェック
  const convDoc = await db.collection("conversations").doc(body.conversationId).get();
  if (!convDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "会話が見つかりません" });
  }
  const convData = convDoc.data()!;

  // アクセス権チェック: 認証ユーザーは所有者チェック、ゲストはexternalUserIdヘッダーで照合
  if (user) {
    if (convData.userId !== user.id) {
      throw createError({ statusCode: 403, statusMessage: "この会話へのアクセス権がありません" });
    }
  } else {
    // ゲストユーザー: externalUserId ヘッダーで所有者確認
    const { guestUserId } = resolveExternalUser(event);
    if (convData.userId !== guestUserId) {
      throw createError({ statusCode: 403, statusMessage: "この会話へのアクセス権がありません" });
    }
  }

  // メッセージの存在確認
  const messageRef = db
    .collection("conversations")
    .doc(body.conversationId)
    .collection("messages")
    .doc(body.messageId);
  const messageDoc = await messageRef.get();
  if (!messageDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "メッセージが見つかりません" });
  }

  const messageData = messageDoc.data()!;
  if (messageData.role !== "assistant") {
    throw createError({ statusCode: 400, statusMessage: "フィードバックはアシスタントのメッセージにのみ送信できます" });
  }

  // フィードバックを保存
  await messageRef.update({ feedback: body.feedback });

  // ネガティブフィードバックの場合、改善要望を自動作成（非ブロッキング・重複防止）
  if (body.feedback === "negative") {
    try {
      // この会話に既存の改善要望があるか確認（重複防止）
      const existingImprovement = await db
        .collection("improvementRequests")
        .where("conversationId", "==", body.conversationId)
        .limit(1)
        .get();

      if (existingImprovement.empty) {
        // このメッセージの直前のユーザーメッセージを取得
        const prevMessages = await db
          .collection("conversations")
          .doc(body.conversationId)
          .collection("messages")
          .where("role", "==", "user")
          .where("createdAt", "<", messageData.createdAt)
          .orderBy("createdAt", "desc")
          .limit(1)
          .get();

        const originalQuestion = prevMessages.docs[0]?.data()?.content || "";

        await db.collection("improvementRequests").doc().set({
        organizationId: convData.organizationId,
        groupId: convData.groupId,
        serviceId: convData.serviceId,
        conversationId: body.conversationId,
        category: "other",
        summary: `ユーザーが回答に低評価: ${originalQuestion.slice(0, 100)}`,
        originalQuestion,
        priority: "medium",
        status: "open",
        adminNote: "",
        correctedAnswer: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("[feedback] Failed to create improvement request:", err);
    }
  }

  return { success: true };
});
