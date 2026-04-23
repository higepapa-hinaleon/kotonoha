import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin, isPlatformAdmin } from "~~/server/utils/auth";
import type { Invitation } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const admin = await verifySystemAdmin(event);

  try {
    const db = getAdminFirestore();

    // プラットフォーム管理者はクエリで組織を指定可能（未指定時は全組織）
    const query = getQuery(event);
    const targetOrgId =
      isPlatformAdmin(admin) && typeof query.organizationId === "string"
        ? query.organizationId
        : isPlatformAdmin(admin)
          ? null
          : admin.organizationId;

    let ref: FirebaseFirestore.Query = db
      .collection("invitations")
      .where("status", "==", "pending");
    if (targetOrgId) {
      ref = ref.where("organizationId", "==", targetOrgId);
    }

    const snapshot = await ref.get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Invitation[];
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e) throw e;
    const message = e instanceof Error ? e.message : String(e);
    console.error("[system/invitations/list] Firestore操作エラー:", message);
    throw createError({
      statusCode: 500,
      statusMessage: `招待一覧の取得に失敗しました: ${message}`,
    });
  }
});
