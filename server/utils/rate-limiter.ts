/**
 * インメモリ Token Bucket レート制限
 *
 * 制約:
 * - Cloud Run インスタンス単位で動作（分散ロックなし）
 * - max-instances=N の場合、実効レート制限は設定値の最大 N 倍になる
 * - インスタンス再起動・デプロイ時にバケットがリセットされる
 * - Vertex AI API クォータが二次防御として機能する
 *
 * Phase 8 改善候補: Firestore/Redis ベースの分散レート制限への移行
 */

interface BucketEntry {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, BucketEntry>();
const MAX_BUCKET_SIZE = 10_000;

// 定期クリーンアップ（5分ごと）
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(): void {
  if (Date.now() - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = Date.now();
  const now = Date.now();
  for (const [key, entry] of buckets) {
    // 5分以上アクセスがないエントリを削除
    if (now - entry.lastRefill > CLEANUP_INTERVAL_MS) {
      buckets.delete(key);
    }
  }
  // サイズ上限を超えた場合、古いエントリから削除
  if (buckets.size > MAX_BUCKET_SIZE) {
    const entries = [...buckets.entries()].sort((a, b) => a[1].lastRefill - b[1].lastRefill);
    const toRemove = entries.slice(0, buckets.size - MAX_BUCKET_SIZE);
    for (const [key] of toRemove) {
      buckets.delete(key);
    }
  }
}

/**
 * レート制限チェック
 * @returns true = 許可, false = レート制限超過
 */
export function checkRateLimit(
  key: string,
  config: { maxRequests: number; windowMs: number },
): boolean {
  cleanup();

  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry) {
    buckets.set(key, { tokens: config.maxRequests - 1, lastRefill: now });
    return true;
  }

  // トークン補充
  const elapsed = now - entry.lastRefill;
  const refill = (elapsed / config.windowMs) * config.maxRequests;
  entry.tokens = Math.min(config.maxRequests, entry.tokens + refill);
  entry.lastRefill = now;

  if (entry.tokens >= 1) {
    entry.tokens -= 1;
    return true;
  }

  return false;
}
