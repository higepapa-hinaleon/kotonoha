// ==================================================
// プラン定義 (Single Source of Truth)
// ランディングページ・バックオフィス・バックエンドで共用
// ==================================================

export type PlanId = "free" | "starter" | "business" | "enterprise";

/** プランごとのリソース上限 (-1 = 無制限) */
export interface PlanFeatureLimits {
  maxGroups: number;
  maxServices: number;
  maxDocuments: number;
  maxMonthlyChats: number;
  maxUsers: number;
  maxWidgetSites: number;
}

/** プランごとの機能フラグ */
export interface PlanFeatureFlags {
  faqAutoGeneration: boolean;
  weeklyReports: boolean;
  ragDiagnostics: boolean;
  customSso: boolean;
}

/** プラン定義 */
export interface PlanDefinition {
  id: PlanId;
  displayName: string;
  /** 表示用価格文字列 */
  price: string;
  /** 月額料金（円）。0 = 無料、-1 = 個別見積 */
  priceMonthly: number;
  description: string;
  limits: PlanFeatureLimits;
  features: PlanFeatureFlags;
  /** Stripe Price ID（環境変数で上書き可能） */
  stripePriceId: string;
  /** ランディングページでハイライト表示するか */
  highlighted: boolean;
  /** ランディングページ表示用の機能リスト */
  landingFeatures: string[];
}

export const PLAN_DEFINITIONS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    displayName: "Free",
    price: "0",
    priceMonthly: 0,
    description: "まずは無料でお試し",
    stripePriceId: "",
    limits: {
      maxGroups: 1,
      maxServices: 1,
      maxDocuments: 10,
      maxMonthlyChats: 50,
      maxUsers: 2,
      maxWidgetSites: 0,
    },
    features: {
      faqAutoGeneration: false,
      weeklyReports: false,
      ragDiagnostics: false,
      customSso: false,
    },
    highlighted: false,
    landingFeatures: [
      "グループ数: 1",
      "サービス数: 1",
      "ドキュメント: 10件",
      "月間チャット: 50回",
      "ユーザー数: 2",
      "メールサポート",
    ],
  },
  starter: {
    id: "starter",
    displayName: "Starter",
    price: "50,000",
    priceMonthly: 50000,
    description: "まず試したい中小企業・スタートアップ向け",
    stripePriceId: "",
    limits: {
      maxGroups: 1,
      maxServices: 3,
      maxDocuments: 100,
      maxMonthlyChats: 1_000,
      maxUsers: 5,
      maxWidgetSites: 1,
    },
    features: {
      faqAutoGeneration: false,
      weeklyReports: false,
      ragDiagnostics: false,
      customSso: false,
    },
    highlighted: false,
    landingFeatures: [
      "グループ数: 1",
      "サービス数: 3",
      "ドキュメント: 100件",
      "月間チャット: 1,000回",
      "ユーザー数: 5",
      "メールサポート",
    ],
  },
  business: {
    id: "business",
    displayName: "Business",
    price: "150,000",
    priceMonthly: 150000,
    description: "本格導入する中堅企業向け",
    stripePriceId: "",
    limits: {
      maxGroups: 5,
      maxServices: 10,
      maxDocuments: 500,
      maxMonthlyChats: 10_000,
      maxUsers: 20,
      maxWidgetSites: 5,
    },
    features: {
      faqAutoGeneration: true,
      weeklyReports: true,
      ragDiagnostics: true,
      customSso: false,
    },
    highlighted: true,
    landingFeatures: [
      "グループ数: 5",
      "サービス数: 10",
      "ドキュメント: 500件",
      "月間チャット: 10,000回",
      "ユーザー数: 20",
      "FAQ自動生成",
      "レポート",
      "RAG診断ツール",
      "SLA 99.5%",
    ],
  },
  enterprise: {
    id: "enterprise",
    displayName: "Enterprise",
    price: "個別見積",
    priceMonthly: -1,
    description: "大企業・金融・官公庁向け",
    stripePriceId: "",
    limits: {
      maxGroups: -1,
      maxServices: -1,
      maxDocuments: -1,
      maxMonthlyChats: -1,
      maxUsers: -1,
      maxWidgetSites: -1,
    },
    features: {
      faqAutoGeneration: true,
      weeklyReports: true,
      ragDiagnostics: true,
      customSso: true,
    },
    highlighted: false,
    landingFeatures: [
      "全て無制限",
      "カスタムSSO",
      "専任サポート担当",
      "SLA 99.9%",
      "オンプレミス相談可",
    ],
  },
};

/** プラン一覧（表示順） */
export const PLAN_LIST: PlanDefinition[] = [
  PLAN_DEFINITIONS.free,
  PLAN_DEFINITIONS.starter,
  PLAN_DEFINITIONS.business,
  PLAN_DEFINITIONS.enterprise,
];

/** プランIDの配列（バリデーション用） */
export const VALID_PLAN_IDS: PlanId[] = ["free", "starter", "business", "enterprise"];
