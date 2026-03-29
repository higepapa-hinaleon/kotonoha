import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin } from "~~/server/utils/auth";
import { VALID_PLAN_IDS } from "~~/shared/plans";
import type { PlanId } from "~~/shared/plans";

export default defineEventHandler(async (event) => {
  await verifySystemAdmin(event);

  const orgId = getRouterParam(event, "id");
  if (!orgId) throw createError({ statusCode: 400, statusMessage: "組織IDが必要です" });

  const body = await readBody(event);
  const db = getAdminFirestore();

  // 組織の存在確認
  const orgDoc = await db.collection("organizations").doc(orgId).get();
  if (!orgDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "組織が見つかりません" });
  }

  // バリデーション
  if (!body.planId || !VALID_PLAN_IDS.includes(body.planId as PlanId)) {
    throw createError({ statusCode: 400, statusMessage: "有効なプランIDが必要です" });
  }
  if (!body.startDate || !body.endDate) {
    throw createError({ statusCode: 400, statusMessage: "開始日と終了日は必須です" });
  }

  const now = new Date().toISOString();
  const contractRef = db.collection("contracts").doc();

  const contractData = {
    organizationId: orgId,
    planId: body.planId,
    status: body.status || "active",
    startDate: body.startDate,
    endDate: body.endDate,
    note: (body.note || "").trim(),
    createdAt: now,
    updatedAt: now,
  };

  await contractRef.set(contractData);

  return { id: contractRef.id, ...contractData };
});
