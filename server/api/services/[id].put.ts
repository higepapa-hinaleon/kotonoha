import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import { validateBotConfig, sanitizeBotConfig } from "~~/server/utils/resolve-bot-config";
import type { ServiceUpsertRequest } from "~~/shared/types/api";
import type { Service } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user: _user, groupId } = await verifyGroupAdmin(event);
  const id = getRouterParam(event, "id");
  const body = await readBody<ServiceUpsertRequest>(event);

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "IDが必要です" });
  }

  const db = getAdminFirestore();
  const docRef = db.collection("services").doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw createError({ statusCode: 404, statusMessage: "サービスが見つかりません" });
  }

  const existing = doc.data() as Omit<Service, "id">;
  if (existing.groupId !== groupId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description.trim();
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.googleFormUrl !== undefined) updates.googleFormUrl = body.googleFormUrl.trim();
  if (body.botConfig === null) {
    // null 送信でクリア（グループ設定にフォールバック）
    updates.botConfig = FieldValue.delete();
  } else if (body.botConfig !== undefined) {
    validateBotConfig(body.botConfig);
    updates.botConfig = sanitizeBotConfig(body.botConfig);
  }

  await docRef.update(updates);

  // FieldValue.delete() はレスポンスに含めない
  const response = { id, ...existing, ...updates };
  if (body.botConfig === null) {
    delete response.botConfig;
  }
  return response as Service;
});
