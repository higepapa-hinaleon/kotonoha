<script setup lang="ts">
import { PLAN_LIST } from "~~/shared/plans";

definePageMeta({
  layout: false,
});

const features = [
  {
    title: "RAG ベースの高精度回答",
    description:
      "社内ドキュメントをベクトル化し、質問に最も関連する情報を検索。根拠に基づいた正確な回答を生成します。",
    icon: "search",
  },
  {
    title: "信頼度スコア付き回答",
    description:
      "全ての回答にAIの確信度を表示。参照元ドキュメントも提示し、回答の透明性を担保します。",
    icon: "shield",
  },
  {
    title: "自動エスカレーション",
    description:
      "AIが回答に自信がない場合は、自動で人間の担当者にエスカレーション。対応漏れゼロを実現します。",
    icon: "arrow-up",
  },
  {
    title: "フィードバック学習ループ",
    description: "ユーザーの評価と管理者の訂正回答をAIが学習。使えば使うほど回答精度が向上します。",
    icon: "refresh",
  },
  {
    title: "1行で埋め込み",
    description:
      "HTMLタグ1行で既存のWebサイトにチャットウィジェットを設置。大規模な開発は不要です。",
    icon: "code",
  },
  {
    title: "管理ダッシュボード",
    description:
      "対応状況、解決率、改善リクエストをリアルタイムで可視化。データドリブンな運用改善を支援します。",
    icon: "chart",
  },
];

const useCases = [
  {
    title: "自社サービスへのサポート埋め込み",
    persona: "SaaS企業 カスタマーサクセス部門",
    scenario:
      "製品マニュアルやFAQをKotonohaに登録し、自社サービスのWebサイトにチャットウィジェットを1行で設置。「APIの認証方法は？」「料金プランの違いを教えて」といった問い合わせにAIが24時間即座に回答。サポートチームは高度な技術相談に集中でき、対応工数を70%削減。",
    imagePlaceholder:
      "SaaSプロダクトのWebサイトにチャットウィジェットが表示されているスクリーンショット",
  },
  {
    title: "社内ヘルプデスクの自動化",
    persona: "大企業 情報システム部門 / 人事部門",
    scenario:
      "社内規程、IT手順書、人事制度マニュアルをアップロード。「パスワードをリセットしたい」「VPN接続の手順は？」「有給休暇の申請方法を教えて」など、毎日繰り返される定型的な質問にAIが即座に回答。担当者は月間200時間の問い合わせ対応から解放され、本来の業務に集中できます。",
    imagePlaceholder:
      "社内ポータルサイトにKotonohaチャットが埋め込まれ、社員が質問しているスクリーンショット",
  },
  {
    title: "忙しい専門家の代わりに壁打ち相手",
    persona: "新人・若手社員 / ナレッジが属人化している組織",
    scenario:
      "業務マニュアルや過去のノウハウをKotonohaに集約。新人が「この案件の見積り方法は？」「クレーム対応のフローを教えて」と質問すると、ベテラン社員のナレッジに基づいた回答が即座に返ってきます。先輩社員の手を止めることなく、24時間いつでも相談できる壁打ち相手が手に入ります。",
    imagePlaceholder: "新人社員がデスクでKotonohaチャットに業務の質問をしている利用イメージ",
  },
  {
    title: "ECサイトの顧客対応を24時間化",
    persona: "EC・小売 カスタマーサポート",
    scenario:
      "商品情報、配送ポリシー、返品手続きのドキュメントを登録。「この商品のサイズ感は？」「注文のキャンセル方法は？」「返品の送料は？」といった問い合わせに深夜・休日でもAIが対応。顧客の購入体験を損なわず、機会損失を防止します。",
    imagePlaceholder:
      "ECサイトの商品ページ右下にチャットウィジェットが表示されているスクリーンショット",
  },
];

const plans = PLAN_LIST.map((plan) => ({
  id: plan.id,
  name: plan.displayName,
  price: plan.price,
  description: plan.description,
  features: plan.landingFeatures,
  highlighted: plan.highlighted,
}));

const mobileMenuOpen = ref(false);
</script>

<template>
  <div class="min-h-screen bg-white">
    <!-- ナビゲーション -->
    <nav class="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <span class="text-xl font-bold text-primary-600">kotonoha</span>
        <div class="hidden items-center gap-6 sm:flex">
          <a href="#features" class="text-sm text-gray-600 hover:text-gray-900">機能</a>
          <a href="#use-cases" class="text-sm text-gray-600 hover:text-gray-900">活用シーン</a>
          <a href="#pricing" class="text-sm text-gray-600 hover:text-gray-900">料金</a>
          <NuxtLink
            to="/apply"
            class="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            無料で始める
          </NuxtLink>
        </div>
        <button
          aria-label="メニューを開閉する"
          :aria-expanded="mobileMenuOpen"
          class="rounded-md p-2 text-gray-500 hover:bg-gray-100 sm:hidden"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <svg
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              v-if="!mobileMenuOpen"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
            <path v-else stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <!-- モバイルメニュー -->
      <div v-if="mobileMenuOpen" class="border-t border-gray-100 bg-white px-4 py-4 sm:hidden">
        <div class="flex flex-col gap-3">
          <a href="#features" class="text-sm text-gray-600" @click="mobileMenuOpen = false">機能</a>
          <a href="#use-cases" class="text-sm text-gray-600" @click="mobileMenuOpen = false"
            >活用シーン</a
          >
          <a href="#pricing" class="text-sm text-gray-600" @click="mobileMenuOpen = false">料金</a>
          <NuxtLink
            to="/apply"
            class="rounded-lg bg-primary-600 px-5 py-2 text-center text-sm font-medium text-white hover:bg-primary-700"
            @click="mobileMenuOpen = false"
          >
            無料で始める
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- ヒーローセクション -->
    <section class="relative overflow-hidden bg-gradient-to-b from-primary-50 to-white">
      <div class="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div class="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h1 class="text-4xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl">
              組織のナレッジを、<br />
              <span class="text-primary-600">顧客との対話</span>に変える
            </h1>
            <p class="mt-6 text-lg leading-relaxed text-gray-600">
              マニュアル・FAQ・手順書をアップロードするだけ。AIが社内ドキュメントに基づいた正確な回答を、24時間365日、自動で提供します。
            </p>
            <div class="mt-8 flex flex-col gap-3 sm:flex-row">
              <NuxtLink
                to="/apply?plan=free"
                class="rounded-lg bg-primary-600 px-8 py-3 text-center font-medium text-white shadow-lg shadow-primary-200 hover:bg-primary-700"
              >
                無料で始める
              </NuxtLink>
              <a
                href="#use-cases"
                class="rounded-lg border border-gray-300 px-8 py-3 text-center font-medium text-gray-700 hover:bg-gray-50"
              >
                活用シーンを見る
              </a>
            </div>
            <div class="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-sm text-gray-500">
              <span>24時間365日対応</span>
              <span>導入最短1週間</span>
              <span>対応工数 最大70%削減</span>
            </div>
          </div>
          <div
            class="flex min-h-[320px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-8"
            data-image-slot="hero"
          >
            <div class="text-center text-sm text-gray-400">
              <svg
                class="mx-auto mb-3 h-12 w-12 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p>Kotonoha チャット画面のスクリーンショット</p>
              <p class="mt-1 text-xs text-gray-300">推奨サイズ: 600x400px</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 課題提起セクション -->
    <section class="bg-white py-16 sm:py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <h2 class="text-3xl font-bold text-gray-900">こんな課題、ありませんか？</h2>
          <p class="mt-4 text-lg text-gray-500">
            多くの企業が抱える問い合わせ対応の悩みを、Kotonohaが解決します
          </p>
        </div>
        <div class="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div class="rounded-xl border border-gray-200 p-6">
            <div class="mb-3 inline-flex rounded-lg bg-red-50 p-2 text-red-500">
              <svg
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900">対応コストが増え続ける</h3>
            <p class="mt-2 text-sm text-gray-500">
              サポート人員の増加、残業、外注コストが年々上昇していませんか？
            </p>
          </div>
          <div class="rounded-xl border border-gray-200 p-6">
            <div class="mb-3 inline-flex rounded-lg bg-orange-50 p-2 text-orange-500">
              <svg
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900">回答品質にばらつき</h3>
            <p class="mt-2 text-sm text-gray-500">
              担当者によって回答が違う、誤回答で二次対応が発生していませんか？
            </p>
          </div>
          <div class="rounded-xl border border-gray-200 p-6">
            <div class="mb-3 inline-flex rounded-lg bg-yellow-50 p-2 text-yellow-600">
              <svg
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900">知識の属人化</h3>
            <p class="mt-2 text-sm text-gray-500">
              ベテラン社員の退職でノウハウが失われるリスクを感じていませんか？
            </p>
          </div>
          <div class="rounded-xl border border-gray-200 p-6">
            <div class="mb-3 inline-flex rounded-lg bg-blue-50 p-2 text-blue-500">
              <svg
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900">24時間対応ができない</h3>
            <p class="mt-2 text-sm text-gray-500">
              営業時間外の問い合わせに翌営業日まで回答できず、機会損失が発生していませんか？
            </p>
          </div>
          <div class="rounded-xl border border-gray-200 p-6 sm:col-span-2 lg:col-span-1">
            <div class="mb-3 inline-flex rounded-lg bg-purple-50 p-2 text-purple-500">
              <svg
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900">ナレッジが散在</h3>
            <p class="mt-2 text-sm text-gray-500">
              マニュアル・FAQ・メール・チャット履歴が分散して検索できない状態ではありませんか？
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- 機能紹介セクション -->
    <section id="features" class="bg-gray-50 py-16 sm:py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <h2 class="text-3xl font-bold text-gray-900">Kotonoha の特長</h2>
          <p class="mt-4 text-lg text-gray-500">AIネイティブな設計で、導入初日から効果を実感</p>
        </div>
        <div class="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="feature in features"
            :key="feature.title"
            class="rounded-xl bg-white p-6 shadow-sm"
          >
            <div class="mb-4 inline-flex rounded-lg bg-primary-50 p-3 text-primary-600">
              <!-- 検索アイコン -->
              <svg
                v-if="feature.icon === 'search'"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <!-- シールドアイコン -->
              <svg
                v-else-if="feature.icon === 'shield'"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <!-- 矢印アイコン -->
              <svg
                v-else-if="feature.icon === 'arrow-up'"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M7 11l5-5m0 0l5 5m-5-5v12"
                />
              </svg>
              <!-- リフレッシュアイコン -->
              <svg
                v-else-if="feature.icon === 'refresh'"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <!-- コードアイコン -->
              <svg
                v-else-if="feature.icon === 'code'"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
              <!-- チャートアイコン -->
              <svg
                v-else
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-900">{{ feature.title }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-gray-500">{{ feature.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 利用シーン / ユースケース -->
    <section id="use-cases" class="bg-white py-16 sm:py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <h2 class="text-3xl font-bold text-gray-900">活用シーン</h2>
          <p class="mt-4 text-lg text-gray-500">
            さまざまな業種・部門で、現場の課題を解決しています
          </p>
        </div>
        <div class="mt-12 space-y-16">
          <div
            v-for="(useCase, index) in useCases"
            :key="useCase.title"
            class="grid items-center gap-8 lg:grid-cols-2"
          >
            <div :class="index % 2 === 1 ? 'lg:order-2' : ''">
              <span
                class="inline-block rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700"
              >
                {{ useCase.persona }}
              </span>
              <h3 class="mt-3 text-2xl font-bold text-gray-900">{{ useCase.title }}</h3>
              <p class="mt-4 leading-relaxed text-gray-600">{{ useCase.scenario }}</p>
            </div>
            <div
              :class="index % 2 === 1 ? 'lg:order-1' : ''"
              class="flex min-h-[240px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-6"
              :data-image-slot="`use-case-${index + 1}`"
            >
              <div class="text-center text-sm text-gray-400">
                <svg
                  class="mx-auto mb-2 h-10 w-10 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="1"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p>{{ useCase.imagePlaceholder }}</p>
                <p class="mt-1 text-xs text-gray-300">推奨サイズ: 560x340px</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 導入ステップ -->
    <section class="bg-gray-50 py-16 sm:py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <h2 class="text-3xl font-bold text-gray-900">かんたん3ステップで導入</h2>
          <p class="mt-4 text-lg text-gray-500">最短1週間で運用開始できます</p>
        </div>
        <div class="mt-12 grid gap-8 sm:grid-cols-3">
          <div class="text-center">
            <div
              class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-600"
            >
              1
            </div>
            <h3 class="mt-4 text-lg font-semibold text-gray-900">ドキュメントを登録</h3>
            <p class="mt-2 text-sm text-gray-500">
              PDF・Word・テキスト等の社内ドキュメントをアップロード。AIが自動でインデキシングします。
            </p>
          </div>
          <div class="text-center">
            <div
              class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-600"
            >
              2
            </div>
            <h3 class="mt-4 text-lg font-semibold text-gray-900">ウィジェットを設置</h3>
            <p class="mt-2 text-sm text-gray-500">
              HTMLタグ1行をWebサイトに貼り付けるだけ。チャットウィジェットがすぐに動作します。
            </p>
          </div>
          <div class="text-center">
            <div
              class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-600"
            >
              3
            </div>
            <h3 class="mt-4 text-lg font-semibold text-gray-900">運用開始・継続改善</h3>
            <p class="mt-2 text-sm text-gray-500">
              管理ダッシュボードで対応状況を確認。フィードバックループでAIの回答精度が日々向上します。
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ウィジェット埋め込みコード紹介 -->
    <section class="bg-white py-16 sm:py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 class="text-3xl font-bold text-gray-900">HTMLタグ1行で設置完了</h2>
            <p class="mt-4 text-lg text-gray-600">
              既存のWebサイトやアプリに、コピー&ペーストだけでAIチャットボットを追加。大規模なシステム改修は不要です。
            </p>
            <div class="mt-6 overflow-x-auto rounded-lg bg-gray-900 p-4">
              <code class="text-sm text-green-400">
                &lt;kotonoha-chat-widget<br />
                &nbsp;&nbsp;api-base-url="https://your-domain.com"<br />
                &nbsp;&nbsp;service-id="your-service-id"<br />
                &gt;&lt;/kotonoha-chat-widget&gt;
              </code>
            </div>
          </div>
          <div
            class="flex min-h-[280px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-6"
            data-image-slot="widget-demo"
          >
            <div class="text-center text-sm text-gray-400">
              <svg
                class="mx-auto mb-2 h-10 w-10 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p>Webサイトに埋め込まれたチャットウィジェットのデモ画像</p>
              <p class="mt-1 text-xs text-gray-300">推奨サイズ: 560x340px</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 料金プラン -->
    <section id="pricing" class="bg-gray-50 py-16 sm:py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <h2 class="text-3xl font-bold text-gray-900">料金プラン</h2>
          <p class="mt-4 text-lg text-gray-500">規模に合わせて選べるシンプルな料金体系</p>
        </div>
        <div class="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="plan in plans"
            :key="plan.name"
            class="relative rounded-2xl border-2 bg-white p-8"
            :class="plan.highlighted ? 'border-primary-500 shadow-xl' : 'border-gray-200'"
          >
            <div
              v-if="plan.highlighted"
              class="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-4 py-1 text-xs font-medium text-white"
            >
              おすすめ
            </div>
            <h3 class="text-xl font-bold text-gray-900">{{ plan.name }}</h3>
            <p class="mt-1 text-sm text-gray-500">{{ plan.description }}</p>
            <div class="mt-6">
              <span
                class="text-4xl font-bold text-gray-900"
                :class="plan.price === '個別見積' ? 'text-2xl' : ''"
              >
                {{ plan.price === "個別見積" ? plan.price : plan.price === "0" ? "無料" : `\u00A5${plan.price}` }}
              </span>
              <span v-if="plan.price !== '個別見積' && plan.price !== '0'" class="text-sm text-gray-500">
                /月（税抜）</span
              >
            </div>
            <ul class="mt-8 space-y-3">
              <li
                v-for="item in plan.features"
                :key="item"
                class="flex items-start gap-2 text-sm text-gray-600"
              >
                <svg
                  class="mt-0.5 h-4 w-4 shrink-0 text-primary-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {{ item }}
              </li>
            </ul>
            <NuxtLink
              v-if="plan.id !== 'enterprise'"
              :to="`/apply?plan=${plan.id}`"
              class="mt-8 block w-full rounded-lg py-3 text-center text-sm font-medium"
              :class="
                plan.highlighted
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              "
            >
              {{ plan.price === "0" ? "無料で始める" : "申し込む" }}
            </NuxtLink>
            <a
              v-else
              href="mailto:support@kotonoha.ai"
              class="mt-8 block w-full rounded-lg border border-gray-300 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              お問い合わせ
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="bg-primary-600 py-16 sm:py-20">
      <div class="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-white">今すぐ、ナレッジ活用を始めましょう</h2>
        <p class="mt-4 text-lg text-primary-100">
          ドキュメントをアップロードするだけで、AIチャットボットが完成。問い合わせ対応の未来を体験してください。
        </p>
        <div class="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <NuxtLink
            to="/apply?plan=free"
            class="rounded-lg bg-white px-8 py-3 font-medium text-primary-600 shadow-lg hover:bg-gray-50"
          >
            無料で始める
          </NuxtLink>
          <NuxtLink
            to="/chat"
            class="rounded-lg border border-primary-300 px-8 py-3 font-medium text-white hover:bg-primary-700"
          >
            デモを試す
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- フッター -->
    <footer class="border-t border-gray-200 bg-white py-8">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <span class="text-sm text-gray-400"
            >&copy; {{ new Date().getFullYear() }} Kotonoha. All rights reserved.</span
          >
          <div class="flex flex-wrap gap-4">
            <NuxtLink to="/terms" class="text-sm text-gray-400 hover:text-gray-600">利用規約</NuxtLink>
            <NuxtLink to="/privacy" class="text-sm text-gray-400 hover:text-gray-600">プライバシーポリシー</NuxtLink>
            <NuxtLink to="/tokushoho" class="text-sm text-gray-400 hover:text-gray-600">特定商取引法に基づく表記</NuxtLink>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
