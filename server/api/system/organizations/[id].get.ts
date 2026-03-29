import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await verifySystemAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "IDが必要です" });

  const db = getAdminFirestore();
  const orgDoc = await db.collection("organizations").doc(id).get();

  if (!orgDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "組織が見つかりません" });
  }

  return { id: orgDoc.id, ...orgDoc.data() };
});
