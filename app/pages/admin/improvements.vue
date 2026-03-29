<script setup lang="ts">
import type { ImprovementRequest, Service, Conversation, Message } from "~~/shared/types/models";

definePageMeta({
  layout: "admin",
  middleware: ["auth", "admin"],
});

const { apiFetch } = useApi();
const { show } = useNotification();

const improvements = ref<ImprovementRequest[]>([]);
const services = ref<Service[]>([]);
const loading = ref(true);
const filterStatus = ref("");
const filterServiceId = ref("");

// 詳細パネル
const selectedItem = ref<ImprovementRequest | null>(null);
const editPriority = ref<string>("");
const editStatus = ref<string>("");
const editNote = ref("");
const editCorrectedAnswer = ref("");
const saving = ref(false);

// AI自動分類
const categorizing = ref(false);
const lastCategorizedCount = ref<number | null>(null);

// 会話プレビューモーダル
const showConversationModal = ref(false);
const conversationLoading = ref(false);
const modalConversation = ref<Conversation | null>(null);
const modalMessages = ref<Message[]>([]);

async function handleCategorize() {
  categorizing.value = true;
  lastCategorizedCount.value = null;
  try {
    const result = await apiFetch<{ categorized: number }>("/api/improvements/categorize", {
      method: "POST",
    });
    lastCategorizedCount.value = result.categorized;
    show(`${result.categorized}件を分類しました`, "success");
    await fetchData();
  } catch {
    // useApi が自動通知
  } finally {
    categorizing.value = false;
  }
}

async function fetchData() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filterStatus.value) params.set("status", filterStatus.value);
    if (filterServiceId.value) params.set("serviceId", filterServiceId.value);

    const [items, svcs] = await Promise.all([
      apiFetch<ImprovementRequest[]>(`/api/improvements?${params}`),
      apiFetch<Service[]>("/api/services"),
    ]);
    improvements.value = items;
    services.value = svcs;
  } catch {
    // useApi が自動通知
  } finally {
    loading.value = false;
  }
}

function selectItem(item: ImprovementRequest) {
  selectedItem.value = item;
  editPriority.value = item.priority;
  editStatus.value = item.status;
  editNote.value = item.adminNote;
  editCorrectedAnswer.value = item.correctedAnswer || "";
}

async function handleSave() {
  if (!selectedItem.value) return;
  saving.value = true;
  try {
    await apiFetch(`/api/improvements/${selectedItem.value.id}`, {
      method: "PUT",
      body: {
        priority: editPriority.value,
        status: editStatus.value,
        adminNote: editNote.value,
        correctedAnswer: editCorrectedAnswer.value,
      },
    });
    show("改善要望を更新しました", "success");
    selectedItem.value = null;
    await fetchData();
  } catch {
    // useApi が自動通知
  } finally {
    saving.value = false;
  }
}

async function openConversationModal(conversationId: string) {
  showConversationModal.value = true;
  conversationLoading.value = true;
  modalConversation.value = null;
  modalMessages.value = [];
  try {
    const data = await apiFetch<{ conversation: Conversation; messages: Message[] }>(
      `/api/conversations/${conversationId}`,
    );
    modalConversation.value = data.conversation;
    modalMessages.value = data.messages;
  } catch {
    // useApi が自動通知
    showConversationModal.value = false;
  } finally {
    conversationLoading.value = false;
  }
}

function getServiceName(serviceId: string): string {
  return services.value.find((s) => s.id === serviceId)?.name || "不明";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const categoryLabels: Record<string, string> = {
  missing_docs: "資料不足",
  unclear_docs: "不明瞭",
  new_feature: "新機能",
  other: "その他",
};

function parseSummary(summary: string) {
  const match = summary.match(/^(.+?)\s*\(確信度:\s*([0-9.]+)\):\s*(.+)$/s);
  if (match) {
    return { reason: match[1].trim(), confidence: parseFloat(match[2]), question: match[3].trim() };
  }
  return { reason: null, confidence: null, question: summary };
}

function confidenceColor(value: number): string {
  if (value >= 0.7) return "bg-green-100 text-green-700";
  if (value >= 0.4) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

watch([filterStatus, filterServiceId], () => fetchData());
onMounted(fetchData);
</script>

<template>
  <div>
    <h1 class="mb-6 text-xl font-bold text-gray-900">改善要望管理</h1>

    <div class="mb-4 flex flex-wrap gap-3">
      <select v-model="filterStatus" class="rounded-md border border-gray-300 px-3 py-2 text-sm">
        <option value="">全ステータス</option>
        <option value="open">未着手</option>
        <option value="in_progress">対応中</option>
        <option value="resolved">完了</option>
        <option value="dismissed">却下</option>
      </select>
      <select v-model="filterServiceId" class="rounded-md border border-gray-300 px-3 py-2 text-sm">
        <option value="">全サービス</option>
        <option v-for="svc in services" :key="svc.id" :value="svc.id">{{ svc.name }}</option>
      </select>
      <button
        :disabled="categorizing"
        class="rounded-md border border-primary-600 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 disabled:opacity-50"
        @click="handleCategorize"
      >
        {{ categorizing ? "分類中..." : "AI自動分類" }}
      </button>
    </div>

    <div class="grid gap-6 lg:grid-cols-5">
      <!-- 一覧（カード型） -->
      <div class="lg:col-span-2">
        <div
          class="max-h-[calc(100vh-220px)] overflow-y-auto rounded-lg border border-gray-200 bg-white"
        >
          <div v-if="loading" class="px-4 py-12 text-center text-sm text-gray-400">
            読み込み中...
          </div>
          <div
            v-else-if="improvements.length === 0"
            class="px-4 py-12 text-center text-sm text-gray-400"
          >
            改善要望がありません
          </div>
          <div v-else>
            <div
              v-for="item in improvements"
              :key="item.id"
              class="cursor-pointer border-b border-gray-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-gray-50"
              :class="
                selectedItem?.id === item.id
                  ? 'border-l-2 !border-l-primary-500 bg-primary-50'
                  : 'border-l-2 border-l-transparent'
              "
              @click="selectItem(item)"
            >
              <p class="line-clamp-2 text-sm text-gray-900">
                {{ parseSummary(item.summary).question }}
              </p>
              <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  v-if="parseSummary(item.summary).reason"
                  class="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                >
                  {{ parseSummary(item.summary).reason }}
                </span>
                <span
                  v-if="parseSummary(item.summary).confidence !== null"
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="confidenceColor(parseSummary(item.summary).confidence!)"
                >
                  確信度 {{ (parseSummary(item.summary).confidence! * 100).toFixed(0) }}%
                </span>
                <StatusBadge :status="item.status" size="sm" />
                <StatusBadge :status="item.priority" size="sm" />
                <span class="ml-auto text-xs text-gray-400">{{ formatDate(item.createdAt) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 詳細パネル -->
      <div v-if="selectedItem" class="rounded-lg border border-gray-200 bg-white p-5 lg:col-span-3">
        <h3 class="mb-3 text-sm font-semibold text-gray-900">詳細</h3>
        <p class="mb-3 text-sm text-gray-900">{{ parseSummary(selectedItem.summary).question }}</p>
        <div
          v-if="parseSummary(selectedItem.summary).reason"
          class="mb-3 flex flex-wrap items-center gap-2"
        >
          <span
            class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700"
          >
            {{ parseSummary(selectedItem.summary).reason }}
          </span>
          <span
            v-if="parseSummary(selectedItem.summary).confidence !== null"
            class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            :class="confidenceColor(parseSummary(selectedItem.summary).confidence!)"
          >
            確信度 {{ (parseSummary(selectedItem.summary).confidence! * 100).toFixed(0) }}%
          </span>
        </div>

        <div class="mb-3 text-xs text-gray-500">
          <p>サービス: {{ getServiceName(selectedItem.serviceId) }}</p>
          <p>分類: {{ categoryLabels[selectedItem.category] }}</p>
          <p>登録日: {{ formatDate(selectedItem.createdAt) }}</p>
          <button
            class="mt-1 text-primary-600 hover:underline"
            @click="openConversationModal(selectedItem.conversationId)"
          >
            元の会話を見る
          </button>
        </div>

        <div class="space-y-3">
          <div class="flex gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-600">優先度</label>
              <select
                v-model="editPriority"
                class="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600">ステータス</label>
              <select
                v-model="editStatus"
                class="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="open">未着手</option>
                <option value="in_progress">対応中</option>
                <option value="resolved">完了</option>
                <option value="dismissed">却下</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600">対応メモ</label>
            <textarea
              v-model="editNote"
              rows="2"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="対応内容をメモ..."
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600">訂正情報</label>
            <p class="mt-0.5 text-xs text-gray-400">
              AIが次回以降の回答生成時に優先参照する訂正情報を記入してください。ステータスを「完了」にすると反映されます。
            </p>
            <textarea
              v-model="editCorrectedAnswer"
              rows="4"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="訂正情報を入力..."
            />
          </div>
          <button
            :disabled="saving"
            class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            @click="handleSave"
          >
            {{ saving ? "保存中..." : "保存" }}
          </button>
        </div>
      </div>
      <div
        v-else
        class="flex items-center justify-center rounded-lg border border-dashed border-gray-300 p-12 lg:col-span-3"
      >
        <p class="text-sm text-gray-400">要望を選択してください</p>
      </div>
    </div>

    <!-- 会話プレビューモーダル -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showConversationModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-gray-600/75 p-4"
          @click.self="showConversationModal = false"
        >
          <div class="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
            <!-- ヘッダー -->
            <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 class="text-lg font-semibold text-gray-900">
                  {{ modalConversation?.title || "会話詳細" }}
                </h3>
                <div v-if="modalConversation" class="mt-1 flex items-center gap-2">
                  <StatusBadge :status="modalConversation.status" size="sm" />
                  <span class="text-xs text-gray-400">{{
                    formatDate(modalConversation.createdAt)
                  }}</span>
                </div>
              </div>
              <button
                class="text-gray-400 hover:text-gray-600"
                @click="showConversationModal = false"
              >
                <svg
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- メッセージ一覧 -->
            <div class="flex-1 overflow-y-auto px-6 py-4">
              <div v-if="conversationLoading" class="py-12 text-center text-sm text-gray-400">
                読み込み中...
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="msg in modalMessages"
                  :key="msg.id"
                  class="rounded-lg border p-3"
                  :class="
                    msg.role === 'user' ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
                  "
                >
                  <div class="mb-1.5 flex items-center justify-between">
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
                  <div v-else class="whitespace-pre-wrap text-sm text-gray-900">
                    {{ msg.content }}
                  </div>

                  <div
                    v-if="msg.sources && msg.sources.length > 0"
                    class="mt-2 border-t border-gray-100 pt-1.5"
                  >
                    <p class="mb-0.5 text-xs font-medium text-gray-500">参照元:</p>
                    <div v-for="(src, i) in msg.sources" :key="i" class="text-xs text-gray-400">
                      {{ src.documentTitle }} (類似度: {{ (src.similarity * 100).toFixed(0) }}%)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
