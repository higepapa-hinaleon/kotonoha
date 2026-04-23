import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin, isPlatformAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const admin = await verifySystemAdmin(event);

  try {
    const db = getAdminFirestore();

    const id = getRouterParam(event, "id");
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: "招待IDが必要です" });
    }

    const doc = await db.collection("invitations").doc(id).get();
    if (
      !doc.exists ||
      (!isPlatformAdmin(admin) && doc.data()?.organizationId !== admin.organizationId)
    ) {
      throw createError({ statusCode: 404, statusMessage: "招待が見つかりません" });
    }

    await db.collection("invitations").doc(id).delete();

    return { success: true };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e) throw e;
    const message = e instanceof Error ? e.message : String(e);
    console.error("[system/invitations/delete] Firestore操作エラー:", message);
    throw createError({ statusCode: 500, statusMessage: `招待の削除に失敗しました: ${message}` });
  }
});
