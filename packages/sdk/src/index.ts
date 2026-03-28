export type {
  kotonohaChatClientOptions,
  ChatMessage,
  ChatSendRequest,
  ChatSendResponse,
  MessageSource,
  Service,
} from "./types";

import type { kotonohaChatClientOptions, ChatSendResponse, Service } from "./types";

/**
 * kotonoha AI チャット SDK クライアント
 *
 * @example
 * ```ts
 * const client = new kotonohaChatClient({ baseUrl: "https://your-app.example.com" });
 * const services = await client.getServices();
 * const response = await client.sendMessage({
 *   serviceId: services[0].id,
 *   message: "有給の申請方法は？",
 * });
 * ```
 */
export class kotonohaChatClient {
  private baseUrl: string;
  private authToken?: string;
  private userName?: string;
  private userId?: string;

  constructor(options: kotonohaChatClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.authToken = options.authToken;
    this.userName = options.userName;
    this.userId = options.userId;
  }

  /** 認証トークンを更新する */
  setAuthToken(token: string | undefined): void {
    this.authToken = token;
  }

  /** ユーザー情報を更新する */
  setUserInfo(info: { userName?: string; userId?: string }): void {
    this.userName = info.userName;
    this.userId = info.userId;
  }

  /** 利用可能なサービス一覧を取得する */
  async getServices(options?: { groupId?: string }): Promise<Service[]> {
    const params = new URLSearchParams();
    if (options?.groupId) params.set("groupId", options.groupId);
    const query = params.toString();
    const res = await this.fetch<Service[]>(`/api/services${query ? `?${query}` : ""}`);
    return res.filter((s) => s.isActive);
  }

  /** チャットメッセージを送信する */
  async sendMessage(params: {
    serviceId: string;
    message: string;
    conversationId?: string;
  }): Promise<ChatSendResponse> {
    return this.fetch<ChatSendResponse>("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: params.serviceId,
        message: params.message,
        conversationId: params.conversationId,
      }),
    });
  }

  /** フォーム URL を取得する */
  async getFormUrl(serviceId: string): Promise<string> {
    const res = await this.fetch<{ formUrl: string }>(
      `/api/settings/form-url?serviceId=${encodeURIComponent(serviceId)}`,
    );
    return res.formUrl || "";
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string>),
    };
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }
    if (this.userName) {
      headers["X-kotonoha-User-Name"] = this.sanitizeHeaderValue(this.userName);
    }
    if (this.userId) {
      headers["X-kotonoha-User-Id"] = this.sanitizeHeaderValue(this.userId);
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`kotonohaChatClient: ${res.status} ${res.statusText} - ${body}`);
    }

    return res.json() as Promise<T>;
  }

  /** ヘッダー値のサニタイズ（CRLF除去・長さ制限） */
  private sanitizeHeaderValue(value: string): string {
    return value.replace(/[\r\n\0<>]/g, "").slice(0, 200);
  }
}
