import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyAuth, resolveGroupId } from "~~/server/utils/auth";
import type { Conversation, Message } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const user = await verifyAuth(event);
  const groupId = await resolveGroupId(event, user);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "IDが必要です" });
  }

  const db = getAdminFirestore();
  const convRef = db.collection("conversations").doc(id);
  const convDoc = await convRef.get();

  if (!convDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "会話が見つかりません" });
  }

  const conversation = { id: convDoc.id, ...convDoc.data() } as Conversation;

  // 会話が同一グループに属することを確認
  if (conversation.groupId !== groupId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  // 自分の会話か同一グループの管理者のみアクセス可能
  if (conversation.userId !== user.id) {
    if (user.role !== "admin" && user.role !== "system_admin" && user.role !== "owner") {
      throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
    }
  }

  // メッセージを取得
  const messagesSnapshot = await convRef.collection("messages").orderBy("createdAt", "asc").get();

  const messages: Message[] = messagesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Message[];

  return { conversation, messages };
});
