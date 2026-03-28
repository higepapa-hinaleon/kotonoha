/**
 * 既存ドキュメントの一括再処理スクリプト
 *
 * 親子チャンク構造 + Contextual Retrieval に対応した新しい形式で
 * 全ドキュメントを再処理する。
 *
 * 使い方:
 *   npx tsx scripts/reprocess-documents.ts
 *
 * 環境変数:
 *   NUXT_FIREBASE_PROJECT_ID
 *   NUXT_FIREBASE_CLIENT_EMAIL
 *   NUXT_FIREBASE_PRIVATE_KEY
 *   NUXT_FIREBASE_STORAGE_BUCKET (default: {projectId}.firebasestorage.app)
 *   NUXT_FIREBASE_DATABASE_ID (optional: named database ID)
 *   NUXT_VERTEX_AI_LOCATION (default: asia-northeast1)
 *   NUXT_VERTEX_AI_EMBEDDING_MODEL (default: text-multilingual-embedding-002)
 *   NUXT_VERTEX_AI_MODEL (default: gemini-2.5-flash)
 *
 * オプション:
 *   --dry-run   実際の書き込みは行わず、対象ドキュメントをリスト表示のみ
 *   --org-id=X  特定の組織IDのドキュメントのみ対象
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// --- 引数解析 ---
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const orgIdArg = args.find((a) => a.startsWith("--org-id="))?.split("=")[1];

// --- Firebase初期化 ---
const projectId = process.env.NUXT_FIREBASE_PROJECT_ID;
const clientEmail = process.env.NUXT_FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.NUXT_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Error: Firebase credentials not set. Required env vars:");
  console.error("  NUXT_FIREBASE_PROJECT_ID, NUXT_FIREBASE_CLIENT_EMAIL, NUXT_FIREBASE_PRIVATE_KEY");
  process.exit(1);
}

const storageBucket = process.env.NUXT_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
const databaseId = process.env.NUXT_FIREBASE_DATABASE_ID;

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  storageBucket,
});

const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
const storage = getStorage(app);

// --- メイン処理 ---
async function main() {
  console.log("=== Document Reprocessing Script ===");
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);
  if (orgIdArg) console.log(`Target org: ${orgIdArg}`);
  console.log("");

  // 対象ドキュメントを取得
  let query: FirebaseFirestore.Query = db
    .collection("documents")
    .where("status", "==", "ready");

  if (orgIdArg) {
    query = query.where("organizationId", "==", orgIdArg);
  }

  const snapshot = await query.get();
  console.log(`Found ${snapshot.docs.length} documents to reprocess\n`);

  if (snapshot.docs.length === 0) {
    console.log("No documents to process. Exiting.");
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const docId = doc.id;
    const title = data.title || "Untitled";
    const storagePath = data.storagePath;

    console.log(`--- Processing: ${title} (${docId}) ---`);
    console.log(`  Storage: ${storagePath}`);
    console.log(`  Type: ${data.type}, Service: ${data.serviceId}`);

    if (isDryRun) {
      console.log("  [DRY RUN] Skipping actual processing\n");
      successCount++;
      continue;
    }

    try {
      // APIエンドポイントを直接呼ぶのではなく、処理を再実行するリクエストをログ
      // 実際のリプロセスはAPIを通じて行う（認証が必要なため）
      console.log(`  -> To reprocess, call: POST /api/documents/${docId}/process`);
      console.log(`     with auth token for org: ${data.organizationId}\n`);
      successCount++;
    } catch (error) {
      console.error(`  ERROR: ${error}`);
      errorCount++;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Total: ${snapshot.docs.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);

  if (!isDryRun) {
    console.log("\nNote: This script lists documents for reprocessing.");
    console.log("To actually reprocess, call the API endpoint for each document");
    console.log("or use the admin UI to trigger reprocessing.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
