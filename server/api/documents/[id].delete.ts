import { getAdminFirestore, getAdminStorage } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import { BATCH_SIZE_LIMIT } from "~~/server/utils/constants";
import type { Document } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "IDが必要です" });
  }

  const db = getAdminFirestore();
  const docRef = db.collection("documents").doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw createError({ statusCode: 404, statusMessage: "ドキュメントが見つかりません" });
  }

  const existing = doc.data() as Omit<Document, "id">;
  if (existing.groupId !== groupId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  // 関連チャンクを削除（500件超対応: ensureBatch パターン）
  const chunksSnapshot = await db
    .collection("documentChunks")
    .where("documentId", "==", id)
    .get();

  const batches: FirebaseFirestore.WriteBatch[] = [];
  let currentBatch = db.batch();
  let opsInBatch = 0;

  const ensureBatch = () => {
    if (opsInBatch >= BATCH_SIZE_LIMIT) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      opsInBatch = 0;
    }
  };

  chunksSnapshot.docs.forEach((chunkDoc) => {
    ensureBatch();
    currentBatch.delete(chunkDoc.ref);
    opsInBatch++;
  });

  // ドキュメント本体も削除
  ensureBatch();
  currentBatch.delete(docRef);
  opsInBatch++;

  batches.push(currentBatch);

  // 全バッチをコミット
  await Promise.all(batches.map((b) => b.commit()));

  // Cloud Storage のファイルを削除
  try {
    const storage = getAdminStorage();
    await storage.bucket().file(existing.storagePath).delete();
  } catch (storageError) {
    // ストレージ削除失敗はログのみ（ファイルが既に無い場合等、主要フローをブロックしない）
    console.warn(`[documents] Storage file deletion failed for ${existing.storagePath}:`, storageError);
  }

  return { success: true };
});
