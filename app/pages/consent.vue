<script setup lang="ts">
definePageMeta({ layout: false });

const { user, hasConsent, hasOrganization, getIdToken } = useAuth();
const { show } = useNotification();

const agreed = ref(false);
const submitting = ref(false);
const error = ref("");

function redirectAfterConsent() {
  return navigateTo(hasOrganization.value ? "/admin" : "/apply");
}

// 既に同意済みならリダイレクト
watch(
  hasConsent,
  (v) => {
    if (v) {
      redirectAfterConsent();
    }
  },
  { immediate: true },
);

async function handleConsent() {
  if (!agreed.value) return;

  submitting.value = true;
  error.value = "";
  try {
    const token = await getIdToken();
    await $fetch("/api/auth/consent", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: { consentVersion: "1.0" },
    });

    // ユーザー情報を更新（consentAcceptedAt を反映）
    if (user.value) {
      user.value.consentAcceptedAt = new Date().toISOString();
      user.value.consentVersion = "1.0";
    }

    show("同意を記録しました", "success");
    await redirectAfterConsent();
  } catch {
    error.value = "同意の記録に失敗しました。もう一度お試しください。";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-lg space-y-6 rounded-lg bg-white p-8 shadow-md">
      <div class="text-center">
        <h1 class="text-2xl font-bold text-primary-600">kotonoha AI Support</h1>
        <p class="mt-1 text-sm text-gray-500">サービスをご利用いただくには、以下の規約への同意が必要です</p>
      </div>

      <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-600">
        {{ error }}
      </div>

      <div class="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4">
        <p class="text-sm text-gray-700">以下のドキュメントをご確認ください：</p>
        <ul class="space-y-2 text-sm">
          <li>
            <NuxtLink
              to="/terms"
              target="_blank"
              class="text-primary-600 underline hover:text-primary-800"
            >
              利用規約
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              to="/privacy"
              target="_blank"
              class="text-primary-600 underline hover:text-primary-800"
            >
              プライバシーポリシー
            </NuxtLink>
          </li>
        </ul>
      </div>

      <label class="flex items-start gap-3 cursor-pointer">
        <input
          v-model="agreed"
          type="checkbox"
          class="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <span class="text-sm text-gray-700">
          <NuxtLink to="/terms" target="_blank" class="text-primary-600 underline">利用規約</NuxtLink>
          および
          <NuxtLink to="/privacy" target="_blank" class="text-primary-600 underline">プライバシーポリシー</NuxtLink>
          に同意します
        </span>
      </label>

      <button
        :disabled="!agreed || submitting"
        class="flex w-full items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        @click="handleConsent"
      >
        {{ submitting ? "送信中..." : "同意して続ける" }}
      </button>
    </div>
  </div>
</template>
