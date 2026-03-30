import { getAdminFirestore } from "./firebase-admin";
import { PLAN_DEFINITIONS } from "~~/shared/plans";
import type { PlanId, PlanFeatureFlags } from "~~/shared/plans";

type ResourceType = "groups" | "services" | "documents" | "users" | "widgetSites";

const RESOURCE_COLLECTION_MAP: Record<ResourceType, string> = {
  groups: "groups",
  services: "services",
  documents: "documents",
  users: "users",
  widgetSites: "settings",
};

const RESOURCE_LIMIT_MAP: Record<ResourceType, keyof typeof PLAN_DEFINITIONS.free.limits> = {
  groups: "maxGroups",
  services: "maxServices",
  documents: "maxDocuments",
  users: "maxUsers",
  widgetSites: "maxWidgetSites",
};

const RESOURCE_LABEL_MAP: Record<ResourceType, string> = {
  groups: "グループ",
  services: "サービス",
  documents: "ドキュメント",
  users: "ユーザー",
  widgetSites: "ウィジェットサイト",
};

async function getOrganizationPlan(
  organizationId: string,
  db: FirebaseFirestore.Firestore,
): Promise<PlanId> {
  const orgDoc = await db.collection("organizations").doc(organizationId).get();
  if (!orgDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "組織が見つかりません" });
  }
  return (orgDoc.data()?.plan as PlanId) || "free";
}

/**
 * リソース作成前にプラン上限をチェックする
 * 上限超過時は 403 エラーを throw
 */
export async function checkPlanLimit(
  organizationId: string,
  resource: ResourceType,
  db?: FirebaseFirestore.Firestore,
): Promise<void> {
  const firestore = db ?? getAdminFirestore();
  const planId = await getOrganizationPlan(organizationId, firestore);
  const plan = PLAN_DEFINITIONS[planId];
  if (!plan) {
    throw createError({
      statusCode: 500,
      statusMessage: "無効なプランが設定されています。管理者に連絡してください。",
    });
  }

  const limitKey = RESOURCE_LIMIT_MAP[resource];
  const maxCount = plan.limits[limitKey];

  // -1 = 無制限
  if (maxCount === -1) return;

  const collection = RESOURCE_COLLECTION_MAP[resource];
  let currentCount: number;

  if (resource === "users") {
    // ユーザー数 = 既存ユーザー + pending 招待
    const [usersSnap, invitationsSnap] = await Promise.all([
      firestore
        .collection("users")
        .where("organizationId", "==", organizationId)
        .count()
        .get(),
      firestore
        .collection("invitations")
        .where("organizationId", "==", organizationId)
        .where("status", "==", "pending")
        .count()
        .get(),
    ]);
    currentCount = usersSnap.data().count + invitationsSnap.data().count;
  } else {
    const snap = await firestore
      .collection(collection)
      .where("organizationId", "==", organizationId)
      .count()
      .get();
    currentCount = snap.data().count;
  }

  if (currentCount >= maxCount) {
    const label = RESOURCE_LABEL_MAP[resource];
    throw createError({
      statusCode: 403,
      statusMessage: `${label}の上限（${maxCount}件）に達しています。プランをアップグレードしてください。`,
    });
  }
}

/**
 * 機能フラグをチェックする
 * フラグが無効な場合は 403 エラーを throw
 */
export async function checkFeatureFlag(
  organizationId: string,
  feature: keyof PlanFeatureFlags,
  db?: FirebaseFirestore.Firestore,
): Promise<void> {
  const firestore = db ?? getAdminFirestore();
  const planId = await getOrganizationPlan(organizationId, firestore);
  const plan = PLAN_DEFINITIONS[planId];
  if (!plan) {
    throw createError({
      statusCode: 500,
      statusMessage: "無効なプランが設定されています。管理者に連絡してください。",
    });
  }

  if (!plan.features[feature]) {
    throw createError({
      statusCode: 403,
      statusMessage:
        "この機能は現在のプランではご利用いただけません。プランをアップグレードしてください。",
    });
  }
}

/**
 * 月間チャット数をチェックする
 * 上限超過時は 429 エラーを throw
 */
export async function checkMonthlyChats(
  organizationId: string,
  db?: FirebaseFirestore.Firestore,
): Promise<void> {
  const firestore = db ?? getAdminFirestore();
  const planId = await getOrganizationPlan(organizationId, firestore);
  const plan = PLAN_DEFINITIONS[planId];
  if (!plan) {
    throw createError({
      statusCode: 500,
      statusMessage: "無効なプランが設定されています。管理者に連絡してください。",
    });
  }

  const maxChats = plan.limits.maxMonthlyChats;
  if (maxChats === -1) return;

  // 今月の開始日
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const snap = await firestore
    .collection("conversations")
    .where("organizationId", "==", organizationId)
    .where("createdAt", ">=", monthStart)
    .count()
    .get();

  if (snap.data().count >= maxChats) {
    throw createError({
      statusCode: 429,
      statusMessage: `月間チャット数の上限（${maxChats}回）に達しています。プランをアップグレードしてください。`,
    });
  }
}
