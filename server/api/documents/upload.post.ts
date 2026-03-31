import { createHash } from "crypto";
import { getAdminFirestore, getAdminStorage } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin, verifyActiveContract } from "~~/server/utils/auth";
import { checkPlanLimit } from "~~/server/utils/plan-limit";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES } from "~~/server/utils/constants";
import type { Document } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }
  await verifyActiveContract(user);

  await checkPlanLimit(user.organizationId, "documents");

  const formData = await readMultipartFormData(event);
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: "ファイルが必要です" });
  }

  // フォームフィールドの取得
  const fileField = formData.find((f) => f.name === "file");
  const serviceId = formData.find((f) => f.name === "serviceId")?.data.toString();
  const title = formData.find((f) => f.name === "title")?.data.toString();
  const type = formData.find((f) => f.name === "type")?.data.toString() as "business" | "system";
  const tagsRaw = formData.find((f) => f.name === "tags")?.data.toString();
  const skipDuplicateCheck =
    formData.find((f) => f.name === "skipDuplicateCheck")?.data.toString() === "true";

  if (!fileField?.data || !serviceId || !title) {
    throw createError({ statusCode: 400, statusMessage: "file, serviceId, title は必須です" });
  }

  const mimeType = fileField.type || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw createError({
      statusCode: 400,
      statusMessage: "対応形式: PDF, TXT, Markdown, DOCX, HTML, CSV, JSON",
    });
  }

  // ファイルサイズ制限
  if (fileField.data.length > MAX_UPLOAD_SIZE_BYTES) {
    throw createError({
      statusCode: 400,
      statusMessage: `ファイルサイズが上限（${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB）を超えています`,
    });
  }

  // タグのパース
  let tags: string[] = [];
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

  const db = getAdminFirestore();
  const storage = getAdminStorage();
  const now = new Date().toISOString();

  // ファイルハッシュの計算（SHA-256）
  const fileHash = createHash("sha256").update(fileField.data).digest("hex");

  // 重複チェック
  if (!skipDuplicateCheck) {
    const duplicateSnap = await db
      .collection("documents")
      .where("groupId", "==", groupId)
      .where("fileHash", "==", fileHash)
      .limit(1)
      .get();

    if (!duplicateSnap.empty) {
      const existingDoc = duplicateSnap.docs[0].data();
      return {
        duplicate: true,
        existingDocument: {
          id: duplicateSnap.docs[0].id,
          title: existingDoc.title,
          serviceId: existingDoc.serviceId,
          createdAt: existingDoc.createdAt,
        },
        fileHash,
      };
    }
  }

  // Cloud Storage にアップロード
  const fileName = fileField.filename || `${Date.now()}.bin`;
  const storagePath = `documents/${user.organizationId}/${groupId}/${Date.now()}_${fileName}`;
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  await file.save(fileField.data, {
    metadata: { contentType: mimeType },
  });

  // Firestore にドキュメントメタデータを保存
  const docRef = db.collection("documents").doc();
  const document: Omit<Document, "id"> = {
    organizationId: user.organizationId,
    groupId,
    serviceId,
    title: title.trim(),
    type: type || "business",
    tags,
    storagePath,
    mimeType,
    fileSize: fileField.data.length,
    fileHash,
    chunkCount: 0,
    version: 1,
    status: "uploading",
    uploadedBy: user.id,
    referenceCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await docRef.set(document);

  return { id: docRef.id, ...document } as Document;
});
