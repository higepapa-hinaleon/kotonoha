import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupMember } from "~~/server/utils/auth";
import type { Faq } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupMember(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }
  const query = getQuery(event);
  const db = getAdminFirestore();

  let ref = db
    .collection("faqs")
    .where("groupId", "==", groupId)
    .orderBy("frequency", "desc");

  if (query.serviceId) {
    ref = ref.where("serviceId", "==", String(query.serviceId));
  }

  const snapshot = await ref.limit(100).get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Faq[];
});
