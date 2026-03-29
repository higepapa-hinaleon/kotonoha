import { createHash } from "crypto";
import { getAdminFirestore, getAdminStorage } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES } from "~~/server/utils/constants";
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

  const db = getAdminFirestore();
  const storage = getAdminStorage();
  const docRef = db.collection("documents").doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw createError({ statusCode: 404, statusMessage: "ドキュメントが見つかりません" });
  }

  const document = { id: doc.id, ...doc.data() } as Document;
  if (document.groupId !== groupId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  const formData = await readMultipartFormData(event);
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: "ファイルが必要です" });
  }

  const fileField = formData.find((f) => f.name === "file");
  const title = formData.find((f) => f.name === "title")?.data.toString();
  const tagsRaw = formData.find((f) => f.name === "tags")?.data.toString();

  if (!fileField?.data) {
    throw createError({ statusCode: 400, statusMessage: "ファイルは必須です" });
  }

  const mimeType = fileField.type || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw createError({
      statusCode: 400,
      statusMessage: "対応形式: PDF, TXT, Markdown, DOCX, HTML, CSV, JSON",
    });
  }
  if (fileField.data.length > MAX_UPLOAD_SIZE_BYTES) {
    throw createError({
      statusCode: 400,
      statusMessage: `ファイルサイズが上限（${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB）を超えています`,
    });
  }
  const now = new Date().toISOString();
  const currentVersion = document.version || 1;

  // タグのパース
  let tags: string[] = document.tags || [];
  if (tagsRaw) {
    try {
      tags = JSON.parse(tagsRaw);
    } catch {
      tags = tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  // 1. 旧バージョンの情報をサブコレクションに保存
  await docRef
    .collection("versions")
    .doc(`v${currentVersion}`)
    .set({
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

  // 2. 新ファイルをCloud Storageにアップロード
  const fileName = fileField.filename || `${Date.now()}.bin`;
  const storagePath = `documents/${user.organizationId}/${groupId}/${Date.now()}_${fileName}`;
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  await file.save(fileField.data, {
    metadata: { contentType: mimeType },
  });

  // 3. ファイルハッシュの計算
  const fileHash = createHash("sha256").update(fileField.data).digest("hex");

  // 4. ドキュメントメタデータを更新
  const updateData: Partial<Document> = {
    title: title?.trim() || document.title,
    tags,
    storagePath,
    mimeType,
    fileSize: fileField.data.length,
    fileHash,
    version: currentVersion + 1,
    status: "uploading",
    chunkCount: 0,
    updatedAt: now,
  };

  await docRef.update(updateData);

  return {
    id,
    ...document,
    ...updateData,
    previousVersion: currentVersion,
  };
});
