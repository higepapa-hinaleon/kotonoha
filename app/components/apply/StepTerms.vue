<script setup lang="ts">
const agreeTerms = defineModel<boolean>("agreeTerms", { required: true });
const agreePrivacy = defineModel<boolean>("agreePrivacy", { required: true });

defineProps<{
  termsVersion: string;
  privacyVersion: string;
}>();

const isValid = computed(() => agreeTerms.value && agreePrivacy.value);

defineExpose({ isValid });
</script>

<template>
  <div class="rounded-lg bg-white p-6 shadow-md">
    <h2 class="mb-4 text-lg font-semibold text-gray-800">利用規約・プライバシーポリシー</h2>
    <p class="mb-4 text-sm text-gray-600">
      以下の規約をご確認の上、同意いただける場合はチェックボックスにチェックを入れてください。
    </p>
    <div class="space-y-3">
      <label class="flex items-start gap-2 text-sm text-gray-700">
        <input
          v-model="agreeTerms"
          type="checkbox"
          class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <span>
          <NuxtLink to="/terms" target="_blank" class="text-primary-600 underline hover:text-primary-700">
            利用規約
          </NuxtLink>
          <span class="ml-1 text-xs text-gray-400">(v{{ termsVersion }})</span>
          に同意する
        </span>
      </label>
      <label class="flex items-start gap-2 text-sm text-gray-700">
        <input
          v-model="agreePrivacy"
          type="checkbox"
          class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <span>
          <NuxtLink to="/privacy" target="_blank" class="text-primary-600 underline hover:text-primary-700">
            プライバシーポリシー
          </NuxtLink>
          <span class="ml-1 text-xs text-gray-400">(v{{ privacyVersion }})</span>
          に同意する
        </span>
      </label>
    </div>
  </div>
</template>
