import { verifyAuth } from "~~/server/utils/auth";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { createOrganizationFromApplication } from "~~/server/utils/organization";
import { findOrCreateDefaultGroup, addUserToGroup } from "~~/server/utils/group";
import { createCheckoutSession } from "~~/server/utils/stripe";
import { VALID_PLAN_IDS } from "~~/shared/plans";
import type { Application } from "~~/shared/types/models";
import type { ApplicationSubmitRequest } from "~~/shared/types/api";

/**
 * フリープラン自動承認: 組織・契約・グループ作成、ユーザー更新を一括で行う
 */
async function autoApproveFreeApplication(
  application: Application,
  db: FirebaseFirestore.Firestore,
): Promise<{ organizationId: string; contractId: string; groupId: string }> {
  const now = new Date().toISOString();

  // 1. 組織を作成
  const organizationId = await createOrganizationFromApplication(application, db);

  // 2. 契約を作成（フリープラン: status: "active", paymentMethod: "none"）
  const startDate = now;
  const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const contractRef = db.collection("contracts").doc();
  await contractRef.set({
    organizationId,
    planId: application.planId,
    status: "active",
    paymentMethod: "none",
    startDate,
    endDate,
    note: "フリープラン自動承認",
    createdAt: now,
    updatedAt: now,
  });
  const contractId = contractRef.id;

  // 3. デフォルトグループを作成
  const groupId = await findOrCreateDefaultGroup(organizationId, db);

  // 4. ユーザーをグループに admin として追加
  await addUserToGroup(application.applicantUserId, groupId, organizationId, "admin", db);

  // 5. ユーザーを更新: organizationId, role, activeGroupId
  await db.collection("users").doc(application.applicantUserId).update({
    organizationId,
    role: "org_admin",
    activeGroupId: groupId,
    updatedAt: now,
  });

  // 6. 申請を更新: status, organizationId, contractId
  await db.collection("applications").doc(application.id).update({
    status: "approved",
    organizationId,
    contractId,
    updatedAt: now,
  });

  return { organizationId, contractId, groupId };
}

export default defineEventHandler(async (event) => {
  const user = await verifyAuth(event);

  // 組織未所属であることを確認
  if (user.organizationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "既に組織に所属しています",
    });
  }

  const db = getAdminFirestore();

  // 既存の pending 申請がないか確認（冪等性: 重複申請防止）
  const existingSnapshot = await db
    .collection("applications")
    .where("applicantUserId", "==", user.id)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    throw createError({
      statusCode: 409,
      statusMessage: "審査中の申請が既に存在します",
    });
  }

  const body = (await readBody(event)) as ApplicationSubmitRequest;

  // 共通必須フィールドバリデーション
  const commonRequiredFields = [
    "organizationType",
    "organizationName",
    "contactName",
    "planId",
    "paymentMethod",
  ] as const;

  for (const field of commonRequiredFields) {
    if (!body[field] || typeof body[field] !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: `${field} は必須です`,
      });
    }
  }

  // 組織区分別の必須フィールドバリデーション
  if (body.organizationType === "individual") {
    if (!body.phone || typeof body.phone !== "string") {
      throw createError({ statusCode: 400, statusMessage: "個人の場合、電話番号（phone）は必須です" });
    }
  } else if (body.organizationType === "sole_proprietor") {
    if (!body.tradeName || typeof body.tradeName !== "string") {
      throw createError({ statusCode: 400, statusMessage: "個人事業主の場合、屋号（tradeName）は必須です" });
    }
  } else if (body.organizationType === "corporation") {
    if (!body.phone || typeof body.phone !== "string") {
      throw createError({ statusCode: 400, statusMessage: "法人の場合、電話番号（phone）は必須です" });
    }
    if (!body.address || typeof body.address !== "string") {
      throw createError({ statusCode: 400, statusMessage: "法人の場合、住所（address）は必須です" });
    }
  }
  // representativeName・corporateNumber は法人でも任意

  // planId バリデーション
  if (!VALID_PLAN_IDS.includes(body.planId)) {
    throw createError({
      statusCode: 400,
      statusMessage: `無効なプランIDです: ${body.planId}`,
    });
  }

  // Enterpriseプランはフォームから申請不可（個別見積のためお問い合わせ対応）
  if (body.planId === "enterprise") {
    throw createError({
      statusCode: 400,
      statusMessage: "Enterpriseプランは個別見積となります。お問い合わせください。",
    });
  }

  // 支払方法バリデーション
  if (body.planId === "free") {
    if (body.paymentMethod !== "none") {
      throw createError({
        statusCode: 400,
        statusMessage: "フリープランの支払方法は \"none\" である必要があります",
      });
    }
  } else {
    if (body.paymentMethod !== "stripe" && body.paymentMethod !== "bank_transfer") {
      throw createError({
        statusCode: 400,
        statusMessage: "有料プランの支払方法は \"stripe\" または \"bank_transfer\" である必要があります",
      });
    }
  }

  // 申請ドキュメントを作成
  const now = new Date().toISOString();
  const applicationRef = db.collection("applications").doc();

  // 銀行振込の場合: 一意の請求番号を生成（Firestore doc ID ベースで重複なし）
  let invoiceNumber: string | undefined;
  if (body.paymentMethod === "bank_transfer") {
    const datePart = now.slice(0, 10).replace(/-/g, "");
    const suffix = applicationRef.id.slice(0, 6).toUpperCase();
    invoiceNumber = `KTN-${datePart}-${suffix}`;
  }

  const applicationData: Omit<Application, "id"> = {
    applicantUserId: user.id,
    applicantEmail: user.email,
    organizationType: body.organizationType,
    organizationName: body.organizationName.trim(),
    contactName: body.contactName.trim(),
    ...(body.address ? { address: body.address.trim() } : {}),
    ...(body.phone ? { phone: body.phone.trim() } : {}),
    ...(body.tradeName ? { tradeName: body.tradeName.trim() } : {}),
    ...(body.representativeName ? { representativeName: body.representativeName.trim() } : {}),
    ...(body.corporateNumber ? { corporateNumber: body.corporateNumber.trim() } : {}),
    planId: body.planId,
    paymentMethod: body.paymentMethod,
    ...(invoiceNumber ? { invoiceNumber } : {}),
    termsAcceptedAt: now,
    privacyPolicyAcceptedAt: now,
    ...(body.termsVersion ? { termsVersion: body.termsVersion } : {}),
    ...(body.privacyVersion ? { privacyVersion: body.privacyVersion } : {}),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  await applicationRef.set(applicationData);

  // displayName を contactName で更新（申請作成後に実行、補助処理のため非ブロッキング）
  db.collection("users").doc(user.id).update({
    displayName: body.contactName.trim(),
    updatedAt: now,
  }).catch((err) => {
    console.error("[application] displayName 更新に失敗:", err);
  });

  const application: Application = {
    id: applicationRef.id,
    ...applicationData,
  };

  // フリープラン: 自動承認
  if (body.planId === "free") {
    await autoApproveFreeApplication(application, db);

    const updatedDoc = await db.collection("applications").doc(application.id).get();
    const updatedApplication = { id: updatedDoc.id, ...updatedDoc.data() } as Application;

    return { application: updatedApplication, autoApproved: true };
  }

  // Stripe: Checkout セッション作成
  if (body.paymentMethod === "stripe") {
    const config = useRuntimeConfig();
    const baseUrl = config.publicUrl;

    const session = await createCheckoutSession({
      applicationId: application.id,
      customerEmail: user.email,
      successUrl: `${baseUrl}/admin?checkout=success`,
      cancelUrl: `${baseUrl}/apply?checkout=cancelled`,
    });

    // Checkout セッションIDを申請に保存
    await applicationRef.update({
      stripeCheckoutSessionId: session.id,
      updatedAt: new Date().toISOString(),
    });

    const updatedDoc = await applicationRef.get();
    const updatedApplication = { id: updatedDoc.id, ...updatedDoc.data() } as Application;

    return { application: updatedApplication, checkoutUrl: session.url };
  }

  // 銀行振込: そのまま返却（振込依頼メールは管理者承認時に送信）
  return { application };
});
