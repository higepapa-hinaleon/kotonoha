// ==================================================
// サーバーサイド共通定数 (Single Source of Truth)
// ==================================================

/** ボット設定デフォルト値 */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;
export const DEFAULT_RAG_TOP_K = 5;
export const DEFAULT_RAG_SIMILARITY_THRESHOLD = 0.4;
export const DEFAULT_SYSTEM_PROMPT = `あなたは社内サポートボットです。以下のルールに従って回答してください：

1. 提供された参考情報のみに基づいて回答してください
2. 参考情報に該当する内容がない場合は、正直に「この質問に対する十分な情報が見つかりませんでした」と回答してください
3. 丁寧な日本語で回答してください
4. 必要に応じて箇条書きや手順を使って分かりやすく回答してください
5. 提供された全ての参考情報を等しく活用して回答してください。情報の出典元や種別を回答内で区別したり言及したりしないでください`;

/** Firestore バッチ操作上限 (500 - バッファ) */
export const BATCH_SIZE_LIMIT = 490;

/** ファイルアップロード上限 (10MB) */
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

/** 許可 MIME タイプ */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  "application/octet-stream",
] as const;

/** コンテキストプレフィックス: 1回のGeminiコールで処理するチャンク数 */
export const CONTEXT_PREFIX_BATCH_SIZE = 15;

/** コンテキストプレフィックス: この数以上のチャンクはドキュメント要約を共通プレフィックスとして使用 */
export const CONTEXT_GENERATION_CHUNK_LIMIT = 200;

/** 外部 API タイムアウト (30秒) */
export const EXTERNAL_API_TIMEOUT_MS = 30_000;

/** チャットメッセージ最大長 */
export const MAX_CHAT_MESSAGE_LENGTH = 10_000;

/** 会話タイトル最大長 */
export const MAX_CONVERSATION_TITLE_LENGTH = 50;

/** 会話履歴取得件数 */
export const CHAT_HISTORY_LIMIT = 10;

/** フィードバック RAG 検索件数 */
export const FEEDBACK_RAG_TOP_K = 3;

/** フィードバック Firestore フォールバック件数 */
export const FEEDBACK_FALLBACK_LIMIT = 5;

/** システムプロンプト最大長 */
export const MAX_SYSTEM_PROMPT_LENGTH = 10_000;

/** エスカレーション意図キーワード（ユーザーが明示的に人間対応・問い合わせを求めるフレーズ） */
export const ESCALATION_KEYWORDS = [
  "人間につなぎたい",
  "人間に繋ぎたい",
  "人間につないで",
  "人間に繋いで",
  "人につないで",
  "人に繋いで",
  "担当者につないで",
  "担当者に繋いで",
  "お問い合わせ窓口",
  "問い合わせ窓口",
  "お問い合わせしたい",
  "問い合わせしたい",
  "お問い合わせフォーム",
  "スプレッドシートに案内",
  "スプレッドシートを教えて",
  "スプレッドシート",
  "人間に対応してほしい",
  "人間対応",
  "オペレーターに繋いで",
  "オペレーターにつないで",
];

/** チャット API レート制限 */
export const CHAT_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60_000, // 1分
} as const;

/** フィードバック API レート制限 */
export const FEEDBACK_RATE_LIMIT = {
  maxRequests: 30,
  windowMs: 60_000, // 1分
} as const;

/** 一般 API レート制限 */
export const DEFAULT_RATE_LIMIT = {
  maxRequests: 60,
  windowMs: 60_000,
} as const;

/** Embedding L2 キャッシュ TTL (30日) */
export const L2_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** レポート保持期間 (90日) */
export const REPORT_RETENTION_DAYS = 90;
