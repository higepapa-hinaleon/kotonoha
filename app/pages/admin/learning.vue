<script setup lang="ts">
import type { Service, ImprovementRequest } from "~~/shared/types/models";
import type { ChatSendResponse } from "~~/shared/types/api";

definePageMeta({
  layout: "admin",
  middleware: ["auth", "admin"],
});

const { apiFetch } = useApi();
const { show } = useNotification();

interface LearningMessage {
  role: "user" | "assistant";
  content: string;
  sources?: import("~~/shared/types/models").MessageSource[];
  confidence?: number | null;
  /** 訂正済みフラグ */
  corrected?: boolean;
  /** このメッセージの元になったユーザー質問 */
  userQuestion?: string;
}

const services = ref<Service[]>([]);
const selectedServiceId = ref("");
const messages = ref<LearningMessage[]>([]);
const conversationId = ref<string | undefined>();
const sending = ref(false);
const messagesContainer = ref<HTMLElement>();

// 訂正UI用
const correctingIndex = ref<number | null>(null);
const correctionText = ref("");
const submittingCorrection = ref(false);

async function fetchServices() {
  try {
    const svcs = await apiFetch<Service[]>("/api/services");
    services.value = svcs.filter((s) => s.isActive);
    if (services.value.length > 0 && !selectedServiceId.value) {
      selectedServiceId.value = services.value[0].id;
    }
  } catch {
    // useApi が自動通知
  }
}

async function handleSend(messageText: string) {
  if (!selectedServiceId.value || sending.value) return;

  messages.value.push({ role: "user", content: messageText });
  scrollToBottom();

  sending.value = true;
  try {
    const response = await apiFetch<ChatSendResponse>("/api/chat/learn", {
      method: "POST",
      body: {
        conversationId: conversationId.value,
        serviceId: selectedServiceId.value,
        message: messageText,
      },
    });

    conversationId.value = response.conversationId;

    messages.value.push({
      role: "assistant",
      content: response.message.content,
      sources: response.message.sources,
      confidence: response.message.confidence,
      userQuestion: messageText,
    });
  } catch {
    messages.value.push({
      role: "assistant",
      content: "エラーが発生しました。再度お試しください。",
    });
  } finally {
    sending.value = false;
    scrollToBottom();
  }
}

function startCorrection(index: number) {
  correctingIndex.value = index;
  correctionText.value = "";
  nextTick(() => {
    scrollToBottom();
  });
}

function cancelCorrection() {
  correctingIndex.value = null;
  correctionText.value = "";
}

async function submitCorrection(index: number) {
  const msg = messages.value[index];
  if (!msg || !correctionText.value.trim() || !conversationId.value) return;

  submittingCorrection.value = true;
  try {
    await apiFetch<ImprovementRequest>("/api/improvements", {
      method: "POST",
      body: {
        conversationId: conversationId.value,
        serviceId: selectedServiceId.value,
        summary: msg.userQuestion || "管理者による教育モードでの訂正",
        originalQuestion: msg.userQuestion,
        correctedAnswer: correctionText.value.trim(),
        adminNote: "教育モードからの訂正",
      },
    });

    messages.value[index] = { ...msg, corrected: true };
    correctingIndex.value = null;
    correctionText.value = "";
    show("訂正を学習しました", "success");
  } catch {
    // useApi が自動通知
  } finally {
    submittingCorrection.value = false;
  }
}

function resetConversation() {
  messages.value = [];
  conversationId.value = undefined;
  correctingIndex.value = null;
  correctionText.value = "";
}

function handleServiceChange() {
  resetConversation();
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

onMounted(fetchServices);
</script>

<template>
  <div class="flex h-[calc(100vh-7rem)] flex-col">
    <!-- ヘッダー -->
    <div class="flex items-center gap-4 rounded-t-lg border border-gray-200 bg-white px-4 py-3">
      <div class="flex items-center gap-2">
        <span
          class="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
        >
          教育モード
        </span>
      </div>
      <div class="flex items-center gap-2">
        <label for="learn-service-select" class="text-sm font-medium text-gray-600"
          >サービス:</label
        >
        <select
          id="learn-service-select"
          v-model="selectedServiceId"
          class="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          @change="handleServiceChange"
        >
          <option v-if="services.length === 0" value="" disabled>サービスがありません</option>
          <option v-for="svc in services" :key="svc.id" :value="svc.id">
            {{ svc.name }}
          </option>
        </select>
      </div>
      <button
        v-if="messages.length > 0"
        class="ml-auto rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        @click="resetConversation"
      >
        新しい会話
      </button>
    </div>

    <!-- メッセージエリア -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto border-x border-gray-200 bg-gray-50 px-4 py-4"
    >
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
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
        <p class="text-sm font-medium text-gray-500">ボットに質問して回答を確認してください</p>
        <p class="mt-1 text-xs text-gray-400">
          回答が不正確な場合は「訂正する」から訂正情報を追加できます。AIは次回以降、訂正情報を優先して回答を生成します
        </p>
      </div>

      <!-- メッセージ一覧 -->
      <div v-else class="mx-auto max-w-3xl space-y-4">
        <template v-for="(msg, i) in messages" :key="i">
          <MessageBubble
            :role="msg.role"
            :content="msg.content"
            :sources="msg.sources"
            :confidence="msg.confidence"
          />

          <!-- アシスタントメッセージ後の訂正UI -->
          <div v-if="msg.role === 'assistant' && msg.userQuestion" class="flex justify-start pl-2">
            <div class="max-w-[85%] sm:max-w-[75%]">
              <!-- 訂正済み -->
              <div v-if="msg.corrected" class="flex items-center gap-1.5 text-xs text-green-600">
                <svg
                  class="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                訂正済み
              </div>

              <!-- 訂正フォーム -->
              <div
                v-else-if="correctingIndex === i"
                class="mt-1 rounded-lg border border-amber-200 bg-amber-50 p-3"
              >
                <p class="mb-2 text-xs font-medium text-amber-800">訂正情報を入力してください：</p>
                <textarea
                  v-model="correctionText"
                  rows="4"
                  class="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="訂正情報を入力..."
                />
                <div class="mt-2 flex justify-end gap-2">
                  <button
                    class="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                    :disabled="submittingCorrection"
                    @click="cancelCorrection"
                  >
                    キャンセル
                  </button>
                  <button
                    class="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                    :disabled="!correctionText.trim() || submittingCorrection"
                    @click="submitCorrection(i)"
                  >
                    {{ submittingCorrection ? "保存中..." : "学習させる" }}
                  </button>
                </div>
              </div>

              <!-- 訂正ボタン -->
              <button
                v-else
                class="mt-1 flex items-center gap-1 text-xs text-gray-400 hover:text-amber-600"
                :disabled="sending"
                @click="startCorrection(i)"
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
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                訂正する
              </button>
            </div>
          </div>
        </template>

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
    <div class="rounded-b-lg border border-gray-200 bg-white px-4 py-3">
      <div class="mx-auto max-w-3xl">
        <MessageInput :disabled="!selectedServiceId || sending" @send="handleSend" />
      </div>
    </div>
  </div>
</template>
