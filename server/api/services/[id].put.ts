import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import type { ServiceUpsertRequest } from "~~/shared/types/api";
import type { Service } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
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

  await docRef.update(updates);

  return { id, ...existing, ...updates } as Service;
});
