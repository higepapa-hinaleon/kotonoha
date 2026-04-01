<script setup lang="ts">
import type { Group } from "~~/shared/types/models";

definePageMeta({ middleware: ["auth", "admin"], layout: "admin" });

interface MemberInfo {
  id: string;
  userId: string;
  groupId: string;
  role: "admin" | "member";
  email: string;
  displayName: string;
  userRole: string;
}

const route = useRoute();
const { apiFetch } = useApi();
const { show } = useNotification();

const groupId = route.params.id as string;
const group = ref<Group | null>(null);
const members = ref<MemberInfo[]>([]);
const loading = ref(true);
const showAddDialog = ref(false);
const addRole = ref<"admin" | "member">("member");
const adding = ref(false);

// グループ情報編集
const editName = ref("");
const editDescription = ref("");
const editIsActive = ref(true);
const saving = ref(false);

// ページネーション
const currentPage = ref(1);
const itemsPerPage = 20;

// 全ユーザーリスト（メンバー追加ダイアログ用）
const allUsers = ref<{ id: string; email: string; displayName: string }[]>([]);
const selectedUserId = ref("");

const totalPages = computed(() => Math.ceil(members.value.length / itemsPerPage));
const paginatedMembers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return members.value.slice(start, start + itemsPerPage);
});

watch(totalPages, (tp) => {
  if (currentPage.value > tp && tp > 0) currentPage.value = tp;
});

async function fetchData() {
  loading.value = true;
  try {
    const [groups, membersData] = await Promise.all([
      apiFetch<Group[]>("/api/groups"),
      apiFetch<MemberInfo[]>(`/api/groups/${groupId}/members`),
    ]);
    group.value = groups.find((g) => g.id === groupId) || null;
    members.value = membersData;
    if (group.value) {
      editName.value = group.value.name;
      editDescription.value = group.value.description || "";
      editIsActive.value = group.value.isActive;
    }
  } finally {
    loading.value = false;
  }
}

async function saveGroup() {
  const trimmed = editName.value.trim();
  if (!trimmed) {
    show("グループ名は必須です", "error");
    return;
  }
  if (trimmed.length > 100) {
    show("グループ名は100文字以内にしてください", "error");
    return;
  }
  saving.value = true;
  try {
    const updated = await apiFetch<Group>(`/api/groups/${groupId}`, {
      method: "PUT",
      body: {
        name: editName.value.trim(),
        description: editDescription.value.trim(),
        isActive: editIsActive.value,
      },
    });
    group.value = { ...group.value, ...updated } as Group;
    show("グループ情報を更新しました", "success");
  } finally {
    saving.value = false;
  }
}

async function openAddDialog() {
  const users =
    await apiFetch<{ id: string; email: string; displayName: string }[]>(`/api/system/users?organizationId=${group.value!.organizationId}`);
  // 既にメンバーのユーザーを除外
  const memberIds = new Set(members.value.map((m) => m.userId));
  allUsers.value = users.filter((u) => !memberIds.has(u.id));
  selectedUserId.value = allUsers.value[0]?.id || "";
  showAddDialog.value = true;
}

async function addMember() {
  if (!selectedUserId.value) return;
  adding.value = true;
  try {
    await apiFetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      body: { userId: selectedUserId.value, role: addRole.value },
    });
    show("メンバーを追加しました", "success");
    showAddDialog.value = false;
    await fetchData();
  } finally {
    adding.value = false;
  }
}

async function updateRole(userId: string, role: "admin" | "member") {
  try {
    await apiFetch(`/api/groups/${groupId}/members/${userId}`, {
      method: "PUT",
      body: { role },
    });
    show("ロールを変更しました", "success");
    await fetchData();
  } catch {
    // useApi handles errors
  }
}

async function removeMember(userId: string, name: string) {
  if (!confirm(`${name} をグループから削除しますか？`)) return;
  try {
    await apiFetch(`/api/groups/${groupId}/members/${userId}`, { method: "DELETE" });
    show("メンバーを削除しました", "success");
    await fetchData();
  } catch {
    // useApi handles errors
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3">
      <NuxtLink
        to="/admin/system/groups"
        class="text-gray-400 hover:text-gray-600"
        aria-label="グループ一覧に戻る"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </NuxtLink>
      <h1 class="text-2xl font-bold text-gray-900">{{ group?.name || "..." }}</h1>
    </div>

    <div v-if="loading" class="py-8 text-center text-gray-500">読み込み中...</div>

    <template v-else-if="group">
      <!-- グループ情報編集 -->
      <div class="rounded-lg border border-gray-200 bg-white p-6">
        <h2 class="mb-4 text-lg font-bold text-gray-900">グループ情報</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-gray-700">グループ名</label>
            <input
              v-model="editName"
              type="text"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">状態</label>
            <label class="mt-2 inline-flex cursor-pointer items-center gap-2">
              <input v-model="editIsActive" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span class="text-sm text-gray-700">{{ editIsActive ? "有効" : "無効" }}</span>
            </label>
          </div>
          <div class="sm:col-span-2">
            <label class="block text-sm font-medium text-gray-700">説明</label>
            <textarea
              v-model="editDescription"
              rows="2"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="グループの説明（任意）"
            />
          </div>
        </div>
        <div class="mt-2 text-xs text-gray-400">
          作成日: {{ new Date(group.createdAt).toLocaleDateString("ja-JP") }} / 更新日:
          {{ new Date(group.updatedAt).toLocaleDateString("ja-JP") }}
        </div>
        <div class="mt-4">
          <button
            class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            :disabled="saving || !editName.trim()"
            @click="saveGroup"
          >
            {{ saving ? "保存中..." : "保存" }}
          </button>
        </div>
      </div>

      <!-- メンバー管理 -->
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-gray-900">メンバー管理</h2>
        <button
          class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          @click="openAddDialog"
        >
          メンバーを追加
        </button>
      </div>

      <!-- 空状態 -->
      <div
        v-if="members.length === 0"
        class="rounded-lg border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500"
      >
        メンバーがいません
      </div>

      <template v-else>
        <!-- モバイル: カード表示 -->
        <div class="space-y-3 md:hidden">
          <div
            v-for="member in paginatedMembers"
            :key="member.userId"
            class="rounded-lg border border-gray-200 bg-white p-4"
          >
            <p class="mb-1 text-sm font-medium text-gray-900">{{ member.displayName }}</p>
            <p class="mb-2 text-xs text-gray-500">{{ member.email }}</p>
            <div class="flex items-center justify-between">
              <select
                :value="member.role"
                class="rounded-md border border-gray-300 px-2 py-1 text-xs"
                @change="
                  updateRole(
                    member.userId,
                    ($event.target as HTMLSelectElement).value as 'admin' | 'member',
                  )
                "
              >
                <option value="admin">管理者</option>
                <option value="member">メンバー</option>
              </select>
              <button
                class="text-xs text-red-600 hover:text-red-800"
                @click="removeMember(member.userId, member.displayName)"
              >
                削除
              </button>
            </div>
          </div>
        </div>

        <!-- PC: テーブル表示 -->
        <div class="hidden overflow-hidden rounded-lg border border-gray-200 bg-white md:block">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  ユーザー
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  メール
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  グループロール
                </th>
                <th
                  class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  操作
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="member in paginatedMembers" :key="member.userId">
                <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  {{ member.displayName }}
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">{{ member.email }}</td>
                <td class="px-6 py-4 text-sm">
                  <select
                    :value="member.role"
                    class="rounded-md border border-gray-300 px-2 py-1 text-sm"
                    @change="
                      updateRole(
                        member.userId,
                        ($event.target as HTMLSelectElement).value as 'admin' | 'member',
                      )
                    "
                  >
                    <option value="admin">管理者</option>
                    <option value="member">メンバー</option>
                  </select>
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-right text-sm">
                  <button
                    class="text-red-600 hover:text-red-800"
                    @click="removeMember(member.userId, member.displayName)"
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
          :total-items="members.length"
          :items-per-page="itemsPerPage"
          @page-change="currentPage = $event"
        />
      </template>
    </template>

    <!-- メンバー追加ダイアログ -->
    <Teleport to="body">
      <div
        v-if="showAddDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-title"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      >
        <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h2 id="add-member-title" class="mb-4 text-lg font-bold text-gray-900">メンバーを追加</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">ユーザー</label>
              <select
                v-model="selectedUserId"
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option v-for="u in allUsers" :key="u.id" :value="u.id">
                  {{ u.displayName }} ({{ u.email }})
                </option>
              </select>
              <p v-if="allUsers.length === 0" class="mt-1 text-sm text-gray-500">
                追加可能なユーザーがいません
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">ロール</label>
              <select
                v-model="addRole"
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="admin">管理者</option>
                <option value="member">メンバー</option>
              </select>
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button
              class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              @click="showAddDialog = false"
            >
              キャンセル
            </button>
            <button
              class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              :disabled="adding || !selectedUserId"
              @click="addMember"
            >
              {{ adding ? "追加中..." : "追加" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
