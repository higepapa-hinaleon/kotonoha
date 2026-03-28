import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import type { WeeklyReport } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  const id = getRouterParam(event, "id");

  if (!id) throw createError({ statusCode: 400, statusMessage: "IDが必要です" });

  const db = getAdminFirestore();
  const doc = await db.collection("weeklyReports").doc(id).get();

  if (!doc.exists) throw createError({ statusCode: 404, statusMessage: "レポートが見つかりません" });

  const report = doc.data() as Omit<WeeklyReport, "id">;
  if (report.groupId !== groupId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  return { id: doc.id, ...report } as WeeklyReport;
});
