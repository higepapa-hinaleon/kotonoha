import { verifySystemAdmin } from "~~/server/utils/auth";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { sendUsageApprovedEmail } from "~~/server/utils/email";
import { PLAN_DEFINITIONS } from "~~/shared/plans";

/**
 * 銀行振込の入金確認 - 契約を有効化する
 * owner または system_admin 権限が必要
 */
export default defineEventHandler(async (event) => {
  await verifySystemAdmin(event);

  const contractId = getRouterParam(event, "id");
  if (!contractId) {
    throw createError({ statusCode: 400, statusMessage: "契約IDが必要です" });
  }

  const db = getAdminFirestore();
  const contractRef = db.collection("contracts").doc(contractId);
  const contractDoc = await contractRef.get();

  if (!contractDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "契約が見つかりません" });
  }

  const contract = contractDoc.data()!;

  if (contract.status !== "pending_payment") {
    throw createError({
      statusCode: 400,
      statusMessage: `契約ステータスが pending_payment ではありません（現在: ${contract.status}）`,
    });
  }

  const now = new Date().toISOString();
  await contractRef.update({
    status: "active",
    updatedAt: now,
  });

  // 利用承認メール送信（非ブロッキング・ベストエフォート）
  try {
    const orgDoc = await db.collection("organizations").doc(contract.organizationId).get();
    if (orgDoc.exists) {
      const org = orgDoc.data()!;
      const contactEmail = await resolveOrgContactEmail(db, contract.organizationId);
      if (contactEmail) {
        const config = useRuntimeConfig();
        const baseUrl = config.publicUrl;
        const plan = PLAN_DEFINITIONS[contract.planId as keyof typeof PLAN_DEFINITIONS];
        sendUsageApprovedEmail({
          to: contactEmail,
          organizationName: org.name,
          planName: plan?.displayName ?? contract.planId,
          loginUrl: `${baseUrl}/login`,
        }).catch((err) => {
          console.warn("[system/contracts/confirm-payment] メール送信エラー（処理は続行）:", err);
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[system/contracts/confirm-payment] メール送信エラー（処理は続行）:", message);
  }

  const updatedDoc = await contractRef.get();
  return { id: contractId, ...updatedDoc.data() };
});

/**
 * 組織の連絡先メールアドレスを解決する
 * 申請者のメールまたは組織に紐づくユーザーのメールを取得
 */
async function resolveOrgContactEmail(
  db: FirebaseFirestore.Firestore,
  organizationId: string,
): Promise<string | null> {
  // 組織に所属する最初のユーザー（owner または org_admin 優先）を探す
  const usersSnapshot = await db
    .collection("users")
    .where("organizationId", "==", organizationId)
    .limit(10)
    .get();

  if (usersSnapshot.empty) return null;

  // owner > system_admin > org_admin > user の優先度でメールを取得
  const priorityOrder = ["owner", "system_admin", "org_admin", "user"];
  const sorted = usersSnapshot.docs.sort((a, b) => {
    const aRole = a.data().role || "user";
    const bRole = b.data().role || "user";
    return priorityOrder.indexOf(aRole) - priorityOrder.indexOf(bRole);
  });

  return sorted[0].data().email || null;
}
