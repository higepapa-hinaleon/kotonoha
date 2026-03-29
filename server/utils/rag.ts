import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "./firebase-admin";
import { generateEmbedding, generateEmbeddings } from "./embeddings";
import { getGenerativeModel } from "./vertex-ai";
import type { DocumentChunk } from "~~/shared/types/models";

export interface RagResult {
  chunk: DocumentChunk;
  similarity: number;
}

/**
 * RAG検索: クエリに関連するドキュメントチャンクを取得する
 * Firestore ベクトル検索を使用
 */
export async function searchRelevantChunks(
  query: string,
  options: {
    organizationId: string;
    groupId: string;
    serviceId: string;
    topK?: number;
    similarityThreshold?: number;
    queryVector?: number[];
  },
): Promise<RagResult[]> {
  const initialTopK = Math.min((options.topK || 5) * 2, 20); // 動的topK用に多めに取得
  const targetTopK = options.topK || 5;
  const similarityThreshold = options.similarityThreshold ?? 0.4;

  // クエリをベクトル化（pre-computed vectorがあればスキップ）
  const queryEmbedding = options.queryVector || (await generateEmbedding(query));
  console.warn(
    `[rag] Searching chunks: group=${options.groupId}, service=${options.serviceId}, initialTopK=${initialTopK}`,
  );

  const db = getAdminFirestore();

  // Firestore ベクトル検索（findNearest）
  const snapshot = await db
    .collection("documentChunks")
    .where("groupId", "==", options.groupId)
    .where("serviceId", "==", options.serviceId)
    .findNearest({
      vectorField: "embedding",
      queryVector: FieldValue.vector(queryEmbedding),
      limit: initialTopK,
      distanceMeasure: "COSINE",
      distanceResultField: "_distance",
    })
    .get();

  console.warn(`[rag] Vector search returned ${snapshot.docs.length} chunks`);

  const allResults: RagResult[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    const similarity = 1 - (data._distance || 0);
    return {
      chunk: { id: doc.id, ...data } as DocumentChunk,
      similarity,
    };
  });

  // 1. 類似度閾値でフィルタリング
  const filtered = allResults.filter((r) => r.similarity >= similarityThreshold);
  console.warn(
    `[rag] After threshold filter (>=${similarityThreshold}): ${filtered.length} chunks`,
  );

  // 2. 同一parentの重複排除（親子チャンク構造対応）
  const deduplicated = deduplicateByParent(filtered);
  console.warn(`[rag] After parent dedup: ${deduplicated.length} chunks`);

  // 3. 動的topK: 類似度の急激な低下を検出して切り捨て
  const dynamicResults = applyDynamicTopK(deduplicated, targetTopK);

  for (const r of dynamicResults) {
    console.warn(
      `[rag]   chunk=${r.chunk.id}, similarity=${r.similarity.toFixed(3)}, section="${r.chunk.sectionTitle || ""}", content=${r.chunk.content?.slice(0, 60)}...`,
    );
  }

  // 参照カウンターの非同期更新（レスポンスをブロックしない）
  if (dynamicResults.length > 0) {
    incrementDocumentReferences(db, dynamicResults).catch((err) => {
      console.error("[rag] Failed to update reference counts:", err);
    });
  }

  return dynamicResults;
}

/**
 * RAG検索で参照されたドキュメントの参照カウンターをインクリメントする
 */
async function incrementDocumentReferences(
  db: FirebaseFirestore.Firestore,
  results: RagResult[],
): Promise<void> {
  // ドキュメントIDごとに集約
  const docIds = new Set<string>();
  for (const r of results) {
    if (r.chunk.documentId) {
      docIds.add(r.chunk.documentId);
    }
  }

  // 各ドキュメントの参照カウンターをインクリメント
  const batch = db.batch();
  for (const docId of docIds) {
    const docRef = db.collection("documents").doc(docId);
    batch.update(docRef, {
      referenceCount: FieldValue.increment(1),
    });
  }

  await batch.commit();
}

/**
 * 同一parentChunkIndexのチャンクを重複排除する
 * 同じ親チャンクから複数の子チャンクがヒットした場合、最も類似度が高いものだけ残す
 */
function deduplicateByParent(results: RagResult[]): RagResult[] {
  const parentMap = new Map<string, RagResult>();

  for (const result of results) {
    const parentKey =
      result.chunk.parentChunkIndex !== undefined
        ? `${result.chunk.documentId}:${result.chunk.parentChunkIndex}`
        : `${result.chunk.documentId}:${result.chunk.chunkIndex}`;

    const existing = parentMap.get(parentKey);
    if (!existing || result.similarity > existing.similarity) {
      parentMap.set(parentKey, result);
    }
  }

  return Array.from(parentMap.values()).sort((a, b) => b.similarity - a.similarity);
}

/**
 * 動的topK: 類似度スコアの分布に基づいて結果数を調整する
 * 類似度が急激に低下する箇所（ドロップ > 0.15）で結果を打ち切る
 */
function applyDynamicTopK(results: RagResult[], maxTopK: number): RagResult[] {
  if (results.length <= 1) return results.slice(0, maxTopK);

  const dropThreshold = 0.15;
  let cutoff = Math.min(results.length, maxTopK);

  for (let i = 1; i < cutoff; i++) {
    const drop = results[i - 1].similarity - results[i].similarity;
    if (drop > dropThreshold) {
      cutoff = i;
      console.warn(
        `[rag] Dynamic topK: cut at index ${i} (similarity drop ${drop.toFixed(3)} > ${dropThreshold})`,
      );
      break;
    }
  }

  return results.slice(0, cutoff);
}

/**
 * RAG結果からコンテキストテキストを組み立てる
 * 親子チャンク構造対応: parentContentがあればそちらを使用
 */
export function buildContextFromResults(results: RagResult[]): string {
  if (results.length === 0) return "";

  return results
    .map((r, i) => {
      const header = r.chunk.documentTitle
        ? `[参照${i + 1}] ${r.chunk.documentTitle}${r.chunk.sectionTitle ? ` - ${r.chunk.sectionTitle}` : ""} (類似度: ${(r.similarity * 100).toFixed(1)}%)`
        : `[参照${i + 1}] (類似度: ${(r.similarity * 100).toFixed(1)}%)`;
      const content = r.chunk.parentContent || r.chunk.content;
      return `${header}\n${content}`;
    })
    .join("\n\n---\n\n");
}

// ==========================================================
// フィードバック RAG: 訂正回答をベクトル化して保存・検索
// ==========================================================

/**
 * 訂正回答をベクトル化して feedbackChunks に保存（upsert）
 */
export async function storeFeedbackEmbedding(params: {
  improvementId: string;
  organizationId: string;
  groupId: string;
  serviceId: string;
  question: string;
  correctedAnswer: string;
}): Promise<void> {
  const db = getAdminFirestore();
  const now = new Date().toISOString();

  // 質問テキストのベクトルを生成
  console.warn(
    `[feedback-rag] Generating embedding for feedback question: "${params.question.slice(0, 60)}..."`,
  );
  const embedding = await generateEmbedding(params.question);

  // 既存の feedbackChunk を検索（同じ improvementId）
  const existingSnap = await db
    .collection("feedbackChunks")
    .where("improvementId", "==", params.improvementId)
    .limit(1)
    .get();

  const data = {
    organizationId: params.organizationId,
    groupId: params.groupId,
    serviceId: params.serviceId,
    improvementId: params.improvementId,
    question: params.question,
    correctedAnswer: params.correctedAnswer,
    embedding: FieldValue.vector(embedding),
    updatedAt: now,
  };

  if (existingSnap.empty) {
    // 新規作成
    await db
      .collection("feedbackChunks")
      .doc()
      .set({ ...data, createdAt: now });
    console.warn(
      `[feedback-rag] Created new feedback chunk for improvement=${params.improvementId}`,
    );
  } else {
    // 更新
    await existingSnap.docs[0].ref.update(data);
    console.warn(
      `[feedback-rag] Updated existing feedback chunk for improvement=${params.improvementId}`,
    );
  }
}

/**
 * 訂正回答を削除（改善要望のステータスが resolved 以外になった場合）
 */
export async function removeFeedbackEmbedding(improvementId: string): Promise<void> {
  const db = getAdminFirestore();
  const snap = await db
    .collection("feedbackChunks")
    .where("improvementId", "==", improvementId)
    .limit(1)
    .get();

  if (!snap.empty) {
    await snap.docs[0].ref.delete();
    console.warn(`[feedback-rag] Removed feedback chunk for improvement=${improvementId}`);
  }
}

/**
 * フィードバック RAG検索: ユーザーの質問に関連する訂正回答を取得
 */
export async function searchFeedbackChunks(
  query: string,
  options: {
    organizationId: string;
    groupId: string;
    serviceId: string;
    topK?: number;
    queryVector?: number[];
  },
): Promise<{ question: string; correctedAnswer: string; similarity: number }[]> {
  const topK = options.topK || 3;

  const queryEmbedding = options.queryVector || (await generateEmbedding(query));
  const db = getAdminFirestore();

  try {
    const snapshot = await db
      .collection("feedbackChunks")
      .where("groupId", "==", options.groupId)
      .where("serviceId", "==", options.serviceId)
      .findNearest({
        vectorField: "embedding",
        queryVector: FieldValue.vector(queryEmbedding),
        limit: topK,
        distanceMeasure: "COSINE",
        distanceResultField: "_distance",
      })
      .get();

    console.warn(`[feedback-rag] Vector search returned ${snapshot.docs.length} feedback chunks`);

    return snapshot.docs
      .map((doc) => {
        const d = doc.data();
        const similarity = 1 - (d._distance || 0);
        return {
          question: d.question as string,
          correctedAnswer: d.correctedAnswer as string,
          similarity,
        };
      })
      .filter((r) => r.similarity > 0.5); // 類似度が低すぎるものは除外
  } catch (error) {
    console.error("[feedback-rag] Vector search failed:", error);
    return [];
  }
}

// ==========================================================
// マルチクエリRAG + HyDE
// ==========================================================

/**
 * マルチクエリRAG: ユーザーの質問からGeminiで代替クエリを生成する
 */
export async function generateAlternativeQueries(
  query: string,
  count: number = 2,
): Promise<string[]> {
  const model = getGenerativeModel();

  const prompt = `以下のユーザーの質問を、異なる表現や観点で言い換えた検索クエリを${count}つ生成してください。
元の質問の意味は保ちつつ、異なる語彙やフレーズを使ってください。
各クエリを改行区切りで出力してください。余計な説明は不要です。

質問: ${query}

代替クエリ:`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const queries = text
      .split("\n")
      .map((q) => q.replace(/^\d+[.)]\s*/, "").trim())
      .filter((q) => q.length > 0)
      .slice(0, count);

    console.warn(`[multi-query] Generated ${queries.length} alternative queries`);
    return queries;
  } catch (error) {
    console.error("[multi-query] Failed to generate alternative queries:", error);
    return [];
  }
}

/**
 * HyDE: ユーザーの質問に対する仮の回答ドキュメントを生成する
 */
export async function generateHypotheticalDocument(query: string): Promise<string> {
  const model = getGenerativeModel();

  const prompt = `以下の質問に対して、社内ドキュメントに書かれていそうな回答を1段落（100-200文字程度）で書いてください。
実際の情報がなくても推測で構いません。具体的かつ業務的なトーンで書いてください。

質問: ${query}

想定される回答:`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.warn(`[hyde] Generated hypothetical document (${text.length} chars)`);
    return text.trim();
  } catch (error) {
    console.error("[hyde] Failed to generate hypothetical document:", error);
    return "";
  }
}

/**
 * マルチクエリ + HyDE統合検索
 * 元クエリ + 代替クエリ + HyDE仮回答で検索し、結果をマージ・重複排除する
 */
export async function multiQuerySearch(
  query: string,
  options: {
    organizationId: string;
    groupId: string;
    serviceId: string;
    topK?: number;
    similarityThreshold?: number;
    enableMultiQuery?: boolean;
    enableHyde?: boolean;
  },
): Promise<RagResult[]> {
  const targetTopK = options.topK || 5;

  // 追加のクエリテキストを並列で生成
  const [altQueries, hydeDoc] = await Promise.all([
    options.enableMultiQuery ? generateAlternativeQueries(query, 2) : Promise.resolve([]),
    options.enableHyde ? generateHypotheticalDocument(query) : Promise.resolve(""),
  ]);

  // 全クエリテキストを収集
  const allQueryTexts = [query, ...altQueries];
  if (hydeDoc) allQueryTexts.push(hydeDoc);

  console.warn(
    `[multi-query] Searching with ${allQueryTexts.length} queries (original + ${altQueries.length} alt + ${hydeDoc ? "1 hyde" : "0 hyde"})`,
  );

  // バッチembedding生成
  const allEmbeddings = await generateEmbeddings(allQueryTexts);

  // 各embeddingで並列検索
  const searchPromises = allEmbeddings.map((embedding) =>
    searchRelevantChunks(query, {
      organizationId: options.organizationId,
      groupId: options.groupId,
      serviceId: options.serviceId,
      topK: targetTopK,
      similarityThreshold: options.similarityThreshold,
      queryVector: embedding,
    }),
  );

  const allSearchResults = await Promise.all(searchPromises);

  // 結果をマージ・重複排除（同じチャンクIDの場合、最高類似度を採用）
  const mergedMap = new Map<string, RagResult>();
  for (const results of allSearchResults) {
    for (const result of results) {
      const existing = mergedMap.get(result.chunk.id);
      if (!existing || result.similarity > existing.similarity) {
        mergedMap.set(result.chunk.id, result);
      }
    }
  }

  // 類似度順にソートしてtopK件返す
  const merged = Array.from(mergedMap.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, targetTopK);

  console.warn(
    `[multi-query] Merged results: ${merged.length} unique chunks from ${allSearchResults.flat().length} total`,
  );

  return merged;
}
