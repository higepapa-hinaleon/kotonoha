import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin, isPlatformAdmin } from "~~/server/utils/auth";
import { checkPlanLimit } from "~~/server/utils/plan-limit";

export default defineEventHandler(async (event) => {
  const user = await verifySystemAdmin(event);

  const body = await readBody(event);

  // プラットフォーム管理者は組織を指定可能
  const targetOrgId = isPlatformAdmin(user) && body.organizationId
    ? body.organizationId
    : user.organizationId;

  if (!targetOrgId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  await checkPlanLimit(targetOrgId, "groups");

  if (!body.name || typeof body.name !== "string") {
    throw createError({ statusCode: 400, statusMessage: "グループ名は必須です" });
  }

  const db = getAdminFirestore();
  const now = new Date().toISOString();
  const groupRef = db.collection("groups").doc();

  await groupRef.set({
    organizationId: targetOrgId,
    name: body.name.trim(),
    description: (body.description || "").trim(),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: groupRef.id,
    organizationId: targetOrgId,
    name: body.name.trim(),
    description: (body.description || "").trim(),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
});
