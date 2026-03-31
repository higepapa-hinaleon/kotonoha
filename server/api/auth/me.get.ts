import { verifyAuth } from "~~/server/utils/auth";
import { getUserGroupMemberships } from "~~/server/utils/group";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";

export default defineEventHandler(async (event) => {
  const user = await verifyAuth(event);

  // グループメンバーシップ情報を付加して返す
  const memberships = await getUserGroupMemberships(user.id);

  // 入金待ち契約の有無を確認（補助的チェックのため失敗しても主要フローをブロックしない）
  let hasPendingPayment = false;
  if (user.organizationId) {
    try {
      const db = getAdminFirestore();
      const contractSnap = await db
        .collection("contracts")
        .where("organizationId", "==", user.organizationId)
        .where("status", "==", "pending_payment")
        .limit(1)
        .get();
      hasPendingPayment = !contractSnap.empty;
    } catch (err) {
      console.error("[auth/me] 入金待ち契約の確認に失敗:", err);
    }
  }

  return {
    ...user,
    groupMemberships: memberships,
    hasPendingPayment,
  };
});
