import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const admin = await verifySystemAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "IDが必要です" });

  try {
    const body = await readBody(event);
    if (!body.role || !["owner", "system_admin", "admin", "member"].includes(body.role)) {
      throw createError({
        statusCode: 400,
        statusMessage: "roleは owner, system_admin, admin, member のいずれかで指定してください",
      });
    }

    // owner ロールの付与は現在の owner のみ可能
    if (body.role === "owner" && admin.role !== "owner") {
      throw createError({
        statusCode: 403,
        statusMessage: "オーナー権限の付与はオーナーのみ可能です",
      });
    }

    // 自分自身の owner / system_admin を剥奪することは禁止
    if (id === admin.id && (admin.role === "owner" || admin.role === "system_admin") && body.role !== admin.role) {
      throw createError({
        statusCode: 400,
        statusMessage: "自分自身の管理者権限を変更することはできません",
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
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e) throw e;
    const message = e instanceof Error ? e.message : String(e);
    console.error("[system/users/role/put] Firestore操作エラー:", message);
    throw createError({ statusCode: 500, statusMessage: `ロールの更新に失敗しました: ${message}` });
  }
});
