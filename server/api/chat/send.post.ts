import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyAuthOptional, resolveGroupId, resolveExternalUser } from "~~/server/utils/auth";
import { processChatMessage } from "~~/server/utils/chat";
import { checkMonthlyChats } from "~~/server/utils/plan-limit";
import type { ChatSendRequest, ChatSendResponse } from "~~/shared/types/api";
import { CHAT_RATE_LIMIT, MAX_CHAT_MESSAGE_LENGTH } from "~~/server/utils/constants";
import { checkRateLimit } from "~~/server/utils/rate-limiter";

export default defineEventHandler(async (event): Promise<ChatSendResponse> => {
  const user = await verifyAuthOptional(event);
  const body = await readBody<ChatSendRequest>(event);

  if (!body.serviceId || !body.message?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "serviceId と message は必須です" });
  }
  if (body.message.length > MAX_CHAT_MESSAGE_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `メッセージは${MAX_CHAT_MESSAGE_LENGTH}文字以内にしてください`,
    });
  }

  // レート制限チェック（IP + ユーザーID）
  const clientIp = getRequestIP(event) || "unknown";
  const rateLimitKey = user ? `chat:user:${user.id}` : `chat:ip:${clientIp}`;
  if (!checkRateLimit(rateLimitKey, CHAT_RATE_LIMIT)) {
    throw createError({
      statusCode: 429,
      statusMessage: "リクエストが多すぎます。しばらく待ってから再試行してください",
    });
  }

  const db = getAdminFirestore();

  // ウィジェットから渡されるユーザー情報（任意）- サニタイズ済み
  const { externalUserName, externalUserId, guestUserId } = resolveExternalUser(event);

  // organizationId を導出: 認証済み → user.organizationId, ゲスト → serviceId から取得
  let organizationId = user?.organizationId;
  let groupId: string | undefined;
  const userId = user?.id ?? guestUserId;

  // groupId を導出: 認証済み → resolveGroupId, ゲスト → serviceId から取得
  if (user) {
    groupId = await resolveGroupId(event, user);
  }

  // ゲストの場合: サービスから organizationId / groupId を取得
  if (!organizationId || !groupId) {
    const serviceDoc = await db.collection("services").doc(body.serviceId).get();
    if (!serviceDoc.exists) {
      throw createError({ statusCode: 404, statusMessage: "サービスが見つかりません" });
    }
    const serviceData = serviceDoc.data();
    if (!organizationId) organizationId = serviceData?.organizationId;
    if (!groupId) groupId = serviceData?.groupId;
  }

  if (!organizationId) {
    throw createError({ statusCode: 400, statusMessage: "organizationId を特定できません" });
  }
  if (!groupId) {
    throw createError({ statusCode: 400, statusMessage: "groupId を特定できません" });
  }

  // プランの月間チャット数上限チェック
  await checkMonthlyChats(organizationId);

  return processChatMessage({
    organizationId,
    groupId,
    serviceId: body.serviceId,
    message: body.message,
    userId,
    conversationId: body.conversationId,
    externalUserName,
    externalUserId,
  });
});
