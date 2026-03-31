import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin, isPlatformAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const systemAdmin = await verifySystemAdmin(event);
  const id = getRouterParam(event, "id");
  const userId = getRouterParam(event, "userId");
  if (!id || !userId)
    throw createError({ statusCode: 400, statusMessage: "パラメータが不足しています" });

  const body = await readBody(event);
  if (!body.role || !["admin", "member"].includes(body.role)) {
    throw createError({
      statusCode: 400,
      statusMessage: "roleは admin または member で指定してください",
    });
  }

  const db = getAdminFirestore();

  // グループの組織チェック
  const groupDoc = await db.collection("groups").doc(id).get();
  if (!groupDoc.exists || (!isPlatformAdmin(systemAdmin) && groupDoc.data()?.organizationId !== systemAdmin.organizationId)) {
    throw createError({ statusCode: 404, statusMessage: "グループが見つかりません" });
  }

  const membershipId = `${userId}_${id}`;
  const membershipRef = db.collection("userGroupMemberships").doc(membershipId);
  const membershipDoc = await membershipRef.get();

  if (!membershipDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "メンバーシップが見つかりません" });
  }

  await membershipRef.update({
    role: body.role,
    updatedAt: new Date().toISOString(),
  });

  return { success: true };
});
