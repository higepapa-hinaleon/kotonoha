import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin } from "~~/server/utils/auth";
import { VALID_PLAN_IDS } from "~~/shared/plans";
import type { PlanId } from "~~/shared/plans";

export default defineEventHandler(async (event) => {
  const user = await verifySystemAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "組織IDが必要です" });

  const body = await readBody(event);
  const db = getAdminFirestore();
  const orgRef = db.collection("organizations").doc(id);
  const orgDoc = await orgRef.get();

  if (!orgDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "組織が見つかりません" });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      throw createError({ statusCode: 400, statusMessage: "組織名は必須です" });
    }
    updates.name = body.name.trim();
  }

  if (body.plan !== undefined) {
    if (!VALID_PLAN_IDS.includes(body.plan as PlanId)) {
      throw createError({ statusCode: 400, statusMessage: "無効なプランです" });
    }
    updates.plan = body.plan;
  }

  await orgRef.update(updates);

  const updatedDoc = await orgRef.get();
  return { id, ...updatedDoc.data() };
});
