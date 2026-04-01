<script setup lang="ts">
import type { DashboardSummary, ServiceDashboardSummary } from "~~/shared/types/api";
import type { Conversation, Message, ImprovementRequest, Application } from "~~/shared/types/models";
import { PLAN_DEFINITIONS } from "~~/shared/plans";
import { BANK_TRANSFER_INFO } from "~~/shared/bank-transfer";

definePageMeta({
  layout: "admin",
  middleware: ["auth", "admin"],
});

const { apiFetch } = useApi();
const { show } = useNotification();
const { currentGroup, activeGroupId } = useGroup();
const route = useRoute();
const { user, hasOrganization, isPendingPayment, hasPendingApplication, fetchPendingApplication, fetchUser } = useAuth();

// --- 承認待ちビュー ---
const pendingApp = ref<Application | null>(null);
const pendingLoading = ref(true);
let pendingRefreshTimer: ReturnType<typeof setInterval> | null = null;

const isPendingView = computed(
  () => (!hasOrganization.value && hasPendingApplication.value) || isPendingPayment.value,
);
const pendingPlan = computed(() => {
  const planId = pendingApp.value?.planId;
  return planId ? PLAN_DEFINITIONS[planId] : null;
});

const pendingStatusDisplay = computed(() => {
  const app = pendingApp.value;
  if (!app) return null;

  if (app.status === "pending") {
    return { type: "pending" as const, title: "申請を受け付けました", message: "審査完了までお待ちください。" };
  }
  if (app.status === "approved" && app.paymentMethod === "bank_transfer") {
    return { type: "payment" as const, title: "申請が承認されました", message: "お振込みの確認をお待ちしています。" };
  }
  if (app.status === "rejected") {
    return { type: "rejected" as const, title: "申請が承認されませんでした", message: app.reviewNote || "審査の結果、今回はご利用いただけません。" };
  }
  return null;
});

async function fetchPendingApp() {
  try {
    const app = await fetchPendingApplication(true);
    pendingApp.value = app;

    // 承認された場合、ユーザー情報を更新して通常ダッシュボードに切替
    if (pendingApp.value?.status === "approved" && pendingApp.value.paymentMethod !== "bank_transfer") {
      stopPendingRefresh();
      await fetchUser();
    }

    // 入金待ち状態: ユーザー情報を再取得して契約ステータス変化を検知
    if (isPendingPayment.value) {
      await fetchUser();
      if (!isPendingPayment.value) {
        stopPendingRefresh();
      }
    }
  } catch (err) {
    console.error("[dashboard] fetchPendingApp failed:", err);
  } finally {
    pendingLoading.value = false;
  }
}

// Stripe checkout 成功時の通知
if (route.query.checkout === "success") {
  show("決済情報の登録が完了しました。", "success");
}

function startPendingRefresh() {
  stopPendingRefresh();
  pendingRefreshTimer = setInterval(fetchPendingApp, 30000);
}

function stopPendingRefresh() {
  if (pendingRefreshTimer) {
    clearInterval(pendingRefreshTimer);
    pendingRefreshTimer = null;
  }
}

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
  } catch (err) {
    console.error("[dashboard] fetchDashboard failed:", err);
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
  } catch (err) {
    console.error("[dashboard] selectService failed:", err);
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
      apiFetch<{ conversation: Conversation; messages: Message[] }>(
        `/api/conversations/${conversationId}`,
      ),
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
  } catch (err) {
    console.error("[dashboard] openFeedbackModal failed:", err);
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
  } catch (err) {
    console.error("[dashboard] saveFeedback failed:", err);
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

// 承認待ちビューの初期化: isPendingView が true になったら開始、false になったら停止して通常ダッシュボードを取得
watch(isPendingView, (pending, oldPending) => {
  if (pending) {
    fetchPendingApp().then(() => startPendingRefresh());
  } else {
    stopPendingRefresh();
    // 初回ロード時（oldPending === undefined）は activeGroupId watcher が fetchDashboard を呼ぶため除外
    if (oldPending) {
      fetchDashboard();
    }
  }
}, { immediate: true });

// 初回マウント時＋グループ切替時にダッシュボードを取得（通常ビューのみ）
watch(activeGroupId, () => {
  if (!isPendingView.value) {
    fetchDashboard();
  }
}, { immediate: true });

onUnmounted(() => {
  stopPendingRefresh();
});
</script>

<template>
  <div>
    <!-- 承認待ちビュー -->
    <template v-if="isPendingView">
      <h1 class="mb-6 text-xl font-bold text-gray-900">ダッシュボード</h1>

      <div v-if="pendingLoading" class="py-12 text-center text-sm text-gray-400">読み込み中...</div>

      <template v-else>
        <div class="mx-auto max-w-2xl space-y-6">
          <!-- プロフィール情報 -->
          <div class="rounded-lg border border-gray-200 bg-white p-6">
            <h2 class="mb-4 text-sm font-semibold text-gray-900">プロフィール</h2>
            <dl class="space-y-3">
              <div class="flex justify-between">
                <dt class="text-sm text-gray-500">表示名</dt>
                <dd class="text-sm font-medium text-gray-900">{{ user?.displayName || "-" }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-sm text-gray-500">メールアドレス</dt>
                <dd class="text-sm font-medium text-gray-900">{{ user?.email || "-" }}</dd>
              </div>
            </dl>
          </div>

          <!-- 申請情報 -->
          <div v-if="pendingApp" class="rounded-lg border border-gray-200 bg-white p-6">
            <h2 class="mb-4 text-sm font-semibold text-gray-900">申請情報</h2>
            <dl class="space-y-3">
              <div class="flex justify-between">
                <dt class="text-sm text-gray-500">組織名</dt>
                <dd class="text-sm font-medium text-gray-900">{{ pendingApp.organizationName }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-sm text-gray-500">契約者区分</dt>
                <dd class="text-sm font-medium text-gray-900">
                  {{ pendingApp.organizationType === "individual" ? "個人" : pendingApp.organizationType === "sole_proprietor" ? "個人事業主" : "法人" }}
                </dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-sm text-gray-500">選択プラン</dt>
                <dd class="text-sm font-medium text-gray-900">{{ pendingPlan?.displayName || pendingApp.planId }}</dd>
              </div>
              <div v-if="pendingApp.invoiceNumber" class="flex justify-between">
                <dt class="text-sm text-gray-500">請求番号</dt>
                <dd class="text-sm font-medium text-gray-900">{{ pendingApp.invoiceNumber }}</dd>
              </div>
              <div class="flex items-center justify-between">
                <dt class="text-sm text-gray-500">ステータス</dt>
                <dd>
                  <span
                    class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                    :class="
                      pendingApp.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      pendingApp.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    "
                  >
                    {{ pendingApp.status === "pending" ? "審査中" : pendingApp.status === "approved" ? "入金待ち" : "却下" }}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <!-- ステータス詳細 -->
          <div v-if="pendingStatusDisplay" class="rounded-lg border border-gray-200 bg-white p-6">
            <div class="text-center">
              <!-- 審査待ち -->
              <template v-if="pendingStatusDisplay.type === 'pending'">
                <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100">
                  <svg class="h-7 w-7 animate-spin text-yellow-500" style="animation-duration: 3s" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <h3 class="mb-1 text-base font-semibold text-gray-900">{{ pendingStatusDisplay.title }}</h3>
                <p class="text-sm text-gray-600">{{ pendingStatusDisplay.message }}</p>
                <p class="mt-3 text-xs text-gray-400">ステータスは自動的に更新されます</p>
              </template>

              <!-- 入金待ち -->
              <template v-else-if="pendingStatusDisplay.type === 'payment'">
                <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                  <svg class="h-7 w-7 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  </svg>
                </div>
                <h3 class="mb-1 text-base font-semibold text-gray-900">{{ pendingStatusDisplay.title }}</h3>
                <p class="text-sm text-gray-600">{{ pendingStatusDisplay.message }}</p>

                <!-- 振込先情報 -->
                <div class="mx-auto mt-5 max-w-sm rounded-md border border-blue-200 bg-blue-50 p-4 text-left text-sm">
                  <h4 class="mb-3 font-semibold text-gray-900">お振込先</h4>
                  <dl class="space-y-1.5 text-gray-700">
                    <div class="flex justify-between"><dt>銀行</dt><dd class="font-medium">{{ BANK_TRANSFER_INFO.bankName }}</dd></div>
                    <div class="flex justify-between"><dt>支店</dt><dd class="font-medium">{{ BANK_TRANSFER_INFO.branchName }}</dd></div>
                    <div class="flex justify-between"><dt>口座種別</dt><dd class="font-medium">{{ BANK_TRANSFER_INFO.accountType }}</dd></div>
                    <div class="flex justify-between"><dt>口座番号</dt><dd class="font-medium">{{ BANK_TRANSFER_INFO.accountNumber }}</dd></div>
                    <div class="flex justify-between"><dt>口座名義</dt><dd class="font-medium">{{ BANK_TRANSFER_INFO.accountHolder }}</dd></div>
                  </dl>
                  <div v-if="pendingApp?.invoiceNumber" class="mt-3 rounded bg-white p-2 text-center">
                    <p class="text-xs text-gray-500">請求番号</p>
                    <p class="text-base font-bold text-gray-900">{{ pendingApp.invoiceNumber }}</p>
                  </div>
                  <ul class="mt-3 space-y-1 text-xs text-gray-600">
                    <li>※ 振込手数料はお客様負担となります。</li>
                    <li>※ お振込の際は、登録時のお名前と同一の名義でお願いします。</li>
                    <li v-if="pendingApp?.invoiceNumber">※ 振込人名の前に請求番号「{{ pendingApp.invoiceNumber }}」を付けてください。<br>&nbsp;&nbsp;例: {{ pendingApp.invoiceNumber }} ヤマダタロウ</li>
                  </ul>
                </div>

                <p class="mt-3 text-xs text-gray-400">入金確認後、自動的にご利用いただけます</p>
              </template>

              <!-- 却下 -->
              <template v-else-if="pendingStatusDisplay.type === 'rejected'">
                <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                  <svg class="h-7 w-7 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 class="mb-1 text-base font-semibold text-gray-900">{{ pendingStatusDisplay.title }}</h3>
                <p class="text-sm text-gray-600">{{ pendingStatusDisplay.message }}</p>
                <NuxtLink to="/apply" class="mt-4 inline-block rounded-md bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700">
                  再申請する
                </NuxtLink>
              </template>
            </div>
          </div>

          <!-- プラン詳細 -->
          <div v-if="pendingPlan" class="rounded-lg border border-gray-200 bg-white p-6">
            <h2 class="mb-4 text-sm font-semibold text-gray-900">プラン詳細: {{ pendingPlan.displayName }}</h2>
            <div class="mb-4">
              <span class="text-2xl font-bold text-gray-900">
                {{ pendingPlan.priceMonthly === 0 ? "無料" : pendingPlan.priceMonthly === -1 ? "個別見積" : `\u00A5${pendingPlan.price}/月` }}
              </span>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="text-sm">
                <p class="font-medium text-gray-700">リソース上限</p>
                <ul class="mt-1 space-y-1 text-gray-500">
                  <li>グループ数: {{ pendingPlan.limits.maxGroups === -1 ? "無制限" : pendingPlan.limits.maxGroups }}</li>
                  <li>サービス数: {{ pendingPlan.limits.maxServices === -1 ? "無制限" : pendingPlan.limits.maxServices }}</li>
                  <li>ドキュメント: {{ pendingPlan.limits.maxDocuments === -1 ? "無制限" : `${pendingPlan.limits.maxDocuments}件` }}</li>
                  <li>月間チャット: {{ pendingPlan.limits.maxMonthlyChats === -1 ? "無制限" : `${pendingPlan.limits.maxMonthlyChats.toLocaleString()}回` }}</li>
                  <li>ユーザー数: {{ pendingPlan.limits.maxUsers === -1 ? "無制限" : pendingPlan.limits.maxUsers }}</li>
                </ul>
              </div>
              <div class="text-sm">
                <p class="font-medium text-gray-700">機能</p>
                <ul class="mt-1 space-y-1">
                  <li v-for="feature in pendingPlan.landingFeatures" :key="feature" class="flex items-start gap-1.5 text-gray-500">
                    <svg class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {{ feature }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- サービス詳細ビュー -->
    <template v-else-if="selectedServiceId">
      <div class="mb-6">
        <button
          class="mb-2 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800"
          @click="backToGroupOverview"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          グループ概要に戻る
        </button>
        <h1 class="text-xl font-bold text-gray-900">
          {{ serviceSummary?.serviceName || "読み込み中..." }}
        </h1>
        <p class="text-sm text-gray-500">サービス別ダッシュボード</p>
      </div>

      <div v-if="serviceLoading" class="py-12 text-center text-sm text-gray-400">読み込み中...</div>

      <template v-else-if="serviceSummary">
        <!-- サービス KPI カード -->
        <div class="mb-8 grid gap-4 sm:grid-cols-3">
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <p class="text-xs font-medium uppercase tracking-wider text-gray-500">会話数</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">
              {{ serviceSummary.totalConversations }}
            </p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Bot解決率</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">
              {{ (serviceSummary.resolutionRate * 100).toFixed(1) }}%
            </p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <p class="text-xs font-medium uppercase tracking-wider text-gray-500">
              未対応の改善要望
            </p>
            <p class="mt-2 text-2xl font-bold text-gray-900">
              {{ serviceSummary.improvementRequestCount }}
            </p>
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
            <div
              v-if="serviceSummary.recentUnresolved.length === 0"
              class="py-4 text-center text-sm text-gray-400"
            >
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
        <span v-if="currentGroup" class="text-base font-normal text-gray-500"
          >- {{ currentGroup.name }}</span
        >
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
            <p class="mt-2 text-2xl font-bold text-gray-900">
              {{ (summary.resolutionRate * 100).toFixed(1) }}%
            </p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <p class="text-xs font-medium uppercase tracking-wider text-gray-500">
              未対応の改善要望
            </p>
            <p class="mt-2 text-2xl font-bold text-gray-900">
              {{ summary.improvementRequestCount }}
            </p>
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
          <div
            v-if="summary.serviceDistribution.length === 0"
            class="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400"
          >
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
                <span class="truncate text-sm font-semibold text-gray-900">{{
                  svc.serviceName
                }}</span>
                <svg
                  class="h-4 w-4 shrink-0 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
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
                  <p class="text-lg font-bold text-gray-900">
                    {{ (svc.resolutionRate * 100).toFixed(0) }}%
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <!-- 未解決の会話 -->
          <div class="rounded-lg border border-gray-200 bg-white p-5">
            <h2 class="mb-4 text-sm font-semibold text-gray-900">エスカレーション済み（未解決）</h2>
            <div
              v-if="summary.recentUnresolved.length === 0"
              class="py-4 text-center text-sm text-gray-400"
            >
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
            <div
              v-if="summary.topReferencedDocs.length === 0 && summary.unreferencedDocCount === 0"
              class="py-4 text-center text-sm text-gray-400"
            >
              ドキュメントがありません
            </div>
            <template v-else>
              <div v-if="summary.topReferencedDocs.length > 0" class="mb-3">
                <p class="mb-2 text-xs font-medium text-gray-500">参照回数の多いドキュメント</p>
                <div class="space-y-1.5">
                  <div
                    v-for="doc in summary.topReferencedDocs"
                    :key="doc.id"
                    class="flex items-center justify-between text-sm"
                  >
                    <NuxtLink
                      :to="`/admin/documents/${doc.id}`"
                      class="truncate text-gray-700 hover:text-primary-600"
                      >{{ doc.title }}</NuxtLink
                    >
                    <span class="ml-2 shrink-0 text-xs text-gray-400"
                      >{{ doc.referenceCount }}回</span
                    >
                  </div>
                </div>
              </div>
              <div v-if="summary.unreferencedDocCount > 0">
                <p class="text-xs font-medium text-gray-500">
                  未参照ドキュメント:
                  <span class="text-amber-600">{{ summary.unreferencedDocCount }}件</span>
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
              <button
                aria-label="閉じる"
                class="text-gray-400 hover:text-gray-600"
                @click="closeFeedbackModal"
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

            <div class="flex-1 overflow-y-auto px-6 py-4">
              <div v-if="feedbackLoading" class="py-12 text-center text-sm text-gray-400">
                読み込み中...
              </div>
              <template v-else-if="feedbackConversation">
                <p class="mb-1 text-sm font-medium text-gray-900">
                  {{ feedbackConversation.title }}
                </p>
                <div class="mb-4 flex items-center gap-2">
                  <StatusBadge :status="feedbackConversation.status" size="sm" />
                  <span class="text-xs text-gray-400">{{
                    formatDate(feedbackConversation.createdAt)
                  }}</span>
                </div>

                <div v-if="existingImprovement" class="mb-4 flex items-center gap-2">
                  <span class="text-xs text-gray-500">既存のフィードバックがあります</span>
                  <StatusBadge :status="existingImprovement.status" size="sm" />
                </div>

                <button
                  class="mb-4 flex items-center gap-1.5 text-sm text-primary-600 hover:underline"
                  @click="showConversationLogModal = true"
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
                  対話ログを見る
                </button>

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
              <button
                aria-label="閉じる"
                class="text-gray-400 hover:text-gray-600"
                @click="showConversationLogModal = false"
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

            <div class="flex-1 overflow-y-auto px-6 py-4">
              <div
                v-if="feedbackMessages.length === 0"
                class="py-12 text-center text-sm text-gray-400"
              >
                メッセージがありません
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="msg in feedbackMessages"
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
