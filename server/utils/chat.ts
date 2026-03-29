import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { searchRelevantChunks, searchFeedbackChunks, multiQuerySearch } from "~~/server/utils/rag";
import type { RagResult } from "~~/server/utils/rag";
import { generateEmbedding } from "~~/server/utils/embeddings";
import { generateChatResponse } from "~~/server/utils/gemini";
import type { Conversation, Message, MessageSource, Settings } from "~~/shared/types/models";
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_RAG_TOP_K,
  DEFAULT_RAG_SIMILARITY_THRESHOLD,
  ESCALATION_KEYWORDS,
  MAX_CONVERSATION_TITLE_LENGTH,
  MAX_SYSTEM_PROMPT_LENGTH,
  CHAT_HISTORY_LIMIT,
  FEEDBACK_RAG_TOP_K,
  FEEDBACK_FALLBACK_LIMIT,
} from "~~/server/utils/constants";

export interface ChatCoreParams {
  organizationId: string;
  groupId: string;
  serviceId: string;
  message: string;
  userId: string;
  conversationId?: string;
  externalUserName?: string;
  externalUserId?: string;
  /** true の場合、低確信度でもエスカレーション（改善要望自動作成）しない */
  skipEscalation?: boolean;
}

export interface ChatCoreResult {
  conversationId: string;
  message: {
    id: string;
    content: string;
    sources: MessageSource[];
    confidence: number;
  };
  formUrl?: string;
}

/**
 * チャット処理のコアロジック
 * send.post.ts と learn.post.ts から共通利用される
 */
export async function processChatMessage(params: ChatCoreParams): Promise<ChatCoreResult> {
  const db = getAdminFirestore();
  const now = new Date().toISOString();

  // サービス情報と設定を並列取得
  const serviceDocPromise = db.collection("services").doc(params.serviceId).get();
  const settingsPromise = db
    .collection("settings")
    .where("groupId", "==", params.groupId)
    .limit(1)
    .get();

  const serviceDoc = await serviceDocPromise;
  if (!serviceDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: "サービスが見つかりません" });
  }
  const serviceData = serviceDoc.data();

  const settingsSnapshot = await settingsPromise;
  const settings = settingsSnapshot.docs[0]?.data() as Settings | undefined;
  const confidenceThreshold =
    settings?.botConfig?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const ragTopK = settings?.botConfig?.ragTopK ?? DEFAULT_RAG_TOP_K;
  const ragSimilarityThreshold =
    settings?.botConfig?.ragSimilarityThreshold ?? DEFAULT_RAG_SIMILARITY_THRESHOLD;
  const enableMultiQuery = settings?.botConfig?.enableMultiQuery ?? false;
  const enableHyde = settings?.botConfig?.enableHyde ?? false;
  const rawSystemPrompt = settings?.botConfig?.systemPrompt;
  const systemPrompt = rawSystemPrompt
    ? rawSystemPrompt.slice(0, MAX_SYSTEM_PROMPT_LENGTH)
    : undefined;

  // 1. 会話セッションの取得 or 作成
  let conversationId = params.conversationId;
  let conversationRef;

  if (conversationId) {
    conversationRef = db.collection("conversations").doc(conversationId);
    const convDoc = await conversationRef.get();
    if (
      !convDoc.exists ||
      convDoc.data()?.userId !== params.userId ||
      convDoc.data()?.groupId !== params.groupId
    ) {
      throw createError({ statusCode: 404, statusMessage: "会話が見つかりません" });
    }
  } else {
    conversationRef = db.collection("conversations").doc();
    conversationId = conversationRef.id;
    const newConversation: Omit<Conversation, "id"> = {
      organizationId: params.organizationId,
      groupId: params.groupId,
      userId: params.userId,
      serviceId: params.serviceId,
      title: params.message.trim().slice(0, MAX_CONVERSATION_TITLE_LENGTH),
      status: "active",
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    if (params.externalUserName) newConversation.externalUserName = params.externalUserName;
    if (params.externalUserId) newConversation.externalUserId = params.externalUserId;
    await conversationRef.set(newConversation);
  }

  // 2. ユーザーメッセージを保存
  const userMessageRef = conversationRef.collection("messages").doc();
  const userMessage: Omit<Message, "id"> = {
    role: "user",
    content: params.message.trim(),
    sources: [],
    confidence: null,
    createdAt: now,
  };
  await userMessageRef.set(userMessage);

  // 3. 過去の会話履歴を取得
  const historySnapshot = await conversationRef
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(CHAT_HISTORY_LIMIT)
    .get();

  const conversationHistory = historySnapshot.docs
    .reverse()
    .filter((d) => d.id !== userMessageRef.id)
    .map((d) => ({
      role: d.data().role as "user" | "assistant",
      content: d.data().content as string,
    }));

  // 4. Embedding生成 + RAG検索 + フィードバック検索を並列化
  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await generateEmbedding(params.message);
  } catch (embeddingError) {
    console.error("[chat] Embedding generation failed, skipping RAG:", embeddingError);
  }

  let ragResults: RagResult[] = [];
  let feedbackContext = "";

  const ragSearchPromise = queryEmbedding
    ? enableMultiQuery || enableHyde
      ? multiQuerySearch(params.message, {
          organizationId: params.organizationId,
          groupId: params.groupId,
          serviceId: params.serviceId,
          topK: ragTopK,
          similarityThreshold: ragSimilarityThreshold,
          enableMultiQuery,
          enableHyde,
        })
      : searchRelevantChunks(params.message, {
          organizationId: params.organizationId,
          groupId: params.groupId,
          serviceId: params.serviceId,
          topK: ragTopK,
          similarityThreshold: ragSimilarityThreshold,
          queryVector: queryEmbedding,
        })
    : Promise.resolve([] as RagResult[]);

  const feedbackSearchPromise = queryEmbedding
    ? searchFeedbackChunks(params.message, {
        organizationId: params.organizationId,
        groupId: params.groupId,
        serviceId: params.serviceId,
        topK: FEEDBACK_RAG_TOP_K,
        queryVector: queryEmbedding,
      }).catch((feedbackRagError): null => {
        console.warn(
          "[chat] Feedback RAG search failed, falling back to Firestore query:",
          feedbackRagError,
        );
        return null;
      })
    : Promise.resolve(null);

  const [ragSearchResult, feedbackSearchResult] = await Promise.all([
    ragSearchPromise.catch((error) => {
      console.error(
        `[chat] RAG failed (service=${params.serviceId}, org=${params.organizationId}):`,
        error,
      );
      return [] as RagResult[];
    }),
    feedbackSearchPromise,
  ]);

  ragResults = ragSearchResult;
  console.info(`[chat] RAG: ${ragResults.length} chunks found (service=${params.serviceId})`);

  // フィードバック結果の処理
  if (feedbackSearchResult && feedbackSearchResult.length > 0) {
    const startIndex = ragResults.length + 1;
    feedbackContext = feedbackSearchResult
      .map(
        (r: { similarity: number; correctedAnswer: string }, i: number) =>
          `[参照${startIndex + i}] (類似度: ${(r.similarity * 100).toFixed(1)}%)\n${r.correctedAnswer}`,
      )
      .join("\n\n---\n\n");
    console.info(`[chat] Feedback RAG: ${feedbackSearchResult.length} relevant corrections found`);
  } else if (feedbackSearchResult === null) {
    try {
      const feedbackSnap = await db
        .collection("improvementRequests")
        .where("groupId", "==", params.groupId)
        .where("serviceId", "==", params.serviceId)
        .where("status", "==", "resolved")
        .orderBy("updatedAt", "desc")
        .limit(FEEDBACK_FALLBACK_LIMIT)
        .get();
      const fallbackResults = feedbackSnap.docs
        .map((d) => d.data())
        .filter((d) => d.correctedAnswer?.trim());
      if (fallbackResults.length > 0) {
        const startIndex = ragResults.length + 1;
        feedbackContext = fallbackResults
          .map((d, i) => `[参照${startIndex + i}]\n${d.correctedAnswer}`)
          .join("\n\n---\n\n");
        console.info(
          `[chat] Feedback fallback: ${fallbackResults.length} corrections found via Firestore query`,
        );
      }
    } catch (fallbackError) {
      console.error("[chat] Feedback fallback also failed:", fallbackError);
    }
  }

  // 5. Gemini で回答生成
  let geminiResponse: { content: string; confidence: number };
  try {
    geminiResponse = await generateChatResponse(params.message, ragResults, {
      systemPrompt,
      conversationHistory,
      feedbackContext: feedbackContext || undefined,
    });
  } catch (geminiError) {
    console.error("[chat] Gemini API failed, returning fallback response:", geminiError);
    geminiResponse = {
      content:
        "申し訳ございません。現在、回答の生成に問題が発生しています。しばらく時間をおいてから再度お試しください。",
      confidence: 0,
    };
  }

  // 6. ソース情報の構築
  const sources: MessageSource[] = ragResults.map((r) => ({
    documentId: r.chunk.documentId,
    documentTitle: "",
    chunkId: r.chunk.id,
    chunkContent: r.chunk.content.slice(0, 200),
    similarity: r.similarity,
  }));

  const docIds = [...new Set(sources.map((s) => s.documentId))];
  if (docIds.length > 0) {
    const docSnapshots = await Promise.all(
      docIds.map((docId) => db.collection("documents").doc(docId).get()),
    );
    const docTitles = new Map<string, string>();
    docSnapshots.forEach((snap) => {
      if (snap.exists) {
        docTitles.set(snap.id, snap.data()?.title || "不明");
      }
    });
    sources.forEach((s) => {
      s.documentTitle = docTitles.get(s.documentId) || "不明";
    });
  }

  // 7. アシスタントメッセージを保存
  const assistantMessageRef = conversationRef.collection("messages").doc();
  const assistantMessage: Omit<Message, "id"> = {
    role: "assistant",
    content: geminiResponse.content,
    sources,
    confidence: geminiResponse.confidence,
    createdAt: new Date().toISOString(),
  };
  await assistantMessageRef.set(assistantMessage);

  // 8. 会話のメタデータを更新
  const updateData: Record<string, unknown> = {
    messageCount: FieldValue.increment(2),
    updatedAt: new Date().toISOString(),
  };

  const trimmedMessage = params.message.trim();
  const isEscalationIntent = ESCALATION_KEYWORDS.some((kw) => trimmedMessage.includes(kw));
  const isLowConfidence = isEscalationIntent || geminiResponse.confidence < confidenceThreshold;

  if (!params.skipEscalation && isLowConfidence) {
    updateData.status = "escalated";

    // 改善要望を自動作成
    const improvementRef = db.collection("improvementRequests").doc();
    await improvementRef.set({
      organizationId: params.organizationId,
      groupId: params.groupId,
      serviceId: params.serviceId,
      conversationId,
      category: "missing_docs",
      summary: `ボットが回答に自信がありません (確信度: ${geminiResponse.confidence.toFixed(2)}): ${params.message.slice(0, 100)}`,
      originalQuestion: params.message.trim(),
      priority: "medium",
      status: "open",
      adminNote: "",
      correctedAnswer: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } else {
    updateData.status = "resolved_by_bot";
  }

  await conversationRef.update(updateData);

  // 9. レスポンス
  const result: ChatCoreResult = {
    conversationId,
    message: {
      id: assistantMessageRef.id,
      content: geminiResponse.content,
      sources,
      confidence: geminiResponse.confidence,
    },
  };

  if (!params.skipEscalation && isLowConfidence) {
    const formUrl = serviceData?.googleFormUrl || settings?.googleFormUrl;
    if (formUrl) {
      result.formUrl = formUrl;
    }
  }

  return result;
}
