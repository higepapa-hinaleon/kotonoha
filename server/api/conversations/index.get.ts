import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupMember } from "~~/server/utils/auth";
import type { Conversation } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupMember(event);
  const db = getAdminFirestore();

  // 一般ユーザーは自分のグループ内の自分の会話のみ
  const snapshot = await db
    .collection("conversations")
    .where("groupId", "==", groupId)
    .where("userId", "==", user.id)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const conversations: Conversation[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Conversation[];

  return conversations;
});
