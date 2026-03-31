import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyOwner, isPlatformAdmin } from "~~/server/utils/auth";
import { VALID_PLAN_IDS } from "~~/shared/plans";
import type { PlanId } from "~~/shared/plans";

const VALID_STATUSES = ["active", "suspended", "expired", "cancelled"] as const;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export default defineEventHandler(async (event) => {
  const user = await verifyOwner(event);

  const orgId = getRouterParam(event, "id");
  const contractId = getRouterParam(event, "contractId");
  if (!orgId || !contractId) {
    throw createError({ statusCode: 400, statusMessage: "組織IDと契約IDが必要です" });
  }

  // プラットフォーム管理者以外は自組織のみ
  if (!isPlatformAdmin(user) && orgId !== user.organizationId) {
    throw createError({ statusCode: 403, statusMessage: "自分の組織のみ管理できます" });
  }

  try {
    const body = await readBody(event);
    const db = getAdminFirestore();

    const contractRef = db.collection("contracts").doc(contractId);
    const contractDoc = await contractRef.get();

    if (!contractDoc.exists) {
      throw createError({ statusCode: 404, statusMessage: "契約が見つかりません" });
    }
    const existingData = contractDoc.data()!;
    if (existingData.organizationId !== orgId) {
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
    if (body.startDate !== undefined) {
      if (!DATE_REGEX.test(body.startDate)) {
        throw createError({
          statusCode: 400,
          statusMessage: "日付形式が正しくありません（YYYY-MM-DD）",
        });
      }
      updates.startDate = body.startDate;
    }
    if (body.endDate !== undefined) {
      if (!DATE_REGEX.test(body.endDate)) {
        throw createError({
          statusCode: 400,
          statusMessage: "日付形式が正しくありません（YYYY-MM-DD）",
        });
      }
      updates.endDate = body.endDate;
    }
    if (body.note !== undefined) updates.note = (body.note || "").trim();

    // 日付の整合性チェック（更新後の値で検証）
    const finalStartDate = (updates.startDate as string) || existingData.startDate;
    const finalEndDate = (updates.endDate as string) || existingData.endDate;
    if (finalStartDate > finalEndDate) {
      throw createError({ statusCode: 400, statusMessage: "開始日は終了日以前である必要があります" });
    }

    await contractRef.update(updates);

    const updatedDoc = await contractRef.get();
    if (!updatedDoc.exists) {
      throw createError({ statusCode: 404, statusMessage: "更新後の契約が見つかりません" });
    }
    return { id: contractId, ...updatedDoc.data() };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e) throw e;
    const message = e instanceof Error ? e.message : String(e);
    console.error("[system/contracts/put] Firestore操作エラー:", message);
    throw createError({ statusCode: 500, statusMessage: `契約の更新に失敗しました: ${message}` });
  }
});
