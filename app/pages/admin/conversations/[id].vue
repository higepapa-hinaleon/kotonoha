<script setup lang="ts">
import type { Conversation, Message, ImprovementRequest } from "~~/shared/types/models";

definePageMeta({
  layout: "admin",
  middleware: ["auth", "admin"],
});

const route = useRoute();
const { apiFetch } = useApi();
const { show } = useNotification();

const conversation = ref<Conversation | null>(null);
const messages = ref<Message[]>([]);
const loading = ref(true);

// 参照元の開閉状態（メッセージID → 開閉）
const openSources = ref(new Set<string>());
function toggleSources(msgId: string) {
  if (openSources.value.has(msgId)) {
    openSources.value.delete(msgId);
  } else {
    openSources.value.add(msgId);
  }
}

// フィードバック
const feedbackOpen = ref(false);
const feedbackLoading = ref(false);
const feedbackSaving = ref(false);
const existingImprovement = ref<ImprovementRequest | null>(null);
const feedbackCorrectedAnswer = ref("");
const feedbackNote = ref("");

async function fetchDetail() {
  loading.value = true;
  try {
    const data = await apiFetch<{ conversation: Conversation; messages: Message[] }>(
      `/api/conversations/${route.params.id}`,
    );
    conversation.value = data.conversation;
    messages.value = data.messages;
  } finally {
    loading.value = false;
  }
}

async function loadFeedback() {
  if (feedbackOpen.value) {
    feedbackOpen.value = false;
    return;
  }
  feedbackOpen.value = true;
  feedbackLoading.value = true;
  try {
    const items = await apiFetch<ImprovementRequest[]>(
      `/api/improvements?conversationId=${route.params.id}`,
    );
    if (items.length > 0) {
      existingImprovement.value = items[0];
      feedbackCorrectedAnswer.value = items[0].correctedAnswer || "";
      feedbackNote.value = items[0].adminNote || "";
    } else {
      existingImprovement.value = null;
      feedbackCorrectedAnswer.value = "";
      feedbackNote.value = "";
    }
  } catch (err) {
    console.error("[conversations] fetchDetail failed:", err);
  } finally {
    feedbackLoading.value = false;
  }
}

async function saveFeedback() {
  if (!conversation.value) return;
  feedbackSaving.value = true;
  try {
    if (existingImprovement.value) {
      // 既存の改善要望を更新
      const updated = await apiFetch<ImprovementRequest>(
        `/api/improvements/${existingImprovement.value.id}`,
        {
          method: "PUT",
          body: {
            correctedAnswer: feedbackCorrectedAnswer.value,
            adminNote: feedbackNote.value,
            status: feedbackCorrectedAnswer.value.trim() ? "resolved" : undefined,
          },
        },
      );
      existingImprovement.value = updated;
    } else {
      // 新規作成
      const created = await apiFetch<ImprovementRequest>("/api/improvements", {
        method: "POST",
        body: {
          conversationId: route.params.id,
          serviceId: conversation.value.serviceId,
          summary: conversation.value.title,
          correctedAnswer: feedbackCorrectedAnswer.value,
          adminNote: feedbackNote.value,
        },
      });
      existingImprovement.value = created;
    }
    show("フィードバックを保存しました", "success");
    await fetchDetail();
  } catch (err) {
    console.error("[conversations] saveFeedback failed:", err);
  } finally {
    feedbackSaving.value = false;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

onMounted(fetchDetail);
</script>

<template>
  <div>
    <NuxtLink
      to="/admin/conversations"
      class="mb-4 inline-block text-sm text-primary-600 hover:underline"
    >
      &larr; 一覧に戻る
    </NuxtLink>

    <div v-if="loading" class="py-12 text-center text-sm text-gray-400">読み込み中...</div>

    <template v-else-if="conversation">
      <div class="mb-6">
        <h1 class="text-xl font-bold text-gray-900">{{ conversation.title }}</h1>
        <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <StatusBadge :status="conversation.status" />
          <span
            v-if="conversation.userId === 'guest'"
            class="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700"
            >ウィジェット</span
          >
          <span>{{ formatDate(conversation.createdAt) }}</span>
          <span>{{ conversation.messageCount }} メッセージ</span>
        </div>
      </div>

      <!-- メッセージ一覧 -->
      <div class="space-y-4">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="rounded-lg border p-4"
          :class="msg.role === 'user' ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'"
        >
          <div class="mb-2 flex items-center justify-between">
            <span
              class="text-xs font-medium"
              :class="msg.role === 'user' ? 'text-blue-600' : 'text-gray-600'"
            >
              {{ msg.role === "user" ? "ユーザー" : "ボット" }}
            </span>
            <div class="flex items-center gap-2">
              <span
                v-if="msg.confidence !== null && msg.confidence !== undefined"
                class="text-xs text-gray-400"
              >
                確信度: {{ (msg.confidence * 100).toFixed(0) }}%
              </span>
              <span class="text-xs text-gray-400">{{ formatDate(msg.createdAt) }}</span>
            </div>
          </div>
          <MarkdownContent v-if="msg.role === 'assistant'" :content="msg.content" />
          <div v-else class="whitespace-pre-wrap text-sm text-gray-900">{{ msg.content }}</div>

          <!-- 参照元（開閉可能） -->
          <div
            v-if="msg.sources && msg.sources.length > 0"
            class="mt-3 border-t border-gray-100 pt-2"
          >
            <button
              class="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              @click="toggleSources(msg.id)"
            >
              <svg
                class="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              参照元 ({{ msg.sources.length }}件)
              <svg
                class="h-3 w-3 transition-transform"
                :class="openSources.has(msg.id) ? 'rotate-180' : ''"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div v-if="openSources.has(msg.id)" class="mt-2 space-y-2">
              <div
                v-for="(src, i) in msg.sources"
                :key="i"
                class="rounded-md bg-gray-50 px-3 py-2 text-xs"
              >
                <div class="font-medium text-gray-700">{{ src.documentTitle }}</div>
                <div v-if="src.chunkContent" class="mt-1 text-gray-500">
                  {{ src.chunkContent }}...
                </div>
                <div class="mt-1 text-gray-400">
                  類似度: {{ (src.similarity * 100).toFixed(0) }}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- フィードバックセクション -->
      <div class="mt-6">
        <button
          class="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          @click="loadFeedback"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
            />
          </svg>
          {{ feedbackOpen ? "フィードバックを閉じる" : "フィードバックを送信" }}
        </button>

        <div v-if="feedbackOpen" class="mt-3 rounded-lg border border-gray-200 bg-white p-5">
          <div v-if="feedbackLoading" class="py-6 text-center text-sm text-gray-400">
            読み込み中...
          </div>
          <template v-else>
            <div v-if="existingImprovement" class="mb-3 flex items-center gap-2">
              <span class="text-xs text-gray-500">既存のフィードバックがあります</span>
              <StatusBadge :status="existingImprovement.status" size="sm" />
            </div>
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-gray-600"
                  >正しい回答（AIへのフィードバック）</label
                >
                <p class="mt-0.5 text-xs text-gray-400">
                  AIが次回から参考にする正しい回答を記入してください。保存時にステータスが「完了」になり反映されます。
                </p>
                <textarea
                  v-model="feedbackCorrectedAnswer"
                  rows="4"
                  class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="正しい回答を入力..."
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600">対応メモ</label>
                <textarea
                  v-model="feedbackNote"
                  rows="2"
                  class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="所感やメモを入力..."
                />
              </div>
              <button
                :disabled="feedbackSaving"
                class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                @click="saveFeedback"
              >
                {{ feedbackSaving ? "保存中..." : "保存" }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
