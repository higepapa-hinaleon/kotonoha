import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await verifySystemAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  const db = getAdminFirestore();
  const snapshot = await db.collection("organizations").orderBy("createdAt", "desc").get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
});
