<script setup lang="ts">
import type { Document, Service } from "~~/shared/types/models";

definePageMeta({
  layout: "admin",
  middleware: ["auth", "admin"],
});

const { apiFetch } = useApi();
const { show } = useNotification();

const documents = ref<Document[]>([]);
const services = ref<Service[]>([]);
const loading = ref(true);
const filterServiceId = ref("");
const filterTag = ref("");

// ページネーション
const currentPage = ref(1);
const itemsPerPage = 20;

// アップロードモーダル
const showUploadModal = ref(false);
const uploadServiceId = ref("");
const uploadTitle = ref("");
const uploadType = ref<"business" | "system">("business");
const uploadTags = ref("");
const uploadFile = ref<File | null>(null);
const uploading = ref(false);

// 一括アップロード
const showBulkUploadModal = ref(false);
const bulkFiles = ref<File[]>([]);
const bulkServiceId = ref("");
const bulkType = ref<"business" | "system">("business");
const bulkTags = ref("");
const bulkUploading = ref(false);
const bulkProgress = ref(0);
const bulkTotal = ref(0);

// 削除確認
const showDeleteConfirm = ref(false);
const deletingDoc = ref<Document | null>(null);

// 重複検出
const showDuplicateWarning = ref(false);
const duplicateInfo = ref<{ existingTitle: string; existingId: string } | null>(null);
const pendingUploadAction = ref<(() => Promise<void>) | null>(null);

// 処理中のドキュメントID
const processingIds = ref<Set<string>>(new Set());
const pollingIntervals = new Map<string, ReturnType<typeof setInterval>>();

async function fetchData() {
  loading.value = true;
  try {
    const [docs, svcs] = await Promise.all([
      apiFetch<Document[]>("/api/documents"),
      apiFetch<Service[]>("/api/services"),
    ]);
    documents.value = docs;
    services.value = svcs;
  } finally {
    loading.value = false;
  }
}

// ポーリング用: スロットリング付きでdocumentsのみ取得
let lastFetchTime = 0;
const FETCH_THROTTLE_MS = 3000;

async function fetchDocuments() {
  const now = Date.now();
  if (now - lastFetchTime < FETCH_THROTTLE_MS) return;
  documents.value = await apiFetch<Document[]>("/api/documents");
  lastFetchTime = Date.now();
}

const allTags = computed(() => {
  const tagSet = new Set<string>();
  for (const doc of documents.value) {
    if (doc.tags) {
      for (const tag of doc.tags) {
        tagSet.add(tag);
      }
    }
  }
  return Array.from(tagSet).sort();
});

const filteredDocuments = computed(() => {
  let result = documents.value;
  if (filterServiceId.value) {
    result = result.filter((d) => d.serviceId === filterServiceId.value);
  }
  if (filterTag.value) {
    result = result.filter((d) => d.tags?.includes(filterTag.value));
  }
  return result;
});

const totalPages = computed(() => Math.ceil(filteredDocuments.value.length / itemsPerPage));
const paginatedDocuments = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredDocuments.value.slice(start, start + itemsPerPage);
});

watch(totalPages, (tp) => {
  if (currentPage.value > tp && tp > 0) currentPage.value = tp;
});

function getServiceName(serviceId: string): string {
  return services.value.find((s) => s.id === serviceId)?.name || "不明";
}

// フィルター変更時はページを1に戻す
watch([filterServiceId, filterTag], () => {
  currentPage.value = 1;
});

// --- 単一アップロード ---
function openUploadModal() {
  uploadServiceId.value = services.value[0]?.id || "";
  uploadTitle.value = "";
  uploadType.value = "business";
  uploadTags.value = "";
  uploadFile.value = null;
  showUploadModal.value = true;
}

function handleFileSelect(file: File) {
  uploadFile.value = file;
  if (!uploadTitle.value) {
    uploadTitle.value = file.name.replace(/\.[^.]+$/, "");
  }
}

async function handleUpload() {
  if (!uploadFile.value || !uploadServiceId.value || !uploadTitle.value) return;

  uploading.value = true;
  try {
    await doUpload(uploadFile.value, uploadServiceId.value, uploadTitle.value, uploadType.value, uploadTags.value, false);
    showUploadModal.value = false;
    show("ドキュメントをアップロードしました", "success");
    await fetchData();
  } catch {
    // useApi が自動通知
  } finally {
    uploading.value = false;
  }
}

async function doUpload(
  file: File,
  serviceId: string,
  title: string,
  type: string,
  tags: string,
  skipDuplicateCheck: boolean,
): Promise<Document | null> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("serviceId", serviceId);
  formData.append("title", title);
  formData.append("type", type);
  if (tags.trim()) {
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    formData.append("tags", JSON.stringify(tagList));
  }
  if (skipDuplicateCheck) {
    formData.append("skipDuplicateCheck", "true");
  }

  const { getIdToken } = useAuth();
  const token = await getIdToken();

  const result = await $fetch<Document & { duplicate?: boolean; existingDocument?: { id: string; title: string } }>("/api/documents/upload", {
    method: "POST",
    body: formData,
    headers: { Authorization: `Bearer ${token}` },
  });

  // 重複検出
  if (result.duplicate && result.existingDocument) {
    duplicateInfo.value = {
      existingTitle: result.existingDocument.title,
      existingId: result.existingDocument.id,
    };

    return new Promise((resolve) => {
      pendingUploadAction.value = async () => {
        const doc = await doUpload(file, serviceId, title, type, tags, true);
        resolve(doc);
      };
      showDuplicateWarning.value = true;
    });
  }

  // 自動的に処理を開始
  await processDocument(result.id);
  return result;
}

async function handleDuplicateForceUpload() {
  showDuplicateWarning.value = false;
  if (pendingUploadAction.value) {
    await pendingUploadAction.value();
    pendingUploadAction.value = null;
  }
}

function handleDuplicateCancel() {
  showDuplicateWarning.value = false;
  pendingUploadAction.value = null;
}

// --- 一括アップロード ---
function openBulkUploadModal() {
  bulkServiceId.value = services.value[0]?.id || "";
  bulkType.value = "business";
  bulkTags.value = "";
  bulkFiles.value = [];
  bulkProgress.value = 0;
  bulkTotal.value = 0;
  showBulkUploadModal.value = true;
}

function handleBulkFileSelect(files: File[]) {
  bulkFiles.value = [...bulkFiles.value, ...files];
}

function removeBulkFile(index: number) {
  bulkFiles.value.splice(index, 1);
}

async function handleBulkUpload() {
  if (bulkFiles.value.length === 0 || !bulkServiceId.value) return;

  bulkUploading.value = true;
  bulkTotal.value = bulkFiles.value.length;
  bulkProgress.value = 0;

  try {
    for (const file of bulkFiles.value) {
      const title = file.name.replace(/\.[^.]+$/, "");
      try {
        await doUpload(file, bulkServiceId.value, title, bulkType.value, bulkTags.value, false);
      } catch {
        // 個別のエラーは通知されるので続行
      }
      bulkProgress.value++;
    }
    showBulkUploadModal.value = false;
    show(`${bulkProgress.value}件のドキュメントをアップロードしました`, "success");
    await fetchData();
  } finally {
    bulkUploading.value = false;
  }
}

function stopPolling(docId: string) {
  const interval = pollingIntervals.get(docId);
  if (interval) {
    clearInterval(interval);
    pollingIntervals.delete(docId);
  }
  processingIds.value.delete(docId);
}

async function processDocument(docId: string) {
  if (processingIds.value.has(docId)) return;
  processingIds.value.add(docId);
  try {
    await apiFetch(`/api/documents/${docId}/process`, { method: "POST" });
  } catch {
    processingIds.value.delete(docId);
    return;
  }

  // ステータス変化をポーリングで検知
  let errorCount = 0;
  const maxErrors = 3;
  const startTime = Date.now();
  const maxDuration = 5 * 60 * 1000; // 5分

  const interval = setInterval(async () => {
    if (Date.now() - startTime > maxDuration) {
      stopPolling(docId);
      show("ドキュメントの処理がタイムアウトしました", "error");
      return;
    }

    try {
      await fetchDocuments();
      errorCount = 0;
    } catch {
      errorCount++;
      if (errorCount >= maxErrors) {
        stopPolling(docId);
        show("ドキュメントのステータス取得に失敗しました", "error");
      }
      return;
    }
    const doc = documents.value.find((d) => d.id === docId);
    if (!doc || doc.status !== "processing") {
      stopPolling(docId);
      if (doc?.status === "ready") {
        show("ドキュメントの処理が完了しました", "success");
      } else if (doc?.status === "error") {
        show("ドキュメントの処理中にエラーが発生しました", "error");
      }
    }
  }, 4000);
  pollingIntervals.set(docId, interval);
}

function openDeleteConfirm(doc: Document) {
  deletingDoc.value = doc;
  showDeleteConfirm.value = true;
}

async function handleDelete() {
  if (!deletingDoc.value) return;
  const docId = deletingDoc.value.id;
  try {
    stopPolling(docId);
    await apiFetch(`/api/documents/${docId}`, { method: "DELETE" });
    showDeleteConfirm.value = false;
    deletingDoc.value = null;
    show("ドキュメントを削除しました", "success");
    await fetchData();
  } catch {
    // useApi が自動通知
  }
}

onMounted(fetchData);

onUnmounted(() => {
  for (const interval of pollingIntervals.values()) {
    clearInterval(interval);
  }
  pollingIntervals.clear();
  processingIds.value.clear();
});
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-bold text-gray-900">ドキュメント管理</h1>
      <div class="flex gap-2">
        <button
          class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          @click="openBulkUploadModal"
        >
          一括アップロード
        </button>
        <button
          class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          @click="openUploadModal"
        >
          + アップロード
        </button>
      </div>
    </div>

    <!-- フィルタ -->
    <div class="mb-4 flex flex-wrap gap-3">
      <select
        v-model="filterServiceId"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">全サービス</option>
        <option v-for="svc in services" :key="svc.id" :value="svc.id">
          {{ svc.name }}
        </option>
      </select>
      <select
        v-if="allTags.length > 0"
        v-model="filterTag"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">全タグ</option>
        <option v-for="tag in allTags" :key="tag" :value="tag">
          {{ tag }}
        </option>
      </select>
    </div>

    <!-- ローディング -->
    <div v-if="loading" class="py-12 text-center text-sm text-gray-400">読み込み中...</div>

    <!-- 空状態 -->
    <div v-else-if="filteredDocuments.length === 0" class="rounded-lg border border-gray-200 px-4 py-12 text-center text-sm text-gray-400">
      ドキュメントがまだ登録されていません
    </div>

    <template v-else>
      <!-- モバイル: カード表示 -->
      <div class="space-y-3 md:hidden">
        <div
          v-for="doc in paginatedDocuments"
          :key="doc.id"
          class="rounded-lg border border-gray-200 bg-white p-4"
        >
          <div class="mb-2 flex items-start justify-between gap-2">
            <div>
              <NuxtLink
                :to="`/admin/documents/${doc.id}`"
                class="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline"
              >
                {{ doc.title }}
              </NuxtLink>
              <span v-if="doc.version > 1" class="ml-1 text-xs text-gray-400">v{{ doc.version }}</span>
            </div>
            <StatusBadge :status="doc.status" size="sm" class="shrink-0" />
          </div>
          <div class="space-y-1.5 text-xs text-gray-500">
            <div class="flex items-center justify-between">
              <span>{{ getServiceName(doc.serviceId) }}</span>
              <span>{{ doc.type === "business" ? "業務" : "システム" }}</span>
            </div>
            <div v-if="doc.tags?.length" class="flex flex-wrap gap-1">
              <span
                v-for="tag in doc.tags"
                :key="tag"
                class="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {{ tag }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span>チャンク: {{ doc.chunkCount }}</span>
              <div class="flex gap-3">
                <button
                  v-if="doc.status === 'uploading' || doc.status === 'error'"
                  class="text-xs text-primary-600 hover:text-primary-800 disabled:opacity-50"
                  :disabled="processingIds.has(doc.id)"
                  @click="processDocument(doc.id)"
                >
                  {{ processingIds.has(doc.id) ? "処理中..." : "処理開始" }}
                </button>
                <button
                  class="text-xs text-red-600 hover:text-red-800"
                  @click="openDeleteConfirm(doc)"
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PC: テーブル表示 -->
      <div class="hidden overflow-x-auto rounded-lg border border-gray-200 md:block">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">タイトル</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">サービス</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">種別</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">タグ</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">状態</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">チャンク</th>
              <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            <tr v-for="doc in paginatedDocuments" :key="doc.id" class="hover:bg-gray-50">
              <td class="whitespace-nowrap px-4 py-3 text-sm font-medium">
                <NuxtLink
                  :to="`/admin/documents/${doc.id}`"
                  class="text-primary-600 hover:text-primary-800 hover:underline"
                >
                  {{ doc.title }}
                </NuxtLink>
                <span v-if="doc.version > 1" class="ml-1 text-xs text-gray-400">v{{ doc.version }}</span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                {{ getServiceName(doc.serviceId) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                {{ doc.type === "business" ? "業務" : "システム" }}
              </td>
              <td class="px-4 py-3 text-sm">
                <div v-if="doc.tags?.length" class="flex flex-wrap gap-1">
                  <span
                    v-for="tag in doc.tags"
                    :key="tag"
                    class="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                  >
                    {{ tag }}
                  </span>
                </div>
              </td>
              <td class="whitespace-nowrap px-4 py-3">
                <StatusBadge :status="doc.status" size="sm" />
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                {{ doc.chunkCount }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right">
                <button
                  v-if="doc.status === 'uploading' || doc.status === 'error'"
                  class="mr-2 text-sm text-primary-600 hover:text-primary-800 disabled:opacity-50"
                  :disabled="processingIds.has(doc.id)"
                  @click="processDocument(doc.id)"
                >
                  {{ processingIds.has(doc.id) ? "処理中..." : "処理開始" }}
                </button>
                <button
                  class="text-sm text-red-600 hover:text-red-800"
                  @click="openDeleteConfirm(doc)"
                >
                  削除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ページネーション -->
      <Pagination
        :current-page="currentPage"
        :total-pages="totalPages"
        :total-items="filteredDocuments.length"
        :items-per-page="itemsPerPage"
        @page-change="currentPage = $event"
      />
    </template>

    <!-- 単一アップロードモーダル -->
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
          v-if="showUploadModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-gray-600/75 p-4"
          @click.self="showUploadModal = false"
        >
          <div class="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 class="mb-4 text-lg font-semibold text-gray-900">ドキュメントをアップロード</h3>
            <form class="space-y-4" @submit.prevent="handleUpload">
              <div>
                <label class="block text-sm font-medium text-gray-700">サービス *</label>
                <select
                  v-model="uploadServiceId"
                  required
                  class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option v-for="svc in services" :key="svc.id" :value="svc.id">
                    {{ svc.name }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">種別</label>
                <div class="mt-1 flex gap-4">
                  <label class="flex items-center gap-1.5 text-sm">
                    <input v-model="uploadType" type="radio" value="business" class="text-primary-600" />
                    業務
                  </label>
                  <label class="flex items-center gap-1.5 text-sm">
                    <input v-model="uploadType" type="radio" value="system" class="text-primary-600" />
                    システム
                  </label>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">タイトル *</label>
                <input
                  v-model="uploadTitle"
                  type="text"
                  required
                  class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="ドキュメントのタイトル"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">タグ</label>
                <input
                  v-model="uploadTags"
                  type="text"
                  class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="カンマ区切りでタグを入力（例: 契約,FAQ）"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">ファイル *</label>
                <FileUploader accept=".pdf,.md,.txt,.docx,.html,.csv" @select="handleFileSelect" />
                <p v-if="uploadFile" class="mt-2 text-sm text-green-600">
                  選択済み: {{ uploadFile.name }} ({{ (uploadFile.size / 1024).toFixed(1) }} KB)
                </p>
              </div>
              <div class="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  @click="showUploadModal = false"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  :disabled="uploading || !uploadFile || !uploadServiceId || !uploadTitle.trim()"
                  class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {{ uploading ? "アップロード中..." : "アップロード" }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 一括アップロードモーダル -->
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
          v-if="showBulkUploadModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-gray-600/75 p-4"
          @click.self="!bulkUploading && (showBulkUploadModal = false)"
        >
          <div class="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl">
            <h3 class="px-6 pt-6 text-lg font-semibold text-gray-900">一括アップロード</h3>
            <div class="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">サービス *</label>
                <select
                  v-model="bulkServiceId"
                  class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  :disabled="bulkUploading"
                >
                  <option v-for="svc in services" :key="svc.id" :value="svc.id">
                    {{ svc.name }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">種別</label>
                <div class="mt-1 flex gap-4">
                  <label class="flex items-center gap-1.5 text-sm">
                    <input v-model="bulkType" type="radio" value="business" class="text-primary-600" :disabled="bulkUploading" />
                    業務
                  </label>
                  <label class="flex items-center gap-1.5 text-sm">
                    <input v-model="bulkType" type="radio" value="system" class="text-primary-600" :disabled="bulkUploading" />
                    システム
                  </label>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">タグ</label>
                <input
                  v-model="bulkTags"
                  type="text"
                  class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm"
                  placeholder="カンマ区切りでタグを入力"
                  :disabled="bulkUploading"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">ファイル *</label>
                <FileUploader
                  accept=".pdf,.md,.txt,.docx,.html,.csv"
                  :multiple="true"
                  :disabled="bulkUploading"
                  @select-multiple="handleBulkFileSelect"
                  @select="(f: File) => handleBulkFileSelect([f])"
                />
              </div>

              <!-- ファイルリスト -->
              <div v-if="bulkFiles.length > 0" class="max-h-40 space-y-1 overflow-y-auto">
                <div
                  v-for="(file, i) in bulkFiles"
                  :key="i"
                  class="flex items-center justify-between rounded-md bg-gray-50 px-3 py-1.5 text-sm"
                >
                  <span class="truncate text-gray-700">{{ file.name }} ({{ (file.size / 1024).toFixed(1) }}KB)</span>
                  <button
                    v-if="!bulkUploading"
                    class="ml-2 text-red-500 hover:text-red-700"
                    @click="removeBulkFile(i)"
                  >
                    &times;
                  </button>
                </div>
              </div>

              <!-- 進捗バー -->
              <div v-if="bulkUploading" class="space-y-2">
                <div class="flex justify-between text-sm text-gray-600">
                  <span>アップロード中...</span>
                  <span>{{ bulkProgress }} / {{ bulkTotal }}</span>
                </div>
                <div class="h-2 rounded-full bg-gray-200">
                  <div
                    class="h-2 rounded-full bg-primary-600 transition-all"
                    :style="{ width: `${bulkTotal > 0 ? (bulkProgress / bulkTotal) * 100 : 0}%` }"
                  />
                </div>
              </div>

            </div>
            <div class="flex justify-end gap-3 border-t px-6 py-4">
              <button
                type="button"
                class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                :disabled="bulkUploading"
                @click="showBulkUploadModal = false"
              >
                キャンセル
              </button>
              <button
                :disabled="bulkUploading || bulkFiles.length === 0 || !bulkServiceId"
                class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                @click="handleBulkUpload"
              >
                {{ bulkUploading ? `アップロード中 (${bulkProgress}/${bulkTotal})` : `${bulkFiles.length}件をアップロード` }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 重複警告ダイアログ -->
    <ConfirmDialog
      :open="showDuplicateWarning"
      title="重複ドキュメントの検出"
      :message="`同一内容のドキュメント「${duplicateInfo?.existingTitle}」が既に登録されています。それでもアップロードしますか？`"
      confirm-label="アップロード"
      variant="danger"
      @confirm="handleDuplicateForceUpload"
      @cancel="handleDuplicateCancel"
    />

    <!-- 削除確認ダイアログ -->
    <ConfirmDialog
      :open="showDeleteConfirm"
      title="ドキュメントを削除"
      :message="`「${deletingDoc?.title}」を削除しますか？関連するチャンクも全て削除されます。`"
      confirm-label="削除"
      variant="danger"
      @confirm="handleDelete"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>
