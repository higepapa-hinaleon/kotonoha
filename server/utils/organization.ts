import { getAdminFirestore } from "./firebase-admin";

/**
 * デフォルト組織を取得、存在しなければ作成する
 * register.post.ts と me.get.ts の共通処理
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
