import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import type { Conversation } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  const query = getQuery(event);
  const db = getAdminFirestore();

  let ref = db
    .collection("conversations")
    .where("groupId", "==", groupId)
    .orderBy("createdAt", "desc");

  if (query.serviceId) {
    ref = ref.where("serviceId", "==", String(query.serviceId));
  }
  if (query.status) {
    ref = ref.where("status", "==", String(query.status));
  }

  // チャネルフィルタ: ウィジェット経由は guest または ext: プレフィクスのため
  // Firestore の where では完結できず、多めに取得してからメモリフィルタする
  const channelFilter = query.channel ? String(query.channel) : "";
  const fetchLimit = Math.min(Number(query.limit) || 100, 500);
  ref = ref.limit(fetchLimit);

  const snapshot = await ref.get();

  // ユーザー情報を取得してマージ
  const conversations = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Conversation[];

  // ext: プレフィクス付きユーザーIDはFirebaseユーザーではないため除外
  const userIds = [...new Set(
    conversations
      .map((c) => c.userId)
      .filter((id) => id !== "guest" && !id.startsWith("ext:")),
  )];
  const userMap = new Map<string, string>();

  if (userIds.length > 0) {
    const userDocs = await Promise.all(
      userIds.map((uid) => db.collection("users").doc(uid).get()),
    );
    userDocs.forEach((doc) => {
      if (doc.exists) {
        userMap.set(doc.id, doc.data()?.displayName || doc.data()?.email || "不明");
      }
    });
  }

  const result = conversations.map((conv) => {
    const isGuest = conv.userId === "guest";
    const isExternal = conv.userId.startsWith("ext:");
    const isRegisteredUser = userMap.has(conv.userId);
    // 認証済みFirebaseユーザーはwebチャネル扱い（外部ヘッダーがあっても）
    const isWidget = !isRegisteredUser && (isGuest || isExternal);

    let userName: string;
    if (isRegisteredUser) {
      userName = userMap.get(conv.userId)!;
    } else if (conv.externalUserName) {
      userName = conv.externalUserName;
    } else if (isGuest) {
      userName = "ウィジェット（ゲスト）";
    } else if (isExternal) {
      userName = `外部ユーザー (${conv.userId.slice(4)})`;
    } else {
      userName = "不明";
    }

    return {
      ...conv,
      userName,
      channel: isWidget ? ("widget" as const) : ("web" as const),
    };
  });

  // チャネルフィルタ適用
  if (channelFilter === "widget") {
    return result.filter((r) => r.channel === "widget");
  }
  if (channelFilter === "web") {
    return result.filter((r) => r.channel === "web");
  }

  return result;
});
