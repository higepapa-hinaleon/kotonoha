import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import { checkFeatureFlag } from "~~/server/utils/plan-limit";
import { generateStructuredJson } from "~~/server/utils/ai-generator";
import { WEEKLY_REPORT_RETENTION_DAYS, BATCH_SIZE_LIMIT } from "~~/server/utils/constants";
import type { WeeklyReport, ReportStats } from "~~/shared/types/models";

interface GeminiInsights {
  insights: string[];
  recommendations: string[];
}

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  await checkFeatureFlag(user.organizationId, "weeklyReports");
  const body = await readBody<{ periodStart: string; periodEnd: string }>(event);

  if (!body.periodStart || !body.periodEnd) {
    throw createError({ statusCode: 400, statusMessage: "periodStart と periodEnd は必須です" });
  }

  const db = getAdminFirestore();
  const orgId = user.organizationId;

  // 1. 期間内の会話を取得
  const conversationsSnap = await db
    .collection("conversations")
    .where("groupId", "==", groupId)
    .where("createdAt", ">=", body.periodStart)
    .where("createdAt", "<=", body.periodEnd)
    .get();

  const conversations = conversationsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Array<{ id: string; status?: string; [key: string]: unknown }>;
  const totalConversations = conversations.length;
  const resolvedByBot = conversations.filter((c) => c.status === "resolved_by_bot").length;
  const escalated = conversations.filter((c) => c.status === "escalated").length;
  const resolutionRate = totalConversations > 0 ? resolvedByBot / totalConversations : 0;

  // 2. 平均確信度を計算
  let totalConfidence = 0;
  let confidenceCount = 0;

  // 会話メッセージを並列取得（N+1 回避）
  const messageResults = await Promise.allSettled(
    conversationsSnap.docs.map((conv) =>
      conv.ref.collection("messages").where("role", "==", "assistant").get(),
    ),
  );
  for (const result of messageResults) {
    if (result.status === "fulfilled") {
      for (const msgDoc of result.value.docs) {
        const confidence = msgDoc.data().confidence;
        if (confidence != null && confidence > 0) {
          totalConfidence += confidence;
          confidenceCount++;
        }
      }
    }
    // rejected は個別の会話メッセージ取得失敗 → スキップ
  }
  const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

  // 3. サービス別集計
  const serviceCountMap: Record<string, number> = {};
  for (const c of conversations) {
    const sid = (c as Record<string, unknown>).serviceId as string;
    serviceCountMap[sid] = (serviceCountMap[sid] || 0) + 1;
  }

  const servicesSnap = await db.collection("services").where("groupId", "==", groupId).get();
  const serviceNameMap: Record<string, string> = {};
  servicesSnap.docs.forEach((d) => {
    serviceNameMap[d.id] = d.data().name;
  });

  const topServices = Object.entries(serviceCountMap)
    .map(([serviceId, count]) => ({
      serviceId,
      serviceName: serviceNameMap[serviceId] || "不明",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 4. 改善要望数
  const improvementsSnap = await db
    .collection("improvementRequests")
    .where("groupId", "==", groupId)
    .where("createdAt", ">=", body.periodStart)
    .where("createdAt", "<=", body.periodEnd)
    .get();
  const improvementRequestCount = improvementsSnap.size;

  const stats: ReportStats = {
    totalConversations,
    resolvedByBot,
    escalated,
    resolutionRate,
    averageConfidence,
    topServices,
    improvementRequestCount,
  };

  // 5. Gemini でインサイトを生成
  const systemPrompt = `あなたはAIサポートボットの運用アナリストです。
以下の週次統計データを分析し、インサイトと改善提案を生成してください。

ルール:
- insightsは3〜5項目の分析結果（現状の評価や傾向）
- recommendationsは2〜4項目の具体的な改善提案
- 日本語で簡潔に記載してください
- JSON形式で出力: { "insights": ["..."], "recommendations": ["..."] }`;

  const statsText = JSON.stringify(stats, null, 2);

  let insights: string[] = [];
  let recommendations: string[] = [];

  try {
    const generated = await generateStructuredJson<GeminiInsights>(
      systemPrompt,
      `期間: ${body.periodStart} 〜 ${body.periodEnd}\n\n統計データ:\n${statsText}`,
    );
    insights = generated.insights || [];
    recommendations = generated.recommendations || [];
  } catch {
    // AI生成に失敗しても統計データだけでレポートを作成する
    insights = ["AI分析の生成に失敗しました。統計データのみのレポートです。"];
    recommendations = [];
  }

  // 6. レポートを保存
  const now = new Date().toISOString();
  const docRef = db.collection("weeklyReports").doc();

  const report: Omit<WeeklyReport, "id"> = {
    organizationId: orgId,
    groupId,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    stats,
    insights,
    recommendations,
    createdAt: now,
  };

  await docRef.set(report);

  // 古いレポートを非同期で削除（非ブロッキング）
  const retentionDate = new Date(
    Date.now() - WEEKLY_REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  db.collection("weeklyReports")
    .where("groupId", "==", groupId)
    .where("createdAt", "<", retentionDate)
    .get()
    .then(async (snapshot) => {
      if (snapshot.empty) return;
      const batches: FirebaseFirestore.WriteBatch[] = [];
      let currentBatch = db.batch();
      let opsInBatch = 0;
      for (const doc of snapshot.docs) {
        if (opsInBatch >= BATCH_SIZE_LIMIT) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          opsInBatch = 0;
        }
        currentBatch.delete(doc.ref);
        opsInBatch++;
      }
      batches.push(currentBatch);
      await Promise.all(batches.map((b) => b.commit()));
      console.info(`[reports] Cleaned up ${snapshot.size} old weekly reports for group ${groupId}`);
    })
    .catch((err) => {
      console.warn("[reports] Failed to clean up old weekly reports:", err);
    });

  return { id: docRef.id, ...report } as WeeklyReport;
});
