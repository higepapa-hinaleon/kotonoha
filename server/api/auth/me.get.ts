import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyAuth } from "~~/server/utils/auth";
import { findOrCreateDefaultOrganization } from "~~/server/utils/organization";
import { getUserGroupMemberships } from "~~/server/utils/group";

export default defineEventHandler(async (event) => {
  const user = await verifyAuth(event);

  // organizationId が未設定のユーザーを修復（既存 role を維持）
  if (!user.organizationId) {
    const db = getAdminFirestore();
    const orgId = await findOrCreateDefaultOrganization(db);
    await db.collection("users").doc(user.id).update({
      organizationId: orgId,
      updatedAt: new Date().toISOString(),
    });
    user.organizationId = orgId;
  }

  // グループメンバーシップ情報を付加して返す
  const memberships = await getUserGroupMemberships(user.id);

  return {
    ...user,
    groupMemberships: memberships,
  };
});
