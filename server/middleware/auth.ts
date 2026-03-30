/**
 * サーバー側認証ミドルウェア
 * /api/ パスのリクエストに対して認証チェックを行う
 * 除外パス: /api/auth/register (新規登録は認証トークンのみで可)
 */
export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname;

  // API以外のパスはスキップ
  if (!path.startsWith("/api/")) return;

  // 認証不要のパス（ゲストアクセス可）をスキップ
  const publicPaths = [
    "/api/auth/register",
    "/api/services",
    "/api/settings/form-url",
    "/api/chat/send",
    "/api/health",
    "/api/stripe/webhook",
  ];
  if (publicPaths.includes(path)) return;
  // /api/services?groupId=xxx 等のクエリ付きパスもスキップ
  if (path.startsWith("/api/services")) return;
  // 法的文書API（認証不要）
  if (path.startsWith("/api/legal")) return;

  // Authorization ヘッダーの存在チェック（詳細な検証は各ハンドラーで実施）
  const authorization = getHeader(event, "authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw createError({ statusCode: 401, statusMessage: "認証が必要です" });
  }
});
