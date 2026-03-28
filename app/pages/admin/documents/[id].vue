<script setup lang="ts">
import type { Document, Service } from "~~/shared/types/models";

definePageMeta({
  layout: "admin",
  middleware: ["auth", "admin"],
});

interface ChunkData {
  id: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  contextPrefix: string;
  sectionTitle: string;
  parentChunkIndex: number;
  createdAt: string;
}

interface ChunksResponse {
  documentId: string;
  documentTitle: string;
  documentType: string;
  serviceId: string;
  status: string;
  totalChunks: number;
  chunks: ChunkData[];
}

const route = useRoute();
const { apiFetch } = useApi();

const docId = route.params.id as string;
const loading = ref(true);
const document = ref<Document | null>(null);
const chunks = ref<ChunkData[]>([]);
const services = ref<Service[]>([]);
const expandedChunks = ref<Set<number>>(new Set());

async function fetchData() {
  loading.value = true;
  try {
    const [docData, chunksData, svcs] = await Promise.all([
      apiFetch<Document>(`/api/documents/${docId}`).catch(() => null),
      apiFetch<ChunksResponse>(`/api/documents/${docId}/chunks`),
      apiFetch<Service[]>("/api/services"),
    ]);
    document.value = docData || ({
      id: docId,
      title: chunksData.documentTitle,
      type: chunksData.documentType,
      serviceId: chunksData.serviceId,
      status: chunksData.status,
    } as Document);
    chunks.value = chunksData.chunks;
    services.value = svcs;
  } finally {
    loading.value = false;
  }
}

function getServiceName(serviceId: string): string {
  return services.value.find((s) => s.id === serviceId)?.name || "不明";
}

function toggleChunk(index: number) {
  if (expandedChunks.value.has(index)) {
    expandedChunks.value.delete(index);
  } else {
    expandedChunks.value.add(index);
  }
}

function expandAll() {
  for (const chunk of chunks.value) {
    expandedChunks.value.add(chunk.chunkIndex);
  }
}

function collapseAll() {
  expandedChunks.value.clear();
}

onMounted(fetchData);
</script>

<template>
  <div>
    <!-- ヘッダー -->
    <div class="mb-6">
      <NuxtLink to="/admin/documents" class="mb-2 inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
        <svg class="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        ドキュメント一覧に戻る
      </NuxtLink>
      <div v-if="!loading && document" class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-bold text-gray-900">{{ document.title }}</h1>
        <StatusBadge :status="document.status" size="sm" />
      </div>
    </div>

    <!-- 読み込み中 -->
    <div v-if="loading" class="py-12 text-center text-sm text-gray-400">読み込み中...</div>

    <template v-else-if="document">
      <!-- ドキュメント情報 -->
      <div class="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt class="text-xs font-medium text-gray-500">サービス</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ getServiceName(document.serviceId) }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-gray-500">種別</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ document.type === "business" ? "業務" : "システム" }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-gray-500">チャンク数</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ chunks.length }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-gray-500">合計トークン数</dt>
            <dd class="mt-1 text-sm text-gray-900">
              {{ chunks.reduce((sum, c) => sum + c.tokenCount, 0).toLocaleString() }}
            </dd>
          </div>
        </dl>
      </div>

      <!-- チャンク一覧 -->
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">チャンク一覧</h2>
        <div class="flex gap-2">
          <button
            class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            @click="expandAll"
          >
            すべて展開
          </button>
          <button
            class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            @click="collapseAll"
          >
            すべて折りたたむ
          </button>
        </div>
      </div>

      <div v-if="chunks.length === 0" class="rounded-lg border border-gray-200 bg-white py-12 text-center text-sm text-gray-400">
        チャンクがまだ生成されていません
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="chunk in chunks"
          :key="chunk.chunkIndex"
          class="rounded-lg border border-gray-200 bg-white"
        >
          <!-- チャンクヘッダー -->
          <button
            class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
            @click="toggleChunk(chunk.chunkIndex)"
          >
            <div class="flex items-center gap-3">
              <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                {{ chunk.chunkIndex + 1 }}
              </span>
              <span v-if="chunk.sectionTitle" class="text-sm font-medium text-gray-900">
                {{ chunk.sectionTitle }}
              </span>
              <span v-else class="text-sm text-gray-500">
                {{ chunk.content.slice(0, 60) }}{{ chunk.content.length > 60 ? "..." : "" }}
              </span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs text-gray-400">{{ chunk.tokenCount }} tokens</span>
              <span class="text-xs text-gray-400">親#{{ chunk.parentChunkIndex }}</span>
              <svg
                class="h-4 w-4 text-gray-400 transition-transform"
                :class="expandedChunks.has(chunk.chunkIndex) ? 'rotate-180' : ''"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          <!-- チャンク詳細 -->
          <div v-if="expandedChunks.has(chunk.chunkIndex)" class="border-t border-gray-100 px-4 py-3">
            <!-- コンテキスト接頭辞 -->
            <div v-if="chunk.contextPrefix" class="mb-3">
              <p class="mb-1 text-xs font-medium text-blue-600">コンテキスト接頭辞</p>
              <div class="rounded-md bg-blue-50 p-3 text-sm text-blue-800 whitespace-pre-wrap">
                {{ chunk.contextPrefix }}
              </div>
            </div>

            <!-- チャンク本文 -->
            <div>
              <p class="mb-1 text-xs font-medium text-gray-500">チャンク本文</p>
              <div class="rounded-md bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap">
                {{ chunk.content }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
