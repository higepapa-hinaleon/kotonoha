import { verifyOrgAdmin } from "~~/server/utils/auth";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import type { PaymentMethod } from "~~/shared/types/models";

/**
 * 請求情報を取得する（認証ユーザーの組織の支払い方法・Stripe 連携有無）
 */
export default defineEventHandler(async (event) => {
  const user = await verifyOrgAdmin(event);

  if (!user.organizationId) {
    return { hasStripe: false, paymentMethod: "none" as PaymentMethod };
  }

  const db = getAdminFirestore();

  // 最新の契約を取得
  const contractSnapshot = await db
    .collection("contracts")
    .where("organizationId", "==", user.organizationId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (contractSnapshot.empty) {
    return { hasStripe: false, paymentMethod: "none" as PaymentMethod };
  }

  const contract = contractSnapshot.docs[0].data();
  const paymentMethod = (contract.paymentMethod as PaymentMethod) || "none";

  // Stripe 連携有無は organization の stripeCustomerId で判定
  const orgDoc = await db.collection("organizations").doc(user.organizationId).get();
  const hasStripe = !!(orgDoc.exists && orgDoc.data()?.stripeCustomerId);

  return { hasStripe, paymentMethod };
});
