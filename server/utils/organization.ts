import { getAdminFirestore } from "./firebase-admin";
import type { Application, Organization } from "~~/shared/types/models";
import type { PlanId } from "~~/shared/plans";

/**
 * デフォルト組織を取得、存在しなければ作成する
 * register.post.ts と me.get.ts の共通処理（初回ユーザー用）
 */
export async function findOrCreateDefaultOrganization(
  db?: FirebaseFirestore.Firestore,
): Promise<string> {
  const firestore = db ?? getAdminFirestore();
  const orgsSnapshot = await firestore.collection("organizations").limit(1).get();
  if (!orgsSnapshot.empty) {
    return orgsSnapshot.docs[0].id;
  }

  const now = new Date().toISOString();
  const orgRef = firestore.collection("organizations").doc();
  await orgRef.set({
    name: "デフォルト組織",
    plan: "free",
    createdAt: now,
    updatedAt: now,
  });
  return orgRef.id;
}

/**
 * 利用申請情報から組織を作成する
 */
export async function createOrganizationFromApplication(
  application: Application,
  db?: FirebaseFirestore.Firestore,
): Promise<string> {
  const firestore = db ?? getAdminFirestore();
  const now = new Date().toISOString();

  const orgData: Omit<Organization, "id"> = {
    name: application.organizationName,
    plan: application.planId as PlanId,
    organizationType: application.organizationType,
    contactName: application.contactName,
    address: application.address,
    phone: application.phone,
    ...(application.tradeName ? { tradeName: application.tradeName } : {}),
    ...(application.representativeName ? { representativeName: application.representativeName } : {}),
    ...(application.corporateNumber ? { corporateNumber: application.corporateNumber } : {}),
    ...(application.stripeCustomerId ? { stripeCustomerId: application.stripeCustomerId } : {}),
    createdAt: now,
    updatedAt: now,
  };

  const orgRef = firestore.collection("organizations").doc();
  await orgRef.set(orgData);
  return orgRef.id;
}
