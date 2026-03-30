import { constructWebhookEvent, retrieveCheckoutSession } from "~~/server/utils/stripe";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";

/**
 * Stripe Webhook ハンドラ
 * 認証不要（Stripe 署名検証で保護）
 */
export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event);
  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: "リクエストボディが空です" });
  }

  const signature = getHeader(event, "stripe-signature");
  if (!signature) {
    throw createError({ statusCode: 400, statusMessage: "stripe-signature ヘッダーがありません" });
  }

  let stripeEvent;
  try {
    stripeEvent = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe/webhook] 署名検証エラー:", message);
    throw createError({ statusCode: 400, statusMessage: `Webhook 署名検証に失敗しました: ${message}` });
  }

  const db = getAdminFirestore();

  try {
    switch (stripeEvent.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(db, stripeEvent);
        break;
      }
      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(db, stripeEvent);
        break;
      }
      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(db, stripeEvent);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = stripeEvent.data.object;
        console.warn("[stripe/webhook] 支払い失敗:", {
          invoiceId: invoice.id,
          customerId: invoice.customer,
        });
        break;
      }
      default: {
        console.log(`[stripe/webhook] 未処理のイベントタイプ: ${stripeEvent.type}`);
      }
    }
  } catch (err) {
    // イベント処理エラーはログに記録するが、200 を返す（Stripe の再送を防ぐ）
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe/webhook] イベント処理エラー (${stripeEvent.type}):`, message);
  }

  return { received: true };
});

/**
 * checkout.session.completed: 申請の Stripe 情報を更新する
 */
async function handleCheckoutSessionCompleted(
  db: FirebaseFirestore.Firestore,
  stripeEvent: { data: { object: { id: string; metadata?: Record<string, string> | null } } },
): Promise<void> {
  const session = stripeEvent.data.object;
  const applicationId = session.metadata?.applicationId;

  if (!applicationId) {
    console.warn("[stripe/webhook] checkout.session.completed: metadata に applicationId がありません");
    return;
  }

  const applicationRef = db.collection("applications").doc(applicationId);
  const applicationDoc = await applicationRef.get();

  if (!applicationDoc.exists) {
    console.warn(`[stripe/webhook] 申請が見つかりません: ${applicationId}`);
    return;
  }

  // Checkout セッションから支払い情報を取得
  const paymentInfo = await retrieveCheckoutSession(session.id);

  await applicationRef.update({
    stripeCustomerId: paymentInfo.customerId,
    stripeSetupIntentId: paymentInfo.setupIntentId,
    stripePaymentMethodId: paymentInfo.paymentMethodId,
    updatedAt: new Date().toISOString(),
  });

  console.log(`[stripe/webhook] 申請 ${applicationId} の Stripe 情報を更新しました`);
}

/**
 * customer.subscription.updated: 契約ステータスを同期する
 */
async function handleSubscriptionUpdated(
  db: FirebaseFirestore.Firestore,
  stripeEvent: { data: { object: { id: string; status: string } } },
): Promise<void> {
  const subscription = stripeEvent.data.object;

  const contractSnapshot = await db
    .collection("contracts")
    .where("stripeSubscriptionId", "==", subscription.id)
    .limit(1)
    .get();

  if (contractSnapshot.empty) {
    console.warn(`[stripe/webhook] 契約が見つかりません (subscriptionId: ${subscription.id})`);
    return;
  }

  const statusMapping: Record<string, string> = {
    active: "active",
    past_due: "suspended",
    canceled: "cancelled",
    unpaid: "suspended",
  };

  const newStatus = statusMapping[subscription.status];
  if (!newStatus) {
    console.log(`[stripe/webhook] 未マッピングの subscription.status: ${subscription.status}`);
    return;
  }

  const contractDoc = contractSnapshot.docs[0];
  await contractDoc.ref.update({
    status: newStatus,
    updatedAt: new Date().toISOString(),
  });

  console.log(
    `[stripe/webhook] 契約 ${contractDoc.id} のステータスを ${newStatus} に更新しました`,
  );
}

/**
 * customer.subscription.deleted: 契約をキャンセル済みにする
 */
async function handleSubscriptionDeleted(
  db: FirebaseFirestore.Firestore,
  stripeEvent: { data: { object: { id: string } } },
): Promise<void> {
  const subscription = stripeEvent.data.object;

  const contractSnapshot = await db
    .collection("contracts")
    .where("stripeSubscriptionId", "==", subscription.id)
    .limit(1)
    .get();

  if (contractSnapshot.empty) {
    console.warn(`[stripe/webhook] 契約が見つかりません (subscriptionId: ${subscription.id})`);
    return;
  }

  const contractDoc = contractSnapshot.docs[0];
  await contractDoc.ref.update({
    status: "cancelled",
    updatedAt: new Date().toISOString(),
  });

  console.log(`[stripe/webhook] 契約 ${contractDoc.id} をキャンセル済みに更新しました`);
}
