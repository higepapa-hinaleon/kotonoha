import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import { searchRelevantChunks } from "~~/server/utils/rag";
import { resolveBotConfig } from "~~/server/utils/resolve-bot-config";
import type { Service, Settings } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  const query = getQuery(event);

  if (!query.serviceId) {
    throw createError({ statusCode: 400, statusMessage: "serviceId は必須です" });
  }

  const serviceId = query.serviceId as string;
  const testQuery = (query.testQuery as string) || "";
  const db = getAdminFirestore();
  const organizationId = user.organizationId;

  if (!organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  const diagnostics: Record<string, unknown> = {};

  // 1. このサービスのドキュメント一覧
  const docsSnapshot = await db
    .collection("documents")
    .where("groupId", "==", groupId)
    .where("serviceId", "==", serviceId)
    .get();

  const documents = docsSnapshot.docs.map((d) => ({
    id: d.id,
    title: d.data().title,
    status: d.data().status,
    chunkCount: d.data().chunkCount,
  }));
  diagnostics.documents = documents;
  diagnostics.documentCount = documents.length;
  diagnostics.readyDocumentCount = documents.filter((d) => d.status === "ready").length;

  // 2. このサービスのチャンク数
  const chunksSnapshot = await db
    .collection("documentChunks")
    .where("groupId", "==", groupId)
    .where("serviceId", "==", serviceId)
    .limit(100)
    .get();

  diagnostics.chunkCount = chunksSnapshot.size;

  // 3. サンプルチャンクの埋め込み確認
  if (chunksSnapshot.docs.length > 0) {
    const sampleData = chunksSnapshot.docs[0].data();
    const embedding = sampleData.embedding;
    let embeddingDimension = 0;
    if (embedding && typeof embedding.toArray === "function") {
      embeddingDimension = embedding.toArray().length;
    } else if (Array.isArray(embedding)) {
      embeddingDimension = embedding.length;
    }
    diagnostics.sampleChunk = {
      id: chunksSnapshot.docs[0].id,
      documentId: sampleData.documentId,
      contentPreview: sampleData.content?.slice(0, 200),
      hasEmbedding: !!embedding,
      embeddingDimension,
    };
  }

  // 4. テストクエリでRAG検索を実行
  if (testQuery) {
    try {
      const startTime = Date.now();
      const results = await searchRelevantChunks(testQuery, {
        organizationId,
        groupId,
        serviceId,
        topK: 5,
      });
      const elapsed = Date.now() - startTime;

      diagnostics.searchTest = {
        query: testQuery,
        resultCount: results.length,
        elapsedMs: elapsed,
        results: results.map((r) => ({
          chunkId: r.chunk.id,
          documentId: r.chunk.documentId,
          similarity: r.similarity,
          contentPreview: r.chunk.content.slice(0, 200),
        })),
      };
    } catch (error) {
      diagnostics.searchTest = {
        query: testQuery,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // 5. ボット設定（サービス個別 → グループ → デフォルト の順で解決）
  const [serviceDoc, settingsSnapshot] = await Promise.all([
    db.collection("services").doc(serviceId).get(),
    db.collection("settings").where("groupId", "==", groupId).limit(1).get(),
  ]);
  const serviceData = serviceDoc.exists ? (serviceDoc.data() as Omit<Service, "id">) : undefined;
  const settingsData = settingsSnapshot.docs[0]?.data() as Settings | undefined;
  const resolved = resolveBotConfig(serviceData?.botConfig, settingsData?.botConfig);

  diagnostics.botConfig = {
    confidenceThreshold: resolved.confidenceThreshold,
    ragTopK: resolved.ragTopK,
    hasSystemPrompt: !!resolved.systemPrompt,
    isServiceOverride: !!serviceData?.botConfig,
  };

  return diagnostics;
});
