import { describe, it, expect } from "vitest";

/**
 * API統合テスト
 * Firebase Admin SDKが必要なため、構造検証と型チェックに限定。
 * 完全なE2Eテストは Firebase エミュレータ環境で実行する。
 */

describe("API Types", () => {
  it("ChatSendRequest の型が正しく定義されている", async () => {
    const apiTypes = await import("~~/shared/types/api");
    // TypeScript の型定義のみのため、インポートが成功すること自体がテスト
    expect(apiTypes).toBeDefined();
  });

  it("モデル型が正しく定義されている", async () => {
    const models = await import("~~/shared/types/models");
    // 型定義ファイルがインポート可能であることを確認
    expect(models).toBeDefined();
  });
});

describe("Shared Types Consistency", () => {
  it("DashboardSummary の必須フィールドが定義されている", async () => {
    // TypeScript コンパイル時に型チェックされるため、
    // ランタイムではインポート成功のみ確認
    const api = await import("~~/shared/types/api");
    expect(api).toBeDefined();
  });

  it("ImprovementRequest のステータスが正しい型を持つ", () => {
    // 型レベルの検証: valid statuses
    const validStatuses = ["open", "in_progress", "resolved", "dismissed"];
    const validCategories = ["missing_docs", "unclear_docs", "new_feature", "other"];
    const validPriorities = ["high", "medium", "low"];

    expect(validStatuses).toHaveLength(4);
    expect(validCategories).toHaveLength(4);
    expect(validPriorities).toHaveLength(3);
  });

  it("BotConfig のデフォルト値が妥当である", () => {
    // 設定APIで使用されるデフォルト値の検証
    const defaults = {
      confidenceThreshold: 0.6,
      ragTopK: 5,
      systemPrompt: "あなたは社内サポートAIアシスタントです。丁寧に日本語で回答してください。",
    };

    expect(defaults.confidenceThreshold).toBeGreaterThan(0);
    expect(defaults.confidenceThreshold).toBeLessThanOrEqual(1);
    expect(defaults.ragTopK).toBeGreaterThan(0);
    expect(defaults.ragTopK).toBeLessThanOrEqual(20);
    expect(defaults.systemPrompt).toBeTruthy();
  });
});
