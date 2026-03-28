import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const admin = await verifySystemAdmin(event);
  const db = getAdminFirestore();

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "招待IDが必要です" });
  }

  const doc = await db.collection("invitations").doc(id).get();
  if (!doc.exists || doc.data()?.organizationId !== admin.organizationId) {
    throw createError({ statusCode: 404, statusMessage: "招待が見つかりません" });
  }

  await db.collection("invitations").doc(id).delete();

  return { success: true };
});
