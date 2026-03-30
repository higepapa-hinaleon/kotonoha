import { verifySystemAdmin } from "~~/server/utils/auth";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { sendApplicationRejectedEmail } from "~~/server/utils/email";
import type { Application } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const admin = await verifySystemAdmin(event);
  const applicationId = getRouterParam(event, "id");

  if (!applicationId) {
    throw createError({ statusCode: 400, statusMessage: "申請IDが必要です" });
  }

  const db = getAdminFirestore();
  const applicationDoc = await db.collection("applications").doc(applicationId).get();

  if (!applicationDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "申請が見つかりません" });
  }

  const application = { id: applicationDoc.id, ...applicationDoc.data() } as Application;

  if (application.status !== "pending") {
    throw createError({
      statusCode: 400,
      statusMessage: `この申請は既に処理済みです（ステータス: ${application.status}）`,
    });
  }

  const body = await readBody(event);
  const reviewNote = typeof body?.reviewNote === "string" ? body.reviewNote.trim() : "";

  const now = new Date().toISOString();

  // 申請を却下に更新
  await db.collection("applications").doc(applicationId).update({
    status: "rejected",
    reviewedBy: admin.id,
    reviewNote,
    updatedAt: now,
  });

  // 補助処理: 却下通知メール（非ブロッキング）
  sendApplicationRejectedEmail({
    to: application.applicantEmail,
    organizationName: application.organizationName,
    reason: reviewNote || undefined,
  }).catch((err) => {
    console.error("[reject] 却下通知メール送信に失敗:", err);
  });

  // 更新後の申請を返却
  const updatedDoc = await db.collection("applications").doc(applicationId).get();
  const updatedApplication = { id: updatedDoc.id, ...updatedDoc.data() } as Application;

  return { application: updatedApplication };
});
