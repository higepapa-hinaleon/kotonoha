<script setup lang="ts">
import type { Faq, Service } from "~~/shared/types/models";

definePageMeta({
  layout: "admin",
  middleware: ["auth", "admin"],
});

const { apiFetch } = useApi();
const { show } = useNotification();

const faqs = ref<Faq[]>([]);
const services = ref<Service[]>([]);
const loading = ref(true);
const filterServiceId = ref("");

// ページネーション
const currentPage = ref(1);
const itemsPerPage = 20;

// モーダル状態
const showModal = ref(false);
const editingFaq = ref<Faq | null>(null);
const formServiceId = ref("");
const formQuestion = ref("");
const formAnswer = ref("");
const formIsPublished = ref(false);
const saving = ref(false);

// AI自動生成
const generating = ref(false);

async function handleGenerate() {
  if (!filterServiceId.value || generating.value) return;
  generating.value = true;
  try {
    await apiFetch("/api/faqs/generate", {
      method: "POST",
      body: { serviceId: filterServiceId.value },
    });
    show("FAQを自動生成しました", "success");
    await fetchData();
  } catch {
    // useApi が自動通知
  } finally {
    generating.value = false;
  }
}

// 削除確認
const showDeleteConfirm = ref(false);
const deletingFaq = ref<Faq | null>(null);

const totalPages = computed(() => Math.ceil(faqs.value.length / itemsPerPage));
const paginatedFaqs = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return faqs.value.slice(start, start + itemsPerPage);
});

watch(totalPages, (tp) => {
  if (currentPage.value > tp && tp > 0) currentPage.value = tp;
});

async function fetchData() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filterServiceId.value) params.set("serviceId", filterServiceId.value);

    const [items, svcs] = await Promise.all([
      apiFetch<Faq[]>(`/api/faqs?${params}`),
      apiFetch<Service[]>("/api/services"),
    ]);
    faqs.value = items;
    services.value = svcs;
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  editingFaq.value = null;
  formServiceId.value = services.value[0]?.id || "";
  formQuestion.value = "";
  formAnswer.value = "";
  formIsPublished.value = false;
  showModal.value = true;
}

function openEditModal(faq: Faq) {
  editingFaq.value = faq;
  formServiceId.value = faq.serviceId;
  formQuestion.value = faq.question;
  formAnswer.value = faq.answer;
  formIsPublished.value = faq.isPublished;
  showModal.value = true;
}

async function handleSave() {
  if (!formQuestion.value.trim() || !formAnswer.value.trim()) return;
  saving.value = true;
  try {
    if (editingFaq.value) {
      await apiFetch(`/api/faqs/${editingFaq.value.id}`, {
        method: "PUT",
        body: {
          serviceId: formServiceId.value,
          question: formQuestion.value,
          answer: formAnswer.value,
          isPublished: formIsPublished.value,
        },
      });
    } else {
      await apiFetch("/api/faqs", {
        method: "POST",
        body: {
          serviceId: formServiceId.value,
          question: formQuestion.value,
          answer: formAnswer.value,
          isPublished: formIsPublished.value,
        },
      });
    }
    showModal.value = false;
    show(editingFaq.value ? "FAQを更新しました" : "FAQを追加しました", "success");
    await fetchData();
  } catch {
    // useApi が自動通知
  } finally {
    saving.value = false;
  }
}

function openDeleteConfirm(faq: Faq) {
  deletingFaq.value = faq;
  showDeleteConfirm.value = true;
}

async function handleDelete() {
  if (!deletingFaq.value) return;
  try {
    await apiFetch(`/api/faqs/${deletingFaq.value.id}`, { method: "DELETE" });
    showDeleteConfirm.value = false;
    deletingFaq.value = null;
    show("FAQを削除しました", "success");
    await fetchData();
  } catch {
    // useApi が自動通知
  }
}

function getServiceName(serviceId: string): string {
  return services.value.find((s) => s.id === serviceId)?.name || "不明";
}

// フィルター変更時はページを1に戻す
watch(filterServiceId, () => {
  currentPage.value = 1;
  fetchData();
});
onMounted(fetchData);
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-bold text-gray-900">FAQ管理</h1>
      <div class="flex gap-2">
        <button
          :disabled="!filterServiceId || generating"
          class="rounded-md border border-primary-600 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 disabled:opacity-50"
          @click="handleGenerate"
        >
          {{ generating ? "生成中..." : "AI自動生成" }}
        </button>
        <button
          class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          @click="openCreateModal"
        >
          + FAQ追加
        </button>
      </div>
    </div>

    <div class="mb-4">
      <select v-model="filterServiceId" class="rounded-md border border-gray-300 px-3 py-2 text-sm">
        <option value="">全サービス</option>
        <option v-for="svc in services" :key="svc.id" :value="svc.id">{{ svc.name }}</option>
      </select>
    </div>

    <!-- ローディング -->
    <div v-if="loading" class="py-12 text-center text-sm text-gray-400">読み込み中...</div>

    <!-- 空状態 -->
    <div v-else-if="faqs.length === 0" class="rounded-lg border border-gray-200 px-4 py-12 text-center text-sm text-gray-400">
      FAQがありません
    </div>

    <template v-else>
      <!-- モバイル: カード表示 -->
      <div class="space-y-3 md:hidden">
        <div
          v-for="faq in paginatedFaqs"
          :key="faq.id"
          class="rounded-lg border border-gray-200 bg-white p-4"
        >
          <p class="mb-1 text-sm font-medium text-gray-900 line-clamp-2">{{ faq.question }}</p>
          <p class="mb-2 text-xs text-gray-400 line-clamp-2">{{ faq.answer }}</p>
          <div class="mb-2 flex flex-wrap items-center gap-1.5">
            <span class="text-xs text-gray-500">{{ getServiceName(faq.serviceId) }}</span>
            <span
              class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
              :class="faq.generatedFrom === 'auto' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'"
            >
              {{ faq.generatedFrom === "auto" ? "自動生成" : "手動" }}
            </span>
            <span
              class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
              :class="faq.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
            >
              {{ faq.isPublished ? "公開" : "下書き" }}
            </span>
          </div>
          <div class="flex gap-3">
            <button class="text-xs text-primary-600 hover:text-primary-800" @click="openEditModal(faq)">
              編集
            </button>
            <button class="text-xs text-red-600 hover:text-red-800" @click="openDeleteConfirm(faq)">
              削除
            </button>
          </div>
        </div>
      </div>

      <!-- PC: テーブル表示 -->
      <div class="hidden overflow-x-auto rounded-lg border border-gray-200 md:block">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">質問</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">サービス</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">種別</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">公開</th>
              <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            <tr v-for="faq in paginatedFaqs" :key="faq.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 text-sm text-gray-900">
                <div class="max-w-sm truncate">{{ faq.question }}</div>
                <div class="mt-0.5 max-w-sm truncate text-xs text-gray-400">{{ faq.answer }}</div>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{{ getServiceName(faq.serviceId) }}</td>
              <td class="whitespace-nowrap px-4 py-3">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="faq.generatedFrom === 'auto' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'"
                >
                  {{ faq.generatedFrom === "auto" ? "自動生成" : "手動" }}
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-3">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="faq.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                >
                  {{ faq.isPublished ? "公開" : "下書き" }}
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right">
                <button class="mr-2 text-sm text-primary-600 hover:text-primary-800" @click="openEditModal(faq)">
                  編集
                </button>
                <button class="text-sm text-red-600 hover:text-red-800" @click="openDeleteConfirm(faq)">
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
        :total-items="faqs.length"
        :items-per-page="itemsPerPage"
        @page-change="currentPage = $event"
      />
    </template>

    <!-- 作成/編集モーダル -->
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
          v-if="showModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-gray-600/75 p-4"
          @click.self="showModal = false"
        >
          <div class="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 class="mb-4 text-lg font-semibold text-gray-900">
              {{ editingFaq ? "FAQを編集" : "FAQを追加" }}
            </h3>
            <form class="space-y-4" @submit.prevent="handleSave">
              <div>
                <label class="block text-sm font-medium text-gray-700">サービス *</label>
                <select
                  v-model="formServiceId"
                  required
                  class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option v-for="svc in services" :key="svc.id" :value="svc.id">{{ svc.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">質問 *</label>
                <textarea
                  v-model="formQuestion"
                  rows="2"
                  required
                  class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="よくある質問を入力..."
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">回答 *</label>
                <textarea
                  v-model="formAnswer"
                  rows="4"
                  required
                  class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="回答を入力..."
                />
              </div>
              <div class="flex items-center gap-2">
                <input
                  id="faqPublished"
                  v-model="formIsPublished"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label for="faqPublished" class="text-sm text-gray-700">公開する</label>
              </div>
              <div class="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  @click="showModal = false"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  :disabled="saving || !formQuestion.trim() || !formAnswer.trim()"
                  class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {{ saving ? "保存中..." : "保存" }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 削除確認 -->
    <ConfirmDialog
      :open="showDeleteConfirm"
      title="FAQを削除"
      :message="`このFAQを削除しますか？`"
      confirm-label="削除"
      variant="danger"
      @confirm="handleDelete"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>
