import { describe, it, expect } from "vitest";
import {
  estimateTokenCount,
  splitTextIntoChunks,
  extractText,
} from "~~/server/utils/chunker";

describe("estimateTokenCount", () => {
  it("日本語テキストのトークン数を推定する", () => {
    const text = "こんにちは世界";
    const count = estimateTokenCount(text);
    // 7文字 × 1.5 = 10.5 → 11
    expect(count).toBe(11);
  });

  it("英語テキストのトークン数を推定する", () => {
    const text = "hello world";
    const count = estimateTokenCount(text);
    // 2単語 × 1.3 = 2.6 → 3
    expect(count).toBe(3);
  });

  it("日英混合テキストを処理する", () => {
    const text = "これはtest textです";
    const count = estimateTokenCount(text);
    // 日本語4文字(これは, です) × 1.5 + 英語2単語 × 1.3
    expect(count).toBeGreaterThan(0);
  });

  it("空文字列は0を返す", () => {
    expect(estimateTokenCount("")).toBe(0);
  });
});

describe("splitTextIntoChunks", () => {
  it("空テキストは空配列を返す", () => {
    expect(splitTextIntoChunks("")).toEqual([]);
    expect(splitTextIntoChunks("   ")).toEqual([]);
  });

  it("短いテキストは1チャンクになる", () => {
    const chunks = splitTextIntoChunks("短いテキスト");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("短いテキスト");
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it("段落境界でチャンクを分割する", () => {
    // 各段落がmaxTokensに近いテキストを作成
    const para1 = "あ".repeat(200);
    const para2 = "い".repeat(200);
    const text = `${para1}\n\n${para2}`;

    const chunks = splitTextIntoChunks(text, { maxTokens: 350, overlapTokens: 50 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("chunkIndexが連番になる", () => {
    const text = Array(5)
      .fill("あ".repeat(200))
      .join("\n\n");

    const chunks = splitTextIntoChunks(text, { maxTokens: 350, overlapTokens: 50 });
    chunks.forEach((chunk, i) => {
      expect(chunk.chunkIndex).toBe(i);
    });
  });

  it("各チャンクのtokenCountが設定される", () => {
    const chunks = splitTextIntoChunks("テストテキスト");
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });
});

describe("extractText", () => {
  it("text/plain のバッファからテキストを抽出する", async () => {
    const buffer = Buffer.from("Hello World", "utf-8");
    const text = await extractText(buffer, "text/plain");
    expect(text).toBe("Hello World");
  });

  it("text/markdown のバッファからテキストを抽出する", async () => {
    const buffer = Buffer.from("# Title\n\nContent", "utf-8");
    const text = await extractText(buffer, "text/markdown");
    expect(text).toBe("# Title\n\nContent");
  });

  it("未対応のMIMEタイプでエラーをスローする", async () => {
    const buffer = Buffer.from("data");
    await expect(extractText(buffer, "image/png")).rejects.toThrow("未対応のファイル形式");
  });
});
