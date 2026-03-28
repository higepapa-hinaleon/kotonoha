<script setup lang="ts">
import type { Service } from "~~/shared/types/models";

definePageMeta({
  layout: "admin",
  middleware: ["auth", "admin"],
});

const { apiFetch } = useApi();

const services = ref<Service[]>([]);
const selectedServiceId = ref("");
const testQuery = ref("");
const loading = ref(false);
const loadingServices = ref(true);

interface SearchResult {
  chunkId: string;
  documentId: string;
  similarity: number;
  contentPreview: string;
  documentTitle?: string;
  sectionTitle?: string;
  contextPrefix?: string;
}

interface DiagnosticsResponse {
  documents: { id: string; title: string; status: string; chunkCount: number }[];
  documentCount: number;
  readyDocumentCount: number;
  chunkCount: number;
  sampleChunk?: {
    id: string;
    documentId: string;
    contentPreview: string;
    hasEmbedding: boolean;
    embeddingDimension: number;
  };
  searchTest?: {
    query: string;
    resultCount?: number;
    elapsedMs?: number;
    results?: SearchResult[];
    error?: string;
  };
  botConfig: {
    confidenceThreshold: number;
    ragTopK: number;
    hasSystemPrompt: boolean;
  };
}

const diagnostics = ref<DiagnosticsResponse | null>(null);

async function fetchServices() {
  loadingServices.value = true;
  try {
    services.value = await apiFetch<Service[]>("/api/services");
    if (services.value.length > 0) {
      selectedServiceId.value = services.value[0].id;
    }
  } finally {
    loadingServices.value = false;
  }
}

async function runSearch() {
  if (!selectedServiceId.value || !testQuery.value.trim()) return;

  loading.value = true;
  diagnostics.value = null;
  try {
    const params = new URLSearchParams({
      serviceId: selectedServiceId.value,
      testQuery: testQuery.value.trim(),
    });
    diagnostics.value = await apiFetch<DiagnosticsResponse>(
      `/api/admin/rag-diagnostics?${params.toString()}`,
    );
  } finally {
    loading.value = false;
  }
}

async function loadDiagnostics() {
  if (!selectedServiceId.value) return;

  loading.value = true;
  diagnostics.value = null;
  try {
    diagnostics.value = await apiFetch<DiagnosticsResponse>(
      `/api/admin/rag-diagnostics?serviceId=${selectedServiceId.value}`,
    );
  } finally {
    loading.value = false;
  }
}

function getSimilarityColor(similarity: number): string {
  if (similarity >= 0.7) return "text-green-700 bg-green-50";
  if (similarity >= 0.5) return "text-yellow-700 bg-yellow-50";
  return "text-red-700 bg-red-50";
}

onMounted(fetchServices);
</script>

<template>
  <div>
    <h1 class="mb-6 text-xl font-bold text-gray-900">RAG テスト</h1>

    <!-- サービス選択 + クエリ入力 -->
    <div class="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="block text-sm font-medium text-gray-700">サービス</label>
          <select
            v-model="selectedServiceId"
            class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            :disabled="loadingServices"
          >
            <option v-for="svc in services" :key="svc.id" :value="svc.id">
              {{ svc.name }}
            </option>
          </select>
        </div>
        <div class="sm:col-span-2">
          <label class="block text-sm font-medium text-gray-700">テストクエリ</label>
          <div class="mt-1 flex gap-2">
            <input
              v-model="testQuery"
              type="text"
              placeholder="検索クエリを入力..."
              class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              @keydown.enter="runSearch"
            />
            <button
              class="shrink-0 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              :disabled="loading || !selectedServiceId || !testQuery.trim()"
              @click="runSearch"
            >
              {{ loading ? "検索中..." : "検索" }}
            </button>
          </div>
        </div>
      </div>
      <div class="mt-3 flex gap-2">
        <button
          class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          :disabled="loading || !selectedServiceId"
          @click="loadDiagnostics"
        >
          診断情報を表示
        </button>
      </div>
    </div>

    <!-- 読み込み中 -->
    <div v-if="loading" class="py-12 text-center text-sm text-gray-400">検索中...</div>

    <template v-else-if="diagnostics">
      <!-- 概要情報 -->
      <div class="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 class="mb-3 text-sm font-semibold text-gray-900">サービス概要</h2>
        <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt class="text-xs text-gray-500">ドキュメント数</dt>
            <dd class="mt-1 text-lg font-semibold text-gray-900">{{ diagnostics.documentCount }}</dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500">Ready</dt>
            <dd class="mt-1 text-lg font-semibold text-green-600">{{ diagnostics.readyDocumentCount }}</dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500">チャンク数</dt>
            <dd class="mt-1 text-lg font-semibold text-gray-900">{{ diagnostics.chunkCount }}</dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500">RAG topK</dt>
            <dd class="mt-1 text-lg font-semibold text-gray-900">{{ diagnostics.botConfig.ragTopK }}</dd>
          </div>
        </dl>
      </div>

      <!-- ドキュメント一覧 -->
      <div class="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 class="mb-3 text-sm font-semibold text-gray-900">ドキュメント一覧</h2>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">タイトル</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">状態</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">チャンク</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="doc in diagnostics.documents" :key="doc.id">
                <td class="px-3 py-2">
                  <NuxtLink
                    :to="`/admin/documents/${doc.id}`"
                    class="text-primary-600 hover:underline"
                  >
                    {{ doc.title }}
                  </NuxtLink>
                </td>
                <td class="px-3 py-2">
                  <StatusBadge :status="doc.status" size="sm" />
                </td>
                <td class="px-3 py-2 text-gray-500">{{ doc.chunkCount }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 検索結果 -->
      <div v-if="diagnostics.searchTest" class="rounded-lg border border-gray-200 bg-white p-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-900">
            検索結果: "{{ diagnostics.searchTest.query }}"
          </h2>
          <div class="flex gap-3 text-xs text-gray-500">
            <span v-if="diagnostics.searchTest.resultCount !== undefined">
              {{ diagnostics.searchTest.resultCount }} 件
            </span>
            <span v-if="diagnostics.searchTest.elapsedMs !== undefined">
              {{ diagnostics.searchTest.elapsedMs }}ms
            </span>
          </div>
        </div>

        <!-- エラー -->
        <div v-if="diagnostics.searchTest.error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {{ diagnostics.searchTest.error }}
        </div>

        <!-- 結果リスト -->
        <div v-else-if="diagnostics.searchTest.results?.length" class="space-y-3">
          <div
            v-for="(result, i) in diagnostics.searchTest.results"
            :key="result.chunkId"
            class="rounded-md border border-gray-100 p-3"
          >
            <div class="mb-2 flex items-center justify-between">
              <span class="text-sm font-medium text-gray-900">#{{ i + 1 }}</span>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="getSimilarityColor(result.similarity)"
              >
                類似度: {{ (result.similarity * 100).toFixed(1) }}%
              </span>
            </div>
            <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ result.contentPreview }}</p>
            <p class="mt-1 text-xs text-gray-400">チャンクID: {{ result.chunkId }}</p>
          </div>
        </div>

        <div v-else class="py-4 text-center text-sm text-gray-400">
          該当するチャンクが見つかりませんでした
        </div>
      </div>
    </template>
  </div>
</template>
