<script setup lang="ts">
import type { Conversation, Service } from "~~/shared/types/models";

definePageMeta({
  layout: "admin",
  middleware: ["auth", "admin"],
});

const { apiFetch } = useApi();

interface ConversationWithUser extends Conversation {
  userName: string;
  channel: "widget" | "web";
}

const conversations = ref<ConversationWithUser[]>([]);
const services = ref<Service[]>([]);
const loading = ref(true);
const filterServiceId = ref("");
const filterStatus = ref("");
const filterChannel = ref("");
const searchKeyword = ref("");

// ページネーション
const currentPage = ref(1);
const itemsPerPage = 20;

async function fetchData() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filterServiceId.value) params.set("serviceId", filterServiceId.value);
    if (filterStatus.value) params.set("status", filterStatus.value);
    if (filterChannel.value) params.set("channel", filterChannel.value);

    const [convs, svcs] = await Promise.all([
      apiFetch<ConversationWithUser[]>(`/api/conversations/admin?${params}`),
      apiFetch<Service[]>("/api/services"),
    ]);
    conversations.value = convs;
    services.value = svcs;
  } finally {
    loading.value = false;
  }
}

const filteredConversations = computed(() => {
  if (!searchKeyword.value) return conversations.value;
  const kw = searchKeyword.value.toLowerCase();
  return conversations.value.filter(
    (c) =>
      c.title.toLowerCase().includes(kw) ||
      c.userName.toLowerCase().includes(kw),
  );
});

const totalPages = computed(() => Math.ceil(filteredConversations.value.length / itemsPerPage));
const paginatedConversations = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredConversations.value.slice(start, start + itemsPerPage);
});

watch(totalPages, (tp) => {
  if (currentPage.value > tp && tp > 0) currentPage.value = tp;
});

function getServiceName(serviceId: string): string {
  return services.value.find((s) => s.id === serviceId)?.name || "不明";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// フィルター変更時はページを1に戻す
watch([filterServiceId, filterStatus, filterChannel], () => {
  currentPage.value = 1;
  fetchData();
});
watch(searchKeyword, () => {
  currentPage.value = 1;
});

onMounted(fetchData);
</script>

<template>
  <div>
    <h1 class="mb-6 text-xl font-bold text-gray-900">サポート履歴</h1>

    <!-- フィルタ -->
    <div class="mb-4 flex flex-wrap gap-3">
      <SearchFilter v-model="searchKeyword" placeholder="タイトル・ユーザー名で検索..." class="w-64" />
      <select v-model="filterServiceId" class="rounded-md border border-gray-300 px-3 py-2 text-sm">
        <option value="">全サービス</option>
        <option v-for="svc in services" :key="svc.id" :value="svc.id">{{ svc.name }}</option>
      </select>
      <select v-model="filterStatus" class="rounded-md border border-gray-300 px-3 py-2 text-sm">
        <option value="">全ステータス</option>
        <option value="active">進行中</option>
        <option value="resolved_by_bot">解決済み</option>
        <option value="escalated">エスカレーション</option>
        <option value="closed">クローズ</option>
      </select>
      <select v-model="filterChannel" class="rounded-md border border-gray-300 px-3 py-2 text-sm">
        <option value="">全チャネル</option>
        <option value="widget">ウィジェット</option>
      </select>
    </div>

    <!-- ローディング -->
    <div v-if="loading" class="py-12 text-center text-sm text-gray-400">読み込み中...</div>

    <!-- 空状態 -->
    <div v-else-if="filteredConversations.length === 0" class="rounded-lg border border-gray-200 px-4 py-12 text-center text-sm text-gray-400">
      会話がありません
    </div>

    <template v-else>
      <!-- モバイル: カード表示 -->
      <div class="space-y-3 md:hidden">
        <div
          v-for="conv in paginatedConversations"
          :key="conv.id"
          class="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50"
          @click="navigateTo(`/admin/conversations/${conv.id}`)"
        >
          <div class="mb-2 flex items-start justify-between gap-2">
            <p class="text-sm font-medium text-gray-900">{{ conv.title }}</p>
            <StatusBadge :status="conv.status" size="sm" class="shrink-0" />
          </div>
          <div class="space-y-1 text-xs text-gray-500">
            <div class="flex items-center gap-1">
              <span v-if="conv.channel === 'widget'" class="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">ウィジェット</span>
              <span>{{ conv.userName }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span>{{ getServiceName(conv.serviceId) }}</span>
              <span>{{ formatDate(conv.createdAt) }}</span>
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
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ユーザー</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">サービス</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">状態</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">日時</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            <tr
              v-for="conv in paginatedConversations"
              :key="conv.id"
              class="cursor-pointer hover:bg-gray-50"
              @click="navigateTo(`/admin/conversations/${conv.id}`)"
            >
              <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{{ conv.title }}</td>
              <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                <span v-if="conv.channel === 'widget'" class="mr-1 inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">ウィジェット</span>
                {{ conv.userName }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{{ getServiceName(conv.serviceId) }}</td>
              <td class="whitespace-nowrap px-4 py-3"><StatusBadge :status="conv.status" size="sm" /></td>
              <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{{ formatDate(conv.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ページネーション -->
      <Pagination
        :current-page="currentPage"
        :total-pages="totalPages"
        :total-items="filteredConversations.length"
        :items-per-page="itemsPerPage"
        @page-change="currentPage = $event"
      />
    </template>
  </div>
</template>
