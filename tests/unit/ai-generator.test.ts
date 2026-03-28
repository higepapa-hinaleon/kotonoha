import { describe, it, expect, vi } from "vitest";

// getGenerativeModel をモック
vi.mock("~~/server/utils/vertex-ai", () => ({
  getGenerativeModel: vi.fn(() => ({
    generateContent: vi.fn(),
  })),
}));

// Nitro の createError をモック
vi.stubGlobal("createError", (opts: { statusCode: number; statusMessage: string }) => {
  const err = new Error(opts.statusMessage) as Error & { statusCode: number };
  err.statusCode = opts.statusCode;
  return err;
});

import { generateStructuredJson } from "~~/server/utils/ai-generator";
import { getGenerativeModel } from "~~/server/utils/vertex-ai";

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

describe("generateStructuredJson", () => {
  it("直接JSONレスポンスをパースする", async () => {
    mockGeminiResponse('{"items": [1, 2, 3]}');

    const result = await generateStructuredJson<{ items: number[] }>("prompt", "message");
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it("```json ブロック付きレスポンスをパースする", async () => {
    mockGeminiResponse('Here is the result:\n```json\n{"name": "test"}\n```');

    const result = await generateStructuredJson<{ name: string }>("prompt", "message");
    expect(result).toEqual({ name: "test" });
  });

  it("不正なJSONでエラーをスローする", async () => {
    mockGeminiResponse("This is not JSON at all, just plain text without braces.");

    await expect(generateStructuredJson("prompt", "message")).rejects.toThrow(
      "AIからの応答をJSON形式で解析できませんでした",
    );
  });

  it("空のレスポンスでエラーをスローする", async () => {
    const mock = getGenerativeModel as ReturnType<typeof vi.fn>;
    mock.mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: { candidates: [] },
      }),
    });

    await expect(generateStructuredJson("prompt", "message")).rejects.toThrow();
  });

  it("systemPromptとuserMessageをGeminiに渡す", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      response: {
        candidates: [{ content: { parts: [{ text: '{"ok": true}' }] } }],
      },
    });

    const mock = getGenerativeModel as ReturnType<typeof vi.fn>;
    mock.mockReturnValue({ generateContent });

    await generateStructuredJson("system instruction", "user input");

    expect(generateContent).toHaveBeenCalledWith({
      systemInstruction: { role: "system", parts: [{ text: "system instruction" }] },
      contents: [{ role: "user", parts: [{ text: "user input" }] }],
    });
  });
});
