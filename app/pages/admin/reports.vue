<script setup lang="ts">
import type { WeeklyReport } from "~~/shared/types/models";

definePageMeta({
  layout: "admin",
  middleware: ["auth", "admin"],
});

const { apiFetch } = useApi();
const { show } = useNotification();

const reports = ref<WeeklyReport[]>([]);
const loading = ref(true);
const selectedReport = ref<WeeklyReport | null>(null);

// レポート生成
const generating = ref(false);
const periodStart = ref("");
const periodEnd = ref("");

function initDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  periodEnd.value = end.toISOString().split("T")[0];
  periodStart.value = start.toISOString().split("T")[0];
}

async function handleGenerate() {
  if (!periodStart.value || !periodEnd.value) return;
  generating.value = true;
  try {
    await apiFetch<WeeklyReport>("/api/reports/generate", {
      method: "POST",
      body: {
        periodStart: periodStart.value + "T00:00:00.000Z",
        periodEnd: periodEnd.value + "T23:59:59.999Z",
      },
    });
    show("レポートを生成しました", "success");
    await fetchReports();
  } catch {
    // useApi が自動通知
  } finally {
    generating.value = false;
  }
}

async function fetchReports() {
  loading.value = true;
  try {
    reports.value = await apiFetch<WeeklyReport[]>("/api/reports");
  } finally {
    loading.value = false;
  }
}

async function selectReport(report: WeeklyReport) {
  if (selectedReport.value?.id === report.id) {
    selectedReport.value = null;
    return;
  }
  const detail = await apiFetch<WeeklyReport>(`/api/reports/${report.id}`);
  selectedReport.value = detail;
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" });
  const e = new Date(end).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" });
  return `${s} 〜 ${e}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

onMounted(() => {
  initDateRange();
  fetchReports();
});
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900">週次レポート</h1>
    </div>

    <!-- レポート生成 -->
    <div class="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <label class="block text-xs font-medium text-gray-600">開始日</label>
        <input
          v-model="periodStart"
          type="date"
          class="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600">終了日</label>
        <input
          v-model="periodEnd"
          type="date"
          class="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        :disabled="generating || !periodStart || !periodEnd"
        class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        @click="handleGenerate"
      >
        {{ generating ? "生成中..." : "レポート生成" }}
      </button>
    </div>

    <div v-if="loading" class="py-12 text-center text-sm text-gray-400">読み込み中...</div>

    <template v-else>
      <div v-if="reports.length === 0" class="py-12 text-center text-sm text-gray-400">
        レポートがまだ生成されていません
      </div>

      <div v-else class="grid gap-6 lg:grid-cols-3">
        <!-- レポート一覧 -->
        <div class="space-y-2 lg:col-span-1">
          <div
            v-for="report in reports"
            :key="report.id"
            class="cursor-pointer rounded-lg border p-4 transition-colors hover:bg-gray-50"
            :class="
              selectedReport?.id === report.id
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 bg-white'
            "
            @click="selectReport(report)"
          >
            <p class="text-sm font-medium text-gray-900">
              {{ formatPeriod(report.periodStart, report.periodEnd) }}
            </p>
            <div class="mt-1 flex gap-3 text-xs text-gray-500">
              <span>会話: {{ report.stats.totalConversations }}件</span>
              <span>解決率: {{ (report.stats.resolutionRate * 100).toFixed(0) }}%</span>
            </div>
            <p class="mt-1 text-xs text-gray-400">作成: {{ formatDate(report.createdAt) }}</p>
          </div>
        </div>

        <!-- レポート詳細 -->
        <div class="lg:col-span-2">
          <div
            v-if="!selectedReport"
            class="flex items-center justify-center rounded-lg border border-dashed border-gray-300 p-12"
          >
            <p class="text-sm text-gray-400">レポートを選択してください</p>
          </div>

          <div v-else class="space-y-5">
            <!-- 統計サマリー -->
            <div class="rounded-lg border border-gray-200 bg-white p-5">
              <h2 class="mb-4 text-sm font-semibold text-gray-900">統計サマリー</h2>
              <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p class="text-xs text-gray-500">総会話数</p>
                  <p class="text-lg font-bold text-gray-900">
                    {{ selectedReport.stats.totalConversations }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">Bot解決</p>
                  <p class="text-lg font-bold text-gray-900">
                    {{ selectedReport.stats.resolvedByBot }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">エスカレーション</p>
                  <p class="text-lg font-bold text-gray-900">
                    {{ selectedReport.stats.escalated }}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">解決率</p>
                  <p class="text-lg font-bold text-gray-900">
                    {{ (selectedReport.stats.resolutionRate * 100).toFixed(1) }}%
                  </p>
                </div>
              </div>
              <div class="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p class="text-xs text-gray-500">平均確信度</p>
                  <p class="text-lg font-bold text-gray-900">
                    {{ (selectedReport.stats.averageConfidence * 100).toFixed(1) }}%
                  </p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">改善要望数</p>
                  <p class="text-lg font-bold text-gray-900">
                    {{ selectedReport.stats.improvementRequestCount }}
                  </p>
                </div>
              </div>
            </div>

            <!-- サービス別 -->
            <div
              v-if="selectedReport.stats.topServices.length > 0"
              class="rounded-lg border border-gray-200 bg-white p-5"
            >
              <h2 class="mb-3 text-sm font-semibold text-gray-900">サービス別利用状況</h2>
              <div class="space-y-2">
                <div
                  v-for="svc in selectedReport.stats.topServices"
                  :key="svc.serviceId"
                  class="flex items-center justify-between text-sm"
                >
                  <span class="text-gray-700">{{ svc.serviceName }}</span>
                  <span class="font-medium text-gray-900">{{ svc.count }}件</span>
                </div>
              </div>
            </div>

            <!-- インサイト -->
            <div
              v-if="selectedReport.insights.length > 0"
              class="rounded-lg border border-gray-200 bg-white p-5"
            >
              <h2 class="mb-3 text-sm font-semibold text-gray-900">インサイト</h2>
              <ul class="list-inside list-disc space-y-1 text-sm text-gray-700">
                <li v-for="(insight, i) in selectedReport.insights" :key="i">{{ insight }}</li>
              </ul>
            </div>

            <!-- 改善提案 -->
            <div
              v-if="selectedReport.recommendations.length > 0"
              class="rounded-lg border border-gray-200 bg-white p-5"
            >
              <h2 class="mb-3 text-sm font-semibold text-gray-900">改善提案</h2>
              <ul class="list-inside list-disc space-y-1 text-sm text-gray-700">
                <li v-for="(rec, i) in selectedReport.recommendations" :key="i">{{ rec }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
