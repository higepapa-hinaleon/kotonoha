<script setup lang="ts">
definePageMeta({ layout: false });
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="border-b border-gray-200 bg-white">
      <div class="mx-auto flex h-14 max-w-3xl items-center px-4">
        <NuxtLink to="/" class="text-lg font-bold text-primary-600">kotonoha AI Support</NuxtLink>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-8">
      <article class="prose prose-gray max-w-none rounded-lg bg-white p-8 shadow-sm">
        <h1>プライバシーポリシー</h1>
        <p class="text-sm text-gray-500">最終更新日: 2026年3月30日 / バージョン: 1.0</p>

        <h2>1. 収集する情報</h2>
        <p>本サービスでは、以下の情報を収集します：</p>
        <ul>
          <li><strong>アカウント情報：</strong>メールアドレス、表示名、認証プロバイダ情報</li>
          <li><strong>利用データ：</strong>チャット履歴、アップロードされたドキュメント、サービス利用状況</li>
          <li><strong>技術情報：</strong>IPアドレス、ブラウザ情報、アクセスログ</li>
          <li><strong>同意記録：</strong>利用規約・プライバシーポリシーへの同意日時およびバージョン</li>
        </ul>

        <h2>2. 情報の利用目的</h2>
        <p>収集した情報は以下の目的で利用します：</p>
        <ul>
          <li>本サービスの提供・運営・改善</li>
          <li>AI応答の品質向上（ドキュメントの解析・ベクトル化）</li>
          <li>ユーザーサポートの提供</li>
          <li>利用状況の分析・レポート作成</li>
          <li>不正利用の防止</li>
          <li>法令に基づく対応</li>
        </ul>

        <h2>3. 情報の共有</h2>
        <p>
          ユーザーの個人情報は、以下の場合を除き第三者に提供しません：
        </p>
        <ul>
          <li>ユーザーの同意がある場合</li>
          <li>法令に基づく場合</li>
          <li>サービス提供に必要な業務委託先への提供（適切な安全管理措置を講じた上で）</li>
        </ul>

        <h2>4. データの保管</h2>
        <p>
          ユーザーデータはGoogle Cloud Platform上に保管され、適切なセキュリティ対策を施しています。
          データの保管場所はアジア太平洋リージョンを基本とします。
        </p>

        <h2>5. AI処理について</h2>
        <p>
          アップロードされたドキュメントはAI（Google Vertex AI）により解析・ベクトル化されます。
          チャットの質問に対する回答生成にもAIが使用されます。
          AI処理の結果は参考情報であり、最終的な判断はユーザーの責任で行ってください。
        </p>

        <h2>6. ユーザーの権利</h2>
        <p>ユーザーは以下の権利を有します：</p>
        <ul>
          <li>自身の個人情報の開示請求</li>
          <li>個人情報の訂正・削除の請求</li>
          <li>アカウントの削除</li>
        </ul>
        <p>これらの請求は、サービス内の設定画面または運営者への連絡により行うことができます。</p>

        <h2>7. Cookieの使用</h2>
        <p>
          本サービスでは認証状態の管理にCookieおよびローカルストレージを使用します。
          これらはサービスの正常な動作に必要なものです。
        </p>

        <h2>8. ポリシーの変更</h2>
        <p>
          本ポリシーは必要に応じて変更することがあります。
          重要な変更がある場合は、本サービス上で通知します。
        </p>

        <h2>9. お問い合わせ</h2>
        <p>
          個人情報の取り扱いに関するお問い合わせは、本サービスのサポート窓口までご連絡ください。
        </p>
      </article>
    </main>
  </div>
</template>
