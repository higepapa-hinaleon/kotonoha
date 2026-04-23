<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: ["auth", "admin"],
});

const { user } = useAuth();

const categories = [
  "解約相談",
  "プラン変更",
  "請求・お支払い",
  "技術的なご質問",
  "不具合報告",
  "その他",
];

const category = ref("");
const message = ref("");

const submitting = ref(false);
const submitted = ref(false);
const errorMessage = ref("");

const userName = computed(() => user.value?.displayName || "");
const userEmail = computed(() => user.value?.email || "");

const isValid = computed(() => {
  return (
    userName.value.trim() !== "" &&
    userEmail.value.includes("@") &&
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
        name: userName.value,
        email: userEmail.value,
        category: category.value,
        message: message.value,
      },
    });
    submitted.value = true;
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }; statusMessage?: string };
    errorMessage.value =
      err.data?.message ||
      err.statusMessage ||
      "送信に失敗しました。時間を置いて再度お試しください。";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-8">
    <h1 class="text-2xl font-bold text-gray-900">お問い合わせ</h1>
    <p class="mt-2 text-sm text-gray-600">
      ご質問・ご相談がございましたら、以下のフォームよりお問い合わせください。
    </p>

    <!-- 送信完了 -->
    <div v-if="submitted" class="mt-8 rounded-lg bg-primary-50 p-8 text-center">
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
        to="/admin"
        class="mt-6 inline-block rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        ダッシュボードに戻る
      </NuxtLink>
    </div>

    <!-- フォーム -->
    <form v-else class="mt-8 space-y-6" @submit.prevent="handleSubmit">
      <!-- お名前（読み取り専用） -->
      <div>
        <label class="block text-sm font-medium text-gray-700">お名前</label>
        <div
          class="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
        >
          {{ userName || "未設定" }}
        </div>
        <p v-if="!userName.trim()" class="mt-1 text-xs text-red-500">
          お名前が設定されていません。設定画面でお名前を登録してください。
        </p>
      </div>

      <!-- メールアドレス（読み取り専用） -->
      <div>
        <label class="block text-sm font-medium text-gray-700">メールアドレス</label>
        <div
          class="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
        >
          {{ userEmail || "未設定" }}
        </div>
        <p v-if="!userEmail.includes('@')" class="mt-1 text-xs text-red-500">
          有効なメールアドレスが設定されていません。
        </p>
      </div>

      <!-- お問い合わせ種別 -->
      <div>
        <label for="admin-contact-category" class="block text-sm font-medium text-gray-700">
          お問い合わせ種別 <span class="text-red-500">*</span>
        </label>
        <select id="admin-contact-category" v-model="category" required :class="inputClass">
          <option value="" disabled>選択してください</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
      </div>

      <!-- お問い合わせ内容 -->
      <div>
        <label for="admin-contact-message" class="block text-sm font-medium text-gray-700">
          お問い合わせ内容 <span class="text-red-500">*</span>
        </label>
        <textarea
          id="admin-contact-message"
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
</template>
