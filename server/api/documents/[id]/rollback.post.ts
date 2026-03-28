import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import type { Document } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "IDが必要です" });
  }

  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  const body = await readBody(event);
  const targetVersion = body?.version;

  if (!targetVersion || typeof targetVersion !== "number") {
    throw createError({ statusCode: 400, statusMessage: "ロールバック先のバージョン番号が必要です" });
  }

  const db = getAdminFirestore();
  const docRef = db.collection("documents").doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw createError({ statusCode: 404, statusMessage: "ドキュメントが見つかりません" });
  }

  const document = { id: doc.id, ...doc.data() } as Document;
  if (document.groupId !== groupId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  // 指定バージョンの情報を取得
  const versionSnap = await docRef.collection("versions").doc(`v${targetVersion}`).get();
  if (!versionSnap.exists) {
    throw createError({ statusCode: 404, statusMessage: `バージョン ${targetVersion} が見つかりません` });
  }

  const versionData = versionSnap.data()!;
  const now = new Date().toISOString();
  const currentVersion = document.version || 1;

  // 現在のバージョンをアーカイブ
  await docRef.collection("versions").doc(`v${currentVersion}`).set({
    version: currentVersion,
    title: document.title,
    type: document.type,
    tags: document.tags || [],
    storagePath: document.storagePath,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    fileHash: document.fileHash || "",
    chunkCount: document.chunkCount,
    archivedAt: now,
  });

  // ドキュメントを指定バージョンの情報に復元（新しいバージョン番号で）
  await docRef.update({
    title: versionData.title,
    type: versionData.type,
    tags: versionData.tags || [],
    storagePath: versionData.storagePath,
    mimeType: versionData.mimeType,
    fileSize: versionData.fileSize,
    fileHash: versionData.fileHash || "",
    version: currentVersion + 1,
    status: "uploading", // 再処理が必要
    chunkCount: 0,
    updatedAt: now,
  });

  return {
    success: true,
    documentId: id,
    restoredFromVersion: targetVersion,
    newVersion: currentVersion + 1,
  };
});
