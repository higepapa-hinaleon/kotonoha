import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupMember } from "~~/server/utils/auth";
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_RAG_TOP_K,
  DEFAULT_RAG_SIMILARITY_THRESHOLD,
  DEFAULT_SYSTEM_PROMPT,
} from "~~/server/utils/constants";
import type { Settings } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupMember(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }
  const db = getAdminFirestore();

  const snapshot = await db
    .collection("settings")
    .where("groupId", "==", groupId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    // デフォルト設定を返す
    return {
      id: "",
      organizationId: user.organizationId,
      googleFormUrl: "",
      botConfig: {
        confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
        ragTopK: DEFAULT_RAG_TOP_K,
        ragSimilarityThreshold: DEFAULT_RAG_SIMILARITY_THRESHOLD,
        enableMultiQuery: false,
        enableHyde: false,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
      },
      updatedAt: "",
    } as Settings;
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Settings;
});
