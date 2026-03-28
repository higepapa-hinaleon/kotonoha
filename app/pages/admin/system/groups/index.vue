<script setup lang="ts">
import type { Group } from "~~/shared/types/models";

definePageMeta({ middleware: ["auth", "admin"], layout: "admin" });

const { apiFetch } = useApi();
const { show } = useNotification();

const groups = ref<Group[]>([]);
const loading = ref(true);
const showCreateDialog = ref(false);
const newGroupName = ref("");
const newGroupDescription = ref("");
const creating = ref(false);

// ページネーション
const currentPage = ref(1);
const itemsPerPage = 20;

const totalPages = computed(() => Math.ceil(groups.value.length / itemsPerPage));
const paginatedGroups = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return groups.value.slice(start, start + itemsPerPage);
});

watch(totalPages, (tp) => {
  if (currentPage.value > tp && tp > 0) currentPage.value = tp;
});

async function fetchGroups() {
  loading.value = true;
  try {
    groups.value = await apiFetch<Group[]>("/api/groups");
  } finally {
    loading.value = false;
  }
}

async function createGroup() {
  const trimmed = newGroupName.value.trim();
  if (!trimmed) return;
  if (trimmed.length > 100) {
    show("グループ名は100文字以内にしてください", "error");
    return;
  }
  creating.value = true;
  try {
    await apiFetch("/api/groups", {
      method: "POST",
      body: { name: newGroupName.value, description: newGroupDescription.value },
    });
    show("グループを作成しました", "success");
    newGroupName.value = "";
    newGroupDescription.value = "";
    showCreateDialog.value = false;
    await fetchGroups();
  } finally {
    creating.value = false;
  }
}

async function deleteGroup(id: string, name: string) {
  if (!confirm(`グループ「${name}」を削除しますか？`)) return;
  try {
    await apiFetch(`/api/groups/${id}`, { method: "DELETE" });
    show("グループを削除しました", "success");
    await fetchGroups();
  } catch {
    // useApi handles errors
  }
}

onMounted(fetchGroups);
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">グループ管理</h1>
      <button
        class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        @click="showCreateDialog = true"
      >
        グループを作成
      </button>
    </div>

    <div v-if="loading" class="py-8 text-center text-gray-500">読み込み中...</div>

    <!-- 空状態 -->
    <div v-else-if="groups.length === 0" class="rounded-lg border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">
      グループがありません
    </div>

    <template v-else>
      <!-- モバイル: カード表示 -->
      <div class="space-y-3 md:hidden">
        <div
          v-for="group in paginatedGroups"
          :key="group.id"
          class="rounded-lg border border-gray-200 bg-white p-4"
        >
          <div class="mb-2 flex items-start justify-between gap-2">
            <NuxtLink :to="`/admin/system/groups/${group.id}`" class="text-sm font-medium text-primary-600 hover:text-primary-800">
              {{ group.name }}
            </NuxtLink>
            <span
              class="inline-flex shrink-0 rounded-full px-2 py-1 text-xs font-semibold"
              :class="group.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'"
            >
              {{ group.isActive ? '有効' : '無効' }}
            </span>
          </div>
          <p class="mb-2 text-xs text-gray-500">{{ group.description || '-' }}</p>
          <button
            class="text-xs text-red-600 hover:text-red-800"
            @click="deleteGroup(group.id, group.name)"
          >
            削除
          </button>
        </div>
      </div>

      <!-- PC: テーブル表示 -->
      <div class="hidden overflow-hidden rounded-lg border border-gray-200 bg-white md:block">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">グループ名</th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">説明</th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">状態</th>
              <th class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="group in paginatedGroups" :key="group.id">
              <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                <NuxtLink :to="`/admin/system/groups/${group.id}`" class="text-primary-600 hover:text-primary-800">
                  {{ group.name }}
                </NuxtLink>
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">{{ group.description || '-' }}</td>
              <td class="px-6 py-4 text-sm">
                <span
                  class="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
                  :class="group.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'"
                >
                  {{ group.isActive ? '有効' : '無効' }}
                </span>
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-right text-sm">
                <button
                  class="text-red-600 hover:text-red-800"
                  @click="deleteGroup(group.id, group.name)"
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
        :total-items="groups.length"
        :items-per-page="itemsPerPage"
        @page-change="currentPage = $event"
      />
    </template>

    <!-- 作成ダイアログ -->
    <Teleport to="body">
      <div v-if="showCreateDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h2 class="mb-4 text-lg font-bold text-gray-900">グループを作成</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">グループ名</label>
              <input v-model="newGroupName" type="text" class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" placeholder="例: 営業部" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">説明</label>
              <textarea v-model="newGroupDescription" rows="2" class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" placeholder="グループの説明（任意）" />
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" @click="showCreateDialog = false">キャンセル</button>
            <button class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50" :disabled="creating || !newGroupName.trim()" @click="createGroup">
              {{ creating ? '作成中...' : '作成' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
