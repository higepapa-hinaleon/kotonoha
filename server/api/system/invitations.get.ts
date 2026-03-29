import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin } from "~~/server/utils/auth";
import type { Invitation } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const admin = await verifySystemAdmin(event);

  try {
    const db = getAdminFirestore();

    const snapshot = await db
      .collection("invitations")
      .where("organizationId", "==", admin.organizationId)
      .where("status", "==", "pending")
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Invitation[];
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e) throw e;
    const message = e instanceof Error ? e.message : String(e);
    console.error("[system/invitations/list] Firestore操作エラー:", message);
    throw createError({ statusCode: 500, statusMessage: `招待一覧の取得に失敗しました: ${message}` });
  }
});
