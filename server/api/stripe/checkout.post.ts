import { verifyAuth } from "~~/server/utils/auth";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { createCheckoutSession } from "~~/server/utils/stripe";

/**
 * Stripe Checkout セッションを再作成する（中断後の再開用）
 * 認証必須
 */
export default defineEventHandler(async (event) => {
  const user = await verifyAuth(event);
  const body = await readBody(event);

  if (!body?.applicationId) {
    throw createError({ statusCode: 400, statusMessage: "applicationId が必要です" });
  }

  const db = getAdminFirestore();
  const applicationRef = db.collection("applications").doc(body.applicationId);
  const applicationDoc = await applicationRef.get();

  if (!applicationDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "申請が見つかりません" });
  }

  const application = applicationDoc.data()!;

  // 申請者本人か確認
  if (application.applicantUserId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: "この申請へのアクセス権がありません" });
  }

  // ステータスが pending であることを確認
  if (application.status !== "pending") {
    throw createError({
      statusCode: 400,
      statusMessage: `この申請は現在 ${application.status} のため、チェックアウトを開始できません`,
    });
  }

  const config = useRuntimeConfig();
  const baseUrl = config.publicUrl || "http://localhost:3000";

  const session = await createCheckoutSession({
    applicationId: body.applicationId,
    customerEmail: application.applicantEmail,
    successUrl: `${baseUrl}/admin?checkout=success`,
    cancelUrl: `${baseUrl}/apply?checkout=cancelled`,
  });

  // 新しいセッション ID を申請に保存
  await applicationRef.update({
    stripeCheckoutSessionId: session.id,
    updatedAt: new Date().toISOString(),
  });

  return { checkoutUrl: session.url };
});
