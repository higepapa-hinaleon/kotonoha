import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  const id = getRouterParam(event, "id");

  if (!id) throw createError({ statusCode: 400, statusMessage: "IDが必要です" });

  const db = getAdminFirestore();
  const docRef = db.collection("faqs").doc(id);
  const doc = await docRef.get();

  if (!doc.exists) throw createError({ statusCode: 404, statusMessage: "FAQが見つかりません" });
  if (doc.data()?.groupId !== groupId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  await docRef.delete();
  return { success: true };
});
