/**
 * マイグレーションスクリプト: User.role リネーム
 *
 * 既存ユーザーの role 値を以下のように変換する:
 *   - "admin"  → "org_admin"
 *   - "member" → "user"
 *
 * 冪等: 既に新しい値を持つドキュメントはスキップ。
 * owner, system_admin は変更しない。
 *
 * 使い方:
 *   npx tsx scripts/migrate-roles.ts [--dry-run]
 *
 * 環境変数:
 *   NUXT_FIREBASE_PROJECT_ID, NUXT_FIREBASE_CLIENT_EMAIL,
 *   NUXT_FIREBASE_PRIVATE_KEY, NUXT_FIREBASE_DATABASE_ID
 */

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_LIMIT = 490;

const ROLE_MAP: Record<string, string> = {
  admin: "org_admin",
  member: "user",
};

async function main() {
  console.log(`=== User.role マイグレーション ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`);

  // Firebase Admin 初期化
  const projectId = process.env.NUXT_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.NUXT_FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.NUXT_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const databaseId = process.env.NUXT_FIREBASE_DATABASE_ID;

  if (!projectId || !clientEmail || !privateKey) {
    console.error("Firebase 環境変数が設定されていません");
    process.exit(1);
  }

  const app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey } as ServiceAccount),
  });

  const db = databaseId
    ? getFirestore(app, databaseId)
    : getFirestore(app);

  // ユーザー一覧を取得
  const usersSnapshot = await db.collection("users").get();
  console.log(`ユーザー数: ${usersSnapshot.size}`);

  let updateCount = 0;
  let skipCount = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const currentRole = data.role;
    const newRole = ROLE_MAP[currentRole];

    if (!newRole) {
      // owner, system_admin, org_admin, user は変更不要
      skipCount++;
      console.log(`  SKIP ${doc.id}: role=${currentRole} (変更不要)`);
      continue;
    }

    console.log(`  ${DRY_RUN ? "WOULD UPDATE" : "UPDATE"} ${doc.id}: ${currentRole} → ${newRole}`);

    if (!DRY_RUN) {
      batch.update(doc.ref, {
        role: newRole,
        updatedAt: new Date().toISOString(),
      });
      batchCount++;

      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    updateCount++;
  }

  // 残りのバッチをコミット
  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  console.log(`\n=== 完了 ===`);
  console.log(`更新: ${updateCount} 件`);
  console.log(`スキップ: ${skipCount} 件`);

  if (DRY_RUN) {
    console.log("\n※ これは DRY RUN です。実際の変更は行われていません。");
    console.log("   --dry-run フラグを外して再実行してください。");
  }
}

main().catch((err) => {
  console.error("マイグレーション失敗:", err);
  process.exit(1);
});
