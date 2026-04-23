import { describe, it, expect } from "vitest";
import { sanitizeForEmbedding, planBatches } from "~~/server/utils/embeddings";
import { estimateTokenCount } from "~~/server/utils/chunker";

// =========================================================
// sanitizeForEmbedding
// =========================================================

describe("sanitizeForEmbedding", () => {
  it("空文字はプレースホルダ '-' に置換する", () => {
    expect(sanitizeForEmbedding("")).toBe("-");
  });

  it("空白のみもプレースホルダ '-' に置換する", () => {
    expect(sanitizeForEmbedding("   \t\n")).toBe("-");
  });

  it("短いテキストはそのまま返す", () => {
    const text = "これは短いテキストです";
    expect(sanitizeForEmbedding(text)).toBe(text);
  });

  it("閾値を超える日本語テキストは安全閾値の文字数に切り詰める", () => {
    // 2000 文字の日本語 ≒ 3000 トークン（安全閾値 1740 を超過）
    const text = "あ".repeat(2000);
    const result = sanitizeForEmbedding(text);
    // estimateMaxChars(SAFE_EMBEDDING_TOKENS=1740) = floor(1740/1.5) = 1160
    expect(result.length).toBe(1160);
    expect(result).toBe("あ".repeat(1160));
  });
});

// =========================================================
// planBatches
// =========================================================

describe("planBatches", () => {
  it("空配列は空バッチ配列を返す", () => {
    expect(planBatches([])).toEqual([]);
  });

  it("1 件は 1 バッチに入る", () => {
    expect(planBatches(["hello"])).toEqual([[0]]);
  });

  it("小さいテキスト 300 件はインスタンス数上限 250 で 2 バッチに分割される", () => {
    const texts = Array.from({ length: 300 }, () => "a");
    const batches = planBatches(texts);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(250);
    expect(batches[1]).toHaveLength(50);
    // インデックスの昇順が保たれている
    expect(batches[0][0]).toBe(0);
    expect(batches[0][249]).toBe(249);
    expect(batches[1][0]).toBe(250);
    expect(batches[1][49]).toBe(299);
  });

  it("合計トークンがリクエスト予算を超える場合はトークン上限で分割される", () => {
    // 1160 文字の日本語 = 1740 推定トークン（インスタンス単位の安全上限ちょうど）
    const heavy = "あ".repeat(1160);
    // リクエスト予算 18,000 トークン ÷ 1740 = 10.34 → 1 バッチに 10 件まで
    const texts = Array.from({ length: 20 }, () => heavy);
    const batches = planBatches(texts);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(10);
    expect(batches[1]).toHaveLength(10);
    // 合計トークンが予算内
    const sum0 = batches[0].reduce((s, i) => s + estimateTokenCount(texts[i]), 0);
    expect(sum0).toBeLessThanOrEqual(18_000);
  });

  it("単一要素が予算超過でも空バッチを作らず単独バッチに収める", () => {
    // 予算 18,000 を越えるテキスト（サニタイズ前提が崩れた場合の防御）
    const huge = "a ".repeat(20_000); // 20,000 words × 1.3 = 26,000 tokens
    const batches = planBatches([huge, "short"]);
    // huge 単独で 1 バッチ、short は次バッチ
    expect(batches).toHaveLength(2);
    expect(batches[0]).toEqual([0]);
    expect(batches[1]).toEqual([1]);
  });

  it("大小混合テキストでもインデックスの昇順を保ちつつ両制約を尊重する", () => {
    const heavy = "あ".repeat(1160); // ~1740 tokens
    const light = "a"; // ~2 tokens
    // 先頭に heavy 10 件 → 1 バッチ目で予算ちょうど、次の heavy で溢れる
    const texts = [
      ...Array.from({ length: 10 }, () => heavy),
      light,
      ...Array.from({ length: 10 }, () => heavy),
    ];
    const batches = planBatches(texts);
    // 全インデックスが重複なく昇順で含まれる
    const flat = batches.flat();
    expect(flat).toEqual(Array.from({ length: 21 }, (_, i) => i));
    // 各バッチの合計トークンが予算内
    for (const b of batches) {
      const sum = b.reduce((s, i) => s + estimateTokenCount(texts[i]), 0);
      expect(sum).toBeLessThanOrEqual(18_000);
      expect(b.length).toBeLessThanOrEqual(250);
    }
  });
});
