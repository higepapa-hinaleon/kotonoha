<script setup lang="ts">
import type { Organization, Contract, ContractStatus } from "~~/shared/types/models";
import { PLAN_DEFINITIONS } from "~~/shared/plans";
import type { PlanId } from "~~/shared/plans";

definePageMeta({ middleware: ["auth", "admin"], layout: "admin" });

interface OrgWithContract extends Organization {
  contract: Contract | null;
}

const { apiFetch } = useApi();

const organizations = ref<OrgWithContract[]>([]);
const loading = ref(true);

// ページネーション
const currentPage = ref(1);
const itemsPerPage = 20;

const totalPages = computed(() => Math.ceil(organizations.value.length / itemsPerPage));
const paginatedOrgs = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return organizations.value.slice(start, start + itemsPerPage);
});

watch(totalPages, (tp) => {
  if (currentPage.value > tp && tp > 0) currentPage.value = tp;
});

function planDisplayName(plan: string): string {
  const def = PLAN_DEFINITIONS[plan as PlanId];
  return def ? def.displayName : plan;
}

function planBadgeClass(plan: string): string {
  switch (plan) {
    case "enterprise":
      return "bg-purple-100 text-purple-800";
    case "business":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function contractStatusLabel(status: ContractStatus | null): string {
  if (!status) return "未契約";
  const labels: Record<ContractStatus, string> = {
    active: "有効",
    pending_payment: "入金待ち",
    suspended: "停止",
    expired: "期限切れ",
    cancelled: "解約",
  };
  return labels[status] || status;
}

function contractBadgeClass(status: ContractStatus | null): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "pending_payment":
      return "bg-yellow-100 text-yellow-800";
    case "suspended":
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

async function fetchOrganizations() {
  loading.value = true;
  try {
    organizations.value = await apiFetch<OrgWithContract[]>("/api/system/organizations");
  } finally {
    loading.value = false;
  }
}

onMounted(fetchOrganizations);
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">組織管理</h1>
    </div>

    <div v-if="loading" class="py-8 text-center text-gray-500">読み込み中...</div>

    <div
      v-else-if="organizations.length === 0"
      class="rounded-lg border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500"
    >
      組織がありません
    </div>

    <template v-else>
      <!-- モバイル: カード表示 -->
      <div class="space-y-3 md:hidden">
        <div
          v-for="org in paginatedOrgs"
          :key="org.id"
          class="rounded-lg border border-gray-200 bg-white p-4"
        >
          <div class="mb-2 flex items-start justify-between gap-2">
            <NuxtLink
              :to="`/admin/system/organizations/${org.id}`"
              class="text-sm font-medium text-primary-600 hover:text-primary-800"
            >
              {{ org.name }}
            </NuxtLink>
            <div class="flex shrink-0 gap-1">
              <span
                class="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
                :class="planBadgeClass(org.plan)"
              >
                {{ planDisplayName(org.plan) }}
              </span>
              <span
                class="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
                :class="contractBadgeClass(org.contract?.status ?? null)"
              >
                {{ contractStatusLabel(org.contract?.status ?? null) }}
              </span>
            </div>
          </div>
          <p class="text-xs text-gray-500">
            作成日: {{ new Date(org.createdAt).toLocaleDateString("ja-JP") }}
          </p>
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
                組織名
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                プラン
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                契約ステータス
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                作成日
              </th>
              <th
                class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                操作
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="org in paginatedOrgs" :key="org.id">
              <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                <NuxtLink
                  :to="`/admin/system/organizations/${org.id}`"
                  class="text-primary-600 hover:text-primary-800"
                >
                  {{ org.name }}
                </NuxtLink>
              </td>
              <td class="px-6 py-4 text-sm">
                <span
                  class="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
                  :class="planBadgeClass(org.plan)"
                >
                  {{ planDisplayName(org.plan) }}
                </span>
              </td>
              <td class="px-6 py-4 text-sm">
                <span
                  class="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
                  :class="contractBadgeClass(org.contract?.status ?? null)"
                >
                  {{ contractStatusLabel(org.contract?.status ?? null) }}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">
                {{ new Date(org.createdAt).toLocaleDateString("ja-JP") }}
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-right text-sm">
                <NuxtLink
                  :to="`/admin/system/organizations/${org.id}`"
                  class="text-primary-600 hover:text-primary-800"
                >
                  詳細
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Pagination
        :current-page="currentPage"
        :total-pages="totalPages"
        :total-items="organizations.length"
        :items-per-page="itemsPerPage"
        @page-change="currentPage = $event"
      />
    </template>
  </div>
</template>
