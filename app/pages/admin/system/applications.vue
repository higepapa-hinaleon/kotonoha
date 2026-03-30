<script setup lang="ts">
import type { Application, ApplicationStatus } from "~~/shared/types/models";

definePageMeta({ layout: "admin", middleware: ["auth", "admin"] });

const { apiFetch } = useApi();
const { show } = useNotification();

const applications = ref<Application[]>([]);
const loading = ref(true);
const activeTab = ref<"all" | ApplicationStatus>("all");

// 詳細表示
const expandedId = ref<string | null>(null);

// 承認・却下処理
const processing = ref(false);
const showRejectDialog = ref(false);
const rejectTargetId = ref<string | null>(null);
const rejectNote = ref("");
const showApproveDialog = ref(false);
const approveTargetId = ref<string | null>(null);

const tabs: { key: "all" | ApplicationStatus; label: string }[] = [
  { key: "all", label: "全て" },
  { key: "pending", label: "審査待ち" },
  { key: "approved", label: "承認済み" },
  { key: "rejected", label: "却下" },
];

const filteredApplications = computed(() => {
  if (activeTab.value === "all") return applications.value;
  return applications.value.filter((a) => a.status === activeTab.value);
});

function organizationTypeLabel(type: string): string {
  const map: Record<string, string> = {
    individual: "個人",
    sole_proprietor: "個人事業主",
    corporation: "法人",
  };
  return map[type] || type;
}

function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    stripe: "クレジットカード",
    bank_transfer: "銀行振込",
    none: "なし",
  };
  return map[method] || method;
}

function planLabel(planId: string): string {
  const map: Record<string, string> = {
    free: "Free",
    starter: "Starter",
    business: "Business",
    enterprise: "Enterprise",
  };
  return map[planId] || planId;
}

function statusLabel(status: ApplicationStatus): string {
  const map: Record<ApplicationStatus, string> = {
    pending: "審査待ち",
    approved: "承認済み",
    rejected: "却下",
  };
  return map[status] || status;
}

function statusBadgeClass(status: ApplicationStatus): string {
  const map: Record<ApplicationStatus, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };
  return map[status] || "bg-gray-100 text-gray-800";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ja-JP");
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

async function fetchApplications() {
  loading.value = true;
  try {
    const data = await apiFetch<{ applications: Application[] }>("/api/applications");
    applications.value = data.applications;
  } catch {
    // useApi handles errors
  } finally {
    loading.value = false;
  }
}

// 承認ダイアログ
function openApproveDialog(id: string) {
  approveTargetId.value = id;
  showApproveDialog.value = true;
}

async function confirmApprove() {
  if (!approveTargetId.value) return;
  processing.value = true;
  try {
    await apiFetch(`/api/applications/${approveTargetId.value}/approve`, {
      method: "POST",
    });
    show("申請を承認しました", "success");
    showApproveDialog.value = false;
    approveTargetId.value = null;
    await fetchApplications();
  } catch {
    // useApi handles errors
  } finally {
    processing.value = false;
  }
}

// 却下ダイアログ
function openRejectDialog(id: string) {
  rejectTargetId.value = id;
  rejectNote.value = "";
  showRejectDialog.value = true;
}

async function confirmReject() {
  if (!rejectTargetId.value) return;
  processing.value = true;
  try {
    await apiFetch(`/api/applications/${rejectTargetId.value}/reject`, {
      method: "POST",
      body: { reviewNote: rejectNote.value },
    });
    show("申請を却下しました", "success");
    showRejectDialog.value = false;
    rejectTargetId.value = null;
    rejectNote.value = "";
    await fetchApplications();
  } catch {
    // useApi handles errors
  } finally {
    processing.value = false;
  }
}

onMounted(() => {
  fetchApplications();
});
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">申請管理</h1>

    <!-- タブフィルター -->
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex space-x-6" aria-label="Tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors"
          :class="
            activeTab === tab.key
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
          "
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span
            v-if="tab.key !== 'all'"
            class="ml-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            :class="
              activeTab === tab.key
                ? 'bg-primary-100 text-primary-600'
                : 'bg-gray-100 text-gray-500'
            "
          >
            {{ applications.filter((a) => a.status === tab.key).length }}
          </span>
        </button>
      </nav>
    </div>

    <div v-if="loading" class="py-8 text-center text-gray-500">読み込み中...</div>

    <div
      v-else-if="filteredApplications.length === 0"
      class="rounded-lg border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-400"
    >
      該当する申請はありません
    </div>

    <template v-else>
      <!-- モバイル: カード表示 -->
      <div class="space-y-3 md:hidden">
        <div
          v-for="app in filteredApplications"
          :key="app.id"
          class="rounded-lg border border-gray-200 bg-white"
        >
          <button
            class="w-full p-4 text-left"
            @click="toggleExpand(app.id)"
          >
            <div class="flex items-start justify-between">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-gray-900">{{ app.applicantEmail }}</p>
                <p class="mt-0.5 text-xs text-gray-500">{{ app.organizationName }}</p>
              </div>
              <span
                class="ml-2 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium"
                :class="statusBadgeClass(app.status)"
              >
                {{ statusLabel(app.status) }}
              </span>
            </div>
            <div class="mt-2 flex items-center gap-3 text-xs text-gray-500">
              <span>{{ organizationTypeLabel(app.organizationType) }}</span>
              <span>{{ planLabel(app.planId) }}</span>
              <span>{{ formatDate(app.createdAt) }}</span>
            </div>
          </button>

          <!-- 展開時の詳細 -->
          <div v-if="expandedId === app.id" class="border-t border-gray-100 px-4 pb-4 pt-3">
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between">
                <dt class="text-gray-500">契約者区分</dt>
                <dd class="text-gray-900">{{ organizationTypeLabel(app.organizationType) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">組織名</dt>
                <dd class="text-gray-900">{{ app.organizationName }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">担当者名</dt>
                <dd class="text-gray-900">{{ app.contactName }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">電話番号</dt>
                <dd class="text-gray-900">{{ app.phone }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">住所</dt>
                <dd class="text-right text-gray-900">{{ app.address }}</dd>
              </div>
              <div v-if="app.tradeName" class="flex justify-between">
                <dt class="text-gray-500">屋号</dt>
                <dd class="text-gray-900">{{ app.tradeName }}</dd>
              </div>
              <div v-if="app.representativeName" class="flex justify-between">
                <dt class="text-gray-500">代表者名</dt>
                <dd class="text-gray-900">{{ app.representativeName }}</dd>
              </div>
              <div v-if="app.corporateNumber" class="flex justify-between">
                <dt class="text-gray-500">法人番号</dt>
                <dd class="text-gray-900">{{ app.corporateNumber }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">プラン</dt>
                <dd class="text-gray-900">{{ planLabel(app.planId) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">支払方法</dt>
                <dd class="text-gray-900">{{ paymentMethodLabel(app.paymentMethod) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-500">申請日</dt>
                <dd class="text-gray-900">{{ formatDate(app.createdAt) }}</dd>
              </div>
              <div v-if="app.reviewNote" class="flex justify-between">
                <dt class="text-gray-500">審査コメント</dt>
                <dd class="text-right text-gray-900">{{ app.reviewNote }}</dd>
              </div>
            </dl>

            <!-- 審査待ちの場合のアクションボタン -->
            <div v-if="app.status === 'pending'" class="mt-4 flex gap-3">
              <button
                :disabled="processing"
                class="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                @click.stop="openApproveDialog(app.id)"
              >
                承認
              </button>
              <button
                :disabled="processing"
                class="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                @click.stop="openRejectDialog(app.id)"
              >
                却下
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- PC: テーブル表示 -->
      <div class="hidden overflow-hidden rounded-lg border border-gray-200 bg-white md:block">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                申請者メール
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                契約者区分
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                組織名
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                プラン
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                支払方法
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                申請日
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                ステータス
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                操作
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <template v-for="app in filteredApplications" :key="app.id">
              <tr
                class="cursor-pointer hover:bg-gray-50"
                @click="toggleExpand(app.id)"
              >
                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {{ app.applicantEmail }}
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {{ organizationTypeLabel(app.organizationType) }}
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                  {{ app.organizationName }}
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {{ planLabel(app.planId) }}
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {{ paymentMethodLabel(app.paymentMethod) }}
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {{ formatDate(app.createdAt) }}
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-sm">
                  <span
                    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    :class="statusBadgeClass(app.status)"
                  >
                    {{ statusLabel(app.status) }}
                  </span>
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-sm">
                  <div v-if="app.status === 'pending'" class="flex gap-2" @click.stop>
                    <button
                      :disabled="processing"
                      class="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      @click="openApproveDialog(app.id)"
                    >
                      承認
                    </button>
                    <button
                      :disabled="processing"
                      class="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      @click="openRejectDialog(app.id)"
                    >
                      却下
                    </button>
                  </div>
                  <span v-else class="text-xs text-gray-400">-</span>
                </td>
              </tr>

              <!-- 展開行: 詳細 -->
              <tr v-if="expandedId === app.id">
                <td colspan="8" class="bg-gray-50 px-6 py-4">
                  <dl class="grid grid-cols-2 gap-x-8 gap-y-2 text-sm lg:grid-cols-3">
                    <div>
                      <dt class="text-gray-500">担当者名</dt>
                      <dd class="text-gray-900">{{ app.contactName }}</dd>
                    </div>
                    <div>
                      <dt class="text-gray-500">電話番号</dt>
                      <dd class="text-gray-900">{{ app.phone }}</dd>
                    </div>
                    <div>
                      <dt class="text-gray-500">住所</dt>
                      <dd class="text-gray-900">{{ app.address }}</dd>
                    </div>
                    <div v-if="app.tradeName">
                      <dt class="text-gray-500">屋号</dt>
                      <dd class="text-gray-900">{{ app.tradeName }}</dd>
                    </div>
                    <div v-if="app.representativeName">
                      <dt class="text-gray-500">代表者名</dt>
                      <dd class="text-gray-900">{{ app.representativeName }}</dd>
                    </div>
                    <div v-if="app.corporateNumber">
                      <dt class="text-gray-500">法人番号</dt>
                      <dd class="text-gray-900">{{ app.corporateNumber }}</dd>
                    </div>
                    <div v-if="app.reviewedBy">
                      <dt class="text-gray-500">審査者</dt>
                      <dd class="text-gray-900">{{ app.reviewedBy }}</dd>
                    </div>
                    <div v-if="app.reviewNote" class="col-span-2">
                      <dt class="text-gray-500">審査コメント</dt>
                      <dd class="text-gray-900">{{ app.reviewNote }}</dd>
                    </div>
                    <div v-if="app.organizationId">
                      <dt class="text-gray-500">組織ID</dt>
                      <dd class="text-gray-900">{{ app.organizationId }}</dd>
                    </div>
                    <div v-if="app.contractId">
                      <dt class="text-gray-500">契約ID</dt>
                      <dd class="text-gray-900">{{ app.contractId }}</dd>
                    </div>
                  </dl>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>

    <!-- 承認確認ダイアログ -->
    <div
      v-if="showApproveDialog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="showApproveDialog = false"
    >
      <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 class="mb-4 text-lg font-semibold text-gray-900">申請を承認</h3>
        <p class="text-sm text-gray-600">
          この申請を承認しますか？組織とユーザーアカウントが作成されます。
        </p>
        <div class="mt-6 flex justify-end gap-3">
          <button
            class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            @click="showApproveDialog = false"
          >
            キャンセル
          </button>
          <button
            :disabled="processing"
            class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            @click="confirmApprove"
          >
            {{ processing ? "処理中..." : "承認する" }}
          </button>
        </div>
      </div>
    </div>

    <!-- 却下確認ダイアログ -->
    <div
      v-if="showRejectDialog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="showRejectDialog = false"
    >
      <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 class="mb-4 text-lg font-semibold text-gray-900">申請を却下</h3>
        <p class="mb-4 text-sm text-gray-600">
          この申請を却下しますか？申請者に通知されます。
        </p>
        <div>
          <label class="block text-sm font-medium text-gray-700">却下理由（任意）</label>
          <textarea
            v-model="rejectNote"
            rows="3"
            class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            placeholder="却下の理由を入力してください（任意）"
          />
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button
            class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            @click="showRejectDialog = false"
          >
            キャンセル
          </button>
          <button
            :disabled="processing"
            class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            @click="confirmReject"
          >
            {{ processing ? "処理中..." : "却下する" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
