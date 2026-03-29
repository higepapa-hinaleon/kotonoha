import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const admin = await verifySystemAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "IDが必要です" });

  const body = await readBody(event);
  if (!body.role || !["system_admin", "admin", "member"].includes(body.role)) {
    throw createError({
      statusCode: 400,
      statusMessage: "roleは system_admin, admin, member のいずれかで指定してください",
    });
  }

  // 自分自身の system_admin を剥奪することは禁止
  if (id === admin.id && body.role !== "system_admin") {
    throw createError({
      statusCode: 400,
      statusMessage: "自分自身のシステム管理者権限を変更することはできません",
    });
  }

  const db = getAdminFirestore();
  const userRef = db.collection("users").doc(id);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "ユーザーが見つかりません" });
  }
  if (userDoc.data()?.organizationId !== admin.organizationId) {
    throw createError({ statusCode: 403, statusMessage: "同一組織のユーザーのみ変更できます" });
  }

  await userRef.update({
    role: body.role,
    updatedAt: new Date().toISOString(),
  });

  return { success: true };
});
