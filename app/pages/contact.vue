<script setup lang="ts">
definePageMeta({
  layout: false,
});

const categories = [
  "料金・プランについて",
  "導入相談",
  "技術的なご質問",
  "Enterpriseプラン",
  "その他",
];

const name = ref("");
const email = ref("");
const category = ref("");
const message = ref("");
const honeypot = ref("");

const submitting = ref(false);
const submitted = ref(false);
const errorMessage = ref("");

const isValid = computed(() => {
  return (
    name.value.trim() !== "" &&
    email.value.includes("@") &&
    category.value !== "" &&
    message.value.trim().length >= 10
  );
});

const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500";

async function handleSubmit() {
  if (!isValid.value || submitting.value) return;

  submitting.value = true;
  errorMessage.value = "";

  try {
    await $fetch("/api/contact", {
      method: "POST",
      body: {
        name: name.value,
        email: email.value,
        category: category.value,
        message: message.value,
        honeypot: honeypot.value,
      },
    });
    submitted.value = true;
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }; statusMessage?: string };
    errorMessage.value =
      err.data?.message || err.statusMessage || "送信に失敗しました。時間を置いて再度お試しください。";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-white">
    <!-- ナビゲーション -->
    <nav class="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <NuxtLink to="/" class="text-xl font-bold text-primary-600">kotonoha</NuxtLink>
        <NuxtLink to="/" class="text-sm text-gray-600 hover:text-gray-900">トップに戻る</NuxtLink>
      </div>
    </nav>

    <!-- メインコンテンツ -->
    <section class="py-16 sm:py-20">
      <div class="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <h1 class="text-center text-3xl font-bold text-gray-900">お問い合わせ</h1>
        <p class="mt-3 text-center text-gray-600">
          ご質問・ご相談がございましたら、以下のフォームよりお気軽にお問い合わせください。
        </p>

        <!-- 送信完了 -->
        <div v-if="submitted" class="mt-12 rounded-lg bg-primary-50 p-8 text-center">
          <svg
            class="mx-auto h-12 w-12 text-primary-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <h2 class="mt-4 text-xl font-semibold text-gray-900">送信完了</h2>
          <p class="mt-2 text-gray-600">
            お問い合わせを受け付けました。内容を確認の上、担当者よりご連絡いたします。
          </p>
          <NuxtLink
            to="/"
            class="mt-6 inline-block rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            トップに戻る
          </NuxtLink>
        </div>

        <!-- フォーム -->
        <form v-else class="mt-12 space-y-6" @submit.prevent="handleSubmit">
          <!-- ハニーポット（非表示） -->
          <div class="absolute -left-[9999px] opacity-0" aria-hidden="true">
            <label for="honeypot">このフィールドは空のままにしてください</label>
            <input id="honeypot" v-model="honeypot" type="text" tabindex="-1" autocomplete="off" />
          </div>

          <!-- お名前 -->
          <div>
            <label for="contact-name" class="block text-sm font-medium text-gray-700">
              お名前 <span class="text-red-500">*</span>
            </label>
            <input
              id="contact-name"
              v-model="name"
              type="text"
              required
              placeholder="山田 太郎"
              :class="inputClass"
            />
          </div>

          <!-- メールアドレス -->
          <div>
            <label for="contact-email" class="block text-sm font-medium text-gray-700">
              メールアドレス <span class="text-red-500">*</span>
            </label>
            <input
              id="contact-email"
              v-model="email"
              type="email"
              required
              placeholder="example@company.com"
              :class="inputClass"
            />
          </div>

          <!-- お問い合わせ種別 -->
          <div>
            <label for="contact-category" class="block text-sm font-medium text-gray-700">
              お問い合わせ種別 <span class="text-red-500">*</span>
            </label>
            <select id="contact-category" v-model="category" required :class="inputClass">
              <option value="" disabled>選択してください</option>
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>

          <!-- お問い合わせ内容 -->
          <div>
            <label for="contact-message" class="block text-sm font-medium text-gray-700">
              お問い合わせ内容 <span class="text-red-500">*</span>
            </label>
            <textarea
              id="contact-message"
              v-model="message"
              required
              rows="6"
              placeholder="お問い合わせ内容を入力してください（10文字以上）"
              :class="inputClass"
            />
          </div>

          <!-- エラーメッセージ -->
          <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

          <!-- 送信ボタン -->
          <div class="pt-2">
            <button
              type="submit"
              :disabled="!isValid || submitting"
              class="w-full rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ submitting ? "送信中..." : "送信する" }}
            </button>
          </div>
        </form>
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
            <NuxtLink to="/terms" class="text-sm text-gray-400 hover:text-gray-600"
              >利用規約</NuxtLink
            >
            <NuxtLink to="/privacy" class="text-sm text-gray-400 hover:text-gray-600"
              >プライバシーポリシー</NuxtLink
            >
            <NuxtLink to="/tokushoho" class="text-sm text-gray-400 hover:text-gray-600"
              >特定商取引法に基づく表記</NuxtLink
            >
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
