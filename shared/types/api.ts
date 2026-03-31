// ==================================================
// API リクエスト / レスポンス型定義
// ==================================================

/** ページネーションパラメータ */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/** ページネーション付きレスポンス */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/** チャットメッセージ送信リクエスト */
export interface ChatSendRequest {
  conversationId?: string;
  serviceId: string;
  message: string;
}

/** チャットメッセージ送信レスポンス */
export interface ChatSendResponse {
  conversationId: string;
  message: {
    id: string;
    content: string;
    sources: import("./models").MessageSource[];
    confidence: number;
  };
  formUrl?: string; // 確信度が低い場合のみ返却
}

/** チャットフィードバックリクエスト */
export interface ChatFeedbackRequest {
  conversationId: string;
  messageId: string;
  feedback: "positive" | "negative";
}

/** ドキュメントアップロードリクエスト（multipart/form-data） */
export interface DocumentUploadMeta {
  serviceId: string;
  title: string;
  type: "business" | "system";
}

/** サービス作成・更新リクエスト */
export interface ServiceUpsertRequest {
  name: string;
  description: string;
  isActive?: boolean;
  googleFormUrl?: string;
  botConfig?: Partial<import("./models").BotConfig> | null;
}

/** 改善要望更新リクエスト */
export interface ImprovementUpdateRequest {
  category?: "missing_docs" | "unclear_docs" | "new_feature" | "other";
  priority?: "high" | "medium" | "low";
  status?: "open" | "in_progress" | "resolved" | "dismissed";
  adminNote?: string;
  correctedAnswer?: string;
}

/** FAQ作成・更新リクエスト */
export interface FaqUpsertRequest {
  serviceId: string;
  question: string;
  answer: string;
  isPublished?: boolean;
}

/** 設定更新リクエスト */
export interface SettingsUpdateRequest {
  googleFormUrl?: string;
  botConfig?: Partial<import("./models").BotConfig>;
}

/** 組織更新リクエスト */
export interface OrganizationUpdateRequest {
  name?: string;
  plan?: import("../plans").PlanId;
}

/** 契約作成・更新リクエスト */
export interface ContractUpsertRequest {
  planId: import("../plans").PlanId;
  status?: import("./models").ContractStatus;
  paymentMethod?: import("./models").PaymentMethod;
  stripeSubscriptionId?: string;
  startDate: string;
  endDate: string;
  note?: string;
}

/** 利用申請送信リクエスト */
export interface ApplicationSubmitRequest {
  organizationType: import("./models").OrganizationType;
  organizationName: string;
  contactName: string;
  address?: string;
  phone?: string;
  tradeName?: string;
  representativeName?: string;
  corporateNumber?: string;
  planId: import("../plans").PlanId;
  paymentMethod: import("./models").PaymentMethod;
  /** 同意した利用規約バージョン */
  termsVersion?: string;
  /** 同意したプライバシーポリシーバージョン */
  privacyVersion?: string;
}

/** 利用申請レビューリクエスト */
export interface ApplicationReviewRequest {
  reviewNote?: string;
}

/** ダッシュボード集計レスポンス */
export interface DashboardSummary {
  totalConversations: number;
  resolutionRate: number;
  improvementRequestCount: number;
  conversationTrend: { date: string; count: number }[];
  serviceDistribution: {
    serviceId: string;
    serviceName: string;
    count: number;
    resolutionRate: number;
  }[];
  recentUnresolved: { id: string; title: string; createdAt: string }[];
  topReferencedDocs: { id: string; title: string; referenceCount: number; serviceId: string }[];
  unreferencedDocCount: number;
  unreferencedDocs: { id: string; title: string; serviceId: string }[];
}

/** サービス別ダッシュボード集計レスポンス */
export interface ServiceDashboardSummary {
  serviceId: string;
  serviceName: string;
  totalConversations: number;
  resolutionRate: number;
  improvementRequestCount: number;
  conversationTrend: { date: string; count: number }[];
  recentUnresolved: { id: string; title: string; createdAt: string }[];
}

/** 会話検索フィルタ */
export interface ConversationFilter extends PaginationParams {
  serviceId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

/** 組織利用状況サマリー */
export interface OrganizationUsage {
  users: number;
  groups: number;
  services: number;
  documents: number;
  monthlyChats: number;
  limits: import("../plans").PlanFeatureLimits;
}

/** 組織名付きグループ（プラットフォーム管理者向け） */
export type GroupWithOrg = import("./models").Group & {
  organizationName?: string;
};
