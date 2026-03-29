/**
 * CORS ミドルウェア
 * Widget から利用される公開 API パスに対して CORS を許可する
 *
 * Widget は任意のサードパーティサイトに埋め込まれるため、
 * 公開パスは全オリジンを無条件に許可する（セキュリティはレート制限と任意認証で担保）
 */
export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname;

  // 外部 Widget からアクセスされる公開パス
  const publicPaths = ["/embed/", "/api/chat/send", "/api/services", "/api/settings/form-url"];

  if (!publicPaths.some((p) => path.startsWith(p))) return;

  // Widget 公開 API は全オリジンを許可（file:// の null オリジン含む）
  setResponseHeaders(event, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-kotonoha-user-name, x-kotonoha-user-id",
    "Access-Control-Max-Age": "86400",
  });

  // プリフライトリクエストの処理
  if (getMethod(event) === "OPTIONS") {
    setResponseStatus(event, 204);
    return "";
  }
});
