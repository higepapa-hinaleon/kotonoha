import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import type { ServiceDashboardSummary } from "~~/shared/types/api";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  const query = getQuery(event);
  const serviceId = query.serviceId as string;
  if (!serviceId) {
    throw createError({ statusCode: 400, statusMessage: "serviceId は必須です" });
  }

  let db;
  try {
    db = getAdminFirestore();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[dashboard/service-summary] Firestore初期化エラー:", message);
    throw createError({ statusCode: 503, statusMessage: `Firestore初期化エラー: ${message}` });
  }

  try {
    // サービス名を取得
    const serviceDoc = await db.collection("services").doc(serviceId).get();
    if (!serviceDoc.exists || serviceDoc.data()?.groupId !== groupId) {
      throw createError({ statusCode: 404, statusMessage: "サービスが見つかりません" });
    }
    const serviceName = serviceDoc.data()!.name as string;

    const convCollection = db
      .collection("conversations")
      .where("groupId", "==", groupId)
      .where("serviceId", "==", serviceId);

    // 会話統計
    const [totalSnap, resolvedSnap] = await Promise.all([
      convCollection.count().get(),
      convCollection.where("status", "==", "resolved_by_bot").count().get(),
    ]);

    const totalConversations = totalSnap.data().count;
    const resolvedByBot = resolvedSnap.data().count;
    const resolutionRate = totalConversations > 0 ? resolvedByBot / totalConversations : 0;

    // 改善要望数
    const improvementsSnap = await db
      .collection("improvementRequests")
      .where("groupId", "==", groupId)
      .where("serviceId", "==", serviceId)
      .where("status", "==", "open")
      .count()
      .get();
    const improvementRequestCount = improvementsSnap.data().count;

    // 直近7日間のトレンド + 未解決の会話を並行取得
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();

    const [trendSnap, unresolvedSnap] = await Promise.all([
      convCollection.where("createdAt", ">=", sevenDaysAgoStr).orderBy("createdAt", "desc").get(),
      db
        .collection("conversations")
        .where("groupId", "==", groupId)
        .where("serviceId", "==", serviceId)
        .where("status", "==", "escalated")
        .orderBy("createdAt", "desc")
        .limit(5)
        .get(),
    ]);

    const trendMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      trendMap[d.toISOString().split("T")[0]!] = 0;
    }
    for (const doc of trendSnap.docs) {
      const dateKey = doc.data().createdAt?.split("T")[0];
      if (dateKey && trendMap[dateKey] !== undefined) {
        trendMap[dateKey]++;
      }
    }
    const conversationTrend = Object.entries(trendMap).map(([date, count]) => ({ date, count }));

    const recentUnresolved = unresolvedSnap.docs.map((d) => ({
      id: d.id,
      title: d.data().title,
      createdAt: d.data().createdAt,
    }));

    return {
      serviceId,
      serviceName,
      totalConversations,
      resolutionRate,
      improvementRequestCount,
      conversationTrend,
      recentUnresolved,
    } as ServiceDashboardSummary;
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e) {
      throw e;
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[dashboard/service-summary] Firestoreクエリエラー:", message);
    throw createError({
      statusCode: 500,
      statusMessage: `サービスダッシュボードデータ取得エラー: ${message}`,
    });
  }
});
