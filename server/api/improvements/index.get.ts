import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import type { ImprovementRequest } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }
  const query = getQuery(event);
  const db = getAdminFirestore();

  let ref = db
    .collection("improvementRequests")
    .where("groupId", "==", groupId)
    .orderBy("createdAt", "desc");

  if (query.status) {
    ref = ref.where("status", "==", String(query.status));
  }
  if (query.serviceId) {
    ref = ref.where("serviceId", "==", String(query.serviceId));
  }
  if (query.conversationId) {
    ref = ref.where("conversationId", "==", String(query.conversationId));
  }

  const snapshot = await ref.limit(100).get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ImprovementRequest[];
});
