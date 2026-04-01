<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: ["auth", "admin"],
});

// 目次のアクティブセクション追跡
const activeSection = ref("overview");

interface ManualSection {
  id: string;
  title: string;
}

const sections: ManualSection[] = [
  { id: "overview", title: "概要" },
  { id: "login", title: "ログイン" },
  { id: "dashboard", title: "ダッシュボード" },
  { id: "services", title: "サービス管理" },
  { id: "documents", title: "ドキュメント管理" },
  { id: "conversations", title: "サポート履歴" },
  { id: "improvements", title: "改善要望" },
  { id: "faqs", title: "FAQ管理" },
  { id: "learning", title: "教育モード" },
  { id: "reports", title: "レポート" },
  { id: "rag-test", title: "RAGテスト" },
  { id: "settings", title: "設定" },
  { id: "widget", title: "ウィジェット設定" },
  { id: "chat", title: "チャット（利用者向け）" },
];

function scrollToSection(id: string) {
  activeSection.value = id;
  const el = document.getElementById(`manual-${id}`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}
</script>

<template>
  <div class="flex gap-6">
    <!-- 目次サイドバー（PC のみ） -->
    <nav class="hidden w-48 shrink-0 lg:block">
      <div class="sticky top-0 space-y-0.5">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">目次</p>
        <button
          v-for="sec in sections"
          :key="sec.id"
          class="block w-full rounded px-2 py-1 text-left text-xs transition-colors"
          :class="
            activeSection === sec.id
              ? 'bg-primary-50 font-medium text-primary-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          "
          @click="scrollToSection(sec.id)"
        >
          {{ sec.title }}
        </button>
      </div>
    </nav>

    <!-- メインコンテンツ -->
    <div class="min-w-0 flex-1 space-y-8">
      <h1 class="text-xl font-bold text-gray-900">アプリケーションマニュアル</h1>

      <!-- 概要 -->
      <section id="manual-overview">
        <h2 class="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">概要</h2>
        <div class="space-y-2 text-sm text-gray-700">
          <p>
            Kotonoha
            は、社内ドキュメントを活用したAIチャットサポートシステムです。管理者はドキュメントをアップロードし、サービスごとにAIチャットボットを運用できます。利用者はチャット画面またはウィジェットから質問すると、AIが関連ドキュメントをもとに回答します。
          </p>
          <p>本マニュアルでは、管理画面の各機能と利用者向けチャット画面の使い方を説明します。</p>
        </div>
      </section>

      <!-- ログイン -->
      <section id="manual-login">
        <h2 class="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
          ログイン
        </h2>
        <ManualScreenshot id="login-page" alt="ログイン画面" />
        <div class="space-y-2 text-sm text-gray-700">
          <p>
            メールアドレス/パスワード、またはGoogleアカウントでログインできます。初回ログイン時にユーザーが自動登録されます。
          </p>
          <p>
            ログイン後、所属グループが割り当てられていない場合は「グループ未割当」画面が表示されます。管理者にグループへの追加を依頼してください。
          </p>
        </div>
      </section>

      <!-- ダッシュボード -->
      <section id="manual-dashboard">
        <h2 class="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
          ダッシュボード
        </h2>
        <ManualScreenshot id="dashboard-overview" alt="ダッシュボード全体" />
        <div class="space-y-2 text-sm text-gray-700">
          <p>ダッシュボードでは以下の情報を一覧できます：</p>
          <ul class="ml-4 list-disc space-y-1">
            <li><strong>会話数の推移</strong> — 直近の会話トレンドをグラフで確認</li>
            <li><strong>サービス別分布</strong> — 各サービスの利用状況</li>
            <li><strong>解決率</strong> — AIボットが自動解決した割合</li>
            <li><strong>改善要望数</strong> — 未対応の改善要望件数</li>
            <li><strong>未解決の会話</strong> — 直近のエスカレーション・未解決案件</li>
          </ul>
        </div>
        <ManualScreenshot
          id="dashboard-feedback"
          alt="ダッシュボード - フィードバック管理セクション"
          height="h-36"
        />
      </section>

      <!-- サービス管理 -->
      <section id="manual-services">
        <h2 class="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
          サービス管理
        </h2>
        <ManualScreenshot id="services-list" alt="サービス一覧画面" />
        <div class="space-y-2 text-sm text-gray-700">
          <p>
            サービスはAIチャットボットの単位です。「社内ネットワーク」「人事制度」など、問い合わせカテゴリごとにサービスを作成します。
          </p>
          <h3 class="mt-3 text-sm font-semibold text-gray-800">サービスの作成・編集</h3>
          <ManualScreenshot id="services-modal" alt="サービス作成/編集モーダル" height="h-40" />
          <ul class="ml-4 list-disc space-y-1">
            <li><strong>サービス名</strong>（必須） — 利用者に表示される名前</li>
            <li><strong>説明</strong> — サービスの概要</li>
            <li><strong>Google フォーム URL</strong> — AIが解決できない場合の問い合わせ先</li>
            <li><strong>有効/無効</strong> — 無効にするとチャットで利用不可になります</li>
          </ul>
        </div>
      </section>

      <!-- ドキュメント管理 -->
      <section id="manual-documents">
        <h2 class="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
          ドキュメント管理
        </h2>
        <ManualScreenshot id="documents-list" alt="ドキュメント一覧画面（フィルタ付き）" />
        <div class="space-y-2 text-sm text-gray-700">
          <p>AIの回答の元となるドキュメントを管理します。サービスに紐づけてアップロードします。</p>
          <h3 class="mt-3 text-sm font-semibold text-gray-800">アップロード</h3>
          <ManualScreenshot
            id="documents-upload"
            alt="ドキュメントアップロードモーダル"
            height="h-40"
          />
          <ul class="ml-4 list-disc space-y-1">
            <li>対応形式: PDF、テキスト、Markdown 等</li>
            <li>アップロード後、自動的にチャンク分割とベクトル化が実行されます</li>
            <li>処理状況は「処理中」→「完了」のステータスで確認できます</li>
            <li>同じファイルの重複アップロードは自動検出されます</li>
          </ul>
          <h3 class="mt-3 text-sm font-semibold text-gray-800">ドキュメント種別</h3>
          <ul class="ml-4 list-disc space-y-1">
            <li><strong>業務ドキュメント</strong> — 手順書、マニュアル等の業務情報</li>
            <li><strong>システムドキュメント</strong> — 技術仕様、API仕様等のシステム情報</li>
          </ul>
        </div>
      </section>

      <!-- サポート履歴 -->
      <section id="manual-conversations">
        <h2 class="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
          サポート履歴
        </h2>
        <ManualScreenshot id="conversations-list" alt="サポート履歴一覧（フィルタ付き）" />
        <div class="space-y-2 text-sm text-gray-700">
          <p>利用者とAIの会話履歴を確認できます。ステータスやサービスでフィルタリング可能です。</p>
          <h3 class="mt-3 text-sm font-semibold text-gray-800">ステータス</h3>
          <ul class="ml-4 list-disc space-y-1">
            <li><strong>アクティブ</strong> — 進行中の会話</li>
            <li><strong>ボット解決</strong> — AIが解決した会話</li>
            <li><strong>エスカレーション</strong> — 確信度が低く、人的対応が必要な会話</li>
            <li><strong>クローズ</strong> — 終了した会話</li>
          </ul>
          <h3 class="mt-3 text-sm font-semibold text-gray-800">会話詳細</h3>
          <ManualScreenshot id="conversation-detail" alt="会話詳細画面（メッセージ一覧）" />
          <p>
            会話をクリックすると、メッセージのやり取り、参照元ドキュメント、確信度スコアを確認できます。
          </p>
        </div>
      </section>

      <!-- 改善要望 -->
      <section id="manual-improvements">
        <h2 class="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
          改善要望
        </h2>
        <ManualScreenshot id="improvements-list" alt="改善要望一覧" />
        <div class="space-y-2 text-sm text-gray-700">
          <p>
            AIが適切に回答できなかったケースを記録・管理します。カテゴリ・優先度・ステータスで分類できます。
          </p>
          <h3 class="mt-3 text-sm font-semibold text-gray-800">カテゴリ</h3>
          <ul class="ml-4 list-disc space-y-1">
            <li><strong>ドキュメント不足</strong> — 必要な情報がドキュメントにない</li>
            <li><strong>ドキュメント不明瞭</strong> — ドキュメントの記述が曖昧</li>
            <li><strong>新機能</strong> — 新たな機能要望</li>
            <li><strong>その他</strong></li>
          </ul>
          <p>管理者ノートと修正回答を記入すると、AIの学習データとして活用されます。</p>
        </div>
      </section>

      <!-- FAQ管理 -->
      <section id="manual-faqs">
        <h2 class="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
          FAQ管理
        </h2>
        <ManualScreenshot id="faqs-list" alt="FAQ一覧画面" />
        <div class="space-y-2 text-sm text-gray-700">
          <p>
            よくある質問とその回答を管理します。手動作成と、会話履歴からのAI自動生成の2つの方法があります。
          </p>
          <ul class="ml-4 list-disc space-y-1">
            <li><strong>手動作成</strong> — 質問と回答を直接入力して作成</li>
            <li><strong>AI自動生成</strong> — 会話データからAIがFAQ候補を自動生成</li>
            <li>
              <strong>公開/非公開</strong> — 公開に設定したFAQはチャット回答の参考に使用されます
            </li>
          </ul>
        </div>
      </section>

      <!-- 教育モード -->
      <section id="manual-learning">
        <h2 class="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
          教育モード
        </h2>
        <ManualScreenshot id="learning-mode" alt="教育モード画面（テスト実行中）" />
        <div class="space-y-2 text-sm text-gray-700">
          <p>AIの回答品質をインタラクティブにテストし、回答の修正指示を与えることができます。</p>
          <ul class="ml-4 list-disc space-y-1">
            <li>テスト質問を入力し、AIの回答を確認</li>
            <li>回答が不適切な場合は修正回答を入力して学習データに追加</li>
            <li>改善要望として記録し、継続的な品質改善に活用</li>
          </ul>
        </div>
      </section>

      <!-- レポート -->
      <section id="manual-reports">
        <h2 class="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
          レポート
        </h2>
        <ManualScreenshot id="reports-list" alt="レポート一覧・生成画面" />
        <div class="space-y-2 text-sm text-gray-700">
          <p>レポートを生成・閲覧できます。レポートには以下が含まれます：</p>
          <ul class="ml-4 list-disc space-y-1">
            <li>期間中の会話統計（総数、解決率、エスカレーション数）</li>
            <li>サービス別利用状況</li>
            <li>AIによるインサイトと改善提案</li>
          </ul>
        </div>
      </section>

      <!-- RAGテスト -->
      <section id="manual-rag-test">
        <h2 class="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
          RAGテスト
        </h2>
        <ManualScreenshot id="rag-test" alt="RAGテスト画面（検索結果表示）" />
        <div class="space-y-2 text-sm text-gray-700">
          <p>ドキュメント検索（RAG: Retrieval-Augmented Generation）の動作を検証できます。</p>
          <ul class="ml-4 list-disc space-y-1">
            <li>
              テストクエリを入力すると、ヒットしたドキュメントチャンクと類似度スコアが表示されます
            </li>
            <li>ドキュメントの追加・更新後に検索精度を確認する際に活用してください</li>
          </ul>
        </div>
      </section>

      <!-- 設定 -->
      <section id="manual-settings">
        <h2 class="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">設定</h2>
        <ManualScreenshot id="settings" alt="設定画面" />
        <div class="space-y-2 text-sm text-gray-700">
          <h3 class="text-sm font-semibold text-gray-800">エスカレーション設定</h3>
          <p>
            デフォルトのGoogle フォーム
            URLを設定します。サービスごとに個別設定がない場合にこのURLが使用されます。
          </p>
          <h3 class="mt-3 text-sm font-semibold text-gray-800">ボット設定</h3>
          <ul class="ml-4 list-disc space-y-1">
            <li><strong>確信度しきい値</strong> — この値未満の回答は自動でエスカレーション</li>
            <li><strong>RAG検索件数</strong> — 回答生成時に参照するドキュメントチャンク数</li>
            <li><strong>システムプロンプト</strong> — AIの応答方針を制御するプロンプト</li>
          </ul>
        </div>
      </section>

      <!-- ウィジェット設定 -->
      <section id="manual-widget">
        <h2 class="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
          ウィジェット設定
        </h2>
        <ManualScreenshot id="widget-config" alt="ウィジェット設定画面（埋め込みコード表示）" />
        <div class="space-y-2 text-sm text-gray-700">
          <p>
            外部サイトにチャットウィジェットを埋め込むための設定情報とコードサンプルを確認できます。
          </p>
          <ul class="ml-4 list-disc space-y-1">
            <li>サービスを選択すると、そのサービス用の埋め込みコードが自動生成されます</li>
            <li>
              基本埋め込み、ユーザー情報付き、テーマカスタマイズ付き、iframe の4パターンを提供
            </li>
            <li>属性リファレンスとCSS変数一覧で詳細なカスタマイズが可能</li>
          </ul>
        </div>
      </section>

      <!-- チャット（利用者向け） -->
      <section id="manual-chat">
        <h2 class="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
          チャット（利用者向け）
        </h2>
        <ManualScreenshot id="chat-main" alt="チャット画面（会話中）" />
        <div class="space-y-2 text-sm text-gray-700">
          <p>
            利用者がAIに質問するための画面です。サービスを選択して質問を入力すると、登録されたドキュメントに基づいてAIが回答します。
          </p>
          <ul class="ml-4 list-disc space-y-1">
            <li>回答には参照元ドキュメントと類似度スコアが表示されます</li>
            <li>AIが解決できない場合はお問い合わせフォームへのリンクが表示されます</li>
          </ul>
          <h3 class="mt-3 text-sm font-semibold text-gray-800">チャット履歴</h3>
          <ManualScreenshot id="chat-history" alt="チャット履歴画面" height="h-40" />
          <p>過去の会話履歴を確認できます。</p>
        </div>
      </section>
    </div>
  </div>
</template>
