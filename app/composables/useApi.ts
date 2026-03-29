import type { FetchOptions } from "ofetch";
import { FetchError } from "ofetch";

/**
 * API呼び出しヘルパー
 * 認証済みの場合は Authorization ヘッダーに Firebase IDトークンを自動付与する
 * 未認証（ゲスト）の場合はトークンなしでリクエストする
 * エラー時はトースト通知を自動表示する
 */
export function useApi() {
  const { getIdToken, isAuthenticated } = useAuth();
  const { show } = useNotification();

  async function apiFetch<T>(url: string, options: FetchOptions = {}): Promise<T> {
    const headers: Record<string, string> = {};

    if (isAuthenticated.value) {
      try {
        const token = await getIdToken();
        headers.Authorization = `Bearer ${token}`;
      } catch {
        // ゲストモード: トークンなしで続行
      }

      // アクティブグループIDをヘッダーに自動付与
      const { activeGroupId } = useGroup();
      if (activeGroupId.value) {
        headers["X-Group-Id"] = activeGroupId.value;
      }
    }

    try {
      return (await $fetch(url, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(options as any),
        headers: {
          ...options.headers,
          ...headers,
        },
      })) as T;
    } catch (error) {
      if (error instanceof FetchError) {
        const status = error.response?.status;
        if (status && status >= 400 && status < 500) {
          const serverMessage = error.data?.statusMessage || error.data?.message;
          show(
            serverMessage || "リクエストに問題がありました。入力内容を確認してください。",
            "error",
          );
        } else if (status && status >= 500) {
          show("サーバーエラーが発生しました。しばらく経ってからお試しください。", "error");
        } else {
          show("ネットワーク接続を確認してください。", "error");
        }
      } else {
        show("予期しないエラーが発生しました。", "error");
      }
      throw error;
    }
  }

  return { apiFetch };
}
