import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await verifySystemAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "IDが必要です" });

  const body = await readBody(event);
  const db = getAdminFirestore();
  const groupRef = db.collection("groups").doc(id);
  const groupDoc = await groupRef.get();

  if (!groupDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "グループが見つかりません" });
  }
  if (groupDoc.data()?.organizationId !== user.organizationId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description.trim();
  if (body.isActive !== undefined) updates.isActive = body.isActive;

  await groupRef.update(updates);
  return { id, ...groupDoc.data(), ...updates };
});
