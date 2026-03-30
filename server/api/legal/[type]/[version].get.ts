import { ensureLegalDocumentsSeeded, getLegalDocument } from "~~/server/utils/legal";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";

/**
 * 指定された種別・バージョンの法的文書を返す（認証不要）
 */
export default defineEventHandler(async (event) => {
  const type = getRouterParam(event, "type");
  const version = getRouterParam(event, "version");

  if (!type || !["terms", "privacy"].includes(type)) {
    throw createError({ statusCode: 400, statusMessage: "type は terms または privacy を指定してください" });
  }

  if (!version) {
    throw createError({ statusCode: 400, statusMessage: "version は必須です" });
  }

  const db = getAdminFirestore();
  await ensureLegalDocumentsSeeded(db);

  const doc = await getLegalDocument(type as "terms" | "privacy", version, db);

  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: `${type} v${version} が見つかりません` });
  }

  return doc;
});
