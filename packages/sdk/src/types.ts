/** メッセージの参照元 */
export interface MessageSource {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  chunkContent: string;
  similarity: number;
}

/** チャット送信リクエスト */
export interface ChatSendRequest {
  conversationId?: string;
  serviceId: string;
  message: string;
}

/** チャット送信レスポンス */
export interface ChatSendResponse {
  conversationId: string;
  message: {
    content: string;
    sources: MessageSource[];
    confidence: number;
  };
  formUrl?: string;
}

/** サービス */
export interface Service {
  id: string;
  organizationId: string;
  groupId: string;
  name: string;
  description: string;
  isActive: boolean;
  googleFormUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** SDK 初期化オプション */
export interface kotonohaChatClientOptions {
  /** API のベース URL (例: https://your-app.example.com) */
  baseUrl: string;
  /** Firebase ID トークン（認証済みユーザーの場合） */
  authToken?: string;
  /** ウィジェット利用時のユーザー表示名（適用先アプリから渡す） */
  userName?: string;
  /** ウィジェット利用時の外部ユーザーID（適用先アプリから渡す） */
  userId?: string;
}

/** チャットメッセージ（SDK 内部用） */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: MessageSource[];
  confidence?: number | null;
  formUrl?: string;
}
