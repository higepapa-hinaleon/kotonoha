import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_RAG_TOP_K,
  DEFAULT_RAG_SIMILARITY_THRESHOLD,
  DEFAULT_SYSTEM_PROMPT,
  MAX_SYSTEM_PROMPT_LENGTH,
} from "~~/server/utils/constants";
import type { SettingsUpdateRequest } from "~~/shared/types/api";
import type { Settings } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }
  const body = await readBody<SettingsUpdateRequest>(event);

  // 数値パラメータのバリデーション
  if (body.botConfig) {
    if (body.botConfig.confidenceThreshold !== undefined) {
      body.botConfig.confidenceThreshold = Math.max(0, Math.min(1, body.botConfig.confidenceThreshold));
    }
    if (body.botConfig.ragTopK !== undefined) {
      body.botConfig.ragTopK = Math.max(1, Math.min(100, Math.floor(body.botConfig.ragTopK)));
    }
    if (body.botConfig.ragSimilarityThreshold !== undefined) {
      body.botConfig.ragSimilarityThreshold = Math.max(0, Math.min(1, body.botConfig.ragSimilarityThreshold));
    }
    if (body.botConfig.systemPrompt !== undefined && typeof body.botConfig.systemPrompt === "string") {
      if (body.botConfig.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
        throw createError({ statusCode: 400, statusMessage: `システムプロンプトが長すぎます（上限${MAX_SYSTEM_PROMPT_LENGTH.toLocaleString()}文字）` });
      }
    }
  }

  const db = getAdminFirestore();
  const now = new Date().toISOString();

  const snapshot = await db
    .collection("settings")
    .where("groupId", "==", groupId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    // 新規作成
    const docRef = db.collection("settings").doc();
    const settings: Omit<Settings, "id"> = {
      organizationId: user.organizationId,
      groupId,
      googleFormUrl: body.googleFormUrl ?? "",
      botConfig: {
        confidenceThreshold: body.botConfig?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
        ragTopK: body.botConfig?.ragTopK ?? DEFAULT_RAG_TOP_K,
        ragSimilarityThreshold: body.botConfig?.ragSimilarityThreshold ?? DEFAULT_RAG_SIMILARITY_THRESHOLD,
        enableMultiQuery: body.botConfig?.enableMultiQuery ?? false,
        enableHyde: body.botConfig?.enableHyde ?? false,
        systemPrompt: body.botConfig?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      },
      updatedAt: now,
    };
    await docRef.set(settings);
    return { id: docRef.id, ...settings } as Settings;
  }

  // 既存更新
  const doc = snapshot.docs[0];
  const existing = doc.data() as Omit<Settings, "id">;

  const updated: Partial<Settings> = { updatedAt: now };
  if (body.googleFormUrl !== undefined) updated.googleFormUrl = body.googleFormUrl;
  if (body.botConfig) {
    updated.botConfig = {
      confidenceThreshold: body.botConfig.confidenceThreshold ?? existing.botConfig.confidenceThreshold,
      ragTopK: body.botConfig.ragTopK ?? existing.botConfig.ragTopK,
      ragSimilarityThreshold: body.botConfig.ragSimilarityThreshold ?? existing.botConfig.ragSimilarityThreshold ?? DEFAULT_RAG_SIMILARITY_THRESHOLD,
      enableMultiQuery: body.botConfig.enableMultiQuery ?? existing.botConfig.enableMultiQuery ?? false,
      enableHyde: body.botConfig.enableHyde ?? existing.botConfig.enableHyde ?? false,
      systemPrompt: body.botConfig.systemPrompt ?? existing.botConfig.systemPrompt,
    };
  }

  await doc.ref.update(updated);
  return { id: doc.id, ...existing, ...updated } as Settings;
});
