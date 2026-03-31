import { verifyOrgAdmin } from "~~/server/utils/auth";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { createPortalSession } from "~~/server/utils/stripe";

/**
 * Stripe Customer Portal セッションを作成する
 * 認証必須・Stripe 支払いユーザーのみ
 */
export default defineEventHandler(async (event) => {
  const user = await verifyOrgAdmin(event);

  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "組織に所属していません" });
  }

  const db = getAdminFirestore();
  const orgDoc = await db.collection("organizations").doc(user.organizationId).get();

  if (!orgDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "組織が見つかりません" });
  }

  const stripeCustomerId = orgDoc.data()?.stripeCustomerId as string | undefined;
  if (!stripeCustomerId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Stripe の顧客情報が登録されていません",
    });
  }

  const config = useRuntimeConfig();
  const baseUrl = config.publicUrl || "http://localhost:3000";

  const session = await createPortalSession({
    customerId: stripeCustomerId,
    returnUrl: `${baseUrl}/admin/settings`,
  });

  return { portalUrl: session.url };
});
