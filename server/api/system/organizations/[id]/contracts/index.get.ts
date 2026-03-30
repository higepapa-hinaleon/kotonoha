import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await verifySystemAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  const orgId = getRouterParam(event, "id");
  if (!orgId) throw createError({ statusCode: 400, statusMessage: "組織IDが必要です" });

  // 自分の組織のみアクセス可能
  if (orgId !== user.organizationId) {
    throw createError({ statusCode: 403, statusMessage: "自分の組織のみアクセスできます" });
  }

  try {
    const db = getAdminFirestore();

    // 組織の存在確認
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    if (!orgDoc.exists) {
      throw createError({ statusCode: 404, statusMessage: "組織が見つかりません" });
    }

    const snapshot = await db
      .collection("contracts")
      .where("organizationId", "==", orgId)
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e) throw e;
    const message = e instanceof Error ? e.message : String(e);
    console.error("[system/contracts/get] Firestore操作エラー:", message);
    throw createError({ statusCode: 500, statusMessage: `契約一覧の取得に失敗しました: ${message}` });
  }
});
