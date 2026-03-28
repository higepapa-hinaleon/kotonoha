<script setup lang="ts">
import type { DashboardSummary, ServiceDashboardSummary } from "~~/shared/types/api";
import type { Conversation, Message, ImprovementRequest } from "~~/shared/types/models";

definePageMeta({
  layout: "admin",
  middleware: ["auth", "admin"],
});

const { apiFetch } = useApi();
const { show } = useNotification();
const { currentGroup, activeGroupId } = useGroup();

const summary = ref<DashboardSummary | null>(null);
const loading = ref(true);

// サービス詳細ビュー
const selectedServiceId = ref<string | null>(null);
const serviceSummary = ref<ServiceDashboardSummary | null>(null);
const serviceLoading = ref(false);

// フィードバックモーダル
const showFeedbackModal = ref(false);
const feedbackLoading = ref(false);
const feedbackSaving = ref(false);
const feedbackConversation = ref<Conversation | null>(null);
const feedbackMessages = ref<Message[]>([]);
const existingImprovement = ref<ImprovementRequest | null>(null);
const feedbackCorrectedAnswer = ref("");
const feedbackNote = ref("");

// 対話ログモーダル
const showConversationLogModal = ref(false);

function closeFeedbackModal() {
  showFeedbackModal.value = false;
}

function closeConversationLogModal() {
  showConversationLogModal.value = false;
}

async function fetchDashboard() {
  loading.value = true;
  selectedServiceId.value = null;
  serviceSummary.value = null;
  try {
    summary.value = await apiFetch<DashboardSummary>("/api/dashboard/summary");
  } catch {
    // useApi が自動通知
  } finally {
    loading.value = false;
  }
}

async function selectService(serviceId: string) {
  selectedServiceId.value = serviceId;
  serviceLoading.value = true;
  try {
    serviceSummary.value = await apiFetch<ServiceDashboardSummary>(
      `/api/dashboard/service-summary?serviceId=${serviceId}`,
    );
  } catch {
    selectedServiceId.value = null;
  } finally {
    serviceLoading.value = false;
  }
}

function backToGroupOverview() {
  selectedServiceId.value = null;
  serviceSummary.value = null;
}

async function openFeedbackModal(conversationId: string) {
  showFeedbackModal.value = true;
  feedbackLoading.value = true;
  feedbackConversation.value = null;
  feedbackMessages.value = [];
  existingImprovement.value = null;
  feedbackCorrectedAnswer.value = "";
  feedbackNote.value = "";
  try {
    const [convData, improvements] = await Promise.all([
      apiFetch<{ conversation: Conversation; messages: Message[] }>(`/api/conversations/${conversationId}`),
      apiFetch<ImprovementRequest[]>(`/api/improvements?conversationId=${conversationId}`),
    ]);
    feedbackConversation.value = convData.conversation;
    feedbackMessages.value = convData.messages;
    if (improvements.length > 0) {
      const first = improvements[0]!;
      existingImprovement.value = first;
      feedbackCorrectedAnswer.value = first.correctedAnswer || "";
      feedbackNote.value = first.adminNote || "";
    }
  } catch {
    showFeedbackModal.value = false;
  } finally {
    feedbackLoading.value = false;
  }
}

async function saveFeedback() {
  if (!feedbackConversation.value || feedbackSaving.value) return;
  feedbackSaving.value = true;
  try {
    if (existingImprovement.value) {
      await apiFetch(`/api/improvements/${existingImprovement.value.id}`, {
        method: "PUT",
        body: {
          correctedAnswer: feedbackCorrectedAnswer.value,
          adminNote: feedbackNote.value,
          status: feedbackCorrectedAnswer.value.trim() ? "resolved" : undefined,
        },
      });
    } else {
      const created = await apiFetch<ImprovementRequest>("/api/improvements", {
        method: "POST",
        body: {
          conversationId: feedbackConversation.value.id,
          serviceId: feedbackConversation.value.serviceId,
          summary: feedbackConversation.value.title,
          correctedAnswer: feedbackCorrectedAnswer.value,
          adminNote: feedbackNote.value,
        },
      });
      existingImprovement.value = created;
    }
    show("フィードバックを保存しました", "success");
    closeConversationLogModal();
    closeFeedbackModal();
    if (selectedServiceId.value) {
      await selectService(selectedServiceId.value);
    } else {
      await fetchDashboard();
    }
  } catch {
    // useApi が自動通知
  } finally {
    feedbackSaving.value = false;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

// 初回マウント時＋グループ切替時にダッシュボードを取得
watch(activeGroupId, () => fetchDashboard(), { immediate: true });
</script>

<template>
  <div>
    <!-- サービス詳細ビュー -->
    <template v-if="selectedServiceId">
      <div class="mb-6">
        <button
          class="mb-2 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800"
          @click="backToGroupOverview"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          グループ概要に戻る
        </button>
        <h1 class="text-xl font-bold text-gray-900">
          {{ serviceSummary?.serviceName || '読み込み中...' }}
        </h1>
        <p class="text-sm text-gray-500">サービス別ダッシュボード</p>
      </div>

      <div v-if="serviceLoading" class="py-12 text-center text-sm text-gray-400">読み込み中...</div>

      <template v-else-if="serviceSummary">
        <!-- サービス KPI カード -->
        <div class="mb-8 grid gap-4 sm:grid-cols-3">
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <p class="text-xs font-medium uppercase tracking-wider text-gray-500">会話数</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ serviceSummary.totalConversations }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Bot解決率</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ (serviceSummary.resolutionRate * 100).toFixed(1) }}%</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <p class="text-xs font-medium uppercase tracking-wider text-gray-500">未対応の改善要望</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ serviceSummary.improvementRequestCount }}</p>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <!-- 会話トレンド -->
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <h2 class="mb-4 text-sm font-semibold text-gray-900">直近7日間の会話数</h2>
            <div class="flex items-end gap-2" style="height: 120px">
              <div
                v-for="item in serviceSummary.conversationTrend"
                :key="item.date"
                class="flex flex-1 flex-col items-center gap-1"
              >
                <span class="text-xs font-medium text-gray-700">{{ item.count }}</span>
                <div
                  class="w-full rounded-t bg-primary-500"
                  :style="{
                    height: `${Math.max(4, (item.count / Math.max(...serviceSummary!.conversationTrend.map((t) => t.count), 1)) * 80)}px`,
                  }"
                />
                <span class="text-[10px] text-gray-400">{{ formatDateShort(item.date) }}</span>
              </div>
            </div>
          </div>

          <!-- 未解決の会話 -->
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <h2 class="mb-4 text-sm font-semibold text-gray-900">エスカレーション済み（未解決）</h2>
            <div v-if="serviceSummary.recentUnresolved.length === 0" class="py-4 text-center text-sm text-gray-400">
              未解決の会話はありません
            </div>
            <div v-else class="divide-y divide-gray-100">
              <div
                v-for="item in serviceSummary.recentUnresolved"
                :key="item.id"
                class="flex items-center gap-3 py-3 hover:bg-gray-50"
              >
                <NuxtLink :to="`/admin/conversations/${item.id}`" class="min-w-0 flex-1">
                  <span class="block truncate text-sm text-gray-900">{{ item.title }}</span>
                  <span class="text-xs text-gray-400">{{ formatDate(item.createdAt) }}</span>
                </NuxtLink>
                <button
                  class="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  @click="openFeedbackModal(item.id)"
                >
                  フィードバック
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- グループ概要ビュー -->
    <template v-else>
      <h1 class="mb-6 text-xl font-bold text-gray-900">
        ダッシュボード
        <span v-if="currentGroup" class="text-base font-normal text-gray-500">- {{ currentGroup.name }}</span>
      </h1>

      <div v-if="loading" class="py-12 text-center text-sm text-gray-400">読み込み中...</div>

      <template v-else-if="summary">
        <!-- KPI カード -->
        <div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <p class="text-xs font-medium uppercase tracking-wider text-gray-500">総会話数</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ summary.totalConversations }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Bot解決率</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ (summary.resolutionRate * 100).toFixed(1) }}%</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <p class="text-xs font-medium uppercase tracking-wider text-gray-500">未対応の改善要望</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">{{ summary.improvementRequestCount }}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <p class="text-xs font-medium uppercase tracking-wider text-gray-500">直近7日間</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">
              {{ summary.conversationTrend.reduce((sum, t) => sum + t.count, 0) }}
            </p>
            <p class="text-xs text-gray-400">件の会話</p>
          </div>
        </div>

        <!-- 会話トレンド -->
        <div class="mb-6 rounded-lg border border-gray-200 bg-white p-5">
          <h2 class="mb-4 text-sm font-semibold text-gray-900">直近7日間の会話数</h2>
          <div class="flex items-end gap-2" style="height: 120px">
            <div
              v-for="item in summary.conversationTrend"
              :key="item.date"
              class="flex flex-1 flex-col items-center gap-1"
            >
              <span class="text-xs font-medium text-gray-700">{{ item.count }}</span>
              <div
                class="w-full rounded-t bg-primary-500"
                :style="{
                  height: `${Math.max(4, (item.count / Math.max(...summary!.conversationTrend.map((t) => t.count), 1)) * 80)}px`,
                }"
              />
              <span class="text-[10px] text-gray-400">{{ formatDateShort(item.date) }}</span>
            </div>
          </div>
        </div>

        <!-- サービス別カード -->
        <div class="mb-6">
          <h2 class="mb-4 text-sm font-semibold text-gray-900">サービス別</h2>
          <div v-if="summary.serviceDistribution.length === 0" class="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
            データがありません
          </div>
          <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button
              v-for="svc in summary.serviceDistribution"
              :key="svc.serviceId"
              class="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
              @click="selectService(svc.serviceId)"
            >
              <div class="mb-3 flex items-center justify-between">
                <span class="truncate text-sm font-semibold text-gray-900">{{ svc.serviceName }}</span>
                <svg class="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div class="flex items-center gap-4">
                <div>
                  <p class="text-xs text-gray-500">会話数</p>
                  <p class="text-lg font-bold text-gray-900">{{ svc.count }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">Bot解決率</p>
                  <p class="text-lg font-bold text-gray-900">{{ (svc.resolutionRate * 100).toFixed(0) }}%</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <!-- 未解決の会話 -->
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <h2 class="mb-4 text-sm font-semibold text-gray-900">エスカレーション済み（未解決）</h2>
            <div v-if="summary.recentUnresolved.length === 0" class="py-4 text-center text-sm text-gray-400">
              未解決の会話はありません
            </div>
            <div v-else class="divide-y divide-gray-100">
              <div
                v-for="item in summary.recentUnresolved"
                :key="item.id"
                class="flex items-center gap-3 py-3 hover:bg-gray-50"
              >
                <NuxtLink :to="`/admin/conversations/${item.id}`" class="min-w-0 flex-1">
                  <span class="block truncate text-sm text-gray-900">{{ item.title }}</span>
                  <span class="text-xs text-gray-400">{{ formatDate(item.createdAt) }}</span>
                </NuxtLink>
                <button
                  class="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  @click="openFeedbackModal(item.id)"
                >
                  フィードバック
                </button>
              </div>
            </div>
          </div>

          <!-- ドキュメント利用状況 -->
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <h2 class="mb-4 text-sm font-semibold text-gray-900">ドキュメント利用状況</h2>
            <div v-if="summary.topReferencedDocs.length === 0 && summary.unreferencedDocCount === 0" class="py-4 text-center text-sm text-gray-400">
              ドキュメントがありません
            </div>
            <template v-else>
              <div v-if="summary.topReferencedDocs.length > 0" class="mb-3">
                <p class="mb-2 text-xs font-medium text-gray-500">参照回数の多いドキュメント</p>
                <div class="space-y-1.5">
                  <div v-for="doc in summary.topReferencedDocs" :key="doc.id" class="flex items-center justify-between text-sm">
                    <NuxtLink :to="`/admin/documents/${doc.id}`" class="truncate text-gray-700 hover:text-primary-600">{{ doc.title }}</NuxtLink>
                    <span class="ml-2 shrink-0 text-xs text-gray-400">{{ doc.referenceCount }}回</span>
                  </div>
                </div>
              </div>
              <div v-if="summary.unreferencedDocCount > 0">
                <p class="text-xs font-medium text-gray-500">
                  未参照ドキュメント: <span class="text-amber-600">{{ summary.unreferencedDocCount }}件</span>
                </p>
              </div>
            </template>
          </div>
        </div>
      </template>
    </template>

    <!-- フィードバックモーダル -->
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
          v-if="showFeedbackModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-gray-600/75 p-4"
          @click.self="closeFeedbackModal"
        >
          <div class="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl">
            <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 class="text-lg font-semibold text-gray-900">フィードバック</h3>
              <button aria-label="閉じる" class="text-gray-400 hover:text-gray-600" @click="closeFeedbackModal">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="flex-1 overflow-y-auto px-6 py-4">
              <div v-if="feedbackLoading" class="py-12 text-center text-sm text-gray-400">読み込み中...</div>
              <template v-else-if="feedbackConversation">
                <p class="mb-1 text-sm font-medium text-gray-900">{{ feedbackConversation.title }}</p>
                <div class="mb-4 flex items-center gap-2">
                  <StatusBadge :status="feedbackConversation.status" size="sm" />
                  <span class="text-xs text-gray-400">{{ formatDate(feedbackConversation.createdAt) }}</span>
                </div>

                <div v-if="existingImprovement" class="mb-4 flex items-center gap-2">
                  <span class="text-xs text-gray-500">既存のフィードバックがあります</span>
                  <StatusBadge :status="existingImprovement.status" size="sm" />
                </div>

                <button
                  class="mb-4 flex items-center gap-1.5 text-sm text-primary-600 hover:underline"
                  @click="showConversationLogModal = true"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  対話ログを見る
                </button>

                <div class="space-y-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-600">正しい回答（AIへのフィードバック）</label>
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
        </div>
      </Transition>
    </Teleport>

    <!-- 対話ログモーダル（フィードバックモーダルの上に表示） -->
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
          v-if="showConversationLogModal"
          class="fixed inset-0 z-[60] flex items-center justify-center bg-gray-600/75 p-4"
          @click.self="showConversationLogModal = false"
        >
          <div class="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
            <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 class="text-lg font-semibold text-gray-900">
                {{ feedbackConversation?.title || "対話ログ" }}
              </h3>
              <button aria-label="閉じる" class="text-gray-400 hover:text-gray-600" @click="showConversationLogModal = false">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="flex-1 overflow-y-auto px-6 py-4">
              <div v-if="feedbackMessages.length === 0" class="py-12 text-center text-sm text-gray-400">メッセージがありません</div>
              <div v-else class="space-y-3">
                <div
                  v-for="msg in feedbackMessages"
                  :key="msg.id"
                  class="rounded-lg border p-3"
                  :class="msg.role === 'user' ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'"
                >
                  <div class="mb-1.5 flex items-center justify-between">
                    <span class="text-xs font-medium" :class="msg.role === 'user' ? 'text-blue-600' : 'text-gray-600'">
                      {{ msg.role === "user" ? "ユーザー" : "ボット" }}
                    </span>
                    <div class="flex items-center gap-2">
                      <span v-if="msg.confidence !== null && msg.confidence !== undefined" class="text-xs text-gray-400">
                        確信度: {{ (msg.confidence * 100).toFixed(0) }}%
                      </span>
                      <span class="text-xs text-gray-400">{{ formatDate(msg.createdAt) }}</span>
                    </div>
                  </div>
                  <MarkdownContent v-if="msg.role === 'assistant'" :content="msg.content" />
                  <div v-else class="whitespace-pre-wrap text-sm text-gray-900">{{ msg.content }}</div>

                  <div v-if="msg.sources && msg.sources.length > 0" class="mt-2 border-t border-gray-100 pt-1.5">
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
