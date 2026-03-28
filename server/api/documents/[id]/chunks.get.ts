import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupMember } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupMember(event);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "IDが必要です" });
  }

  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  const db = getAdminFirestore();

  // ドキュメントの存在確認とアクセス権チェック
  const docSnap = await db.collection("documents").doc(id).get();
  if (!docSnap.exists) {
    throw createError({ statusCode: 404, statusMessage: "ドキュメントが見つかりません" });
  }

  const document = docSnap.data();
  if (document?.groupId !== groupId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  // チャンク一覧を取得
  const chunksSnapshot = await db
    .collection("documentChunks")
    .where("documentId", "==", id)
    .where("groupId", "==", groupId)
    .orderBy("chunkIndex", "asc")
    .get();

  const chunks = chunksSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      chunkIndex: data.chunkIndex,
      content: data.content,
      tokenCount: data.tokenCount,
      contextPrefix: data.contextPrefix || "",
      sectionTitle: data.sectionTitle || "",
      parentChunkIndex: data.parentChunkIndex,
      createdAt: data.createdAt,
    };
  });

  return {
    documentId: id,
    documentTitle: document.title,
    documentType: document.type,
    serviceId: document.serviceId,
    status: document.status,
    totalChunks: chunks.length,
    chunks,
  };
});
