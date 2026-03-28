<script setup lang="ts">
import type { Conversation } from "~~/shared/types/models";

definePageMeta({
  middleware: ["auth"],
});

const { apiFetch } = useApi();

const conversations = ref<Conversation[]>([]);
const loading = ref(true);

async function fetchConversations() {
  loading.value = true;
  try {
    conversations.value = await apiFetch<Conversation[]>("/api/conversations");
  } finally {
    loading.value = false;
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

onMounted(fetchConversations);
</script>

<template>
  <div class="mx-auto max-w-3xl p-4 sm:p-6">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900">会話履歴</h1>
      <NuxtLink to="/chat" class="text-sm text-primary-600 hover:underline">
        新しいチャット
      </NuxtLink>
    </div>

    <div v-if="loading" class="py-12 text-center text-sm text-gray-400">読み込み中...</div>

    <div v-else-if="conversations.length === 0" class="py-12 text-center text-sm text-gray-400">
      会話履歴がありません
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="conv in conversations"
        :key="conv.id"
        class="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-gray-900">{{ conv.title }}</p>
            <div class="mt-1 flex items-center gap-3 text-xs text-gray-500">
              <StatusBadge :status="conv.status" size="sm" />
              <span>{{ formatDate(conv.createdAt) }}</span>
              <span>{{ conv.messageCount }} メッセージ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
