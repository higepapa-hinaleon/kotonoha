import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin } from "~~/server/utils/auth";
import { VALID_PLAN_IDS } from "~~/shared/plans";
import type { PlanId } from "~~/shared/plans";

const VALID_STATUSES = ["active", "suspended", "expired", "cancelled"] as const;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export default defineEventHandler(async (event) => {
  const user = await verifySystemAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  const orgId = getRouterParam(event, "id");
  if (!orgId) throw createError({ statusCode: 400, statusMessage: "組織IDが必要です" });

  try {
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
    if (!DATE_REGEX.test(body.startDate) || !DATE_REGEX.test(body.endDate)) {
      throw createError({
        statusCode: 400,
        statusMessage: "日付形式が正しくありません（YYYY-MM-DD）",
      });
    }
    if (body.startDate > body.endDate) {
      throw createError({ statusCode: 400, statusMessage: "開始日は終了日以前である必要があります" });
    }
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      throw createError({ statusCode: 400, statusMessage: "無効なステータスです" });
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
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e) throw e;
    const message = e instanceof Error ? e.message : String(e);
    console.error("[system/contracts/post] Firestore操作エラー:", message);
    throw createError({ statusCode: 500, statusMessage: `契約の作成に失敗しました: ${message}` });
  }
});
