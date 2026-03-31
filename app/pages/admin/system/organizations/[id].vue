<script setup lang="ts">
import type { Organization, Contract, Group } from "~~/shared/types/models";
import type { OrganizationUsage } from "~~/shared/types/api";
import { PLAN_DEFINITIONS, PLAN_LIST } from "~~/shared/plans";
import type { PlanId } from "~~/shared/plans";

definePageMeta({ middleware: ["auth", "admin"], layout: "admin" });

const route = useRoute();
const { apiFetch } = useApi();
const { show } = useNotification();
const { isOwner, isSystemAdmin } = useAuth();

const orgId = route.params.id as string;

const org = ref<Organization | null>(null);
const contracts = ref<Contract[]>([]);
const groups = ref<Group[]>([]);
const usage = ref<OrganizationUsage | null>(null);
const loading = ref(true);
const saving = ref(false);

// 編集フォーム
const editName = ref("");
const editPlan = ref<PlanId>("starter");

// 契約ダイアログ
const showContractDialog = ref(false);
const editingContract = ref<Contract | null>(null);
const contractForm = ref({
  planId: "starter" as PlanId,
  status: "active" as Contract["status"],
  startDate: "",
  endDate: "",
  note: "",
});
const savingContract = ref(false);

const CONTRACT_STATUSES: { value: Contract["status"]; label: string }[] = [
  { value: "active", label: "有効" },
  { value: "pending_payment", label: "入金待ち" },
  { value: "suspended", label: "停止中" },
  { value: "expired", label: "期限切れ" },
  { value: "cancelled", label: "解約済み" },
];

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "pending_payment":
      return "bg-orange-100 text-orange-800";
    case "suspended":
      return "bg-yellow-100 text-yellow-800";
    case "expired":
      return "bg-gray-100 text-gray-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function statusLabel(status: string): string {
  return CONTRACT_STATUSES.find((s) => s.value === status)?.label || status;
}

function planDisplayName(plan: string): string {
  const def = PLAN_DEFINITIONS[plan as PlanId];
  return def ? def.displayName : plan;
}

async function fetchData() {
  loading.value = true;
  try {
    const [orgData, contractsData, groupsData] = await Promise.all([
      apiFetch<Organization>(`/api/system/organizations/${orgId}`),
      apiFetch<Contract[]>(`/api/system/organizations/${orgId}/contracts`),
      apiFetch<Group[]>(`/api/system/organizations/${orgId}/groups`),
    ]);
    org.value = orgData;
    contracts.value = contractsData;
    groups.value = groupsData;
    editName.value = orgData.name;
    editPlan.value = orgData.plan;
  } finally {
    loading.value = false;
  }

  // 利用状況は補助データのためエラーでも主要表示をブロックしない
  if (isSystemAdmin.value || isOwner.value) {
    try {
      usage.value = await apiFetch<OrganizationUsage>(
        `/api/system/organizations/${orgId}/usage`,
      );
    } catch {
      // 利用状況の取得失敗は無視（主要データに影響しない）
    }
  }
}

function usageDisplay(current: number, limit: number): string {
  return limit === -1 ? `${current}` : `${current} / ${limit}`;
}

function usageLimitLabel(limit: number): string {
  return limit === -1 ? "無制限" : `上限 ${limit.toLocaleString()}`;
}

function usageColorClass(current: number, limit: number): string {
  if (limit === -1) return "text-gray-900";
  const ratio = current / limit;
  if (ratio >= 1) return "text-red-600";
  if (ratio >= 0.8) return "text-orange-600";
  return "text-gray-900";
}

async function saveOrg() {
  if (!editName.value.trim()) {
    show("組織名は必須です", "error");
    return;
  }
  saving.value = true;
  try {
    const updated = await apiFetch<Organization>(`/api/system/organizations/${orgId}`, {
      method: "PUT",
      body: { name: editName.value, plan: editPlan.value },
    });
    org.value = updated;
    show("組織情報を更新しました", "success");
  } finally {
    saving.value = false;
  }
}

function openCreateContract() {
  editingContract.value = null;
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  contractForm.value = {
    planId: editPlan.value,
    status: "active",
    startDate: today,
    endDate: nextYear.toISOString().slice(0, 10),
    note: "",
  };
  showContractDialog.value = true;
}

function openEditContract(contract: Contract) {
  editingContract.value = contract;
  contractForm.value = {
    planId: contract.planId,
    status: contract.status,
    startDate: contract.startDate.slice(0, 10),
    endDate: contract.endDate.slice(0, 10),
    note: contract.note,
  };
  showContractDialog.value = true;
}

async function saveContract() {
  if (!contractForm.value.startDate || !contractForm.value.endDate) {
    show("開始日と終了日は必須です", "error");
    return;
  }
  if (contractForm.value.startDate > contractForm.value.endDate) {
    show("開始日は終了日以前である必要があります", "error");
    return;
  }
  savingContract.value = true;
  try {
    if (editingContract.value) {
      // 更新
      await apiFetch(`/api/system/organizations/${orgId}/contracts/${editingContract.value.id}`, {
        method: "PUT",
        body: contractForm.value,
      });
      show("契約を更新しました", "success");
    } else {
      // 作成
      await apiFetch(`/api/system/organizations/${orgId}/contracts`, {
        method: "POST",
        body: contractForm.value,
      });
      show("契約を作成しました", "success");
    }
    showContractDialog.value = false;
    // 契約一覧を再取得
    contracts.value = await apiFetch<Contract[]>(`/api/system/organizations/${orgId}/contracts`);
  } finally {
    savingContract.value = false;
  }
}

async function confirmPayment(contract: Contract) {
  if (!confirm("入金確認済みにしますか？この操作により契約が有効化されます。")) return;
  try {
    await apiFetch(`/api/system/contracts/${contract.id}/confirm-payment`, {
      method: "POST",
    });
    show("入金を確認し、契約を有効化しました", "success");
    contracts.value = await apiFetch<Contract[]>(`/api/system/organizations/${orgId}/contracts`);
  } catch {
    show("入金確認に失敗しました", "error");
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3">
      <NuxtLink to="/admin/system/organizations" class="text-sm text-gray-500 hover:text-gray-700">
        &larr; 組織一覧
      </NuxtLink>
    </div>

    <div v-if="loading" class="py-8 text-center text-gray-500">読み込み中...</div>

    <template v-else-if="org">
      <!-- 組織情報 -->
      <div class="rounded-lg border border-gray-200 bg-white p-6">
        <h2 class="mb-4 text-lg font-bold text-gray-900">組織情報</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-gray-700">組織名</label>
            <input
              v-model="editName"
              type="text"
              :disabled="!isOwner"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">プラン</label>
            <select
              v-model="editPlan"
              :disabled="!isOwner"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option v-for="plan in PLAN_LIST" :key="plan.id" :value="plan.id">
                {{ plan.displayName }}
              </option>
            </select>
          </div>
        </div>
        <div class="mt-2 text-xs text-gray-400">
          作成日: {{ new Date(org.createdAt).toLocaleDateString("ja-JP") }} / 更新日:
          {{ new Date(org.updatedAt).toLocaleDateString("ja-JP") }}
        </div>
        <div v-if="isOwner" class="mt-4">
          <button
            class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            :disabled="saving"
            @click="saveOrg"
          >
            {{ saving ? "保存中..." : "保存" }}
          </button>
        </div>
        <p v-else class="mt-4 text-xs text-gray-400">
          組織情報の変更はオーナーのみ可能です。
        </p>
      </div>

      <!-- プラン詳細 -->
      <div class="rounded-lg border border-gray-200 bg-white p-6">
        <h2 class="mb-4 text-lg font-bold text-gray-900">現在のプラン詳細</h2>
        <template v-if="PLAN_DEFINITIONS[org.plan]">
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div class="rounded-md bg-gray-50 p-3">
              <p class="text-xs text-gray-500">グループ上限</p>
              <p class="text-lg font-semibold text-gray-900">
                {{
                  PLAN_DEFINITIONS[org.plan].limits.maxGroups === -1
                    ? "無制限"
                    : PLAN_DEFINITIONS[org.plan].limits.maxGroups
                }}
              </p>
            </div>
            <div class="rounded-md bg-gray-50 p-3">
              <p class="text-xs text-gray-500">サービス上限</p>
              <p class="text-lg font-semibold text-gray-900">
                {{
                  PLAN_DEFINITIONS[org.plan].limits.maxServices === -1
                    ? "無制限"
                    : PLAN_DEFINITIONS[org.plan].limits.maxServices
                }}
              </p>
            </div>
            <div class="rounded-md bg-gray-50 p-3">
              <p class="text-xs text-gray-500">ドキュメント上限</p>
              <p class="text-lg font-semibold text-gray-900">
                {{
                  PLAN_DEFINITIONS[org.plan].limits.maxDocuments === -1
                    ? "無制限"
                    : PLAN_DEFINITIONS[org.plan].limits.maxDocuments
                }}
              </p>
            </div>
            <div class="rounded-md bg-gray-50 p-3">
              <p class="text-xs text-gray-500">月間チャット上限</p>
              <p class="text-lg font-semibold text-gray-900">
                {{
                  PLAN_DEFINITIONS[org.plan].limits.maxMonthlyChats === -1
                    ? "無制限"
                    : PLAN_DEFINITIONS[org.plan].limits.maxMonthlyChats.toLocaleString()
                }}
              </p>
            </div>
            <div class="rounded-md bg-gray-50 p-3">
              <p class="text-xs text-gray-500">ユーザー上限</p>
              <p class="text-lg font-semibold text-gray-900">
                {{
                  PLAN_DEFINITIONS[org.plan].limits.maxUsers === -1
                    ? "無制限"
                    : PLAN_DEFINITIONS[org.plan].limits.maxUsers
                }}
              </p>
            </div>
            <div class="rounded-md bg-gray-50 p-3">
              <p class="text-xs text-gray-500">機能フラグ</p>
              <div class="mt-1 space-y-1 text-xs">
                <p>
                  FAQ自動生成:
                  <span
                    :class="
                      PLAN_DEFINITIONS[org.plan].features.faqAutoGeneration
                        ? 'text-green-600'
                        : 'text-gray-400'
                    "
                  >
                    {{ PLAN_DEFINITIONS[org.plan].features.faqAutoGeneration ? "有効" : "無効" }}
                  </span>
                </p>
                <p>
                  週次レポート:
                  <span
                    :class="
                      PLAN_DEFINITIONS[org.plan].features.weeklyReports
                        ? 'text-green-600'
                        : 'text-gray-400'
                    "
                  >
                    {{ PLAN_DEFINITIONS[org.plan].features.weeklyReports ? "有効" : "無効" }}
                  </span>
                </p>
                <p>
                  RAG診断:
                  <span
                    :class="
                      PLAN_DEFINITIONS[org.plan].features.ragDiagnostics
                        ? 'text-green-600'
                        : 'text-gray-400'
                    "
                  >
                    {{ PLAN_DEFINITIONS[org.plan].features.ragDiagnostics ? "有効" : "無効" }}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </template>
        <p v-else class="text-sm text-gray-500">
          プラン「{{ org.plan }}」は定義されていません。プランを変更してください。
        </p>
      </div>

      <!-- 利用状況サマリー -->
      <div v-if="usage && (isSystemAdmin || isOwner)" class="rounded-lg border border-gray-200 bg-white p-6">
        <h2 class="mb-4 text-lg font-bold text-gray-900">利用状況サマリー</h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div class="rounded-md bg-gray-50 p-3">
            <p class="text-xs text-gray-500">ユーザー数</p>
            <p class="text-lg font-semibold" :class="usageColorClass(usage.users, usage.limits.maxUsers)">
              {{ usageDisplay(usage.users, usage.limits.maxUsers) }}
            </p>
            <p class="text-xs text-gray-400">{{ usageLimitLabel(usage.limits.maxUsers) }}</p>
          </div>
          <div class="rounded-md bg-gray-50 p-3">
            <p class="text-xs text-gray-500">グループ数</p>
            <p class="text-lg font-semibold" :class="usageColorClass(usage.groups, usage.limits.maxGroups)">
              {{ usageDisplay(usage.groups, usage.limits.maxGroups) }}
            </p>
            <p class="text-xs text-gray-400">{{ usageLimitLabel(usage.limits.maxGroups) }}</p>
          </div>
          <div class="rounded-md bg-gray-50 p-3">
            <p class="text-xs text-gray-500">サービス数</p>
            <p class="text-lg font-semibold" :class="usageColorClass(usage.services, usage.limits.maxServices)">
              {{ usageDisplay(usage.services, usage.limits.maxServices) }}
            </p>
            <p class="text-xs text-gray-400">{{ usageLimitLabel(usage.limits.maxServices) }}</p>
          </div>
          <div class="rounded-md bg-gray-50 p-3">
            <p class="text-xs text-gray-500">ドキュメント数</p>
            <p class="text-lg font-semibold" :class="usageColorClass(usage.documents, usage.limits.maxDocuments)">
              {{ usageDisplay(usage.documents, usage.limits.maxDocuments) }}
            </p>
            <p class="text-xs text-gray-400">{{ usageLimitLabel(usage.limits.maxDocuments) }}</p>
          </div>
          <div class="rounded-md bg-gray-50 p-3">
            <p class="text-xs text-gray-500">月間チャット数</p>
            <p class="text-lg font-semibold" :class="usageColorClass(usage.monthlyChats, usage.limits.maxMonthlyChats)">
              {{ usageDisplay(usage.monthlyChats, usage.limits.maxMonthlyChats) }}
            </p>
            <p class="text-xs text-gray-400">{{ usageLimitLabel(usage.limits.maxMonthlyChats) }}</p>
          </div>
        </div>
      </div>

      <!-- グループ一覧 -->
      <div class="rounded-lg border border-gray-200 bg-white p-6">
        <h2 class="mb-4 text-lg font-bold text-gray-900">グループ</h2>
        <div v-if="groups.length === 0" class="py-4 text-center text-sm text-gray-500">
          グループがありません
        </div>
        <div v-else class="space-y-2">
          <NuxtLink
            v-for="group in groups"
            :key="group.id"
            :to="`/admin/system/groups/${group.id}`"
            class="flex items-center justify-between rounded-md border border-gray-100 p-3 hover:bg-gray-50"
          >
            <div>
              <span class="text-sm font-medium text-gray-900">{{ group.name }}</span>
              <span
                v-if="!group.isActive"
                class="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
              >
                無効
              </span>
            </div>
            <span class="text-xs text-gray-400">
              {{ new Date(group.createdAt).toLocaleDateString("ja-JP") }}
            </span>
          </NuxtLink>
        </div>
      </div>

      <!-- 契約一覧 -->
      <div class="rounded-lg border border-gray-200 bg-white p-6">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-bold text-gray-900">契約履歴</h2>
          <button
            v-if="isOwner"
            class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            @click="openCreateContract"
          >
            契約を追加
          </button>
        </div>

        <div v-if="contracts.length === 0" class="py-4 text-center text-sm text-gray-500">
          契約がありません
        </div>

        <template v-else>
          <!-- モバイル: カード -->
          <div class="space-y-3 md:hidden">
            <div
              v-for="contract in contracts"
              :key="contract.id"
              class="rounded-md border border-gray-100 p-3"
            >
              <div class="mb-1 flex items-center justify-between">
                <span class="text-sm font-medium">{{ planDisplayName(contract.planId) }}</span>
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-semibold"
                  :class="statusBadgeClass(contract.status)"
                >
                  {{ statusLabel(contract.status) }}
                </span>
              </div>
              <p class="text-xs text-gray-500">
                {{ contract.startDate.slice(0, 10) }} 〜 {{ contract.endDate.slice(0, 10) }}
              </p>
              <p v-if="contract.note" class="mt-1 text-xs text-gray-400">{{ contract.note }}</p>
              <div class="mt-2 flex gap-3">
                <button
                  v-if="isOwner"
                  class="text-xs text-primary-600 hover:text-primary-800"
                  @click="openEditContract(contract)"
                >
                  編集
                </button>
                <button
                  v-if="isOwner && contract.status === 'pending_payment'"
                  class="text-xs text-green-600 hover:text-green-800"
                  @click="confirmPayment(contract)"
                >
                  入金確認
                </button>
              </div>
            </div>
          </div>

          <!-- PC: テーブル -->
          <div class="hidden overflow-x-auto md:block">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    プラン
                  </th>
                  <th class="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    ステータス
                  </th>
                  <th class="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    期間
                  </th>
                  <th class="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    備考
                  </th>
                  <th class="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="contract in contracts" :key="contract.id">
                  <td class="whitespace-nowrap px-4 py-3 text-sm">
                    {{ planDisplayName(contract.planId) }}
                  </td>
                  <td class="px-4 py-3 text-sm">
                    <span
                      class="rounded-full px-2 py-0.5 text-xs font-semibold"
                      :class="statusBadgeClass(contract.status)"
                    >
                      {{ statusLabel(contract.status) }}
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {{ contract.startDate.slice(0, 10) }} 〜
                    {{ contract.endDate.slice(0, 10) }}
                  </td>
                  <td class="max-w-xs truncate px-4 py-3 text-sm text-gray-500">
                    {{ contract.note || "-" }}
                  </td>
                  <td v-if="isOwner" class="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <div class="flex justify-end gap-3">
                      <button
                        class="text-primary-600 hover:text-primary-800"
                        @click="openEditContract(contract)"
                      >
                        編集
                      </button>
                      <button
                        v-if="contract.status === 'pending_payment'"
                        class="text-green-600 hover:text-green-800"
                        @click="confirmPayment(contract)"
                      >
                        入金確認
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </template>

    <!-- 契約作成/編集ダイアログ -->
    <Teleport to="body">
      <div
        v-if="showContractDialog"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      >
        <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h2 class="mb-4 text-lg font-bold text-gray-900">
            {{ editingContract ? "契約を編集" : "契約を追加" }}
          </h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">プラン</label>
              <select
                v-model="contractForm.planId"
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option v-for="plan in PLAN_LIST" :key="plan.id" :value="plan.id">
                  {{ plan.displayName }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">ステータス</label>
              <select
                v-model="contractForm.status"
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option v-for="s in CONTRACT_STATUSES" :key="s.value" :value="s.value">
                  {{ s.label }}
                </option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">開始日</label>
                <input
                  v-model="contractForm.startDate"
                  type="date"
                  class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">終了日</label>
                <input
                  v-model="contractForm.endDate"
                  type="date"
                  class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">備考</label>
              <textarea
                v-model="contractForm.note"
                rows="2"
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="任意"
              />
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button
              class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              @click="showContractDialog = false"
            >
              キャンセル
            </button>
            <button
              class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              :disabled="savingContract"
              @click="saveContract"
            >
              {{ savingContract ? "保存中..." : editingContract ? "更新" : "作成" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
