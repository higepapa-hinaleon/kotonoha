import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin, isPlatformAdmin } from "~~/server/utils/auth";
import { PLAN_DEFINITIONS } from "~~/shared/plans";
import type { PlanId } from "~~/shared/plans";
import type { OrganizationUsage } from "~~/shared/types/api";

export default defineEventHandler(async (event): Promise<OrganizationUsage> => {
  const user = await verifySystemAdmin(event);

  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "組織IDが必要です" });

  // プラットフォーム管理者以外は自組織のみ
  if (!isPlatformAdmin(user) && id !== user.organizationId) {
    throw createError({ statusCode: 403, statusMessage: "自分の組織のみアクセスできます" });
  }

  try {
    const db = getAdminFirestore();

    // 組織のプラン取得
    const orgDoc = await db.collection("organizations").doc(id).get();
    if (!orgDoc.exists) {
      throw createError({ statusCode: 404, statusMessage: "組織が見つかりません" });
    }
    const planId = (orgDoc.data()?.plan as PlanId) || "free";
    const plan = PLAN_DEFINITIONS[planId];

    // 今月の開始日
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 各リソースのカウントを並列取得
    const [usersSnap, groupsSnap, servicesSnap, documentsSnap, chatsSnap] = await Promise.all([
      db.collection("users").where("organizationId", "==", id).count().get(),
      db.collection("groups").where("organizationId", "==", id).count().get(),
      db.collection("services").where("organizationId", "==", id).count().get(),
      db.collection("documents").where("organizationId", "==", id).count().get(),
      db
        .collection("conversations")
        .where("organizationId", "==", id)
        .where("createdAt", ">=", monthStart)
        .count()
        .get(),
    ]);

    return {
      users: usersSnap.data().count,
      groups: groupsSnap.data().count,
      services: servicesSnap.data().count,
      documents: documentsSnap.data().count,
      monthlyChats: chatsSnap.data().count,
      limits: plan.limits,
    };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e) throw e;
    const message = e instanceof Error ? e.message : String(e);
    console.error("[system/organizations/usage] Firestore操作エラー:", message);
    throw createError({
      statusCode: 500,
      statusMessage: `利用状況の取得に失敗しました: ${message}`,
    });
  }
});
