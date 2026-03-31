<script setup lang="ts">
import type { Service } from "~~/shared/types/models";

definePageMeta({
  layout: "admin",
  middleware: ["auth", "admin"],
});

const { apiFetch } = useApi();
const { show } = useNotification();

const services = ref<Service[]>([]);
const loading = ref(true);

// ページネーション
const currentPage = ref(1);
const itemsPerPage = 20;

// モーダル状態
const showModal = ref(false);
const editingService = ref<Service | null>(null);
const formName = ref("");
const formDescription = ref("");
const formIsActive = ref(true);
const formGoogleFormUrl = ref("");
const saving = ref(false);

// ボット設定（サービス個別）
const showBotConfig = ref(false);
const formUseCustomBotConfig = ref(false);
const formConfidenceThreshold = ref<number | null>(null);
const formRagTopK = ref<number | null>(null);
const formSystemPrompt = ref<string | null>(null);

// 削除確認
const showDeleteConfirm = ref(false);
const deletingService = ref<Service | null>(null);

const totalPages = computed(() => Math.ceil(services.value.length / itemsPerPage));
const paginatedServices = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return services.value.slice(start, start + itemsPerPage);
});

// データ変更時にページを範囲内に補正
watch(totalPages, (tp) => {
  if (currentPage.value > tp && tp > 0) currentPage.value = tp;
});

async function fetchServices() {
  loading.value = true;
  try {
    services.value = await apiFetch<Service[]>("/api/services");
  } catch {
    services.value = [];
  } finally {
    loading.value = false;
  }
}

function resetBotConfigForm() {
  formUseCustomBotConfig.value = false;
  formConfidenceThreshold.value = null;
  formRagTopK.value = null;
  formSystemPrompt.value = null;
  showBotConfig.value = false;
}

function openCreateModal() {
  editingService.value = null;
  formName.value = "";
  formDescription.value = "";
  formIsActive.value = true;
  formGoogleFormUrl.value = "";
  resetBotConfigForm();
  showModal.value = true;
}

function openEditModal(service: Service) {
  editingService.value = service;
  formName.value = service.name;
  formDescription.value = service.description;
  formIsActive.value = service.isActive;
  formGoogleFormUrl.value = service.googleFormUrl || "";
  if (service.botConfig) {
    formUseCustomBotConfig.value = true;
    formConfidenceThreshold.value = service.botConfig.confidenceThreshold ?? null;
    formRagTopK.value = service.botConfig.ragTopK ?? null;
    formSystemPrompt.value = service.botConfig.systemPrompt ?? null;
    showBotConfig.value = true;
  } else {
    resetBotConfigForm();
  }
  showModal.value = true;
}

async function handleSave() {
  if (!formName.value.trim()) return;
  saving.value = true;
  try {
    // 空文字列・NaN は未設定（グループ設定フォールバック）として扱う
    const ct = typeof formConfidenceThreshold.value === "number" && !isNaN(formConfidenceThreshold.value)
      ? formConfidenceThreshold.value
      : null;
    const topK = typeof formRagTopK.value === "number" && !isNaN(formRagTopK.value)
      ? formRagTopK.value
      : null;
    const sp = formSystemPrompt.value && formSystemPrompt.value.trim()
      ? formSystemPrompt.value.trim()
      : null;

    const botConfig = formUseCustomBotConfig.value
      ? {
          ...(ct !== null && { confidenceThreshold: ct }),
          ...(topK !== null && { ragTopK: topK }),
          ...(sp !== null && { systemPrompt: sp }),
        }
      : null;

    const payload = {
      name: formName.value,
      description: formDescription.value,
      isActive: formIsActive.value,
      googleFormUrl: formGoogleFormUrl.value,
      ...(editingService.value
        ? { botConfig }
        : botConfig
          ? { botConfig }
          : {}),
    };

    if (editingService.value) {
      await apiFetch(`/api/services/${editingService.value.id}`, {
        method: "PUT",
        body: payload,
      });
    } else {
      await apiFetch("/api/services", {
        method: "POST",
        body: payload,
      });
    }

    showModal.value = false;
    show(editingService.value ? "サービスを更新しました" : "サービスを追加しました", "success");
    await fetchServices();
  } catch {
    // useApi が自動通知
  } finally {
    saving.value = false;
  }
}

function openDeleteConfirm(service: Service) {
  deletingService.value = service;
  showDeleteConfirm.value = true;
}

async function handleDelete() {
  if (!deletingService.value) return;
  try {
    await apiFetch(`/api/services/${deletingService.value.id}`, {
      method: "DELETE",
    });
    showDeleteConfirm.value = false;
    deletingService.value = null;
    show("サービスを削除しました", "success");
    await fetchServices();
  } catch {
    // useApi が自動通知
  }
}

onMounted(fetchServices);
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900">サービス管理</h1>
      <button
        class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        @click="openCreateModal"
      >
        + サービス追加
      </button>
    </div>

    <!-- ローディング -->
    <div v-if="loading" class="py-12 text-center text-sm text-gray-400">読み込み中...</div>

    <!-- 空状態 -->
    <div
      v-else-if="services.length === 0"
      class="rounded-lg border border-gray-200 px-4 py-12 text-center text-sm text-gray-400"
    >
      サービスがまだ登録されていません
    </div>

    <template v-else>
      <!-- モバイル: カード表示 -->
      <div class="space-y-3 md:hidden">
        <div
          v-for="service in paginatedServices"
          :key="service.id"
          class="rounded-lg border border-gray-200 bg-white p-4"
        >
          <div class="mb-2 flex items-start justify-between gap-2">
            <p class="text-sm font-medium text-gray-900">{{ service.name }}</p>
            <span
              class="inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
              :class="
                service.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              "
            >
              {{ service.isActive ? "有効" : "無効" }}
            </span>
          </div>
          <p class="mb-3 text-xs text-gray-500">{{ service.description || "—" }}</p>
          <div class="flex gap-3">
            <button
              class="text-xs text-primary-600 hover:text-primary-800"
              @click="openEditModal(service)"
            >
              編集
            </button>
            <button
              class="text-xs text-red-600 hover:text-red-800"
              @click="openDeleteConfirm(service)"
            >
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
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                名前
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                説明
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                状態
              </th>
              <th
                class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                操作
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            <tr v-for="service in paginatedServices" :key="service.id" class="hover:bg-gray-50">
              <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                {{ service.name }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-500">
                {{ service.description || "—" }}
              </td>
              <td class="whitespace-nowrap px-4 py-3">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="
                    service.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  "
                >
                  {{ service.isActive ? "有効" : "無効" }}
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right">
                <button
                  class="mr-2 text-sm text-primary-600 hover:text-primary-800"
                  @click="openEditModal(service)"
                >
                  編集
                </button>
                <button
                  class="text-sm text-red-600 hover:text-red-800"
                  @click="openDeleteConfirm(service)"
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
        :total-items="services.length"
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
          <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 class="mb-4 text-lg font-semibold text-gray-900">
              {{ editingService ? "サービスを編集" : "サービスを追加" }}
            </h3>
            <form class="space-y-4" @submit.prevent="handleSave">
              <div>
                <label class="block text-sm font-medium text-gray-700">サービス名 *</label>
                <input
                  v-model="formName"
                  type="text"
                  required
                  class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="例: 社内ネットワーク"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">説明</label>
                <textarea
                  v-model="formDescription"
                  rows="3"
                  class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="このサービスの概要を入力..."
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Google フォーム URL</label>
                <input
                  v-model="formGoogleFormUrl"
                  type="url"
                  class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="https://docs.google.com/forms/d/e/..."
                />
                <p class="mt-1 text-xs text-gray-400">
                  AIが回答できない場合に案内されるフォームのURLです
                </p>
              </div>
              <div class="flex items-center gap-2">
                <input
                  id="isActive"
                  v-model="formIsActive"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label for="isActive" class="text-sm text-gray-700">有効にする</label>
              </div>

              <!-- ボット設定（サービス個別） -->
              <div class="border-t border-gray-200 pt-4">
                <button
                  type="button"
                  class="flex w-full items-center gap-1 text-sm font-medium text-gray-700"
                  @click="showBotConfig = !showBotConfig"
                >
                  <span
                    class="inline-block transition-transform"
                    :class="showBotConfig ? 'rotate-90' : ''"
                  >
                    &#9654;
                  </span>
                  ボット設定（サービス個別）
                </button>
                <div v-if="showBotConfig" class="mt-3 space-y-3">
                  <div class="flex items-center gap-2">
                    <input
                      id="useCustomBotConfig"
                      v-model="formUseCustomBotConfig"
                      type="checkbox"
                      class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label for="useCustomBotConfig" class="text-sm text-gray-700">
                      このサービス独自の設定を使用する
                    </label>
                  </div>
                  <template v-if="formUseCustomBotConfig">
                    <div class="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label class="block text-xs font-medium text-gray-700">
                          確信度しきい値
                        </label>
                        <input
                          v-model.number="formConfidenceThreshold"
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                          placeholder="グループ設定を使用"
                        />
                      </div>
                      <div>
                        <label class="block text-xs font-medium text-gray-700">
                          RAG 検索件数 (Top K)
                        </label>
                        <input
                          v-model.number="formRagTopK"
                          type="number"
                          min="1"
                          max="20"
                          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                          placeholder="グループ設定を使用"
                        />
                      </div>
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700">
                        システムプロンプト
                      </label>
                      <textarea
                        v-model="formSystemPrompt"
                        rows="3"
                        class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                        placeholder="空欄の場合はグループ設定を使用"
                      />
                    </div>
                    <p class="text-xs text-gray-400">
                      空欄のフィールドはグループデフォルト設定が適用されます
                    </p>
                  </template>
                </div>
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
                  :disabled="saving || !formName.trim()"
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

    <!-- 削除確認ダイアログ -->
    <ConfirmDialog
      :open="showDeleteConfirm"
      title="サービスを削除"
      :message="`「${deletingService?.name}」を削除しますか？関連するドキュメントやFAQにも影響します。`"
      confirm-label="削除"
      variant="danger"
      @confirm="handleDelete"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>
