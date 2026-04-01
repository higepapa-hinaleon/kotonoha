import { createHash } from "crypto";
import { GoogleAuth } from "google-auth-library";
import { EXTERNAL_API_TIMEOUT_MS, L2_CACHE_TTL_MS } from "./constants";
import { estimateTokenCount, estimateMaxChars } from "./chunker";

let authClient: GoogleAuth | null = null;

function getAuthClient(): GoogleAuth {
  if (authClient) return authClient;

  const config = useRuntimeConfig();

  authClient = new GoogleAuth({
    credentials: {
      client_email: config.firebaseClientEmail,
      private_key: config.firebasePrivateKey?.replace(/\\n/g, "\n"),
    },
    projectId: config.firebaseProjectId,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  return authClient;
}

// ==========================================================
// 2層キャッシュ: L1 インメモリ + L2 Firestore（永続化）
// ==========================================================

interface CacheEntry {
  vector: number[];
  timestamp: number;
}

const embeddingCache = new Map<string, CacheEntry>();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30分（L1）
// L2 TTL は constants.ts の L2_CACHE_TTL_MS を使用（30日）

function textToHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

function getCachedEmbedding(text: string): number[] | null {
  const entry = embeddingCache.get(text);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    embeddingCache.delete(text);
    return null;
  }

  return entry.vector;
}

function setCachedEmbedding(text: string, vector: number[]): void {
  // LRU: サイズ超過時は最も古いエントリを削除
  if (embeddingCache.size >= CACHE_MAX_SIZE) {
    const firstKey = embeddingCache.keys().next().value;
    if (firstKey !== undefined) {
      embeddingCache.delete(firstKey);
    }
  }
  embeddingCache.set(text, { vector, timestamp: Date.now() });
}

/**
 * L2キャッシュ（Firestore）から埋め込みを取得
 */
async function getL2CachedEmbedding(text: string): Promise<number[] | null> {
  try {
    const { getAdminFirestore } = await import("./firebase-admin");
    const db = getAdminFirestore();
    const hash = textToHash(text);
    const doc = await db.collection("embeddingCache").doc(hash).get();

    if (!doc.exists) return null;

    const data = doc.data();
    if (!data) return null;

    // TTLチェック
    const createdAt = data.createdAt ? new Date(data.createdAt).getTime() : 0;
    if (Date.now() - createdAt > L2_CACHE_TTL_MS) {
      // 期限切れ - 非同期で削除
      doc.ref.delete().catch((err) => {
        console.warn("[embeddings] L2 cache deletion failed:", err);
      });
      return null;
    }

    const vector = data.embedding;
    if (!vector || !Array.isArray(vector)) return null;

    // L1キャッシュにも保存
    setCachedEmbedding(text, vector);

    return vector;
  } catch (err) {
    console.warn("[embeddings] L2 cache read failed:", err);
    return null;
  }
}

/**
 * L2キャッシュ（Firestore）に埋め込みを保存
 */
function setL2CachedEmbedding(text: string, vector: number[]): void {
  // 非同期で保存（レスポンスをブロックしない）
  import("./firebase-admin")
    .then(({ getAdminFirestore }) => {
      const db = getAdminFirestore();
      const hash = textToHash(text);
      return db.collection("embeddingCache").doc(hash).set({
        textHash: hash,
        embedding: vector,
        createdAt: new Date().toISOString(),
      });
    })
    .catch((err) => {
      console.error("[embeddings] Failed to write L2 cache:", err);
    });
}

/**
 * テキストのベクトル埋め込みを生成する
 * Vertex AI text-multilingual-embedding-002 を使用（768次元）
 * L1（インメモリ）→ L2（Firestore）→ APIの順にキャッシュを確認
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // L1キャッシュ
  const cached = getCachedEmbedding(text);
  if (cached) {
    console.info(`[embeddings] L1 cache hit for query (${text.length} chars)`);
    return cached;
  }

  // L2キャッシュ
  const l2Cached = await getL2CachedEmbedding(text);
  if (l2Cached) {
    console.info(`[embeddings] L2 cache hit for query (${text.length} chars)`);
    return l2Cached;
  }

  const embeddings = await generateEmbeddings([text]);
  return embeddings[0];
}

/**
 * 複数テキストのベクトル埋め込みを一括生成する
 * Vertex AI Embeddings REST API を直接呼び出す
 * キャッシュ済みテキストはAPIコールから除外
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  // キャッシュチェック: 未キャッシュのテキストのみAPIに送る
  const results: (number[] | null)[] = texts.map((t) => getCachedEmbedding(t));
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  results.forEach((r, i) => {
    if (r === null) {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]);
    }
  });

  const cachedCount = texts.length - uncachedTexts.length;
  if (cachedCount > 0) {
    console.info(`[embeddings] ${cachedCount}/${texts.length} texts served from cache`);
  }

  if (uncachedTexts.length === 0) {
    return results as number[][];
  }

  // Vertex AI API呼び出し
  const config = useRuntimeConfig();
  const auth = getAuthClient();
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const projectId = config.firebaseProjectId;
  const location = config.vertexAiLocation;
  const modelId = config.vertexAiEmbeddingModel;

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

  // Vertex AI Embeddings は一度に最大250テキストまで
  const batchSize = 250;
  const MAX_EMBEDDING_TOKENS = 2048;
  // estimateTokenCount は推定のため、余裕を持った閾値でトークン超過を判定
  const SAFE_EMBEDDING_TOKENS = Math.floor(MAX_EMBEDDING_TOKENS * 0.85);
  // 文字数ベースのハードキャップ（推定を完全にバイパスする最終防御）
  const HARD_CHAR_LIMIT = estimateMaxChars(MAX_EMBEDDING_TOKENS);
  const apiEmbeddings: number[][] = [];

  for (let i = 0; i < uncachedTexts.length; i += batchSize) {
    const batch = uncachedTexts.slice(i, i + batchSize);
    console.info(
      `[embeddings] Calling Vertex AI (${location}/${modelId}) for ${batch.length} texts`,
    );

    // トークン上限超過テキストを切り詰め（安全弁）
    // 1) 推定トークン数が安全閾値を超える場合は切り詰め
    // 2) 文字数がハードキャップを超える場合も無条件に切り詰め
    // 3) 空テキストはプレースホルダーに置換
    const safeBatch = batch.map((text) => {
      if (!text || !text.trim()) {
        return "-";
      }
      if (text.length > HARD_CHAR_LIMIT || estimateTokenCount(text) > SAFE_EMBEDDING_TOKENS) {
        const maxChars = estimateMaxChars(SAFE_EMBEDDING_TOKENS);
        console.warn(
          `[embeddings] Text (${text.length} chars, ~${estimateTokenCount(text)} tokens) exceeds safe limit, truncating to ${maxChars} chars`,
        );
        return text.slice(0, maxChars);
      }
      return text;
    });

    const response = await $fetch<{
      predictions: Array<{ embeddings: { values: number[] } }>;
    }>(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.token}`,
      },
      body: {
        instances: safeBatch.map((text) => ({ content: text })),
      },
      timeout: EXTERNAL_API_TIMEOUT_MS,
    });

    const embeddings = response.predictions.map((p) => p.embeddings.values);
    console.info(
      `[embeddings] Received ${embeddings.length} embeddings, dimension=${embeddings[0]?.length}`,
    );
    apiEmbeddings.push(...embeddings);
  }

  // 結果をマージしてL1+L2キャッシュに保存
  apiEmbeddings.forEach((embedding, i) => {
    const originalIndex = uncachedIndices[i];
    results[originalIndex] = embedding;
    setCachedEmbedding(uncachedTexts[i], embedding);
    setL2CachedEmbedding(uncachedTexts[i], embedding);
  });

  return results as number[][];
}
