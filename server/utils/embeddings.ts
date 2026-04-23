import { createHash } from "crypto";
import { GoogleAuth } from "google-auth-library";
import { EXTERNAL_API_TIMEOUT_MS, L2_CACHE_TTL_MS } from "./constants";
import { estimateTokenCount, estimateMaxChars } from "./chunker";

// ==========================================================
// Vertex AI Embeddings の制約
// - instances 数: 最大 250 / リクエスト
// - インスタンスあたり: 最大 2048 トークン
// - リクエスト合計: 最大 20,000 トークン（超過で 400 Bad Request）
// ==========================================================
const MAX_BATCH_INSTANCES = 250;
const MAX_EMBEDDING_TOKENS = 2048;
// estimateTokenCount は推定のため、インスタンス単位では 85% の安全閾値を使う
const SAFE_EMBEDDING_TOKENS = Math.floor(MAX_EMBEDDING_TOKENS * 0.85);
// 文字数ベースのハードキャップ（推定を完全にバイパスする最終防御）
const HARD_CHAR_LIMIT = estimateMaxChars(MAX_EMBEDDING_TOKENS);
// 1 リクエスト合計 20K トークン制限に対し 10% のマージンを取る
const REQUEST_TOKEN_BUDGET = 18_000;
// 400 時の halving 下限（これ以下は真のデータ問題とみなして throw）
const MIN_RETRY_BATCH = 1;
// 429 / 5xx 時のリトライ上限
const MAX_RETRY_ATTEMPTS = 3;

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
 * 埋め込み送信前のサニタイズ。
 * - 空文字/空白のみはプレースホルダ `-` に置換（Vertex が空文字を拒否するため）
 * - 推定トークン数が安全閾値を超える、または文字数がハードキャップを超える場合は切り詰め
 */
export function sanitizeForEmbedding(text: string): string {
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
}

/**
 * サニタイズ済みテキストを、Vertex AI の制約（インスタンス数上限 + リクエスト合計トークン上限）を
 * 満たすようにバッチングする。各要素は元配列のインデックスで返し、呼び出し側が結果を位置指定で
 * マージできるようにする。
 */
export function planBatches(texts: string[]): number[][] {
  const batches: number[][] = [];
  let current: number[] = [];
  let currentTokens = 0;

  for (let i = 0; i < texts.length; i++) {
    const tks = estimateTokenCount(texts[i]);
    const wouldOverflowTokens = currentTokens + tks > REQUEST_TOKEN_BUDGET;
    const wouldOverflowCount = current.length >= MAX_BATCH_INSTANCES;
    if (current.length > 0 && (wouldOverflowTokens || wouldOverflowCount)) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(i);
    currentTokens += tks;
  }
  if (current.length > 0) {
    batches.push(current);
  }
  return batches;
}

interface FetchLikeError {
  statusCode?: number;
  status?: number;
  response?: { status?: number; _data?: unknown };
  data?: unknown;
}

function extractErrorStatus(err: unknown): number | undefined {
  const e = err as FetchLikeError;
  return e?.statusCode ?? e?.response?.status ?? e?.status;
}

function extractErrorBody(err: unknown): string {
  const e = err as FetchLikeError;
  const body = e?.data ?? e?.response?._data;
  if (body === undefined) return "";
  try {
    return JSON.stringify(body).slice(0, 500);
  } catch {
    return String(body).slice(0, 500);
  }
}

async function callVertexEmbed(
  url: string,
  bearerToken: string,
  texts: string[],
): Promise<number[][]> {
  const response = await $fetch<{
    predictions: Array<{ embeddings: { values: number[] } }>;
  }>(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
    body: {
      instances: texts.map((text) => ({ content: text })),
    },
    timeout: EXTERNAL_API_TIMEOUT_MS,
  });
  return response.predictions.map((p) => p.embeddings.values);
}

/**
 * 単一バッチを呼び出す。以下のフォールバックを行う。
 * - 400: 見積もり誤差の可能性を考慮し、サイズが MIN_RETRY_BATCH 超なら半分ずつに分割して再帰呼び出し
 * - 429 / 5xx: ジッター付き指数バックオフでリトライ（最大 MAX_RETRY_ATTEMPTS 回）
 * - それ以外: そのまま throw
 */
async function embedBatchWithAdaptiveRetry(
  url: string,
  bearerToken: string,
  texts: string[],
  attempt = 0,
): Promise<number[][]> {
  try {
    return await callVertexEmbed(url, bearerToken, texts);
  } catch (err: unknown) {
    const status = extractErrorStatus(err);
    const body = extractErrorBody(err);
    const tokensEst = texts.reduce((s, t) => s + estimateTokenCount(t), 0);
    const maxLen = texts.reduce((m, t) => (t.length > m ? t.length : m), 0);
    console.error(
      `[embeddings] Vertex error status=${status ?? "unknown"} instances=${texts.length} tokens~${tokensEst} maxChars=${maxLen} body=${body}`,
    );

    if (status === 400 && texts.length > MIN_RETRY_BATCH) {
      const mid = Math.ceil(texts.length / 2);
      console.warn(
        `[embeddings] 400 received, halving batch ${texts.length} -> ${mid}+${texts.length - mid}`,
      );
      const left = await embedBatchWithAdaptiveRetry(url, bearerToken, texts.slice(0, mid));
      const right = await embedBatchWithAdaptiveRetry(url, bearerToken, texts.slice(mid));
      return [...left, ...right];
    }

    const isRetriable =
      status === 429 || (typeof status === "number" && status >= 500 && status < 600);
    if (isRetriable && attempt < MAX_RETRY_ATTEMPTS) {
      const base = 1000 * 2 ** attempt; // 1s, 2s, 4s
      const delay = base + Math.floor(Math.random() * 250);
      console.warn(
        `[embeddings] Retriable error status=${status}, attempt=${attempt + 1}/${MAX_RETRY_ATTEMPTS}, waiting ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
      return embedBatchWithAdaptiveRetry(url, bearerToken, texts, attempt + 1);
    }

    throw err;
  }
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

  if (!token.token) {
    throw new Error("[embeddings] Failed to obtain Vertex AI access token");
  }

  // サニタイズ後、インスタンス数と合計トークンの両制約を満たすようバッチング
  const sanitized = uncachedTexts.map(sanitizeForEmbedding);
  const batchIndexGroups = planBatches(sanitized);
  console.info(
    `[embeddings] planBatches: ${uncachedTexts.length} texts -> ${batchIndexGroups.length} batches (${location}/${modelId})`,
  );

  const apiEmbeddings: number[][] = new Array(uncachedTexts.length);

  for (const idxs of batchIndexGroups) {
    const batchTexts = idxs.map((i) => sanitized[i]);
    const tokEst = batchTexts.reduce((s, t) => s + estimateTokenCount(t), 0);
    console.info(`[embeddings] Calling Vertex AI: instances=${batchTexts.length} tokens~${tokEst}`);

    const vectors = await embedBatchWithAdaptiveRetry(url, token.token, batchTexts);

    if (vectors.length !== batchTexts.length) {
      throw new Error(
        `[embeddings] Vertex returned ${vectors.length} embeddings for ${batchTexts.length} instances`,
      );
    }

    vectors.forEach((v, k) => {
      apiEmbeddings[idxs[k]] = v;
    });
    console.info(
      `[embeddings] Received ${vectors.length} embeddings, dimension=${vectors[0]?.length}`,
    );
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
