import { verifyGroupAdmin } from "~~/server/utils/auth";
import { processChatMessage } from "~~/server/utils/chat";
import type { ChatSendRequest, ChatSendResponse } from "~~/shared/types/api";
import { MAX_CHAT_MESSAGE_LENGTH, CHAT_RATE_LIMIT } from "~~/server/utils/constants";
import { checkRateLimit } from "~~/server/utils/rate-limiter";

/**
 * 教育モード用チャットエンドポイント
 * - グループ管理者専用
 * - エスカレーション（改善要望の自動作成）をスキップ
 */
export default defineEventHandler(async (event): Promise<ChatSendResponse> => {
  const { user, groupId } = await verifyGroupAdmin(event);
  const body = await readBody<ChatSendRequest>(event);

  // レート制限チェック
  const rateLimitKey = `chat:learn:${user.id}`;
  if (!checkRateLimit(rateLimitKey, CHAT_RATE_LIMIT)) {
    throw createError({
      statusCode: 429,
      statusMessage: "リクエストが多すぎます。しばらく待ってから再試行してください",
    });
  }

  if (!body.serviceId || !body.message?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "serviceId と message は必須です" });
  }
  if (body.message.length > MAX_CHAT_MESSAGE_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `メッセージは${MAX_CHAT_MESSAGE_LENGTH}文字以内にしてください`,
    });
  }

  return processChatMessage({
    organizationId: user.organizationId,
    groupId,
    serviceId: body.serviceId,
    message: body.message,
    userId: user.id,
    conversationId: body.conversationId,
    skipEscalation: true,
  });
});
