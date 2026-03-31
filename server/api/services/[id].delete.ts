import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin, verifyActiveContract } from "~~/server/utils/auth";
import type { Service } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  await verifyActiveContract(user);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "IDが必要です" });
  }

  const db = getAdminFirestore();
  const docRef = db.collection("services").doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw createError({ statusCode: 404, statusMessage: "サービスが見つかりません" });
  }

  const existing = doc.data() as Omit<Service, "id">;
  if (existing.groupId !== groupId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  await docRef.delete();

  return { success: true };
});
