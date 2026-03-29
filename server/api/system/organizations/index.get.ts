import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await verifySystemAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  try {
    const db = getAdminFirestore();
    const snapshot = await db.collection("organizations").orderBy("createdAt", "desc").get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e) throw e;
    const message = e instanceof Error ? e.message : String(e);
    console.error("[system/organizations/list] Firestore操作エラー:", message);
    throw createError({ statusCode: 500, statusMessage: `組織一覧の取得に失敗しました: ${message}` });
  }
});
