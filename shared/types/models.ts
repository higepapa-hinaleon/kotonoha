// ==================================================
// Firestore モデル型定義 (Phase 4 データ設計準拠)
// ==================================================

import type { PlanId } from "../plans";

/** 組織区分 */
export type OrganizationType = "individual" | "sole_proprietor" | "corporation";

/** 組織 */
export interface Organization {
  id: string;
  name: string;
  plan: PlanId;
  /** 契約者区分 */
  organizationType?: OrganizationType;
  /** 担当者名（個人の場合は本人名） */
  contactName?: string;
  /** 住所 */
  address?: string;
  /** 電話番号 */
  phone?: string;
  /** 屋号（個人事業主の場合） */
  tradeName?: string;
  /** 代表者名（法人の場合） */
  representativeName?: string;
  /** 法人番号（法人の場合、任意） */
  corporateNumber?: string;
  /** Stripe顧客ID */
  stripeCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

/** 契約ステータス */
export type ContractStatus = "active" | "suspended" | "expired" | "cancelled" | "pending_payment";

/** 支払方法 */
export type PaymentMethod = "stripe" | "bank_transfer" | "none";

/** 契約 */
export interface Contract {
  id: string;
  organizationId: string;
  planId: PlanId;
  status: ContractStatus;
  paymentMethod: PaymentMethod;
  /** Stripeサブスクリプション ID */
  stripeSubscriptionId?: string;
  startDate: string;
  endDate: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

/** グループ（Organization 配下の部門・チーム単位） */
export interface Group {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** ユーザーとグループの紐付け（ドキュメントID: `${userId}_${groupId}`） */
export interface UserGroupMembership {
  id: string;
  userId: string;
  groupId: string;
  organizationId: string;
  role: "admin" | "member";
  createdAt: string;
  updatedAt: string;
}

/** ユーザーのシステムロール */
export type UserRole = "owner" | "system_admin" | "org_admin" | "user";

/** ユーザー */
export interface User {
  id: string;
  /** 所属組織ID（無所属の場合は空文字） */
  organizationId: string;
  email: string;
  displayName: string;
  role: UserRole;
  activeGroupId?: string;
  /** 利用規約・プライバシーポリシーへの同意日時 (ISO 8601) */
  consentAcceptedAt?: string;
  /** 同意した規約バージョン */
  consentVersion?: string;
  createdAt: string;
  updatedAt: string;
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

/** ドキュメント */
export interface Document {
  id: string;
  organizationId: string;
  groupId: string;
  serviceId: string;
  title: string;
  type: "business" | "system";
  tags: string[];
  storagePath: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  chunkCount: number;
  version: number;
  status: "uploading" | "processing" | "ready" | "error";
  uploadedBy: string;
  referenceCount: number;
  createdAt: string;
  updatedAt: string;
}

/** ドキュメントチャンク */
export interface DocumentChunk {
  id: string;
  organizationId: string;
  groupId: string;
  documentId: string;
  serviceId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embedding: number[]; // 768次元ベクトル
  contextPrefix?: string;
  documentTitle?: string;
  documentType?: "business" | "system";
  tags?: string[];
  sectionTitle?: string;
  parentContent?: string;
  parentChunkIndex?: number;
  createdAt: string;
}

/** 会話 */
export interface Conversation {
  id: string;
  organizationId: string;
  groupId: string;
  userId: string;
  serviceId: string;
  title: string;
  status: "active" | "resolved_by_bot" | "escalated" | "closed";
  messageCount: number;
  /** ウィジェット経由の外部ユーザー表示名 */
  externalUserName?: string;
  /** ウィジェット経由の外部ユーザーID */
  externalUserId?: string;
  createdAt: string;
  updatedAt: string;
}

/** メッセージ */
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: MessageSource[];
  confidence: number | null;
  feedback?: "positive" | "negative" | null;
  createdAt: string;
}

/** メッセージの参照元 */
export interface MessageSource {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  chunkContent: string;
  similarity: number;
}

/** 改善要望 */
export interface ImprovementRequest {
  id: string;
  organizationId: string;
  groupId: string;
  serviceId: string;
  conversationId: string;
  category: "missing_docs" | "unclear_docs" | "new_feature" | "other";
  summary: string;
  originalQuestion?: string;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "resolved" | "dismissed";
  adminNote: string;
  correctedAnswer: string;
  createdAt: string;
  updatedAt: string;
}

/** FAQ */
export interface Faq {
  id: string;
  organizationId: string;
  groupId: string;
  serviceId: string;
  question: string;
  answer: string;
  frequency: number;
  isPublished: boolean;
  embedding: number[]; // 768次元ベクトル
  generatedFrom: "auto" | "manual";
  createdAt: string;
  updatedAt: string;
}

/** 週次レポート */
export interface WeeklyReport {
  id: string;
  organizationId: string;
  groupId: string;
  periodStart: string;
  periodEnd: string;
  stats: ReportStats;
  insights: string[];
  recommendations: string[];
  createdAt: string;
}

/** レポート統計 */
export interface ReportStats {
  totalConversations: number;
  resolvedByBot: number;
  escalated: number;
  resolutionRate: number;
  averageConfidence: number;
  topServices: { serviceId: string; serviceName: string; count: number }[];
  improvementRequestCount: number;
}

/** 設定 */
export interface Settings {
  id: string;
  organizationId: string;
  groupId: string;
  googleFormUrl: string;
  botConfig: BotConfig;
  updatedAt: string;
}

/** フィードバックチャンク（改善回答の埋め込みベクトル） */
export interface FeedbackChunk {
  id: string;
  organizationId: string;
  groupId: string;
  serviceId: string;
  improvementId: string;
  question: string;
  correctedAnswer: string;
  embedding: number[]; // 768次元ベクトル
  createdAt: string;
  updatedAt: string;
}

/** 招待 */
export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  groupId: string;
  role: "admin" | "member";
  invitedBy: string;
  status: "pending" | "accepted";
  createdAt: string;
  updatedAt: string;
}

/** ボット設定 */
export interface BotConfig {
  confidenceThreshold: number;
  ragTopK: number;
  ragSimilarityThreshold: number;
  enableMultiQuery: boolean;
  enableHyde: boolean;
  systemPrompt: string;
}

/** 利用申請ステータス */
export type ApplicationStatus = "pending" | "approved" | "rejected";

/** 利用申請 */
export interface Application {
  id: string;
  /** 申請者のユーザーID */
  applicantUserId: string;
  /** 申請者のメールアドレス */
  applicantEmail: string;

  // === 契約者情報 ===
  /** 契約者区分 */
  organizationType: OrganizationType;
  /** 組織名（法人名 / 屋号 / 個人名） */
  organizationName: string;
  /** 担当者名 */
  contactName: string;
  /** 住所 */
  address: string;
  /** 電話番号 */
  phone: string;
  /** 屋号（個人事業主の場合） */
  tradeName?: string;
  /** 代表者名（法人の場合） */
  representativeName?: string;
  /** 法人番号（法人の場合、任意） */
  corporateNumber?: string;

  // === プラン・支払い ===
  planId: PlanId;
  paymentMethod: PaymentMethod;
  /** Stripe顧客ID */
  stripeCustomerId?: string;
  /** Stripe SetupIntent ID */
  stripeSetupIntentId?: string;
  /** Stripe PaymentMethod ID（setupモードで取得） */
  stripePaymentMethodId?: string;
  /** Stripe Checkoutセッション ID */
  stripeCheckoutSessionId?: string;

  // === 同意 ===
  termsAcceptedAt: string;
  privacyPolicyAcceptedAt: string;

  // === ステータス ===
  status: ApplicationStatus;
  /** 審査者のユーザーID */
  reviewedBy?: string;
  /** 審査コメント */
  reviewNote?: string;
  /** 承認後に作成された組織ID */
  organizationId?: string;
  /** 承認後に作成された契約ID */
  contractId?: string;

  createdAt: string;
  updatedAt: string;
}
