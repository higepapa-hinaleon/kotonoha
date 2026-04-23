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
        <h1>特定商取引法に基づく表記</h1>

        <table>
          <tbody>
            <tr>
              <th class="whitespace-nowrap text-left align-top">販売業者</th>
              <td>山下 貴大</td>
            </tr>
            <tr>
              <th class="whitespace-nowrap text-left align-top">運営責任者</th>
              <td>山下 貴大</td>
            </tr>
            <tr>
              <th class="whitespace-nowrap text-left align-top">所在地</th>
              <td>〒178-0063 東京都練馬区東大泉7-35-30</td>
            </tr>
            <tr>
              <th class="whitespace-nowrap text-left align-top">連絡先</th>
              <td>
                TEL: 070-2209-7079<br />
                Email: t.yamashita.73530@gmail.com
              </td>
            </tr>
            <tr>
              <th class="whitespace-nowrap text-left align-top">販売価格</th>
              <td>各プランの料金ページに記載の通り（税込表示）</td>
            </tr>
            <tr>
              <th class="whitespace-nowrap text-left align-top">販売価格以外の必要料金</th>
              <td>銀行振込の場合、振込手数料はお客様負担となります。</td>
            </tr>
            <tr>
              <th class="whitespace-nowrap text-left align-top">支払方法</th>
              <td>クレジットカード（Stripe）、銀行振込</td>
            </tr>
            <tr>
              <th class="whitespace-nowrap text-left align-top">支払時期</th>
              <td>
                クレジットカード: お申込み時に即時決済<br />
                銀行振込: 申請承認後7日以内にお振込みください
              </td>
            </tr>
            <tr>
              <th class="whitespace-nowrap text-left align-top">サービス提供時期</th>
              <td>入金確認後、即日ご利用いただけます。</td>
            </tr>
            <tr>
              <th class="whitespace-nowrap text-left align-top">返品・キャンセルについて</th>
              <td>
                デジタルサービスの性質上、返品・返金には対応いたしかねます。<br />
                解約をご希望の場合は、管理画面またはお問い合わせよりご連絡ください。<br />
                解約は月末締めで、翌月末日をもってサービスが終了します。
              </td>
            </tr>
          </tbody>
        </table>
      </article>
    </main>
  </div>
</template>
