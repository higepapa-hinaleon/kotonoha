import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin, isPlatformAdmin } from "~~/server/utils/auth";
import type { Group } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const user = await verifySystemAdmin(event);

  const orgId = getRouterParam(event, "id");
  if (!orgId) throw createError({ statusCode: 400, statusMessage: "組織IDが必要です" });

  // プラットフォーム管理者以外は自組織のみ
  if (!isPlatformAdmin(user) && orgId !== user.organizationId) {
    throw createError({ statusCode: 403, statusMessage: "自分の組織のみアクセスできます" });
  }

  const db = getAdminFirestore();

  const orgDoc = await db.collection("organizations").doc(orgId).get();
  if (!orgDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "組織が見つかりません" });
  }

  const snapshot = await db
    .collection("groups")
    .where("organizationId", "==", orgId)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Group);
});
