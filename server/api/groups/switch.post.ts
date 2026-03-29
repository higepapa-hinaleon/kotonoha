import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyAuth } from "~~/server/utils/auth";
import { isGroupMember } from "~~/server/utils/group";

export default defineEventHandler(async (event) => {
  const user = await verifyAuth(event);
  const body = await readBody(event);

  if (!body.groupId || typeof body.groupId !== "string") {
    throw createError({ statusCode: 400, statusMessage: "groupIdは必須です" });
  }

  const db = getAdminFirestore();

  // グループが同一組織に属することを検証（system_admin も組織内に制限）
  const groupDoc = await db.collection("groups").doc(body.groupId).get();
  if (!groupDoc.exists || groupDoc.data()?.organizationId !== user.organizationId) {
    throw createError({ statusCode: 403, statusMessage: "このグループへのアクセス権がありません" });
  }

  // system_admin は同一組織内の任意グループに切替可能、それ以外は所属チェック
  if (user.role !== "system_admin") {
    const isMember = await isGroupMember(user.id, body.groupId);
    if (!isMember) {
      throw createError({
        statusCode: 403,
        statusMessage: "このグループへのアクセス権がありません",
      });
    }
  }

  await db.collection("users").doc(user.id).update({
    activeGroupId: body.groupId,
    updatedAt: new Date().toISOString(),
  });

  return { success: true, activeGroupId: body.groupId };
});
