import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin, isPlatformAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await verifySystemAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "IDが必要です" });

  const db = getAdminFirestore();
  const groupRef = db.collection("groups").doc(id);
  const groupDoc = await groupRef.get();

  if (!groupDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "グループが見つかりません" });
  }
  if (!isPlatformAdmin(user) && groupDoc.data()?.organizationId !== user.organizationId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  // グループに紐づくサービスが存在する場合は削除を拒否
  const services = await db.collection("services").where("groupId", "==", id).limit(1).get();
  if (!services.empty) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "サービスが存在するグループは削除できません。先にサービスを移動または削除してください",
    });
  }

  // メンバーシップを削除
  const memberships = await db.collection("userGroupMemberships").where("groupId", "==", id).get();
  const batch = db.batch();
  memberships.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(groupRef);
  await batch.commit();

  // 削除したグループを activeGroupId に持つユーザーをクリア
  const affectedUsers = await db.collection("users").where("activeGroupId", "==", id).get();
  if (!affectedUsers.empty) {
    const userBatch = db.batch();
    affectedUsers.docs.forEach((doc) => {
      userBatch.update(doc.ref, { activeGroupId: null, updatedAt: new Date().toISOString() });
    });
    await userBatch.commit();
  }

  return { success: true };
});
