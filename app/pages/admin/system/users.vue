<script setup lang="ts">
import type { User, UserGroupMembership, Group, Invitation } from "~~/shared/types/models";

definePageMeta({ middleware: ["auth", "admin"], layout: "admin" });

const { apiFetch } = useApi();
const { show } = useNotification();

interface UserWithMemberships extends User {
  groupMemberships: UserGroupMembership[];
}

const users = ref<UserWithMemberships[]>([]);
const loading = ref(true);

// ページネーション
const usersPage = ref(1);
const usersPerPage = 20;

// 招待関連
const invitations = ref<Invitation[]>([]);
const groups = ref<Group[]>([]);
const showInviteDialog = ref(false);
const inviteEmail = ref("");
const inviteGroupId = ref("");
const inviteRole = ref<"admin" | "member">("member");
const inviting = ref(false);

const usersTotalPages = computed(() => Math.ceil(users.value.length / usersPerPage));
const paginatedUsers = computed(() => {
  const start = (usersPage.value - 1) * usersPerPage;
  return users.value.slice(start, start + usersPerPage);
});

watch(usersTotalPages, (tp) => {
  if (usersPage.value > tp && tp > 0) usersPage.value = tp;
});

async function fetchUsers() {
  loading.value = true;
  try {
    users.value = await apiFetch<UserWithMemberships[]>("/api/system/users");
  } finally {
    loading.value = false;
  }
}

async function fetchInvitations() {
  try {
    invitations.value = await apiFetch<Invitation[]>("/api/system/invitations");
  } catch {
    // useApi handles errors
  }
}

async function fetchGroups() {
  try {
    groups.value = await apiFetch<Group[]>("/api/groups");
  } catch {
    // useApi handles errors
  }
}

async function updateRole(userId: string, role: string) {
  try {
    await apiFetch(`/api/system/users/${userId}/role`, {
      method: "PUT",
      body: { role },
    });
    show("ロールを変更しました", "success");
    await fetchUsers();
  } catch {
    // useApi handles errors
  }
}

function openInviteDialog() {
  inviteEmail.value = "";
  inviteGroupId.value = groups.value[0]?.id || "";
  inviteRole.value = "member";
  showInviteDialog.value = true;
}

async function sendInvitation() {
  const email = inviteEmail.value.trim();
  if (!email || !inviteGroupId.value) return;

  inviting.value = true;
  try {
    await apiFetch("/api/system/invitations", {
      method: "POST",
      body: { email, groupId: inviteGroupId.value, role: inviteRole.value },
    });
    show("招待を作成しました", "success");
    showInviteDialog.value = false;
    await fetchInvitations();
  } catch {
    // useApi handles errors
  } finally {
    inviting.value = false;
  }
}

async function deleteInvitation(id: string) {
  try {
    await apiFetch(`/api/system/invitations/${id}`, { method: "DELETE" });
    show("招待を削除しました", "success");
    await fetchInvitations();
  } catch {
    // useApi handles errors
  }
}

function groupName(groupId: string): string {
  return groups.value.find((g) => g.id === groupId)?.name || groupId;
}

onMounted(async () => {
  await Promise.all([fetchUsers(), fetchInvitations(), fetchGroups()]);
});
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">ユーザー管理</h1>

    <div v-if="loading" class="py-8 text-center text-gray-500">読み込み中...</div>

    <!-- 空状態 -->
    <div
      v-else-if="users.length === 0"
      class="rounded-lg border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-400"
    >
      ユーザーがいません
    </div>

    <template v-else>
      <!-- モバイル: ユーザーカード -->
      <div class="space-y-3 md:hidden">
        <div
          v-for="u in paginatedUsers"
          :key="u.id"
          class="rounded-lg border border-gray-200 bg-white p-4"
        >
          <p class="mb-1 text-sm font-medium text-gray-900">{{ u.displayName }}</p>
          <p class="mb-2 text-xs text-gray-500">{{ u.email }}</p>
          <div class="flex items-center justify-between">
            <select
              :value="u.role"
              class="rounded-md border border-gray-300 px-2 py-1 text-xs"
              @change="updateRole(u.id, ($event.target as HTMLSelectElement).value)"
            >
              <option value="owner">オーナー</option>
              <option value="system_admin">システム管理者</option>
              <option value="org_admin">組織管理者</option>
              <option value="user">ユーザー</option>
            </select>
            <span class="text-xs text-gray-500">
              <span v-if="u.groupMemberships.length === 0" class="text-gray-400">未割当</span>
              <span v-else>{{ u.groupMemberships.length }}グループ</span>
            </span>
          </div>
        </div>
      </div>

      <!-- PC: ユーザーテーブル -->
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
                システムロール
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                所属グループ
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="u in paginatedUsers" :key="u.id">
              <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                {{ u.displayName }}
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">{{ u.email }}</td>
              <td class="px-6 py-4 text-sm">
                <select
                  :value="u.role"
                  class="rounded-md border border-gray-300 px-2 py-1 text-sm"
                  @change="updateRole(u.id, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="owner">オーナー</option>
                  <option value="system_admin">システム管理者</option>
                  <option value="org_admin">組織管理者</option>
                  <option value="user">ユーザー</option>
                </select>
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">
                <span v-if="u.groupMemberships.length === 0" class="text-gray-400">未割当</span>
                <span v-else>{{ u.groupMemberships.length }}グループ</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ユーザーページネーション -->
      <Pagination
        :current-page="usersPage"
        :total-pages="usersTotalPages"
        :total-items="users.length"
        :items-per-page="usersPerPage"
        @page-change="usersPage = $event"
      />
    </template>

    <!-- 招待セクション -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">招待</h2>
        <button
          class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          @click="openInviteDialog"
        >
          ユーザーを招待
        </button>
      </div>

      <div
        v-if="invitations.length === 0"
        class="rounded-lg border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-400"
      >
        保留中の招待はありません
      </div>

      <template v-else>
        <!-- モバイル: 招待カード -->
        <div class="space-y-3 md:hidden">
          <div
            v-for="inv in invitations"
            :key="inv.id"
            class="rounded-lg border border-gray-200 bg-white p-4"
          >
            <p class="mb-1 text-sm font-medium text-gray-900">{{ inv.email }}</p>
            <div class="mb-2 space-y-0.5 text-xs text-gray-500">
              <p>グループ: {{ groupName(inv.groupId) }}</p>
              <div class="flex items-center justify-between">
                <span>ロール: {{ inv.role === "admin" ? "管理者" : "メンバー" }}</span>
                <span>{{ new Date(inv.createdAt).toLocaleDateString("ja-JP") }}</span>
              </div>
            </div>
            <button
              class="text-xs text-red-600 hover:text-red-800"
              @click="deleteInvitation(inv.id)"
            >
              削除
            </button>
          </div>
        </div>

        <!-- PC: 招待テーブル -->
        <div class="hidden overflow-hidden rounded-lg border border-gray-200 bg-white md:block">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  メール
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  グループ
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  ロール
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  作成日
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  操作
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="inv in invitations" :key="inv.id">
                <td class="px-6 py-4 text-sm text-gray-900">{{ inv.email }}</td>
                <td class="px-6 py-4 text-sm text-gray-500">{{ groupName(inv.groupId) }}</td>
                <td class="px-6 py-4 text-sm text-gray-500">
                  {{ inv.role === "admin" ? "管理者" : "メンバー" }}
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                  {{ new Date(inv.createdAt).toLocaleDateString("ja-JP") }}
                </td>
                <td class="px-6 py-4 text-sm">
                  <button class="text-red-600 hover:text-red-800" @click="deleteInvitation(inv.id)">
                    削除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <!-- 招待ダイアログ -->
    <div
      v-if="showInviteDialog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 class="mb-4 text-lg font-semibold text-gray-900">ユーザーを招待</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">メールアドレス</label>
            <input
              v-model="inviteEmail"
              type="email"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">グループ</label>
            <select
              v-model="inviteGroupId"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">グループロール</label>
            <select
              v-model="inviteRole"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="member">メンバー</option>
              <option value="admin">管理者</option>
            </select>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button
            class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            @click="showInviteDialog = false"
          >
            キャンセル
          </button>
          <button
            :disabled="!inviteEmail.trim() || !inviteGroupId || inviting"
            class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            @click="sendInvitation"
          >
            {{ inviting ? "送信中..." : "招待を作成" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
