<script setup lang="ts">
import type { Service } from "~~/shared/types/models";
import type { ChatSendResponse } from "~~/shared/types/api";

definePageMeta({});

const { apiFetch } = useApi();

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: import("~~/shared/types/models").MessageSource[];
  confidence?: number | null;
  formUrl?: string;
  messageId?: string;
  feedback?: "positive" | "negative" | null;
}

const services = ref<Service[]>([]);
const selectedServiceId = ref("");
const messages = ref<ChatMessage[]>([]);
const conversationId = ref<string | undefined>();
const sending = ref(false);
const formUrl = ref("");
const messagesContainer = ref<HTMLElement>();

// サービス一覧を取得
async function fetchServices() {
  try {
    const svcs = await apiFetch<Service[]>("/api/services");
    services.value = svcs.filter((s) => s.isActive);
    if (services.value.length > 0 && !selectedServiceId.value) {
      selectedServiceId.value = services.value[0].id;
      await fetchFormUrl(services.value[0].id);
    }
  } catch {
    // エラーハンドリング
  }
}

// 選択中のサービスに対応するフォームURLを取得
async function fetchFormUrl(serviceId: string) {
  try {
    const data = await apiFetch<{ formUrl: string }>(
      `/api/settings/form-url?serviceId=${serviceId}`,
    );
    formUrl.value = data.formUrl;
  } catch {
    formUrl.value = "";
  }
}

// メッセージ送信
async function handleSend(messageText: string) {
  if (!selectedServiceId.value || sending.value) return;

  // ユーザーメッセージを即座に表示
  messages.value.push({
    role: "user",
    content: messageText,
  });
  scrollToBottom();

  sending.value = true;
  try {
    const response = await apiFetch<ChatSendResponse>("/api/chat/send", {
      method: "POST",
      body: {
        conversationId: conversationId.value,
        serviceId: selectedServiceId.value,
        message: messageText,
      },
    });

    conversationId.value = response.conversationId;

    // アシスタントメッセージを表示
    messages.value.push({
      role: "assistant",
      content: response.message.content,
      sources: response.message.sources,
      confidence: response.message.confidence,
      formUrl: response.formUrl,
      messageId: response.message.id,
      feedback: null,
    });
  } catch {
    messages.value.push({
      role: "assistant",
      content:
        "申し訳ございません。エラーが発生しました。しばらく経ってからもう一度お試しください。",
    });
  } finally {
    sending.value = false;
    scrollToBottom();
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

// サービス変更時に会話をリセットしフォームURLを再取得
async function handleServiceChange() {
  messages.value = [];
  conversationId.value = undefined;
  if (selectedServiceId.value) {
    await fetchFormUrl(selectedServiceId.value);
  }
}

// フィードバック送信
async function handleFeedback(index: number, value: "positive" | "negative") {
  const msg = messages.value[index];
  if (!msg.messageId || !conversationId.value) return;

  const previousFeedback = msg.feedback;
  messages.value[index].feedback = value;

  try {
    await apiFetch("/api/chat/feedback", {
      method: "POST",
      body: {
        conversationId: conversationId.value,
        messageId: msg.messageId,
        feedback: value,
      },
    });
  } catch {
    // 失敗時はUI状態を戻す
    messages.value[index].feedback = previousFeedback;
  }
}

onMounted(fetchServices);
</script>

<template>
  <div class="flex h-[calc(100vh-3.5rem)] flex-col">
    <!-- ヘッダーバー -->
    <div class="flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-2">
      <label for="service-select" class="text-sm font-medium text-gray-600">サービス:</label>
      <select
        id="service-select"
        v-model="selectedServiceId"
        class="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        @change="handleServiceChange"
      >
        <option v-if="services.length === 0" value="" disabled>サービスがありません</option>
        <option v-for="svc in services" :key="svc.id" :value="svc.id">
          {{ svc.name }}
        </option>
      </select>
      <NuxtLink to="/chat/history" class="ml-auto text-sm text-primary-600 hover:underline">
        履歴
      </NuxtLink>
    </div>

    <!-- メッセージエリア -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-4">
      <!-- 空状態 -->
      <div
        v-if="messages.length === 0"
        class="flex h-full flex-col items-center justify-center text-center"
      >
        <svg
          class="mb-3 h-12 w-12 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
        <p class="text-sm text-gray-400">サービスを選択して質問してください</p>
      </div>

      <!-- メッセージ一覧 -->
      <div v-else class="mx-auto max-w-3xl space-y-4">
        <MessageBubble
          v-for="(msg, i) in messages"
          :key="i"
          :role="msg.role"
          :content="msg.content"
          :sources="msg.sources"
          :confidence="msg.confidence"
          :form-url="msg.formUrl"
          :message-id="msg.messageId"
          :feedback="msg.feedback"
          @feedback="(value) => handleFeedback(i, value)"
        />
        <!-- 送信中インジケーター -->
        <div v-if="sending" class="flex justify-start">
          <div class="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <div class="flex items-center gap-2 text-sm text-gray-400">
              <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              回答を生成中...
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 入力エリア -->
    <div class="border-t border-gray-200 bg-white px-4 py-3">
      <div class="mx-auto max-w-3xl">
        <MessageInput :disabled="!selectedServiceId || sending" @send="handleSend" />
      </div>
    </div>

    <!-- フォーム案内バナー -->
    <FormGuideBanner :form-url="formUrl" />
  </div>
</template>
