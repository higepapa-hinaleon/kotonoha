// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  ssr: false,

  future: {
    compatibilityVersion: 4,
  },

  modules: ["@nuxtjs/tailwindcss", "@nuxt/eslint"],

  components: [
    {
      path: "~/components",
      pathPrefix: false,
    },
  ],

  runtimeConfig: {
    // Server-only (NUXT_xxx)
    firebaseProjectId: "",
    firebaseClientEmail: "",
    firebasePrivateKey: "",
    firebaseStorageBucket: "",
    firebaseDatabaseId: "",
    vertexAiLocation: "asia-northeast1",
    vertexAiModel: "gemini-2.5-flash",
    vertexAiEmbeddingModel: "text-multilingual-embedding-002",
    corsAllowedOrigins: "", // NUXT_CORS_ALLOWED_ORIGINS: カンマ区切りで許可オリジンを指定

    // Stripe
    stripeSecretKey: "",
    stripeWebhookSecret: "",
    stripePriceIdStarter: "",
    stripePriceIdBusiness: "",

    // SMTP（メール送信）
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",

    // アプリケーションURL（メールのリンク生成用）
    // 注意: NUXT_APP_BASE_URL は Nuxt 予約名(app.baseURL を上書き)のため使用不可
    publicUrl: "http://localhost:3000",

    // 銀行振込情報（請求メール用）
    bankName: "",
    bankBranch: "",
    bankAccountType: "",
    bankAccountNumber: "",
    bankAccountHolder: "",

    // Client-exposed (NUXT_PUBLIC_xxx)
    public: {
      firebaseApiKey: "",
      firebaseAuthDomain: "",
      firebaseProjectId: "",
      firebaseStorageBucket: "",
      firebaseMessagingSenderId: "",
      firebaseAppId: "",
      firebaseDatabaseId: "",
      stripePublishableKey: "",
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  tailwindcss: {
    cssPath: "~/assets/css/main.css",
  },

  devtools: { enabled: true },
});
