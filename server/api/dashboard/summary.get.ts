import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import type { DashboardSummary } from "~~/shared/types/api";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  let db;
  try {
    db = getAdminFirestore();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[dashboard/summary] Firestore初期化エラー:", message);
    throw createError({ statusCode: 503, statusMessage: `Firestore初期化エラー: ${message}` });
  }

  try {
    const convCollection = db.collection("conversations").where("groupId", "==", groupId);

    // 会話統計: count() クエリで全量ロードを回避
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
      .where("status", "==", "open")
      .count()
      .get();
    const improvementRequestCount = improvementsSnap.data().count;

    // 直近7日間のトレンド（日付フィルタ付きで取得）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();

    const trendSnap = await convCollection
      .where("createdAt", ">=", sevenDaysAgoStr)
      .orderBy("createdAt", "desc")
      .get();

    const trendMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      trendMap[d.toISOString().split("T")[0]] = 0;
    }
    for (const doc of trendSnap.docs) {
      const dateKey = doc.data().createdAt?.split("T")[0];
      if (dateKey && trendMap[dateKey] !== undefined) {
        trendMap[dateKey]++;
      }
    }
    const conversationTrend = Object.entries(trendMap).map(([date, count]) => ({ date, count }));

    // サービス別分布（直近7日間のデータから算出）
    const serviceCountMap: Record<string, number> = {};
    const serviceResolvedMap: Record<string, number> = {};
    for (const doc of trendSnap.docs) {
      const sid = doc.data().serviceId;
      serviceCountMap[sid] = (serviceCountMap[sid] || 0) + 1;
      if (doc.data().status === "resolved_by_bot") {
        serviceResolvedMap[sid] = (serviceResolvedMap[sid] || 0) + 1;
      }
    }
    const servicesSnap = await db
      .collection("services")
      .where("groupId", "==", groupId)
      .get();
    const serviceNameMap: Record<string, string> = {};
    servicesSnap.docs.forEach((d) => {
      serviceNameMap[d.id] = d.data().name;
    });
    const serviceDistribution = Object.entries(serviceCountMap)
      .map(([serviceId, count]) => ({
        serviceId,
        serviceName: serviceNameMap[serviceId] || "不明",
        count,
        resolutionRate: count > 0 ? (serviceResolvedMap[serviceId] || 0) / count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 未解決の会話（直近5件）
    const unresolvedSnap = await db
      .collection("conversations")
      .where("groupId", "==", groupId)
      .where("status", "==", "escalated")
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();
    const recentUnresolved = unresolvedSnap.docs.map((d) => ({
      id: d.id,
      title: d.data().title,
      createdAt: d.data().createdAt,
    }));

    // ドキュメント利用状況
    const docsSnap = await db
      .collection("documents")
      .where("groupId", "==", groupId)
      .get();

    const topReferencedDocs = docsSnap.docs
      .map((d) => ({
        id: d.id,
        title: d.data().title as string,
        referenceCount: (d.data().referenceCount as number) || 0,
        serviceId: d.data().serviceId as string,
      }))
      .sort((a, b) => b.referenceCount - a.referenceCount)
      .slice(0, 5);

    const unreferencedDocs = docsSnap.docs
      .filter((d) => d.data().status === "ready" && (!d.data().referenceCount || d.data().referenceCount === 0))
      .map((d) => ({
        id: d.id,
        title: d.data().title as string,
        serviceId: d.data().serviceId as string,
      }));

    return {
      totalConversations,
      resolutionRate,
      improvementRequestCount,
      conversationTrend,
      serviceDistribution,
      recentUnresolved,
      topReferencedDocs,
      unreferencedDocCount: unreferencedDocs.length,
      unreferencedDocs: unreferencedDocs.slice(0, 5),
    } as DashboardSummary;
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e) {
      throw e;
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[dashboard/summary] Firestoreクエリエラー:", message);
    throw createError({ statusCode: 500, statusMessage: `ダッシュボードデータ取得エラー: ${message}` });
  }
});
