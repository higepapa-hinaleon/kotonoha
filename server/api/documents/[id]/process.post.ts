import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore, getAdminStorage } from "~~/server/utils/firebase-admin";
import { verifyGroupAdmin } from "~~/server/utils/auth";
import { extractText, splitTextIntoParentChildChunks, estimateTokenCount, estimateMaxChars } from "~~/server/utils/chunker";
import { generateEmbeddings } from "~~/server/utils/embeddings";
import {
  generateDocumentSummary,
  generateContextPrefixBatch,
} from "~~/server/utils/context-generator";
import { CONTEXT_GENERATION_CHUNK_LIMIT } from "~~/server/utils/constants";
import type { Document } from "~~/shared/types/models";

function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Embedding APIのトークン上限（text-multilingual-embedding-002） */
const EMBEDDING_MAX_TOKENS = 2048;
/** estimateTokenCount は推定のため、余裕を持った安全閾値を使用 */
const SAFE_EMBEDDING_TOKENS = Math.floor(EMBEDDING_MAX_TOKENS * 0.85);

/**
 * contextPrefix + chunk.content を結合し、embedding APIのトークン上限を超えないよう切り詰める
 * チャンク内容を優先し、プレフィックスは余剰トークン分だけ使用する
 */
function buildEmbeddingText(prefix: string, content: string): string {
  if (!prefix) return content;
  const combined = `${prefix}\n\n${content}`;
  if (estimateTokenCount(combined) <= SAFE_EMBEDDING_TOKENS) {
    return combined;
  }
  // チャンク内容を優先、プレフィックスを切り詰め
  const contentTokens = estimateTokenCount(content);
  const availableTokens = SAFE_EMBEDDING_TOKENS - contentTokens - 10;
  if (availableTokens <= 0) return content;
  const maxPrefixChars = estimateMaxChars(availableTokens);
  const truncatedPrefix = prefix.slice(0, maxPrefixChars);
  return `${truncatedPrefix}\n\n${content}`;
}

async function doProcessing(
  id: string,
  document: Document,
  incrementalMode: boolean,
  organizationId: string,
  groupId: string,
): Promise<void> {
  const db = getAdminFirestore();
  const docRef = db.collection("documents").doc(id);

  try {
    // 1. Cloud Storage からファイルをダウンロード
    const storage = getAdminStorage();
    const [fileBuffer] = await storage.bucket().file(document.storagePath).download();

    // 2. テキスト抽出
    const text = await extractText(fileBuffer, document.mimeType);
    console.warn(`[process] Document "${document.title}" (${id}): text extracted (${text.length} chars)`);

    // 3. 親子チャンク分割
    const chunks = splitTextIntoParentChildChunks(text, {
      parentMaxTokens: 800,
      childMaxTokens: 250,
      overlapTokens: 50,
    });

    if (chunks.length === 0) {
      await docRef.update({ status: "error", updatedAt: new Date().toISOString() });
      console.error(`[process] Document "${document.title}" (${id}): テキストを抽出できませんでした`);
      return;
    }

    console.warn(
      `[process] Document "${document.title}" (${id}): ${chunks.length} child chunks created (incremental=${incrementalMode})`,
    );

    // 4. 既存チャンクのハッシュマップを構築（インクリメンタルモード時）
    const existingChunks = await db
      .collection("documentChunks")
      .where("documentId", "==", id)
      .get();

    const existingHashMap = new Map<number, { docId: string; hash: string }>();
    if (incrementalMode) {
      for (const chunkDoc of existingChunks.docs) {
        const data = chunkDoc.data();
        if (data.contentHash) {
          existingHashMap.set(data.chunkIndex, {
            docId: chunkDoc.id,
            hash: data.contentHash,
          });
        }
      }
    }

    // 5. 新しいチャンクのハッシュを計算し、変更分を特定
    const newChunkHashes = chunks.map((c) => contentHash(c.content));
    const changedIndices: number[] = [];
    const unchangedIndices: number[] = [];

    if (incrementalMode && existingHashMap.size > 0) {
      for (let i = 0; i < chunks.length; i++) {
        const existing = existingHashMap.get(i);
        if (existing && existing.hash === newChunkHashes[i]) {
          unchangedIndices.push(i);
        } else {
          changedIndices.push(i);
        }
      }
      console.warn(
        `[process] Incremental: ${changedIndices.length} changed, ${unchangedIndices.length} unchanged chunks`,
      );
    } else {
      // フルリプロセス: 全チャンクが変更対象
      for (let i = 0; i < chunks.length; i++) {
        changedIndices.push(i);
      }
    }

    // 6. Contextual Retrieval（変更チャンクのみ、またはフルの場合は全チャンク）
    //    大量チャンク時は個別生成をスキップし、ドキュメント要約を共通プレフィックスとして使用
    let contextPrefixes: string[];

    if (changedIndices.length > CONTEXT_GENERATION_CHUNK_LIMIT) {
      // 大量チャンク: 個別コンテキスト生成をスキップし、ドキュメント要約を共通プレフィックスとして使用
      console.warn(
        `[process] Document "${document.title}" (${id}): using document summary as prefix (${changedIndices.length} changed chunks > ${CONTEXT_GENERATION_CHUNK_LIMIT})`,
      );
      const documentSummary = await generateDocumentSummary(text, document.title);
      // 既存の未変更チャンクのプレフィックスは保持し、変更チャンクのみ要約を使用
      contextPrefixes = new Array(chunks.length).fill("");
      for (const chunkDoc of existingChunks.docs) {
        const data = chunkDoc.data();
        if (unchangedIndices.includes(data.chunkIndex)) {
          contextPrefixes[data.chunkIndex] = data.contextPrefix || "";
        }
      }
      for (const idx of changedIndices) {
        contextPrefixes[idx] = documentSummary;
      }
    } else if (changedIndices.length === chunks.length) {
      // フルリプロセス
      const documentSummary = await generateDocumentSummary(text, document.title);
      const chunkContents = chunks.map((c) => c.content);
      contextPrefixes = await generateContextPrefixBatch(documentSummary, chunkContents);
    } else if (changedIndices.length > 0) {
      // 差分のみ
      const documentSummary = await generateDocumentSummary(text, document.title);
      const changedContents = changedIndices.map((i) => chunks[i].content);
      const changedPrefixes = await generateContextPrefixBatch(documentSummary, changedContents);

      // 既存のプレフィックスと統合
      contextPrefixes = new Array(chunks.length).fill("");
      for (const chunkDoc of existingChunks.docs) {
        const data = chunkDoc.data();
        if (unchangedIndices.includes(data.chunkIndex)) {
          contextPrefixes[data.chunkIndex] = data.contextPrefix || "";
        }
      }
      changedIndices.forEach((idx, i) => {
        contextPrefixes[idx] = changedPrefixes[i] || "";
      });
    } else {
      // 変更なし
      contextPrefixes = new Array(chunks.length).fill("");
      for (const chunkDoc of existingChunks.docs) {
        const data = chunkDoc.data();
        contextPrefixes[data.chunkIndex] = data.contextPrefix || "";
      }
    }

    console.warn(`[process] Document "${document.title}" (${id}): context prefixes generated`);

    // 7. ベクトル化（変更チャンクのみ）
    let embeddings: number[][];
    if (changedIndices.length === chunks.length) {
      // フル
      const embeddingTexts = chunks.map((c, i) =>
        buildEmbeddingText(contextPrefixes[i], c.content),
      );
      embeddings = await generateEmbeddings(embeddingTexts);
    } else if (changedIndices.length > 0) {
      // 差分のみembedding生成
      const changedTexts = changedIndices.map((i) =>
        buildEmbeddingText(contextPrefixes[i], chunks[i].content),
      );
      const changedEmbeddings = await generateEmbeddings(changedTexts);

      // 既存embeddings + 新embeddings を統合
      embeddings = new Array(chunks.length).fill(null);
      // 既存チャンクの embedding は再利用不可（FieldValue.vector を直接取得不可）
      // 変更チャンクのみ新しい embedding を使用
      changedIndices.forEach((idx, i) => {
        embeddings[idx] = changedEmbeddings[i];
      });
    } else {
      embeddings = [];
    }

    console.warn(`[process] Document "${document.title}" (${id}): embeddings generated`);

    // 8. バッチ書き込み
    const batches: FirebaseFirestore.WriteBatch[] = [];
    let currentBatch = db.batch();
    let opsInBatch = 0;

    const ensureBatch = () => {
      if (opsInBatch >= 490) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        opsInBatch = 0;
      }
    };

    const now = new Date().toISOString();

    if (incrementalMode && unchangedIndices.length > 0 && changedIndices.length < chunks.length) {
      // インクリメンタル: 変更チャンクのみ削除→再作成
      // 旧チャンクのうち変更分 + 不要分を削除
      const existingByIndex = new Map<number, FirebaseFirestore.QueryDocumentSnapshot>();
      for (const chunkDoc of existingChunks.docs) {
        existingByIndex.set(chunkDoc.data().chunkIndex, chunkDoc);
      }

      // 変更分を削除
      for (const idx of changedIndices) {
        const existing = existingByIndex.get(idx);
        if (existing) {
          ensureBatch();
          currentBatch.delete(existing.ref);
          opsInBatch++;
        }
      }

      // チャンク数が減った場合、超過分を削除
      for (const [idx, chunkDoc] of existingByIndex) {
        if (idx >= chunks.length) {
          ensureBatch();
          currentBatch.delete(chunkDoc.ref);
          opsInBatch++;
        }
      }

      // 変更チャンクを新規作成
      for (const idx of changedIndices) {
        ensureBatch();
        const chunk = chunks[idx];
        const chunkRef = db.collection("documentChunks").doc();
        currentBatch.set(chunkRef, {
          organizationId,
          groupId,
          documentId: id,
          serviceId: document.serviceId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          contentHash: newChunkHashes[idx],
          tokenCount: chunk.tokenCount,
          contextPrefix: contextPrefixes[idx] || "",
          documentTitle: document.title,
          documentType: document.type,
          tags: document.tags || [],
          sectionTitle: chunk.sectionTitle || "",
          parentContent: chunk.parentContent,
          parentChunkIndex: chunk.parentChunkIndex,
          embedding: FieldValue.vector(embeddings[idx]),
          createdAt: now,
        });
        opsInBatch++;
      }
    } else {
      // フルリプロセス: 既存チャンクを全削除
      existingChunks.docs.forEach((chunkDoc) => {
        ensureBatch();
        currentBatch.delete(chunkDoc.ref);
        opsInBatch++;
      });

      // 新チャンクを全作成
      chunks.forEach((chunk, i) => {
        ensureBatch();
        const chunkRef = db.collection("documentChunks").doc();
        currentBatch.set(chunkRef, {
          organizationId,
          groupId,
          documentId: id,
          serviceId: document.serviceId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          contentHash: newChunkHashes[i],
          tokenCount: chunk.tokenCount,
          contextPrefix: contextPrefixes[i] || "",
          documentTitle: document.title,
          documentType: document.type,
          tags: document.tags || [],
          sectionTitle: chunk.sectionTitle || "",
          parentContent: chunk.parentContent,
          parentChunkIndex: chunk.parentChunkIndex,
          embedding: FieldValue.vector(embeddings[i]),
          createdAt: now,
        });
        opsInBatch++;
      });
    }

    // ドキュメントのステータスとチャンク数を更新
    ensureBatch();
    currentBatch.update(docRef, {
      status: "ready",
      chunkCount: chunks.length,
      updatedAt: now,
    });
    opsInBatch++;

    batches.push(currentBatch);

    // 全バッチをコミット
    for (const batch of batches) {
      await batch.commit();
    }

    console.warn(
      `[process] Document "${document.title}" processed: ${chunks.length} chunks (changed: ${changedIndices.length}, unchanged: ${unchangedIndices.length})`,
    );
  } catch (error: unknown) {
    const detail = error instanceof Error
      ? `${error.message}\n${error.stack}`
      : String(error);
    console.error(`[process] Document "${document.title}" (${id}) processing failed:\n${detail}`);
    // エラー時はステータスを「error」に更新
    try {
      await docRef.update({ status: "error", updatedAt: new Date().toISOString() });
    } catch (updateError) {
      console.error(`[process] Document (${id}): Failed to update error status:`, updateError);
    }
  }
}

export default defineEventHandler(async (event) => {
  const { user, groupId } = await verifyGroupAdmin(event);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "IDが必要です" });
  }

  const db = getAdminFirestore();
  const docRef = db.collection("documents").doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw createError({ statusCode: 404, statusMessage: "ドキュメントが見つかりません" });
  }

  const document = { id: doc.id, ...doc.data() } as Document;
  if (document.groupId !== groupId) {
    throw createError({ statusCode: 403, statusMessage: "アクセス権がありません" });
  }

  // 冪等性ガード: 既に処理中の場合は再トリガーしない
  if (document.status === "processing") {
    return { success: true, documentId: id, status: "processing" };
  }

  // クエリパラメータでインクリメンタルモードを制御
  const query = getQuery(event);
  const incrementalMode = query.incremental === "true";

  // ステータスを「処理中」に更新
  await docRef.update({ status: "processing", updatedAt: new Date().toISOString() });

  // バックグラウンドで処理を実行し、レスポンスは即座に返す
  event.waitUntil(doProcessing(id, document, incrementalMode, user.organizationId, groupId));

  return { success: true, documentId: id, status: "processing" };
});
