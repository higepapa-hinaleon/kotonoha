import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin } from "~~/server/utils/auth";
import { VALID_PLAN_IDS } from "~~/shared/plans";
import type { PlanId } from "~~/shared/plans";

const VALID_STATUSES = ["active", "suspended", "expired", "cancelled"] as const;

export default defineEventHandler(async (event) => {
  await verifySystemAdmin(event);

  const orgId = getRouterParam(event, "id");
  const contractId = getRouterParam(event, "contractId");
  if (!orgId || !contractId) {
    throw createError({ statusCode: 400, statusMessage: "組織IDと契約IDが必要です" });
  }

  const body = await readBody(event);
  const db = getAdminFirestore();

  const contractRef = db.collection("contracts").doc(contractId);
  const contractDoc = await contractRef.get();

  if (!contractDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "契約が見つかりません" });
  }
  if (contractDoc.data()?.organizationId !== orgId) {
    throw createError({ statusCode: 403, statusMessage: "この組織の契約ではありません" });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (body.planId !== undefined) {
    if (!VALID_PLAN_IDS.includes(body.planId as PlanId)) {
      throw createError({ statusCode: 400, statusMessage: "無効なプランです" });
    }
    updates.planId = body.planId;
  }
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      throw createError({ statusCode: 400, statusMessage: "無効なステータスです" });
    }
    updates.status = body.status;
  }
  if (body.startDate !== undefined) updates.startDate = body.startDate;
  if (body.endDate !== undefined) updates.endDate = body.endDate;
  if (body.note !== undefined) updates.note = (body.note || "").trim();

  await contractRef.update(updates);
  return { id: contractId, ...contractDoc.data(), ...updates };
});
