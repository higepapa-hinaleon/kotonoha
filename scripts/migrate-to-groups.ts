/**
 * マイグレーションスクリプト: グループ階層の追加
 *
 * 既存データにデフォルトグループを作成し、全ドキュメントに groupId を追加する。
 * 冪等: groupId が既にあるドキュメントはスキップ。
 *
 * 使い方:
 *   npx tsx scripts/migrate-to-groups.ts [--dry-run]
 *
 * 環境変数:
 *   NUXT_FIREBASE_PROJECT_ID, NUXT_FIREBASE_CLIENT_EMAIL,
 *   NUXT_FIREBASE_PRIVATE_KEY, NUXT_FIREBASE_DATABASE_ID
 */

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_LIMIT = 490;

// Firebase 初期化
const projectId = process.env.NUXT_FIREBASE_PROJECT_ID;
const clientEmail = process.env.NUXT_FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.NUXT_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const databaseId = process.env.NUXT_FIREBASE_DATABASE_ID || "(default)";

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase credentials env vars");
  process.exit(1);
}

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey } as ServiceAccount),
  projectId,
});
const db = getFirestore(app, databaseId);

async function main() {
  console.log(`=== Migration: Add Group Hierarchy ===`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Database: ${databaseId}`);

  // 1. 既存の Organization を取得
  const orgsSnap = await db.collection("organizations").limit(1).get();
  if (orgsSnap.empty) {
    console.log("No organizations found. Skipping.");
    return;
  }
  const orgId = orgsSnap.docs[0].id;
  console.log(`Organization: ${orgId} (${orgsSnap.docs[0].data().name})`);

  // 2. デフォルトグループを作成（冪等）
  let defaultGroupId: string;
  const existingGroups = await db.collection("groups").where("organizationId", "==", orgId).limit(1).get();
  if (!existingGroups.empty) {
    defaultGroupId = existingGroups.docs[0].id;
    console.log(`Default group already exists: ${defaultGroupId}`);
  } else {
    if (DRY_RUN) {
      defaultGroupId = "dry-run-group-id";
      console.log(`[DRY RUN] Would create default group`);
    } else {
      const now = new Date().toISOString();
      const groupRef = db.collection("groups").doc();
      await groupRef.set({
        organizationId: orgId,
        name: "デフォルトグループ",
        description: "マイグレーションで自動作成されたデフォルトグループ",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      defaultGroupId = groupRef.id;
      console.log(`Created default group: ${defaultGroupId}`);
    }
  }

  // 3. 既存ユーザーを処理
  const usersSnap = await db.collection("users").where("organizationId", "==", orgId).get();
  console.log(`\nProcessing ${usersSnap.docs.length} users...`);

  let firstAdminPromoted = false;
  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();

    // 最初の admin を system_admin に昇格
    if (userData.role === "admin" && !firstAdminPromoted) {
      if (!DRY_RUN) {
        await userDoc.ref.update({
          role: "system_admin",
          activeGroupId: defaultGroupId,
          updatedAt: new Date().toISOString(),
        });
      }
      firstAdminPromoted = true;
      console.log(`  ${userDoc.id}: admin → system_admin, activeGroupId=${defaultGroupId}`);
    } else if (!userData.activeGroupId) {
      if (!DRY_RUN) {
        await userDoc.ref.update({
          activeGroupId: defaultGroupId,
          updatedAt: new Date().toISOString(),
        });
      }
      console.log(`  ${userDoc.id}: set activeGroupId=${defaultGroupId}`);
    }

    // UserGroupMembership を作成（冪等）
    const membershipId = `${userDoc.id}_${defaultGroupId}`;
    const membershipRef = db.collection("userGroupMemberships").doc(membershipId);
    const existingMembership = await membershipRef.get();
    if (!existingMembership.exists) {
      const membershipRole = userData.role === "admin" || userData.role === "system_admin" ? "admin" : "member";
      if (!DRY_RUN) {
        const now = new Date().toISOString();
        await membershipRef.set({
          userId: userDoc.id,
          groupId: defaultGroupId,
          organizationId: orgId,
          role: membershipRole,
          createdAt: now,
          updatedAt: now,
        });
      }
      console.log(`  ${userDoc.id}: created membership (role=${membershipRole})`);
    }
  }

  // 4. 全データコレクションに groupId を追加
  const collections = [
    "services",
    "documents",
    "documentChunks",
    "conversations",
    "faqs",
    "improvementRequests",
    "feedbackChunks",
    "settings",
    "weeklyReports",
  ];

  for (const collectionName of collections) {
    console.log(`\nProcessing collection: ${collectionName}`);

    // groupId が未設定のドキュメントのみ取得
    const snapshot = await db
      .collection(collectionName)
      .where("organizationId", "==", orgId)
      .get();

    const docsToUpdate = snapshot.docs.filter((doc) => !doc.data().groupId);
    console.log(`  Total: ${snapshot.docs.length}, needs update: ${docsToUpdate.length}`);

    if (docsToUpdate.length === 0) continue;

    // バッチ更新
    let updatedCount = 0;
    for (let i = 0; i < docsToUpdate.length; i += BATCH_LIMIT) {
      const batchDocs = docsToUpdate.slice(i, i + BATCH_LIMIT);
      if (!DRY_RUN) {
        const batch = db.batch();
        for (const doc of batchDocs) {
          batch.update(doc.ref, { groupId: defaultGroupId });
        }
        await batch.commit();
      }
      updatedCount += batchDocs.length;
      console.log(`  Updated ${updatedCount}/${docsToUpdate.length}`);
    }
  }

  console.log(`\n=== Migration ${DRY_RUN ? "(DRY RUN)" : ""} Complete ===`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
