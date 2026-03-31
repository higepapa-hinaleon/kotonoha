import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin, isPlatformAdmin } from "~~/server/utils/auth";
import type { UserGroupMembership } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "IDが必要です" });

  const user = await verifySystemAdmin(event);

  const db = getAdminFirestore();

  // グループの存在確認
  const groupDoc = await db.collection("groups").doc(id).get();
  if (!groupDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "グループが見つかりません" });
  }
  if (!isPlatformAdmin(user) && groupDoc.data()?.organizationId !== user.organizationId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  // メンバーシップ一覧
  const membershipsSnapshot = await db
    .collection("userGroupMemberships")
    .where("groupId", "==", id)
    .get();

  const memberships = membershipsSnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as UserGroupMembership,
  );

  // ユーザー情報を付加
  const members = await Promise.all(
    memberships.map(async (m) => {
      const userDoc = await db.collection("users").doc(m.userId).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      return {
        ...m,
        email: userData?.email || "",
        displayName: userData?.displayName || "",
        userRole: userData?.role || "user",
      };
    }),
  );

  return members;
});
