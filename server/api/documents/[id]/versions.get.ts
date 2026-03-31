import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin, verifyActiveContract } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  await verifyActiveContract(user);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "IDが必要です" });
  }

  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  const db = getAdminFirestore();
  const docSnap = await db.collection("documents").doc(id).get();

  if (!docSnap.exists) {
    throw createError({ statusCode: 404, statusMessage: "ドキュメントが見つかりません" });
  }

  if (docSnap.data()?.groupId !== groupId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  const versionsSnap = await db
    .collection("documents")
    .doc(id)
    .collection("versions")
    .orderBy("version", "desc")
    .get();

  const versions = versionsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  return {
    documentId: id,
    currentVersion: docSnap.data()?.version || 1,
    versions,
  };
});
