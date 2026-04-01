import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import type { Report } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }
  const db = getAdminFirestore();

  const snapshot = await db
    .collection("weeklyReports")
    .where("groupId", "==", groupId)
    .orderBy("periodStart", "desc")
    .limit(20)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Report[];
});
