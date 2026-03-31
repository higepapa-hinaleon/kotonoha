import Stripe from "stripe";
import { PLAN_DEFINITIONS } from "~~/shared/plans";
import type { PlanId } from "~~/shared/plans";

let stripeInstance: Stripe | null = null;

/**
 * Stripe クライアントを取得する（シングルトン）
 */
export function getStripeClient(): Stripe {
  if (stripeInstance) return stripeInstance;

  const config = useRuntimeConfig();
  if (!config.stripeSecretKey) {
    throw createError({ statusCode: 500, statusMessage: "Stripe Secret Key が設定されていません" });
  }

  stripeInstance = new Stripe(config.stripeSecretKey);
  return stripeInstance;
}

/**
 * Stripe Checkout セッションを作成する（setup モード: 支払い情報の収集のみ）
 */
export async function createCheckoutSession(params: {
  applicationId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();

  // Stripe Customer を作成
  const customer = await stripe.customers.create({
    email: params.customerEmail,
    metadata: { applicationId: params.applicationId },
  });

  // setup モードでセッション作成（支払い情報の収集のみ、課金はしない）
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customer.id,
    payment_method_types: ["card"],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { applicationId: params.applicationId },
  });

  return session;
}

/**
 * Stripe Checkout セッションから支払い情報を取得する
 */
export async function retrieveCheckoutSession(sessionId: string): Promise<{
  customerId: string;
  setupIntentId: string;
  paymentMethodId: string;
}> {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["setup_intent"],
  });

  const setupIntent = session.setup_intent as Stripe.SetupIntent;
  if (!setupIntent) {
    throw createError({ statusCode: 400, statusMessage: "SetupIntent が見つかりません" });
  }

  return {
    customerId: session.customer as string,
    setupIntentId: setupIntent.id,
    paymentMethodId: setupIntent.payment_method as string,
  };
}

/**
 * プランIDに対応する Stripe Price ID を取得する
 * 環境変数（runtimeConfig）を優先し、未設定の場合は plans.ts のフォールバック値を使用
 */
export function getStripePriceId(planId: PlanId): string {
  if (planId === "free" || planId === "enterprise") {
    throw createError({
      statusCode: 400,
      statusMessage: `プラン ${planId} は Stripe サブスクリプション対象外です`,
    });
  }

  const config = useRuntimeConfig();

  const envMapping: Record<string, string> = {
    starter: config.stripePriceIdStarter,
    business: config.stripePriceIdBusiness,
  };

  const envValue = envMapping[planId];
  if (envValue) return envValue;

  // plans.ts のフォールバック値
  const fallback = PLAN_DEFINITIONS[planId].stripePriceId;
  if (fallback) return fallback;

  throw createError({
    statusCode: 400,
    statusMessage: `プラン ${planId} の Stripe Price ID が設定されていません。環境変数 NUXT_STRIPE_PRICE_ID_${planId.toUpperCase()} を設定してください。`,
  });
}

/**
 * 承認後に Stripe サブスクリプションを作成する
 */
export async function createSubscription(params: {
  customerId: string;
  paymentMethodId: string;
  planId: PlanId;
}): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();
  const priceId = getStripePriceId(params.planId);

  // デフォルトの支払い方法を設定
  await stripe.customers.update(params.customerId, {
    invoice_settings: { default_payment_method: params.paymentMethodId },
  });

  // サブスクリプション作成（setup モードで取得済みの支払方法で自動課金）
  const subscription = await stripe.subscriptions.create({
    customer: params.customerId,
    items: [{ price: priceId }],
    default_payment_method: params.paymentMethodId,
  });

  return subscription;
}

/**
 * Stripe サブスクリプションをキャンセルする
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const stripe = getStripeClient();
  await stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Stripe Webhook イベントを検証・解析する
 */
export function constructWebhookEvent(
  rawBody: string | Buffer,
  signature: string,
): Stripe.Event {
  const config = useRuntimeConfig();
  const stripe = getStripeClient();

  if (!config.stripeWebhookSecret) {
    throw createError({ statusCode: 500, statusMessage: "Stripe Webhook Secret が設定されていません" });
  }

  return stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
}
