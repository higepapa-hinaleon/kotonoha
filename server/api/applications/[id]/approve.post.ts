import { verifySystemAdmin } from "~~/server/utils/auth";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { createOrganizationFromApplication } from "~~/server/utils/organization";
import { findOrCreateDefaultGroup, addUserToGroup } from "~~/server/utils/group";
import { createSubscription } from "~~/server/utils/stripe";
import {
  sendApplicationApprovedEmail,
  sendInvoiceEmail,
} from "~~/server/utils/email";
import { PLAN_DEFINITIONS } from "~~/shared/plans";
import type { Application, ContractStatus, PaymentMethod } from "~~/shared/types/models";

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

  // 冪等性: 既に承認済みの場合はそのまま返却
  if (application.status === "approved") {
    return { application };
  }

  if (application.status !== "pending") {
    throw createError({
      statusCode: 400,
      statusMessage: `この申請は処理できません（ステータス: ${application.status}）`,
    });
  }

  // 既に組織が作成済みの場合（部分的に処理済み）は重複作成を防ぐ
  if (application.organizationId) {
    throw createError({
      statusCode: 409,
      statusMessage: "この申請は既に組織が作成されています。データの整合性を確認してください。",
    });
  }

  const now = new Date().toISOString();
  let contractStatus: ContractStatus;
  let contractPaymentMethod: PaymentMethod = application.paymentMethod;
  let stripeSubscriptionId: string | undefined;

  // 支払方法に応じた処理
  if (application.paymentMethod === "stripe") {
    // Stripe: PaymentMethod が必要
    if (!application.stripePaymentMethodId || !application.stripeCustomerId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Stripe の支払い情報が未設定です。Checkout を完了してください。",
      });
    }

    // サブスクリプション作成
    const subscription = await createSubscription({
      customerId: application.stripeCustomerId,
      paymentMethodId: application.stripePaymentMethodId,
      planId: application.planId,
    });
    stripeSubscriptionId = subscription.id;
    contractStatus = "active";
  } else if (application.paymentMethod === "bank_transfer") {
    // 銀行振込: 入金待ち
    contractStatus = "pending_payment";
  } else {
    // 無料プラン
    contractStatus = "active";
    contractPaymentMethod = "none";
  }

  // 1. 組織を作成
  const organizationId = await createOrganizationFromApplication(application, db);

  // 2. ユーザーの organizationId を先に更新（Firestoreルールの belongsToOrg が通るように）
  await db.collection("users").doc(application.applicantUserId).update({
    organizationId,
    role: "org_admin",
    updatedAt: now,
  });

  // 3. 契約を作成
  const startDate = now;
  const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const contractRef = db.collection("contracts").doc();
  const contractData: Record<string, unknown> = {
    organizationId,
    planId: application.planId,
    status: contractStatus,
    paymentMethod: contractPaymentMethod,
    startDate,
    endDate,
    note: "",
    createdAt: now,
    updatedAt: now,
  };
  if (stripeSubscriptionId) {
    contractData.stripeSubscriptionId = stripeSubscriptionId;
  }
  await contractRef.set(contractData);
  const contractId = contractRef.id;

  // 4. デフォルトグループを作成
  const groupId = await findOrCreateDefaultGroup(organizationId, db);

  // 5. ユーザーをグループに admin として追加
  await addUserToGroup(application.applicantUserId, groupId, organizationId, "admin", db);

  // 6. ユーザーの activeGroupId を設定
  await db.collection("users").doc(application.applicantUserId).update({
    activeGroupId: groupId,
    updatedAt: now,
  });

  // 7. 申請を更新
  await db.collection("applications").doc(applicationId).update({
    status: "approved",
    organizationId,
    contractId,
    reviewedBy: admin.id,
    updatedAt: now,
  });

  // 補助処理: メール通知（非ブロッキング）
  const config = useRuntimeConfig();
  const baseUrl = config.publicUrl || "http://localhost:3000";

  // 承認通知メール
  sendApplicationApprovedEmail({
    to: application.applicantEmail,
    organizationName: application.organizationName,
    loginUrl: `${baseUrl}/login`,
  }).catch((err) => {
    console.error("[approve] 承認通知メール送信に失敗:", err);
  });

  // 銀行振込の場合は請求メールも送信
  if (application.paymentMethod === "bank_transfer") {
    const plan = PLAN_DEFINITIONS[application.planId];
    sendInvoiceEmail({
      to: application.applicantEmail,
      organizationName: application.organizationName,
      contactName: application.contactName,
      planName: plan.displayName,
      amount: plan.priceMonthly,
      invoiceNumber: application.invoiceNumber,
    }).catch((err) => {
      console.error("[approve] 請求メール送信に失敗:", err);
    });
  }

  // 更新後の申請を返却
  const updatedDoc = await db.collection("applications").doc(applicationId).get();
  const updatedApplication = { id: updatedDoc.id, ...updatedDoc.data() } as Application;

  return { application: updatedApplication };
});
