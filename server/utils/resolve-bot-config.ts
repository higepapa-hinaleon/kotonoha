import type { BotConfig } from "~~/shared/types/models";
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_RAG_TOP_K,
  DEFAULT_RAG_SIMILARITY_THRESHOLD,
  DEFAULT_SYSTEM_PROMPT,
  MAX_SYSTEM_PROMPT_LENGTH,
} from "~~/server/utils/constants";

/**
 * サービス個別設定 → グループ設定 → デフォルト値 の順でフォールバック解決する
 */
export function resolveBotConfig(
  serviceBotConfig: Partial<BotConfig> | undefined,
  groupBotConfig: BotConfig | undefined,
): BotConfig {
  return {
    confidenceThreshold:
      serviceBotConfig?.confidenceThreshold ??
      groupBotConfig?.confidenceThreshold ??
      DEFAULT_CONFIDENCE_THRESHOLD,
    ragTopK: serviceBotConfig?.ragTopK ?? groupBotConfig?.ragTopK ?? DEFAULT_RAG_TOP_K,
    ragSimilarityThreshold:
      serviceBotConfig?.ragSimilarityThreshold ??
      groupBotConfig?.ragSimilarityThreshold ??
      DEFAULT_RAG_SIMILARITY_THRESHOLD,
    enableMultiQuery:
      serviceBotConfig?.enableMultiQuery ?? groupBotConfig?.enableMultiQuery ?? false,
    enableHyde: serviceBotConfig?.enableHyde ?? groupBotConfig?.enableHyde ?? false,
    systemPrompt:
      serviceBotConfig?.systemPrompt ?? groupBotConfig?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
  };
}

/**
 * botConfig のバリデーション（型チェック・数値クランプ・systemPrompt長制限）
 * 入力オブジェクトを直接書き換える（mutation）
 */
export function validateBotConfig(botConfig: Partial<BotConfig>): void {
  if (botConfig.confidenceThreshold !== undefined) {
    if (typeof botConfig.confidenceThreshold !== "number" || isNaN(botConfig.confidenceThreshold)) {
      throw createError({ statusCode: 400, statusMessage: "確信度しきい値は数値で指定してください" });
    }
    botConfig.confidenceThreshold = Math.max(0, Math.min(1, botConfig.confidenceThreshold));
  }
  if (botConfig.ragTopK !== undefined) {
    if (typeof botConfig.ragTopK !== "number" || isNaN(botConfig.ragTopK)) {
      throw createError({ statusCode: 400, statusMessage: "RAG検索件数は数値で指定してください" });
    }
    botConfig.ragTopK = Math.max(1, Math.min(100, Math.floor(botConfig.ragTopK)));
  }
  if (botConfig.ragSimilarityThreshold !== undefined) {
    if (
      typeof botConfig.ragSimilarityThreshold !== "number" ||
      isNaN(botConfig.ragSimilarityThreshold)
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: "類似度しきい値は数値で指定してください",
      });
    }
    botConfig.ragSimilarityThreshold = Math.max(
      0,
      Math.min(1, botConfig.ragSimilarityThreshold),
    );
  }
  if (botConfig.systemPrompt !== undefined) {
    if (typeof botConfig.systemPrompt !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "システムプロンプトは文字列で指定してください",
      });
    }
    if (botConfig.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
      throw createError({
        statusCode: 400,
        statusMessage: `システムプロンプトが長すぎます（上限${MAX_SYSTEM_PROMPT_LENGTH.toLocaleString()}文字）`,
      });
    }
  }
  if (botConfig.enableMultiQuery !== undefined && typeof botConfig.enableMultiQuery !== "boolean") {
    throw createError({
      statusCode: 400,
      statusMessage: "enableMultiQuery はブール値で指定してください",
    });
  }
  if (botConfig.enableHyde !== undefined && typeof botConfig.enableHyde !== "boolean") {
    throw createError({
      statusCode: 400,
      statusMessage: "enableHyde はブール値で指定してください",
    });
  }
}

/**
 * botConfig から許可されたキーのみを抽出する（ホワイトリスト方式）
 */
export function sanitizeBotConfig(botConfig: Partial<BotConfig>): Partial<BotConfig> {
  const sanitized: Partial<BotConfig> = {};
  if (botConfig.confidenceThreshold !== undefined)
    sanitized.confidenceThreshold = botConfig.confidenceThreshold;
  if (botConfig.ragTopK !== undefined) sanitized.ragTopK = botConfig.ragTopK;
  if (botConfig.ragSimilarityThreshold !== undefined)
    sanitized.ragSimilarityThreshold = botConfig.ragSimilarityThreshold;
  if (botConfig.enableMultiQuery !== undefined)
    sanitized.enableMultiQuery = botConfig.enableMultiQuery;
  if (botConfig.enableHyde !== undefined) sanitized.enableHyde = botConfig.enableHyde;
  if (botConfig.systemPrompt !== undefined) sanitized.systemPrompt = botConfig.systemPrompt;
  return sanitized;
}
