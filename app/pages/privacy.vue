<script setup lang="ts">
import type { LegalDocumentVersion } from "~~/shared/types/legal";

definePageMeta({ layout: false });

const loading = ref(true);
const content = ref("");
const error = ref("");

onMounted(async () => {
  try {
    // 最新バージョンを取得
    const current = await $fetch<{ privacy: { version: string } | null }>("/api/legal/current");
    const version = current.privacy?.version ?? "1.0";
    const doc = await $fetch<LegalDocumentVersion>(`/api/legal/privacy/${version}`);
    content.value = doc.content;
  } catch {
    error.value = "プライバシーポリシーの読み込みに失敗しました。";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="border-b border-gray-200 bg-white">
      <div class="mx-auto flex h-14 max-w-3xl items-center px-4">
        <NuxtLink to="/" class="text-lg font-bold text-primary-600">kotonoha AI Support</NuxtLink>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-8">
      <div v-if="loading" class="flex justify-center py-12">
        <svg
          class="h-8 w-8 animate-spin text-primary-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
      <div v-else-if="error" class="rounded-md bg-red-50 p-4 text-sm text-red-600">
        {{ error }}
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <article v-else class="prose prose-gray max-w-none rounded-lg bg-white p-8 shadow-sm" v-html="content" />
    </main>
  </div>
</template>
