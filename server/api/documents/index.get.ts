import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import type { Document } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }
  const query = getQuery(event);
  const db = getAdminFirestore();

  let ref = db.collection("documents").where("groupId", "==", groupId).orderBy("createdAt", "desc");

  if (query.serviceId) {
    ref = ref.where("serviceId", "==", query.serviceId);
  }

  const snapshot = await ref.limit(200).get();

  const documents: Document[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Document[];

  return documents;
});
