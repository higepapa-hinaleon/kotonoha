import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin, isPlatformAdmin } from "~~/server/utils/auth";
import { addUserToGroup } from "~~/server/utils/group";

export default defineEventHandler(async (event) => {
  const systemAdmin = await verifySystemAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "IDが必要です" });

  const body = await readBody(event);
  if (!body.userId || typeof body.userId !== "string") {
    throw createError({ statusCode: 400, statusMessage: "userIdは必須です" });
  }
  const role = body.role === "admin" ? "admin" : "member";

  const db = getAdminFirestore();

  // グループ存在確認
  const groupDoc = await db.collection("groups").doc(id).get();
  if (!groupDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "グループが見つかりません" });
  }
  const groupOrgId = groupDoc.data()?.organizationId;
  if (!isPlatformAdmin(systemAdmin) && groupOrgId !== systemAdmin.organizationId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  // ユーザー存在確認
  const userDoc = await db.collection("users").doc(body.userId).get();
  if (!userDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "ユーザーが見つかりません" });
  }
  // ユーザーはグループと同一組織に所属している必要がある
  if (userDoc.data()?.organizationId !== groupOrgId) {
    throw createError({ statusCode: 403, statusMessage: "同一組織のユーザーのみ追加できます" });
  }

  await addUserToGroup(body.userId, id, groupOrgId, role, db);

  // ユーザーに activeGroupId が未設定の場合、このグループを設定
  if (!userDoc.data()?.activeGroupId) {
    await db.collection("users").doc(body.userId).update({
      activeGroupId: id,
      updatedAt: new Date().toISOString(),
    });
  }

  return { success: true };
});
