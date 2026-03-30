import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin } from "~~/server/utils/auth";
import { checkPlanLimit } from "~~/server/utils/plan-limit";

export default defineEventHandler(async (event) => {
  const user = await verifySystemAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  await checkPlanLimit(user.organizationId, "groups");

  const body = await readBody(event);

  if (!body.name || typeof body.name !== "string") {
    throw createError({ statusCode: 400, statusMessage: "グループ名は必須です" });
  }

  const db = getAdminFirestore();
  const now = new Date().toISOString();
  const groupRef = db.collection("groups").doc();

  await groupRef.set({
    organizationId: user.organizationId,
    name: body.name.trim(),
    description: (body.description || "").trim(),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: groupRef.id,
    organizationId: user.organizationId,
    name: body.name.trim(),
    description: (body.description || "").trim(),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
});
