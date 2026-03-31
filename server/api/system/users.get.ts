import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin, isPlatformAdmin } from "~~/server/utils/auth";
import { getUserGroupMemberships } from "~~/server/utils/group";
import type { User } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const admin = await verifySystemAdmin(event);

  try {
    const db = getAdminFirestore();

    // プラットフォーム管理者はクエリで組織を指定可能（未指定時は全ユーザー）
    const query = getQuery(event);
    const targetOrgId =
      isPlatformAdmin(admin) && typeof query.organizationId === "string"
        ? query.organizationId
        : isPlatformAdmin(admin)
          ? null
          : admin.organizationId;

    let ref: FirebaseFirestore.Query = db.collection("users");
    if (targetOrgId) {
      ref = ref.where("organizationId", "==", targetOrgId);
    }

    const snapshot = await ref.get();

    const users = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const user = { id: doc.id, ...doc.data() } as User;
        const memberships = await getUserGroupMemberships(user.id, db);
        return { ...user, groupMemberships: memberships };
      }),
    );

    return users;
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e) throw e;
    const message = e instanceof Error ? e.message : String(e);
    console.error("[system/users/list] Firestore操作エラー:", message);
    throw createError({ statusCode: 500, statusMessage: `ユーザー一覧の取得に失敗しました: ${message}` });
  }
});
