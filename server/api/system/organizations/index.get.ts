import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin, isPlatformAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await verifySystemAdmin(event);

  try {
    const db = getAdminFirestore();

    // プラットフォーム管理者は全組織を表示
    if (isPlatformAdmin(user)) {
      const snapshot = await db.collection("organizations").orderBy("createdAt", "desc").get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }

    // それ以外は自組織のみ
    if (!user.organizationId) {
      return [];
    }
    const orgDoc = await db.collection("organizations").doc(user.organizationId).get();
    if (!orgDoc.exists) {
      return [];
    }
    return [{ id: orgDoc.id, ...orgDoc.data() }];
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e) throw e;
    const message = e instanceof Error ? e.message : String(e);
    console.error("[system/organizations/list] Firestore操作エラー:", message);
    throw createError({ statusCode: 500, statusMessage: `組織一覧の取得に失敗しました: ${message}` });
  }
});
