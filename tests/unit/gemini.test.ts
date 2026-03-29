import { describe, it, expect, vi } from "vitest";

// getGenerativeModel をモック
vi.mock("~~/server/utils/vertex-ai", () => ({
  getGenerativeModel: vi.fn(() => ({
    generateContent: vi.fn(),
  })),
}));

// buildContextFromResults をモック
vi.mock("~~/server/utils/rag", () => ({
  buildContextFromResults: vi.fn(() => "mocked context"),
}));

// eslint-disable-next-line import/first
import { getGenerativeModel } from "~~/server/utils/vertex-ai";
// eslint-disable-next-line import/first
import { generateChatResponse } from "~~/server/utils/gemini";

function mockGeminiResponse(text: string) {
  const mock = getGenerativeModel as ReturnType<typeof vi.fn>;
  mock.mockReturnValue({
    generateContent: vi.fn().mockResolvedValue({
      response: {
        candidates: [{ content: { parts: [{ text }] } }],
      },
    }),
  });
}

describe("generateChatResponse", () => {
  it("通常の回答と確信度を返す", async () => {
    mockGeminiResponse("これはテスト回答です。[CONFIDENCE:0.85]");

    const result = await generateChatResponse("テスト質問", []);
    expect(result.content).toBe("これはテスト回答です。");
    expect(result.confidence).toBe(0.85);
  });

  it("確信度タグがない場合はデフォルト値0.5を返す", async () => {
    mockGeminiResponse("タグなしの回答です。");

    const result = await generateChatResponse("質問", []);
    expect(result.content).toBe("タグなしの回答です。");
    expect(result.confidence).toBe(0.5);
  });

  it("確信度0.0を正しく抽出する", async () => {
    mockGeminiResponse("回答[CONFIDENCE:0.00]");

    const result = await generateChatResponse("質問", []);
    expect(result.confidence).toBe(0);
  });

  it("確信度1.0を正しく抽出する", async () => {
    mockGeminiResponse("回答[CONFIDENCE:1.0]");

    const result = await generateChatResponse("質問", []);
    expect(result.confidence).toBe(1.0);
  });

  it("回答テキストから確信度タグを除去する", async () => {
    mockGeminiResponse("回答テキスト[CONFIDENCE:0.75]末尾");

    const result = await generateChatResponse("質問", []);
    expect(result.content).toBe("回答テキスト末尾");
    expect(result.content).not.toContain("[CONFIDENCE:");
  });

  it("空のレスポンスを処理する", async () => {
    const mock = getGenerativeModel as ReturnType<typeof vi.fn>;
    mock.mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: { candidates: [] },
      }),
    });

    const result = await generateChatResponse("質問", []);
    expect(result.content).toBe("");
    expect(result.confidence).toBe(0.5);
  });
});
