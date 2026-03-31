import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import { checkPlanLimit } from "~~/server/utils/plan-limit";
import { validateBotConfig, sanitizeBotConfig } from "~~/server/utils/resolve-bot-config";
import type { ServiceUpsertRequest } from "~~/shared/types/api";
import type { Service } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  await checkPlanLimit(user.organizationId, "services");

  const body = await readBody<ServiceUpsertRequest>(event);

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: "サービス名は必須です" });
  }

  const db = getAdminFirestore();
  const now = new Date().toISOString();

  if (body.botConfig !== undefined && body.botConfig !== null) {
    validateBotConfig(body.botConfig);
  }

  const docRef = db.collection("services").doc();
  const service: Omit<Service, "id"> = {
    organizationId: user.organizationId,
    groupId,
    name: body.name.trim(),
    description: body.description?.trim() || "",
    isActive: body.isActive ?? true,
    googleFormUrl: body.googleFormUrl?.trim() || "",
    createdAt: now,
    updatedAt: now,
  };
  if (body.botConfig !== undefined && body.botConfig !== null) {
    const sanitized = sanitizeBotConfig(body.botConfig);
    if (Object.keys(sanitized).length > 0) {
      service.botConfig = sanitized;
    }
  }

  await docRef.set(service);

  return { id: docRef.id, ...service } as Service;
});
